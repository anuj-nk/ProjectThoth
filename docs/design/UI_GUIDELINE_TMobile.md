# Project Thoth — UI Style Guide (T-Mobile App Optimized)

> **Purpose**: Visual standard for Project Thoth (Next.js 16 + TypeScript + Tailwind CSS).
> **Design soul**: Fuse T-Mobile's "brand confidence (Magenta)" with the "functional restraint (Minimalism)" of a tool-class application.

---

## 0. Design Positioning (App, not Web)

Project Thoth is a **tool-class application**, not a marketing webpage. This means:

- **Higher information density**: Do not copy the one-headline-per-screen pacing of t-mobile.com. Our users live in a workflow and need to see more on a single screen.
- **More restrained brand color**: Marketing pages use magenta liberally (CTAs, banners, price highlights). In a tool app, magenta only appears on the "next-step" actions. Everything else stays neutral gray and white.
- **Flatter hierarchy**: Avoid heavy shadows and oversized rounded blocks. Cards convey edges with thin borders and subtle shadows only.

The reference is not t-mobile.com as a whole, but the **app-level surfaces** on T-Mobile's site — the AI Assistant chat interface, the "Add your info" form pages. These speak T-Mobile's color and type language but pace closer to Linear / Notion / Vercel.

---

## 1. Brand DNA

Three rules that cannot be broken:

- **Pill-Shaped Everything** — All buttons, search inputs, tags, and badges use `rounded-full`. This is the most recognizable T-Mobile signature.
- **Magenta as a Signal** — Only the "next-step" action gets magenta. Status colors (success / error / warning / info) keep their semantic palette and never become magenta.
- **High Contrast Typography** — Headlines use pure black `#000000` with tight tracking (`tracking-tight`). Body uses dark gray, not pure black.

---

## 2. Color System (Tailwind Config)

Add this to `theme.extend.colors` in `tailwind.config.js`:

```js
colors: {
  // T-Mobile brand magenta
  magenta: {
    DEFAULT: '#E20074',  // Brand standard (= magenta-500)
    50:  '#FEE5F1',      // Light pink wash, notification / highlight blocks
    100: '#FCC2DF',
    200: '#F88BC1',
    300: '#F254A2',
    400: '#EB2287',
    500: '#E20074',      // Primary T-Mobile Magenta
    600: '#B80060',      // Hover
    700: '#8E004A',      // Active / pressed
    800: '#660035',
    900: '#3D0020',
  },
  // Neutral scale (premium gray)
  ink: {
    900: '#000000',      // Headlines, pure black
    800: '#191919',      // Body text
    700: '#2D2D2D',
    600: '#525252',
    500: '#6A6A6A',      // Helper text / icons
    400: '#A3A3A3',      // Muted
    300: '#D5D5D5',      // Strong borders
    200: '#E8E8E8',      // Default borders / dividers
    100: '#F3F3F3',      // Hover background
    50:  '#F6F6F6',      // Page background
  },
}
```

### Token usage map

| Token | Use for |
|---|---|
| `bg-magenta` | Primary CTAs (Send, Submit, Approve, Search, Ask Thoth) |
| `text-magenta` | Links, active tabs, brand emphasis text, Sparkle icon |
| `border-magenta` | Selected-state borders (chosen plan, active filter) |
| `hover:bg-magenta-600` | Primary button hover |
| `bg-magenta-50` | Very light pink background, AI highlight blocks or notifications. Use sparingly — no more than once per screen. |
| `bg-white` | Card and panel surfaces |
| `bg-ink-50` | Page background |
| `text-ink-900` | Headlines |
| `text-ink-800` | Body |
| `text-ink-500` | Helper text, timestamps, captions |
| `border-ink-200` | Default card and input borders |

### Status colors (keep the existing convention, do not change)

Brand color and semantic status color must stay separable. If approval badges turned magenta, users would conflate "approved" with "important / primary".

| Status | Class |
|---|---|
| Pending / draft | `bg-yellow-50 text-yellow-700 border-yellow-200` |
| Approved / success | `bg-green-50 text-green-700 border-green-200` |
| Rejected / error | `bg-red-50 text-red-700 border-red-200` |
| Routing / info | `bg-blue-50 text-blue-700 border-blue-200` |

---

## 3. Typography

T-Mobile.com uses a custom typeface called TeleNeo. For this PoC we use **Inter** as a free, close substitute.

```css
/* globals.css */
@import url('https://rsms.me/inter/inter.css');

html { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
@supports (font-variation-settings: normal) {
  html { font-family: 'InterVariable', system-ui, sans-serif; }
}

body { background-color: #F6F6F6; color: #2D2D2D; }
```

### Type scale

