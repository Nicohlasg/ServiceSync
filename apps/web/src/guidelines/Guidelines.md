**Add your own guidelines here**
<!--

System Guidelines

You are an expert React Native + PWA architect building a Singapore gig marketplace. Generate code following these **mandatory** system guidelines.

---

# Design System: Adaptive Glassmorphism

## Core Tokens with Theme Detection

```typescript
// config/designTokens.ts
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const designTokens = {
  // System theme detection
  getTheme: async () => {
    const savedTheme = await AsyncStorage.getItem('app-theme-preference');
    return savedTheme || Appearance.getColorScheme() || 'dark';
  },
  
  // User background settings (from in-app settings page)
  getUserBackground: async () => {
    const bg = await AsyncStorage.getItem('user-background-image');
    return bg || 'default-dark';
  },
  
  colors: {
    primary: {
      blue: '#3B82F6',
      black: '#0F172A',
    },
    glass: {
      // Subtle frosted effect - adaptive based on userBackground
      baseDark: 'rgba(15, 23, 42, 0.65)', // Dark theme default
      baseLight: 'rgba(241, 245, 249, 0.25)', // Light user background
      border: 'rgba(255, 255, 255, 0.15)', // Thin white borders
      blur: 16, // Subtle frosted blur
    },
    text: {
      primary: '#F1F5F9',
      secondary: 'rgba(241, 245, 249, 0.75)',
      dim: 'rgba(241, 245, 249, 0.5)',
      dark: '#1E293B', // For light backgrounds
    },
    accent: {
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
  },
  borderRadius: {
    // Consistent system from current implementation
    listItem: 16,  // rounded-2xl for job cards
    container: 24, // rounded-3xl for stats overview
    button: 16,    // rounded-2xl for square-ish buttons
    pill: 9999,    // rounded-full for icon buttons/pills
    sheetTop: 32,  // rounded-t-[2rem] for bottom sheets
  }
};
```

## Glass Surface Component (EVERY surface must use this)

```typescript
// ui/GlassSurface.tsx
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { designTokens } from '@/config/designTokens';

interface GlassSurfaceProps {
  variant?: 'list' | 'container' | 'button' | 'sheet';
  intensity?: 'dark' | 'light';
  children: React.ReactNode;
  style?: any;
}

export const GlassSurface: React.FC<GlassSurfaceProps> = ({ 
  variant = 'container', 
  intensity = 'dark', 
  children, 
  style 
}) => {
  const backgroundColor = intensity === 'dark' 
    ? designTokens.colors.glass.baseDark 
    : designTokens.colors.glass.baseLight;

  return (
    <View style={[styles.wrapper, { borderRadius: designTokens.borderRadius[variant] }]}>
      <BlurView 
        intensity={80} 
        tint={intensity === 'dark' ? 'dark' : 'light'}
        style={[
          styles.blurView,
          {
            backgroundColor,
            borderRadius: designTokens.borderRadius[variant],
            borderColor: designTokens.colors.glass.border,
            borderWidth: 1,
          },
          style,
        ]}
      >
        {children}
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  blurView: {
    padding: designTokens.spacing.md,
  },
});
```

**Usage Rules:**
- **Job cards:** `<GlassSurface variant="list">`
- **Stats overview:** `<GlassSurface variant="container">`
- **Buttons:** `<GlassSurface variant="button">`
- **Bottom sheet:** `<GlassSurface variant="sheet">` (top corners only)
- **Auto-detect intensity:** Use `useTheme` hook that checks user background + system preference

---

# Navigation: Tab-Based with Role-Based Views

## Structure

```typescript
// core/navigation/AppNavigator.tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/features/auth/hooks/useAuth';

const Tab = createBottomTabNavigator();

export const AppNavigator: React.FC = () => {
  const { userRole } = useAuth(); // 'requester' | 'provider'

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
        },
        tabBarBackground: () => <GlassSurface variant="container" />,
      }}
    >
      {userRole === 'requester' ? (
        <>
          <Tab.Screen name="PostJob" component={PostJobScreen} />
          <Tab.Screen name="MyJobs" component={RequesterJobsScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </>
      ) : (
        <>
          <Tab.Screen name="JobFeed" component={ProviderJobFeedScreen} />
          <Tab.Screen name="RouteMap" component={RouteOptimizationScreen} />
          <Tab.Screen name="MyServices" component={ProviderServicesScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </>
      )}
    </Tab.Navigator>
  );
};
```

