# App Store Compliance Worksheet

Last updated: August 19, 2026

## App record

- App name: Faith Canvas
- Bundle ID: `com.pidpod.faithcanvas`
- SKU suggestion: `faithcanvas`
- Primary language: English (U.S.)
- Developer account: Bumfuzzle Inc. (legal entity)
- Store brand: PidPod
- App: Faith Canvas, a PidPod app
- Price: Free with optional in-app purchases
- Category: Lifestyle (secondary: Education or Reference)
- Privacy policy URL: https://pidpod.com/faithcanvas/privacy.html
- Support URL: https://pidpod.com/faithcanvas/support.html
- Marketing URL: https://pidpod.com/faithcanvas/
- Support email: support@pidpod.com

## Launch position

Ship Apple and Google with the same local-first launch:

- No ads.
- No public profiles, chat, comments, followers, or social feed.
- Cloud Save off.
- Optional one-time sticker packs through the store + RevenueCat.
- Restore Purchases is on the Shop tab.
- Photo library access only when a family saves verse art or a journal image.

## Do not use Apple Kids Category

Match Google Play: expect **Teen / 13+** because the Bible includes violent, mature, or graphic wording. Do **not** check Made for Kids / Kids Category.

Kids Category blocks most third-party SDKs. RevenueCat validates purchases off-device, so Kids Category would likely be rejected or force a StoreKit-only rewrite.

Google Play can still use a families target audience. Apple’s Kids Category is stricter and is a different choice.

## Age rating answers

Answer for the full public-domain Bible text, not only the journaling UI. Google Play already rated this Teen (13+) for graphic wording in Scripture.

- Parental controls, age assurance, unrestricted web, public UGC, social, chat, ads: No
- Profanity or crude humor: Infrequent
- Horror/fear themes: Infrequent
- Alcohol, tobacco, or drug references: Infrequent
- Medical treatment / wellness product: None / No
- Mature or suggestive themes: Infrequent
- Sexual content or nudity: Infrequent
- Graphic sexual content: None
- Cartoon or fantasy violence: None
- Realistic violence: Infrequent
- Prolonged graphic or sadistic violence: None
- Guns or other weapons: Infrequent
- Gambling, contests, loot boxes: None
- Apple Kids Category: No

Expected result: 12+ or 13+ (Teen), aligned with Google Play. Explain this in Settings Help.

## App Privacy answers

Use the live launch build, not future Cloud Save plans.

Collected from the app (off-device):

| Data | Linked to identity | Used for tracking | Purpose |
| --- | --- | --- | --- |
| Purchase History | Yes, to the store/RevenueCat purchase account | No | App Functionality |
| Device ID (IDFV used by RevenueCat) | Yes, to the purchase account | No | App Functionality |
| Product Interaction for purchases | Yes, to the purchase account | No | App Functionality |

Not collected by the launch build:

- Journal text, prayer notes, verse art, favorites, and settings stay on device.
- Email, name, phone, contacts, precise location, advertising data, and tracking.

Third parties: Apple (App Store payments) and RevenueCat (purchase validation / restore). No advertising SDK.

If Apple asks whether the app tracks users: **No**. Do not add `NSUserTrackingUsageDescription`.

## In-app purchases

Create these as **Non-Consumable** products in App Store Connect. Keep the IDs identical to Google Play, RevenueCat, and `utils/shop-products.ts`.

| Pack | Product ID | Suggested price |
| --- | --- | --- |
| Quiet Strength Stickers | `com.pidpod.faithcanvas.shop.quiet_strength_stickers` | $0.99 |
| Pressed Florals Stickers | `com.pidpod.faithcanvas.shop.pressed_florals_stickers` | $0.99 |
| Verse Markers Stickers | `com.pidpod.faithcanvas.shop.verse_markers_stickers` | $0.99 |
| Soft Journal Decor Stickers | `com.pidpod.faithcanvas.shop.soft_journal_decor_stickers` | $0.99 |
| Pastel Note Papers | `com.pidpod.faithcanvas.shop.pastel_note_papers` | $0.99 |

Before products can be created:

1. Complete the Paid Applications Agreement, banking, and tax in App Store Connect.
2. Create the app record with bundle ID `com.pidpod.faithcanvas`.
3. Create an In-App Purchase key (Users and Access → Integrations → In-App Purchase) and download the `.p8`.
4. In RevenueCat, add the iOS app and paste Issuer ID, Key ID, and `.p8`.
5. Copy the RevenueCat **iOS public SDK key** (`appl_...`) into EAS production, preview, and development env as `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`.
6. Submit each IAP for review with the first app binary, or earlier if Apple allows.

Review note for IAP:

> Shop packs are optional one-time non-consumable sticker packs used in verse art and journals. Restore Purchases is on the Shop tab. The app can be reviewed without buying a pack. Cloud Save is disabled. No login is required.

## Screenshots

`supportsTablet` is true, so Apple needs iPhone **and** iPad screenshots.

Capture at least:

- iPhone 6.7" (required)
- iPhone 6.5" or 6.1" if App Store Connect still asks
- iPad 13" (required because the app supports iPad)

Show Home, Bible reading, Studio verse art, Journal, and Shop. Do not show placeholder or Expo Go chrome.

App icon upload file: `assets/brand/faith-canvas/upload/apple/faith-canvas-app-store-icon-1024.png` (1024, no alpha).

## Export compliance

`ITSAppUsesNonExemptEncryption` is already `false` in `app.json`. In App Store Connect, answer that the app uses only exempt encryption (HTTPS).

## Review access

All content is available without an account. No demo login.

Notes:

> Faith Canvas is a private Bible journaling app for families. There is no public social feature. Cloud Save is off. Optional sticker packs use StoreKit through RevenueCat. Photo library permission appears only if the reviewer saves an image.

## Content rights

Bible text is public-domain translations listed in Settings (BSB, BBE, WEB, and Spanish public-domain options). Stickers and icons are original Faith Canvas assets.

## Blockers before Submit for Review

- App Store Connect app exists with this bundle ID.
- Paid Apps agreement, bank, and tax are active.
- Four non-consumable IAPs are created and attached in RevenueCat.
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` is set in EAS production.
- A production iOS build (`eas build --platform ios --profile production`) has been uploaded to TestFlight.
- Sandbox purchase, cancel, restore, and reload are verified on a device (not Expo Go).
- Privacy policy is deployed with the Shop/RevenueCat language.
- `eas.json` submit can use Apple login, or you can add `ascAppId` and `appleTeamId` under `submit.production.ios` for non-interactive upload.
