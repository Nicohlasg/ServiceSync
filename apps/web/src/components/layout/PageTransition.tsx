"use client";

// Simplified page transition - removed AnimatePresence that was causing flicker
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-fade-in">
      {children}
    </div>
  );
}
