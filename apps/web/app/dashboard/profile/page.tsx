"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, User, Shield, Save, Loader2, Copy, ExternalLink, BadgeCheck, Pencil, X, Camera, Settings, Trash2, MapPin } from "lucide-react";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { SkeletonLine, SkeletonCircle, SkeletonCard } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState, useEffect, useRef, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";

type DaySchedule = { start: string; end: string } | null;
interface WorkingHours {
    mon: DaySchedule;
    tue: DaySchedule;
    wed: DaySchedule;
    thu: DaySchedule;
    fri: DaySchedule;
    sat: DaySchedule;
    sun: DaySchedule;
}

interface ProfileData {
    id: string;
    slug: string | null;
    name: string | null;
    bio: string | null;
    email: string | null;
    phone: string | null;
    acra_uen: string | null;
    acra_verified: boolean;
    avatar_url: string | null;
    paynow_key: string | null;
    working_hours: WorkingHours | null;
    banner_url: string | null;
    base_address: string | null;
    base_lat: number | null;
    base_lng: number | null;
}

export default function ProfilePage() {
    const { push } = useRouter();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);

    // Avatar upload state
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    // Banner upload state
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    // Editable form state
    const [form, setForm] = useState({
        name: "",
        bio: "",
        phone: "",
        acra_uen: "",
        paynow_key: "",
        working_hours: {} as WorkingHours,
        base_address: "",
        base_lat: null as number | null,
        base_lng: null as number | null,
    });

    const loadProfile = useCallback(async () => {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { push('/login'); return; }

        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (error || !data) {
            toast.error("Could not load profile");
            setLoading(false);
            return;
        }

        setProfile(data);
        setForm({
            name: data.name || "",
            bio: data.bio || "",
            phone: data.phone || "",
            acra_uen: data.acra_uen || "",
            paynow_key: data.paynow_key || "",
            working_hours: data.working_hours || {
                mon: { start: "09:00", end: "18:00" }, tue: { start: "09:00", end: "18:00" },
                wed: { start: "09:00", end: "18:00" }, thu: { start: "09:00", end: "18:00" },
                fri: { start: "09:00", end: "18:00" }, sat: null, sun: null
            },
            base_address: data.base_address || "",
            base_lat: data.base_lat ?? null,
            base_lng: data.base_lng ?? null,
        });
        setLoading(false);
    }, [push]);

    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);

    const updateProfileMutation = api.provider.updateProfile.useMutation({
        onSuccess: () => {
            toast.success("Profile updated!");
            setEditing(false);
            void loadProfile();
        },
        onError: (err) => {
            toast.error(err.message || "Failed to save changes");
        },
        onSettled: () => setSaving(false),
    });

    const handleSave = async () => {
        if (!profile) return;
        setSaving(true);
        updateProfileMutation.mutate({
            name: form.name.trim() || undefined,
            bio: form.bio.trim() || undefined,
            phone: form.phone.trim() || undefined,
            acraUen: form.acra_uen.trim() || undefined,
            paynowKey: form.paynow_key.trim() || undefined,
            workingHours: form.working_hours,
            baseAddress: form.base_address.trim() || undefined,
            baseLat: form.base_lat ?? undefined,
            baseLng: form.base_lng ?? undefined,
        });
    };

    const handleLogout = async () => {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        toast.success("Logged out successfully");
        push('/login');
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !profile) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file.");
            return;
        }
        if (file.size > 18 * 1024 * 1024) {
            toast.error("Image must be under 18MB.");
            return;
        }

        setUploadingAvatar(true);
        try {
            const supabase = createSupabaseBrowserClient();
            const ext = file.name.split(".").pop() || "jpg";
            const filePath = `avatars/${profile.id}.${ext}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
            const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

            // Update profile
            const { error: updateError } = await supabase
                .from("profiles")
                .update({ avatar_url: avatarUrl })
                .eq("id", profile.id);

            if (updateError) throw updateError;

            toast.success("Avatar updated!");
            void loadProfile();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to upload avatar");
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !profile) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file.");
            return;
        }
        if (file.size > 18 * 1024 * 1024) {
            toast.error("Image must be under 18MB.");
            return;
        }

        setUploadingBanner(true);
        try {
            const supabase = createSupabaseBrowserClient();
            const ext = file.name.split(".").pop() || "jpg";
            const filePath = `banners/${profile.id}_${Date.now()}.${ext}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
            const bannerUrl = `${urlData.publicUrl}?t=${Date.now()}`;

            // Update profile via API
            updateProfileMutation.mutate({
                bannerUrl: bannerUrl,
            });
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to upload banner");
        } finally {
            setUploadingBanner(false);
        }
    };

    const handleRemoveMedia = (type: 'avatarUrl' | 'bannerUrl') => {
        if (!confirm(`Are you sure you want to remove your ${type === 'avatarUrl' ? 'avatar' : 'banner'}?`)) return;
        updateProfileMutation.mutate({ [type]: null });
    };

    const copyProfileLink = () => {
        if (profile?.slug) {
            navigator.clipboard.writeText(`${window.location.origin}/p/${profile.slug}`);
            toast.success("Profile link copied!");
        }
    };

    if (loading) {
        return (
            <div className="space-y-6 pt-4 min-h-[60vh]">
                <div className="flex items-center gap-4">
                    <SkeletonCircle size={64} />
                    <div className="flex-1 space-y-2">
                        <SkeletonLine width="45%" className="h-6" />
                        <SkeletonLine width="30%" className="h-3" />
                    </div>
                </div>
                <SkeletonCard />
                <SkeletonCard />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] text-zinc-400">
                Could not load profile.
            </div>
        );
    }

    const displayName = profile.name || "Provider";

    return (
        <div className="space-y-5 pt-4 pb-24 px-4 w-full max-w-none text-white">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative bg-zinc-900 rounded-3xl overflow-hidden px-6 pt-12 pb-6 border border-white/10 flex flex-col items-center text-center space-y-3 backdrop-blur-2xl shadow-2xl"
            >
                {/* Back Button (Top Left) */}
                <div className="absolute top-4 left-4 z-10">
                    <BackButton />
                </div>
                
                {/* Banner Upload Button (Top Right) */}
                <div className="absolute top-4 right-4 z-10 flex gap-2">
                    {profile.banner_url && (
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRemoveMedia('bannerUrl')}
                            className="bg-red-500/80 hover:bg-red-600/90 text-white shadow-sm"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    <div>
                        <input
                            ref={bannerInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleBannerUpload}
                        />
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => bannerInputRef.current?.click()}
                            disabled={uploadingBanner}
                            className="text-xs bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border-none shadow-sm"
                        >
                            {uploadingBanner ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Camera className="h-3 w-3 mr-1" />}
                            {profile.banner_url ? 'Change Banner' : 'Upload Banner'}
                        </Button>
                    </div>
                </div>
                {/* Background Banner Preview */}
                {profile.banner_url && (
                    <div className="absolute inset-0 z-0">
                        <Image
                            src={profile.banner_url}
                            alt="Banner"
                            fill
                            sizes="100vw"
                            className="object-cover opacity-70"
                            unoptimized
                        />
                    </div>
                )}
                <div className="relative z-10">
                    <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 p-[2px] shadow-xl shadow-blue-500/20">
                        <div className="h-full w-full rounded-full bg-zinc-900 p-1">
                            <Avatar className="h-full w-full">
                                <AvatarImage src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff&size=150`} />
                                <AvatarFallback className="bg-zinc-800 text-zinc-200 text-xl font-bold">
                                    {displayName.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                    </div>
                    {profile.acra_verified && (
                        <div className="absolute bottom-0 right-0 h-8 w-8 bg-emerald-500 rounded-full border-4 border-zinc-900 flex items-center justify-center text-white">
                            <BadgeCheck className="h-4 w-4" />
                        </div>
                    )}
                    {/* Avatar Upload Button */}
                    <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                    />
                    <button
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="absolute -bottom-1 -left-1 h-8 w-8 bg-blue-600 rounded-full border-2 border-zinc-900 flex items-center justify-center text-white hover:bg-blue-700 transition-colors"
                    >
                        {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                    </button>
                    {/* Avatar Remove Button */}
                    {profile.avatar_url && (
                        <button
                            onClick={() => handleRemoveMedia('avatarUrl')}
                            className="absolute -bottom-1 -right-1 h-8 w-8 bg-red-500 rounded-full border-2 border-zinc-900 flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <div className="mt-6 relative z-10">
                    <h1 className="text-2xl font-black text-white tracking-tight">{displayName}</h1>
                    {profile.acra_uen && <p className="text-zinc-400 text-sm font-bold uppercase tracking-wider mt-1">UEN: {profile.acra_uen}</p>}
                    {profile.email && <p className="text-zinc-500 text-xs mt-1 font-medium">{profile.email}</p>}
                </div>
                {profile.acra_verified && (
                    <span className="bg-emerald-500/10 text-emerald-300 px-3 py-1 rounded-full text-[10px] font-black tracking-widest border border-emerald-500/30 relative z-10 mt-3 uppercase">
                        ACRA VERIFIED
                    </span>
                )}
            </motion.div>

            {/* Public Profile Link */}
            {profile.slug && (
                <Card variant="premium" className="rounded-2xl overflow-hidden backdrop-blur-xl">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0 relative z-10">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Your Public Page</p>
                            <p className="text-sm text-blue-400 font-mono truncate font-bold">/p/{profile.slug}</p>
                        </div>
                        <div className="flex gap-2 shrink-0 relative z-10">
                            <Button data-tutorial-target="copy-profile-link" variant="ghost" size="sm" onClick={copyProfileLink} className="text-zinc-400 hover:text-white h-9 w-9 p-0 bg-white/5 rounded-xl border border-white/10">
                                <Copy className="h-4 w-4" />
                            </Button>
                            <Button data-tutorial-target="view-service-page" variant="ghost" size="sm" onClick={() => window.open(`/p/${profile.slug}`, '_blank')} className="text-zinc-400 hover:text-white h-9 w-9 p-0 bg-white/5 rounded-xl border border-white/10">
                                <ExternalLink className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Edit Toggle */}
            <div className="flex justify-end px-1">
                <Button
                    data-tutorial-target="edit-profile-btn"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(!editing)}
                    className={`text-xs font-black uppercase tracking-widest px-4 h-9 rounded-full transition-all ${editing ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'}`}
                >
                    {editing ? <><X className="h-3.5 w-3.5 mr-1.5" /> Cancel</> : <><Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Profile</>}
                </Button>
            </div>

            {/* Profile Fields */}
            <Card variant="premium" className="rounded-[2rem] overflow-hidden backdrop-blur-2xl">
                <CardContent className="p-6 space-y-6">
                    {/* Personal Info */}
                    <div className="space-y-5 relative z-10">
                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-blue-400" /> Personal Info
                        </h3>

                        <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Display Name</Label>
                            {editing ? (
                                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:border-blue-500/50 backdrop-blur-md" />
                            ) : (
                                <p className="text-white font-bold text-base bg-white/5 px-4 py-3 rounded-xl border border-white/5">{profile.name || "—"}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Phone</Label>
                            {editing ? (
                                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:border-blue-500/50 backdrop-blur-md" />
                            ) : (
                                <p className="text-white font-bold text-base bg-white/5 px-4 py-3 rounded-xl border border-white/5">{profile.phone || "—"}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Bio</Label>
                            {editing ? (
                                <Textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3} className="bg-white/5 border-white/10 text-white resize-none rounded-xl focus:border-blue-500/50 backdrop-blur-md" />
                            ) : (
                                <p className="text-zinc-300 font-medium text-sm leading-relaxed bg-white/5 px-4 py-3 rounded-xl border border-white/5">{profile.bio || "No bio set"}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-1"><MapPin className="h-3 w-3 text-emerald-400" /> Home Address</Label>
                            {editing ? (
                                <AddressAutocomplete
                                    value={form.base_address}
                                    onChange={(addr, lat, lng) => setForm({ ...form, base_address: addr, base_lat: lat, base_lng: lng })}
                                    placeholder="Search your home address..."
                                    className="bg-white/5 border-white/10 text-white h-12 rounded-xl backdrop-blur-md"
                                />
                            ) : (
                                <div className="bg-white/5 px-4 py-3 rounded-xl border border-white/5">
                                    <p className="text-white font-bold text-sm leading-snug">{profile.base_address || "Not set"}</p>
                                    {!profile.base_address && <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mt-1">Used for route calculations</p>}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-white/10 relative z-10" />

                    {/* Business Info */}
                    <div className="space-y-5 relative z-10">
                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <Shield className="h-3.5 w-3.5 text-purple-400" /> Business & Verification
                        </h3>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">UEN Number</Label>
                                {editing ? (
                                    <Input value={form.acra_uen} onChange={e => setForm({ ...form, acra_uen: e.target.value })} placeholder="e.g. 52912345X" className="bg-white/5 border-white/10 text-white h-12 rounded-xl backdrop-blur-md" />
                                ) : (
                                    <p className="text-white font-bold text-sm bg-white/5 px-4 py-3 rounded-xl border border-white/5">{profile.acra_uen || "Not set"}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">PayNow Mobile/UEN</Label>
                                {editing ? (
                                    <Input value={form.paynow_key} onChange={e => setForm({ ...form, paynow_key: e.target.value })} placeholder="Mobile or UEN" className="bg-white/5 border-white/10 text-white h-12 rounded-xl backdrop-blur-md" />
                                ) : (
                                    <p className="text-white font-bold text-sm bg-white/5 px-4 py-3 rounded-xl border border-white/5">{profile.paynow_key || "Not set"}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-white/10 relative z-10" />

                    {/* Working Hours */}
                    <div className="space-y-5 relative z-10" data-tutorial-target="working-hours">
                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <Settings className="h-3.5 w-3.5 text-orange-400" /> Working Hours
                        </h3>
                        {editing ? (
                            <div className="space-y-3">
                                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => {
                                    const schedule = form.working_hours[day as keyof WorkingHours];
                                    return (
                                        <div key={day} className="flex items-center gap-3">
                                            <Label className="w-10 text-[10px] font-black uppercase tracking-widest text-zinc-500">{day}</Label>
                                            <div className="flex items-center gap-2 flex-1">
                                                {schedule ? (
                                                    <>
                                                        <Input
                                                            type="time"
                                                            value={schedule.start}
                                                            onChange={(e) => setForm(f => ({ ...f, working_hours: { ...f.working_hours, [day]: { ...schedule, start: e.target.value } } }))}
                                                            className="bg-white/5 border-white/10 text-white h-10 min-w-0 max-w-full appearance-none px-3 rounded-xl backdrop-blur-sm"
                                                        />
                                                        <span className="text-zinc-500 text-xs font-bold uppercase">to</span>
                                                        <Input
                                                            type="time"
                                                            value={schedule.end}
                                                            onChange={(e) => setForm(f => ({ ...f, working_hours: { ...f.working_hours, [day]: { ...schedule, end: e.target.value } } }))}
                                                            className="bg-white/5 border-white/10 text-white h-10 min-w-0 max-w-full appearance-none px-3 rounded-xl backdrop-blur-sm"
                                                        />
                                                        <Button variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, working_hours: { ...f.working_hours, [day]: null } }))} className="text-red-400 hover:text-red-300 h-10 px-3 bg-red-400/10 rounded-xl border border-red-400/20">Off</Button>
                                                    </>
                                                ) : (
                                                    <Button variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, working_hours: { ...f.working_hours, [day]: { start: "09:00", end: "18:00" } } }))} className="w-full justify-start h-10 bg-white/5 border-dashed border-white/10 text-zinc-500 font-bold rounded-xl">
                                                        Enable Day
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="space-y-2 bg-white/5 px-4 py-4 rounded-2xl border border-white/5">
                                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => {
                                    const schedule = profile?.working_hours?.[day as keyof WorkingHours];
                                    if (!schedule) return null;
                                    return (
                                        <div key={day} className="flex items-center gap-3 text-sm">
                                            <span className="w-10 font-black uppercase text-zinc-500 text-[10px] tracking-widest">{day}</span>
                                            <span className="text-white font-bold">{schedule.start} — {schedule.end}</span>
                                        </div>
                                    );
                                })}
                                {!profile?.working_hours && <p className="text-sm text-zinc-500 font-medium">No working hours set.</p>}
                            </div>
                        )}
                    </div>

                    {/* Save Button */}
                    {editing && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-2 relative z-10">
                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all"
                            >
                                {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                                SAVE PROFILE
                            </Button>
                        </motion.div>
                    )}
                </CardContent>
            </Card>

            {/* Logout */}
            <div className="space-y-3 pt-2 mt-4">
                <Button
                    variant="destructive"
                    className="w-full h-16 rounded-2xl shadow-xl shadow-red-500/20 text-lg font-black bg-red-600 hover:bg-red-700 backdrop-blur-md active:scale-[0.98] transition-all border-2 border-red-500/30"
                    onClick={handleLogout}
                >
                    <LogOut className="mr-3 h-6 w-6" /> LOG OUT
                </Button>

                <p className="text-center text-[10px] font-black text-zinc-500 pt-4 uppercase tracking-[0.2em]">
                    Version 1.0.3 • ServiceSync SG
                </p>
            </div>
        </div>
    );
}