| Use | Tailwind classes |
|---|---|
| Page hero (rare) | `text-4xl md:text-5xl font-bold tracking-tight text-ink-900` |
| Section heading | `text-2xl font-bold tracking-tight text-ink-900` |
| Card title | `text-lg font-semibold tracking-tight text-ink-900` |
| Body | `text-base text-ink-800 leading-relaxed` |
| Helper / caption | `text-sm text-ink-500` |
| Eyebrow / micro label | `text-xs font-semibold uppercase tracking-wide text-ink-500` |

Every heading at `text-2xl` or larger gets `tracking-tight`. This is the source of T-Mobile's "tight and confident" headline feel.

---

## 4. Component Patterns

### 4.1 Buttons (The T-Mobile Pill)

**Do not use `rounded-md` or `rounded-lg` on buttons.** Always `rounded-full`.

**Primary** — only one per screen:

```tsx
<button className="
  inline-flex items-center justify-center gap-2
  px-8 py-3 rounded-full
  bg-magenta text-white font-bold
  hover:bg-magenta-600 active:bg-magenta-700
  focus:outline-none focus:ring-2 focus:ring-magenta focus:ring-offset-2
  transition-all
  disabled:bg-ink-300 disabled:cursor-not-allowed
">
  Ask Thoth
</button>
```

**Secondary** — sits next to a primary, lower weight:

```tsx
<button className="
  inline-flex items-center justify-center gap-2
  px-8 py-3 rounded-full
  bg-white text-ink-900 font-bold border border-ink-300
  hover:bg-ink-100 hover:border-ink-900
  focus:outline-none focus:ring-2 focus:ring-magenta focus:ring-offset-2
  transition-all
">
  Cancel
</button>
```

**Ghost / Link** — inline tertiary:

```tsx
<button className="
  text-magenta font-bold
  hover:text-magenta-600 hover:underline underline-offset-4
  focus:outline-none focus:ring-2 focus:ring-magenta rounded
">
  Learn more →
</button>
```

Minimum button height is 44px (`py-3` floor) so it stays tappable on mobile.

### 4.2 Cards

Mimic the "floating" feel and rounded corners of t-mobile.com, but stop at `rounded-3xl` (24px) for tool-app cards. Anything larger feels marketing-y.

```tsx
<div className="
  bg-white border border-ink-200 rounded-3xl
  p-6 md:p-8
  shadow-sm
  hover:border-ink-300 transition-colors
">
  ...
</div>
```

**Selected card** (chosen plan, active filter): swap to a magenta border with extra weight:

```tsx
className="bg-white border-2 border-magenta rounded-3xl p-6 md:p-8 shadow-sm"
```

### 4.3 Inputs

Standard form input: rounded rectangle, magenta highlight on focus.

```tsx
<input className="
  w-full px-4 py-4 rounded-xl
  bg-white border border-ink-300
  text-ink-900 placeholder:text-ink-400
  focus:outline-none focus:border-magenta focus:ring-2 focus:ring-magenta/20
  transition-all
" />
```

**Chat input** (modeled on the T-Mobile AI Assistant): use a `rounded-full` pill shape with a magenta circular send button on the right:

```tsx
<div className="relative">
  <input
    className="
      w-full pl-5 pr-14 py-4 rounded-full
      bg-white border border-ink-300
      text-ink-900 placeholder:text-ink-400
      focus:outline-none focus:border-magenta focus:ring-2 focus:ring-magenta/20
      shadow-sm transition-all
    "
    placeholder="Ask anything about GIX…"
  />
  <button
    className="
      absolute right-2 top-1/2 -translate-y-1/2
      size-10 rounded-full bg-magenta text-white
      hover:bg-magenta-600 active:bg-magenta-700
      flex items-center justify-center
      transition-all
    "
    aria-label="Send"
  >
    <SendIcon className="size-5" />
  </button>
</div>
```

Border width is always 1px (just `border` in Tailwind). Avoid heavy shadows. T-Mobile forms use a clean thin-line treatment.

### 4.4 Top Navigation (Header)

```tsx
<header className="
  sticky top-0 z-40
  h-16 bg-white/80 backdrop-blur-md
  border-b border-ink-200
">
  <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
    <div className="flex items-center gap-3">
      {/* Square magenta logo lockup, T-Mobile style */}
      <div className="size-8 bg-magenta rounded-md flex items-center justify-center">
        <span className="text-white font-bold text-lg leading-none">T</span>
      </div>
      <span className="font-bold text-ink-900 text-lg tracking-tight">
        Project Thoth
      </span>
    </div>

    <nav className="flex items-center gap-1">
      {/* Role tabs: User / SME / Admin */}
    </nav>
  </div>
</header>
```

`bg-white/80 backdrop-blur-md` is the key detail: scrolling content shows through the bar with a frosted feel, matching the t-mobile.com header experience.

