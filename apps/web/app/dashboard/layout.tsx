import { PushNotificationRegistrar } from "@/components/PushNotificationRegistrar";
import { PageTransition } from "@/components/page-transition";
import { TutorialOverlay } from "@/components/tutorial";
import { BottomMenuWrapper } from "@/components/ui/bottom-menu-wrapper";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col glass-bg-dashboard pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <PushNotificationRegistrar />
      <TutorialOverlay />
      <main className="flex-1 container mx-auto p-4 max-w-lg md:max-w-4xl">
        <PageTransition>{children}</PageTransition>
      </main>
      <BottomMenuWrapper />
    </div>
  );
}
