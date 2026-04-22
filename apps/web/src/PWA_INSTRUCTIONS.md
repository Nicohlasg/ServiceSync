PWA Installation & Deployment Guide

## 1. Prerequisites
Ensure you have the following installed:
- Node.js (v18+)
- Supabase CLI (if you need local backend)
- Vercel CLI (recommended for deployment)

## 2. Configuration for PWA
The project is already configured with a basic `manifest.json` (implied in Next.js structure usually in `public/manifest.json`).

Ensure `public/manifest.json` exists with content like:
```json
{
  "name": "ServiceSync SG",
  "short_name": "ServiceSync",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

Ensure `layout.tsx` or `head.tsx` includes:
```tsx
<meta name="theme-color" content="#0f172a" />
<link rel="manifest" href="/manifest.json" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
```

## 3. Deployment (Vercel)
Vercel is the easiest way to deploy Next.js apps.

1.  **Login to Vercel**:
    ```bash
    npm i -g vercel
    vercel login
    ```

2.  **Deploy**:
    Run the following command in the root directory:
    ```bash
    vercel
    ```
    - Set up project settings (default is usually fine).
    - If asked for environment variables, ensure you add:
      - `NEXT_PUBLIC_SUPABASE_URL`
      - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
      - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

3.  **Production Deployment**:
    ```bash
    vercel --prod
    ```

## 4. How to Install on Mobile

**iOS (Safari):**
1.  Open the deployed URL in Safari.
2.  Tap the "Share" button (box with arrow up).
3.  Scroll down and tap "Add to Home Screen".
4.  Tap "Add".

**Android (Chrome):**
1.  Open the deployed URL in Chrome.
2.  Tap the menu (three dots) or wait for the "Add to Home Screen" prompt.
3.  Tap "Install App" or "Add to Home Screen".

## 5. Offline Support
Currently, the app requires an internet connection for most features (Supabase/Maps). To make it fully offline-capable, you would need to implement a Service Worker (e.g., using `next-pwa` package).

1.  Install: `npm install next-pwa`
2.  Update `next.config.js`:
    ```javascript
    const withPWA = require('next-pwa')({
      dest: 'public'
    })

    module.exports = withPWA({
      // other config
    })
    ```
3.  Re-deploy.
