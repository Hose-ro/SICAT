---
name: SICAT
description: Sistema de Control de Asistencias y Tareas — calm, exact, institutional.
colors:
  background: "#f7f8fc"
  foreground: "#222f49"
  card: "#fbfcfe"
  primary: "#4f7cff"
  primary-foreground: "#fbfcff"
  secondary: "#eef1f8"
  muted: "#eef1f7"
  muted-foreground: "#6a7790"
  accent: "#e4ebfb"
  destructive: "#d6503e"
  success: "#27a567"
  warning: "#e0a23a"
  border: "#dde2ee"
  ring: "#4f7cff"
typography:
  display:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.01em"
rounded:
  item: "14px"
  card: "22px"
  control: "0.875rem"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "2rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    height: "2rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
    padding: "24px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    height: "2.25rem"
---

# Design System: SICAT

## 1. Overview

**Creative North Star: "The Registrar's Ledger"**

SICAT is a system of record for attendance and coursework, used by coordinators at a desk, teachers taking attendance mid-class on a phone, and students glancing at their record. The interface exists to log a fact and get out of the way. Its character is that of a well-kept institutional ledger: precise, legible, quietly confident. Surfaces are solid and faintly blue-tinted, never frosted. Hierarchy comes from type and spacing, not from glow.

The brand blue is a signal, not a wash. It marks the one primary action, the focus ring, the active nav item, and almost nothing else. The discipline is deliberate: when blue appears, it means something. This system explicitly rejects glassmorphism as an idiom, multi-radial-gradient backgrounds that compete with content, hero-metric dashboard templates, identical icon-heading-text card grids, side-stripe accent borders, and gradient text. If a screen could be mistaken for a generic AI-tool landing page, it has failed.

Density is moderate and varies by role: dense data tables for admins, roomier touch-friendly layouts for the in-class teacher and the mobile student. Depth is conveyed by tonal layering and hairline borders, not drop shadows at rest.

**Key Characteristics:**
- Solid tinted-neutral surfaces; glass is at most one intentional moment (the login card).
- Blue accent on under 10% of any screen.
- Flat at rest; elevation is a response to state (hover, focus), not decoration.
- Status is semantic: present / absent / late / justified map to success / destructive / warning tokens.
- One source of truth: every color is a token defined in `frontend/src/index.css`.

## 2. Colors

A blue-tinted neutral system. Canonical values are OKLCH (hue 264 for neutrals and brand); the hex in the frontmatter are sRGB approximations for tooling. Every neutral carries a faint brand tint so nothing reads as dead gray.

### Primary
- **Registrar Blue** (`oklch(0.62 0.19 264)`, ~`#4f7cff`): The single brand accent. Primary buttons, focus rings, active navigation, links. In dark mode it brightens to `oklch(0.68 0.16 264)` but keeps its blue identity. Never desaturate it to slate.

### Neutral
- **Ledger Ink** (`oklch(0.27 0.03 264)`, ~`#222f49`): Primary text. A deep blue-slate, not black.
- **Paper** (`oklch(0.985 0.004 264)`, ~`#f7f8fc`): App background. Off-white with a whisper of blue.
- **Card** (`oklch(0.995 0.003 264)`, ~`#fbfcfe`): Raised surfaces, one step brighter than the page.
- **Muted Surface** (`oklch(0.955 0.006 264)`): Filled secondary surfaces, table zebra, disabled fills.
- **Muted Ink** (`oklch(0.50 0.025 264)`, ~`#6a7790`): Secondary text, captions, placeholders.
- **Hairline** (`oklch(0.90 0.008 264)`, ~`#dde2ee`): Borders and dividers. Always a full border, never a one-sided colored stripe.

### Status
- **Present / Success** (`oklch(0.62 0.14 150)`): Attendance present, task graded/approved.
- **Late / Warning** (`oklch(0.76 0.14 75)`): Attendance late or justified, pending review.
- **Absent / Destructive** (`oklch(0.58 0.20 27)`): Attendance absent, destructive actions (delete user, delete session).

### Named Rules
**The One Signal Rule.** Registrar Blue appears on at most 10% of any screen. Its rarity is what makes it read as "the action." If two blue buttons compete on one screen, one of them is wrong.

**The Tinted Neutral Rule.** No `#000`, no `#fff`, no pure gray. Every neutral is tinted toward hue 264 (chroma 0.003–0.03). Pure gray is forbidden because it makes the blue look like a mistake rather than a choice.

## 3. Typography

**Display / Body / Label Font:** Geist Variable (with `ui-sans-serif, system-ui, sans-serif` fallback)

**Character:** A single technical-humanist sans across the whole system. Geist is precise and legible at small sizes, which is what a data-dense ledger needs. Hierarchy comes from weight and scale, not from switching families.

