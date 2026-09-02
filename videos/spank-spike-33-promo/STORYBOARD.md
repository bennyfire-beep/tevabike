---
format: 1080x1920
duration: 18s
message: "SPANK grips give you max grip and vibration absorption when your hands are sweaty and the descent gets rough."
arc: PAS (compressed) — pain → solution/product → proof → CTA
audience: Israeli MTB riders following Teva Bike on Instagram
mode: autonomous
music: none
---

## Video direction

- **palette system** (from `frame.md`, broadside remix): ink-black `#0C1814` canvas leads every frame; off-white `#F5F2EE` carries all display type; the single system accent `#D4288A` (brand pink) marks CTA/label chrome and the underline/burst moves — never a second UI accent. Purple is not a palette token: it appears only as the true photographed color of the grip in Frames 2–4, read as documentary product color, not graphic design.
- **motion grammar + reveal model**: long-tail `power3` settle by default on every entrance (no bounce/overshoot anywhere in this video — a rugged/confident register wants clean, not playful). Each frame reveals its cues one at a time, paced to its on-screen text cues (the `voiceover` field doubles as the kinetic-text script since `narration: no`) — nothing dumps at t=0. During any hold: subtle jitter at most, never breathing/drift.
- **rhythm / held-frame allocation**: Frame 1 is fast and bare (no hold — it exists to create tension). Frame 2's final ~40% (post zoom-out lock) is the video's one deliberate held beat — the product reads still after the reveal completes. Frame 3 stays high-tempo (rapid-fire, no holds). Frame 4 holds dead static on the logo lockup for its back half — the CTA needs to be readable, not busy.
- **negative list**: no bouncy/elastic entrances; no lazy breathing or back-half camera pan/push; no generic bokeh / "AI" gradients; no browser/UI chrome (this is a physical product, never rendered as software); no purple used as a UI/graphic color — only as the real product's photographed color; no claim that purple is a purchasable variant today.

## Frame 1 — Pain lands cold

