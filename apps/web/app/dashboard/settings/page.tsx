"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Mail, PlayCircle, ListTodo, LifeBuoy, Video, Clock3, LogOut, Trash2, AlertTriangle, Loader2, Globe, Settings as SettingsIcon, Smartphone, Download } from "lucide-react";
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
        if (!user) { push("/auth/login"); return; }
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
        push("/auth/login");
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
            push("/dashboard");
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
            <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
                Could not load profile.
            </div>
        );
    }

    return (
        <div className="space-y-5 pt-4 pb-24 px-4">
            <div className="mb-6 flex items-center gap-3">
                <BackButton />
                <div>
                    <h1 className="text-2xl font-bold text-white">Settings</h1>
                    <p className="text-slate-400 text-sm">Manage your account and preferences.</p>
                </div>
            </div>

            {/* Account Settings — Password & Email */}
            <Card className="rounded-3xl overflow-hidden">
                <CardContent className="p-5 space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Key className="h-3.5 w-3.5" /> Account Settings
                    </h3>

                    {/* Password Change */}
                    <div>
                        <Button
                            variant="ghost"
                            onClick={() => setShowPasswordChange(!showPasswordChange)}
                            className="w-full justify-between h-12 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-xl"
                        >
                            <span className="flex items-center gap-2 text-sm font-medium"><Key className="h-4 w-4" /> Change Password</span>
                            <span className="text-xs text-slate-500">{showPasswordChange ? "Cancel" : "→"}</span>
                        </Button>
                        <AnimatePresence>
                            {showPasswordChange && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="space-y-3 pt-3 px-1">
                                        <div className="space-y-1.5">
                                            <Label className="text-slate-400 text-xs">New Password</Label>
                                            <Input
                                                type="password"
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                placeholder="Min 6 characters"
                                                className="bg-slate-800/50 border-white/10 text-white h-10"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-slate-400 text-xs">Confirm New Password</Label>
                                            <Input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                placeholder="Re-enter password"
                                                className="bg-slate-800/50 border-white/10 text-white h-10"
                                            />
                                        </div>
                                        <Button
                                            onClick={handlePasswordChange}
                                            disabled={changingPassword || !newPassword || !confirmPassword}
                                            className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm"
                                        >
                                            {changingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                            Update Password
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="border-t border-white/5" />

                    {/* Email Change */}
                    <div>
                        <Button
                            variant="ghost"
                            onClick={() => setShowEmailChange(!showEmailChange)}
                            className="w-full justify-between h-12 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-xl"
                        >
                            <span className="flex items-center gap-2 text-sm font-medium"><Mail className="h-4 w-4" /> Change Email</span>
                            <span className="text-xs text-slate-500">{showEmailChange ? "Cancel" : "→"}</span>
                        </Button>
                        <AnimatePresence>
                            {showEmailChange && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="space-y-3 pt-3 px-1">
                                        <p className="text-xs text-slate-500">Current: {profile.email}</p>
                                        <div className="space-y-1.5">
                                            <Label className="text-slate-400 text-xs">New Email Address</Label>
                                            <Input
                                                type="email"
                                                value={newEmail}
                                                onChange={e => setNewEmail(e.target.value)}
                                                placeholder="new@email.com"
                                                className="bg-slate-800/50 border-white/10 text-white h-10"
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500">A confirmation link will be sent to your new email.</p>
                                        <Button
                                            onClick={handleEmailChange}
                                            disabled={changingEmail || !newEmail}
                                            className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm"
                                        >
                                            {changingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                            Send Confirmation
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-3xl overflow-hidden" id="help">
                <CardContent className="p-5 space-y-5">
                    <div className="space-y-1">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <LifeBuoy className="h-3.5 w-3.5" /> {t("onboardingTitle")}
                        </h3>
                        <p className="text-sm text-slate-400">{t("onboardingBody")}</p>
                    </div>

                    <div className="space-y-3">
                        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-blue-300" /> {t("languageTitle")}
                                    </p>
                                    <p className="text-sm text-slate-400">{t("languageBody")}</p>
                                </div>
                                <LocalePicker variant="chip" />
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <button
                                type="button"
                                onClick={handleReplayTutorial}
                                disabled={resettingTutorial}
                                className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-left transition-colors hover:bg-slate-900/60 disabled:cursor-wait"
                            >
                                <p className="text-sm font-semibold text-white flex items-center gap-2">
                                    <PlayCircle className="h-4 w-4 text-blue-300" /> {t("replayTourTitle")}
                                </p>
                                <p className="mt-1 text-sm text-slate-400">{t("replayTourBody")}</p>
                                <span className="mt-3 inline-flex items-center text-sm font-medium text-blue-300">
                                    {resettingTutorial ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {t("replayTourCta")}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={handleShowChecklist}
                                disabled={revealingChecklist}
                                className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-left transition-colors hover:bg-slate-900/60 disabled:cursor-wait"
                            >
                                <p className="text-sm font-semibold text-white flex items-center gap-2">
                                    <ListTodo className="h-4 w-4 text-blue-300" /> {t("checklistTitle")}
                                </p>
                                <p className="mt-1 text-sm text-slate-400">{t("checklistBody")}</p>
                                <span className="mt-3 inline-flex items-center text-sm font-medium text-blue-300">
                                    {revealingChecklist ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {t("checklistCta")}
                                </span>
                            </button>
                        </div>

                        <Link
                            href="/dashboard/onboarding?rerun=1"
                            className="block rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-left transition-colors hover:bg-slate-900/60"
                        >
                            <p className="text-sm font-semibold text-white flex items-center gap-2">
                                <SettingsIcon className="h-4 w-4 text-blue-300" /> {t("rerunWizardTitle")}
                            </p>
                            <p className="mt-1 text-sm text-slate-400">{t("rerunWizardBody")}</p>
                            <span className="mt-3 inline-flex items-center text-sm font-medium text-blue-300">
                                {t("rerunWizardCta")}
                            </span>
                        </Link>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-white flex items-center gap-2">
                                <Video className="h-4 w-4 text-blue-300" /> {t("help.title")}
                            </p>
                            <p className="text-sm text-slate-400">{t("help.body")}</p>
                        </div>

                        {publishedVideos.length > 0 ? (
                            <div className="grid gap-3">
                                {helpVideos.map((video) => {
                                    if (!video.src) return null;
                                    const Icon = video.icon;
                                    return (
                                        <div key={video.id} className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 space-y-3">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 rounded-full bg-blue-500/15 p-2 text-blue-300">
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-white">{video.title}</p>
                                                    <p className="text-sm text-slate-400">{video.body}</p>
                                                </div>
                                            </div>
                                            <video
                                                controls
                                                preload="metadata"
                                                poster={video.poster || undefined}
                                                className="aspect-video w-full rounded-xl border border-white/10 bg-black/30"
                                            >
                                                <source src={video.src} />
                                            </video>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/30 p-4">
                                <p className="text-sm text-slate-300 flex items-center gap-2">
                                    <Clock3 className="h-4 w-4 text-blue-300" /> {t("help.emptyTitle")}
                                </p>
                                <p className="mt-1 text-sm text-slate-400">{t("help.emptyBody")}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* App Installation */}
            <AppInstallSection />

            {/* App Info & Logout */}
            <div className="space-y-3 pt-2">
                <Button
                    variant="destructive"
                    className="w-full h-14 rounded-2xl shadow-lg shadow-red-500/10 text-lg bg-red-500/80 hover:bg-red-600/90 backdrop-blur-sm"
                    onClick={handleLogout}
                >
                    <LogOut className="mr-2 h-5 w-5" /> Log Out
                </Button>

                {/* Danger Zone — Account Deletion */}
                <div className="border-t border-white/10 pt-4 mt-4">
                    <AnimatePresence>
                        {!showDeleteConfirm ? (
                            <Button
                                variant="ghost"
                                className="w-full h-10 rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-500/10 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Delete my account
                            </Button>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                            >
                                <Card className="bg-red-950/40 border-red-500/30 rounded-2xl overflow-hidden">
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex items-center gap-2 text-red-400">
                                            <AlertTriangle className="h-5 w-5 shrink-0" />
                                            <p className="text-sm font-bold">Permanently delete your account?</p>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            This will permanently delete your profile, all clients, bookings, invoices, schedule entries, and services.
                                            This action <span className="text-red-400 font-semibold">cannot be undone</span>.
                                            Type your email address to confirm.
                                        </p>
                                        <Input
                                            placeholder={profile.email || "your@email.com"}
                                            value={deleteEmail}
                                            onChange={(e) => setDeleteEmail(e.target.value)}
                                            className="bg-red-950/50 border-red-500/30 text-white placeholder:text-red-800 h-10"
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                className="flex-1 h-10 text-sm text-slate-400 hover:text-white"
                                                onClick={() => { setShowDeleteConfirm(false); setDeleteEmail(""); }}
                                                disabled={deleting}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                className="flex-1 h-10 text-sm bg-red-600 hover:bg-red-700 text-white font-bold"
                                                onClick={handleDeleteAccount}
                                                disabled={deleting || deleteEmail !== profile.email}
                                            >
                                                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                                                Delete Forever
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <p className="text-center text-xs text-slate-500 pt-2">
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
        <Card className="rounded-3xl overflow-hidden border-blue-500/20 bg-blue-500/5">
            <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                            <Smartphone className="h-3.5 w-3.5" /> App Installation
                        </h3>
                        <p className="text-sm text-slate-300 font-medium">Install ServiceSync on your device</p>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Get a faster, more reliable experience with our app. 
                            Access your dashboard directly from your home screen.
                        </p>
                    </div>
                    <div className="bg-blue-500/10 p-2.5 rounded-2xl">
                        <Download className="h-5 w-5 text-blue-400" />
                    </div>
                </div>

                {isInstallable ? (
                    <Button 
                        onClick={install}
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20"
                    >
                        Install App Now
                    </Button>
                ) : (
                    <div className="rounded-2xl bg-slate-900/50 p-4 border border-white/5">
                        <p className="text-xs text-slate-400 flex items-start gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <span>
                                To install: Open your browser settings and select <strong>&quot;Add to Home Screen&quot;</strong> or <strong>&quot;Install App&quot;</strong>.
                            </span>
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
