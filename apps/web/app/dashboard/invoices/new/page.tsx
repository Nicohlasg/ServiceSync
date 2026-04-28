"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Download, Send, CheckCircle2, QrCode, Banknote, DollarSign, ChevronRight, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X as XIcon } from "lucide-react";
import { SkeletonCard, SkeletonLine } from "@/components/ui/skeleton";
import { DigitalHandshakeModal } from "@/components/DigitalHandshakeModal";
import { api, type RouterOutputs } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { trackEvent } from "@/lib/analytics";
import { BackButton } from "@/components/ui/back-button";
import { useFormDraft } from "@/lib/useFormDraft";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientOption {
  id: string;
  name: string;
  phone: string;
}

function NewInvoice() {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "preview">("form");
  const { push } = useRouter();
  const searchParams = useSearchParams();
  const bookingIdParam = searchParams.get("bookingId");
  const utils = api.useUtils();

  // Client list from DB
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);

  // Service catalog
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const servicesQuery = api.provider.getServices.useQuery();

  useEffect(() => {
    async function loadClients() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("clients")
        .select("id, name, phone")
        .eq("provider_id", user.id)
        .eq("is_deleted", false)
        .order("name", { ascending: true });

      if (data) setClients(data);
    }
    loadClients();
  }, []);

  // Handshake Modal
  const [showHandshake, setShowHandshake] = useState(false);

  // Form State — persisted to localStorage so basement drops don't lose data
  const [formData, setFormData, clearInvoiceDraft] = useFormDraft('draft-invoice-new', {
    clientId: "",
    clientName: "",
    serviceDescription: "",
    amount: "",
    depositPaid: "0",
    phone: "",
  });

  // Created invoice state
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  // tRPC mutations
  const createInvoice = api.invoices.create.useMutation({
    // Invalidate the invoices list on success so the user sees the new row
    // when they navigate back — cheap cache coherency, no rollback needed.
    onSuccess: () => {
      utils.invoices.list.invalidate();
    },
  });
  const generatePdf = api.invoices.generatePdf.useMutation();

  // Cash confirmation via tRPC — optimistically flip the invoice status to
  // paid_cash in any cached list/detail queries so the /dashboard/invoices
  // page lands already showing the new state. Roll back on error.
  const confirmCash = api.cash.confirmCashPayment.useMutation({
    onMutate: async ({ invoiceId: targetInvoiceId }) => {
      await utils.invoices.list.cancel();
      await utils.invoices.getById.cancel({ invoiceId: targetInvoiceId });

      const prevList = utils.invoices.list.getData({ limit: 100 });
      const prevDetail = utils.invoices.getById.getData({ invoiceId: targetInvoiceId });

      utils.invoices.list.setData({ limit: 100 }, (old) => {
        if (!old?.invoices) return old;
        return {
          ...old,
          invoices: old.invoices.map((inv) =>
            inv.id === targetInvoiceId ? { ...inv, status: "paid_cash" } : inv,
          ),
        };
      });
      utils.invoices.getById.setData({ invoiceId: targetInvoiceId }, (old: RouterOutputs["invoices"]["getById"] | undefined) => {
        if (!old) return old;
        return { ...old, status: "paid_cash" };
      });

      return { prevList, prevDetail, targetInvoiceId };
    },
    onSuccess: () => {
      trackEvent('first_paid', { method: 'cash' });
      toast.success("Cash payment recorded!");
      setShowHandshake(false);
      push("/dashboard/invoices");
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prevList) {
        utils.invoices.list.setData({ limit: 100 }, ctx.prevList);
      }
      if (ctx?.prevDetail && ctx.targetInvoiceId) {
        utils.invoices.getById.setData({ invoiceId: ctx.targetInvoiceId }, ctx.prevDetail);
      }
      toast.error(err.message || "Failed to record cash payment");
    },
    onSettled: () => {
      utils.invoices.list.invalidate();
    },
  });

  // QR payment confirmation
  const [showQrConfirm, setShowQrConfirm] = useState(false);

  const confirmQrPayment = api.cash.confirmQrPayment.useMutation({
    onSuccess: () => {
      trackEvent('first_paid', { method: 'paynow' });
      toast.success("PayNow payment confirmed!");
      utils.invoices.list.invalidate();
      setShowQrConfirm(false);
      push("/dashboard/invoices");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to confirm QR payment");
    },
  });

  const isQrPaid = confirmQrPayment.isSuccess;

  const handleClientSelect = (value: string) => {
    if (value === "new") {
      setFormData({ ...formData, clientId: "new", clientName: "", phone: "" });
    } else {
      const client = clients.find((c) => c.id === value);
      if (client) {
        setFormData({ ...formData, clientId: client.id, clientName: client.name, phone: client.phone });
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // -------------------------------------------------------------------------
  // Submit: create invoice via tRPC, then generate PDF (which builds real QR)
  // -------------------------------------------------------------------------
  const generateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName && formData.clientId === "new") {
      toast.error("Please enter a client name");
      return;
    }
    if (!formData.amount) {
      toast.error("Please enter an amount");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let finalClientId = formData.clientId;

      // Create client if manual entry
      if (finalClientId === "new") {
        const { data: newClient, error: clientErr } = await supabase
          .from("clients")
          .insert({
            provider_id: user.id,
            name: formData.clientName,
            phone: formData.phone || "",
            address: "",
          })
          .select("id")
          .single();

        if (clientErr) throw clientErr;
        finalClientId = newClient.id;
      }

      const amountCents = Math.round(parseFloat(formData.amount) * 100);
      const depositCents = Math.round(parseFloat(formData.depositPaid || "0") * 100);

      // 1. Create invoice via tRPC
      const invoice = await createInvoice.mutateAsync({
        clientId: finalClientId !== "new" ? finalClientId : undefined,
        bookingId: bookingIdParam || undefined,
        lineItems: [{ description: formData.serviceDescription || "Service", amountCents }],
        taxCents: 0,
        depositAmountCents: depositCents,
      });

      setInvoiceId(invoice.id);

      // 2. Generate PDF (this also builds the real PayNow QR from the provider's key)
      try {
        const pdfResult = await generatePdf.mutateAsync({ invoiceId: invoice.id });
        setPdfUrl(pdfResult.pdfUrl || null);
      } catch (error) {
        console.warn("[Invoice] PDF generation unavailable:", error);
        toast.error(
          error instanceof Error
            ? `Invoice created, but the PDF receipt could not be prepared: ${error.message}`
            : "Invoice created, but the PDF receipt could not be prepared",
        );
      }

      // 3. Fetch the QR URL that generatePdf stored on the invoice
      const { data: updatedInv } = await supabase
        .from("invoices")
        .select("paynow_qr_url")
        .eq("id", invoice.id)
        .single();

      if (updatedInv?.paynow_qr_url) {
        setQrCodeUrl(updatedInv.paynow_qr_url);
      }

      clearInvoiceDraft();
      setStep("preview");
      trackEvent('first_invoice_issued', { invoice_id: invoice.id });
      toast.success("Invoice created!");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to generate invoice";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Cash confirmation handler
  // -------------------------------------------------------------------------
  const handleCashConfirm = (finalAmount: number) => {
    if (!invoiceId) return;
    confirmCash.mutate({
      invoiceId,
      amountCollectedCents: Math.round(finalAmount * 100),
      adjustmentCents: 0,
    });
  };

  // -------------------------------------------------------------------------
  // QR payment: confirm flow
  // -------------------------------------------------------------------------
  const handleQrPaid = () => {
    if (!invoiceId) return;
    setShowQrConfirm(true);
  };

  // -------------------------------------------------------------------------
  // PDF download
  // -------------------------------------------------------------------------
  const downloadPDF = async () => {
    try {
      let nextPdfUrl = pdfUrl;

      if (!nextPdfUrl) {
        if (!invoiceId) {
          throw new Error("Create the invoice first before downloading the PDF receipt");
        }

        const result = await generatePdf.mutateAsync({ invoiceId });
        if (!result.pdfUrl) {
          throw new Error("PDF generation completed without a download URL");
        }

        nextPdfUrl = result.pdfUrl;
        setPdfUrl(result.pdfUrl);
      }

      window.open(nextPdfUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download PDF receipt");
    }
  };

  // -------------------------------------------------------------------------
  // WhatsApp share
  // -------------------------------------------------------------------------
  const handleWhatsApp = () => {
    const phone = formData.phone.replace(/\s/g, "");
    const sgPhone = phone.startsWith("+") ? phone : `+65${phone}`;
    const message = encodeURIComponent(
      `Hi ${formData.clientName}, here is your invoice for ${formData.serviceDescription || "service"}. ` +
      `Amount: ${formatCurrency(parseFloat(formData.amount))}. ` +
      (pdfUrl ? `View receipt: ${pdfUrl}` : "Thank you!")
    );
    window.open(`https://wa.me/${sgPhone.replace("+", "")}?text=${message}`, "_blank");
  };

  const balanceDue = Math.max(0, parseFloat(formData.amount || "0") - parseFloat(formData.depositPaid || "0"));

  return (
    <div className="space-y-6 pt-4 pb-20">
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
        <BackButton onClick={() => step === "preview" ? setStep("form") : push("/dashboard/invoices")} />
        <h1 className="text-2xl font-bold text-white">{step === "preview" ? "Collect Payment" : "New Invoice"}</h1>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === "preview" ? (
          <motion.div key="preview" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="space-y-6">
            <Card className="overflow-hidden border-2 border-slate-100 shadow-2xl rounded-3xl bg-white/90 backdrop-blur-xl">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.2),transparent)]"></div>
                <p className="text-blue-100 text-sm font-bold uppercase tracking-widest mb-1 relative z-10">Balance Due</p>
                <h2 className="text-5xl font-extrabold relative z-10 tracking-tight">{formatCurrency(balanceDue)}</h2>
                {isQrPaid && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-emerald-500/30 backdrop-blur-sm rounded-full py-1.5 px-4 border border-emerald-300/30 relative z-10">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-bold">Paid</span>
                  </div>
                )}
              </div>
              <CardContent className="p-8 space-y-8">
                {/* Primary Actions: QR vs Cash */}
                <div className="grid grid-cols-2 gap-4">
                  {showQrConfirm ? (
                    <div className="col-span-2 space-y-4">
                      <p className="text-center text-sm font-medium text-slate-700">Confirm that you received the PayNow payment?</p>
                      <div className="grid grid-cols-2 gap-4">
                        <Button
                          className="h-16 flex flex-col items-center justify-center gap-1 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-sm"
                          onClick={() => confirmQrPayment.mutate({ invoiceId: invoiceId! })}
                          disabled={confirmQrPayment.isPending}
                        >
                          {confirmQrPayment.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Yes, Confirmed"}
                        </Button>
                        <Button
                          variant="outline"
                          className="h-16 flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition-all"
                          onClick={() => setShowQrConfirm(false)}
                          disabled={confirmQrPayment.isPending}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Button
                        className="h-28 flex flex-col items-center justify-center gap-2 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 border-2 border-blue-200 shadow-sm transition-all"
                        onClick={handleQrPaid}
                        disabled={isQrPaid}
                      >
                        <div className="bg-blue-600 text-white p-2 rounded-full mb-1">
                          <QrCode className="h-6 w-6" />
                        </div>
                        <span className="font-bold text-sm">Client Paid</span>
                        <span className="text-xs text-blue-500 font-medium -mt-2">via QR PayNow</span>
                      </Button>
                      <Button
                        className="h-28 flex flex-col items-center justify-center gap-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-2 border-emerald-200 shadow-sm transition-all"
                        onClick={() => setShowHandshake(true)}
                        disabled={isQrPaid}
                      >
                        <div className="bg-emerald-600 text-white p-2 rounded-full mb-1">
                          <Banknote className="h-6 w-6" />
                        </div>
                        <span className="font-bold text-sm">I Collected</span>
                        <span className="text-xs text-emerald-600 font-medium -mt-2">Physical Cash</span>
                      </Button>
                    </>
                  )}
                </div>

                {qrCodeUrl && (
                  <div className="text-center space-y-3 pt-2">
                    <div className="mx-auto w-48 h-48 bg-white p-3 rounded-2xl border flex items-center justify-center">
                      <Image src={qrCodeUrl} alt="PayNow QR" width={192} height={192} className="w-full h-full object-contain" unoptimized />
                    </div>
                    <p className="text-xs text-slate-400 font-medium max-w-[200px] mx-auto">
                      Ask client to scan this PayNow QR to pay.
                    </p>
                  </div>
                )}

                {!qrCodeUrl && (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    <p>No PayNow QR available.</p>
                    <p className="text-xs mt-1">Set up your PayNow key in Profile to enable QR payments.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-4 px-2">
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                onClick={downloadPDF}
                disabled={generatePdf.isPending}
              >
                {generatePdf.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                PDF Receipt
              </Button>
              <Button className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white border-0" onClick={handleWhatsApp}>
                <Send className="mr-2 h-4 w-4" /> WhatsApp
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Card data-tutorial-target="invoice-form" className="bg-white/70 backdrop-blur-xl border-white/40 shadow-xl rounded-3xl overflow-hidden">
              <CardContent className="p-6 space-y-6">
                <form onSubmit={generateInvoice} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-slate-800 font-bold text-lg">Client</Label>
                    <div className="relative">
                      {formData.clientId && formData.clientId !== "new" ? (
                        <div className="h-14 bg-white border border-slate-300 rounded-xl text-lg font-medium shadow-sm text-slate-800 flex items-center px-4 justify-between">
                          <span>{clients.find(c => c.id === formData.clientId)?.name || formData.clientName}</span>
                          <button type="button" onClick={() => { handleClientSelect(""); setClientSearch(""); }} className="text-slate-400 hover:text-slate-600"><XIcon className="h-5 w-5" /></button>
                        </div>
                      ) : formData.clientId === "new" ? (
                        <div className="h-14 bg-white border border-slate-300 rounded-xl text-lg font-medium shadow-sm text-blue-600 flex items-center px-4 justify-between">
                          <span>+ Enter Manually</span>
                          <button type="button" onClick={() => { handleClientSelect(""); setClientSearch(""); }} className="text-slate-400 hover:text-slate-600"><XIcon className="h-5 w-5" /></button>
                        </div>
                      ) : (
                        <>
                          <Search className="absolute left-4 top-4 h-5 w-5 text-slate-400 z-10" />
                          <Input
                            value={clientSearch}
                            onChange={(e) => { setClientSearch(e.target.value); setClientDropdownOpen(true); }}
                            onFocus={() => setClientDropdownOpen(true)}
                            placeholder="Search clients..."
                            className="pl-11 h-14 bg-white border-slate-300 rounded-xl text-lg font-medium shadow-sm text-slate-800 placeholder:text-slate-400"
                          />
                          {clientDropdownOpen && (
                            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                              {clients
                                .filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone.includes(clientSearch))
                                .map((client) => (
                                  <button key={client.id} type="button" onClick={() => { handleClientSelect(client.id); setClientDropdownOpen(false); setClientSearch(""); }} className="w-full text-left px-4 py-3 text-base text-slate-800 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0">
                                    <span className="font-medium">{client.name}</span>
                                    {client.phone && <span className="text-sm text-slate-400 ml-2">{client.phone}</span>}
                                  </button>
                                ))
                              }
                              <button type="button" onClick={() => { handleClientSelect("new"); setClientDropdownOpen(false); setClientSearch(""); }} className="w-full text-left px-4 py-3 text-base font-semibold text-blue-600 hover:bg-blue-50 transition-colors">
                                + Enter Manually
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {formData.clientId === "new" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label className="text-slate-800 font-bold text-lg">Client Name</Label>
                        <Input name="clientName" placeholder="Ah Seng" className="h-14 bg-white border-slate-300 rounded-xl text-lg font-medium shadow-sm text-slate-800 placeholder:text-slate-400" value={formData.clientName} onChange={handleInputChange} required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-800 font-bold text-lg">Phone Number</Label>
                        <Input name="phone" type="tel" placeholder="e.g. 9123 4567" className="h-14 bg-white border-slate-300 rounded-xl text-lg font-medium shadow-sm text-slate-800 placeholder:text-slate-400" value={formData.phone} onChange={handleInputChange} required />
                      </div>
                    </motion.div>
                  )}

                  <div className="space-y-2 pt-2 border-t border-slate-200/60">
                    <Label className="text-slate-800 font-bold text-lg">Service Details</Label>
                    <div className="relative">
                      <Search className="absolute left-4 top-4 h-5 w-5 text-slate-400 z-10" />
                      <Input
                        value={serviceSearch || formData.serviceDescription}
                        onChange={(e) => {
                          setServiceSearch(e.target.value);
                          setFormData({ ...formData, serviceDescription: e.target.value });
                          setServiceDropdownOpen(true);
                        }}
                        onFocus={() => setServiceDropdownOpen(true)}
                        placeholder="e.g. Aircon Servicing (3 Units)"
                        className="pl-11 h-14 bg-white border-slate-300 rounded-xl text-lg font-medium shadow-sm text-slate-800 placeholder:text-slate-400"
                        required
                      />
                      {serviceDropdownOpen && (servicesQuery.data?.length ?? 0) > 0 && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                          {(servicesQuery.data ?? [])
                            .filter((s: { name: string; is_active?: boolean }) => s.is_active !== false && s.name.toLowerCase().includes((serviceSearch || "").toLowerCase()))
                            .map((svc: { id: string; name: string; price_cents: number }) => (
                              <button
                                key={svc.id}
                                type="button"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    serviceDescription: svc.name,
                                    amount: (svc.price_cents / 100).toFixed(2),
                                  });
                                  setServiceSearch("");
                                  setServiceDropdownOpen(false);
                                }}
                                className="w-full text-left px-4 py-3 text-base text-slate-800 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 flex justify-between items-center"
                              >
                                <span className="font-medium">{svc.name}</span>
                                <span className="text-sm text-slate-500 font-mono">${(svc.price_cents / 100).toFixed(2)}</span>
                              </button>
                            ))
                          }
                          <button
                            type="button"
                            onClick={() => setServiceDropdownOpen(false)}
                            className="w-full text-left px-4 py-3 text-base text-slate-500 hover:bg-slate-50 transition-colors"
                          >
                            Custom service (type above)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-800 font-bold text-lg">Total Cost (SGD)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-4 h-6 w-6 text-slate-400" />
                        <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" className="pl-12 h-14 bg-white border-slate-300 rounded-xl text-xl font-bold font-mono shadow-sm text-slate-800 placeholder:text-slate-300" value={formData.amount} onChange={handleInputChange} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-800 font-bold text-lg">Deposit Paid</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-4 h-6 w-6 text-slate-400" />
                        <Input id="depositPaid" name="depositPaid" type="number" step="0.01" placeholder="0.00" className="pl-12 h-14 bg-white border-slate-300 rounded-xl text-xl font-bold font-mono shadow-sm text-slate-800 placeholder:text-slate-300" value={formData.depositPaid} onChange={handleInputChange} />
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Escrow held by ServiceSync</p>
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold shadow-lg shadow-blue-500/30 mt-8 active:scale-[0.98] transition-all" disabled={!formData.clientId || !formData.amount || loading}>
                    {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (<>Generate Invoice <ChevronRight className="ml-2 h-6 w-6" /></>)}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Handshake Modal — now triggers real tRPC cash confirmation */}
      <DigitalHandshakeModal
        isOpen={showHandshake}
        onClose={() => setShowHandshake(false)}
        clientName={formData.clientName || "Client"}
        totalAmount={parseFloat(formData.amount || "0")}
        depositAmount={parseFloat(formData.depositPaid || "0")}
        onConfirm={handleCashConfirm}
      />
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 pt-4 pb-24">
          <div className="flex items-center gap-3">
            <SkeletonLine width="40px" className="h-10 rounded-full" />
            <SkeletonLine width="55%" className="h-7" />
          </div>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      }
    >
      <NewInvoice />
    </Suspense>
  );
}
