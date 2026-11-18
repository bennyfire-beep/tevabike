# Teva Bike — Design Language

The design system for the public site at **tevabike.com**. The brand is **purple and white**: a clean white page, with purple as the main action color.

> **Scope.** This covers the public marketing and registration pages (`app/page.tsx`, `/register`, `/camp*`, `/rides`, `/shop` and so on). The staff dashboards under `/admin` use their own dark theme (`#0D0F0E` / `#141716` / lime `#B5E853`) and are not covered here.

> **Current state vs. target.** The code today uses a **magenta** brand color (`--brand: #D4288A`, plus `#EC4899` in the nav). The only purple currently in the code is `#7C3AED`, in `components/ContactWidget.tsx`. This document defines the **target**: purple `#7C3AED` replaces magenta as the brand/action color. Everything else (fonts, sizes, spacing, radii) describes what the code already does.

---

## 1. Colors

### Brand

| Token | HEX | Use |
|---|---|---|
| `--brand` | `#7C3AED` | Primary action buttons, brand accents (key words in headlines, active tab, focus ring) |
| `--brand-hover` | `#6D28D9` | Hover/pressed state of primary buttons |
| `--brand-soft` | `#EDE9FE` | Tinted pill/badge background behind purple text |
| `--brand-faint` | `#F5F3FF` | Very light purple section wash (use sparingly) |

`#7C3AED` on white has AA contrast with white text on top, so it is safe for button labels.

### Neutrals

| Token | HEX | Use |
|---|---|---|
| `--background` | `#FFFFFF` | Page background, the default everywhere |
| `--off-white` | `#F5F2EE` | Alternate section background (e.g. the classes section) |
| `--input-bg` | `#FAFAF8` | Form field fill |
| `--foreground` | `#111C16` | Body text |
| `--dark` | `#0C1814` | Headings, the stats band, the nav bar, hero overlay |
| `--muted` | `#7A8880` | Secondary text, descriptions, meta rows |
| `--label` | `#6B7A72` | Form labels |
| `--border` | `#EAE6E1` | Card borders |
| `--border-input` | `#E2DDD8` | Form field borders (idle) |
| `--placeholder` | `#9CA3AF` | Placeholder and empty-select text |

### Supporting (existing, keep secondary)

| HEX | Use |
|---|---|
| `#152A1E` / `#1F3D2A` | Deep forest greens: dark surfaces, nature feel |
| `#25D366` | WhatsApp buttons only |
| `#1565C0` | Accessibility button only |
| `#F0B90B` | "Academy" highlight in the nav |
| `#F87171` / `#FBBF24` / `#4CDB7A` | Error / warning / success states |

---

## 2. Typography

- **Font family:** **Heebo** (Google Fonts, `hebrew` + `latin` subsets), loaded in `app/layout.tsx` as `--font-heebo` and mapped to Tailwind `font-sans`. Fallback: `Arial, sans-serif`.
- **Monospace:** Geist Mono (`--font-mono`), for numbers and code only.
- **Weights in use:** 400, 500, 600, 700, 800, 900. Headings use **900**, buttons use **800**, labels and badges use **600–700**.

| Role | Size | Weight | Line height / tracking |
|---|---|---|---|
| H1 (hero) | `clamp(2rem, 5vw, 3.8rem)` | 900 | 1.12 / `-0.025em` |
| H2 (section) | `clamp(1.9rem, 3.5vw, 2.8rem)` | 900 | `-0.025em` |
| H3 (sub-section) | `clamp(1.3rem, 2.6vw, 1.8rem)` | 900 | `-0.02em` |
| Stat number | `clamp(2rem, 4vw, 2.8rem)` | 900 | 1 |
| Lead paragraph | `clamp(.95rem, 2.2vw, 1.2rem)` | 400 | 1.65 |
| Body | 15–16px | 400–500 | 1.6 |
| Small / meta | 13–14px | 500–700 | 1.6 |
| Label / badge | 11–12px | 600–700 | `0.05em` on uppercase-style badges |

Use `clamp()` for headings so they scale between phone and desktop without breakpoints.

---

## 3. Spacing

Spacing is in pixels on a loose **2px grid**, with most values on a 4px rhythm.

| Scale | Value | Typical use |
|---|---|---|
| xs | 4–6px | Icon–text gap, tight inline gaps |
| sm | 8–10px | Gap between pills, chips, small stacks |
| md | 12–16px | Gap inside cards, form field stack |
| lg | 18–20px | Card grid gap |
| xl | 26px | Card inner padding |
| 2xl | 40–52px | Space between a section title and its content |
| 3xl | 88px | Vertical section padding (`padding: 88px 24px`) |

- **Page side gutter:** 24px (28px inside the nav).
- **Form field padding:** `11px 14px`.
- **Button padding:** `14px 34px` (large), `8px 22px` (compact, e.g. nav).

---

## 4. Components

### Buttons

All buttons share **one corner radius: `10px`**.

