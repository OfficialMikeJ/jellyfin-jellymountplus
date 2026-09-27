# JellymountPlus

A cinematic dark **theme** for **Jellyfin Web 12.1** — near-black surfaces,
white text, blue accent, dense poster rails, restyled detail pages, player OSD
and Live TV. It restyles Jellyfin's own UI only: no injected controls, no new
pages, no foreign UI. Install = paste one CSS file.

All artwork and metadata come live from your Jellyfin server. Nothing is
bundled, no Paramount branding is used, and Jellyfin is never renamed —
"JellymountPlus" appears only as a small wordmark you can replace in
`assets/logo/`.

## Install — as a Jellyfin plugin (recommended)

`dist/JellymountPlusPlugin_1.0.0.zip` contains the plugin
(`JellymountPlusPlugin.dll` + `meta.json`).

1. Extract the zip into your Jellyfin **config** directory's plugins folder:
   `<config>/plugins/JellymountPlus/`.
   - Synology DSM package: `/volume1/@appdata/jellyfin/plugins/JellymountPlus/`
     (adjust the volume/appdata path to your install).
   - Docker: the `plugins/` folder inside your mounted config volume.
   - Windows server: `C:\ProgramData\Jellyfin\Server\plugins\JellymountPlus\`.
2. Restart Jellyfin.
3. Dashboard → **Plugins** → **JellymountPlus** → **Apply theme**.

"Apply" writes `@import url('/JellymountPlus/Assets/theme.css')` into
Dashboard → Branding → Custom CSS. The stylesheet is served by the plugin
itself, so nothing has to be written into the webroot and it survives
upgrades. Remove is one click in the same page.

### Manual CSS alternative (no plugin)

Dashboard → **Branding** → **Custom CSS** → paste `dist/jellymountplus.css`.
Identical visuals on every platform; the plugin just automates it and adds
extras support.

### What you get

- Top navigation: translucent dark bar, JellymountPlus wordmark, tighter
  link styling, restyled menus and avatar area.
- Home rails: large ~2:3 posters and 16:9 landscape cards, tight gaps,
  edge-peek fade, styled scroll arrows, thin progress bars, played ticks.
- Detail pages: taller backdrop, gradient stack, restyled action buttons.
- Search, Collections, Live TV + guide, video player OSD.
- Responsive density for mobile/tablet/ultrawide/4K, reduced-motion support,
  visible focus outlines.

Everything is stock Jellyfin DOM — every button, menu and action is the same
one Jellyfin ships; only the look changes.

## Optional extras (not part of the theme)

`extras/` holds an **optional JavaScript layer** that goes beyond theming:
it injects a Paramount-style home hero with featured selector, expanded
hover previews, and "NEW / JUST ADDED" badges. These are *not* part of the
theme — they add UI Jellyfin doesn't have. If you don't want that, ignore
`extras/` entirely.

With the plugin installed:

1. Plugin config page → **Enable extras bundle** → Save.
2. Plugins can't inject `<script>` into the web client by themselves, so add
   one via the **JavaScript Injector** or **File Transformation** plugin:

   ```html
   <script defer src="/JellymountPlus/Assets/extras.js"></script>
   ```

   or in JS Injector:

   ```js
   var s = document.createElement('script');
   s.src = '/JellymountPlus/Assets/extras.js'; s.defer = true;
   document.head.appendChild(s);
   ```

3. Click **Apply theme** again so the full stylesheet is used.

The extras bundle is served with your plugin settings baked in
(`window.JellymountPlusConfig`), and Play/Resume still route through
Jellyfin's own `data-action` machinery — nothing is reimplemented.

`extras/preview/` is a dev harness (mocked Jellyfin DOM/API) used to verify
the extras visuals without a server: serve the project root and open
`/extras/preview/index.html`.

## Configuration (extras only)

Set `window.JellymountPlusConfig` before the loader runs:

```html
<script>
window.JellymountPlusConfig = {
  hero: true,               // cinematic hero on the home tab
  heroAutoRotate: true,     // slow rotation of featured items
  heroRotateMs: 18000,
  heroItemLimit: 8,
  hoverPreview: true,
  hoverPreviewDelayMs: 420,
  logoText: 'JellymountPlus',
  logoUrl: null,            // e.g. 'JellymountPlus/assets/logo/jellymountplus.svg'
  debug: false
};
</script>
```

## File structure

```
JellymountPlus/
├── dist/
│   ├── jellymountplus.css          ← THE THEME (paste into Branding CSS)
│   ├── jellymountplus-full.css     ← theme + extras styles
│   └── jellymountplus-extras.js    ← bundled optional extras
├── styles/                         # modular CSS source
│   ├── jellymountplus.css          # @import entry (theme + extras styles)
│   ├── variables.css  base.css     # tokens, surfaces, typography
│   ├── navigation.css              # top nav (MUI + legacy header)
│   ├── rails.css  cards.css        # rows, cards, badges, progress
│   ├── hero.css  hover-preview.css # extras-only styles
│   ├── details.css  search.css  livetv.css  player.css
│   └── responsive.css  accessibility.css
├── extras/                         # OPTIONAL injected-UI layer
│   ├── jellymountplus-loader.js    # single-tag bootstrap
│   ├── scripts/                    # core + navigation/hero/rails/preview/details
│   └── preview/                    # dev harness (mock DOM + ApiClient)
├── assets/logo/jellymountplus.svg  # replaceable wordmark
├── build.sh / build.ps1            # regenerate dist/
└── README.md · CHANGELOG.md
```

## Development

Edit `styles/` (theme) or `extras/scripts/` (extras), then:

```powershell
powershell -File build.ps1    # Windows
./build.sh                    # bash
```

## Design rules honored

- No Paramount name, logos, artwork or branded assets anywhere.
- No hard-coded titles, IDs, users or URLs — everything is queried through
  `window.ApiClient` (extras) or already rendered by Jellyfin (theme).
- The theme adds zero UI: every visible control is Jellyfin's own.
- Animations use transform/opacity only; reduced-motion respected.
