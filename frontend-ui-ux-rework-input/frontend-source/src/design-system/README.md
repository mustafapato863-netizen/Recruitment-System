# Saudi German Health (SGH) Enterprise Design System

A bespoke, modular, and cross-platform design system engineered specifically for **Saudi German Health (SGH)** platforms, applications, and unified healthcare portals.

---

## 📁 Package Architecture

```
design-system/
├── package.json                        # Package metadata & sub-path exports
├── index.ts                            # Master entry point (exports everything)
├── README.md                           # Documentation & integration guide
│
├── tokens/                             # Foundational Design Tokens
│   ├── colors.ts                       # Official SGH Cyan (#00A3E0), Emerald (#00A859), and Semantics
│   ├── typography.ts                   # Font sizes, line-heights, tracking, font stacks
│   ├── gradients.ts                    # Dual-wing multi-stop gradient definitions (CSS & SVG)
│   ├── shadows.ts                      # Glowing halos, elevations, and glass depths
│   ├── animations.ts                   # Motion variants, spring configs, and transition curves
│   ├── sgh-tokens.css                  # Pure CSS custom properties & utility classes
│   └── index.ts
│
├── brand/                              # Official Brand Identity Components
│   ├── sgh-heart-svg.tsx               # 100% Pure Vector SVG Dual-Wing Heart Emblem
│   ├── sgh-logo.tsx                    # Multi-size responsive Logo & Lockups (xs, sm, md, lg, xl)
│   ├── sgh-animated-logo.tsx           # Floating interactive animated emblem with ambient halo
│   ├── sgh-animated-loader.tsx         # Splash typewriter loader with multi-stop progress bar
│   ├── assets/                         # Exportable vector SVGs & high-res transparent PNGs
│   │   ├── sgh-heart.svg
│   │   ├── sgh-heart.png
│   │   └── sgh-logo-full.png
│   └── index.ts
│
├── backgrounds/                        # Immersive Ambient & Interactive Background Effects
│   ├── thinking-dots.tsx               # Interactive / Ambient canvas particle grid effect
│   ├── ambient-gradient-background.tsx # Multi-layered radial glowing spotlight mesh
│   ├── glassmorphism.css               # Glass cards, dialog backdrops, and glowing borders
│   └── index.ts
│
├── components/                         # Core Brand-Aligned UI Components
│   ├── animated-border-card.tsx        # Rotating gradient border glass card
│   ├── sgh-badge.tsx                   # Semantic status badges (Cyan, Emerald, Success, Info, Warning, Error)
│   ├── sgh-button.tsx                  # Gradient primary, secondary, outline, ghost, and danger buttons
│   ├── sgh-alert.tsx                   # Glassmorphic alert banners with dismiss action
│   ├── sgh-input.tsx                   # Validated text input with micro-warning animations
│   ├── animated-list.tsx               # Motion-powered animated list with scroll masks
│   └── index.ts
│
└── tailwind/                           # Drop-in Tailwind Configuration
    ├── preset.js                       # Tailwind CSS preset (colors, gradients, halos, animations)
    └── index.ts
```

---

## 🎨 Official Brand Palette & Design Tokens

### Primary Identity
| Token | Hex / Spec | Usage |
|---|---|---|
| `brand.cyan.default` | `#00A3E0` | Primary brand identity, left wing gradient, focus rings |
| `brand.cyan.dark` | `#0084CE` | Dark primary accents, button gradients, contrast borders |
| `brand.cyan.deep` | `#0069B4` | Royal blue wing shadow & deep volume curves |
| `brand.emerald.default` | `#00A859` | Primary hospital emerald, right wing gradient |
| `brand.emerald.dark` | `#00843D` | Forest green wing depth & high-contrast text |
| `brand.emerald.lime` | `#43B02A` | Lime crest shimmer & top wing highlight |
| `brand.navy.dark` | `#0B132B` | Dark mode background & deep healthcare space |

