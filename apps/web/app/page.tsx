"use client";

import { useRouter } from "next/navigation";
import HeroSection from "@/components/ui/glassmorphism-trust-hero";

export default function LandingPage() {
  const { push } = useRouter();

  return (
    <HeroSection 
      onLoginClick={() => push('/login')}
      onSignupClick={() => push('/signup')}
    />
  );
}
