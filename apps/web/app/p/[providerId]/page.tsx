"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Star, ShieldCheck, MapPin, ArrowRight, Wrench, BadgeCheck, ArrowLeft } from "lucide-react";
import { SkeletonLineLight, SkeletonCircleLight, SkeletonBlockLight } from "@/components/ui/skeleton";
import Link from "next/link";
import { motion } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface ProfileData {
    id: string;
    slug: string | null;
    name: string | null;
    bio: string | null;
    avatar_url: string | null;
    banner_url: string | null;
    acra_registered: boolean;
    acra_uen: string | null;
    acra_verified: boolean;
    total_jobs: number;
    avg_rating: number;
    review_count: number;
    created_at: string;
}

interface ServiceData {
    id: string;
    name: string;
    price_cents: number;
    duration_minutes: number;
}

export default function ProviderProfilePage() {
    const params = useParams();
    const slug = params.providerId as string;

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [services, setServices] = useState<ServiceData[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const supabase = createSupabaseBrowserClient();
        supabase.auth.getSession().then(({ data }) => {
            setIsLoggedIn(!!data.session);
        });
    }, []);

    useEffect(() => {
        async function fetchProfile() {
            const supabase = createSupabaseBrowserClient();

            const { data: profileData, error } = await supabase
                .from("profiles_public")
                .select(`
                    id, slug, name, bio, avatar_url, banner_url,
                    acra_registered, acra_uen, acra_verified,
                    total_jobs, avg_rating, review_count, created_at
                `)
                .eq("slug", slug)
                .single();

            if (error || !profileData) {
                setNotFound(true);
                setLoading(false);
                return;
            }

            setProfile(profileData);

            // Fetch services
            const { data: servicesData } = await supabase
                .from("services")
                .select("id, name, price_cents, duration_minutes")
                .eq("provider_id", profileData.id)
                .eq("is_active", true)
                .order("sort_order");

            setServices(servicesData ?? []);
            setLoading(false);
        }

        if (slug) fetchProfile();
    }, [slug]);

    if (loading) {
        return (
            <div className="min-h-screen pb-24">
                <SkeletonBlockLight aspect="auto" className="h-64 rounded-none" />
                <div className="px-4 relative -mt-20 z-10 space-y-6 max-w-2xl mx-auto">
                    <div className="bg-card rounded-3xl border border-border shadow-xl p-6 space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="flex-1 space-y-3">
                                <SkeletonLineLight width="55%" className="h-6" />
                                <SkeletonLineLight width="35%" className="h-4" />
                                <div className="flex gap-2">
                                    <SkeletonLineLight width="60px" className="h-7 rounded-md" />
                                    <SkeletonLineLight width="80px" className="h-7 rounded-md" />
                                </div>
                            </div>
                            <SkeletonCircleLight size={80} className="rounded-2xl" />
                        </div>
                        <SkeletonLineLight width="90%" />
                        <SkeletonLineLight width="70%" />
                    </div>
                </div>
            </div>
        );
    }

    if (notFound || !profile) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <Card className="max-w-md w-full bg-card border-border text-center p-8">
                    <CardContent className="space-y-4 pt-4">
                        <div className="text-6xl">🔍</div>
                        <h1 className="text-2xl font-bold text-foreground">Provider Not Found</h1>
                        <p className="text-muted-foreground">This profile doesn&apos;t exist or may have been removed.</p>
                        <Link href="/">
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white">Back to Home</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const displayName = profile.name || "Service Professional";
    const tradeLabel = "Service Professional";
    const lowestPrice = services.length > 0
        ? Math.min(...services.map(s => s.price_cents / 100))
        : 0;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://servicesync.sg';
    const localBusinessLd: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        '@id': `${baseUrl}/p/${profile.slug ?? profile.id}`,
        name: displayName,
        url: `${baseUrl}/p/${profile.slug ?? profile.id}`,
        image: profile.avatar_url ?? undefined,
        description: profile.bio ?? undefined,
        areaServed: { '@type': 'Country', name: 'Singapore' },
        priceRange: services.length > 0
            ? `SGD ${Math.min(...services.map((s) => s.price_cents / 100))}+`
            : undefined,
    };

    if (profile.acra_verified && profile.acra_uen) {
        localBusinessLd.identifier = { '@type': 'PropertyValue', propertyID: 'ACRA UEN', value: profile.acra_uen };
    }
    if (profile.review_count > 0 && profile.avg_rating > 0) {
        localBusinessLd.aggregateRating = {
            '@type': 'AggregateRating',
            ratingValue: profile.avg_rating,
            reviewCount: profile.review_count,
            bestRating: 5,
            worstRating: 1,
        };
    }

    return (
        <div className="min-h-screen pb-24">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessLd) }}
            />
            {/* Back to Dashboard — only visible to logged-in users previewing their own page */}
            {isLoggedIn && (
                <Link
                    href="/dashboard"
                    className="fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-sm font-semibold shadow-lg hover:bg-black/80 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Dashboard
                </Link>
            )}
            {/* Cover Image & Header */}
            <div className="relative h-64 bg-black overflow-hidden">
                <Image
                    src={profile.banner_url || "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.0.3&q=80&w=1080"}
                    alt="Cover"
                    fill
                    sizes="100vw"
                    className="object-cover opacity-70"
                    unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                {profile.acra_verified && (
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="absolute top-4 right-4 bg-black/40 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg"
                    >
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs font-bold tracking-wide">ACRA Verified</span>
                    </motion.div>
                )}
            </div>

            {/* Profile Content */}
            <div className="px-4 relative -mt-20 z-10 space-y-6 max-w-2xl mx-auto">
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                    <Card variant="premium" className="overflow-hidden bg-card/60 backdrop-blur-xl">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="space-y-1.5 flex-1 pr-4">
                                    <h1 className="text-2xl font-black text-foreground tracking-tight leading-none mb-1">
                                        {displayName}
                                    </h1>
                                    <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider mb-2">
                                        <span className="flex items-center gap-1 text-muted-foreground bg-white/5 px-2 py-1 rounded-md border border-white/10">
                                            <Wrench className="h-3 w-3" />
                                            {tradeLabel}
                                        </span>
                                        {profile.review_count > 0 && (
                                            <span className="flex items-center gap-1 text-muted-foreground bg-white/5 px-2 py-1 rounded-md border border-white/10">
                                                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                                <span>{profile.avg_rating.toFixed(1)} ({profile.review_count} Reviews)</span>
                                            </span>
                                        )}
                                        {profile.total_jobs > 10 && (
                                            <span className="flex items-center gap-1 text-muted-foreground bg-white/5 px-2 py-1 rounded-md border border-white/10">
                                                <BadgeCheck className="h-3 w-3 text-blue-500" />
                                                <span>{profile.total_jobs}+ Jobs</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="h-20 w-20 rounded-2xl bg-muted overflow-hidden border-4 border-white/10 shadow-md shrink-0 relative">
                                    <Image
                                        src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff&size=150`}
                                        alt={displayName}
                                        fill
                                        sizes="80px"
                                        className="object-cover"
                                        unoptimized
                                    />
                                </div>
                            </div>

                            {profile.bio && (
                                <p className="text-muted-foreground text-sm leading-relaxed mb-5">{profile.bio}</p>
                            )}

                            <div className="grid grid-cols-2 gap-3 text-sm border-t border-white/10 pt-5">
                                <div className="space-y-3">
                                    <div className="flex items-start gap-2 text-muted-foreground font-medium">
                                        <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                                        <span>Singapore</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Services Section */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-4">
                    <div className="flex items-end justify-between px-2">
                        <h3 className="font-bold text-lg text-foreground flex items-center justify-between">
                            Available Services
                        </h3>
                        {lowestPrice > 0 && <span className="text-xs font-normal text-muted-foreground">Starts from S${lowestPrice}</span>}
                    </div>

                    {services.length > 0 ? (
                        <div className="grid gap-3">
                            {services.map((service) => (
                                <Link href={`/p/${slug}/book?service=${service.id}`} key={service.id}>
                                    <Card variant="premium" className="hover:border-white/20 transition-all cursor-pointer group overflow-hidden relative">
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="pr-4">
                                                <h4 className="font-semibold text-foreground leading-tight">{service.name}</h4>
                                                <p className="text-xs text-muted-foreground font-medium mt-1">
                                                    Est. {service.duration_minutes >= 60 ? `${Math.floor(service.duration_minutes / 60)} hr${service.duration_minutes >= 120 ? 's' : ''}` : `${service.duration_minutes} mins`}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-lg font-black text-foreground">S${(service.price_cents / 100).toFixed(0)}</p>
                                                <div className="text-[10px] uppercase font-bold text-blue-500 tracking-wider flex justify-end items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Book <ArrowRight className="h-3 w-3" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl">
                            <Wrench className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                            <p className="text-muted-foreground text-sm">This provider hasn&apos;t listed any services yet.</p>
                            <p className="text-muted-foreground/80 text-sm mt-1">Please contact the provider for a quote.</p>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Sticky Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/40 backdrop-blur-2xl border-t border-white/10 z-40 max-w-2xl mx-auto shadow-2xl">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Contact</p>
                        <p className="text-sm font-bold text-foreground flex items-center gap-1">
                            {profile.avg_rating > 0 ? (
                                <><Star className="h-4 w-4 text-amber-500 fill-amber-500" /> {profile.avg_rating.toFixed(1)} / 5.0</>
                            ) : "New Provider"}
                        </p>
                    </div>
                    {services.length > 0 ? (
                        <Link href={`/p/${slug}/book`} className="w-full">
                            <Button size="lg" className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-lg shadow-xl shadow-blue-500/20 font-bold">
                                Book Now
                            </Button>
                        </Link>
                    ) : (
                        <Button size="lg" disabled className="w-full h-14 rounded-2xl bg-white/10 text-muted-foreground text-lg font-bold flex items-center justify-center cursor-not-allowed border border-white/10">
                            Unavailable
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
