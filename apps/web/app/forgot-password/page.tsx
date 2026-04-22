"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ForgotPasswordPage() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const supabase = createSupabaseBrowserClient();
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
            });

            if (error) {
                toast.error(error.message);
                setLoading(false);
                return;
            }

            setSubmitted(true);
            toast.success("Password reset link sent!");
        } catch {
            toast.error("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 relative">
            <div
                className="absolute inset-0 z-0 bg-[url(https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=2069&auto=format&fit=crop)] bg-cover bg-center opacity-40"
                style={{
                    maskImage: "linear-gradient(180deg, transparent, black 0%, black 70%, transparent)",
                    WebkitMaskImage: "linear-gradient(180deg, transparent, black 0%, black 70%, transparent)",
                }}
            />

            <div className="relative z-10 w-full max-w-md">
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">ServiceSync</h1>
                    <p className="text-zinc-400">Singapore&apos;s Premier Pro Platform</p>
                </div>

                <Card className="w-full bg-slate-900/65 backdrop-blur-xl border-white/15 shadow-2xl">
                    <CardHeader className="space-y-1 flex flex-col items-center text-center pb-2">
                        <div className="bg-blue-500/20 p-3 rounded-full mb-2 border border-blue-500/30 shadow-lg shadow-blue-500/10">
                            <ShieldCheck className="h-8 w-8 text-blue-400" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-white">
                            Reset Password
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            {submitted 
                                ? "Check your email for the reset link" 
                                : "Enter your email to receive a password reset link"}
                        </CardDescription>
                    </CardHeader>
                    {!submitted ? (
                        <form onSubmit={handleResetPassword}>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-slate-300">Email Address</Label>
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
                            </CardContent>
                            <CardFooter className="flex flex-col gap-4">
                                <Button className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25" size="lg" disabled={loading}>
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending link...
                                        </>
                                    ) : (
                                        "Send Reset Link"
                                    )}
                                </Button>
                                <div className="text-center text-sm text-slate-500">
                                    Remember your password?{" "}
                                    <Link
                                        href="/login"
                                        className="text-blue-400 font-semibold hover:text-blue-300 hover:underline transition-colors"
                                    >
                                        Log in
                                    </Link>
                                </div>
                            </CardFooter>
                        </form>
                    ) : (
                        <CardFooter className="flex flex-col gap-4 pt-4">
                            <Button variant="outline" className="w-full h-12" onClick={() => setSubmitted(false)}>
                                Try another email
                            </Button>
                            <div className="text-center text-sm text-slate-500 mt-2">
                                <Link
                                    href="/login"
                                    className="text-blue-400 font-semibold hover:text-blue-300 hover:underline transition-colors"
                                >
                                    Back to Login
                                </Link>
                            </div>
                        </CardFooter>
                    )}
                </Card>
            </div>
        </div>
    );
}
