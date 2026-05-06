"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Phone, ChevronRight, User, Trash2, CheckSquare, Square } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Client } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ContactImportButton } from "@/components/clients/ContactImportButton";
import { SkeletonCard, SkeletonLine } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { push } = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectMode = selectedIds.size > 0;
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justLongPressed = useRef(false);

  const bulkDelete = api.clients.bulkDelete.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.deleted} client${result.deleted !== 1 ? 's' : ''} deleted`);
      setSelectedIds(new Set());
      setRefreshKey(k => k + 1);
    },
    onError: (err) => toast.error(err.message || 'Bulk delete failed'),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  function startLongPress(id: string) {
    pressTimer.current = setTimeout(() => {
      justLongPressed.current = true;
      window.navigator?.vibrate?.(10);
      toggleSelect(id);
    }, 500);
  }

  function cancelLongPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  useEffect(() => {
    async function loadClients() {
      setIsLoading(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setIsLoading(false); return; }

        const { data } = await supabase
          .from('clients')
          .select('id, name, phone, address, unit_number, address_block, address_street, address_unit, address_postal, notes')
          .eq('provider_id', user.id)
          .eq('is_deleted', false)
          .order('name', { ascending: true });

        if (data) {
          const mappedClients: Client[] = data.map(c => {
            const canonical = [c.address, c.unit_number].filter(Boolean).join(', ');
            const legacy = [c.address_block, c.address_street, c.address_unit, c.address_postal].filter(Boolean).join(', ');
            const fullAddress = canonical || legacy || 'No Address provided';

            return {
              id: c.id,
              name: c.name,
              phone: c.phone || '',
              address: fullAddress,
              brand: 'General',
              notes: c.notes || ''
            };
          });
          setClients(mappedClients);
        }
      } catch (err) {
        console.error("Failed to load clients", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadClients();
  }, [refreshKey]);

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone.includes(searchTerm) ||
    client.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pt-4 text-white px-1 pb-32">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-1"
      >
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none">My Clients</h1>
          {!selectMode && (
            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest mt-1">Hold to select</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-3 py-1.5 rounded-xl bg-white/5 border border-white/10"
            >
              Cancel
            </button>
          ) : (
            <>
              <ContactImportButton onImportComplete={() => setRefreshKey(k => k + 1)} />
              <Link href="/dashboard/clients/add" data-tutorial-target="add-client-btn">
                <Button size="icon" className="rounded-full h-11 w-11 shadow-xl shadow-blue-600/30 bg-blue-600 hover:bg-blue-700 active:scale-90 transition-transform">
                  <Plus className="h-6 w-6" />
                </Button>
              </Link>
            </>
          )}
        </div>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative group px-1"
      >
        <div className="absolute inset-x-1 -inset-y-2 bg-blue-600/5 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-blue-400 transition-colors z-10" />
        <Input
          placeholder="Search name, phone, or address..."
          className="pl-12 h-14 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-blue-500/50 font-bold"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </motion.div>

      {/* Client List */}
      <div className="space-y-4 px-1">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} className="rounded-2xl h-[74px]">
              <div className="flex items-center gap-4 p-4">
                <div className="h-14 w-14 rounded-2xl bg-white/5 shrink-0" />
                <div className="space-y-2 flex-1">
                  <SkeletonLine width="45%" className="h-4" />
                  <SkeletonLine width="30%" className="h-3" />
                </div>
              </div>
            </SkeletonCard>
          ))
        ) : filteredClients.length > 0 ? (
          filteredClients.map((client, index) => {
            const isSelected = selectedIds.has(client.id);
            return (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                <Card
                  variant="premium"
                  className={`transition-all cursor-pointer rounded-2xl group shadow-lg backdrop-blur-xl border ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-600/10'
                      : 'border-white/10 hover:border-blue-500/40 active:scale-[0.98]'
                  }`}
                  onClick={() => {
                    if (justLongPressed.current) { justLongPressed.current = false; return; }
                    if (selectMode) { toggleSelect(client.id); } else { push(`/dashboard/clients/details?id=${client.id}`); }
                  }}
                  onPointerDown={() => startLongPress(client.id)}
                  onPointerUp={cancelLongPress}
                  onPointerLeave={cancelLongPress}
                  onPointerCancel={cancelLongPress}
                >
                  <CardContent className="p-4 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                      <div className={`h-14 w-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner border backdrop-blur-sm transition-all ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500/30 text-blue-400'
                          : 'bg-white/5 border-white/10 text-blue-400 group-hover:scale-105 group-hover:text-white group-hover:bg-blue-600/20 group-hover:border-blue-500/30'
                      }`}>
                        {selectMode ? (
                          isSelected ? <CheckSquare className="h-6 w-6" /> : <Square className="h-6 w-6 text-zinc-600" />
                        ) : (
                          client.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="font-black text-white text-lg tracking-tight group-hover:text-blue-400 transition-colors truncate">{client.name}</h3>
                        <div className="flex items-center text-xs text-zinc-400 gap-2 font-bold uppercase tracking-wider mt-0.5">
                          <Phone className="h-3.5 w-3.5 text-blue-500" />
                          <span>{client.phone || 'No phone'}</span>
                        </div>
                      </div>
                    </div>
                    {!selectMode && <ChevronRight className="h-5 w-5 text-zinc-700 group-hover:text-white transition-all group-hover:translate-x-0.5" />}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20 text-zinc-500 bg-white/5 rounded-[2rem] border border-white/5 border-dashed backdrop-blur-md"
          >
            <div className="bg-white/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
              <User className="h-10 w-10 text-zinc-700" />
            </div>
            <p className="text-xl font-black text-white tracking-tight uppercase">No clients found</p>
            <p className="text-sm text-zinc-500 font-bold mt-1 uppercase tracking-wider">Try a different search or add a new one.</p>
          </motion.div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-28 left-4 right-4 z-50 max-w-md mx-auto"
          >
            <div className="bg-zinc-900/95 border border-white/15 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-5 space-y-4 backdrop-blur-3xl">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm font-black text-white uppercase tracking-widest">
                  <span className="text-blue-400">{selectedIds.size}</span> selected
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-[0.2em] transition-colors"
                >
                  Deselect
                </button>
              </div>
              <Button
                size="lg"
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest text-[10px] h-12 rounded-xl shadow-lg shadow-rose-600/20"
                disabled={bulkDelete.isPending}
                onClick={() => bulkDelete.mutate({ clientIds: Array.from(selectedIds) })}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete {selectedIds.size} Client{selectedIds.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
