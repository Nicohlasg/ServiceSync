"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Phone, ChevronRight, User, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Client } from "@/lib/types";
import { motion } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ContactImportButton } from "@/components/clients/ContactImportButton";
import { SkeletonCard, SkeletonLine } from "@/components/ui/skeleton";

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { push } = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function loadClients() {
      setIsLoading(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setIsLoading(false); return; }

        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('provider_id', user.id)
          .order('name', { ascending: true });

        if (data) {
          const mappedClients: Client[] = data.map(c => {
            // Prefer the canonical `address` + `unit_number` columns (Phase 1).
            // Fall back to legacy `address_block/street/unit/postal` for old rows.
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
    <div className="space-y-6 pt-4 text-white px-1">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-1"
      >
        <h1 className="text-2xl font-black text-white tracking-tight leading-none">My Clients</h1>
        <div className="flex items-center gap-2">
          <ContactImportButton onImportComplete={() => setRefreshKey(k => k + 1)} />
          <Link href="/dashboard/clients/add" data-tutorial-target="add-client-btn">
            <Button size="icon" className="rounded-full h-11 w-11 shadow-xl shadow-blue-600/30 bg-blue-600 hover:bg-blue-700 active:scale-90 transition-transform">
              <Plus className="h-6 w-6" />
            </Button>
          </Link>
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
          filteredClients.map((client, index) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <Card
                variant="premium"
                className="active:scale-[0.98] transition-all cursor-pointer hover:border-blue-500/40 rounded-2xl group shadow-lg backdrop-blur-xl"
                onClick={() => push(`/dashboard/clients/details?id=${client.id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center text-blue-400 font-black text-xl shadow-inner border border-white/10 backdrop-blur-sm group-hover:scale-105 transition-transform group-hover:text-white group-hover:bg-blue-600/20 group-hover:border-blue-500/30">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="font-black text-white text-lg tracking-tight group-hover:text-blue-400 transition-colors truncate">{client.name}</h3>
                      <div className="flex items-center text-xs text-zinc-400 gap-2 font-bold uppercase tracking-wider mt-0.5">
                        <Phone className="h-3.5 w-3.5 text-blue-500" />
                        <span>{client.phone}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-zinc-700 group-hover:text-white transition-all group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </motion.div>
          ))
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
    </div>
  );
}