### Hierarchy
- **Display** (600, `clamp(1.75rem, 3.5vw, 2.5rem)`, 1.1, `-0.02em`): Page titles, the one big heading per screen.
- **Title** (600, 1.25rem, 1.25, `-0.01em`): Card and section headings.
- **Body** (400, 0.9375rem, 1.55): Default text. Cap measure at 65–75ch in prose contexts.
- **Label** (500, 0.75rem, `0.01em`): Form labels, table headers, chips, metadata.

### Named Rules
**The One Family Rule.** Geist only. "Inter" must never be declared again: it was referenced in CSS but never loaded, and that mismatch is the bug this system replaces. If you need contrast, change weight or size, not family.

## 4. Elevation

Flat by default. Surfaces sit on the page via a one-step tonal lift (Card brighter than Paper) and a hairline border, not a drop shadow. Shadows appear only as a **response to state**: a soft lift on hover for interactive cards, the focus ring on inputs and buttons. This keeps the ledger calm and avoids the 2014-app look of heavy ambient shadows on everything.

### Shadow Vocabulary
- **Hover lift** (`box-shadow: 0 6px 20px oklch(0.62 0.19 264 / 0.08)`): Interactive cards/rows on hover only.
- **Focus ring** (`ring-3 ring-ring/50`): Keyboard focus on any interactive element. Always visible, never removed.

### Named Rules
**The Flat-At-Rest Rule.** A surface at rest has no shadow. If you see a shadow without a hover or focus state behind it, delete it.

## 5. Components

### Buttons
- **Shape:** Gently rounded (`0.875rem` control radius, `--radius`).
- **Primary:** Registrar Blue fill, `primary-foreground` text. The one emphasized action per view.
- **Outline / Ghost / Secondary:** Transparent or muted fill, `foreground` text, hairline border on outline. For everything that isn't the primary action.
- **Destructive:** Tinted destructive background (`destructive/10`), destructive text. Used for delete/remove.
- **Hover / Focus:** `active:translate-y-px` for press feedback; `focus-visible` ring always present. No layout-property transitions.
- **Touch:** Icon-only buttons in mobile toolbars must reach 44×44 (Ola 4).

### Cards / Containers
- **Corner Style:** `22px` (`--radius-card`) for primary cards, `14px` (`--radius-item`) for list items.
- **Background:** `card` on `background`. One tonal step of contrast.
- **Border:** Full hairline (`border`). Never a one-sided colored stripe.
- **Shadow Strategy:** None at rest (see Elevation). Never nest a card inside a card.
- **Internal Padding:** 24px (`lg`) for cards, 16px (`md`) for compact rows.

### Inputs / Fields
- **Style:** `background` fill, hairline `input` border, `0.875rem` radius.
- **Focus:** Ring in `ring` color; border shifts to ring. No glow.
- **Every input has a programmatic label** (`<label htmlFor>` or `aria-label`). Unlabeled inputs are a defect (Ola 2).

### Navigation (Sidebar)
- **Style:** Solid tinted surface, not glass. Active item carries the blue accent (text + subtle `accent` fill); inactive items are `muted-foreground`.
- **Mobile:** Collapses to a `<header>` top bar with a labeled toggle and a skip-to-content link (Ola 2).

### Attendance Badge (signature component)
A pill that encodes attendance state through the status tokens: success (present), warning (late/justified), destructive (absent), muted (not recorded). Color plus a text label, never color alone, so it stays legible to colorblind users.

## 6. Do's and Don'ts

### Do:
- **Do** source every color from a semantic token (`bg-card`, `text-foreground`, `bg-primary`, `text-destructive`). New screens import nothing but tokens.
- **Do** keep Registrar Blue under 10% of any screen.
- **Do** tint every neutral toward hue 264; use OKLCH for new values.
- **Do** map attendance/task states to `success` / `warning` / `destructive`, paired with a text label.
- **Do** use full borders and tonal fills for emphasis.
- **Do** declare Geist as the only font family.

### Don't:
- **Don't** use glassmorphism as a default. Glass is at most one intentional surface (the login card); blur on every panel is forbidden.
- **Don't** paint multi-radial-gradient backgrounds that compete with content.
- **Don't** use `#000`, `#fff`, or pure gray. Ever.
- **Don't** use `border-left`/`border-right` greater than 1px as a colored accent stripe.
- **Don't** use gradient text (`background-clip: text`).
- **Don't** nest a card inside a card, or repeat identical icon-heading-text card grids.
- **Don't** declare "Inter" again. Geist is the only family.
- **Don't** use `alert()` / `confirm()` or ship inputs without an accessible name.
