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

## Customizations

- No live URL to capture — build via the no-capture path, using the assets and
  brand tokens above directly as the design system input instead of a crawl.
- Source/generate supplementary product + MTB footage around the one real
  catalog photo: macro grip-texture / hands-gripping close-ups, and energetic
  MTB descent b-roll, to deliver the "strong close-up product shots, energetic
  MTB feel" the brief calls for.
- Energetic instrumental music bed (no narration); cuts paced to its energy.
- On-screen text in Hebrew (RTL), matching the real site's language and audience.

## Notes

- Keep the problem beat brief (~3s max) — 15-20s total is tight against
  problem → solution → CTA plus multiple shot types; hold time matters most
  on the product hero shot and the CTA on a vertical mobile view.
- Brand look is rugged-MTB-first: dark/earthy grade leads, the site's actual
  pink is accent-only (logo/CTA), not the dominant graphic color.
- No storyboard review; single build straight to a finished video from this brief.
