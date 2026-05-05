"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Mail, PlayCircle, ListTodo, LifeBuoy, Video, Clock3, LogOut, Trash2, AlertTriangle, Loader2, Globe, Settings as SettingsIcon, Smartphone, Download, Palette, Check, X, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useState, useCallback, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { LocalePicker } from "@/components/onboarding/LocalePicker";
import { usePwa } from "@/components/PwaInstallPrompt";
import { useTutorialGate } from "@/components/tutorial/useTutorialGate";
import { api } from "@/lib/api";
import Link from "next/link";
import { SkeletonLine, SkeletonCircle } from "@/components/ui/skeleton";
import { BackButton } from "@/components/ui/back-button";
import { useBackground, BG_META, type BgKey } from "@/components/BackgroundProvider";

interface ProfileData {
    id: string;
    email: string | null;
}

function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    if (typeof error === "object" && error !== null && "message" in error) {
        const maybeMessage = (error as { message?: unknown }).message;
        if (typeof maybeMessage === "string" && maybeMessage.length > 0) {
            return maybeMessage;
        }
    }
    return fallback;
}

export default function SettingsPage() {
    const t = useTranslations("profile");
    const { push } = useRouter();
    const { reset: resetTutorial } = useTutorialGate();
    const { bg, setBg } = useBackground();
    
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteEmail, setDeleteEmail] = useState("");
    const [deleting, setDeleting] = useState(false);

    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);

    const [showEmailChange, setShowEmailChange] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [changingEmail, setChangingEmail] = useState(false);

    const [resettingTutorial, setResettingTutorial] = useState(false);
    const [revealingChecklist, setRevealingChecklist] = useState(false);

    const deleteAccountMutation = api.provider.deleteAccount.useMutation({
        onSuccess: async () => {
            const supabase = createSupabaseBrowserClient();
            await supabase.auth.signOut();
            toast.success("Account deleted successfully. We're sorry to see you go.");
            window.location.href = "/";
        },
        onError: (err) => {
            toast.error(err.message || "Failed to delete account");
            setDeleting(false);
        },
    });

    const setChecklistHiddenMutation = api.provider.setChecklistHidden.useMutation();

    const loadProfile = useCallback(async () => {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { push('/login'); return; }
        setProfile({ id: user.id, email: user.email ?? null });
        setLoading(false);
    }, [push]);

    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);

    const handleLogout = async () => {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        toast.success("Logged out successfully");
        push('/login');
    };

    const handleDeleteAccount = () => {
        if (!profile?.email || deleteEmail !== profile.email) {
            toast.error("Please type your email address exactly to confirm.");
            return;
        }
        setDeleting(true);
        deleteAccountMutation.mutate({ confirmEmail: deleteEmail });
    };

    const handlePasswordChange = async () => {
        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match.");
            return;
        }
        setChangingPassword(true);
        try {
            const supabase = createSupabaseBrowserClient();
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            toast.success("Password updated successfully!");
            setShowPasswordChange(false);
            setNewPassword("");
            setConfirmPassword("");
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to update password"));
        } finally {
            setChangingPassword(false);
        }
    };

    const handleEmailChange = async () => {
        if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            toast.error("Please enter a valid email address.");
            return;
        }
        if (newEmail === profile?.email) {
            toast.error("That's already your current email.");
            return;
        }
        setChangingEmail(true);
        try {
            const supabase = createSupabaseBrowserClient();
            const { error } = await supabase.auth.updateUser({ email: newEmail });
            if (error) throw error;
            toast.success("Confirmation email sent! Check your inbox to verify the new address.");
            setShowEmailChange(false);
            setNewEmail("");
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to update email"));
        } finally {
            setChangingEmail(false);
        }
    };

    const handleReplayTutorial = async () => {
        setResettingTutorial(true);
        try {
            await resetTutorial();
            toast.success(t("replayTourToast"));
            // Hard reload so the React Query cache is fully cleared and the
            // tutorial gate starts fresh — push() keeps stale cache alive.
            window.location.href = "/dashboard";
        } catch {
            toast.error("Couldn't restart the tour. Please try again.");
        } finally {
            setResettingTutorial(false);
        }
    };

    const handleShowChecklist = async () => {
        setRevealingChecklist(true);
        try {
            await setChecklistHiddenMutation.mutateAsync({ hidden: false });
            toast.success(t("checklistToast"));
            push("/dashboard");
        } catch {
            toast.error("Couldn't reopen the setup checklist. Please try again.");
        } finally {
            setRevealingChecklist(false);
        }
    };

    const helpVideos = [
        {
            id: "paynow",
            icon: Video,
            title: t("help.paynowTitle"),
            body: t("help.paynowBody"),
            src: process.env.NEXT_PUBLIC_HELP_VIDEO_PAYNOW || "",
            poster: process.env.NEXT_PUBLIC_HELP_VIDEO_PAYNOW_POSTER || "",
        },
        {
            id: "client",
            icon: Video,
            title: t("help.clientTitle"),
            body: t("help.clientBody"),
            src: process.env.NEXT_PUBLIC_HELP_VIDEO_CLIENT || "",
            poster: process.env.NEXT_PUBLIC_HELP_VIDEO_CLIENT_POSTER || "",
        },
        {
            id: "qr",
            icon: Video,
            title: t("help.qrTitle"),
            body: t("help.qrBody"),
            src: process.env.NEXT_PUBLIC_HELP_VIDEO_QR || "",
            poster: process.env.NEXT_PUBLIC_HELP_VIDEO_QR_POSTER || "",
        },
    ];

    const publishedVideos = helpVideos.filter((video) => video.src);

    if (loading) {
        return (
            <div className="space-y-6 pt-4 min-h-[60vh] px-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <SkeletonLine width="40px" className="h-10 rounded-full" />
                    <SkeletonLine width="120px" className="h-7" />
                </div>
                {/* Account section */}
                <div className="glass-card glass-inner-light rounded-2xl p-5 space-y-4">
                    <SkeletonLine width="30%" className="h-4" />
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 py-3">
                            <SkeletonCircle size={36} />
                            <div className="flex-1 space-y-1">
                                <SkeletonLine width="50%" className="h-4" />
                                <SkeletonLine width="70%" className="h-3" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 py-3">
                            <SkeletonCircle size={36} />
                            <SkeletonLine width="45%" className="h-4" />
                        </div>
                    </div>
                </div>
                {/* Preferences section */}
                <div className="glass-card glass-inner-light rounded-2xl p-5 space-y-4">
                    <SkeletonLine width="35%" className="h-4" />
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 py-3">
                            <SkeletonCircle size={36} />
                            <SkeletonLine width="40%" className="h-4" />
                        </div>
                        <div className="flex items-center gap-3 py-3">
                            <SkeletonCircle size={36} />
                            <SkeletonLine width="55%" className="h-4" />
                        </div>
                    </div>
                </div>
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

    return (
        <div className="space-y-5 pt-4 pb-24 px-4 text-white">
            <div className="mb-6 flex items-center gap-3">
                <BackButton href="/dashboard" />
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight leading-none mb-1">Settings</h1>
                    <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Manage your account and preferences.</p>
                </div>
            </div>

            {/* Account Settings — Password & Email */}
            <Card variant="premium" className="rounded-3xl overflow-hidden backdrop-blur-2xl">
                <CardContent className="p-5 space-y-4">
                    <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2 relative z-10">
                        <Key className="h-3.5 w-3.5 text-blue-400" /> Account Settings
                    </h3>

                    {/* Password Change */}
                    <div className="relative z-10">
                        <Button
                            variant="ghost"
                            onClick={() => setShowPasswordChange(!showPasswordChange)}
                            className="w-full justify-between h-14 text-zinc-200 hover:text-white hover:bg-white/5 rounded-2xl border border-white/5 transition-all"
                        >
                            <span className="flex items-center gap-3 text-sm font-bold"><Key className="h-4 w-4 text-zinc-400" /> Change Password</span>
                            <span className="text-zinc-500">{showPasswordChange ? <X className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                        </Button>
                        <AnimatePresence>
                            {showPasswordChange && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="space-y-4 pt-4 px-1">
                                        <div className="space-y-1.5">
                                            <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">New Password</Label>
                                            <Input
                                                type="password"
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                placeholder="Min 6 characters"
                                                className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:border-blue-500/50 backdrop-blur-md"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Confirm New Password</Label>
                                            <Input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                placeholder="Re-enter password"
                                                className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:border-blue-500/50 backdrop-blur-md"
                                            />
                                        </div>
                                        <Button
                                            onClick={handlePasswordChange}
                                            disabled={changingPassword || !newPassword || !confirmPassword}
                                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-sm shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all"
                                        >
                                            {changingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                            UPDATE PASSWORD
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="border-t border-white/10 relative z-10" />

                    {/* Email Change */}
                    <div className="relative z-10">
                        <Button
                            variant="ghost"
                            onClick={() => setShowEmailChange(!showEmailChange)}
                            className="w-full justify-between h-14 text-zinc-200 hover:text-white hover:bg-white/5 rounded-2xl border border-white/5 transition-all"
                        >
                            <span className="flex items-center gap-3 text-sm font-bold"><Mail className="h-4 w-4 text-zinc-400" /> Change Email</span>
                            <span className="text-zinc-500">{showEmailChange ? <X className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                        </Button>
                        <AnimatePresence>
                            {showEmailChange && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="space-y-4 pt-4 px-1">
                                        <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/5">
                                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Current Email</p>
                                            <p className="text-sm font-bold text-white">{profile.email}</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">New Email Address</Label>
                                            <Input
                                                type="email"
                                                value={newEmail}
                                                onChange={e => setNewEmail(e.target.value)}
                                                placeholder="new@email.com"
                                                className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:border-blue-500/50 backdrop-blur-md"
                                            />
                                        </div>
                                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide leading-relaxed ml-1 italic">A confirmation link will be sent to your new email.</p>
                                        <Button
                                            onClick={handleEmailChange}
                                            disabled={changingEmail || !newEmail}
                                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-sm shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all"
                                        >
                                            {changingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                            SEND CONFIRMATION
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </CardContent>
            </Card>

            {/* Appearance — Background Picker */}
            <Card variant="premium" className="rounded-3xl overflow-hidden backdrop-blur-2xl">
                <CardContent className="p-5 space-y-4">
                    <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2 relative z-10">
                        <Palette className="h-3.5 w-3.5 text-purple-400" /> Appearance
                    </h3>
                    <p className="text-sm text-zinc-300 font-bold relative z-10">Choose a background for your app experience.</p>
                    <div className="grid grid-cols-2 gap-4 relative z-10">
                        {(Object.keys(BG_META) as BgKey[]).map((key) => {
                            const meta = BG_META[key];
                            const isActive = bg === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setBg(key)}
                                    className={[
                                        "relative rounded-2xl overflow-hidden aspect-[3/4] border-2 transition-all duration-300",
                                        isActive
                                            ? "border-blue-500 shadow-xl shadow-blue-500/30 scale-[1.05] z-10"
                                            : "border-white/10 hover:border-white/30 grayscale-[50%] hover:grayscale-0",
                                    ].join(" ")}
                                >
                                    <img
                                        src={meta.src}
                                        alt={meta.label}
                                        className="absolute inset-0 w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />
                                    <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
                                        <p className="text-[10px] font-black text-white leading-tight uppercase tracking-widest">{meta.label}</p>
                                        <p className="text-[8px] text-zinc-400 mt-0.5 font-bold uppercase">{meta.credit}</p>
                                    </div>
                                    {isActive && (
                                        <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1 shadow-lg">
                                            <Check className="h-3 w-3 text-white stroke-[4px]" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <Card variant="premium" className="rounded-3xl overflow-hidden backdrop-blur-2xl" id="help">
                <CardContent className="p-5 space-y-6">
                    <div className="space-y-1 relative z-10">
                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <LifeBuoy className="h-3.5 w-3.5 text-emerald-400" /> {t("onboardingTitle")}
                        </h3>
                        <p className="text-sm text-zinc-300 font-bold">{t("onboardingBody")}</p>
                    </div>

                    <div className="space-y-4 relative z-10">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-white flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-blue-400" /> {t("languageTitle")}
                                    </p>
                                    <p className="text-xs text-zinc-400 font-medium leading-relaxed">{t("languageBody")}</p>
                                </div>
                                <div className="shrink-0">
                                    <LocalePicker variant="chip" />
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            <button
                                type="button"
                                onClick={handleReplayTutorial}
                                disabled={resettingTutorial}
                                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition-all hover:bg-white/10 active:scale-[0.98] group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform">
                                        <PlayCircle className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">{t("replayTourTitle")}</p>
                                        <p className="text-xs text-zinc-400 font-medium">{t("replayTourBody")}</p>
                                    </div>
                                </div>
                                <span className="mt-3 inline-flex items-center text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">
                                    {resettingTutorial ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
                                    {t("replayTourCta")}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={handleShowChecklist}
                                disabled={revealingChecklist}
                                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition-all hover:bg-white/10 active:scale-[0.98] group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:scale-110 transition-transform">
                                        <ListTodo className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">{t("checklistTitle")}</p>
                                        <p className="text-xs text-zinc-400 font-medium">{t("checklistBody")}</p>
                                    </div>
                                </div>
                                <span className="mt-3 inline-flex items-center text-[10px] font-black text-purple-400 uppercase tracking-widest bg-purple-500/10 px-2 py-1 rounded-md border border-purple-500/20">
                                    {revealingChecklist ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
                                    {t("checklistCta")}
                                </span>
                            </button>
                        </div>

                        <Link
                            href="/dashboard/onboarding?rerun=1"
                            className="block rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition-all hover:bg-white/10 active:scale-[0.98] group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 group-hover:scale-110 transition-transform">
                                    <SettingsIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">{t("rerunWizardTitle")}</p>
                                    <p className="text-xs text-zinc-400 font-medium">{t("rerunWizardBody")}</p>
                                </div>
                            </div>
                            <span className="mt-3 inline-flex items-center text-[10px] font-black text-orange-400 uppercase tracking-widest bg-orange-500/10 px-2 py-1 rounded-md border border-orange-500/20">
                                {t("rerunWizardCta")}
                            </span>
                        </Link>
                    </div>

                    <div className="space-y-4 relative z-10">
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-white flex items-center gap-2">
                                <Video className="h-4 w-4 text-blue-400" /> {t("help.title")}
                            </p>
                            <p className="text-xs text-zinc-400 font-medium leading-relaxed">{t("help.body")}</p>
                        </div>

                        {publishedVideos.length > 0 ? (
                            <div className="grid gap-4">
                                {helpVideos.map((video) => {
                                    if (!video.src) return null;
                                    const Icon = video.icon;
                                    return (
                                        <div key={video.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4 overflow-hidden backdrop-blur-md">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 rounded-xl bg-blue-500/10 p-2 text-blue-400 border border-blue-500/20 shadow-inner">
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white leading-tight">{video.title}</p>
                                                    <p className="text-xs text-zinc-400 font-medium mt-1">{video.body}</p>
                                                </div>
                                            </div>
                                            <video
                                                controls
                                                preload="metadata"
                                                poster={video.poster || undefined}
                                                className="aspect-video w-full rounded-xl border border-white/10 bg-black/40 shadow-inner"
                                            >
                                                <source src={video.src} />
                                            </video>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-center">
                                <p className="text-xs text-zinc-500 flex items-center justify-center gap-2 font-bold uppercase tracking-widest">
                                    <Clock3 className="h-4 w-4 text-zinc-600" /> {t("help.emptyTitle")}
                                </p>
                                <p className="mt-2 text-xs text-zinc-600 font-medium leading-relaxed">{t("help.emptyBody")}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* BETA-ONLY: REMOVE FOR PUBLIC LAUNCH */}
            <Card variant="premium" className="rounded-3xl overflow-hidden backdrop-blur-2xl border-amber-500/20 bg-amber-500/5">
                <CardContent className="p-5 space-y-3">
                    <h3 className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2 relative z-10">
                        🐛 Beta Programme
                    </h3>
                    <Link
                        href="/dashboard/feedback"
                        className="block rounded-2xl border border-amber-500/20 bg-white/5 p-4 text-left transition-all hover:bg-white/10 active:scale-[0.98] group relative z-10"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-bold text-white">Feedback & Bug Reports</p>
                                <p className="text-xs text-zinc-400 font-medium mt-0.5">Report bugs, request features, earn rewards.</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-zinc-500 shrink-0 group-hover:text-zinc-300 transition-colors" />
                        </div>
                    </Link>
                </CardContent>
            </Card>
            {/* END BETA-ONLY */}

            {/* App Installation */}
            <AppInstallSection />

            {/* App Info & Logout */}
            <div className="space-y-4 pt-2">
                <Button
                    variant="destructive"
                    className="w-full h-16 rounded-2xl shadow-xl shadow-red-500/20 text-lg font-black bg-red-600 hover:bg-red-700 backdrop-blur-md active:scale-[0.98] transition-all border-2 border-red-500/30"
                    onClick={handleLogout}
                >
                    <LogOut className="mr-3 h-6 w-6" /> LOG OUT
                </Button>

                {/* Danger Zone — Account Deletion */}
                <div className="border-t border-white/10 pt-6 mt-4">
                    <AnimatePresence>
                        {!showDeleteConfirm ? (
                            <Button
                                variant="ghost"
                                className="w-full h-10 rounded-xl text-zinc-600 hover:text-red-400 hover:bg-red-500/10 text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> DELETE ACCOUNT
                            </Button>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                            >
                                <Card className="bg-red-950/20 border-red-500/30 rounded-2xl overflow-hidden backdrop-blur-xl">
                                    <CardContent className="p-5 space-y-4">
                                        <div className="flex items-center gap-3 text-red-400">
                                            <div className="bg-red-500/20 p-2 rounded-lg">
                                                <AlertTriangle className="h-5 w-5 shrink-0" />
                                            </div>
                                            <p className="text-sm font-black tracking-tight uppercase">Permanently delete?</p>
                                        </div>
                                        <p className="text-xs text-zinc-400 font-medium leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5">
                                            This will permanently delete your profile, all clients, bookings, invoices, schedule entries, and services.
                                            This action <span className="text-red-400 font-bold">cannot be undone</span>.
                                            Type your email address to confirm.
                                        </p>
                                        <Input
                                            placeholder={profile.email || "your@email.com"}
                                            value={deleteEmail}
                                            onChange={(e) => setDeleteEmail(e.target.value)}
                                            className="bg-red-950/30 border-red-500/20 text-white placeholder:text-red-900/50 h-12 rounded-xl focus:border-red-500/50 font-bold"
                                        />
                                        <div className="flex gap-3 pt-1">
                                            <Button
                                                variant="ghost"
                                                className="flex-1 h-12 text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-widest"
                                                onClick={() => { setShowDeleteConfirm(false); setDeleteEmail(""); }}
                                                disabled={deleting}
                                            >
                                                CANCEL
                                            </Button>
                                            <Button
                                                className="flex-1 h-12 text-[10px] bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest shadow-lg shadow-red-600/20"
                                                onClick={handleDeleteAccount}
                                                disabled={deleting || deleteEmail !== profile.email}
                                            >
                                                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                                                DELETE FOREVER
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <p className="text-center text-[10px] font-black text-zinc-500 pt-6 uppercase tracking-[0.2em]">
                    Version 1.0.3 • ServiceSync SG
                </p>
            </div>
        </div>
    );
}

function AppInstallSection() {
    const { isInstallable, install } = usePwa();
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
        }
    }, []);

    if (isStandalone) return null;

    return (
        <Card variant="premium" className="rounded-3xl overflow-hidden border-blue-500/20 bg-blue-500/5 backdrop-blur-xl">
            <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-4 relative z-10">
                    <div className="space-y-1">
                        <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                            <Smartphone className="h-3.5 w-3.5" /> App Installation
                        </h3>
                        <p className="text-sm text-white font-bold">Install ServiceSync on your device</p>
                        <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                            Get a faster, more reliable experience with our app. 
                            Access your dashboard directly from your home screen.
                        </p>
                    </div>
                    <div className="bg-blue-500/10 p-2.5 rounded-2xl border border-blue-500/20 shrink-0">
                        <Download className="h-5 w-5 text-blue-400" />
                    </div>
                </div>

                <div className="relative z-10">
                    {isInstallable ? (
                        <Button 
                            onClick={install}
                            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all uppercase tracking-widest text-xs"
                        >
                            Install App Now
                        </Button>
                    ) : (
                        <div className="rounded-2xl bg-black/40 p-4 border border-white/5 backdrop-blur-sm">
                            <p className="text-xs text-zinc-400 flex items-start gap-3 font-medium leading-relaxed">
                                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                                <span>
                                    To install: Open your browser settings and select <strong>&quot;Add to Home Screen&quot;</strong> or <strong>&quot;Install App&quot;</strong>.
                                </span>
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
