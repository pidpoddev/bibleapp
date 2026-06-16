# Bible App Image Assets

Use the checked-in assets in this repo whenever a Bible App request calls for app imagery, icons, journal backgrounds, stickers, or shop artwork. Do not replace these with generated images, stock images, icon-library substitutes, or external downloads unless the user explicitly asks for new artwork.

Project files live on an SMB/NAS mount. Keep generated executables, dependency installs, and tool caches on the local system, not inside this repo.

Before adding or wiring new image assets, follow `ASSET_RENDERING_RUNBOOK.md`. New source artwork must have screen-sized preview variants for picker grids, cards, toolbar surfaces, and other small UI contexts.

## Canonical Asset Roots

- App and UI images: `assets/images/`
- Toolbar and journal icons: `assets/images/toolbar-icons/`
- Shop backgrounds: `assets/shop/backgrounds/`
- Shop stickers: `assets/shop/stickers/`
- App font used in Studio: `assets/fonts/PlaywriteDEGrund.ttf`

## Branding and System Images

These are the app identity assets used by Expo configuration in `app.json`.

| Use | Asset | Size |
| --- | --- | --- |
| Primary app icon | `assets/images/app-icon-pretty-bible.png` | 1024 x 1024 |
| Splash icon | `assets/images/splash-icon.png` | 1024 x 1024 |
| Web favicon | `assets/images/favicon.png` | 48 x 48 |
| Android adaptive foreground | `assets/images/android-icon-foreground.png` | 512 x 512 |
| Android adaptive background | `assets/images/android-icon-background.png` | 512 x 512 |
| Android monochrome icon | `assets/images/android-icon-monochrome.png` | 432 x 432 |
| Legacy/default icon | `assets/images/icon.png` | 1024 x 1024 |

When the user asks for the Bible App logo, app icon, splash image, favicon, or store/build icon, start with these files. Keep `app.json` references aligned with the assets above.

## Toolbar and Journal Icons

Use these PNGs for tab bars, journal cards, editor controls, and header icons.

| Use | Asset | Size |
| --- | --- | --- |
| Home tab | `assets/images/toolbar-icons/home-tab.png` | 350 x 350 |
| Bible tab/header | `assets/images/toolbar-icons/bible-tab.png` | 350 x 350 |
| Journal tab | `assets/images/toolbar-icons/journal-tab.png` | 295 x 295 |
| Favorites tab | `assets/images/toolbar-icons/favorites-tab.png` | 349 x 350 |
| Shop tab | `assets/images/toolbar-icons/shop-tab.png` | 320 x 320 |
| Prayer journal | `assets/images/toolbar-icons/journal-prayer.png` | 320 x 320 |
| Bible study journal | `assets/images/toolbar-icons/journal-bible-study.png` | 320 x 320 |
| Church day journal | `assets/images/toolbar-icons/journal-church-day.png` | 320 x 320 |
| Daily devotional journal | `assets/images/toolbar-icons/journal-daily-devotional.png` | 320 x 320 |
| Studio journal | `assets/images/toolbar-icons/journal-studio.png` | 320 x 320 |
| Text tool | `assets/images/toolbar-icons/text.png` | 75 x 62 |
| Text tool, tight | `assets/images/toolbar-icons/text-tight.png` | 256 x 256 |
| Canvas tool | `assets/images/toolbar-icons/canvas.png` | 85 x 87 |
| Canvas tool, tight | `assets/images/toolbar-icons/canvas-tight.png` | 349 x 350 |
| Decor tool | `assets/images/toolbar-icons/decor.png` | 71 x 70 |
| Decor tool, tight | `assets/images/toolbar-icons/decor-tight.png` | 352 x 350 |
| Notes tool | `assets/images/toolbar-icons/notes.png` | 71 x 78 |
| Notes tool, tight | `assets/images/toolbar-icons/notes-tight.png` | 500 x 498 |
| More tool | `assets/images/toolbar-icons/more.png` | 57 x 57 |
| More tool, tight | `assets/images/toolbar-icons/more-tight.png` | 251 x 250 |

Prefer the existing icon for a matching concept before reaching for `@expo/vector-icons`, SF Symbols, Lucide, emoji, or hand-drawn SVG.