- scene: Bare dark canvas (frame.md ink-black), no product yet. Two short Hebrew pain statements land solo, one after the other, in massive lowercase Barlow.
- voiceover: "מזיעים." / "האחיזה נחלשת." — (Sweating. / Grip weakens.)
- duration: 3.5s
- transition_in: cut
- status: animated
- src: compositions/frames/01-pain.html
- type: hook
- persuasion: Pain validation
- beat: tension
- blueprint: kinetic-type-beats (Reproduce)
- focal: — (typography-only beat, no asset)
- roles: —
- sfx: impact-soft (on cue 2's landing)
- asset_candidates:

Reproduce: Problem sub-shape — 3–5 short pain statements landing solo on a bare canvas, no product yet.
Scene 1 (0.0–1.6s): solid ink-black field, full-bleed, no product. Cue 1 "מזיעים." (RTL, centered, ~50% of frame width) FLASH-in hard-cut — no fade/slide — massive lowercase Barlow weight 900, off-white. Holds bare.
Scene 2 (1.6–3.5s): cue 1 clears by hard cut (no roll/blur); cue 2 "האחיזה נחלשת." flash-in replaces it, centered, same scale — on landing, a thin brand-pink `[accent]` underline draws left→right beneath it and holds. Settle-and-hold to the frame's end (subtle jitter only).

narrativeRole: Opens on the exact felt moment every technical-descent rider recognizes — hands slipping, strength going — before the product exists in the story at all.
keyMessage: Your grip fails you exactly when you need it most.

## Frame 2 — Spike 33 macro reveal

- scene: Open TIGHT full-bleed on the grip's texture/lockring detail (from the real user close-up photo). One continuous decelerating zoom-out reveals the whole grip, then the black/cream catalog hero shot settles beside the product name.
- voiceover: "ספייק 33" / "מבית SPANK" — (Spike 33 / by SPANK)
- duration: 5s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/02-product-intro.html
- type: product_intro
- persuasion: Feature-to-benefit translation
- beat: relief + control
- blueprint: zoom-out-workspace-reveal (Adapt)
- focal: assets/spike33-user-purple.webp
- roles: spike33-user-purple.webp = cutout (open tight, then the reveal subject) · spike33-hero.webp = supporting (settles in as the still product card once locked)
- sfx: riser (under the zoom-out), soft-land (on lock)
- asset_candidates: assets/spike33-user-purple.webp — real cropped macro grip-texture close-up (purple), zoom-out hero; assets/spike33-hero.webp — real black/cream catalog shot, settles as the product still

Adapt: keep the signature move (ONE continuous decelerating zoom-out, no zoom-in anywhere, camera locks at the end); change the container from a design-tool workspace to the real product itself — the "whole" being revealed is simply the full grip in-hand, not software chrome.
Scene 1 (0.0–1.2s): extreme close-up, full-bleed, no chrome — the real grip texture/lockring detail (`spike33-user-purple.webp`) fills the frame edge-to-edge. Camera already pulling back underneath (the zoom-out never waits). Centered, ~100% of frame (macro).
Scene 2 (1.2–3.2s): the SAME continuous zoom-out (`viewport-change`, one `.world` wrapper, shared `expo.out` ease) continues, revealing more of the grip's full length and the hand grip context as cue "ספייק 33" flash-arrives lower-third (off-white on a soft ink-black scrim, ~30% of frame) — text is an overlay on the still-moving world, not part of the zoom.
Scene 3 (3.2–5.0s): the zoom-out decelerates to a full stop and LOCKS — asymmetric 60/70 layout: the real grip (purple) rests left, `spike33-hero.webp` (black/cream catalog still) settles in on the right at a modest scale via a soft `power3` slide-crossfade, cue "מבית SPANK" lands beneath as a supporting label. Frame holds still (subtle jitter only) — the video's one deliberate held beat.

narrativeRole: Resolves the pain beat's tension onto the named product, using the real grip texture as proof this is a physical, gripped-in-hand object, not a claim.
keyMessage: This is what actually holds on.

## Frame 3 — Why it holds

- scene: Two quick close-up value beats over the real product macro: grip texture under a sweat-sheen treatment, then the soft compound flexing/absorbing on a rough-terrain graphic cue. Text lands beat-by-beat.
- voiceover: "אחיזה מקסימלית — גם כשמזיעים." / "רכב רך שבולם רעידות בשטח מחוספס." — (Max grip — even when sweaty. / A soft compound that absorbs vibration on rough terrain.)
- duration: 5s
- transition_in: crossfade
- status: animated
- src: compositions/frames/03-benefits.html
- type: benefit_highlight
- persuasion: Show-don't-tell proof
- beat: confidence
- blueprint: kinetic-type-beats (Adapt)
- focal: assets/spike33-user-purple.webp
- roles: spike33-user-purple.webp = background (full-bleed, dimmed ~35% under both cues)
- sfx: whoosh (cue transition)
- asset_candidates: assets/spike33-user-purple.webp — real macro grip texture, reused for the compound/texture close-up

Adapt: Benefits statement-relay sub-shape (2 full statements, not the 8–12 staccato montage — only 2 proof points exist) — each statement builds and HOLDS ~1.8s+ before the hard cut, over the real product macro rather than a flat void.
Scene 1 (0.0–2.2s): `spike33-user-purple.webp` full-bleed, dimmed ~35% for text legibility (top ~83% only — caption band stays clear). Cue "אחיזה מקסימלית —" types on char-by-char with a trailing caret, upper-third, off-white; "גם כשמזיעים." lands a half-beat after via per-word staggered fade directly beneath it. Holds ~0.6s.
Scene 2 (2.2–2.6s): hard cut — cue clears (no roll/blur).
Scene 3 (2.6–5.0s): same background, reframed slightly (soft crossfade pan, not a hard reset) to the compound/texture region. Cue "רכב רך שבולם רעידות" flash-in upper-third; "בשטח מחוספס." per-word fade beneath it a half-beat later; a brand-pink accent underline draws beneath the key word "בולם" (absorbs) on landing. Settles and holds to end (subtle jitter only).

narrativeRole: Delivers the brief's two concrete proof points — sweat grip, vibration absorption — as evidence for the promise already landed in Frame 2.
keyMessage: Sweat-proof grip and a compound built to absorb the trail.

## Frame 4 — Available now

- scene: Teva Bike logo assembles/draws in on the dark canvas; the grip product (purple + black) holds beside it; closing text pushes through to the CTA line.
- voiceover: "זמין עכשיו בטבע בייק" / "לינק בביו" — (Available now at Teva Bike / Link in bio)
- duration: 4.5s
- transition_in: squeeze
- status: animated
- src: compositions/frames/04-cta.html
- type: cta
- persuasion: Risk reversal / urgency
- beat: motivation
- blueprint: logo-assemble-lockup (Adapt)
- focal: assets/teva-bike-logo.png
- roles: teva-bike-logo.png = cutout (the mark) · spike33-user-purple.webp = supporting (small product card beside the lockup)
- sfx: soft-land (on the logo bloom)
- asset_candidates: assets/teva-bike-logo.png — real Teva Bike logo; assets/spike33-user-purple.webp — real product, held beside the logo

Adapt: CTA text-clear-bloom sub-shape — keep the signature move (mark blooms from ZERO at dead center on a cleared stage, then the lockup holds dead static); simplify — our mark is the real flat `teva-bike-logo.png`, no 3D parts, no camera push-through.
Scene 1 (0.0–1.0s): ink-black cleared stage, blank. `teva-bike-logo.png` scales up from zero at dead center with one snappy `power3` settle (no bounce) — centered, ~35% of frame.
Scene 2 (1.0–2.2s): the logo settles into a lockup — `spike33-user-purple.webp` slides in as a small supporting product card lower-left (asymmetric 70/30) as cue "זמין עכשיו בטבע בייק" flash-arrives beneath the logo.
Scene 3 (2.2–4.5s): cue "לינק בביו" lands beneath the first line via per-word fade, a thin brand-pink underline draws beneath it and holds. Full lockup (logo + product card + both lines) holds dead static for the frame's back half — the video's final, longest-read beat (subtle jitter only). Real exit: hold to the last frame, no further motion.

narrativeRole: Closes on the real brand mark and the one action the viewer should take, holding long enough to read on a vertical mobile scroll.
keyMessage: You can buy this right now — link in bio.