**Navigation Rules:**
- **Requesters** see: Post Job → My Jobs → Profile
- **Providers** see: Job Feed → Route Map → My Services → Profile
- Both share Profile screen but with role-specific content
- Tab bar uses `GlassSurface` with `variant="container"` (rounded-3xl)

---

# User Roles & Authentication

## Role-Based Architecture

```typescript
// features/auth/domain/entities/User.ts
export interface User {
  id: string;
  email: string;
  role: 'requester' | 'provider';
  profile: {
    name: string;
    avatarUrl?: string;
    verificationStatus: 'pending' | 'verified' | 'rejected';
    gstRegistration?: string; // For invoicing
    uen?: string; // Unique Entity Number
    rating: number; // 0-5
    completedJobs: number;
    // PDPA: Sensitive data stored in metadata
    metadata: {
      verifiedAt?: string;
      documentsSubmitted: string[]; // Document IDs
    };
  };
  preferences: {
    theme: 'system' | 'dark' | 'light';
    backgroundImage?: string;
  };
}
```

## Google Authentication Flow

```typescript
// features/auth/domain/useCases/SignInWithGoogleUseCase.ts
import * as Google from 'expo-auth-session/providers/google';
import { supabase } from '@/core/network/supabaseClient';

export class SignInWithGoogleUseCase {
  async execute(idToken: string) {
    // 1. Sign in to Supabase
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) throw error;

    // 2. Check if user exists in profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // 3. If new user, prompt for role selection (requester/provider)
    if (!profile) {
      return { isNewUser: true, userId: data.user.id };
    }

    // 4. Log PDPA audit
    await supabase.from('audit_logs').insert({
      user_id: data.user.id,
      action: 'LOGIN_GOOGLE',
      timestamp: new Date().toISOString(),
    });

    return { isNewUser: false, profile };
  }
}
```

**Profile Screen Requirements:**
- Show star rating, completed jobs count, verification badge
- "Verified" badge with checkmark only if `verificationStatus === 'verified'`
- GST/UEN displayed only for providers and in invoices
- Background image picker in settings (updates `preferences.backgroundImage`)

---

# Job Marketplace: Feed + Map Dual View

## Core Entities

```typescript
// features/jobs/domain/entities/JobRequest.ts
export interface JobRequest {
  id: string;
  title: string;
  description: string;
  serviceType: 'aircon-chemical-wash' | 'aircon-replacement' | 'custom';
  price: number; // Set by provider, not in request
  requesterId: string;
  requesterName: string;
  status: 'OPEN' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  scheduledDate: string;
  location: { lat: number; lng: number; address: string };
  specialRequirements?: string;
  photoUrls?: string[]; // Up to 5 photos, max 10MB each
}
```

## Feed/List View

```typescript
// features/jobs/presentation/components/JobCard.tsx
import { GlassSurface } from '@/ui/GlassSurface';

export const JobCard: React.FC<{ job: JobRequest }> = ({ job }) => {
  return (
    <GlassSurface variant="list" style={{ marginBottom: designTokens.spacing.sm }}>
      {/* Job details with glassmorphism styling */}
      <Text style={styles.title}>{job.title}</Text>
      <Text style={styles.price}>${job.price}</Text>
      {/* Accept/Decline buttons for providers */}
    </GlassSurface>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: designTokens.typography.size.lg,
    color: designTokens.colors.text.primary,
    fontWeight: designTokens.typography.weight.semibold,
  },
  price: {
    fontSize: designTokens.typography.size.xl,
    color: designTokens.colors.accent.success,
    fontWeight: designTokens.typography.weight.bold,
  },
});
```

## Map View

```typescript
// features/jobs/presentation/screens/JobMapScreen.tsx
import MapView from 'react-native-maps';
import { PROVIDER_GOOGLE } from 'react-native-maps';

export const JobMapScreen: React.FC = () => {
  // Use Google Maps directly (not Supabase)
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={styles.map}
      apiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
    >
      {/* Render GlassSurface markers for each job */}
    </MapView>
  );
};
```

