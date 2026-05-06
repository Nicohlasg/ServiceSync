"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, DollarSign, ShieldCheck, Loader2, CheckCircle2, ArrowRight, Sparkles, BadgeCheck, X } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { api } from "@/lib/api";
import { trackOnboardingEvent } from "@/lib/analytics-events";
import { LocalePicker } from "@/components/onboarding/LocalePicker";
import { defaultLocale, isLocale } from "@/i18n/config";
import { motion, AnimatePresence } from "framer-motion";
import { BackButton } from "@/components/ui/back-button";
import { useFormDraft } from "@/lib/useFormDraft";

function isProfileComplete(name: string | null | undefined, phone: string | null | undefined): boolean {
    return Boolean(name?.trim() && phone?.trim());
}

export default function OnboardingPage() {
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [bootstrapping, setBootstrapping] = useState(true);
    const { push, replace } = useRouter();
    const searchParams = useSearchParams();
    const isRerun = searchParams?.get("rerun") === "1";
    const rawLocale = useLocale();
    const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
    const t = useTranslations("wizard");
    const wizardStartedAtRef = useRef<number | null>(null);
    const TOTAL_STEPS = 4;

    const [formData, setFormData, clearOnboardingDraft] = useFormDraft('draft-onboarding-wizard', {
        businessName: "",
        uen: "",
        bio: "",
        serviceArea: "",
        basePrice: "50",
        serviceName: "",
        servicePrice: "",
        wizardStep: 1,
    });

    // Task 2.4: Wizard step persisted in draft so phone-death mid-wizard
    // resumes at the correct step instead of step 1.
    const step = formData.wizardStep;
    const setStep = useCallback((s: number) => {
        setFormData(prev => ({ ...prev, wizardStep: s }));
    }, [setFormData]);

    useEffect(() => {
        const supabase = createSupabaseBrowserClient();
        void (async () => {
            const { data: auth } = await supabase.auth.getUser();
            const user = auth.user;
            if (!user) {
                push("/login");
                return;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("name, phone, bio, acra_uen")
                .eq("id", user.id)
                .single();

            // Rerun mode skips the auto-redirect so profile-complete users
            // can walk every step again (memory: Re-run Setup Wizard).
            if (!isRerun && profile && isProfileComplete(profile.name, profile.phone)) {
                replace("/dashboard");
                return;
            }

            setUserId(user.id);
            if (profile) {
                setFormData((prev) => ({
                    ...prev,
                    businessName: profile.name || prev.businessName,
                    bio: profile.bio || prev.bio,
                    uen: profile.acra_uen || prev.uen,
                }));
            }
            setBootstrapping(false);

            // Masterplan §9 — fire once per wizard mount, after auth resolves.
            wizardStartedAtRef.current = Date.now();
            trackOnboardingEvent({ name: 'onboarding_wizard_started', locale });
        })();
    }, [push, replace, locale, isRerun]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    // SEC-H6: Use tRPC mutation instead of direct Supabase update
    const utils = api.useUtils();
    const updateProfileMutation = api.provider.updateProfile.useMutation();
    const addServiceMutation = api.provider.addService.useMutation();
    const resetTutorialMutation = api.provider.resetTutorialCompletion.useMutation();
    const resetChecklistMutation = api.provider.resetOnboardingChecklist.useMutation();
    const existingServicesQuery = api.provider.getServices.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

    const hasExistingService = (existingServicesQuery.data?.length ?? 0) > 0;
    const completionItems = [
        { label: "Business name", done: !!formData.businessName },
        { label: "Bio", done: !!formData.bio },
        { label: "Service area", done: !!formData.serviceArea },
        { label: "First service", done: hasExistingService || (!!formData.serviceName && !!formData.servicePrice) },
        { label: "ACRA verified", done: !!formData.uen },
    ];
    const completionPct = Math.round((completionItems.filter(i => i.done).length / completionItems.length) * 100);

    const saveStep1 = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            await updateProfileMutation.mutateAsync({
                name: formData.businessName.trim() || undefined,
                acraUen: formData.uen.trim() || undefined,
                bio: formData.bio.trim() || undefined,
                acraVerified: !!formData.uen.trim(),
            });
            if (formData.uen.trim()) {
                toast.success("ACRA Verified! Your profile now has the trust badge.");
            } else {
                toast.success("Business details saved!");
            }
            setStep(3);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Could not save. Please try again.";
            toast.error(message);
        }
        setLoading(false);
    };

    const saveStep2 = async () => {
        if (!userId) return;
        setLoading(true);

        // Create first service if provided
        if (formData.serviceName && formData.servicePrice) {
            const priceCents = Math.round((parseFloat(formData.servicePrice) || 0) * 100);
            try {
                await addServiceMutation.mutateAsync({
                    name: formData.serviceName.trim(),
                    priceCents,
                    durationMinutes: 60,
                });
                void utils.provider.getServices.invalidate();
            } catch {
                toast.error("Could not create service. You can add it later in Settings.");
            }
        }

        toast.success("Service setup saved!");
        setStep(4);
        setLoading(false);
    };

    const finishOnboarding = async () => {
        const startedAt = wizardStartedAtRef.current ?? Date.now();
        const duration_seconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
        trackOnboardingEvent({ name: 'onboarding_wizard_completed', locale, duration_seconds });

        // Re-run path: wipe tutorial + checklist completion so the coachmark
        // tour plays again on `/dashboard` and activation starts from zero.
        // Memory (project_rerun_setup_wizard): reset only on commit, never on entry.
        if (isRerun) {
            try {
                window.localStorage.removeItem("tutorial-seen-v1");
            } catch {
                // Storage blocked — server write below is the authoritative layer.
            }
            await Promise.allSettled([
                resetTutorialMutation.mutateAsync(),
                resetChecklistMutation.mutateAsync(),
            ]);
        }

        clearOnboardingDraft();
        toast.success("You're all set! Welcome to ServiceSync 🚀");
        push("/dashboard");
    };

    const skipStep = () => {
        if (step < TOTAL_STEPS) {
            setStep(step + 1);
        } else {
            finishOnboarding();
        }
    };

    if (bootstrapping) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-lg space-y-6">

                {/* Progress Header */}
                <div className="text-center space-y-3">
                    {/* Top-row controls — flex layout keeps Back/X aligned and avoids absolute-positioning glyph drift */}
                    <div className="flex items-center justify-between">
                        <BackButton
                            onClick={step > 1 ? () => setStep(step - 1) : undefined}
                            href={step === 1 ? "/dashboard/settings" : undefined}
                        />
                        <button
                            onClick={() => push("/dashboard")}
                            className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 shadow-sm hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
                            aria-label="Close wizard"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">
                        {isRerun ? t("rerunTitle") : t("title")}
                    </h1>
                    <p className="text-slate-400 text-sm">
                        {isRerun ? t("rerunSubtitle") : t("intro")}
                    </p>

                    {/* Completion Bar */}
                    <div className="flex items-center gap-3 justify-center">
                        <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${completionPct}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                        <span className="text-sm font-bold text-slate-400">{completionPct}%</span>
                    </div>

                    {/* Step Indicators */}
                    <div className="flex justify-center gap-2 pt-1">
                        {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map(s => (
                            <div
                                key={s}
                                className={`h-2 rounded-full transition-all duration-300 ${s === step ? "w-8 bg-blue-500" :
                                        s < step ? "w-2 bg-emerald-500" :
                                            "w-2 bg-slate-700"
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {/* STEP 1: Language */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Card className="shadow-2xl">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-500/20 p-2.5 rounded-xl border border-blue-500/20">
                                            <Sparkles className="h-5 w-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg text-white">{t("step1.heading")}</CardTitle>
                                            <CardDescription className="text-slate-400 text-xs">{t("step1.helper")}</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <LocalePicker variant="cards" stage="wizard" />
                                    <p className="text-xs text-slate-500">
                                        {t("step1.footer")}
                                    </p>
                                </CardContent>
                                <CardFooter className="flex gap-3">
                                    <Button onClick={() => setStep(2)} className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25">
                                        Continue <ArrowRight className="h-4 w-4 ml-2" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* STEP 2: Business Identity */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Card className="shadow-2xl">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-amber-500/15 p-2.5 rounded-xl border border-amber-400/25">
                                            <MapPin className="h-5 w-5 text-amber-300" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg text-white">Business Identity</CardTitle>
                                            <CardDescription className="text-slate-400 text-xs">How clients will see you</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="businessName" className="text-slate-300">Business / Display Name</Label>
                                        <Input
                                            id="businessName"
                                            value={formData.businessName}
                                            onChange={handleInputChange}
                                            placeholder="Ah Meng Aircon Services"
                                            className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 h-12"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="bio" className="text-slate-300">Bio / About</Label>
                                        <Textarea
                                            id="bio"
                                            value={formData.bio}
                                            onChange={handleInputChange}
                                            placeholder="Ex-Daikin technician with 15 years experience. I specialise in chemical wash and complex leak repairs..."
                                            rows={3}
                                            className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 resize-none"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="uen" className="text-slate-300 flex items-center gap-2">
                                            <BadgeCheck className="h-4 w-4 text-emerald-400" /> UEN Number (Optional)
                                        </Label>
                                        <Input
                                            id="uen"
                                            value={formData.uen}
                                            onChange={handleInputChange}
                                            placeholder="e.g. 52912345X"
                                            className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 h-12"
                                        />
                                        <p className="text-xs text-slate-500">
                                            Add your ACRA UEN to get the <span className="text-emerald-400 font-semibold">Verified</span> trust badge on your profile.
                                        </p>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-col gap-2">
                                    <Button onClick={saveStep1} disabled={loading} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25">
                                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                        Save & Continue <ArrowRight className="h-4 w-4 ml-2" />
                                    </Button>
                                    <Button variant="ghost" onClick={skipStep} className="w-full text-slate-400 hover:text-white hover:bg-slate-800">
                                        Skip for now
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* STEP 3: Service Setup */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Card className="shadow-2xl">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-amber-500/15 p-2.5 rounded-xl border border-amber-400/25">
                                            <MapPin className="h-5 w-5 text-amber-300" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg text-white">Service Setup</CardTitle>
                                            <CardDescription className="text-slate-400 text-xs">Where you work & what you charge</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-300 flex items-center gap-2">
                                            <MapPin className="h-4 w-4" /> Preferred Service Area
                                        </Label>
                                        <Select value={formData.serviceArea} onValueChange={(val) => setFormData({ ...formData, serviceArea: val })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Where do you mostly work?" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="islandwide">Islandwide (Anywhere)</SelectItem>
                                                <SelectItem value="east">East (Tampines, Pasir Ris, Bedok)</SelectItem>
                                                <SelectItem value="north">North (Woodlands, Yishun)</SelectItem>
                                                <SelectItem value="northeast">North-East (Hougang, Punggol)</SelectItem>
                                                <SelectItem value="west">West (Jurong, Clementi)</SelectItem>
                                                <SelectItem value="central">Central (Toa Payoh, Novena)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="border-t border-white/10 pt-4 space-y-3">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                            <Sparkles className="h-3 w-3" /> Add your first service (optional)
                                        </p>
                                        <Input
                                            id="serviceName"
                                            value={formData.serviceName}
                                            onChange={handleInputChange}
                                            placeholder="e.g. General Servicing (1 Unit)"
                                            className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 h-11"
                                        />
                                        <div className="relative">
                                            <span className="absolute left-4 top-3 text-slate-400 border-r border-white/10 pr-2 text-sm">S$</span>
                                            <Input
                                                id="servicePrice"
                                                type="number"
                                                value={formData.servicePrice}
                                                onChange={handleInputChange}
                                                placeholder="40"
                                                className="bg-slate-900/50 border-white/10 text-white pl-12 h-11 placeholder:text-slate-600"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-col gap-2">
                                    <Button onClick={saveStep2} disabled={loading} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25">
                                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                        Save & Continue <ArrowRight className="h-4 w-4 ml-2" />
                                    </Button>
                                    <Button variant="ghost" onClick={skipStep} className="w-full text-slate-400 hover:text-white hover:bg-slate-800">
                                        Skip
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* STEP 4: Done! */}
                    {step === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="bg-slate-900/65 backdrop-blur-xl border-white/15 shadow-2xl text-center">
                                <CardContent className="pt-10 pb-6 space-y-6">
                                    <div className="relative inline-block">
                                        <div className="h-20 w-20 mx-auto rounded-full bg-gradient-to-tr from-emerald-500 to-blue-500 flex items-center justify-center shadow-xl shadow-emerald-500/20">
                                            <CheckCircle2 className="h-10 w-10 text-white" />
                                        </div>
                                        {formData.uen && (
                                            <div className="absolute -top-1 -right-1 bg-emerald-500 text-white p-1 rounded-full border-2 border-slate-900">
                                                <ShieldCheck className="h-4 w-4" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <h2 className="text-2xl font-black text-white">You&apos;re Ready!</h2>
                                        <p className="text-slate-400 text-sm max-w-xs mx-auto">
                                            Your profile is {completionPct}% complete. You can always update details in Settings.
                                        </p>
                                    </div>

                                    {/* Completion Summary */}
                                    <div className="bg-slate-800/50 rounded-2xl p-4 space-y-2 text-left">
                                        {completionItems.map((item) => (
                                            <div key={item.label} className="flex items-center gap-3 text-sm">
                                                <div className={`h-5 w-5 rounded-full flex items-center justify-center ${item.done ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-500"}`}>
                                                    {item.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <div className="h-2 w-2 rounded-full bg-slate-600" />}
                                                </div>
                                                <span className={item.done ? "text-white font-medium" : "text-slate-500"}>
                                                    {item.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <Button
                                        onClick={finishOnboarding}
                                        className="w-full h-14 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white text-lg font-bold rounded-2xl shadow-xl"
                                    >
                                        Go to Dashboard <ArrowRight className="h-5 w-5 ml-2" />
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
