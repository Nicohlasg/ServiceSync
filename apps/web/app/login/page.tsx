"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LocalePicker } from "@/components/onboarding/LocalePicker";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

import { Suspense } from "react";

function Login() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations("login");
    const rawRedirect = searchParams.get("redirect") || "/dashboard";
    // Prevent open redirect: only allow relative paths starting with /
    const redirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/dashboard";

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const supabase = createSupabaseBrowserClient();
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                toast.error(error.message === "Invalid login credentials"
                    ? "Invalid email or password. Please try again."
                    : error.message
                );
                setLoading(false);
                return;
            }

            toast.success("Welcome back!");
            router.push(redirect);
            router.refresh();
        } catch {
            toast.error("An unexpected error occurred. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 relative">
            <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
                <LocalePicker variant="chip" stage="signup" />
            </div>
            {/* Background Image with Gradient Mask */}
            <div
                className="absolute inset-0 z-0 bg-[url(https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=2069&auto=format&fit=crop)] bg-cover bg-center opacity-40"
                style={{
                    maskImage: "linear-gradient(180deg, transparent, black 0%, black 70%, transparent)",
                    WebkitMaskImage: "linear-gradient(180deg, transparent, black 0%, black 70%, transparent)",
                }}
            />

            <div className="relative z-10 w-full max-w-md">
                <div className="mb-8 text-center flex flex-col items-center">
                    <img src="/brand.png" alt="ServiceSync" className="h-20 w-auto mb-3 drop-shadow-lg" />
                    <p className="text-zinc-400">{t("brandSubtitle")}</p>
                </div>

                <Card className="w-full bg-slate-900/65 backdrop-blur-xl border-white/15 shadow-2xl">
                    <CardHeader className="space-y-1 flex flex-col items-center text-center pb-2">
                        <div className="bg-blue-500/20 p-3 rounded-full mb-2 border border-blue-500/30 shadow-lg shadow-blue-500/10">
                            <ShieldCheck className="h-8 w-8 text-blue-400" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-white">
                            {t("title")}
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            {t("subtitle")}
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleLogin}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-300">{t("email")}</Label>
                                <Input
                                    id="email"
                                    placeholder="you@example.com"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500/50"
                                />
                            </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-slate-300">{t("password")}</Label>
                                <Link href="/forgot-password" className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                                    {t("forgotPassword")}
                                </Link>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500/50"
                            />
                        </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <Button className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25" size="lg" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("loading")}
                                    </>
                                ) : (
                                    t("submit")
                                )}
                            </Button>
                            <div className="text-center text-sm text-slate-500">
                                {t("needAccount")}{" "}
                                <Link
                                    href="/signup"
                                    className="text-blue-400 font-semibold hover:text-blue-300 hover:underline transition-colors"
                                >
                                    {t("signup")}
                                </Link>
                            </div>
                            <div className="text-center">
                                <Link
                                    href="/"
                                    className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                                >
                                    {t("backHome")}
                                </Link>
                            </div>
                            <p className="text-xs text-slate-600 text-center">
                                <Link href="/terms" className="hover:text-slate-400 transition-colors">{t("terms")}</Link>
                                {" · "}
                                <Link href="/privacy" className="hover:text-slate-400 transition-colors">{t("privacy")}</Link>
                            </p>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>}>
            <Login />
        </Suspense>
    );
}
