"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Users, Loader2, X, FileText, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { searchOneMap } from "@/lib/onemap";

interface ImportedContact {
  name: string;
  phone: string;
  rawStreet?: string;
  rawPostal?: string;
  rawUnit?: string;
  rawNotes?: string;
  resolvedAddress?: string;
  resolvedPostal?: string;
  resolvedLat?: number;
  resolvedLng?: number;
  geocoded?: boolean;
}

function normaliseSgPhone(raw: string): string {
  const digits = raw.replace(/[\s\-()]/g, "");
  if (/^\+65[89]\d{7}$/.test(digits)) return digits;
  if (/^65[89]\d{7}$/.test(digits)) return `+${digits}`;
  if (/^[89]\d{7}$/.test(digits)) return `+65${digits}`;
  return digits;
}

function parseAdrField(line: string): { street: string; postal: string; unit: string } | null {
  // Skip quoted-printable encoded lines — can't reliably decode without a QP decoder
  if (line.toUpperCase().includes("ENCODING=QUOTED-PRINTABLE")) return null;

  const colonIdx = line.indexOf(":");
  if (colonIdx < 0) return null;
  const value = line.slice(colonIdx + 1).trim();
  const parts = value.split(";");

  // vCard ADR fields: [0]=PO Box, [1]=Extended Addr, [2]=Street, [3]=City, [4]=Region, [5]=Postal, [6]=Country
  const extended = (parts[1] ?? "").trim();
  const street = (parts[2] ?? "").trim();
  const postal = (parts[5] ?? "").trim();

  if (!street && !postal) return null;

  // Extract unit number (#XX-XX pattern) from extended addr or embedded in street
  const combined = `${extended} ${street}`;
  const unitMatch = combined.match(/#[\w]+-[\w]+/);
  const unit = unitMatch ? unitMatch[0] : extended.startsWith("#") ? extended : "";

  return { street, postal, unit };
}

function parseVCard(text: string): ImportedContact[] {
  const contacts: ImportedContact[] = [];
  const cards = text.split("BEGIN:VCARD");

  for (const card of cards) {
    if (!card.trim()) continue;

    let name = "";
    let phone = "";
    let rawStreet = "";
    let rawPostal = "";
    let rawUnit = "";
    let rawNotes = "";

    const lines = card.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith("FN:") || line.startsWith("FN;")) {
        name = line.split(":").slice(1).join(":").trim();
      }
      if ((line.startsWith("TEL:") || line.startsWith("TEL;")) && !phone) {
        phone = line.split(":").slice(1).join(":").trim();
      }
      if ((line.startsWith("ADR:") || line.startsWith("ADR;")) && !rawStreet && !rawPostal) {
        const parsed = parseAdrField(line);
        if (parsed) {
          rawStreet = parsed.street;
          rawPostal = parsed.postal;
          rawUnit = parsed.unit;
        }
      }
      if ((line.startsWith("NOTE:") || line.startsWith("NOTE;")) && !rawNotes) {
        rawNotes = line.split(":").slice(1).join(":").trim();
      }
    }

    if (name && phone) {
      contacts.push({
        name,
        phone: normaliseSgPhone(phone),
        rawStreet: rawStreet || undefined,
        rawPostal: rawPostal || undefined,
        rawUnit: rawUnit || undefined,
        rawNotes: rawNotes || undefined,
      });
    }
  }

  return contacts;
}

