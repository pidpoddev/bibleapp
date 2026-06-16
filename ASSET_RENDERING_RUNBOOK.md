# Asset Rendering Runbook

Every new image asset must be rendered down to the size needed by each app surface before it is wired into UI. Do not make picker grids, tab bars, cards, or toolbar controls load full-resolution artwork when the display size is small.

This is required because Expo Go and Metro serve assets over the development connection. Oversized preview images can make the app feel slow and can cause small icons to appear late or inconsistently.

## Required Rule

For every new visual asset, keep these variants when the asset is used in more than one context:

| Variant | Purpose | Typical max dimension | Location |
| --- | --- | --- | --- |
| Source/full asset | Canvas placement, export, screenshots, final saved designs | Original needed quality | Existing source folder |
| Preview asset | Shop cards, Studio pickers, journal decorators, horizontal grids | 240 px for stickers, 360 px for backgrounds | Matching `*-previews/` folder |
| Small UI icon | Tab bars, toolbar buttons, compact cards | 32-96 px rendered size, usually 128-360 px file max | `assets/images/toolbar-icons/` or nearest UI folder |

Never point a preview grid at a multi-megabyte source file unless the asset is displayed near full size.

## Current Preview Roots

- Full shop backgrounds: `assets/shop/backgrounds/`
- Background previews: `assets/shop/background-previews/`
- Full shop stickers: `assets/shop/stickers/`
- Sticker previews: `assets/shop/sticker-previews/`

When adding a new pack, create the same source-vs-preview structure for that pack.

## Registry Contract

Asset registries should expose both sources:

```ts
image: require('../assets/shop/stickers/example-pack/full-size.png'),
previewImage: require('../assets/shop/sticker-previews/example-pack/full-size.png'),
```

Picker and browsing UI must use:

```tsx
source={asset.previewImage ?? asset.image}
```

Canvas placement, export, saved designs, and final artwork rendering should keep using:

```tsx
source={asset.image}
```

## Target Sizes

Use these default maximum dimensions unless a specific screen needs something different:

- Sticker picker thumbnails: max `240px`.
- Background picker thumbnails: max `360px`.
- Toolbar and tab icons: max `360px`, but prefer much smaller source files when the icon renders under 32px.
- Full-screen or export-quality backgrounds: keep the source file, but add a preview if it appears in a chooser.

Preserve aspect ratio. Preserve transparency for stickers and icons.

## Manual Generation

On macOS, `sips` is available without adding project dependencies. Run commands from the repo root.

Background previews:

```bash
mkdir -p assets/shop/background-previews/<pack-name>
for f in assets/shop/backgrounds/<pack-name>/*.png; do
  sips -Z 360 "$f" --out "assets/shop/background-previews/<pack-name>/$(basename "$f")"
done
```

Sticker previews:

```bash
mkdir -p assets/shop/sticker-previews/<pack-name>
for f in assets/shop/stickers/<pack-name>/*.png; do
  sips -Z 240 "$f" --out "assets/shop/sticker-previews/<pack-name>/$(basename "$f")"
done
```

Do not install image tools or executable dependencies into this repo. Project files are on an SMB/NAS-backed path; keep dependency installs, tool caches, and generated executables on the local system.

## Checklist For New Assets

1. Add source images under the matching `assets/` source folder.
2. Generate preview images under the matching preview folder.
3. Check preview file sizes before wiring UI:

```bash
du -sh assets/shop/background-previews assets/shop/sticker-previews
find assets/shop/background-previews assets/shop/sticker-previews -type f -print0 | xargs -0 ls -lh | sort -k5 -hr | head
```

4. Update the registry with both `image` and `previewImage`.
5. Use `previewImage ?? image` in picker grids and card previews.
6. Keep `image` for actual canvas placement and export-quality rendering.
7. Run `npm run lint`.
8. Hit the affected Expo route on `8081` so Metro compiles the new static `require(...)` paths.

## Performance Guardrails

- Avoid preview files over `500KB`; investigate any preview over that size.
- Avoid loading more than one full-size background or sticker pack on initial screen render.
- Prefer lazy rendering for large packs or grids.
- If Expo Go becomes slow or icons appear late, inspect total asset size first:

```bash
du -sh assets assets/shop assets/shop/backgrounds assets/shop/background-previews assets/shop/stickers assets/shop/sticker-previews
```
