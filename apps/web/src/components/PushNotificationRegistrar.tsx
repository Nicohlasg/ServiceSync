"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const PERMISSION_REQUESTED_KEY = "servicesync_push_permission_requested";

function base64UrlToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
}

export function PushNotificationRegistrar() {
  useEffect(() => {
    let isCancelled = false;

    async function registerPush() {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("Notification" in window) ||
        !("PushManager" in window)
      ) {
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || isCancelled) {
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");

      if (Notification.permission === "default" && !localStorage.getItem(PERMISSION_REQUESTED_KEY)) {
        localStorage.setItem(PERMISSION_REQUESTED_KEY, "1");
        await Notification.requestPermission();
      }

      if (Notification.permission !== "granted" || isCancelled) {
        return;
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
        });
      }

      const subscriptionJson = subscription.toJSON();
      const endpoint = subscriptionJson.endpoint;
      const p256dh = subscriptionJson.keys?.p256dh;
      const auth = subscriptionJson.keys?.auth;

      if (!endpoint || !p256dh || !auth) {
        return;
      }

      await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
          is_active: true,
        },
        { onConflict: "endpoint" },
      );

      // Sprint 3 Task 3.5: Deactivate stale subscriptions from previous
      // devices. Any subscription for this user with a different endpoint is
      // from an old phone/browser — mark inactive to stop wasted VAPID sends.
      await supabase
        .from("push_subscriptions")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .neq("endpoint", endpoint)
        .eq("is_active", true);
    }

    registerPush().catch(() => {
      // silent fail: push setup should not block dashboard UX
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  return null;
}