## Journal and Studio Backgrounds

Use `assets/images/lined-paper.png` as the default lined journal paper. It is 1024 x 768.

The Soft Glitter background pack lives in `assets/shop/backgrounds/soft-glitter/`; every image is 2048 x 2048 and is wired through `utils/shop-backgrounds.ts`.

- `pearl-white-shimmer.png`
- `warm-pearl-sparkle.png`
- `lavender-sparkle.png`
- `lavender-mist.png`
- `lavender-dream.png`
- `champagne-glimmer.png`
- `blush-pink-shimmer.png`
- `blush-pink-glow.png`
- `champagne-soft.png`
- `champagne-sparkle.png`

When adding UI that lets users choose backgrounds, use the existing `SHOP_BACKGROUND_PACKS`, `SOFT_GLITTER_BACKGROUNDS`, `SHOP_BACKGROUNDS`, and `getShopBackground` exports from `utils/shop-backgrounds.ts`.

## Sticker Assets

Sticker packs are wired through `utils/shop-stickers.ts`. Use those exports instead of hard-coding separate sticker registries.

### Floral Faith Stickers

These live in `assets/shop/stickers/floral-faith/`.

- `faith.png`
- `hope.png`
- `love.png`
- `grace.png`
- `blessed.png`
- `joy.png`
- `peace.png`
- `mercy.png`
- `prayer.png`
- `worship.png`
- `praise.png`
- `glory.png`
- `holy.png`
- `amen.png`
- `hallelujah.png`
- `unshaken.png`
- `fearless.png`
- `bloom.png`
- `shine.png`
- `gather.png`
- `graceful.png`
- `faith-floral.png`

`faith-floral.png` exists as a 1024 x 1024 image, but the current `SHOP_STICKERS` alias maps `faith-floral` to the `faith.png` sticker. Check `utils/shop-stickers.ts` before changing that behavior.

### Scripture Verse Label Stickers

These live in `assets/shop/stickers/scripture-verse-labels/`.

- `do-everything-in-love.png`
- `life-light.png`
- `rejoice-always.png`
- `do-to-others.png`
- `christ-strengthens-me.png`
- `strong-take-heart.png`
- `give-thanks-circumstances.png`
- `minds-above.png`
- `lord-good-love-endures.png`
- `first-loved-us.png`
- `joyful-hope.png`
- `impossible-for-god.png`
- `walk-by-faith.png`
- `guard-your-heart.png`
- `everything-possible.png`
- `lord-shepherd.png`
- `god-within-her.png`
- `give-thanks-always.png`
- `pray-without-ceasing.png`
- `look-to-lord.png`
- `hope-in-lord.png`
- `trust-in-you.png`
- `strength-defense.png`
- `love-you-lord.png`
- `delight-yourself.png`
- `spirit-not-fear.png`
- `strength-shield.png`
- `brokenhearted.png`
- `trust-in-lord.png`
- `waters-with-you.png`

Most scripture label stickers are 1050 x 447. The square-style labels are 902 x 900: `delight-yourself.png`, `spirit-not-fear.png`, `strength-shield.png`, `brokenhearted.png`, `trust-in-lord.png`, and `waters-with-you.png`.

## Placeholder Images

The following images are default React/Expo placeholder assets, not Bible App brand assets:

- `assets/images/react-logo.png`
- `assets/images/react-logo@2x.png`
- `assets/images/react-logo@3x.png`
- `assets/images/partial-react-logo.png`

Do not use these for Bible App design, branding, app store, journal, shop, or production UI requests unless the task is specifically about removing or replacing the placeholder screen that still references them.

## Implementation Rules

- In React Native or Expo code, use static `require(...)` imports for local PNG assets so Metro can bundle them.
- For shop backgrounds, use `utils/shop-backgrounds.ts` and `getShopBackground`.
- For stickers, use `utils/shop-stickers.ts` and `getShopSticker`.
- Preserve existing image aspect ratios unless a component intentionally crops with `resizeMode="cover"`.
- Before adding new image files, check this document and the existing asset directories for a matching asset.
- If new artwork is explicitly requested, add it under the closest matching `assets/` subdirectory and update this document plus the relevant utility registry.
