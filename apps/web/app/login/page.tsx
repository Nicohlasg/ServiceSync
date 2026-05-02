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
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 relative overflow-hidden">
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
                    <p className="text-zinc-400 font-medium">{t("brandSubtitle")}</p>
                </div>

                <Card variant="premium" className="w-full bg-zinc-900/40 border-white/10 shadow-2xl backdrop-blur-2xl">
                    <CardHeader className="space-y-1 flex flex-col items-center text-center pb-2 relative z-10">
                        <div className="bg-blue-500/10 p-3 rounded-2xl mb-2 border border-blue-500/20 shadow-lg shadow-blue-500/10">
                            <ShieldCheck className="h-8 w-8 text-blue-400" />
                        </div>
                        <CardTitle className="text-2xl font-black text-white tracking-tight">
                            {t("title")}
                        </CardTitle>
                        <CardDescription className="text-zinc-400 font-medium">
                            {t("subtitle")}
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleLogin} className="relative z-10">
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-zinc-300 font-bold">{t("email")}</Label>
                                <Input
                                    id="email"
                                    placeholder="you@example.com"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-blue-500/50 h-12 rounded-xl backdrop-blur-md"
                                />
                            </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-zinc-300 font-bold">{t("password")}</Label>
                                <Link href="/forgot-password" className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors">
                                    {t("forgotPassword")}
                                </Link>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-blue-500/50 h-12 rounded-xl backdrop-blur-md"
                            />
                        </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <Button className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all" size="lg" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t("loading")}
                                    </>
                                ) : (
                                    t("submit")
                                )}
                            </Button>
                            <div className="text-center text-sm text-zinc-500 font-medium">
                                {t("needAccount")}{" "}
                                <Link
                                    href="/signup"
                                    className="text-blue-400 font-bold hover:text-blue-300 hover:underline transition-colors"
                                >
                                    {t("signup")}
                                </Link>
                            </div>
                            <div className="text-center">
                                <Link
                                    href="/"
                                    className="text-xs text-zinc-600 font-bold hover:text-zinc-400 transition-colors uppercase tracking-widest"
                                >
                                    {t("backHome")}
                                </Link>
                            </div>
                            <p className="text-[10px] text-zinc-600 text-center font-bold uppercase tracking-widest">
                                <Link href="/terms" className="hover:text-zinc-400 transition-colors">{t("terms")}</Link>
                                {" · "}
                                <Link href="/privacy" className="hover:text-zinc-400 transition-colors">{t("privacy")}</Link>
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
        <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>}>
            <Login />
        </Suspense>
    );
}
