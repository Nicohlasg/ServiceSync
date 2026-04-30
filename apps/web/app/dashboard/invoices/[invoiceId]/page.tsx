"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Download, Loader2, Send, Trash2, CalendarDays, Eye, EyeOff, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { SkeletonCard, SkeletonLine } from "@/components/ui/skeleton";
import { BackButton } from "@/components/ui/back-button";
import { Input } from "@/components/ui/input";

type InvoiceStatus = "draft" | "pending" | "awaiting_qr_confirmation" | "paid_cash" | "paid_qr" | "disputed" | "void";
type InvoiceLineItem = { description: string; amountCents: number };

const statusOptions: { value: InvoiceStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "paid_cash", label: "Paid (Cash)" },
  { value: "paid_qr", label: "Paid (QR)" },
  { value: "void", label: "Void" },
];

function formatStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function downloadFileFromUrl(url: string, fileName: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to download invoice PDF");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

export default function InvoiceDetailPage() {
  const params = useParams<{ invoiceId: string }>();
  const invoiceId = params?.invoiceId ?? "";
  const router = useRouter();
  const utils = api.useUtils();

  const { data: invoice, isLoading, isError, refetch } = api.invoices.getById.useQuery(
    { invoiceId },
    { enabled: !!invoiceId },
  );

  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus | "">("");
  const [dueDate, setDueDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeAction, setActiveAction] = useState<"download" | "resend" | "preview" | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const updateStatus = api.invoices.updateStatus.useMutation({
    onSuccess: async () => {
      toast.success("Invoice status updated");
      setSelectedStatus(""); // Reset so it reflects the new actual status
      await Promise.all([
        utils.invoices.getById.invalidate({ invoiceId }),
        utils.invoices.list.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  const updateDueDate = api.invoices.updateDueDate.useMutation({
    onSuccess: async () => {
      toast.success("Due date updated");
      await utils.invoices.getById.invalidate({ invoiceId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update due date");
    },
  });

  const deleteInvoice = api.invoices.delete.useMutation({
    onSuccess: async () => {
      toast.success("Invoice deleted");
      await utils.invoices.list.invalidate();
      router.push("/dashboard/invoices");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete invoice");
      setConfirmDelete(false);
    },
  });

  const generatePdf = api.invoices.generatePdf.useMutation();
  const resendInvoice = api.invoices.resend.useMutation();

  const lineItems: InvoiceLineItem[] = !invoice?.line_items || !Array.isArray(invoice.line_items)
    ? []
    : invoice.line_items
      .map((item: { description?: unknown; amountCents?: unknown; amount_cents?: unknown }) => ({
        description: String(item?.description ?? "Service"),
        amountCents: Number(item?.amountCents ?? item?.amount_cents ?? 0),
      }))
      .filter((item: InvoiceLineItem) => item.description.length > 0);

  const currentStatus = (invoice?.status ?? "pending") as InvoiceStatus;
  const effectiveStatus = (selectedStatus || currentStatus) as InvoiceStatus;
  const canSaveStatus = !!invoice && effectiveStatus !== currentStatus && !updateStatus.isPending;
  const isDeletable = ['draft', 'pending', 'void'].includes(currentStatus);

  // Check if a PDF already exists (generated previously)
  const existingPdfUrl = invoice?.pdf_url || invoice?.draft_pdf_url || null;

  if (isLoading || !invoice) {
    if (isError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <p className="text-red-400 font-medium">Failed to load invoice.</p>
          <Button variant="outline" onClick={() => refetch()} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
            Try Again
          </Button>
        </div>
      );
    }
    return (
      <div className="space-y-6 pt-4 pb-24">
        <div className="flex items-center gap-3">
          <SkeletonLine width="40px" className="h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonLine width="55%" className="h-7" />
            <SkeletonLine width="35%" className="h-4" />
          </div>
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const subtotalCents = Number(invoice.subtotal_cents ?? 0);
  const taxCents = Number(invoice.tax_cents ?? 0);
  const totalCents = Number(invoice.total_cents ?? 0);
  const invoiceNumber = invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase();
  const invoiceMeta = invoice as unknown as {
    clients?: { name?: string | null } | null;
  };
  const pdfFileName = `${invoiceNumber}.pdf`;

  async function handlePreviewPdf() {
    // If we already have a URL, just toggle the preview
    if (existingPdfUrl) {
      setPreviewUrl(existingPdfUrl);
      setShowPreview(true);
      return;
    }

    // Otherwise generate a PDF first
    setActiveAction("preview");
    try {
      const result = await generatePdf.mutateAsync({ invoiceId });
      if (!result.pdfUrl) throw new Error("PDF generation completed without a URL");

      await Promise.all([
        utils.invoices.getById.invalidate({ invoiceId }),
        utils.invoices.list.invalidate(),
      ]);

      setPreviewUrl(result.pdfUrl);
      setShowPreview(true);
      toast.success("Invoice PDF ready");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate preview");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleDownloadPdf() {
    setActiveAction("download");

    try {
      const result = await generatePdf.mutateAsync({ invoiceId });

      if (!result.pdfUrl) {
        throw new Error("PDF generation completed without a download URL");
      }

      await Promise.all([
        utils.invoices.getById.invalidate({ invoiceId }),
        utils.invoices.list.invalidate(),
      ]);
      await downloadFileFromUrl(result.pdfUrl, pdfFileName);
      toast.success("Invoice PDF downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download invoice PDF");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleResendInvoice() {
    setActiveAction("resend");

    try {
      await generatePdf.mutateAsync({ invoiceId });
      await Promise.all([
        utils.invoices.getById.invalidate({ invoiceId }),
        utils.invoices.list.invalidate(),
      ]);

      const result = await resendInvoice.mutateAsync({ invoiceId });
      window.open(result.waLink, "_blank", "noopener,noreferrer");
      toast.success("WhatsApp receipt ready to send");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to prepare WhatsApp receipt");
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <div className="space-y-6 pt-4 pb-24">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3"
      >
        <BackButton href="/dashboard/invoices" />
        <h1 className="text-xl font-bold text-white">Invoice {invoiceNumber}</h1>
      </motion.div>

      {/* Invoice Header */}
      <Card className="bg-slate-900/65 backdrop-blur-xl border-white/15 rounded-3xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="text-sm text-slate-400">Client</p>
              <p className="font-bold text-white">{invoiceMeta.clients?.name ?? "Unknown Client"}</p>
              <p className="text-xs text-slate-500">#{invoice.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <span className={`text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
              ['paid_cash', 'paid_qr'].includes(invoice.status)
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                : invoice.status === 'void'
                  ? 'bg-red-500/20 text-red-300 border border-red-400/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
            }`}>
              {formatStatus(invoice.status)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-slate-400">Created</p>
              <p className="font-semibold text-white">{new Date(invoice.created_at).toLocaleDateString("en-SG")}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
              <p className="text-slate-400 flex items-center gap-1">
                Due Date <CalendarDays className="h-3 w-3" />
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="date"
                  value={dueDate || invoice.due_date || ""}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-slate-800/50 border-white/10 text-white h-9 w-full min-w-0 max-w-full appearance-none px-3 sm:flex-1"
                />
                <Button
                  size="sm"
                  className="bg-blue-600 text-white hover:bg-blue-500 h-9 px-4 w-full sm:w-auto"
                  disabled={updateDueDate.isPending || !(dueDate && dueDate !== invoice.due_date)}
                  onClick={() => updateDueDate.mutate({ invoiceId, dueDate })}
                >
                  {updateDueDate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card className="bg-slate-900/65 backdrop-blur-xl border-white/15 rounded-3xl">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Line Items</h2>
          <div className="space-y-2">
            {lineItems.length > 0 ? (
              lineItems.map((item: InvoiceLineItem, index: number) => (
                <div key={`${item.description}-${index}`} className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-3">
                  <p className="text-sm font-medium text-slate-300">{item.description}</p>
                  <p className="text-sm font-bold text-white">{formatCurrency(item.amountCents / 100)}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No line items found.</p>
            )}
          </div>

          <div className="border-t border-white/10 pt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Subtotal</span>
              <span className="font-semibold text-slate-200">{formatCurrency(subtotalCents / 100)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Tax</span>
              <span className="font-semibold text-slate-200">{formatCurrency(taxCents / 100)}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="font-bold text-white">Total</span>
              <span className="font-bold text-white">{formatCurrency(totalCents / 100)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PDF Preview Section */}
      <Card className="bg-slate-900/65 backdrop-blur-xl border-white/15 rounded-3xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Invoice Preview</h2>
            <div className="flex items-center gap-2">
              {showPreview && previewUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-white h-8 px-2"
                  onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="border-white/15 text-slate-300 hover:bg-white/10 hover:text-white h-8"
                onClick={() => {
                  if (showPreview) {
                    setShowPreview(false);
                  } else {
                    handlePreviewPdf();
                  }
                }}
                disabled={activeAction === "preview"}
              >
                {activeAction === "preview" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : showPreview ? (
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                )}
                {showPreview ? "Hide" : existingPdfUrl ? "Preview" : "Generate & Preview"}
              </Button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {showPreview && previewUrl ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl overflow-hidden border border-white/10 bg-white">
                  <object
                    data={`${previewUrl}#view=FitH`}
                    type="application/pdf"
                    className="w-full border-0"
                    style={{ height: "70vh", minHeight: 400 }}
                  >
                    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                      <p className="text-slate-500 mb-4">Your browser does not support inline PDFs.</p>
                      <Button asChild variant="outline">
                        <a href={previewUrl} target="_blank" rel="noopener noreferrer">Download PDF</a>
                      </Button>
                    </div>
                  </object>
                </div>
                <p className="text-[10px] text-slate-500 text-center mt-2">
                  If the preview doesn&apos;t load, your browser may be blocking embedded PDFs. Use the external link icon or download the file.
                </p>
              </motion.div>
            ) : !showPreview ? (
              <div className="text-center py-6 rounded-2xl border border-dashed border-white/10">
                <Eye className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">
                  {existingPdfUrl ? "Tap Preview to see the invoice" : "Generate a PDF to see a preview here"}
                </p>
              </div>
            ) : null}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="bg-slate-900/65 backdrop-blur-xl border-white/15 rounded-3xl">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Actions</h2>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 hover:text-white"
              onClick={handleResendInvoice}
              disabled={activeAction !== null}
            >
              {activeAction === "resend" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Resend
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 hover:text-white"
              onClick={handleDownloadPdf}
              disabled={activeAction !== null}
            >
              {activeAction === "download" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download PDF
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300">Update Status</p>
            <Select value={effectiveStatus} onValueChange={(value) => setSelectedStatus(value as InvoiceStatus)}>
              <SelectTrigger className="bg-slate-800/50 border-white/15 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!canSaveStatus}
              onClick={() => updateStatus.mutate({ invoiceId, status: effectiveStatus })}
            >
              {updateStatus.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Status
            </Button>
          </div>

          {/* Delete Invoice */}
          {isDeletable && (
            <div className="border-t border-white/10 pt-4">
              {confirmDelete ? (
                <div className="space-y-3">
                  <p className="text-sm text-red-400 font-medium text-center">
                    Are you sure? This cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 border-white/15 text-slate-300 hover:bg-white/10"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      disabled={deleteInvoice.isPending}
                      onClick={() => deleteInvoice.mutate({ invoiceId })}
                    >
                      {deleteInvoice.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Invoice
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
