"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function UpdatePasswordPage() {
    const [loading, setLoading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const { push } = useRouter();

    useEffect(() => {
        // Ensure user actually holds an authenticated session
        const init = async () => {
            const supabase = createSupabaseBrowserClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error("Invalid or expired password reset link.");
                push("/login");
            } else {
                setIsVerifying(false);
            }
        };
        init();
    }, [push]);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            const supabase = createSupabaseBrowserClient();
            const { error } = await supabase.auth.updateUser({ password });

            if (error) {
                toast.error(error.message);
                setLoading(false);
                return;
            }

            toast.success("Password updated successfully!");
            push("/dashboard");
        } catch {
            toast.error("An unexpected error occurred. Please try again.");
            setLoading(false);
        }
    };

    if (isVerifying) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
                <div className="flex flex-col items-center gap-4 text-white">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                    <p className="font-semibold text-slate-300">Verifying security token...</p>
                </div>
            </div>
        );
    }

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
                        <div className="bg-green-500/20 p-3 rounded-full mb-2 border border-green-500/30 shadow-lg shadow-green-500/10">
                            <KeyRound className="h-8 w-8 text-green-400" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-white">
                            Update Password
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            Enter your new password below
                        </CardDescription>
                    </CardHeader>
                    
                    <form onSubmit={handleUpdatePassword}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-slate-300">New Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password" className="text-slate-300">Confirm Password</Label>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500/50"
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <Button className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25" size="lg" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
                                    </>
                                ) : (
                                    "Save New Password"
                                )}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}
