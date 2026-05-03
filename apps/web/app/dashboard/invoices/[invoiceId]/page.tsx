"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Download, Loader2, Send, Trash2, CalendarDays, Eye, EyeOff, ExternalLink, X, FileText, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { SkeletonCard, SkeletonLine } from "@/components/ui/skeleton";
import { BackButton } from "@/components/ui/back-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    { enabled: !!invoiceId, staleTime: 30 * 1000 },
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
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-white">
          <p className="text-rose-400 font-bold uppercase tracking-widest text-xs">Failed to load invoice.</p>
          <Button variant="outline" onClick={() => refetch()} className="border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl font-black uppercase tracking-widest text-[10px]">
            Try Again
          </Button>
        </div>
      );
    }
    return (
      <div className="space-y-6 pt-4 pb-24 px-1">
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
    <div className="space-y-6 pt-4 pb-24 text-white">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3 px-1"
      >
        <BackButton href="/dashboard/invoices" />
        <h1 className="text-2xl font-black text-white tracking-tight leading-none">Invoice {invoiceNumber}</h1>
      </motion.div>

      {/* Invoice Header */}
      <Card variant="premium" className="rounded-3xl overflow-hidden backdrop-blur-2xl shadow-2xl">
        <CardContent className="p-6 space-y-6">
          <div className="flex justify-between items-start gap-4 relative z-10">
            <div className="overflow-hidden pr-2">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Client</p>
              <p className="font-black text-white text-xl tracking-tight leading-tight truncate">{invoiceMeta.clients?.name ?? "Unknown Client"}</p>
              <p className="text-[10px] font-mono text-zinc-500 mt-1 uppercase">#{invoice.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border backdrop-blur-xl shrink-0 ${
              ['paid_cash', 'paid_qr'].includes(invoice.status)
                ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
                : invoice.status === 'void'
                  ? 'bg-rose-600/20 text-rose-400 border-rose-500/30'
                  : 'bg-amber-600/20 text-amber-400 border-amber-500/30'
            }`}>
              {formatStatus(invoice.status)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 shadow-inner">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Created</p>
              <p className="font-bold text-white text-sm">{new Date(invoice.created_at).toLocaleDateString("en-SG", { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 shadow-inner space-y-3">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                Due Date <CalendarDays className="h-3 w-3 text-blue-500" />
              </p>
              <div className="flex flex-col gap-2">
                <Input
                  type="date"
                  value={dueDate || invoice.due_date || ""}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-zinc-900/50 border-white/10 text-white h-10 w-full min-w-0 max-w-full appearance-none px-3 rounded-xl focus:border-blue-500/50 font-bold"
                />
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest h-10 rounded-xl shadow-lg shadow-blue-600/20"
                  disabled={updateDueDate.isPending || !(dueDate && dueDate !== invoice.due_date)}
                  onClick={() => updateDueDate.mutate({ invoiceId, dueDate })}
                >
                  {updateDueDate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  SAVE DATE
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card variant="premium" className="rounded-3xl overflow-hidden backdrop-blur-2xl shadow-2xl">
        <CardContent className="p-6 space-y-5 relative z-10">
          <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" /> Line Items
          </h2>
          <div className="space-y-3">
            {lineItems.length > 0 ? (
              lineItems.map((item: InvoiceLineItem, index: number) => (
                <div key={`${item.description}-${index}`} className="flex items-center justify-between rounded-xl bg-white/5 border border-white/5 p-4 shadow-inner group transition-all hover:bg-white/10">
                  <p className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors">{item.description}</p>
                  <p className="text-sm font-black text-white tabular-nums">{formatCurrency(item.amountCents / 100)}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-600 font-bold uppercase tracking-widest text-center py-4">No line items found.</p>
            )}
          </div>

          <div className="border-t border-white/10 pt-5 space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Subtotal</span>
              <span className="font-bold text-zinc-400 tabular-nums">{formatCurrency(subtotalCents / 100)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Tax (0%)</span>
              <span className="font-bold text-zinc-400 tabular-nums">{formatCurrency(taxCents / 100)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-white/5">
              <span className="font-black text-white text-lg tracking-tight uppercase">Total Amount</span>
              <span className="font-black text-white text-2xl tracking-tighter tabular-nums">{formatCurrency(totalCents / 100)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PDF Preview Section */}
      <Card variant="premium" className="rounded-3xl overflow-hidden backdrop-blur-2xl shadow-2xl">
        <CardContent className="p-6 space-y-5 relative z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                <Eye className="h-4 w-4 text-purple-500" /> Invoice Preview
            </h2>
            <div className="flex items-center gap-2">
              {showPreview && previewUrl && (
                <button
                  onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                  className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-90"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              )}
              <Button
                variant="outline"
                size="sm"
                className={`h-10 rounded-xl border transition-all active:scale-95 ${showPreview ? 'bg-zinc-800 border-white/20 text-white' : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'}`}
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : showPreview ? (
                  <EyeOff className="mr-2 h-4 w-4" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                <span className="font-black text-[10px] uppercase tracking-widest">{showPreview ? "HIDE" : existingPdfUrl ? "PREVIEW" : "GENERATE"}</span>
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
                <div className="rounded-[1.5rem] overflow-hidden border border-white/10 bg-white shadow-inner">
                  <object
                    data={`${previewUrl}#view=FitH`}
                    type="application/pdf"
                    className="w-full border-0"
                    style={{ height: "70vh", minHeight: 400 }}
                  >
                    <div className="flex flex-col items-center justify-center p-8 text-center bg-zinc-950">
                      <p className="text-zinc-500 font-bold mb-4 text-sm uppercase tracking-wider">Inline Preview Not Supported</p>
                      <Button asChild variant="outline" className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 font-black uppercase tracking-widest text-[10px]">
                        <a href={previewUrl} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4 mr-2" /> DOWNLOAD TO VIEW</a>
                      </Button>
                    </div>
                  </object>
                </div>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider text-center mt-3">
                  Preview quality depends on device support. Download for full accuracy.
                </p>
              </motion.div>
            ) : !showPreview ? (
              <div className="text-center py-12 rounded-[2rem] border border-dashed border-white/5 bg-white/5">
                <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/5">
                    <Eye className="h-6 w-6 text-zinc-700" />
                </div>
                <p className="text-zinc-600 font-black uppercase tracking-widest text-[10px]">
                  {existingPdfUrl ? "Tap Preview to see the invoice" : "Generate a PDF to see a preview here"}
                </p>
              </div>
            ) : null}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card variant="premium" className="rounded-3xl overflow-hidden backdrop-blur-2xl shadow-2xl">
        <CardContent className="p-6 space-y-6 relative z-10">
          <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
            <Settings className="h-4 w-4 text-orange-500" /> Actions
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-14 rounded-2xl border-white/10 bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all"
              onClick={handleResendInvoice}
              disabled={activeAction !== null}
            >
              {activeAction === "resend" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4 text-blue-400" />}
              RESEND
            </Button>
            <Button
              variant="outline"
              className="h-14 rounded-2xl border-white/10 bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all"
              onClick={handleDownloadPdf}
              disabled={activeAction !== null}
            >
              {activeAction === "download" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4 text-purple-400" />}
              DOWNLOAD
            </Button>
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Update Invoice Status</p>
            <Select value={effectiveStatus} onValueChange={(value) => setSelectedStatus(value as InvoiceStatus)}>
              <SelectTrigger className="bg-zinc-900/50 border-white/10 text-white h-12 rounded-xl backdrop-blur-md font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-white backdrop-blur-2xl">
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="focus:bg-white/10 focus:text-white font-bold text-xs uppercase tracking-widest py-3">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-blue-600/20 active:scale-95 transition-all mt-2"
              disabled={!canSaveStatus}
              onClick={() => updateStatus.mutate({ invoiceId, status: effectiveStatus })}
            >
              {updateStatus.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              SAVE STATUS
            </Button>
          </div>

          {/* Delete Invoice */}
          {isDeletable && (
            <div className="border-t border-white/10 pt-6 mt-2">
              <AnimatePresence>
              {confirmDelete ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                  <p className="text-[10px] text-rose-400 font-black text-center uppercase tracking-widest">
                    ARE YOU SURE? THIS ACTION CANNOT BE UNDONE.
                  </p>
                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      className="flex-1 h-12 rounded-xl border-white/10 bg-white/5 text-zinc-500 font-black uppercase tracking-widest text-[10px]"
                      onClick={() => setConfirmDelete(false)}
                    >
                      CANCEL
                    </Button>
                    <Button
                      className="flex-1 h-12 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-600/20"
                      disabled={deleteInvoice.isPending}
                      onClick={() => deleteInvoice.mutate({ invoiceId })}
                    >
                      {deleteInvoice.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4 mr-1.5" />}
                      DELETE FOREVER
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl border-rose-600/20 bg-rose-600/5 text-rose-400 hover:bg-rose-600/10 font-black uppercase tracking-widest text-[10px] transition-all"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  DELETE INVOICE
                </Button>
              )}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
