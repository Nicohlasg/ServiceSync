"use client";

// Re-export Next.js navigation for compatibility
// This replaces the custom router with Next.js native navigation

export { useRouter, usePathname } from "next/navigation";

// Link component that uses Next.js native navigation
import NextLink from "next/link";

interface LinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export default function Link({ href, children, className }: LinkProps) {
  return (
    <NextLink href={href} className={className}>
      {children}
    </NextLink>
  );
}

// RouterProvider is no longer needed with Next.js App Router
// but we export a dummy component for compatibility
export function RouterProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
