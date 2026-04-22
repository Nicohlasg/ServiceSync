"use client";

import { usePathname } from "next/navigation";
import { Customized as BottomMenu } from "@/components/ui/modern-mobile-menu-demo";

export function BottomMenuWrapper() {
    const pathname = usePathname();

    // Hide bottom navigation on the onboarding wizard
    if (pathname?.startsWith("/dashboard/onboarding")) {
        return null;
    }

    return <BottomMenu />;
}
