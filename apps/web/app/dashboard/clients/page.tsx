"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Phone, ChevronRight, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Client } from "@/lib/types";
import { motion } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { push } = useRouter();
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    async function loadClients() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('provider_id', user.id)
          .order('name', { ascending: true });

        if (data) {
          const mappedClients: Client[] = data.map(c => {
            const addressArgs = [c.address_block, c.address_street, c.address_unit, c.address_postal].filter(Boolean);
            const fullAddress = addressArgs.length > 0 ? addressArgs.join(', ') : 'No Address provided';

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
      }
    }
    loadClients();
  }, []);

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone.includes(searchTerm) ||
    client.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pt-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <h1 className="text-2xl font-bold text-white drop-shadow-md">My Clients</h1>
        <Link href="/dashboard/clients/add">
          <Button size="icon" className="rounded-full h-12 w-12 shadow-lg shadow-blue-500/30">
            <Plus className="h-6 w-6" />
          </Button>
        </Link>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative group"
      >
        <div className="absolute inset-0 bg-blue-100/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-300 z-10" />
        <Input
          placeholder="Search name, phone, or address..."
          className="pl-12 rounded-2xl"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </motion.div>

      {/* Client List */}
      <div className="space-y-3">
        {filteredClients.length > 0 ? (
          filteredClients.map((client, index) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <Card
                className="active:scale-[0.98] transition-all cursor-pointer hover:bg-white/[0.07] rounded-2xl group"
                onClick={() => push(`/dashboard/clients/details?id=${client.id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center text-blue-300 font-bold text-xl shadow-inner border border-white/10 backdrop-blur-sm">
                      {client.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">{client.name}</h3>
                      <div className="flex items-center text-sm text-slate-300 gap-2 font-medium">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{client.phone}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-white/50 group-hover:text-white transition-colors" />
                </CardContent>
              </Card>
            </motion.div>
          ))
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 text-slate-400 glass-card glass-inner-light rounded-3xl"
          >
            <User className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="font-medium text-lg text-slate-200">No clients found.</p>
            <p className="text-sm opacity-70">Try a different search or add a new one.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
