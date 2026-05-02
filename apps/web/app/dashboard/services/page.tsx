"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Pencil, X, Briefcase, DollarSign, Clock } from "lucide-react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function ServicesPage() {
    const utils = api.useUtils();
    
    // Query existing services
    const { data: services, isLoading } = api.provider.getServices.useQuery();
    
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Detect ?action=new from onboarding checklist link
    const searchParams = useSearchParams();
    const pulseRequested = searchParams.get('action') === 'new';
    const [pulseDismissed, setPulseDismissed] = useState(false);
    const showPulse = pulseRequested && !pulseDismissed;

    useEffect(() => {
        if (!showPulse) return;

        const timer = window.setTimeout(() => setPulseDismissed(true), 8000);
        return () => window.clearTimeout(timer);
    }, [showPulse]);
    
    const [form, setForm] = useState({
        name: "",
        description: "",
        durationMinutes: 60,
        priceSGD: 0,
    });
    type Service = NonNullable<typeof services>[number];
    
    const addMutation = api.provider.addService.useMutation({
        onSuccess: () => {
            toast.success("Service added!");
            setIsCreating(false);
            utils.provider.getServices.invalidate();
        },
        onError: (e) => toast.error(e.message || "Failed to add service"),
    });

    const updateMutation = api.provider.updateService.useMutation({
        onSuccess: () => {
            toast.success("Service updated!");
            setEditingId(null);
            utils.provider.getServices.invalidate();
        },
        onError: (e) => toast.error(e.message || "Failed to update service"),
    });

    const handleSaveNew = () => {
        if (!form.name.trim()) return toast.error("Service name is required");
        if (form.priceSGD < 0) return toast.error("Price cannot be negative");
        
        addMutation.mutate({
            name: form.name.trim(),
            description: form.description.trim(),
            durationMinutes: form.durationMinutes,
            priceCents: Math.round(form.priceSGD * 100),
            sortOrder: (services?.length || 0) + 1,
        });
    };

    const handleSaveUpdate = (id: string, currentlyActive: boolean) => {
        if (!form.name.trim()) return toast.error("Service name is required");
        updateMutation.mutate({
            serviceId: id,
            name: form.name.trim(),
            description: form.description.trim(),
            durationMinutes: form.durationMinutes,
            priceCents: Math.round(form.priceSGD * 100),
            isActive: currentlyActive,
        });
    };

    const toggleActive = (id: string, active: boolean) => {
        updateMutation.mutate({
            serviceId: id,
            isActive: !active
        });
    }

    const startEditing = (service: Service) => {
        setForm({
            name: service.name,
            description: service.description || "",
            durationMinutes: service.duration_minutes,
            priceSGD: service.price_cents / 100,
        });
        setEditingId(service.id);
        setIsCreating(false);
    };

    const startCreating = () => {
        setForm({ name: "", description: "", durationMinutes: 60, priceSGD: 0 });
        setIsCreating(true);
        setEditingId(null);
    };

    return (
        <div className="space-y-6 pt-4 pb-24 text-white">
            <div className="px-2">
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <Briefcase className="h-8 w-8 text-blue-400" /> Services
                </h1>
                <p className="text-zinc-400 mt-1 text-sm font-bold uppercase tracking-wider">Manage your service offerings and prices.</p>
            </div>

            {!isCreating && (
                <div className="px-1">
                    <Button
                        data-tutorial-target="add-service-btn"
                        onClick={() => { setPulseDismissed(true); startCreating(); }}
                        className={`w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xl shadow-blue-600/30 border border-blue-500/30 font-black text-lg relative overflow-hidden active:scale-95 transition-all ${
                            showPulse ? 'animate-service-pulse ring-2 ring-blue-400/60' : ''
                        }`}
                    >
                        {showPulse && (
                            <span className="absolute inset-0 rounded-2xl animate-ping-slow bg-white/20 pointer-events-none" />
                        )}
                        <Plus className="h-6 w-6 mr-2 stroke-[3px]" /> Add New Service
                    </Button>
                </div>
            )}

            <AnimatePresence>
                {isCreating && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    >
                        <Card data-tutorial-target="service-form" variant="premium" className="rounded-3xl border-white/10 shadow-2xl backdrop-blur-2xl">
                            <CardContent className="p-6 space-y-5">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest relative z-10">New Service</h3>
                                    <button onClick={() => setIsCreating(false)} className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors relative z-10">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="space-y-4 relative z-10">
                                    <div className="space-y-1.5">
                                        <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Service Name</Label>
                                        <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:border-blue-500/50 backdrop-blur-md font-bold" placeholder="e.g. Change Aircon Filter" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Description</Label>
                                        <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="bg-white/5 border-white/10 text-white resize-none rounded-xl focus:border-blue-500/50 backdrop-blur-md font-medium" rows={2} placeholder="What does this service include?" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-1"><DollarSign className="h-3 w-3" /> Price (SGD)</Label>
                                            <Input type="number" min="0" step="1" value={form.priceSGD} onChange={e => setForm({...form, priceSGD: parseFloat(e.target.value) || 0})} className="bg-white/5 border-white/10 text-white text-xl font-black h-14 rounded-xl focus:border-blue-500/50 backdrop-blur-md" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Duration (min)</Label>
                                            <Input type="number" min="15" step="15" value={form.durationMinutes} onChange={e => setForm({...form, durationMinutes: parseInt(e.target.value, 10) || 0})} className="bg-white/5 border-white/10 text-white text-xl font-black h-14 rounded-xl focus:border-blue-500/50 backdrop-blur-md" />
                                        </div>
                                    </div>
                                    <Button onClick={handleSaveNew} disabled={addMutation.isPending} className="w-full mt-4 h-14 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
                                        {addMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <><Plus className="h-5 w-5 mr-2 stroke-[3px]" /> CREATE SERVICE</>}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-5 px-1">
                {isLoading ? (
                    <>
                        <SkeletonCard />
                        <SkeletonCard />
                    </>
                ) : services?.length === 0 ? (
                    <div className="text-center py-20 bg-white/5 rounded-[2rem] border border-white/5 border-dashed backdrop-blur-md mx-1">
                        <Briefcase className="h-10 w-10 text-zinc-700 mx-auto mb-4" />
                        <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">You have no services configured.</p>
                    </div>
                ) : (
                    services?.map((service, idx) => (
                        <motion.div
                            key={service.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <Card variant="premium" className={`rounded-3xl transition-all backdrop-blur-xl ${!service.is_active ? 'opacity-40 grayscale blur-[1px]' : 'shadow-xl'}`}>
                                <CardContent className="p-6">
                                    {editingId === service.id ? (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest relative z-10">Edit Service</h3>
                                                <button onClick={() => setEditingId(null)} className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors relative z-10">
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <div className="space-y-4 relative z-10">
                                                <div className="space-y-1.5">
                                                    <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Name</Label>
                                                    <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:border-blue-500/50 font-bold" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Description</Label>
                                                    <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="bg-white/5 border-white/10 text-white resize-none rounded-xl focus:border-blue-500/50 font-medium" rows={2} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Price (SGD)</Label>
                                                        <Input type="number" min="0" step="1" value={form.priceSGD} onChange={e => setForm({...form, priceSGD: parseFloat(e.target.value) || 0})} className="bg-white/5 border-white/10 text-white text-xl font-black h-14 rounded-xl" />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Duration (min)</Label>
                                                        <Input type="number" min="15" step="15" value={form.durationMinutes} onChange={e => setForm({...form, durationMinutes: parseInt(e.target.value, 10) || 0})} className="bg-white/5 border-white/10 text-white text-xl font-black h-14 rounded-xl" />
                                                    </div>
                                                </div>
                                                <Button onClick={() => handleSaveUpdate(service.id, !!service.is_active)} disabled={updateMutation.isPending} className="w-full mt-4 h-14 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-xl shadow-blue-600/20">
                                                    {updateMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "SAVE CHANGES"}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-5 relative z-10">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="min-w-0">
                                                    <h3 className="font-black text-2xl text-white tracking-tight leading-tight group-hover:text-blue-400 transition-colors truncate">{service.name}</h3>
                                                    {service.description && (
                                                        <p className="text-sm text-zinc-400 font-medium line-clamp-2 leading-snug mt-1.5">{service.description}</p>
                                                    )}
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => startEditing(service)} className="h-10 w-10 p-0 text-zinc-500 hover:text-white shrink-0 bg-white/5 rounded-xl border border-white/10 shadow-sm active:scale-90 transition-transform">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 bg-white/5 px-4 py-2.5 rounded-xl border border-white/10 shadow-inner">
                                                    <DollarSign className="h-4 w-4 text-emerald-400" />
                                                    <span className="font-black text-white text-xl tracking-tighter tabular-nums leading-none">{service.price_cents / 100}</span>
                                                </div>
                                                <div className="flex items-center gap-2 bg-white/5 px-4 py-2.5 rounded-xl border border-white/10 shadow-inner">
                                                    <Clock className="h-4 w-4 text-blue-400" />
                                                    <span className="font-black text-white text-xl tracking-tighter tabular-nums leading-none">{service.duration_minutes}m</span>
                                                </div>
                                            </div>
                                            
                                            <div className="pt-2 flex items-center justify-between">
                                                <span className={`text-[10px] font-black uppercase tracking-[0.15em] px-2 py-1 rounded-md border ${service.is_active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 bg-white/5 border-white/5'}`}>
                                                    {service.is_active ? 'Active' : 'Hidden'}
                                                </span>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => toggleActive(service.id, !!service.is_active)}
                                                    className={`h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${service.is_active ? 'bg-white/5 border-white/10 text-zinc-400 hover:text-white' : 'bg-emerald-600 hover:bg-emerald-700 border-none text-white shadow-lg shadow-emerald-600/20'}`}
                                                >
                                                    {service.is_active ? 'Hide Service' : 'Enable Service'}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
