# Login Page Context

Current login page structure:

- Full-screen auth page with a dark cinematic background.
- `LightRays` is mounted as the root ambient layer.
- Brand area and auth card are already separated into a two-column desktop layout.
- Auth card includes email, password, submit, and Microsoft SSO.

## What stays

- `LightRays` background effect.
- Role-based redirect flow.
- Azure SSO button and existing auth logic.

## What changes

- Move from polished cinematic login to a brutalist, monolithic auth experience.
- Add stronger depth, perspective, and layered surfaces.
- Add scroll-linked 3D motion and floating elements on the login surface.
- Make the desktop experience feel like a 3D scene while keeping mobile readable.

