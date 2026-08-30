---
workflow: product-launch-video
flow: automation
storyboard: no
message: "SPANK Spike 33 grips give you max grip and vibration absorption when your hands are sweaty and the descent gets rough."
destination: instagram-reels
aspect: 1080x1920
language: he
audience: "Israeli MTB riders following Teva Bike on Instagram"
length: 15-20s
angle: problem-solution-cta
narration: no
---

## Intent

Product promo for SPANK Spike 33 grips, sold at Teva Bike shop (Hebrew-language
MTB/outdoor shop). Problem: hands losing grip and getting fatigued on technical
descents. Solution: Spike 33 grips hold on even sweaty, and the soft compound
absorbs vibration on rough terrain. Strong close-up product shots, energetic
MTB feel — kinetic on-screen Hebrew text over footage/music, no voiceover.
Ends on CTA: link in bio, available now at Teva Bike shop. Brand look is
rugged/outdoor MTB first — dark, earthy/gritty grade — with the site's real
brand pink (#D4288A) kept as a small accent (logo, CTA button), not the lead
color.

## Assets

- public/SPIKE33MAIN123.webp — real Spike 33 grip product photo (hero shot), from app/shop/page.tsx
- public/logo.png — Teva Bike logo
- app/shop/page.tsx — ground-truth product copy: "גריפים ספייק 33", brand SPANK,
  ₪139 (market ₪149), קוטר 33 מ"מ (33mm diameter), Interlocking Column, colors
  שחור/קרם (black/cream)
- Site brand tokens (app/shop/page.tsx `C` object): brand #D4288A, brandHover
  #B51E77, dark #0C1814, green #152A1E, greenMid #1F3D2A, offWhite #F5F2EE
- user-media/spike33-user-photo-purple.webp — user-supplied real photo of the
  Spike 33 grips (purple pair), confirmed by the user as their own photo/subject.
  This is the **primary real close-up reference** for the product shots —
  build macro/hands-on-grip shots from this exact product look and color.
  MUST crop out the face entirely (explicit user instruction, privacy) — hands
  and product only, no identifiable person in frame.

## Customizations

- No live URL to capture — build via the no-capture path, using the assets and
  brand tokens above directly as the design system input instead of a crawl.
- Source/generate supplementary MTB descent b-roll around the two real product
  photos (catalog black/cream hero shot + user's purple close-up) to deliver
  the "strong close-up product shots, energetic MTB feel" the brief calls for.
- **Purple is a real SPANK color option** (per the user, a future addition not
  yet on the live site) — use it as a secondary/accent color throughout the
  composition alongside black, and as the literal color of the close-up product
  shots built from the user's photo. Don't caption or claim purple is
  orderable today — the CTA ("available now") refers to the grips generally,
  matching what the site currently sells (black/cream).
- No music bed available this run (no HeyGen sign-in, no working offline
  music engine) — proceeding **fully silent** per explicit user instruction to
  continue; energy carried by kinetic-text pacing and cut rhythm instead. Can
  add BGM later via a HeyGen sign-in + re-running Step 3.1 audio.
- On-screen text in Hebrew (RTL), matching the real site's language and audience.

## Notes

- Keep the problem beat brief (~3s max) — 15-20s total is tight against
  problem → solution → CTA plus multiple shot types; hold time matters most
  on the product hero shot and the CTA on a vertical mobile view.
- Brand look is rugged-MTB-first: dark/earthy grade leads, the site's actual
  pink is accent-only (logo/CTA); purple (from the real product photo) is the
  other accent, alongside black as the dominant product color.
- No storyboard review; single build straight to a finished video from this brief.
