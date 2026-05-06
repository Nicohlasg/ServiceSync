"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BackButtonProps {
    href?: string;
    onClick?: () => void;
    className?: string;
}

export function BackButton({ href, onClick, className }: BackButtonProps) {
    const router = useRouter();

    const button = (
        <Button
            variant="ghost"
            size="icon"
            onClick={!href ? (onClick || (() => router.back())) : undefined}
            className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 shadow-sm hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:ring-0 shrink-0"
        >
            <ArrowLeft className="h-5 w-5" />
        </Button>
    );

    if (href) {
        return <Link href={href} className={cn("inline-flex", className)}>{button}</Link>;
    }

    return (
        <span className={cn("inline-flex", className)}>
            {button}
        </span>
    );
}
