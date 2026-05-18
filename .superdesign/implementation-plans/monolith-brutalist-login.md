# MONOLITH — Brutalist Login Implementation Plan

## Objective

Transform the existing login page into a brutalist, high-depth, scroll-reactive 3D experience while preserving the current `LightRays` animation and auth functionality.

## Current state

- The login page already has:
  - `LightRays` as a full-screen background
  - branded auth card
  - email/password sign-in
  - Azure SSO
  - role-based redirect
- The page is currently mostly static apart from the background effect and form hover states.

## Implementation approach

### 1. Keep the ambient layer

- Retain `LightRays` as the root visual layer.
- Tune its color and intensity to support the new brutalist palette instead of replacing it.
- Keep it non-interactive for pointer input so the login form remains usable.

### 2. Rebuild the login surface as a 3D composition

- Convert the login page from a simple split layout into a layered scene:
  - foreground auth card
  - secondary brutalist information slab
  - subtle depth planes behind both
- Add perspective transforms on the page wrapper so the card reads like an object in space.
- Introduce floating geometry or soft block forms that drift with scroll.

### 3. Add scroll-linked motion

- Use Framer Motion to drive scroll progress.
- Map scroll to:
  - `translateZ`/`translateY` style depth shifts
  - opacity fade of background slabs
  - parallax motion for the brand block
  - slight rotation for the auth card to simulate a cinematic camera move
- Keep the motion restrained enough that the form remains legible.

### 4. Make the design brutalist

- Use a stronger typographic hierarchy.
- Use hard edges, thick borders, and blocky framing.
- Replace soft glassy treatment with heavier surfaces and sharper contrast.
- Keep the AtomQuest yellow as the accent, but use it sparingly.

### 5. Preserve form behavior

- Keep the existing auth logic unchanged.
- Keep Azure SSO visible only when configured.
- Keep redirect-by-role logic exactly as it works now.
- Ensure validation and loading states stay intact.

### 6. Responsive fallback

- On desktop:
  - full 3D scene
  - layered composition
  - scroll-linked motion
- On mobile:
  - collapse to a single-column layout
  - reduce motion amplitude
  - keep readability above visual complexity

## File plan

- `src/pages/auth/LoginPage.tsx`
  - primary layout rewrite
  - motion choreography
  - brutalist surfaces and depth
- `src/components/shared/LightRays.tsx`
  - keep as-is, possibly tune props only
- `src/index.css`
  - add scene-level utilities if needed
- optional new helper component
  - if 3D scene blocks get too large, extract them into reusable subcomponents

## Risks

- Too much motion can hurt form usability.
- WebGL/DOM layering can get expensive on low-end devices.
- Scroll-driven transforms must not interfere with auth interactions.

## Acceptance criteria

- Existing `LightRays` remains visible.
- Login still works exactly as before.
- The page feels materially more monolithic and 3D.
- Scroll produces a clear floating/perspective effect.
- Mobile remains clean and usable.