| Variant | Spec |
|---|---|
| **Primary** (`.btn-primary`) | Background `--brand`, white text, weight 800, 16px, padding `14px 34px`, no border. Hover: `--brand-hover` and `translateY(-2px)`. |
| **Outline** (`.btn-outline`) | Transparent, 2px border. On dark/hero backgrounds: white text, `rgba(255,255,255,0.38)` border. On white: `--dark` text, `--border` border. Weight 700. |
| **Compact** | Same as primary or outline, padding `8px 22px`, 14px text. Still `10px` radius. |
| **WhatsApp** | `#25D366` background, used only for WhatsApp contact. |

Rules: one primary button per view or section. Secondary actions use outline or a text link, never a second purple button.

### Cards

- Background `#FFFFFF`, border `1px solid #EAE6E1`, radius **16px**, padding **26px**.
- Shadow: at most `0 2px 14px rgba(0,0,0,0.05)`.
- Hover (`.card-class`): lift `translateY(-6px to -8px)` and border turns `--brand`. Keep the hover shadow soft (no more than `0 12px 28px rgba(0,0,0,0.08)`).
- Inside a card: badge/pill at top (purple-tinted for brand items), title, meta rows in `--muted` 13px, CTA at the bottom.

### Pills and badges

- Radius `20px` (fully rounded), padding `4px 13px` to `5px 18px`, 11–12px, weight 700.
- Brand pill: `--brand-soft` background, `--brand` text.

### Forms

- **Label:** 12px, weight 600, `--label` color, 5px below to the field.
- **Input / select / textarea:** full width, `1.5px solid #E2DDD8`, radius **10px**, padding `11px 14px`, 14px text, background `#FAFAF8`, text `#111`.
- **Focus:** border turns `--brand`; transition `border-color .2s`. No glow shadows.
- **Placeholder / empty select:** `#9CA3AF`.
- Phone, email and ID fields: set `direction: ltr` on the input while the label stays RTL.
- Errors: `#F87171` border plus a short message below the field.

### Navigation

- Fixed top bar, height 66px, dark translucent background `rgba(12,24,20,0.72)` (0.97 when scrolled) with `backdrop-filter: blur(18px)`.
- Links: 15px, weight 500, `rgba(255,255,255,0.75)`, turning white on hover with a 2px `--brand` underline that grows from the right.
- One compact primary button ("הרשמה") at the end.

---

## 5. Layout

- **Direction:** the whole site is Hebrew, `<html lang="he" dir="rtl">`. Content flows right to left; the logo sits on the right and the nav links on the left.
- **Content widths:** 1120–1160px for full sections and the nav, 960–1000px for stat bands and dense grids, 720px for narrow content and pricing pairs, 420–480px for single-column forms and modals.
- **Grids:** `repeat(auto-fill, minmax(280px, 1fr))` for cards (260px minimum for smaller cards), with an 18–20px gap. This collapses to one column on phones without media queries.
- **Section rhythm:** alternate `#FFFFFF` and `#F5F2EE` sections; use `--dark` for one strong band (stats) at most. Each section: centered title block (pill, H2, muted subtitle) and then content.
- **Hero:** full-viewport (`100vh`, min 580px) video/image with a dark gradient overlay, centered text, max width 820px.
- **Mobile:** 24px side gutter, no horizontal scroll (`overflow-x: hidden` on `main`), tap targets at least 44px tall.

---

## 6. Do's and Don'ts

### Do

- **Do** use purple (`#7C3AED`) **only** for primary action buttons and brand touches: the brand word in a headline, the active tab, focus states, brand pills.
- **Do** keep the background white and clean; let white space carry the layout.
- **Do** use **the same corner radius (`10px`) on every button**: primary, outline, compact and WhatsApp alike.
- **Do** keep shadows soft and small (`0 2px 14px rgba(0,0,0,0.05)` is the default).
- **Do** build every page in **Hebrew with RTL direction**. Use logical properties (`margin-inline-start`, `padding-inline-end`, `inset-inline`) rather than hard-coded left/right where you can.
- **Do** use Heebo for all text, with weight 900 for headings.
- **Do** use `clamp()` for heading sizes.

### Don't

- **Don't** use purple for body text, large background areas, borders on every card, or secondary buttons.
- **Don't** put two purple buttons side by side. The second action is an outline button or a link.
- **Don't** use heavy shadows: nothing like `0 20px 60px rgba(0,0,0,0.35)`, and no colored glows under buttons (e.g. the current `0 8px 24px rgba(212,40,138,0.42)` on `.btn-primary` should go).
- **Don't** mix button radii (6, 8, 12, 20px…). Buttons are always `10px`; only pills are fully rounded.
- **Don't** mix magenta/pink (`#D4288A`, `#EC4899`, `#DB2777`) with the purple. Purple replaces them as the brand color.
- **Don't** use LTR layouts or English UI copy on public pages. The exceptions are LTR fields (phone, email, ID, URLs) and brand names.
- **Don't** add new fonts.
