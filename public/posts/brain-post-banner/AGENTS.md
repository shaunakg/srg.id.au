# Brain Post Banner (Zola iframe banner)

## Purpose
Interactive, OG-style banner for the brain MRI segmentation post. This is a standalone Three.js web app that runs inside an iframe on the blog post page and acts as the post title/hero.

Location in repo:
- `frontend-ssg/static/posts/brain-post-banner/` (served as static assets by Zola)

Used by the post frontmatter:
- `frontend-ssg/content/posts/brain.md` sets `banner_iframe = "/posts/brain-post-banner/index.html"`

The post template (`frontend-ssg/templates/post-page.html`) renders this iframe as the H1/title when `banner_iframe` is present.

---

## What the banner does
- Renders a segmented 3D brain (multiple meshes) via Three.js.
- Animates a fly-in, then an explosion sequence.
- Shows label lines + label boxes for visible parts when exploded.
- Supports hover highlighting (mesh ↔ label) when interactive.
- Auto-rotates when idle; user can rotate/zoom via TrackballControls (free rotation).
- Displays corner text (author, URL, date) and a status button.
- After load, title + corners dim to reveal the brain.
- Reset button restarts the sequence and restores full opacity.

---

## Files and responsibilities
- `index.html`
  - Static DOM scaffold for the banner.
  - `#banner` container (role="img" with aria-label).
  - `#canvas` for WebGL.
  - `#labels` with SVG lines + HTML label boxes.
  - `#title` and `#overlay` (corner text + status button).
  - Import map for Three.js modules.

- `style.css`
  - Layout and typography.
  - Banner uses a flexible height (`min-height: 60vh`) and no fixed aspect ratio.
  - Corner text dims with `.is-muted` on `#overlay`.
  - Labels fade in/out via opacity transitions.
  - Mobile tweaks: smaller corner text, hide label descriptions, tighter label padding, smaller label titles.

- `app.js`
  - Three.js scene setup, mesh loading, material styling.
  - Manages animation phases: fly-in → spin → explode → interactive.
  - Label positioning logic, visibility, and fade transitions.
  - Load state + reset logic with a deliberate delay before sequence start.

---

## Key behaviors (implementation notes)
- Load/sequence delay: `SEQUENCE_DELAY_MS` delays dimming + fly-in after load.
- Fly-in start offset: `FLYIN_OFFSET_MULT` pushes the start position lower so the brain flies in from off-screen.
- Title + corner dimming:
  - Title uses `.is-muted` on `#title`.
  - Corner text + status button use `.is-muted` on `#overlay`.
  - Reset removes both muted states, then re-applies after the delay.
- Labels:
  - Visible only when exploded.
  - Fade in/out via opacity transitions (no display toggling).
  - Label descriptions are hidden on mobile.

---

## Required assets
```
assets/
  regions.json
  meshes/
    *.glb | *.ply
```

`assets/regions.json` is required and contains:
- `meshes[]` with `path`, `centroid`, `name`, optional `description`, optional `hemisphere`, etc.

The app expects `assets/meshes/` to match the paths in the manifest.

---

## Running locally
From the repo root, you can serve the static folder, for example:

```
python -m http.server 8000
```

Then open:
```
http://localhost:8000/frontend-ssg/static/posts/brain-post-banner/index.html
```

Or load the full Zola site and visit the post page.

---

## Accessibility
- `#banner` has `role="img"` and `aria-label`.
- The iframe title is provided by the post template (`post-page.html`) so screen readers announce the post title.

---

## Notes for future edits
- Keep the banner self-contained; don’t convert it into a template.
- Avoid changing asset paths unless you also update `regions.json`.
- If you need a taller/shorter banner, update `min-height` in `style.css` and the iframe aspect ratio in `frontend-ssg/sass/style.scss`.
