# Faith Canvas Shop Project Manager

## Mission

Fill the Faith Canvas shop with items girls will actually want to use when decorating journals, prayer pages, Bible study notes, and verse art.

The shop should feel sweet, creative, faith-filled, and collectible without becoming cluttered, childish in a generic way, or hard to read at sticker-picker size.

## Primary Customer

- Girls roughly ages 8-15 who like journals, stickers, soft colors, cute icons, affirming words, and making pages feel personal.
- Parents or guardians who want faith-based creative supplies that feel safe, gentle, and age-appropriate.
- Families using Faith Canvas for prayer journaling, verse art, daily devotionals, and Bible study pages.

## Product Taste Rules

Every shop item should pass these checks:

- Cute at first glance.
- Readable at small picker size.
- Useful on a journal page, not just pretty in isolation.
- Faith-forward without feeling like a sermon graphic.
- Soft Faith Canvas palette: cream, blush, coral, sage, mint, sky blue, dusty rose, warm gold.
- Bold enough to survive a 52px picker thumbnail.
- No tiny Bible page lines, thin dove outlines, micro flowers, or decorative noise that disappears when scaled down.
- No guilt, fear, shame, prosperity promises, pressure language, or manipulative purchase framing.

## Current Shop Reality

The app currently supports:

- Background packs through `utils/shop-backgrounds.ts`.
- Sticker packs through `utils/shop-stickers.ts`.
- Preview assets through `assets/shop/background-previews/` and `assets/shop/sticker-previews/`.
- Full assets through `assets/shop/backgrounds/` and `assets/shop/stickers/`.

Purchases are not fully connected yet, so packs can be marked included or prepared for later unlock behavior. Until purchase flow is finished, prioritize making the catalog desirable and easy to test.

## Project Manager Responsibilities

1. Maintain a balanced shop roadmap.
2. Turn rough ideas into scoped product briefs.
3. Prioritize packs that make journal pages better immediately.
4. Reject art that is unreadable, too generic, too detailed, or off-brand.
5. Keep a visible backlog of item ideas, status, target audience, and production notes.
6. Make sure every new visual pack follows `ASSET_RENDERING_RUNBOOK.md`.
7. Validate shop items inside the actual app at `/shop`, Studio, and at least one journal surface.

## Shop Categories To Build

### Sticker Packs

Best for quick collectible value. These should be bold, puffy, and readable.

Examples:

- Sweet Faith Icons
- Prayer Girl Desk Stickers
- Bible Study Besties
- Sunday Morning Sticker Pack
- Hearts and Halos
- Verse Mood Stickers
- Worship Night Stickers
- Soft School Faith Stickers

### Background Packs

Best for repeat use in journals and Studio. These should be soft enough for text to remain readable.

Examples:

- Pastel Notebook Paper
- Soft Floral Margins
- Glitter Cloud Paper
- Sunday Sunrise Paper
- Cozy Desk Devotional Pages
- Verse Card Gradient Paper

### Verse Card Templates

Best for more premium-feeling shop items. These should give girls a starting layout for favorite verses.

Examples:

- Heart Verse Cards
- Floral Scripture Cards
- Lock Screen Verse Cards
- Polaroid Verse Notes
- Prayer Request Cards

### Journal Page Kits

Best for bundles. A kit combines stickers, background paper, and matching labels.

Examples:

- Prayer Night Kit
- Bible Study Sleepover Kit
- Sunday Notes Kit
- Thankful Heart Kit
- Brave Girl Faith Kit

## Prioritization Score

Use a 1-5 score for each:

- Desire: Would a girl want to decorate with this?
- Usefulness: Does it improve real journal pages?
- Readability: Does it survive small picker sizes?
- Brand Fit: Does it match Faith Canvas?
- Production Ease: Can it be built without too much rework?

Prioritize items with total score 20 or higher. Do not build items below 16 unless they unlock a necessary category.

## Production Workflow

1. Brief

   Define title, audience, pack type, item count, palette, style, exact text, and reject criteria.

2. Art Direction

   Choose the dominant shape language before making assets. For Faith Canvas, prefer puffy stickers, soft die-cut labels, bold word art, gentle hearts, bows, simple flowers, stars, clouds, and clean faith symbols.

3. Asset Creation

   Use AI image generation for shop artwork. Do not substitute hand-rendered, code-generated, or placeholder art for final sticker, background, kit, or template assets unless the user explicitly approves a temporary placeholder.

   Create full PNG assets in the matching source folder. Create matching preview PNGs in the preview folder.

   For any AI-generated asset with words, QA the visible text against the approved copy before wiring it into the app. Reject or regenerate artwork with misspellings, missing words, extra words, unreadable text, distorted letters, or wording that changes the intended message.

4. Registry

   Wire packs through `utils/shop-stickers.ts` or `utils/shop-backgrounds.ts`. Do not hard-code separate shop item lists.

5. Tiny-Size QA

   Check a contact sheet at the actual picker size:

   - Sticker picker: about 52px in journals and Studio.
   - Shop detail grid: about 80-120px depending on screen.
   - Canvas placement: about 132-142px.

6. App QA

   Check:

   - `/shop` pack card and detail grid.
   - Studio sticker tray or background tray.
   - Prayer Journal decoration tray.
   - One placed item on a page.

7. Verdict

   Mark the pack as:

   - `ready`
   - `needs-art-redo`
   - `needs-copy-fix`
   - `needs-app-wiring`
   - `hold-for-purchase-flow`

## First 30-Day Plan

### Week 1: Fix the Core Visual Bar

- Finish one strong sticker pack that is readable and cute at picker size.
- Create one matching soft background pack.
- Establish contact sheet QA at 52px, 132px, and shop-card size.

### Week 2: Build The First Themed Bundle

- Create a coordinated journal kit: stickers plus backgrounds plus labels.
- Recommended first kit: `Prayer Night Kit`.

### Week 3: Expand Choice

- Add one school/friendship-themed faith pack.
- Add one verse-card template set.

### Week 4: Shop Polish

- Review shop category naming.
- Decide which packs are included vs locked.
- Keep purchase metadata aligned with `docs/revenuecat-shop-setup.md`.
- Verify purchase, cancel, restore, and reload behavior before marking a paid pack ready.

## Acceptance Criteria For A New Pack

A pack is ready only when:

- It includes the promised item count.
- Every item has a full asset and preview asset.
- Every sticker has transparent corners.
- AI-generated artwork was used for final image assets unless the user explicitly approved a temporary placeholder.
- Every visible word in the artwork matches the approved copy exactly.
- Text is readable at picker size.
- Icons are recognizable at picker size.
- The pack title and subtitle are clear.
- The pack is wired through the proper shop registry.
- `npm run lint` passes.
- `/shop` loads successfully on the local preview.

## Copy/Paste Manager Prompt

Use this when asking Codex or another assistant to manage the shop:

```text
Act as the Faith Canvas Shop Project Manager. Your job is to fill the shop with cute, faith-based items girls will want to use in journals, prayer pages, Bible study notes, and verse art.

Follow docs/shop-project-manager.md and docs/shop-item-backlog.csv. Prioritize readable, puffy, pastel, Faith Canvas themed items that work at small picker size. Reject thin line art, tiny details, generic religious clipart, and anything that is not useful on a journal page.

For each new item, produce a brief, define the asset list, update the backlog status, create AI-generated source artwork and preview assets, QA every visible word against the approved copy, wire the shop registry, run lint, and verify /shop.
```