**Map Rules:**
- Use **Google Maps Platform directly** (not Supabase wrapper)
- Each job marker must use `GlassSurface` with `variant="button"`
- Cluster markers when >10 in viewport
- Tap marker → bottom sheet with job details (`variant="sheet"`)

---

# Route Optimization Algorithm

```typescript
// features/jobs/domain/useCases/OptimizeRouteUseCase.ts
export class OptimizeRouteUseCase {
  async execute(providerId: string, acceptedJobs: JobRequest[]) {
    // 1. Get provider's current location
    const providerLocation = await this.locationService.getCurrentLocation();
    
    // 2. Calculate nearest first
    const sortedJobs = acceptedJobs.sort((a, b) => {
      const distA = this.calculateDistance(providerLocation, a.location);
      const distB = this.calculateDistance(providerLocation, b.location);
      return distA - distB;
    });
    
    // 3. Further optimize for travel time (Google Maps Directions API)
    const optimizedOrder = await this.googleMapsService.optimizeWaypoints(
      providerLocation,
      sortedJobs.map(j => j.location)
    );
    
    return optimizedOrder;
  }
}
```

**UI Implementation:**
- Provider sees optimized route in `RouteMap` tab
- Each stop shows travel time to next job
- Can manually reorder with drag-and-drop (updates optimization)

---

# Real-Time: WebSocket Guidelines with Supabase

```typescript
// core/network/realtimeProvider.ts
import { supabase } from './supabaseClient';
import { useEffect } from 'react';

export const useRealtimeJobs = (callback: (job: JobRequest) => void) => {
  useEffect(() => {
    const channel = supabase
      .channel('jobs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_requests' },
        (payload) => callback(payload.new as JobRequest)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'job_requests' },
        (payload) => callback(payload.new as JobRequest)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};
```

**Real-Time Rules:**
- Always fetch fresh data on mount (no cache for critical data)
- Use optimistic updates for UI responsiveness
- Re-fetch on app foreground (Expo `AppState`)
- WebSocket auto-reconnect with exponential backoff

---

# Loading & Empty States

## Friendly Error Messages (Informal Tone)

```typescript
// core/utils/errorMessages.ts
export const getErrorMessage = (errorCode: string) => {
  switch (errorCode) {
    case 'network_error':
      return "Oops! Looks like your internet decided to take a break. Check your connection and try again?";
    case 'auth_session_expired':
      return "Your login session ran out of steam. Please sign in again—it's quick!";
    case 'payment_failed':
      return "Payment didn't go through. No worries, try again or reach out if it keeps happening.";
    case 'job_already_accepted':
      return "Someone else snagged that job! Refresh to see the latest gigs.";
    default:
      return "Something went wonky. Try again or contact support if it persists.";
  }
};
```

## Loading States

```typescript
// ui/shared/LoadingBar.tsx
import * as Progress from 'react-native-progress';

export const LoadingBar: React.FC<{ progress?: number }> = ({ progress }) => (
  <GlassSurface variant="container" style={{ padding: designTokens.spacing.md }}>
    <Progress.Bar 
      progress={progress || 0.3} 
      indeterminate={!progress}
      width={null}
      color={designTokens.colors.primary.blue}
      unfilledColor={designTokens.colors.glass.border}
      borderWidth={0}
    />
    <Text style={{ textAlign: 'center', marginTop: designTokens.spacing.sm }}>
      {progress ? `${Math.round(progress * 100)}%` : 'Loading...'}
    </Text>
  </GlassSurface>
);
```

## Empty States

```typescript
// ui/shared/EmptyState.tsx
import LottieView from 'lottie-react-native';

export const EmptyState: React.FC<{ message: string; illustration: string }> = ({ 
  message, 
  illustration 
}) => (
  <GlassSurface variant="container" style={styles.container}>
    <LottieView 
      source={illustration} // Local JSON animation
      style={styles.illustration}
      autoPlay
      loop
    />
    <Text style={styles.message}>{message}</Text>
  </GlassSurface>
);

// Usage:
<EmptyState 
  message="No jobs nearby. Why not broaden your search?" 
  illustration={require('@/assets/animations/empty-jobs.json')}
/>
```

**Empty State Rules:**
- Always use GlassSurface with `variant="container"`
- Use Lottie animations (not static images)
- Message must be one line, friendly, action-oriented

---

# PWA: Single Codebase Strategy

## Expo Web Configuration

