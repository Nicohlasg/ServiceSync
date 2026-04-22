# ServiceSync SG — Design System v1.2

> **The single source of truth for UI consistency across the entire application.**  
> Every pixel is intentional. Color, typography, spacing, and radius form atomic components that compose into a cohesive, professional experience.  
> **Glassmorphism is our signature visual language** — frosted glass panels create depth, hierarchy, and a premium mobile-first feel.  
> **Motion is how the app earns trust** — spring physics, staggered reveals, and responsive pixels turn waiting into anticipation.

---

## Document Metadata

| Field | Value |
|-------|-------|
| **Version** | 1.2 |
| **Last Updated** | 2026-04-11 |
| **Owner** | Design / Engineering |
| **Status** | Active — All new components must follow |

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing System](#4-spacing-system)
5. [Border Radius](#5-border-radius)
6. [Shadows & Elevation](#6-shadows--elevation)
7. [Glassmorphism System](#7-glassmorphism-system)
8. [Opacity Scale](#8-opacity-scale)
9. [Animation & Motion](#9-animation--motion)
10. [Z-Index Scale](#10-z-index-scale)
11. [Component Specifications](#11-component-specifications)
12. [Implementation Reference](#12-implementation-reference)

---

## 1. Design Philosophy

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Monochromatic Harmony** | One hue (blue), varied in lightness and saturation for a cohesive identity |
| **Intentional Spacing** | 8px base unit creates visual rhythm across all elements |
| **Glassmorphism Identity** | Frosted glass effects distinguish our premium mobile-first experience |
| **Mobile-First** | Touch targets ≥44px, readable at arm's length, thumb-friendly navigation |

### Color Strategy

- **Primary Strategy**: Monochromatic — Vary lightness/saturation of single blue hue
- **Accent Strategy**: Complementary contrast for CTAs and status indicators
- **Semantic Strategy**: Consistent meaning across all contexts (error = red, success = green, etc.)

---

## 2. Color System

### 2.1 Primary Palette (Monochromatic Blue)

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `--blue-50` | `#eff6ff` | 213 100% 96% | Lightest backgrounds |
| `--blue-100` | `#dbeafe` | 214 94% 93% | Hover states, subtle fills |
| `--blue-200` | `#bfdbfe` | 213 97% 87% | Borders, dividers |
| `--blue-300` | `#93c5fd` | 212 96% 78% | Secondary accents |
| `--blue-400` | `#60a5fa` | 213 94% 68% | **Active states, icons** |
| `--blue-500` | `#3b82f6` | 217 91% 60% | **Primary brand color** |
| `--blue-600` | `#2563eb` | 221 83% 53% | **Primary buttons, links** |
| `--blue-700` | `#1d4ed8` | 224 76% 48% | Hover on primary |
| `--blue-800` | `#1e40af` | 226 71% 40% | Dark accents |
| `--blue-900` | `#1e3a8a` | 224 64% 33% | Deep backgrounds |
| `--blue-950` | `#172554` | 226 71% 29% | Deepest blue |

### 2.2 Slate Palette (Neutrals)

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `--slate-50` | `#f8fafc` | 210 40% 98% | Light backgrounds |
| `--slate-100` | `#f1f5f9` | 210 40% 96% | Cards on light theme |
| `--slate-200` | `#e2e8f0` | 214 32% 91% | Borders on light |
| `--slate-300` | `#cbd5e1` | 213 27% 84% | Disabled states |
| `--slate-400` | `#94a3b8` | 215 20% 65% | **Inactive text, icons** |
| `--slate-500` | `#64748b` | 215 16% 47% | Secondary text |
| `--slate-600` | `#475569` | 215 19% 35% | Body text on light |
| `--slate-700` | `#334155` | 215 25% 27% | Strong text |
| `--slate-800` | `#1e293b` | 217 33% 17% | **Dark card backgrounds** |
| `--slate-900` | `#0f172a` | 222 47% 11% | **Primary dark background** |
| `--slate-950` | `#020617` | 229 84% 5% | Deepest dark |

### 2.3 Semantic Colors

| Purpose | Light Mode | Dark Mode | Usage |
|---------|------------|-----------|-------|
| **Background** | `#f0f2f5` | `#0f172a` | Page background |
| **Foreground** | `#1e293b` | `#f8fafc` | Primary text |
| **Card** | `#ffffff` | `#1e293b` | Card surfaces |
| **Border** | `rgba(0,0,0,0.06)` | `#334155` | Dividers, borders |
| **Primary** | `#2563eb` | `#3b82f6` | CTAs, active elements |
| **Secondary** | `#f1f5f9` | `#1e293b` | Secondary buttons |
| **Muted** | `#f1f5f9` | `#334155` | Muted backgrounds |
| **Muted Text** | `#64748b` | `#94a3b8` | Placeholder, hints |
| **Accent** | `#f1f5f9` | `#1e293b` | Accent backgrounds |
| **Destructive** | `#ef4444` | `#ef4444` | Errors, delete actions |
| **Success** | `#22c55e` | `#22c55e` | Success states |
| **Warning** | `#f59e0b` | `#f59e0b` | Warnings, alerts |

### 2.4 Glassmorphism Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--glass-bg` | `rgba(255, 255, 255, 0.7)` | Light glass background |
| `--glass-bg-dark` | `rgba(15, 23, 42, 0.65)` | Dark glass background |
| `--glass-border` | `rgba(255, 255, 255, 0.5)` | Light glass border |
| `--glass-border-dark` | `rgba(255, 255, 255, 0.15)` | Dark glass border |

### 2.5 Color Usage Rules

```
✅ DO:
- Use blue-600 for primary buttons
- Use slate-400 for inactive navigation icons
- Use white/15 for borders on dark glass
- Use blue-400 for active states

❌ DON'T:
- Introduce new hues (orange, purple, pink)
- Use pure black (#000000) or pure white (#ffffff)
- Use opacity below 0.5 for text readability
- Mix light and dark glass on same view
```

---

## 3. Typography

### 3.1 Font Families

| Family | Usage | Fallback Stack |
|--------|-------|----------------|
| **Inter** | Primary UI, body, headings | `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` |
| **System** | Native feel on mobile | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` |

### 3.2 Modular Scale (1.25 Ratio — Major Third)

| Token | Size | Line Height | Letter Spacing | Usage |
|-------|------|-------------|----------------|-------|
| `--text-xs` | 12px | 16px | 0 | Labels, timestamps |
| `--text-sm` | 14px | 20px | 0 | Secondary text, captions |
| `--text-base` | 16px | 24px | 0 | Body text, inputs |
| `--text-lg` | 18px | 28px | -0.01em | Lead paragraphs |
| `--text-xl` | 20px | 28px | -0.01em | Small headings |
| `--text-2xl` | 24px | 32px | -0.02em | Section headings |
| `--text-3xl` | 30px | 36px | -0.02em | Page titles (mobile) |
| `--text-4xl` | 36px | 40px | -0.03em | Large headings |
| `--text-5xl` | 48px | 1 | -0.04em | Display text |
| `--text-6xl` | 60px | 1 | -0.04em | Hero headlines |
| `--text-7xl` | 72px | 1 | -0.05em | Maximum impact |

### 3.3 Font Weights

| Token | Weight | Usage |
|-------|--------|-------|
| `--font-normal` | 400 | Body text, descriptions |
| `--font-medium` | 500 | Labels, navigation |
| `--font-semibold` | 600 | Buttons, emphasis |
| `--font-bold` | 700 | Headings, prices |
| `--font-extrabold` | 800 | Hero text, stats |

### 3.4 Typography Patterns

| Element | Size | Weight | Color | Additional |
|---------|------|--------|-------|------------|
| **Page Title** | text-2xl / text-3xl | bold | foreground | tracking-tight |
| **Card Title** | text-xl | bold | foreground | tracking-tight |
| **Section Title** | text-lg | semibold | foreground | — |
| **Body** | text-base | normal | foreground | — |
| **Secondary** | text-sm | normal | muted | — |
| **Caption** | text-xs | medium | muted | uppercase tracking-wider |
| **Button** | text-base | semibold | primary-foreground | — |
| **Label** | text-sm | medium | foreground | — |
| **Input** | text-base | normal | foreground | placeholder:text-muted |
| **Nav Label** | 10px | medium | muted/active | uppercase optional |

---

## 4. Spacing System

### 4.1 Base Unit (8px)

All spacing values are multiples of 8px. This creates visual rhythm and simplifies mental math.

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `--space-0` | 0 | 0 | Remove spacing |
| `--space-px` | 1px | 1 | Hairline borders |
| `--space-0.5` | 0.125rem | 2px | Tight gaps |
| `--space-1` | 0.25rem | 4px | Icon gaps |
| `--space-2` | 0.5rem | 8px | **Base unit** |
| `--space-3` | 0.75rem | 12px | Small gaps |
| `--space-4` | 1rem | 16px | Component padding |
| `--space-5` | 1.25rem | 20px | Medium gaps |
| `--space-6` | 1.5rem | 24px | Section padding |
| `--space-8` | 2rem | 32px | Large gaps |
| `--space-10` | 2.5rem | 40px | Section margins |
| `--space-12` | 3rem | 48px | XL spacing |
| `--space-16` | 4rem | 64px | Section breaks |
| `--space-20` | 5rem | 80px | Major sections |
| `--space-24` | 6rem | 96px | Hero spacing |

### 4.2 Spacing Patterns

| Context | Value | Example |
|---------|-------|---------|
| **Card padding** | 24px (space-6) | p-6 |
| **Card gap** | 16px (space-4) | gap-4 |
| **Button padding (H)** | 24px (space-6) | px-6 |
| **Button padding (V)** | 12px (space-3) | py-3 |
| **Input padding** | 16px (space-4) | px-4 |
| **Icon size (sm)** | 16px | w-4 h-4 |
| **Icon size (md)** | 20px | w-5 h-5 |
| **Icon size (lg)** | 24px | w-6 h-6 |
| **Section gap** | 32px (space-8) | gap-8 |
| **Page padding (mobile)** | 16px (space-4) | px-4 |
| **Page padding (desktop)** | 24px (space-6) | px-6 |

### 4.3 Touch Target Guidelines

| Element | Minimum Size |
|---------|--------------|
| **Buttons** | 44×44px |
| **Nav items** | 44×44px |
| **Form inputs** | 48px height |
| **Checkbox/Radio** | 24×24px |
| **Toggle** | 48×24px |

---

## 5. Border Radius

### 5.1 Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-none` | 0 | Square elements (rare) |
| `--radius-sm` | 0.25rem (4px) | Small tags, badges |
| `--radius-md` | 0.375rem (6px) | Compact elements |
| `--radius-lg` | 0.5rem (8px) | Default buttons, inputs |
| `--radius-xl` | 0.75rem (12px) | Cards, modals |
| `--radius-2xl` | 1rem (16px) | Large cards, glass panels |
| `--radius-3xl` | 1.5rem (24px) | Feature cards, containers |
| `--radius-full` | 9999px | Pills, avatars, badges |

### 5.2 Radius by Component

| Component | Radius | Token |
|-----------|--------|-------|
| **Buttons (default)** | 12px | rounded-xl |
| **Buttons (small)** | 8px | rounded-lg |
| **Buttons (pill)** | full | rounded-full |
| **Cards** | 16px | rounded-2xl |
| **Glass containers** | 24px | rounded-3xl |
| **Inputs** | 12px | rounded-xl |
| **Modals/Sheets** | 16px | rounded-2xl |
| **Badges** | full | rounded-full |
| **Avatars** | full | rounded-full |
| **Images in cards** | 12px | rounded-xl |

---

## 6. Shadows & Elevation

### 6.1 Shadow Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-none` | none | Flat elements |
| `--shadow-sm` | `0 1px 2px 0 rgba(0,0,0,0.05)` | Subtle elevation |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)` | Cards |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)` | Elevated cards |
| `--shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-2xl` | `0 25px 50px -12px rgba(0,0,0,0.25)` | Maximum elevation |
| `--shadow-glass` | `0 8px 32px 0 rgba(31, 38, 135, 0.05)` | Glass panels |
| `--shadow-colored` | `0 10px 15px -3px rgba(59,130,246,0.2)` | Primary buttons |

### 6.2 Elevation Levels

| Level | Use Case | Shadow + Z-Index |
|-------|----------|------------------|
| **0** | Base content | none, z-0 |
| **1** | Cards | shadow-md, z-10 |
| **2** | Elevated cards, sticky headers | shadow-lg, z-20 |
| **3** | Dropdowns, popovers | shadow-xl, z-30 |
| **4** | Modals, sheets | shadow-2xl, z-40 |
| **5** | Notifications, toasts | shadow-2xl, z-50 |

---

## 7. Glassmorphism System

> **Our signature visual language.** Glassmorphism creates layered depth through frosted translucency, turning flat interfaces into spatial experiences. Every glass surface should feel like looking through premium frosted crystal — purposeful, not decorative.

### 7.1 Blur Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--blur-none` | 0 | No blur |
| `--blur-sm` | 4px | Subtle background softening |
| `--blur-md` | 12px | **Standard glass effect** |
| `--blur-lg` | 16px | **Premium glass, navbars** |
| `--blur-xl` | 24px | Maximum depth, modals |
| `--blur-2xl` | 40px | Hero panels, full-screen overlays |

### 7.2 Glass Tiers

Glass is applied in three tiers to establish visual hierarchy. Higher tiers have more blur and opacity, creating depth.

| Tier | Name | Blur | BG Opacity | Border | Use Case |
|------|------|------|------------|--------|----------|
| **1** | Subtle Glass | 4–8px | 5–15% | white/5 | Background panels, page sections |
| **2** | Standard Glass | 12–16px | 15–65% | white/15 | Cards, navigation, toolbars |
| **3** | Premium Glass | 16–24px | 65–85% | white/20 | Modals, sheets, focused overlays |

```
Visual Hierarchy (front → back):
┌──────────────────────────────┐
│  Tier 3: Modal (blur-xl)     │  ← Most opaque, highest blur
│  ┌────────────────────────┐  │
│  │ Tier 2: Card (blur-lg) │  │  ← Standard depth
│  │  ┌──────────────────┐  │  │
│  │  │ Tier 1: Section  │  │  │  ← Subtle, background
│  │  │  (blur-sm)       │  │  │
│  │  └──────────────────┘  │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
  Background (gradient/image)       ← Vibrant content behind glass
```

### 7.3 Glass Specifications

#### Dark Glass (Primary — Default for this PWA)

```css
.glass-dark {
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.15);
}
```

#### Light Glass (For light-mode contexts)

```css
.glass-light {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.5);
}
```

#### Tinted Glass (Blue-tinted — for branded panels)

```css
.glass-tinted {
  background: rgba(37, 99, 235, 0.08);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(59, 130, 246, 0.15);
}
```

#### Glass Card

```css
.glass-card {
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 1rem; /* 16px */
  box-shadow:
    0 8px 32px 0 rgba(31, 38, 135, 0.05),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
}
```

#### Glass Container

```css
.glass-container {
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 1.5rem; /* 24px */
}
```

#### Glass Input

```css
.glass-input {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem; /* 12px */
  color: rgba(248, 250, 252, 1);
  transition: border-color 200ms ease-in-out, background 200ms ease-in-out;
}
.glass-input:focus {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(59, 130, 246, 0.5);
  outline: none;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}
.glass-input::placeholder {
  color: rgba(148, 163, 184, 0.6);
}
```

#### Glass Button

```css
.glass-btn {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.75rem;
  color: white;
  transition: all 200ms ease-in-out;
}
.glass-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}
.glass-btn:active {
  background: rgba(255, 255, 255, 0.12);
  transform: scale(0.97);
}
```

#### Glass Navigation Bar

```css
.glass-nav {
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
}
```

#### Glass Modal / Bottom Sheet

```css
.glass-modal {
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 1.5rem;
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
}
```

### 7.4 Glass Interaction States

All glass elements must provide clear visual feedback on interaction:

| State | Background Change | Border Change | Additional |
|-------|-------------------|---------------|------------|
| **Default** | base opacity | base opacity | — |
| **Hover** | +5–8% opacity | +10% opacity | Subtle shadow lift |
| **Active/Pressed** | +3% opacity | unchanged | scale(0.97) |
| **Focus** | unchanged | blue-500/50 border | 2px blue ring with offset |
| **Disabled** | 50% overall opacity | 50% overall opacity | cursor: not-allowed |

```css
/* Hover glow — subtle light refraction effect */
.glass-hover-glow:hover {
  box-shadow:
    0 8px 32px rgba(59, 130, 246, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}
```

### 7.5 Glass + Gradient Backgrounds

Glass requires a **vibrant background** behind it to be effective. Use these gradient backgrounds on parent containers:

```css
/* Primary page background — provides depth for glass */
.glass-bg-primary {
  background:
    radial-gradient(ellipse at 20% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(37, 99, 235, 0.1) 0%, transparent 50%),
    linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
}

/* Dashboard background — subtle blue glow regions */
.glass-bg-dashboard {
  background:
    radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.12) 0%, transparent 40%),
    radial-gradient(circle at 75% 75%, rgba(37, 99, 235, 0.08) 0%, transparent 40%),
    #0f172a;
}

/* Minimal — for pages with many cards (less visual noise) */
.glass-bg-minimal {
  background: linear-gradient(180deg, #0f172a 0%, #111827 50%, #0f172a 100%);
}
```

### 7.6 Inner Light Effect

A signature glass detail: a subtle top-edge highlight simulating light refraction.

```css
/* Apply to any glass element for premium feel */
.glass-inner-light {
  position: relative;
}
.glass-inner-light::before {
  content: '';
  position: absolute;
  top: 0;
  left: 5%;
  right: 5%;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.15) 20%,
    rgba(255, 255, 255, 0.25) 50%,
    rgba(255, 255, 255, 0.15) 80%,
    transparent 100%
  );
  border-radius: inherit;
  pointer-events: none;
}
```

### 7.7 Glass Usage Guidelines

| Context | Blur | BG Opacity | Border | Saturate | Radius |
|---------|------|-----------|--------|----------|--------|
| **Bottom navigation** | 20px | 85% (dark) | white/8 top | 180% | 0 |
| **Cards (dark)** | 16px | 65% (dark) | white/15 | 180% | 16px |
| **Cards (light)** | 12px | 70% (white) | white/50 | 150% | 16px |
| **Cards (tinted)** | 16px | 8% (blue) | blue/15 | 180% | 16px |
| **Inputs** | 8px | 5% (white) | white/10 | — | 12px |
| **Buttons** | 12px | 10% (white) | white/20 | — | 12px |
| **Modals/Sheets** | 24px | 85% (dark) | white/12 | 180% | 24px |
| **Overlays/Backdrops** | 12px | 50% (dark) | none | — | 0 |
| **Tooltips** | 16px | 80% (dark) | white/10 | 180% | 12px |
| **Floating headers** | 16px | 75% (dark) | white/10 | 180% | 16px |

### 7.8 Glass Do's and Don'ts

```
DO:
- Always use backdrop-filter AND -webkit-backdrop-filter (Safari support)
- Always add saturate(150-180%) alongside blur for vibrancy
- Place glass over gradient or image backgrounds for visible effect
- Use inset top-border highlight (inner-light) on premium cards
- Test glass visibility with different background colors/images
- Provide fallback background for browsers without backdrop-filter support
- Keep glass layers to maximum 3 deep (performance)

DON'T:
- Stack more than 3 glass layers (compounding blur kills performance)
- Use glass over flat solid backgrounds (effect invisible, wasted GPU)
- Mix dark glass and light glass in the same viewport
- Use glass with opacity below 5% for backgrounds (imperceptible)
- Rely on glass border alone for element boundaries (add shadow too)
- Apply blur above 24px on mobile (GPU-intensive, drains battery)
- Forget focus states — glass elements must have visible focus rings
```

### 7.9 Glass Performance Guidelines

Glassmorphism uses GPU-composited `backdrop-filter`. Follow these rules to maintain 60fps on mobile:

| Rule | Guideline |
|------|-----------|
| **Max stacked layers** | 3 glass layers max in any viewport |
| **Blur ceiling (mobile)** | 24px max; prefer 16px for cards |
| **Blur ceiling (desktop)** | 40px max for hero/full-screen panels |
| **Avoid on scroll** | Do not add glass to rapidly scrolling list items |
| **Fixed glass** | Navigation bars and headers with glass should use `position: fixed` or `sticky` (avoids recompositing) |
| **Fallback** | Always define a solid `background-color` fallback for `@supports not (backdrop-filter: blur(1px))` |
| **Will-change** | Use `will-change: backdrop-filter` on elements that animate glass properties |
| **Saturate** | `saturate(180%)` is free alongside blur — always include it |

```css
/* Fallback for browsers without backdrop-filter */
@supports not (backdrop-filter: blur(1px)) {
  .glass-dark {
    background: rgba(15, 23, 42, 0.92);
  }
  .glass-light {
    background: rgba(255, 255, 255, 0.92);
  }
  .glass-card {
    background: rgba(15, 23, 42, 0.92);
  }
}
```

### 7.10 Glass Accessibility

| Concern | Rule |
|---------|------|
| **Text contrast** | All text on glass must meet WCAG 4.5:1 minimum. Test against both the glass BG and any content visible through it. |
| **Border visibility** | Glass borders alone are insufficient. Combine with shadow or ensure 3:1 contrast against adjacent surfaces. |
| **Focus rings** | Glass elements must show a visible focus ring (2px solid blue-500 with 2px offset). Do not rely on glass border change alone. |
| **Reduced motion** | Glass shimmer/animation effects must respect `prefers-reduced-motion`. Blur itself is static and acceptable. |
| **High contrast mode** | In `forced-colors` / high contrast, glass degrades to solid background with visible borders. |

```css
/* High contrast fallback */
@media (forced-colors: active) {
  .glass-dark,
  .glass-light,
  .glass-card,
  .glass-container {
    background: Canvas;
    border: 2px solid CanvasText;
    backdrop-filter: none;
  }
}
```

### 7.11 Glass Tokens (CSS Custom Properties)

```css
:root {
  /* Glass backgrounds */
  --glass-bg-dark: rgba(15, 23, 42, 0.65);
  --glass-bg-dark-heavy: rgba(15, 23, 42, 0.85);
  --glass-bg-light: rgba(255, 255, 255, 0.7);
  --glass-bg-tinted: rgba(37, 99, 235, 0.08);
  --glass-bg-input: rgba(255, 255, 255, 0.05);
  --glass-bg-btn: rgba(255, 255, 255, 0.1);

  /* Glass borders */
  --glass-border-subtle: rgba(255, 255, 255, 0.08);
  --glass-border-default: rgba(255, 255, 255, 0.15);
  --glass-border-strong: rgba(255, 255, 255, 0.25);
  --glass-border-light: rgba(255, 255, 255, 0.5);
  --glass-border-tinted: rgba(59, 130, 246, 0.15);

  /* Glass blur */
  --glass-blur-sm: 4px;
  --glass-blur-md: 12px;
  --glass-blur-lg: 16px;
  --glass-blur-xl: 24px;
  --glass-blur-nav: 20px;

  /* Glass shadows */
  --glass-shadow-sm: 0 4px 16px rgba(0, 0, 0, 0.08);
  --glass-shadow-md: 0 8px 32px rgba(31, 38, 135, 0.05);
  --glass-shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.12);
  --glass-shadow-glow: 0 8px 32px rgba(59, 130, 246, 0.08);
}
```

---

## 8. Opacity Scale

### 8.1 Standard Opacity Values

| Token | Value | Usage |
|-------|-------|-------|
| `--opacity-0` | 0 | Hidden |
| `--opacity-5` | 0.05 | Subtle backgrounds |
| `--opacity-10` | 0.1 | Hover states |
| `--opacity-15` | 0.15 | Glass borders |
| `--opacity-20` | 0.2 | Secondary borders |
| `--opacity-25` | 0.25 | Light glass bg |
| `--opacity-30` | 0.3 | Disabled states |
| `--opacity-40` | 0.4 | Placeholders |
| `--opacity-50` | 0.5 | Muted content |
| `--opacity-60` | 0.6 | Secondary text |
| `--opacity-70` | 0.7 | Light glass bg |
| `--opacity-75` | 0.75 | Backdrops |
| `--opacity-80` | 0.8 | Loading states |
| `--opacity-90` | 0.9 | Near-opaque |
| `--opacity-100` | 1 | Fully opaque |

### 8.2 Opacity Patterns

| Element | Opacity |
|---------|---------|
| **Disabled buttons** | 50% |
| **Placeholder text** | 50% |
| **Glass borders (dark)** | 15% |
| **Glass borders (light)** | 50% |
| **Hover overlays** | 10% |
| **Backdrop overlays** | 50-75% |
| **Loading skeletons** | 50% |
| **Noise texture** | 3% |

---

## 9. Animation & Motion

### 9.1 Duration Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-instant` | 0ms | Immediate |
| `--duration-fast` | 100ms | Micro-interactions |
| `--duration-normal` | 200ms | **Standard transitions** |
| `--duration-slow` | 300ms | Page transitions |
| `--duration-slower` | 400ms | Complex animations |
| `--duration-slowest` | 500ms | Emphasis animations |

### 9.2 Easing Functions

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-linear` | linear | Continuous animations |
| `--ease-in` | cubic-bezier(0.4, 0, 1, 1) | Exit animations |
| `--ease-out` | cubic-bezier(0, 0, 0.2, 1) | **Enter animations** |
| `--ease-in-out` | cubic-bezier(0.4, 0, 0.2, 1) | **Standard transitions** |
| `--ease-bounce` | cubic-bezier(0.68, -0.6, 0.32, 1.6) | Playful interactions |
| `--ease-spring` | cubic-bezier(0.175, 0.885, 0.32, 1.275) | **Icon bounces, buttons** |

### 9.3 Animation Patterns

| Animation | Duration | Easing | Properties |
|-----------|----------|--------|------------|
| **Button hover** | 200ms | ease-in-out | background-color, transform |
| **Button active** | 100ms | ease-out | transform: scale(0.95) |
| **Card hover** | 300ms | ease-out | transform: translateY(-4px) |
| **Modal enter** | 300ms | ease-out | opacity, transform |
| **Modal exit** | 200ms | ease-in | opacity, transform |
| **Page transition** | 300ms | ease-out | opacity, transform |
| **Toast enter** | 400ms | spring | transform, opacity |
| **Skeleton pulse** | 2000ms | ease-in-out | opacity (infinite) |
| **Accordion** | 200ms | ease-out | height |
| **Tab switch** | 200ms | ease-in-out | opacity, transform |

### 9.4 Keyframe Definitions

```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes slide-down {
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes scale-in {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

@keyframes pulse-ring {
  0% { transform: scale(0.95); opacity: 1; }
  100% { transform: scale(1.05); opacity: 0; }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### 9.5 Reduced Motion

Always respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 10. Z-Index Scale

### 10.1 Z-Index Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--z-0` | 0 | Base layer |
| `--z-10` | 10 | Elevated content |
| `--z-20` | 20 | Sticky elements |
| `--z-30` | 30 | Dropdowns |
| `--z-40` | 40 | Backdrops |
| `--z-50` | 50 | Modals, navigation |
| `--z-auto` | auto | Natural stacking |

### 10.2 Z-Index by Component

| Component | Z-Index |
|-----------|---------|
| **Page content** | 0 |
| **Sticky header** | 20 |
| **Backdrop overlay** | 40 |
| **Modal/Sheet** | 50 |
| **Navigation (mobile)** | 50 |
| **Toast notifications** | 50 |
| **Tooltip** | 30 |
| **Dropdown menu** | 30 |
| **Floating action button** | 20 |

---

## 11. Component Specifications

### 11.1 Button Specifications

| Variant | Background | Text | Border | Shadow | Radius | Height | Padding |
|---------|------------|------|--------|--------|--------|--------|---------|
| **Primary** | blue-600 | white | none | shadow-lg shadow-blue-500/20 | 12px | 48px | 12px 24px |
| **Secondary** | slate-100 | slate-900 | none | none | 12px | 48px | 12px 24px |
| **Outline** | transparent | slate-900 | 2px slate-200 | none | 12px | 48px | 12px 24px |
| **Ghost** | transparent | current | none | none | 12px | 48px | 12px 24px |
| **Destructive** | red-500 | white | none | none | 12px | 48px | 12px 24px |
| **Glass** | white/10 + blur(12px) | white | 1px white/20 | none | 12px | 48px | 12px 24px |
| **Glass Primary** | blue-600/20 + blur(12px) | white | 1px blue-400/30 | glass-shadow-glow | 12px | 48px | 12px 24px |
| **Small** | (inherited) | (inherited) | (inherited) | (inherited) | 8px | 40px | 8px 16px |
| **Large** | (inherited) | (inherited) | (inherited) | (inherited) | 16px | 56px | 12px 40px |
| **Icon** | (inherited) | (inherited) | (inherited) | (inherited) | 12px | 48px | 12px |

### 11.2 Input Specifications

| Property | Value |
|----------|-------|
| **Height** | 48px (h-12) |
| **Padding** | 16px horizontal (px-4) |
| **Border** | 1px solid slate-300 |
| **Border radius** | 12px (rounded-xl) |
| **Background** | white / transparent |
| **Font size** | 16px (text-base) |
| **Placeholder** | slate-400 |
| **Focus ring** | 2px blue-500, offset 2px |
| **Disabled opacity** | 50% |

### 11.3 Card Specifications

#### Standard Card

| Property | Value |
|----------|-------|
| **Background** | white (light) / slate-900 (dark) |
| **Border** | 1px solid slate-200 (light) / slate-800 (dark) |
| **Border radius** | 16px (rounded-2xl) |
| **Padding** | 24px (p-6) |
| **Shadow** | shadow-sm |
| **Gap (internal)** | 16px (gap-4) |

#### Glass Card (Preferred for dashboard, detail views)

| Property | Value |
|----------|-------|
| **Background** | rgba(15, 23, 42, 0.65) + blur(16px) saturate(180%) |
| **Border** | 1px solid white/15 |
| **Border radius** | 16px (rounded-2xl) |
| **Padding** | 24px (p-6) |
| **Shadow** | glass-shadow-md + inset top highlight |
| **Gap (internal)** | 16px (gap-4) |
| **Hover** | bg opacity +5%, border white/25, shadow lift |
| **Inner light** | 1px top gradient (see 7.6) |

#### Glass Card (Tinted — for active/selected states)

| Property | Value |
|----------|-------|
| **Background** | rgba(37, 99, 235, 0.08) + blur(16px) saturate(180%) |
| **Border** | 1px solid blue-500/15 |
| **Border radius** | 16px (rounded-2xl) |
| **Padding** | 24px (p-6) |
| **Shadow** | glass-shadow-glow |

### 11.4 Navigation Specifications (Glass Navigation)

| Property | Value |
|----------|-------|
| **Height** | 64px (h-16) |
| **Background** | rgba(15, 23, 42, 0.85) + blur(20px) saturate(180%) |
| **Border** | 1px solid white/8 (top) |
| **Shadow** | 0 -4px 24px rgba(0, 0, 0, 0.15) |
| **Icon size** | 20px (w-5 h-5) |
| **Label size** | 10px |
| **Active color** | blue-400 |
| **Inactive color** | slate-400 |
| **Active indicator** | blue-400 dot (6px) or bar below icon |

### 11.5 Badge Specifications

| Variant | Background | Text | Border radius |
|---------|------------|------|---------------|
| **Default** | blue-600 | white | full |
| **Secondary** | slate-100 | slate-900 | full |
| **Success** | green-500 | white | full |
| **Warning** | yellow-500 | white | full |
| **Destructive** | red-500 | white | full |
| **Outline** | transparent | foreground | full + border |

---

## 12. Implementation Reference

### 12.1 Tailwind Config Reference

```typescript
// tailwind.config.ts
const config = {
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
};
```

### 12.2 CSS Variables Reference

```css
:root {
  /* Colors */
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;
  --card: 222 47% 11%;
  --card-foreground: 210 40% 98%;
  --popover: 222 47% 11%;
  --popover-foreground: 210 40% 98%;
  --primary: 217 91% 60%;
  --primary-foreground: 222 47% 11%;
  --secondary: 217 33% 17%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217 33% 17%;
  --muted-foreground: 215 20% 65%;
  --accent: 217 33% 17%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 63% 31%;
  --destructive-foreground: 210 40% 98%;
  --border: 217 33% 17%;
  --input: 217 33% 17%;
  --ring: 224 64% 33%;
  --radius: 0.5rem;

  /* Glassmorphism Backgrounds */
  --glass-bg: rgba(15, 23, 42, 0.65);
  --glass-bg-heavy: rgba(15, 23, 42, 0.85);
  --glass-bg-light: rgba(255, 255, 255, 0.7);
  --glass-bg-tinted: rgba(37, 99, 235, 0.08);
  --glass-bg-input: rgba(255, 255, 255, 0.05);
  --glass-bg-btn: rgba(255, 255, 255, 0.1);

  /* Glassmorphism Borders */
  --glass-border: rgba(255, 255, 255, 0.15);
  --glass-border-subtle: rgba(255, 255, 255, 0.08);
  --glass-border-strong: rgba(255, 255, 255, 0.25);
  --glass-border-light: rgba(255, 255, 255, 0.5);
  --glass-border-tinted: rgba(59, 130, 246, 0.15);

  /* Glassmorphism Shadows */
  --glass-shadow-sm: 0 4px 16px rgba(0, 0, 0, 0.08);
  --glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.05);
  --glass-shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.12);
  --glass-shadow-glow: 0 8px 32px rgba(59, 130, 246, 0.08);

  /* Animation */
  --transition-fast: 100ms;
  --transition-normal: 200ms;
  --transition-slow: 300ms;
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
```

### 12.3 Utility Classes

```css
@layer utilities {
  /* ── Glass Base Utilities ── */
  .glass {
    @apply backdrop-blur-[16px] backdrop-saturate-[180%] border;
    background: var(--glass-bg);
    border-color: var(--glass-border);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
  }

  .glass-light {
    @apply backdrop-blur-[12px] backdrop-saturate-[150%] border;
    background: var(--glass-bg-light);
    border-color: var(--glass-border-light);
    -webkit-backdrop-filter: blur(12px) saturate(150%);
  }

  .glass-tinted {
    @apply backdrop-blur-[16px] backdrop-saturate-[180%] border;
    background: var(--glass-bg-tinted);
    border-color: var(--glass-border-tinted);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
  }

  /* ── Glass Component Utilities ── */
  .glass-card {
    @apply rounded-2xl glass;
    box-shadow: var(--glass-shadow),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
  }

  .glass-card-tinted {
    @apply rounded-2xl glass-tinted;
    box-shadow: var(--glass-shadow-glow);
  }

  .glass-container {
    @apply rounded-3xl glass;
  }

  .glass-input {
    @apply backdrop-blur-[8px] rounded-xl border text-white/90;
    background: var(--glass-bg-input);
    border-color: rgba(255, 255, 255, 0.1);
    -webkit-backdrop-filter: blur(8px);
    transition: border-color 200ms ease-in-out, background 200ms ease-in-out;
  }
  .glass-input:focus {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    outline: none;
  }
  .glass-input::placeholder {
    color: rgba(148, 163, 184, 0.6);
  }

  .glass-btn {
    @apply backdrop-blur-[12px] rounded-xl border text-white cursor-pointer;
    background: var(--glass-bg-btn);
    border-color: rgba(255, 255, 255, 0.2);
    -webkit-backdrop-filter: blur(12px);
    transition: all 200ms ease-in-out;
  }
  .glass-btn:hover {
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }
  .glass-btn:active {
    transform: scale(0.97);
  }

  .glass-nav {
    @apply backdrop-blur-[20px] backdrop-saturate-[180%];
    background: var(--glass-bg-heavy);
    border-top: 1px solid var(--glass-border-subtle);
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
  }

  .glass-modal {
    @apply backdrop-blur-[24px] backdrop-saturate-[180%] rounded-3xl border;
    background: var(--glass-bg-heavy);
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
  }

  /* ── Glass Effect Utilities ── */
  .glass-inner-light {
    position: relative;
  }
  .glass-inner-light::before {
    content: '';
    position: absolute;
    top: 0;
    left: 5%;
    right: 5%;
    height: 1px;
    background: linear-gradient(
      90deg, transparent 0%, rgba(255,255,255,0.15) 20%,
      rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 80%, transparent 100%
    );
    border-radius: inherit;
    pointer-events: none;
  }

  .glass-hover-glow:hover {
    box-shadow: 0 8px 32px rgba(59, 130, 246, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  /* ── Glass Background Utilities ── */
  .glass-bg-primary {
    background:
      radial-gradient(ellipse at 20% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 20%, rgba(37, 99, 235, 0.1) 0%, transparent 50%),
      linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
  }

  .glass-bg-dashboard {
    background:
      radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.12) 0%, transparent 40%),
      radial-gradient(circle at 75% 75%, rgba(37, 99, 235, 0.08) 0%, transparent 40%),
      #0f172a;
  }

  .glass-bg-minimal {
    background: linear-gradient(180deg, #0f172a 0%, #111827 50%, #0f172a 100%);
  }

  /* ── Mobile / Touch Utilities ── */
  .touch-manipulation {
    touch-action: manipulation;
  }

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
}

/* ── Glass Fallbacks ── */
@supports not (backdrop-filter: blur(1px)) {
  .glass { background: rgba(15, 23, 42, 0.92); }
  .glass-light { background: rgba(255, 255, 255, 0.92); }
  .glass-card { background: rgba(15, 23, 42, 0.92); }
  .glass-nav { background: rgba(15, 23, 42, 0.95); }
  .glass-modal { background: rgba(15, 23, 42, 0.95); }
}

/* ── Accessibility: High Contrast ── */
@media (forced-colors: active) {
  .glass, .glass-light, .glass-tinted,
  .glass-card, .glass-container, .glass-nav, .glass-modal {
    background: Canvas;
    border: 2px solid CanvasText;
    backdrop-filter: none;
  }
}
```

---

## 13. Usage Examples

### 13.1 Glass Card (Standard)

```tsx
// Glass card — preferred for dashboard views
<div className="glass-card glass-inner-light p-6">
  <h3 className="text-xl font-bold tracking-tight text-white">Card Title</h3>
  <p className="text-sm text-slate-400 mt-2">Card description</p>
</div>

// Tinted glass card — for selected/active states
<div className="glass-card-tinted glass-inner-light p-6">
  <h3 className="text-xl font-bold tracking-tight text-white">Active Card</h3>
  <p className="text-sm text-blue-300 mt-2">Selected state</p>
</div>

// Solid card (fallback for simple lists)
<div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
  <h3 className="text-xl font-bold tracking-tight">Card Title</h3>
  <p className="text-sm text-slate-400 mt-2">Card description</p>
</div>
```

### 13.2 Glass Page Layout

```tsx
// Page with gradient background + glass cards
<div className="glass-bg-dashboard min-h-screen">
  {/* Floating glass header */}
  <header className="glass-nav fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-4">
    <h1 className="text-lg font-semibold text-white">Dashboard</h1>
  </header>

  {/* Content with glass cards */}
  <main className="pt-20 px-4 pb-24 space-y-4">
    <div className="glass-card glass-inner-light glass-hover-glow p-6 cursor-pointer transition-all duration-200">
      <h3 className="text-lg font-semibold text-white">Today's Jobs</h3>
      <p className="text-3xl font-bold text-blue-400 mt-2">5</p>
    </div>
  </main>

  {/* Glass bottom navigation */}
  <nav className="glass-nav fixed bottom-0 left-0 right-0 z-50 h-16 flex items-center justify-around">
    {/* nav items */}
  </nav>
</div>
```

### 13.3 Glass Form Elements

```tsx
// Glass input field
<input
  className="glass-input h-12 w-full px-4 text-base"
  placeholder="Search clients..."
/>

// Glass button
<button className="glass-btn h-12 px-6 font-semibold">
  Cancel
</button>

// Primary button (solid — for main CTAs)
<button className="h-12 px-6 rounded-xl bg-blue-600 text-white font-semibold shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all duration-200">
  Create Invoice
</button>
```

### 13.4 Glass Modal / Bottom Sheet

```tsx
// Backdrop
<div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />

// Glass modal
<div className="glass-modal fixed bottom-0 left-0 right-0 z-50 p-6 max-h-[90vh] overflow-y-auto">
  <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />
  <h2 className="text-xl font-bold text-white">Invoice Details</h2>
  {/* content */}
</div>
```

### 13.5 Spacing Example

```tsx
// Correct: Using 8px base system
<div className="space-y-6"> {/* 24px between children */}
  <div className="p-6"> {/* 24px padding */}
    <div className="gap-4"> {/* 16px between flex children */}
      <Icon className="w-5 h-5" /> {/* 20px icon */}
      <span className="text-sm">Label</span>
    </div>
  </div>
</div>
```

---

## 16. Premium Interaction Principles

> **Same component, different feeling.** A cheap component just appears; a premium component springs to life with overshoot. The three secrets are **entrance and exit**, **backdrop in depth**, and **the tiny details inside**. This section codifies the rules that separate "works" from "feels expensive".

### 16.1 The 60/30/10 Color Rule

Every page, every component, every screen must obey the 60/30/10 split. Three numbers, zero guesswork.

| Role | Weight | Token (dark default) | What it is |
|------|--------|----------------------|------------|
| **Dominant** | 60% | `#0f172a` (slate-900) + `glass-bg-primary` gradient | Page background. Sets the tone. The reader's eye sees this first and everywhere. |
| **Secondary** | 30% | `#1e293b` (slate-800) / `glass-card` (slate-900/65 + blur) | Cards, nav, containers, toolbars. Same hue as dominant, slightly lighter, holding content. |
| **Accent** | 10% | `#2563eb` (blue-600) / `#3b82f6` (blue-500) | Only for primary CTAs and key actions — never body text, never decoration. Scarcity is what makes accent feel like "do this now". |

**Enforcement rules:**

```
DO:
- Use exactly ONE accent color per viewport (blue-600 for CTAs, blue-400 for active state icons)
- Keep secondary surfaces within one lightness step of dominant (never jump contrast)
- If a page has more than two blue-600 elements visible at once, promote one to secondary (blue-400/20) and reserve blue-600 for the primary action
- Audit every page against 60/30/10 when reviewing — percentages estimated visually, not measured

DON'T:
- Introduce a second accent hue (orange, purple, pink) — even for "just one button"
- Use accent color for icons, borders, or decoration — accent is for action
- Let secondary surfaces drift into accent territory (e.g. blue-500 container)
- Use pure black (#000) or pure white (#fff) — they break the monochrome identity
```

### 16.2 Modal — The Three Secrets

> A cheap modal just appears. A premium modal springs to life with overshoot, stages its content, and exits gracefully.

**Three secrets:**
1. **Entrance and exit** — spring overshoot in, smooth scale-fade out. Never flat opacity toggles.
2. **Backdrop in depth** — blur the background (`backdrop-blur-md` + `bg-slate-950/60`). Never a flat dark sheet.
3. **The tiny details inside** — content staggers in (150ms between children), close button responds, CTAs glow on hover and bounce on press.

**Entrance (spring, overshoot):**

```ts
// Framer Motion spring config — used by <Dialog> primitive
const modalSpring = {
  type: "spring",
  damping: 22,       // low damping = overshoot
  stiffness: 320,    // high stiffness = snappy arrival
  mass: 0.8,         // slightly light = playful but not cartoonish
};

<motion.div
  initial={{ opacity: 0, scale: 0.94, y: 12 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.96, y: 4 }}
  transition={modalSpring}
/>
```

**Exit (smooth, no spring):**

```ts
// Exit uses ease-out, not spring — a modal closing should feel resolved, not bouncy
transition={{ duration: 0.18, ease: [0.4, 0, 1, 1] }}
```

**Backdrop:**

```tsx
<DialogOverlay className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-md" />
```

**Staggered content (children of the modal body reveal in sequence):**

```tsx
const stagger = {
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: "spring", damping: 24, stiffness: 300 } },
};

<motion.div variants={stagger} initial="hidden" animate="show">
  <motion.h2 variants={item}>Title</motion.h2>
  <motion.p variants={item}>Description</motion.p>
  <motion.div variants={item}>Form fields</motion.div>
  <motion.div variants={item}>Actions</motion.div>
</motion.div>
```

**Responsive buttons inside the modal** — every pixel reacts:

| Element | Default | Hover | Press |
|---------|---------|-------|-------|
| **Primary CTA** | `bg-blue-600` | `bg-blue-700` + `shadow-blue-500/30` glow + `translate-y-[-1px]` | `scale-[0.96]` with spring rebound |
| **Destructive** | `bg-red-500` | `bg-red-600` + `shadow-red-500/30` glow | `scale-[0.96]` with spring rebound |
| **Ghost / Close (X)** | `text-slate-400` | `bg-white/10 rounded-full text-white` | `scale-[0.92]` |

### 16.3 Skeleton Psychology — Anticipation, Not Waiting

> Your brain hates waiting, but it loves predicting. A spinner says "wait"; a skeleton says "here's what's coming." That preview turns anxiety into anticipation.

**Rules:**

1. **Shape-matched** — Never use a generic rectangle. Circles for avatars, short lines for names, long lines for paragraphs, a rounded rectangle for media. The closer the skeleton matches the final content, the faster the app feels.
2. **Directional shimmer** — Shimmer must travel **left to right** in LTR locales (reading direction). Reversing it feels off.
3. **Instant optimistic UI** — When a user clicks, show the result **immediately**, before the server confirms. If the server rolls back, animate the UI back to its previous state with an error toast. The lie is worth it — it feels honest.
4. **Never use spinners on content** — Spinners are reserved for (a) full-page initial load and (b) inline button loading states on mutations. Everything else (lists, cards, detail views) must use skeletons.

**Skeleton primitives (see `components/ui/skeleton.tsx`):**

```tsx
// Shape-matched building blocks
<SkeletonLine width="60%" />          // short line — names, titles
<SkeletonLine width="100%" />         // long line — paragraphs
<SkeletonCircle size={40} />          // avatars
<SkeletonBlock aspect="video" />      // images, media

// Content-shaped compounds
<SkeletonCard />                      // card header + 2 lines + action
<SkeletonListRow />                   // avatar + name + timestamp (chat/activity)
<SkeletonStat />                      // label + number (dashboard stats)
```

**Shimmer token:**

```css
/* Directional shimmer gradient — LTR, 2s loop */
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.05) 0%,
    rgba(255,255,255,0.12) 50%,
    rgba(255,255,255,0.05) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s linear infinite;
}
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### 16.4 Button Feedback — Every Pixel Reacts

> A cheap button has no feedback. A premium button glows on hover, bounces on press, and the close button responds too.

All interactive elements must satisfy these four gates:

| Gate | Rule | Implementation |
|------|------|----------------|
| **Hover response** | Every button must change on hover | bg shift + subtle lift (`translate-y-[-1px]`) + shadow glow on primary |
| **Press response** | Every button must spring-rebound on press | `whileTap={{ scale: 0.96 }}` with `{ type: "spring", damping: 15, stiffness: 400 }` |
| **Focus response** | Every button must show a visible focus ring | 2px blue-500 ring + 2px offset — never rely on the hover state alone |
| **Disabled response** | Disabled is not invisible — it has a state | 50% opacity + `cursor-not-allowed` + no hover/press reaction |

**Spring tokens (Framer Motion):**

```ts
export const spring = {
  press:  { type: "spring", damping: 15, stiffness: 400, mass: 0.5 }, // button tap rebound
  lift:   { type: "spring", damping: 22, stiffness: 320, mass: 0.8 }, // modal entrance
  settle: { type: "spring", damping: 28, stiffness: 260, mass: 1.0 }, // card hover lift
  gentle: { type: "spring", damping: 35, stiffness: 180, mass: 1.2 }, // page transitions
};
```

### 16.5 Page Transitions

Every route change should feel continuous, not choppy.

- **Enter:** `opacity 0 → 1` + `translate-y [8 → 0]` with `spring.gentle` (360ms apparent duration)
- **Exit:** skip the exit animation on route change (Next.js unmounts immediately); use `AnimatePresence mode="wait"` only for modal-level transitions
- **Reduced motion:** respect `prefers-reduced-motion`. When set, fall back to a 100ms opacity fade and disable all springs.

```tsx
// components/page-transition.tsx
"use client";
import { motion } from "framer-motion";
import { spring } from "@/lib/motion";

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
    >
      {children}
    </motion.div>
  );
}
```

### 16.6 Framer Motion Usage Guidelines

1. **Prefer `motion.*` components** over `useAnimate` / imperative API — declarative is easier to review.
2. **Spring for entrances, ease-out for exits** — spring physics should *arrive*, not *leave*.
3. **Use shared spring tokens** from `@/lib/motion` — never hand-roll `{ type: "spring", damping: 17, ... }` inline.
4. **Use `layout` sparingly** — `layout` is expensive; reserve for list reordering, never for static cards.
5. **Wrap conditional renders in `AnimatePresence`** — otherwise exit animations are impossible.
6. **Never animate layout-thrashing properties** — only `transform`, `opacity`, `filter` are GPU-composited.
7. **Respect `prefers-reduced-motion`** — `useReducedMotion()` from framer-motion short-circuits animations; all new primitives must consume it.

### 16.7 Premium Interaction Checklist (per PR)

Before merging any UI change, verify:

- [ ] Obeys 60/30/10 — one accent, secondary within one step of dominant
- [ ] Padding uses 8px grid (p-2 / p-4 / p-6 / p-8) — never arbitrary values like `p-5` or `p-7`
- [ ] Border radius matches component spec (inputs/buttons `rounded-xl`, cards `rounded-2xl`, modals `rounded-3xl`)
- [ ] Every interactive element has hover + press + focus + disabled states
- [ ] No spinners on content — skeletons instead
- [ ] Modals use `<Dialog>` primitive (auto-inherits spring + backdrop blur)
- [ ] Buttons use `<Button>` primitive (auto-inherits press spring)
- [ ] Respects `prefers-reduced-motion`
- [ ] Glass surfaces stacked ≤ 3 deep

---

## 17. Motion Tokens (Shared)

Export a single source of truth for animation values. All primitives must import from `@/lib/motion` — never hand-code spring params.

```ts
// apps/web/src/lib/motion.ts
import type { Transition, Variants } from "framer-motion";

/** Shared spring physics — one source of truth for the whole app. */
export const spring = {
  /** Button tap rebound — snappy, playful. */
  press:  { type: "spring", damping: 15, stiffness: 400, mass: 0.5 } satisfies Transition,
  /** Modal entrance — noticeable overshoot. */
  lift:   { type: "spring", damping: 22, stiffness: 320, mass: 0.8 } satisfies Transition,
  /** Card hover lift — soft settle. */
  settle: { type: "spring", damping: 28, stiffness: 260, mass: 1.0 } satisfies Transition,
  /** Page transitions — gentle, barely visible. */
  gentle: { type: "spring", damping: 35, stiffness: 180, mass: 1.2 } satisfies Transition,
};

/** Exit transition — resolved, ease-out, no spring. */
export const exitEase: Transition = { duration: 0.18, ease: [0.4, 0, 1, 1] };

/** Stagger container + item — use with motion.* children. */
export const stagger: Variants = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: spring.lift },
};

/** Fade-only variants — for reduced-motion fallback. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};
```

---

## 14. Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-04-11 | 1.2 | Added Section 16 (Premium Interaction Principles) — 60/30/10 color rule, modal three-secrets (spring entrance, backdrop blur, staggered content), skeleton psychology (shape-matched + directional shimmer + optimistic UI), button feedback gates (hover/press/focus/disabled), page transition guidance, framer-motion usage guidelines, premium interaction PR checklist. Added Section 17 (Motion Tokens) codifying `spring.press / lift / settle / gentle` as the single source of truth for animation. |
| 2026-04-02 | 1.1 | Glassmorphism system overhaul — 3-tier glass hierarchy, tinted glass, glass inputs/buttons/nav/modal variants, interaction states, gradient backgrounds, inner-light effect, performance guidelines, accessibility fallbacks, expanded CSS tokens and utility classes, usage examples |
| 2026-04-02 | 1.0 | Initial design system — Color, Typography, Spacing, Radius, Shadow, Blur, Opacity, Animation, Z-Index, Component specs |

---

## 15. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-02 | Comprehensive glassmorphism as signature identity | ServiceSync targets premium mobile-first experience; glass creates depth hierarchy, distinguishes from flat competitors, and aligns with modern PWA aesthetics (VisionOS/iOS influence) |
| 2026-04-02 | 3-tier glass system (subtle/standard/premium) | Single glass spec was too rigid; tiers enable hierarchy — subtle for backgrounds, standard for cards, premium for modals |
| 2026-04-02 | saturate(180%) on all glass | Saturation boost makes colors behind glass vibrant instead of washed out; negligible perf cost alongside blur |
| 2026-04-02 | Tinted glass variant (blue) | Provides branded glass for active/selected states without introducing new hues; stays within monochromatic blue |
| 2026-04-02 | Glass fallbacks for @supports and forced-colors | PWA serves variable devices (technicians on budget phones); graceful degradation to solid backgrounds ensures usability |
| 2026-04-02 | Max 3 stacked glass layers | Testing showed >3 layers drops below 60fps on mid-range Android devices; enforced as hard rule |
| 2026-04-02 | 8px base spacing unit | Industry standard, divides evenly, creates visual rhythm |
| 2026-04-02 | Monochromatic blue palette | Professional, cohesive, reduces cognitive load |
| 2026-04-02 | 1.25 modular scale (Major Third) | Balanced hierarchy, web-friendly sizes |
| 2026-04-02 | 16px glass blur | Premium feel without performance issues |
| 2026-04-02 | 200ms standard transition | Snappy but perceptible |

---

> **For maintainers:** This document is a living specification. When adding new patterns, ensure they align with the 8px grid, monochromatic palette, glassmorphism system, and existing component specifications. All new components should default to glass variants where appropriate. Document any deviations in the Decision Log.
