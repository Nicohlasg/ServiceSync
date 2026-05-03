"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Save, Loader2, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";
import { useFormDraft } from "@/lib/useFormDraft";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";

export default function AddClientPage() {
  const [loading, setLoading] = useState(false);
  const [pdpaChecked, setPdpaChecked] = useState(false);
  const { push } = useRouter();

  // Task 1.5: Check if user has already given PDPA consent
  const profileQuery = api.provider.getProfile.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const hasPdpaConsent = !!profileQuery.data?.pdpa_consent_at;
  const acceptPdpaMutation = api.provider.acceptPdpa.useMutation();

  const [formData, setFormData, clearClientDraft] = useFormDraft('draft-client-add', {
    name: "",
    phone: "",
    block: "",
    street: "",
    unit: "",
    postal: "",
    brand: "",
    notes: "",
    fullAddress: "",
    lat: null as number | null,
    lng: null as number | null,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  // SEC-H6: Use tRPC mutation instead of direct Supabase insert
  const createClientMutation = api.clients.create.useMutation({
    onSuccess: () => {
      clearClientDraft();
      toast.success("Client added successfully");
      push("/dashboard/clients");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to add client");
    },
    onSettled: () => setLoading(false),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const phoneParsed = formData.phone.replace(/\D/g, '');
    if (!/^[89]\d{7}$/.test(phoneParsed)) {
      toast.error("Please enter a valid 8-digit Singapore mobile number starting with 8 or 9");
      setLoading(false);
      return;
    }

    // Combine address fields into a single string for the tRPC schema
    const address = [formData.block, formData.street]
      .filter(Boolean).join(' ').trim();

    // Task 1.5: Record PDPA consent on first client creation if not already done
    if (!hasPdpaConsent && pdpaChecked) {
      try { await acceptPdpaMutation.mutateAsync(); } catch { /* non-blocking */ }
    }

    createClientMutation.mutate({
      name: formData.name,
      phone: formData.phone,
      address: formData.fullAddress || address || formData.street,
      unitNumber: formData.unit || undefined,
      postalCode: formData.postal || undefined,
      lat: formData.lat ?? undefined,
      lng: formData.lng ?? undefined,
      brand: formData.brand || undefined,
      notes: formData.notes || undefined,
    });
  };

  return (
    <div className="space-y-6 pt-4 pb-24">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3"
      >
        <BackButton href="/dashboard/clients" />
        <h1 className="text-2xl font-bold text-white">Add New Client</h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card data-tutorial-target="client-form" className="bg-slate-900/65 backdrop-blur-xl border-white/15 shadow-2xl rounded-3xl overflow-hidden">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300 font-semibold">Client Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Mrs. Lee"
                  required
                  className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500/50 transition-all h-12 rounded-xl"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-300 font-semibold">Mobile Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="e.g. 9123 4567"
                  required
                  className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500/50 transition-all h-12 rounded-xl"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300 font-semibold flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Address</Label>
                <AddressAutocomplete
                  value={formData.fullAddress}
                  onChange={(addr, lat, lng) => setFormData({ ...formData, fullAddress: addr, lat, lng })}
                  placeholder="Search address..."
                  className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 h-12 rounded-xl"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input id="block" placeholder="Block (optional)" className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 h-11 rounded-xl" value={formData.block} onChange={handleChange} />
                  <Input id="street" placeholder="Street Name" className="col-span-1 bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 h-11 rounded-xl" value={formData.street} onChange={handleChange} />
                  <Input id="unit" placeholder="Unit # e.g. #01-345" className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 h-11 rounded-xl" value={formData.unit} onChange={handleChange} />
                  <Input id="postal" placeholder="Postal Code" className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 h-11 rounded-xl" value={formData.postal} onChange={handleChange} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand" className="text-slate-300 font-semibold">Aircon Brand (Optional)</Label>
                <Input
                  id="brand"
                  placeholder="e.g. Mitsubishi, Daikin"
                  className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500/50 transition-all h-12 rounded-xl"
                  value={formData.brand}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-slate-300 font-semibold">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="e.g. Gate code, pets, preferences..."
                  className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500/50 transition-all min-h-[100px] rounded-xl resize-none"
                  value={formData.notes}
                  onChange={handleChange}
                />
              </div>

              {/* Task 1.5: PDPA consent gate — shown only on first client creation */}
              {!hasPdpaConsent && !profileQuery.isLoading && (
                <div className="flex items-start gap-3 p-4 bg-blue-950/40 border border-blue-500/20 rounded-xl">
                  <input
                    type="checkbox"
                    id="pdpa-consent"
                    checked={pdpaChecked}
                    onChange={(e) => setPdpaChecked(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-800 accent-blue-500"
                  />
                  <label htmlFor="pdpa-consent" className="text-sm text-slate-300 leading-relaxed">
                    I acknowledge that I will collect and store client personal data (name, phone, address) in accordance with Singapore&apos;s{' '}
                    <a href="https://www.pdpc.gov.sg/overview-of-pdpa/the-legislation/personal-data-protection-act" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
                      Personal Data Protection Act (PDPA)
                    </a>
                    . I will only use this data for service delivery and communication purposes.
                  </label>
                </div>
              )}

              <div className="pt-4">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 text-lg font-semibold hover:shadow-blue-500/40 transition-all active:scale-[0.98]"
                  disabled={loading || (!hasPdpaConsent && !pdpaChecked)}
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="mr-2 h-5 w-5" /> Save Client</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
