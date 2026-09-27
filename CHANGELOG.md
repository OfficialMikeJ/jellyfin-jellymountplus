# Changelog

## 1.2.0 — Plugin packaging

- `plugin/` now contains `Jellyfin.Plugin.JellymountPlus` — a real Jellyfin
  12.1 plugin project (net10.0, Jellyfin.Controller/Model 12.1.0).
- Theme installs as a plugin: embedded `theme.css`/`theme-full.css`/
  `extras.js`/`logo.svg` are served at `/JellymountPlus/Assets/*` (anonymous,
  read-only, whitelisted — no auth needed for `@import`/script tags).
- "Apply theme" writes `@import url('/JellymountPlus/Assets/theme.css')` into
  Jellyfin's Branding Custom CSS via `IServerConfigurationManager` — the
  supported mechanism on every platform, no webroot or index.html edits.
- Admin config page (Dashboard → Plugins → JellymountPlus): apply/remove,
  extras toggle, hero rotation, hover delay, logo text, debug.
- Extras bundle is served with `window.JellymountPlusConfig` generated from
  the saved plugin configuration.
- `dist/JellymountPlusPlugin_1.0.0.zip` = dll + meta.json, drops into the
  Jellyfin config volume's `plugins/` folder.
- AppBar spacer handling now targets the real `OffsetAppBar` markup
  (`div[aria-hidden]` sibling) verified against jellyfin-web v12.1 source.

## 1.1.0 — Restructured: theme vs. extras

- **The theme is now pure CSS.** `dist/jellymountplus.css` installs via
  Dashboard → Branding → Custom CSS. It restyles Jellyfin's own UI only —
  no injected controls, pages, or foreign UI.
- JellymountPlus wordmark renders via a CSS `::before` data-URI — no JS
  needed for branding.
- Nav bar keeps its translucent gradient on a subtle dark base so it reads
  correctly on every page without any scroll JS.
- JS features moved to `extras/` (hero, featured selector, hover preview,
  badges, My List relabel, username) — optional, off unless installed.
- Extras: hero mounts a `jmp-hero-active` class so CSS drops the AppBar
  spacer only where the hero exists (edge-to-edge under the nav).
- `dist/` now ships `jellymountplus.css` (theme), `jellymountplus-full.css`
  (theme + extras styles) and `jellymountplus-extras.js`.

## 1.0.0 — Initial release

- Project foundation: modular CSS architecture with design tokens
- Transparent→solid top navigation with JellymountPlus logo, My List link,
  username + caret, restyled MUI toolbar and legacy skinHeader
- Cinematic home hero: backdrop crossfade, clearlogo/title, metadata,
  overview, Play/Resume via Jellyfin's own action layer, My List favorites
  toggle
- Featured poster selector with keyboard support and optional auto-rotation
  (pause on hover/focus/hidden-tab/offscreen, reduced-motion aware)
- Dense poster + landscape content rails with edge fade and styled arrows
- Collision-aware expanded hover preview with play/resume/my-list/progress
- Continue Watching styling with thin progress bars
- Metadata badges (NEW / NEW EPISODE / NEW SEASON / JUST ADDED) from real
  item dates via batched lookups
- Cinematic item detail pages: taller backdrop, gradient stack, logo
  repositioning, restyled action buttons
- Search, Live TV + guide, and video OSD restyle
- Responsive breakpoints (mobile/tablet/ultrawide/4K) and reduced-motion
  accessibility support
- Build script producing flat `dist/` bundles for CSS-only and
  script-injector installs