### 4.5 AI Sparkle Icon (Brand Signal)

T-Mobile's current AI products (Find your best plan, Easy Switch beta) use a magenta four-point sparkle as the visual signature. Since Project Thoth is an AI knowledge system, adopt the same icon as the AI marker.

```tsx
import { Sparkles } from 'lucide-react';

<Sparkles className="size-5 text-magenta" strokeWidth={2.5} fill="currentColor" />
```

Use it for:

- The icon slot before the chat input placeholder ("Ask Thoth anything")
- Eyebrow labels on AI-generated content cards
- Loading states paired with text like "Thoth is thinking…"

**Do not** put the Sparkle on ordinary actions (Save, Cancel, Edit). It is reserved for AI signals.

---

## 5. Chat Surface Specifics (UserChat.tsx)

### 5.1 Message Bubbles

Asymmetric corner radii give bubbles a "directional" feel. Keep the assistant bubble neutral — do not paint it magenta, or users will lose track of who said what.

```tsx
{/* User message */}
<div className="flex justify-end">
  <div className="max-w-[75%] px-5 py-3 bg-magenta text-white
                  rounded-[20px] rounded-tr-[4px]">
    {content}
  </div>
</div>

{/* Assistant message */}
<div className="flex justify-start">
  <div className="max-w-[75%] px-5 py-3 bg-ink-100 text-ink-800
                  rounded-[20px] rounded-tl-[4px]">
    {content}
  </div>
</div>
```

### 5.2 Three Result Types — Visual Differentiation (Project Thoth Core)

`answer` / `sme_redirect` / `admin_fallback` must be distinguishable at a glance. This visual difference is the product story of "routing over fabrication" made visible.

**`answer`** — plain assistant bubble, followed by a compact Sources list (modeled on the "Find your best plan" cards on t-mobile.com):

```tsx
<div className="mt-3 pt-3 border-t border-ink-200">
  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">
    Sources
  </p>
  <ul className="space-y-2">
    {citations.map(c => (
      <li>
        <a className="
          flex items-center justify-between
          bg-white border border-ink-200 rounded-2xl
          px-4 py-3
          hover:border-magenta transition-colors
          group
        ">
          <span className="text-sm text-ink-800 font-medium">{c.title}</span>
          <span className="text-magenta group-hover:translate-x-0.5 transition-transform">→</span>
        </a>
      </li>
    ))}
  </ul>
</div>
```

**`sme_redirect`** — prominent card with a Sparkle icon and a primary CTA:

```tsx
<div className="bg-white border border-ink-200 rounded-3xl p-6">
  <div className="flex items-center gap-2 mb-3">
    <Sparkles className="size-4 text-magenta" fill="currentColor" />
    <p className="text-xs font-semibold uppercase tracking-wide text-magenta">
      Routed to expert
    </p>
  </div>
  <p className="text-base font-semibold text-ink-900">{sme.full_name}</p>
  <p className="text-sm text-ink-500 mt-1">
    {sme.preferred_channel}: {sme.contact}
  </p>
  <button className="mt-4 px-6 py-2.5 rounded-full bg-magenta text-white font-bold
                     text-sm hover:bg-magenta-600 transition-all">
    Open in Teams
  </button>
</div>
```

**`admin_fallback`** — quiet card, no magenta, communicates a neutral "we logged it":

```tsx
<div className="bg-ink-50 border border-ink-200 rounded-3xl p-6">
  <p className="text-sm text-ink-800">
    This question is outside what our SMEs currently cover. We have logged it for the admin team.
  </p>
  <p className="text-xs text-ink-500 mt-2 font-mono">Request ID: {request_id}</p>
</div>
```

---

## 6. Layout & Spacing

- **Max width**: `max-w-7xl` for top-level pages, `max-w-3xl` for chat and reading surfaces.
- **Page padding**: `px-6 md:px-8` always.
- **Vertical rhythm**: `py-12` or `py-16` between sections; `space-y-6` or `gap-6` within a section.
- **Card spacing**: `gap-4` minimum in grids, `gap-6` preferred.

A tool app should breathe more tightly than a marketing page, but never feel cramped.

---

## 7. Motion

Keep it minimal. T-Mobile's transitions are restrained — no bounce, no theatrics.

- All interactive elements: `transition-all duration-150` (color, border, subtle transform).
- Page-level enter animations: skip them in the PoC. No clear payoff.
- Loading state: skeleton blocks with `bg-ink-100 animate-pulse`. No spinners except inside the chat send button.
- AI waiting state: Sparkle icon paired with "Thoth is thinking…" text.

---

## 8. Accessibility

