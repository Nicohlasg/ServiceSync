'use client';

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  QrCode,
  ShieldCheck,
  WifiOff,
  Sparkles,
} from "lucide-react";
import { LocalePicker } from "@/components/onboarding/LocalePicker";
import { defaultLocale, isLocale } from "@/i18n/config";
import { trackOnboardingEvent } from "@/lib/analytics-events";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

/**
 * LR-4.1 landing copy.
 *
 * Ground rules enforced here:
 *   - Zero-commission positioning is the lead message.
 *   - No fabricated stats, no fake logo marquee. ServiceSync is pre-beta;
 *     any "5,000 jobs / 99.8% satisfaction / Trusted by DBS" claim is a lie
 *     and would be a PDPA / consumer-protection liability.
 *   - Terms + Privacy links appear next to the primary CTA so consent is
 *     visible before signup (per LR-4.1 acceptance criteria).
 */

export default function HeroSection({
  onLoginClick,
  onSignupClick,
}: {
  onLoginClick?: () => void;
  onSignupClick?: () => void;
}) {
  const t = useTranslations("landing.hero");
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  useEffect(() => {
    trackOnboardingEvent({ name: "onboarding_landing_viewed", locale });
  }, [locale]);

  const valueProps = useMemo(
    () => [
      {
        icon: ShieldCheck,
        title: t("valueProps.zeroCommission.title"),
        body: t("valueProps.zeroCommission.body"),
      },
      {
        icon: QrCode,
        title: t("valueProps.paynow.title"),
        body: t("valueProps.paynow.body"),
      },
      {
        icon: WifiOff,
        title: t("valueProps.offline.title"),
        body: t("valueProps.offline.body"),
      },
      {
        icon: Sparkles,
        title: t("valueProps.singapore.title"),
        body: t("valueProps.singapore.body"),
      },
    ],
    [t]
  );

  const titleLines = t("title").split("\n");

  return (
    <div className="relative w-full min-h-screen bg-zinc-950 text-white overflow-hidden font-sans">
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeSlideIn 0.8s ease-out forwards;
          opacity: 0;
        }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }
        .delay-500 { animation-delay: 0.5s; }
      `}</style>

      <div
        className="absolute inset-0 z-0 bg-[url(https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=2069&auto=format&fit=crop)] bg-cover bg-center opacity-40"
        style={{
          maskImage:
            "linear-gradient(180deg, transparent, black 0%, black 70%, transparent)",
          WebkitMaskImage:
            "linear-gradient(180deg, transparent, black 0%, black 70%, transparent)",
        }}
      />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LocalePicker variant="chip" stage="landing" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-24 pb-12 sm:px-6 md:pt-32 md:pb-20 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8 items-start">
          <div className="lg:col-span-7 flex flex-col justify-center space-y-8 pt-8">
            <div className="animate-fade-in delay-100">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  {t("badge")}
                </span>
              </div>
            </div>

            <h1
              className="animate-fade-in delay-200 text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-medium tracking-tighter leading-[0.9]"
              style={{
                maskImage:
                  "linear-gradient(180deg, black 0%, black 80%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(180deg, black 0%, black 80%, transparent 100%)",
              }}
            >
              {titleLines.map((line, index) => {
                const isHighlight = index === Math.min(1, titleLines.length - 1);
                return (
                  <React.Fragment key={`${line}-${index}`}>
                    <span
                      className={
                        isHighlight
                          ? "bg-gradient-to-br from-white via-white to-[#ffcd75] bg-clip-text text-transparent"
                          : undefined
                      }
                    >
                      {line}
                    </span>
                    {index < titleLines.length - 1 ? <br /> : null}
                  </React.Fragment>
                );
              })}
            </h1>

            <p className="animate-fade-in delay-300 max-w-xl text-lg text-zinc-400 leading-relaxed">
              {t("subtitle")}
            </p>

            <div className="animate-fade-in delay-400 flex flex-col sm:flex-row gap-4">
              <button
                onClick={onSignupClick}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-zinc-950 transition-all hover:scale-[1.02] hover:bg-zinc-200 active:scale-[0.98]"
              >
                {t("signupCta")}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                onClick={onLoginClick}
                className="group relative inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10 hover:border-white/20"
              >
                <span>{t("loginCta")}</span>
              </button>
            </div>

            <p className="animate-fade-in delay-400 text-xs text-zinc-500 leading-relaxed max-w-xl">
              {t("legalIntro")}{" "}
              <Link
                href="/terms"
                className="text-zinc-300 underline underline-offset-2 hover:text-white"
              >
                {t("terms")}
              </Link>
              {" "}
              {t("legalJoiner")}{" "}
              <Link
                href="/privacy"
                className="text-zinc-300 underline underline-offset-2 hover:text-white"
              >
                {t("privacy")}
              </Link>
              . {t("legalTail")}
            </p>
          </div>

          <div className="lg:col-span-5 space-y-6 lg:mt-12">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 0.8 }}>
              <Card variant="premium" className="p-2 border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
                <CardContent className="p-6 space-y-6 relative z-10">
                  <h2 className="text-2xl font-black text-white tracking-tight leading-none mb-4">
                    {t("valueHeading")}
                  </h2>
                  <ul className="space-y-6">
                    {valueProps.map(({ icon: Icon, title, body }) => (
                      <li key={title} className="flex gap-4 group">
                        <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-inner group-hover:scale-110 transition-transform group-hover:bg-blue-600/20 group-hover:border-blue-500/30">
                          <Icon className="h-6 w-6 text-white group-hover:text-blue-400 transition-colors" />
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-base font-black text-white tracking-tight">
                            {title}
                          </div>
                          <p className="mt-1 text-sm text-zinc-400 font-medium leading-relaxed line-clamp-2 group-hover:text-zinc-300 transition-colors">
                            {body}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
