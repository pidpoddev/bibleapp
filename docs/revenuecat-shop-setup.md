# RevenueCat Shop Setup

Last updated: August 19, 2026

Faith Canvas uses RevenueCat as the purchase layer for optional Shop packs.

## Purchase model

- App download: free.
- Ads: none.
- Paid items: one-time, non-consumable digital sticker packs.
- Restore behavior: the Shop has a Restore button that asks RevenueCat and the store account for previous purchases.
- Entitlements: RevenueCat entitlements unlock the matching local Shop pack.
- Purchase identity: use RevenueCat's default anonymous/store-backed customer identity for launch. Do not collect a child email address for purchases.

## Customer identity posture

For launch on Google Play and the App Store, keep purchases tied to RevenueCat and the platform store account restore path. The app should not ask for a user email or child email before buying a sticker pack.

If account-based purchase recovery is added later, use a parent-approved account flow:

- Ask for a parent email only behind a parent gate.
- Do not use a raw email address as the RevenueCat App User ID.
- Use an internal app user ID and store the parent email only for account support or recovery.
- Update Google Play Data Safety, the privacy policy, and App Store privacy answers before release.

Rationale: Faith Canvas is positioned for kids and families. Avoiding in-app email collection keeps the launch privacy surface smaller while still supporting purchase restore through the platform store account.

## Environment variables

Set these for native builds:

```bash
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
```

These are RevenueCat public SDK keys, not server secrets. Do not add private RevenueCat API keys to the app.

Set them in EAS so cloud builds receive them:

```bash
eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value appl_... --environment production --visibility sensitive
```

If a platform key is missing, purchases stay unavailable and the Shop shows a parent-safe message instead of attempting payment.

Current setup:

- RevenueCat project: Faith Canvas (`97849657`).
- Play Store app: Faith Canvas (Play Store), package `com.pidpod.faithcanvas`, app identifier `app29f175825c`.
- RevenueCat Android public SDK key: set in EAS `production` as `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.
- RevenueCat iOS public SDK key: **not set**. Add the iOS app in RevenueCat after App Store Connect IAP credentials exist, then set `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` in EAS `production`, `preview`, and `development`.
- EAS production builds must use `"environment": "production"` in `eas.json` so these public SDK keys are baked into the binary. `.env.local` is not uploaded to EAS.

## Product IDs

Create these as one-time products in Google Play Console and App Store Connect, then attach them to RevenueCat products and entitlements.

| Pack | Store product ID | RevenueCat entitlement | RevenueCat status |
| --- | --- | --- | --- |
| Quiet Strength Stickers | `com.pidpod.faithcanvas.shop.quiet_strength_stickers` | `shop_pack_quiet_strength_stickers` | Product created and entitlement attached |
| Pressed Florals Stickers | `com.pidpod.faithcanvas.shop.pressed_florals_stickers` | `shop_pack_pressed_florals_stickers` | Product created and entitlement attached |
| Verse Markers Stickers | `com.pidpod.faithcanvas.shop.verse_markers_stickers` | `shop_pack_verse_markers_stickers` | Product created and entitlement attached |
| Soft Journal Decor Stickers | `com.pidpod.faithcanvas.shop.soft_journal_decor_stickers` | `shop_pack_soft_journal_decor_stickers` | Product created and entitlement attached |
| Pastel Note Papers | `com.pidpod.faithcanvas.shop.pastel_note_papers` | `shop_pack_pastel_note_papers` | Product created and entitlement attached (App Store + Play Store) |

Keep the product IDs identical across Google Play, App Store Connect, RevenueCat, and `utils/shop-products.ts`.

## Required console updates

Google Play Console:

- Google Payments merchant account must be created before Play Console allows access to one-time products.
- Monetization setup: in-app products available.
- Product type: one-time products.
- Create matching in-app products for all four product IDs above, with pricing and active status.
- RevenueCat Play Store service account JSON is still required for transaction validation.
- Google developer notifications are recommended in RevenueCat after the service account is connected.
- App content: in-app purchases are present.
- Data Safety: disclose RevenueCat purchase processing behavior if required by the final SDK/data prompts.
- Target Audience and Families: keep purchase prompts clear, non-deceptive, and parent-safe.

App Store Connect:

- Create the Faith Canvas App Store app with bundle ID `com.pidpod.faithcanvas`.
- RevenueCat App Store setup is blocked until App Store Connect provides the in-app purchase key `.p8`, Key ID, and Issuer ID.
- Add matching non-consumable in-app purchases.
- Add screenshots/review notes if Apple asks for in-app purchase review evidence.
- Include a restore purchases path, which the app now exposes in Shop.

RevenueCat:

- Android app, products, and entitlements are created.
- Each Android product is attached to the matching entitlement.
- Play Store product status currently shows `Could not check` until Google Play products and service account credentials are connected.
- Add the iOS app after App Store Connect in-app purchase credentials are available.
- Copy the public iOS SDK key into the native build environment once the iOS app is created in RevenueCat.

## QA before launch

- Purchase each paid pack in sandbox.
- Cancel a purchase and confirm no unlock occurs.
- Restore purchases on a clean install.
- Reload the app and confirm purchased packs still show Owned.
- Confirm unpaid packs remain locked in Shop.
- Confirm purchased pack assets appear in Studio and journal decoration tools.
- Confirm no ads or virtual currency language appears in the purchase flow.