- Every interactive element needs `focus:ring-2 focus:ring-magenta focus:ring-offset-2`.
- Magenta `#E20074` on white **fails WCAG AA for normal body text (16px)**. Therefore: only use `text-magenta` on headlines, bold links, or labels at 18px+ or 14px-bold+. Body copy stays at `text-ink-800` or darker.
- Buttons need a minimum hit area of 44×44px (`py-3` floor).

---

## 9. Anti-Patterns (Do Not Do)

These exist to prevent AI assistants from interpreting "add the brand color" as "wash the page in pink":

- Full-page magenta backgrounds or hero sections.
- Magenta as a status color (success / error / warning). Status stays green / red / yellow / blue.
- Magenta variants on approval badges or status pills.
- Magenta gradient backgrounds. T-Mobile uses flat solid magenta.
- A second brand accent (purple, blue, teal). The palette is magenta plus neutrals only.
- Buttons with `rounded-md` or `rounded-lg`. The pill shape is core brand identification.
- Magenta on body text (fails contrast).
- Importing UI libraries (Material UI, Chakra, Radix Themes). Tailwind only.
- Sparkle icon on non-AI actions.

---

## 10. Refactor Order

Apply changes in this order to avoid messy intermediate states:

1. **`tailwind.config.js`** — add the color tokens from §2. Without this, none of the classes below compile.
2. **`globals.css`** — load Inter, set the body to `bg-ink-50` and `text-ink-800`.
3. **App shell (`layout.tsx` / `page.tsx`)** — apply the header from §4.4.
4. **`UserChat.tsx`** — apply §4.3 input, §5.1 bubbles, §5.2 result types.
5. **`SMEOnboarding.tsx`** — apply §4.1 buttons and §4.2 cards. **Notify Suzy in chat first.**
6. **`AdminDashboard.tsx`** — apply §4.2 cards and the §2 status colors. **Notify Anuj in chat first.**

---

## 11. Cheat Sheet

```
PAGE BG            bg-ink-50
CARD BG            bg-white
CARD BORDER        border border-ink-200 rounded-3xl
CARD SELECTED      border-2 border-magenta rounded-3xl
HEADLINE           text-2xl font-bold tracking-tight text-ink-900
BODY               text-base text-ink-800 leading-relaxed
HELPER             text-sm text-ink-500
PRIMARY BUTTON     rounded-full bg-magenta text-white font-bold px-8 py-3 hover:bg-magenta-600
SECONDARY BUTTON   rounded-full border border-ink-300 bg-white text-ink-900 font-bold px-8 py-3
INPUT              rounded-xl border border-ink-300 px-4 py-4 focus:border-magenta focus:ring-2 focus:ring-magenta/20
CHAT INPUT         rounded-full pl-5 pr-14 py-4 (with magenta pill send button on right)
HEADER             sticky top-0 h-16 bg-white/80 backdrop-blur-md border-b border-ink-200
FOCUS RING         focus:ring-2 focus:ring-magenta focus:ring-offset-2
LINK               text-magenta font-bold hover:text-magenta-600 hover:underline
AI ICON            <Sparkles className="size-5 text-magenta" fill="currentColor" />
USER BUBBLE        bg-magenta text-white rounded-[20px] rounded-tr-[4px] px-5 py-3
ASSISTANT BUBBLE   bg-ink-100 text-ink-800 rounded-[20px] rounded-tl-[4px] px-5 py-3
```

---

## 12. Prompt Templates for Claude Code

**General refactor (single component):**

> I am refactoring `<path/to/Component.tsx>` for Project Thoth, a Next.js 16 + TypeScript + Tailwind project. Apply the visual standard from `UI_GUIDELINE_TMobile.md` (attached) to this component.
>
> **Core tasks:**
> 1. Replace every `gray-*` class with the custom `ink-*` scale.
> 2. Unify all button shapes to `rounded-full` with `px-8 py-3` and `font-bold`.
> 3. The primary action button uses `bg-magenta` with `hover:bg-magenta-600`.
> 4. Headings get `tracking-tight` and `text-ink-900`.
> 5. Cards use `rounded-3xl border border-ink-200 bg-white`, with `p-6` minimum padding.
> 6. Without breaking existing business logic or the prop interface, increase breathing room (more padding and gap).
>
> **Do not:**
> - Change the status colors (yellow / green / red / blue stay as-is).
> - Wash the page background in magenta.
> - Introduce new dependencies.
> - Change the component's props or exports.
>
> Return the full updated file.

**Sparkle icon / AI visual work:**

> I am adding the brand AI visual to Project Thoth. Reference: the magenta four-point sparkle on t-mobile.com's "Easy Switch (beta)" card. Add lucide-react's `<Sparkles>` icon to: (1) the small icon slot in front of the chat input placeholder, (2) the top-left eyebrow label of AI-generated content cards. Use `text-magenta` with `fill="currentColor"`. Do not add this icon to ordinary buttons (Save, Cancel).

---

End of guide.
