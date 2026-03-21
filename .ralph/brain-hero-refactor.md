# Brain hero refactor

Replace the iframe-based brain post banner with a native Astro/MDX + Three.js implementation, optimize performance, and clean up post hero semantics for maintainability.

## Goals
- Replace the brain post iframe with a native Astro component rendered through the normal post page.
- Use idiomatic Astro + MDX patterns that are easy to maintain for future posts.
- Optimize Three.js loading, rendering, and interaction performance.
- Remove the Geist Pixel font usage from the brain hero and align it with site typography.
- Leave the codebase in a cleaner state than before.

## Checklist
- [ ] Audit the existing post rendering and brain banner implementation.
- [ ] Design a maintainable post hero API and migrate legacy hero frontmatter.
- [ ] Refactor the brain post to use the native hero.
- [ ] Tune the Three.js scene for loading/runtime performance and accessibility.
- [ ] Remove obsolete iframe-only assets/code paths if no longer needed.
- [ ] Run verification checks and summarize follow-up notes.

## Verification
- Pending

## Notes
- Started by auditing existing post rendering, MDX content, and the current native-but-unused brain hero React/Three scene.
- Legacy fields currently in use: `bannerIframe` for `brain.mdx` and `useImageAsTitle` for `notes.mdx`.