### Dual-Wing Linear Gradients
- **Brand Text**: `linear-gradient(135deg, #00A3E0 0%, #00A859 100%)`
- **Primary Button**: `linear-gradient(135deg, #0084CE 0%, #00A3E0 45%, #00A859 100%)`
- **Left Wing SVG**: `linear-gradient(135deg, #00B5F1 0%, #00A3E0 45%, #0069B4 100%)`
- **Right Wing SVG**: `linear-gradient(135deg, #43B02A 0%, #00A859 35%, #00843D 80%, #005A2B 100%)`

---

## 🚀 How to Use Across Different Platforms

### 1. In Next.js (App Router / Pages Router) & Vite React
Import directly from the modular folder:

```tsx
import {
  SghHeartSvg,
  SghLogo,
  SghAnimatedLogo,
  SghAnimatedLoader,
  AmbientGradientBackground,
  ThinkingDots,
  AnimatedBorderCard,
  SghButton,
  SghBadge,
  SghAlert,
  SghInput
} from "@/design-system";
```

#### Example: Animated Brand Hero & Form Card
```tsx
import { AmbientGradientBackground, AnimatedBorderCard, SghAnimatedLogo, SghButton, SghInput } from "@/design-system";

export default function LoginPage() {
  return (
    <AmbientGradientBackground isDark={true}>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <AnimatedBorderCard isDark={true}>
            <SghAnimatedLogo size={88} showText={true} />
            <form className="mt-6 space-y-4">
              <SghInput label="Work Email" placeholder="dr.smith@sgh.sa" />
              <SghInput label="Password" type="password" placeholder="••••••••" />
              <SghButton variant="primary" className="w-full">
                Sign In to Portal
              </SghButton>
            </form>
          </AnimatedBorderCard>
        </div>
      </div>
    </AmbientGradientBackground>
  );
}
```

#### Example: Full-Screen Animated Splash Loader
```tsx
import { SghAnimatedLoader } from "@/design-system";

export function LoadingScreen({ onFinish }: { onFinish: () => void }) {
  return (
    <SghAnimatedLoader
      fullScreen={true}
      durationMs={2000}
      textSequence="Saudi German Hospital"
      subtitle="Authenticating & Loading Healthcare Systems..."
      onComplete={onFinish}
    />
  );
}
```

---

### 2. In Tailwind CSS Projects
Add the preset to your `tailwind.config.js` or `tailwind.config.ts`:

```js
// tailwind.config.js
module.exports = {
  presets: [
    require('./design-system/tailwind/preset')
  ],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './design-system/**/*.{ts,tsx}',
  ],
  // ...
};
```

Now you can use SGH utility classes directly in your markup:
```html
<h1 class="text-3xl font-extrabold bg-sgh-brand-gradient bg-clip-text text-transparent">
  Saudi German Health
</h1>
<div class="shadow-sgh-glow bg-sgh-navy-dark text-white p-6 rounded-2xl">
  Patient Care Analytics
</div>
```

---

### 3. In Pure HTML / CSS / Vanilla JavaScript
Import `design-system/tokens/sgh-tokens.css` and `design-system/backgrounds/glassmorphism.css`:

```html
<link rel="stylesheet" href="./design-system/tokens/sgh-tokens.css" />
<link rel="stylesheet" href="./design-system/backgrounds/glassmorphism.css" />

<!-- Brand Button -->
<button class="sgh-btn-primary">
  Access Medical Records
</button>

<!-- Gradient Text -->
<span class="sgh-gradient-text">Saudi German Hospital</span>

<!-- Animated Glow Border Card -->
<div class="sgh-animated-border-card">
  <div class="sgh-glass-card p-6">
    <h3>Hospital Operations Live</h3>
  </div>
</div>
```

---

### 4. Vector SVG Assets for Mobile (Flutter, React Native, Swift, Kotlin)
- Use `design-system/brand/assets/sgh-heart.svg` for vector icons in mobile asset catalogs.
- Use `design-system/brand/assets/sgh-heart.png` (High-resolution transparent PNG) for native splash screens and notification icons.
