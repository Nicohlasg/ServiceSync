"use client";

import React from 'react';
import { InteractiveMenu, InteractiveMenuItem } from "@/components/ui/modern-mobile-menu";
import { Home, Briefcase, Calendar, Users, FileText } from 'lucide-react';

const lucideDemoMenuItems: InteractiveMenuItem[] = [
    { href: "/dashboard", label: "Home", icon: Home, tutorialId: "nav-home" },
    { href: "/dashboard/schedule", label: "Schedule", icon: Calendar, tutorialId: "nav-schedule" },
    { href: "/dashboard/services", label: "Services", icon: Briefcase, tutorialId: "nav-services" },
    { href: "/dashboard/clients", label: "Clients", icon: Users, tutorialId: "nav-clients" },
    { href: "/dashboard/invoices", label: "Invoices", icon: FileText, tutorialId: "nav-invoices" },
];

const customAccentColor = 'var(--chart-2)';

const Default = () => {
return  <InteractiveMenu />;
};

const Customized = () => {
return  <InteractiveMenu items={lucideDemoMenuItems} accentColor={customAccentColor} />;
};

export { Default, Customized };
