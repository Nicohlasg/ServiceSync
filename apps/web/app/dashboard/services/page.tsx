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
        <div className="space-y-6 pt-4 pb-24">
            <div className="px-2">
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <Briefcase className="h-8 w-8 text-blue-400" /> Services
                </h1>
                <p className="text-slate-400 mt-1 text-sm font-medium">Manage your service offerings and prices.</p>
            </div>

            {!isCreating && (
                <div className="px-1">
                    <Button
                        data-tutorial-target="add-service-btn"
                        onClick={() => { setPulseDismissed(true); startCreating(); }}
                        className={`w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-lg border border-emerald-500/30 font-black text-lg relative overflow-hidden ${
                            showPulse ? 'animate-service-pulse ring-2 ring-emerald-400/60' : ''
                        }`}
                    >
                        {showPulse && (
                            <span className="absolute inset-0 rounded-2xl animate-ping-slow bg-emerald-400/20 pointer-events-none" />
                        )}
                        <Plus className="h-5 w-5 mr-2" /> Add New Service
                    </Button>
                </div>
            )}

            {isCreating && (
                <Card data-tutorial-target="service-form" className="rounded-3xl border-blue-500/30 shadow-lg shadow-blue-500/10">
                    <CardContent className="p-5 space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest">New Service</h3>
                            <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)} className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-slate-400 text-xs font-bold uppercase">Name</Label>
                                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-slate-800/50 border-white/10 text-white" placeholder="e.g. Change Aircon Filter" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-slate-400 text-xs font-bold uppercase">Description</Label>
                                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="bg-slate-800/50 border-white/10 resize-none text-white" rows={2} placeholder="Brief description (optional)" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-slate-400 text-xs font-bold uppercase flex items-center gap-1"><DollarSign className="h-3 w-3" /> Price (SGD)</Label>
                                    <Input type="number" min="0" step="1" value={form.priceSGD} onChange={e => setForm({...form, priceSGD: parseFloat(e.target.value) || 0})} className="bg-slate-800/50 border-white/10 text-white text-xl font-bold" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-slate-400 text-xs font-bold uppercase flex items-center gap-1"><Clock className="h-3 w-3" /> Duration (min)</Label>
                                    <Input type="number" min="15" step="15" value={form.durationMinutes} onChange={e => setForm({...form, durationMinutes: parseInt(e.target.value, 10) || 0})} className="bg-slate-800/50 border-white/10 text-white text-xl font-bold" />
                                </div>
                            </div>
                            <Button onClick={handleSaveNew} disabled={addMutation.isPending} className="w-full mt-2 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl">
                                {addMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Service"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-4">
                {isLoading ? (
                    <>
                        <SkeletonCard />
                        <SkeletonCard />
                    </>
                ) : services?.length === 0 ? (
                    <div className="text-center py-12 bg-slate-800/50 rounded-3xl border border-white/5 mx-1">
                        <Briefcase className="h-10 w-10 text-slate-500 mx-auto mb-3" />
                        <p className="text-slate-400 font-medium">You have no services configured.</p>
                    </div>
                ) : (
                    services?.map(service => (
                        <Card key={service.id} className={`rounded-3xl transition-all ${!service.is_active ? 'opacity-50 grayscale' : ''}`}>
                            <CardContent className="p-5">
                                {editingId === service.id ? (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest">Edit Service</h3>
                                            <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                                                <X className="h-5 w-5" />
                                            </Button>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-slate-400 text-xs font-bold uppercase">Name</Label>
                                                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-slate-800/50 border-white/10 text-white" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-slate-400 text-xs font-bold uppercase">Description</Label>
                                                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="bg-slate-800/50 border-white/10 resize-none text-white" rows={2} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-slate-400 text-xs font-bold uppercase">Price (SGD)</Label>
                                                    <Input type="number" min="0" step="1" value={form.priceSGD} onChange={e => setForm({...form, priceSGD: parseFloat(e.target.value) || 0})} className="bg-slate-800/50 border-white/10 text-white text-xl font-bold" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-slate-400 text-xs font-bold uppercase">Duration (min)</Label>
                                                    <Input type="number" min="15" step="15" value={form.durationMinutes} onChange={e => setForm({...form, durationMinutes: parseInt(e.target.value, 10) || 0})} className="bg-slate-800/50 border-white/10 text-white text-xl font-bold" />
                                                </div>
                                            </div>
                                            <Button onClick={() => handleSaveUpdate(service.id, !!service.is_active)} disabled={updateMutation.isPending} className="w-full mt-2 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl">
                                                {updateMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Changes"}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-black text-xl text-white truncate">{service.name}</h3>
                                                </div>
                                                {service.description && (
                                                    <p className="text-sm text-slate-400 line-clamp-2 leading-snug">{service.description}</p>
                                                )}
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => startEditing(service)} className="h-8 w-8 p-0 text-slate-400 hover:text-white shrink-0 bg-white/5 rounded-full">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-white/5">
                                                <DollarSign className="h-4 w-4 text-emerald-400" />
                                                <span className="font-black text-emerald-400 text-lg tabular-nums leading-none mb-0.5">{service.price_cents / 100}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-white/5">
                                                <Clock className="h-4 w-4 text-indigo-400" />
                                                <span className="font-black text-indigo-400 text-lg tabular-nums leading-none mb-0.5">{service.duration_minutes}m</span>
                                            </div>
                                        </div>
                                        
                                        <div className="border-t border-white/10 my-1" />
                                        
                                        <div className="flex items-center justify-between">
                                            <span className={`text-xs font-bold uppercase tracking-wider ${service.is_active ? 'text-emerald-500' : 'text-slate-500'}`}>
                                                {service.is_active ? 'Active on Public Profile' : 'Hidden from Profile'}
                                            </span>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => toggleActive(service.id, !!service.is_active)}
                                                className={`h-8 px-3 rounded-lg text-xs font-bold border ${service.is_active ? 'bg-slate-800/50 border-white/10 text-slate-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}
                                            >
                                                {service.is_active ? 'Hide Service' : 'Enable Service'}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