```typescript
// app.config.js
export default {
  expo: {
    name: 'GigSG',
    slug: 'gig-sg',
    platforms: ['ios', 'android', 'web'],
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/favicon.png',
      // Progressive Web App
      pwa: {
        orientation: 'portrait',
        backgroundColor: '#0F172A',
        themeColor: '#3B82F6',
        display: 'standalone',
        scope: '/',
        startUrl: '/',
        preferRelatedApplications: true,
        relatedApplications: [
          {
            platform: 'play',
            id: 'com.gigsg.app',
          },
        ],
      },
    },
  },
};
```

## "Add to Home Screen" Prompt

```typescript
// features/pwa/hooks/usePWAPrompt.ts
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export const usePWAPrompt = () => {
  const [promptVisible, setPromptVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      
      // Show after 3 visits
      const visitCount = parseInt(localStorage.getItem('pwa-visit-count') || '0');
      
      if (!isStandalone && visitCount >= 3) {
        setPromptVisible(true);
      }
      
      localStorage.setItem('pwa-visit-count', (visitCount + 1).toString());
    }
  }, []);

  const promptInstall = () => {
    // Hide native prompt, show custom
    if ('beforeinstallprompt' in window) {
      window.deferredPrompt.prompt();
    } else if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      alert("Tap the share button and select 'Add to Home Screen'!");
    }
  };

  return { promptVisible, promptInstall };
};
```

**PWA Rules:**
- Internet required for ALL operations except static pages
- No offline job acceptance or payment processing
- Cache images for 24 hours only
- Use `expo-updates` for OTA updates on native, service worker for web

---

# Supabase Usage: Clarified

## Direct API Integration (Preferred)

