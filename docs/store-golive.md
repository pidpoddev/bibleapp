# Faith Canvas dual-store go-live

Last updated: August 19, 2026

Use this as the operational list after Google Play is moving and Apple still needs a first production binary.

## Current status (repo / EAS)

| Item | Android | iOS |
| --- | --- | --- |
| Bundle / package | `com.pidpod.faithcanvas` | `com.pidpod.faithcanvas` |
| Production store binary | Yes — AAB `1.0.0` (4), July 2026 | No production IPA yet. Only an internal development build exists. |
| RevenueCat public SDK key in EAS `production` | Set (`goog_...`) | **Missing** |
| Cloud Save | Off | Off |
| Shop restore | Implemented | Implemented, but purchases stay unavailable until the iOS key is in the binary |

## 1. Finish Apple commerce (you, in consoles)

These cannot be done from the repo:

1. In [App Store Connect](https://appstoreconnect.apple.com), create Faith Canvas with bundle ID `com.pidpod.faithcanvas` if it does not exist.
2. Complete Paid Applications Agreement, banking, and tax.
3. Create the four non-consumable product IDs in `docs/revenuecat-shop-setup.md`.
4. Create an In-App Purchase API key and add it to RevenueCat for the iOS app.
5. Copy the RevenueCat iOS public SDK key.

Then set it for EAS (replace the value):

```bash
eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value appl_YOUR_KEY --environment production --visibility sensitive
eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value appl_YOUR_KEY --environment preview --visibility sensitive
eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value appl_YOUR_KEY --environment development --visibility sensitive
```

Copy the existing Android key into `preview` and `development` the same way if those profiles still show “No variables found”.

6. After the first App Store Connect app exists, you can add its numeric Apple ID and Team ID under `submit.production.ios` in `eas.json` so `npm run eas:submit:ios` can run non-interactively. Until then, EAS will ask for Apple login during submit.

## 2. Deploy privacy copy

The launch privacy/support pages now mention both stores and RevenueCat. Publish `deploy/pidpod-faithcanvas/` to `https://pidpod.com/faithcanvas/` before Apple review so the live privacy URL matches the binary claims.

## 3. Build and upload iOS

From the project root, logged into EAS as `pidpoddev`:

```bash
npm run eas:build:ios
```

When the production IPA finishes:

```bash
npm run eas:submit:ios
```

That sends the build to TestFlight. Internal testers can sandbox-purchase before App Review.

Do not use Expo Go for purchase QA.

## 4. Apple listing

Fill App Store Connect using `deploy/pidpod-faithcanvas/GOLIVE_COPY.md` and `docs/app-store-compliance.md`.

Minimum screenshots: iPhone 6.7" and iPad 13", because iPad is enabled.

## 5. Google Play (keep moving)

Production AAB already exists. Submit profile in `eas.json` uses the **internal** track and **draft** so a later Android rebuild is not auto-published.

```bash
npm run eas:build:android
npm run eas:submit:android
```

Play Console still needs Data Safety, target audience, IAP products mapped in RevenueCat, and the store listing to match the local-only launch. See `docs/google-play-compliance.md`.

## 6. QA both stores

On a device build, not Expo Go:

- Buy one paid pack, force-quit, confirm Owned.
- Cancel a purchase, confirm it stays locked.
- Restore on a clean install.
- Confirm unpaid packs stay locked.
- Confirm Settings says Cloud Save is off and no Save to Cloud button appears.
- Confirm saving a verse image prompts for Photos only then.

## What this repo cannot do for you

Apple Developer login, App Store Connect IAP keys, RevenueCat iOS app credentials, store screenshots, and the first “Submit for Review” tap all need a human in those consoles. After the iOS public SDK key is in EAS, the next step in this repo is `npm run eas:build:ios`.