async function geocodeContacts(contacts: ImportedContact[]): Promise<ImportedContact[]> {
  const results = [...contacts];
  const toGeocode = results.filter(
    (c) => c.rawPostal && /^\d{6}$/.test(c.rawPostal)
  );

  for (let i = 0; i < toGeocode.length; i += 5) {
    const batch = toGeocode.slice(i, i + 5);
    await Promise.all(
      batch.map(async (contact) => {
        try {
          const hits = await searchOneMap(contact.rawPostal!);
          if (hits.length > 0) {
            const hit = hits[0];
            const idx = results.indexOf(contact);
            results[idx] = {
              ...contact,
              resolvedAddress: hit.address,
              resolvedPostal: hit.postalCode,
              resolvedLat: hit.lat,
              resolvedLng: hit.lng,
              geocoded: true,
            };
          }
        } catch {
          // Geocoding failure is non-fatal — raw address used instead
        }
      })
    );
    if (i + 5 < toGeocode.length) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  return results;
}

const IOS_GUIDE = [
  {
    step: 1,
    emoji: "📱",
    title: "Open Contacts app",
    desc: 'Open the Apple Contacts app (grey icon) — not the Phone app',
  },
  {
    step: 2,
    emoji: "✋",
    title: "Long press a group",
    desc: 'Press and hold "All iCloud" (or any group) — don\'t tap into it — until a menu appears',
  },
  {
    step: 3,
    emoji: "📤",
    title: "Tap Export",
    desc: "Select which details to include (Name, Phone, Address), tap ✓, then tap Export",
  },
  {
    step: 4,
    emoji: "💾",
    title: "Save to Files",
    desc: 'Tap "Save to Files" at the bottom → pick any folder (e.g. Downloads) → Save',
  },
  {
    step: 5,
    emoji: "📂",
    title: "Back here",
    desc: 'Return to this screen and tap "From File (.vcf)" — then find your saved file',
  },
];

interface ContactImportButtonProps {
  onImportComplete?: () => void;
}

export function ContactImportButton({ onImportComplete }: ContactImportButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [contacts, setContacts] = useState<ImportedContact[]>([]);
  const [source, setSource] = useState<"picker" | "file" | null>(null);
  const [showGuide, setShowGuide] = useState(() => {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod/.test(navigator.userAgent);
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkCreate = api.clients.bulkCreate.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Imported ${result.created} client${result.created !== 1 ? "s" : ""}${result.skipped > 0 ? ` (${result.skipped} duplicates skipped)` : ""}`
      );
      setModalOpen(false);
      setContacts([]);
      setSource(null);
      onImportComplete?.();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to import contacts");
    },
    onSettled: () => setImporting(false),
  });

  const supportsContactPicker =
    typeof window !== "undefined" &&
    "contacts" in navigator &&
    "ContactsManager" in window;

  const handleContactPicker = async () => {
    if (!supportsContactPicker) {
      toast.error(
        "Phone contact import is not supported on this device. Please use the .vcf file option instead."
      );
      return;
    }
    try {
      // @ts-expect-error — Contact Picker API not in all TS libs
      const picked = await navigator.contacts.select(["name", "tel"], { multiple: true });
      const mapped: ImportedContact[] = picked
        .filter((c: { name?: string[]; tel?: string[] }) => c.name?.[0] && c.tel?.[0])
        .map((c: { name: string[]; tel: string[] }) => ({
          name: c.name[0],
          phone: normaliseSgPhone(c.tel[0]),
        }));

      if (mapped.length === 0) {
        toast.error("No contacts with name and phone selected.");
        return;
      }

      setContacts(mapped);
      setSource("picker");
    } catch {
      toast.error("Contact selection was cancelled or failed.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const text = await file.text();
    const parsed = parseVCard(text);

    if (parsed.length === 0) {
      toast.error("No valid contacts found in the .vcf file.");
      return;
    }

    setSource("file");

    // Geocode contacts that have a 6-digit postal code
    const hasPostals = parsed.some((c) => c.rawPostal && /^\d{6}$/.test(c.rawPostal));
    if (hasPostals) {
      setIsGeocoding(true);
      setContacts(parsed); // show parsed list immediately
      const geocoded = await geocodeContacts(parsed);
      setContacts(geocoded);
      setIsGeocoding(false);
    } else {
      setContacts(parsed);
    }
  };

  const handleConfirmImport = () => {
    if (contacts.length === 0) return;
    setImporting(true);
    bulkCreate.mutate({
      contacts: contacts.slice(0, 100).map((c) => ({
        name: c.name,
        phone: c.phone,
        address: c.resolvedAddress || c.rawStreet || undefined,
        unitNumber: c.rawUnit || undefined,
        postalCode: c.resolvedPostal || c.rawPostal || undefined,
        lat: c.resolvedLat,
        lng: c.resolvedLng,
        notes: c.rawNotes,
      })),
    });
  };

  const removeContact = (index: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  };

  const closeModal = () => {
    setModalOpen(false);
    setContacts([]);
    setSource(null);
  };

  const addressedCount = contacts.filter((c) => c.geocoded || c.rawStreet).length;

  return (
    <>
      <Button
        size="icon"
        className="rounded-full h-11 w-11 bg-white/5 border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white shadow-lg active:scale-90 transition-transform"
        onClick={() => setModalOpen(true)}
        aria-label="Import contacts"
      >
        <Upload className="h-5 w-5" />
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".vcf,.vcard"
        className="hidden"
        onChange={handleFileUpload}
      />

      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
            />
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed inset-x-4 bottom-4 top-auto z-[100] max-h-[90vh] bg-[#0f1117] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
                <h2 className="text-lg font-black text-white">Import Contacts</h2>
                <button onClick={closeModal} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {contacts.length === 0 ? (
                  <div className="space-y-4">
                    {/* Action buttons */}
                    <div className="space-y-3">
                      <Button
                        onClick={handleContactPicker}
                        className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl flex items-center justify-center gap-3 text-base font-black"
                      >
                        <Users className="h-5 w-5" />
                        From Phone Contacts
                      </Button>
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        className="w-full h-16 bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-2xl flex items-center justify-center gap-3 text-base font-black"
                      >
                        <FileText className="h-5 w-5" />
                        From File (.vcf)
                      </Button>
                      <p className="text-[11px] text-zinc-500 text-center font-bold uppercase tracking-widest">
                        Phone import works on Android · iPhone users: use the .vcf method
                      </p>
                    </div>

                    {/* iOS Guide */}
                    <div className="rounded-2xl border border-white/10 overflow-hidden">
                      <button
                        onClick={() => setShowGuide((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <span className="text-sm font-black text-white flex items-center gap-2">
                          <span className="text-base">🍎</span>
                          How to export .vcf on iPhone
                        </span>
                        {showGuide ? (
                          <ChevronUp className="h-4 w-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-zinc-400" />
                        )}
                      </button>

                      <AnimatePresence>
                        {showGuide && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 space-y-3 bg-white/[0.02]">
                              {IOS_GUIDE.map((s) => (
                                <div key={s.step} className="flex gap-3 items-start">
                                  <div className="shrink-0 h-8 w-8 rounded-xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center">
                                    <span className="text-base leading-none">{s.emoji}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-white leading-tight">
                                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mr-2">
                                        {s.step}
                                      </span>
                                      {s.title}
                                    </p>
                                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{s.desc}</p>
                                  </div>
                                </div>
                              ))}

                              <div className="mt-1 rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-3 py-2">
                                <p className="text-[11px] text-indigo-300 font-bold leading-relaxed">
                                  <span className="font-black">Tip:</span> If your contacts have a home address saved, it will be automatically filled in when you import — no typing needed.
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Geocoding indicator */}
                    {isGeocoding && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
                        <p className="text-xs font-black text-blue-300 uppercase tracking-widest">
                          Resolving addresses...
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-zinc-400 font-bold">
                        {contacts.length} contact{contacts.length !== 1 ? "s" : ""} found
                        {source === "file" ? " via .vcf" : " via Phone Contacts"}
                      </p>
                      {addressedCount > 0 && !isGeocoding && (
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {addressedCount} with address
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {contacts.map((c, i) => (
                        <div
                          key={i}
                          className="flex items-start justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/5"
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="text-sm font-black text-white truncate">{c.name}</p>
                            <p className="text-xs text-zinc-400 font-bold">{c.phone}</p>
                            {c.geocoded && c.resolvedAddress && (
                              <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5 font-bold truncate">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {c.resolvedAddress}
                                {c.rawUnit ? ` ${c.rawUnit}` : ""}
                              </p>
                            )}
                            {!c.geocoded && c.rawStreet && (
                              <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5 truncate">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {c.rawStreet}
                                {c.rawPostal ? ` S(${c.rawPostal})` : ""}
                              </p>
                            )}
                            {c.rawNotes && (
                              <p className="text-[11px] text-zinc-600 mt-0.5 truncate italic">{c.rawNotes}</p>
                            )}
                          </div>
                          <button
                            onClick={() => removeContact(i)}
                            className="text-zinc-600 hover:text-red-400 shrink-0 mt-0.5"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl bg-blue-950/40 border border-blue-500/20 p-3">
                      <p className="text-xs text-slate-300 leading-relaxed">
                        By importing, you confirm you have obtained consent to store these contacts&apos; data per Singapore&apos;s PDPA.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              {contacts.length > 0 && (
                <div className="p-5 border-t border-white/10 shrink-0">
                  <Button
                    onClick={handleConfirmImport}
                    disabled={importing || isGeocoding || contacts.length === 0}
                    className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-base uppercase tracking-wider"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Importing...
                      </>
                    ) : isGeocoding ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Resolving addresses...
                      </>
                    ) : (
                      `Import ${contacts.length} Contact${contacts.length !== 1 ? "s" : ""}`
                    )}
                  </Button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
