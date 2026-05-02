"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocalePicker } from "@/components/onboarding/LocalePicker";
import { trackOnboardingEvent } from "@/lib/analytics-events";
import { defaultLocale, isLocale } from "@/i18n/config";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function SignupPage() {
    const [loading, setLoading] = useState(false);
    const { push } = useRouter();
    const t = useTranslations("signup");
    const rawLocale = useLocale();
    const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

    // KI-12: if a previous user's session cookie is still live, clear it on
    // mount so the Create Account flow never reuses credentials for the last
    // logged-in user. Middleware no longer auto-redirects /signup for
    // authenticated users, so we must tear the session down here.
    useEffect(() => {
        const supabase = createSupabaseBrowserClient();
        void supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
                void supabase.auth.signOut();
            }
        });
        trackOnboardingEvent({ name: "onboarding_signup_started", locale });
    }, [locale]);

    // LR-4.4 CRO: reduced from 5 fields to 4. Phone number moved to the
    // onboarding wizard — no reason to block signup on it, and it was the
    // single biggest form-abandonment pain point in paper prototypes.
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
        trade: "",
    });

    const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof formData, string>>>({});

    const validateField = (id: keyof typeof formData, value: string): string | undefined => {
        if (id === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return 'Enter a valid email address';
        }
        if (id === 'password' && value && value.length < 8) {
            return 'At least 8 characters';
        }
        if (id === 'fullName' && value && value.trim().length < 2) {
            return 'Enter your full name';
        }
        return undefined;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const id = e.target.id as keyof typeof formData;
        const value = e.target.value;
        setFormData({ ...formData, [id]: value });
        setFieldErrors((prev) => ({ ...prev, [id]: validateField(id, value) }));
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.fullName.trim()) {
            setFieldErrors((p) => ({ ...p, fullName: 'Enter your full name' }));
            return;
        }
        if (!formData.trade) {
            toast.error("Please select your primary trade");
            return;
        }
        if (formData.password.length < 8) {
            setFieldErrors((p) => ({ ...p, password: 'At least 8 characters' }));
            return;
        }

        setLoading(true);
        trackOnboardingEvent({ name: "onboarding_signup_submitted", locale });

        try {
            const supabase = createSupabaseBrowserClient();

            const { data, error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: { email: formData.email },
                },
            });

            if (error) {
                if (error.message.includes("already registered")) {
                    toast.error("This email is already registered. Please log in instead.");
                } else if (error.message.includes("rate limit") || error.status === 429) {
                    toast.error("Too many attempts. Please wait a minute and try again.");
                } else if (error.message.includes("invalid")) {
                    toast.error("Please enter a valid email address.");
                } else {
                    toast.error(error.message);
                }
                setLoading(false);
                return;
            }

            if (!data.user) {
                toast.error("Signup failed. Please try again.");
                setLoading(false);
                return;
            }

            // Check if email confirmation is required
            const needsConfirmation = data.user.identities?.length === 0;

            if (!needsConfirmation) {
                // Update the auto-created profile with basic info
                const { error: profileError } = await supabase
                    .from("profiles")
                    .update({
                        name: formData.fullName.trim(),
                        business_name: formData.fullName.trim(),
                        service_category: formData.trade,
                    })
                    .eq("id", data.user.id);

                if (profileError) {
                    console.error("Profile update error:", profileError);
                }

                toast.success("Account created! Let's set up your profile.");
                push("/dashboard/onboarding");
            } else {
                toast.success("Account created! Please check your email to verify, then log in.");
                push("/login");
            }
        } catch {
            toast.error("An unexpected error occurred. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 relative overflow-hidden font-sans">
            <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
                <LocalePicker variant="chip" stage="signup" />
            </div>
            <div
                className="absolute inset-0 z-0 bg-[url(https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=2069&auto=format&fit=crop)] bg-cover bg-center opacity-40"
                style={{
                    maskImage: "linear-gradient(180deg, transparent, black 0%, black 70%, transparent)",
                    WebkitMaskImage: "linear-gradient(180deg, transparent, black 0%, black 70%, transparent)",
                }}
            />

            <div className="relative z-10 w-full max-w-md my-12">
                <div className="mb-8 text-center flex flex-col items-center">
                    <img src="/brand.png" alt="ServiceSync" className="h-20 w-auto mb-3 drop-shadow-lg" />
                    <p className="text-zinc-400 font-medium">{t("brandSubtitle")}</p>
                </div>

                <Card variant="premium" className="w-full bg-zinc-900/40 border-white/10 shadow-2xl backdrop-blur-2xl">
                    <CardHeader className="space-y-1 flex flex-col items-center text-center pb-2 relative z-10">
                        <div className="bg-blue-500/10 p-3 rounded-2xl mb-2 border border-blue-500/20 shadow-lg shadow-blue-500/10">
                            <ShieldCheck className="h-8 w-8 text-blue-400" />
                        </div>
                        <CardTitle className="text-2xl font-black text-white tracking-tight">{t("title")}</CardTitle>
                        <CardDescription className="text-zinc-400 font-medium">
                            {t("subtitle")}
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSignup} className="relative z-10">
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName" className="text-zinc-300 font-bold">{t("fullName")}</Label>
                                <Input
                                    id="fullName"
                                    value={formData.fullName}
                                    onChange={handleInputChange}
                                    placeholder="Tan Ah Meng"
                                    required
                                    aria-invalid={!!fieldErrors.fullName}
                                    aria-describedby={fieldErrors.fullName ? 'fullName-err' : undefined}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-blue-500/50 h-12 rounded-xl backdrop-blur-md"
                                />
                                {fieldErrors.fullName && (
                                    <p id="fullName-err" className="text-xs text-rose-400 font-bold">{fieldErrors.fullName}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-zinc-300 font-bold">{t("email")}</Label>
                                <Input
                                    id="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    placeholder="you@example.com"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    aria-invalid={!!fieldErrors.email}
                                    aria-describedby={fieldErrors.email ? 'email-err' : undefined}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-blue-500/50 h-12 rounded-xl backdrop-blur-md"
                                />
                                {fieldErrors.email && (
                                    <p id="email-err" className="text-xs text-rose-400 font-bold">{fieldErrors.email}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-zinc-300 flex items-center gap-2 font-bold">
                                    <Wrench className="h-4 w-4" /> {t("tradeLabel")}
                                </Label>
                                <Select value={formData.trade} onValueChange={(val) => setFormData({ ...formData, trade: val })}>
                                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-12 rounded-xl backdrop-blur-md">
                                        <SelectValue placeholder={t("tradePlaceholder")} />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-white/10">
                                        <SelectItem value="aircon">{t("trade.aircon")}</SelectItem>
                                        <SelectItem value="plumbing">{t("trade.plumbing")}</SelectItem>
                                        <SelectItem value="electrical">{t("trade.electrical")}</SelectItem>
                                        <SelectItem value="handyman">{t("trade.handyman")}</SelectItem>
                                        <SelectItem value="cleaning">{t("trade.cleaning")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-zinc-300 font-bold">{t("password")}</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder="At least 8 characters"
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                    aria-invalid={!!fieldErrors.password}
                                    aria-describedby={fieldErrors.password ? 'password-err' : undefined}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-blue-500/50 h-12 rounded-xl backdrop-blur-md"
                                />
                                {fieldErrors.password && (
                                    <p id="password-err" className="text-xs text-rose-400 font-bold">{fieldErrors.password}</p>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <p className="text-[10px] text-zinc-500 text-center font-bold uppercase tracking-wider leading-relaxed">
                                {t("legalIntro")}{" "}
                                <Link href="/terms" className="text-blue-400 hover:text-blue-300" target="_blank">{t("terms")}</Link>
                                {" "}{t("legalJoiner")}{" "}
                                <Link href="/privacy" className="text-blue-400 hover:text-blue-300" target="_blank">{t("privacy")}</Link>.
                            </p>
                            <Button
                                type="submit"
                                className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all"
                                size="lg"
                                disabled={loading}
                            >
                                {loading ? (
                                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t("loading")}</>
                                ) : (
                                    t("submit")
                                )}
                            </Button>
                            <div className="text-center text-sm text-zinc-500 font-medium">
                                {t("haveAccount")}{" "}
                                <Link href="/login" className="text-blue-400 font-bold hover:text-blue-300 hover:underline transition-colors">
                                    {t("login")}
                                </Link>
                            </div>
                            <Link href="/" className="text-xs text-zinc-600 font-bold hover:text-zinc-400 transition-colors text-center uppercase tracking-widest">
                                {t("backHome")}
                            </Link>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}
