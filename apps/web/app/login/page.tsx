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

    const handleOAuthLogin = async (provider: 'google' | 'apple') => {
        setLoading(true);
        try {
            const supabase = createSupabaseBrowserClient();
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
                },
            });
            if (error) {
                toast.error(error.message);
                setLoading(false);
            }
            // On success the browser navigates away — no need to reset loading
        } catch {
            toast.error("An unexpected error occurred. Please try again.");
            setLoading(false);
        }
    };

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
                            {/* OR divider */}
                            <div className="flex items-center gap-3 w-full">
                                <div className="flex-1 h-px bg-white/10" />
                                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">or</span>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>

                            {/* Social login */}
                            <div className="flex gap-3 w-full">
                                <button
                                    type="button"
                                    onClick={() => handleOAuthLogin('google')}
                                    disabled={loading}
                                    className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    Google
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleOAuthLogin('apple')}
                                    disabled={loading}
                                    className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
                                    </svg>
                                    Apple
                                </button>
                            </div>

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
