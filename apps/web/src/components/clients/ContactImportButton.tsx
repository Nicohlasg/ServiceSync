"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Users, Loader2, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

interface ImportedContact {
  name: string;
  phone: string;
}

/**
 * Normalise SG phone numbers:
 *  "91234567" → "+6591234567"
 *  "+6591234567" → "+6591234567"
 *  "6591234567" → "+6591234567"
 */
function normaliseSgPhone(raw: string): string {
  const digits = raw.replace(/[\s\-()]/g, "");
  if (/^\+65[89]\d{7}$/.test(digits)) return digits;
  if (/^65[89]\d{7}$/.test(digits)) return `+${digits}`;
  if (/^[89]\d{7}$/.test(digits)) return `+65${digits}`;
  return digits;
}

/** Parse a vCard (.vcf) file into contact entries */
function parseVCard(text: string): ImportedContact[] {
  const contacts: ImportedContact[] = [];
  const cards = text.split("BEGIN:VCARD");

  for (const card of cards) {
    if (!card.trim()) continue;

    let name = "";
    let phone = "";

    const lines = card.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith("FN:") || line.startsWith("FN;")) {
        name = line.split(":").slice(1).join(":").trim();
      }
      if ((line.startsWith("TEL:") || line.startsWith("TEL;")) && !phone) {
        phone = line.split(":").slice(1).join(":").trim();
      }
    }

    if (name && phone) {
      contacts.push({ name, phone: normaliseSgPhone(phone) });
    }
  }

  return contacts;
}

interface ContactImportButtonProps {
  onImportComplete?: () => void;
}

export function ContactImportButton({ onImportComplete }: ContactImportButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [contacts, setContacts] = useState<ImportedContact[]>([]);
  const [source, setSource] = useState<"picker" | "file" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkCreate = api.clients.bulkCreate.useMutation({
    onSuccess: (result) => {
      toast.success(`Imported ${result.created} client${result.created !== 1 ? "s" : ""}${result.skipped > 0 ? ` (${result.skipped} duplicates skipped)` : ""}`);
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
      toast.error("Phone contact import is not supported on this device. Please use the .vcf file option instead.");
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseVCard(text);

      if (parsed.length === 0) {
        toast.error("No valid contacts found in the .vcf file.");
        return;
      }

      setContacts(parsed);
      setSource("file");
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const handleConfirmImport = () => {
    if (contacts.length === 0) return;
    setImporting(true);
    bulkCreate.mutate({
      contacts: contacts.slice(0, 100).map((c) => ({
        name: c.name,
        phone: c.phone,
      })),
    });
  };

  const removeContact = (index: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      <Button
        size="icon"
        variant="outline"
        className="rounded-full h-12 w-12 border-white/10 text-slate-300 hover:text-white hover:bg-slate-800"
        onClick={() => setModalOpen(true)}
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
              onClick={() => { setModalOpen(false); setContacts([]); setSource(null); }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
            />
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed inset-x-4 bottom-4 top-auto z-[100] max-h-[80vh] bg-slate-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
                <h2 className="text-lg font-bold text-white">Import Contacts</h2>
                <button onClick={() => { setModalOpen(false); setContacts([]); setSource(null); }} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {contacts.length === 0 ? (
                  <div className="space-y-3">
                    <Button
                      onClick={handleContactPicker}
                      className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl flex items-center justify-center gap-3 text-base font-bold"
                    >
                      <Users className="h-5 w-5" />
                      From Phone Contacts
                    </Button>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      className="w-full h-16 border-white/10 text-slate-300 hover:text-white rounded-2xl flex items-center justify-center gap-3 text-base font-bold"
                    >
                      <FileText className="h-5 w-5" />
                      From File (.vcf)
                    </Button>
                    <p className="text-xs text-slate-500 text-center">
                      Phone contact import works on Android Chrome. On other devices, export contacts as a .vcf file first.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-400">
                      {contacts.length} contact{contacts.length !== 1 ? "s" : ""} found via {source === "picker" ? "Phone Contacts" : ".vcf file"}
                    </p>

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {contacts.map((c, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-800/60 rounded-xl px-4 py-3 border border-white/5">
                          <div>
                            <p className="text-sm font-medium text-white">{c.name}</p>
                            <p className="text-xs text-slate-400">{c.phone}</p>
                          </div>
                          <button onClick={() => removeContact(i)} className="text-slate-500 hover:text-red-400">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="bg-blue-950/40 border border-blue-500/20 rounded-xl p-3">
                      <p className="text-xs text-slate-300 leading-relaxed">
                        By importing, you confirm you have obtained necessary consent to store these contacts&apos; data in ServiceSync per Singapore&apos;s PDPA.
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
                    disabled={importing || contacts.length === 0}
                    className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-base"
                  >
                    {importing ? (
                      <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Importing...</>
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
