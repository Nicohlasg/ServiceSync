"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Loader2, Send, Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { SkeletonCard, SkeletonLine } from "@/components/ui/skeleton";
import { BackButton } from "@/components/ui/back-button";
import { Calendar } from "@/components/ui/calendar";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
  DrawerFooter,
} from "@/components/ui/drawer";

type InvoiceStatus = "draft" | "pending" | "awaiting_qr_confirmation" | "paid_cash" | "paid_qr" | "disputed" | "void";
type InvoiceLineItem = { description: string; amountCents: number };

const statusOptions: { value: InvoiceStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "awaiting_qr_confirmation", label: "Awaiting QR Confirmation" },
  { value: "paid_cash", label: "Paid (Cash)" },
  { value: "paid_qr", label: "Paid (QR)" },
  { value: "disputed", label: "Disputed" },
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
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeAction, setActiveAction] = useState<"download" | "resend" | null>(null);

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
      setEditingDueDate(false);
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

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-slate-400">Created</p>
              <p className="font-semibold text-white">{new Date(invoice.created_at).toLocaleDateString("en-SG")}</p>
            </div>
            <Drawer open={editingDueDate} onOpenChange={setEditingDueDate}>
              <DrawerTrigger asChild>
                <div
                  className="bg-white/5 border border-white/10 rounded-xl p-3 flex justify-between items-center cursor-pointer active:bg-white/10 transition-colors"
                  onClick={() => {
                    setDueDate(invoice.due_date ?? '');
                    setEditingDueDate(true);
                  }}
                >
                  <p className="text-slate-400 flex items-center gap-1">
                    Due Date <CalendarDays className="h-3 w-3" />
                  </p>
                  <p className="font-medium text-slate-200">
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-SG", { day: '2-digit', month: 'short', year: 'numeric' }) : "Tap to set"}
                  </p>
                </div>
              </DrawerTrigger>

              <DrawerContent className="bg-[#1c1c1e] border-white/10 text-white pb-6 rounded-t-[2rem]">
                <DrawerHeader className="border-b border-white/10 mb-4 pb-4">
                  <DrawerTitle className="text-center font-semibold text-white">Select Due Date</DrawerTitle>
                </DrawerHeader>
                <div className="flex justify-center flex-1 px-4 min-h-[340px] items-start">
                  <div className="bg-[#2c2c2e] rounded-3xl overflow-hidden p-4 shadow-xl border border-white/10 w-full max-w-[340px]">
                    <Calendar
                      mode="single"
                      fixedWeeks={true}
                      selected={dueDate ? new Date(dueDate) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const yyyy = date.getFullYear();
                          const mm = String(date.getMonth() + 1).padStart(2, '0');
                          const dd = String(date.getDate()).padStart(2, '0');
                          setDueDate(`${yyyy}-${mm}-${dd}`);
                        } else {
                          setDueDate('');
                        }
                      }}
                      className="bg-transparent text-white p-0 flex justify-center w-full"
                    />
                  </div>
                </div>
                <DrawerFooter className="flex-row gap-3 pt-6 px-6">
                  <DrawerClose asChild>
                    <Button variant="outline" className="flex-1 rounded-xl h-12 bg-[#2c2c2e] border-transparent text-white hover:bg-[#3a3a3c] hover:text-white font-semibold">
                      Cancel
                    </Button>
                  </DrawerClose>
                  <Button 
                    className="flex-1 rounded-xl h-12 bg-blue-600 text-white hover:bg-blue-500 font-semibold"
                    disabled={updateDueDate.isPending}
                    onClick={() => {
                      updateDueDate.mutate({ invoiceId, dueDate });
                      setEditingDueDate(false);
                    }}
                  >
                    {updateDueDate.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save"}
                  </Button>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
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

      {/* Actions */}
      <Card className="bg-slate-900/65 backdrop-blur-xl border-white/15 rounded-3xl">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Actions</h2>

          <div className="flex gap-3">
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