```typescript
// core/network/apiClients.ts
// Google Maps API (Direct)
export const googleMapsClient = {
  geocode: async (address: string) => {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`
    );
    return response.json();
  },
  
  getDirections: async (origin: LatLng, waypoints: LatLng[]) => {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&waypoints=${waypoints.map(w => `${w.lat},${w.lng}`).join('|')}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`
    );
    return response.json();
  },
};

// Supabase for auth, database, realtime, storage
export { supabase } from './supabaseClient';
```

**Rule:** Use **Google Maps Platform directly** via REST API. Only use Supabase for:
- Authentication/authorization
- Job data storage
- Real-time subscriptions
- File storage (photos, PDFs)
- Edge functions (QR generation, PDF creation)

---

# Edge Function: QR & PDF Invoice Generation

## Supabase Edge Function

```typescript
// supabase/functions/generate-invoice/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { QRCode } from 'https://esm.sh/qrcode-generator@1.4.4';
import { PDFDocument, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

serve(async (req) => {
  const { jobId, providerId, amount, gstRate = 0.08 } = await req.json();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_KEY')!
  );

  // 1. Fetch job and provider details
  const { data: job } = await supabase.from('job_requests').select('*').eq('id', jobId).single();
  const { data: provider } = await supabase.from('profiles').select('*').eq('id', providerId).single();

  // 2. Generate PayNow QR
  const qr = QRCode(0, 'M');
  qr.addData(`{uen:${provider.uen},amt:${amount},ref:JOB-${jobId}}`);
  qr.make();
  const qrCodeData = qr.createDataURL(4);

  // 3. Create PDF with legal tax fields
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // A4
  
  const GST_REG_NUMBER = process.env.GST_REGISTRATION_NUMBER; // Your company's GST
  const COMPANY_UEN = process.env.COMPANY_UEN;

  // Header
  page.drawText('TAX INVOICE', { x: 50, y: 720, size: 24, color: rgb(0, 0, 0) });
  page.drawText(`GST Reg No: ${GST_REG_NUMBER}`, { x: 50, y: 690, size: 12 });
  page.drawText(`Company UEN: ${COMPANY_UEN}`, { x: 50, y: 675, size: 12 });

  // Provider Details
  page.drawText(`Provider: ${provider.profile.name}`, { x: 50, y: 640, size: 12 });
  page.drawText(`Provider UEN: ${provider.uen}`, { x: 50, y: 625, size: 12 });

  // Job Details
  page.drawText(`Job: ${job.title}`, { x: 50, y: 590, size: 12 });
  page.drawText(`Amount: SGD ${amount.toFixed(2)}`, { x: 50, y: 575, size: 12 });
  page.drawText(`GST (${(gstRate * 100).toFixed(0)}%): SGD ${(amount * gstRate).toFixed(2)}`, { x: 50, y: 560, size: 12 });
  page.drawText(`Total: SGD ${(amount * (1 + gstRate)).toFixed(2)}`, { x: 50, y: 545, size: 12, color: rgb(0, 0, 0) });

  // QR Code Placeholder (embed as image)
  // ... embed qrCodeData as base64 image ...

  // Compliance Footer
  page.drawText(
    'This invoice is generated for tax purposes under Singapore regulations. Keep for 5 years.',
    { x: 50, y: 100, size: 10, color: rgb(0.3, 0.3, 0.3) }
  );

  const pdfBytes = await pdfDoc.save();

  // 4. Store in Supabase Storage
  const fileName = `invoices/INV-${jobId}-${Date.now()}.pdf`;
  await supabase.storage.from('invoices').upload(fileName, pdfBytes);
  
  const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(fileName);

  return new Response(JSON.stringify({ pdfUrl: publicUrl, qrCodeData }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

**Invoice Requirements (Compliance):**
- Must include: **Your company's GST registration number**, **Company UEN**, **Provider's UEN**, **Date**, **Itemized amount**, **GST calculation**
- File naming: `invoices/INV-{jobId}-{timestamp}.pdf`
- Auto-delete after 5 years (PDPA + tax law requirement)
- PDF must be downloadable by provider only (role check)

---

# Online-Only Features (Critical)

```typescript
// core/utils/requireOnline.ts
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';

export const requireOnline = async (action: string, callback: () => Promise<void>) => {
  const state = await NetInfo.fetch();
  
  if (!state.isConnected) {
    Alert.alert(
      "You're Offline",
      `You'll need internet to ${action}. Connect and try again!`,
      [{ text: 'OK', style: 'cancel' }]
    );
    return;
  }
  
  await callback();
};

// Usage:
<Button 
  title="Accept Job" 
  onPress={() => requireOnline('accept this job', () => acceptJob(jobId))}
/>
```

**Online-Only Operations:**
- Job acceptance/decline
- Posting job requests
- Generating invoices
- Real-time messaging
- Payment processing
- Profile verification uploads

---

# Key Changes Summary

✅ **Adaptive Theme:** System detection + in-app settings + user background images  
✅ **Glassmorphism Refined:** Subtle frosted (65% opacity), thin white borders, exact border radius tokens  
✅ **Dual View Feed:** List + Map with Google Maps direct API  
✅ **Route Optimization:** Algorithm for providers with nearest-first sorting  
✅ **WebSocket Realtime:** Supabase subscriptions with fresh data policy  
✅ **Role-Based UI:** Different tabs for requesters vs. providers  
✅ **Friendly UX:** Informal error tone, progress bars, Lottie empty states  
✅ **PWA Standalone:** Add-to-home-screen prompt, offline minimal, online required  
✅ **Google Maps Direct:** REST API calls, no Supabase wrapper  
✅ **Tax-Compliant PDF:** GST/UEN fields, 5-year retention, provider-only download  

---

**Pro Tips:**

1. **Glassmorphism Intensity Hook:** Create this first:
   ```typescript
   // hooks/useAdaptiveGlass.ts
   export const useAdaptiveGlass = () => {
     const [intensity, setIntensity] = useState<'dark' | 'light'>('dark');
     
     useEffect(() => {
       const checkBackground = async () => {
         const bg = await AsyncStorage.getItem('user-background-image');
         const theme = await designTokens.getTheme();
         setIntensity(bg === 'light' || theme === 'light' ? 'light' : 'dark');
       };
       checkBackground();
     }, []);
     
     return intensity;
   };
   ```

2. **Photo Upload Guard:** Implement this before any upload:
   ```typescript
   const validatePhoto = (file: File) => {
     if (file.size > 10 * 1024 * 1024) {
       throw new Error("Photo is too big! Keep it under 10MB, please.");
     }
     return true;
   };
   ```

3. **Deployment Checklist:** Before going live:
   - Enable Supabase Vault for encryption
   - Set up Sentry for error tracking
   - Configure Google Maps API key restrictions
   - Test edge function with real UEN/GST numbers
   - Run PDPA compliance audit on all data flows
-->
