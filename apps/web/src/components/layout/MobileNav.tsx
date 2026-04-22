"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, FileText, Users, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home, tutorialId: "nav-home" },
  { href: "/dashboard/schedule", label: "Schedule", icon: Calendar, tutorialId: "nav-schedule" },
  { href: "/dashboard/services", label: "Services", icon: Briefcase, tutorialId: "nav-services" },
  { href: "/dashboard/clients", label: "Clients", icon: Users, tutorialId: "nav-clients" },
  { href: "/dashboard/invoices", label: "Invoices", icon: FileText, tutorialId: "nav-invoices" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="glass-nav glass-inner-light fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              data-tutorial-target={item.tutorialId}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1",
                "transition-colors duration-200",
                isActive
                  ? "text-blue-400"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Icon className={cn(
                "h-5 w-5",
                isActive && "scale-110 transition-transform"
              )} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-blue-400" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
