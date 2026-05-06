"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Star, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

export default function ReviewPage() {
    const params = useParams();
    const providerSlug = params.providerSlug as string;
    const bookingId = params.bookingId as string;

    const [rating, setRating] = useState(0);
    const [hovered, setHovered] = useState(0);
    const [comment, setComment] = useState("");
    const [clientName, setClientName] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { data: profile, isLoading: profileLoading } = api.provider.getPublicProfile.useQuery(
        { slug: providerSlug },
        { retry: false }
    );

    const submitMutation = api.reviews.submit.useMutation({
        onSuccess: () => setSubmitted(true),
        onError: (err) => {
            if (err.data?.code === "CONFLICT") {
                setError("A review has already been submitted for this booking.");
            } else if (err.data?.code === "BAD_REQUEST") {
                setError("This booking is not yet completed. Reviews can only be left after the job is done.");
            } else if (err.data?.code === "NOT_FOUND") {
                setError("Booking not found. Please check your link.");
            } else {
                setError("Something went wrong. Please try again.");
            }
        },
    });

    const providerName = profile?.name ?? "your service provider";

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-background">
                <Card className="max-w-md w-full bg-card border-border text-center">
                    <CardContent className="p-8 space-y-4">
                        <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto" />
                        <h1 className="text-2xl font-bold text-foreground">Thank You!</h1>
                        <p className="text-muted-foreground">
                            Your review has been submitted. It really helps {providerName} grow their business.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-background">
                <Card className="max-w-md w-full bg-card border-border text-center">
                    <CardContent className="p-8 space-y-4">
                        <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
                        <h1 className="text-xl font-bold text-foreground">Unable to Submit Review</h1>
                        <p className="text-muted-foreground">{error}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
            <div className="max-w-md w-full space-y-6">
                <div className="text-center space-y-1">
                    <h1 className="text-2xl font-bold text-foreground">Leave a Review</h1>
                    {!profileLoading && (
                        <p className="text-muted-foreground text-sm">
                            How was your experience with{" "}
                            <span className="font-semibold text-foreground">{providerName}</span>?
                        </p>
                    )}
                </div>

                <Card className="bg-card border-border">
                    <CardContent className="p-6 space-y-6">
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">Rating <span className="text-destructive">*</span></p>
                            <div className="flex gap-2 justify-center py-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        onMouseEnter={() => setHovered(star)}
                                        onMouseLeave={() => setHovered(0)}
                                        className="transition-transform hover:scale-110 focus:outline-none"
                                        aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                                    >
                                        <Star
                                            className={`h-10 w-10 transition-colors ${
                                                star <= (hovered || rating)
                                                    ? "text-amber-400 fill-amber-400"
                                                    : "text-muted-foreground/30"
                                            }`}
                                        />
                                    </button>
                                ))}
                            </div>
                            {rating > 0 && (
                                <p className="text-center text-sm text-muted-foreground">
                                    {["", "Poor", "Fair", "Good", "Great", "Excellent!"][rating]}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="client-name" className="text-sm font-medium text-foreground">
                                Your name <span className="text-destructive">*</span>
                            </label>
                            <input
                                id="client-name"
                                type="text"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                placeholder="e.g. John"
                                maxLength={100}
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="comment" className="text-sm font-medium text-foreground">
                                Comments <span className="text-muted-foreground font-normal">(optional)</span>
                            </label>
                            <Textarea
                                id="comment"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Tell others about your experience..."
                                maxLength={1000}
                                rows={4}
                                className="resize-none"
                            />
                            <p className="text-xs text-muted-foreground text-right">{comment.length}/1000</p>
                        </div>

                        <Button
                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base"
                            disabled={rating === 0 || clientName.trim().length === 0 || submitMutation.isPending}
                            onClick={() =>
                                submitMutation.mutate({
                                    bookingId,
                                    clientName: clientName.trim(),
                                    rating,
                                    comment: comment.trim() || undefined,
                                })
                            }
                        >
                            {submitMutation.isPending ? "Submitting…" : "Submit Review"}
                        </Button>
                    </CardContent>
                </Card>

                <p className="text-center text-xs text-muted-foreground">
                    Your review will be visible on {providerName}&apos;s public profile.
                </p>
            </div>
        </div>
    );
}
