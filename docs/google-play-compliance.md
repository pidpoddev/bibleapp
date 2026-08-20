# Google Play Compliance Worksheet

Last updated: July 11, 2026

## App record

- App name: Faith Canvas
- Package name: com.pidpod.faithcanvas
- Developer account: Bumfuzzle Inc.
- App type: App
- Price: Free with optional in-app purchases
- Default language: English (United States)
- Privacy policy URL: https://pidpod.com/faithcanvas/privacy.html
- Support URL: https://pidpod.com/faithcanvas/support.html
- Child safety URL: https://pidpod.com/faithcanvas/safety.html
- Support email: support@pidpod.com

## Launch compliance position

Faith Canvas should launch on Google Play as a local-first kids and families app.

- No third-party advertising.
- Optional Shop purchases use Google Play Billing through RevenueCat for one-time digital pack unlocks.
- No public profiles, followers, public posting, comments, open chat, or social feed.
- No precise location, contacts, camera, microphone, phone, SMS, call log, or advertising ID permissions.
- Photo library permission is requested only when a user chooses to save journal or verse-art images to the device.
- Cloud Save is disabled for the Google Play launch build.
- Local reset and export controls are available in Settings.
- Public privacy, support, and child-safety pages are live on pidpod.com.

## Play Console declarations

### Ads

Answer: No, the app does not contain ads.

### App access

Answer: All app content is available without account sign-in. No reviewer credentials are required.

Suggested note:

Faith Canvas can be reviewed without signing in. The Google Play launch build keeps saved journals, favorites, verse art, and settings on the device. Cloud Save is disabled for launch.

### Target audience and content

Recommended target audience: children and families, using only the age groups that match the final store positioning.

Recommended current positioning:

- Ages 6-8
- Ages 9-12
- Ages 13-15
- Ages 16-17
- Ages 18 and over

Rationale: Faith Canvas is designed for family Bible journaling and creative reflection. The app has no ads, no public social features, and no Cloud Save transmission in the Google Play launch build.

If the final store copy is changed to target only teens or adults, update this section before answering Play Console.

### Special app categories

Select:

- Apps designed for kids or families

Do not select:

- COVID-19 proof of vaccination or contact tracing apps
- Government apps
- Election apps
- News apps
- Telehealth or medical apps
- Tobacco apps
- Banking apps
- Crowdfunding or microloan apps
- Cryptocurrency wallet or exchange apps
- Personal loan apps
- Real-money gambling apps
- Any other financial products or services

### Free or paid

Answer: Free.

Rationale: The app itself is free to download. Optional Shop packs are configured as in-app purchases, not as an upfront paid app.

### In-app purchases

Answer: Yes, the app offers in-app purchases.

Current purchase model:

- One-time, non-consumable sticker pack unlocks.
- No ads.
- No virtual currency.
- No subscription in the first paid Shop setup.
- Restore purchases is available in the Shop.

## Data Safety draft

Use the live app behavior, not future plans.

### Collection

The Google Play launch build should disclose no automatic collection of journal content through Cloud Save because Cloud Save is disabled.

Potential disclosures:

- RevenueCat and Google Play Billing process purchase status for optional Shop unlocks. Recheck the final Data Safety prompts after the production AAB includes the RevenueCat SDK.
- User-provided support email data may be collected only when a user voluntarily emails support outside the app.
- App activity/content is stored locally on-device and is not transmitted by the launch build.
- Photo/media access is device-local and only used when saving an image to the user's device.

If Google asks specifically whether data is collected from the app, answer based on whether the app transmits that data off-device. Google defines collection as transmitting data off the user's device.

### Sharing

Answer: No user data is shared with third parties for advertising or analytics.

### Security practices

- Data is encrypted in transit for any HTTPS pages or support-site access.
- Local app data can be reset in Settings.
- Data deletion requests can be sent to support@pidpod.com for support records or future service records.
- Families policy commitment is appropriate if the final build remains aligned with this worksheet.

## Permissions

Expected Android permission posture:

- Photo/media save permission may appear because the app lets users save images.
- Broad media read permissions are blocked in app.json.
- No location, contacts, camera, microphone, phone, SMS, call log, or advertising ID permissions should be present.

Check the final Android App Bundle before submission.

## Release blockers

Do not submit for production review until these are complete:

- Final Android App Bundle is built and checked for permissions.
- Google Play in-app products are created and mapped in RevenueCat.
- RevenueCat Android public SDK key is set for the production build.
- Sandbox purchase, cancel, restore, and reload persistence are verified.
- Store listing text matches this local-only launch posture.
- Data Safety, Target Audience, Content Rating, Ads, App Access, Privacy Policy, and Families sections are completed in Play Console.
- At least one local QA pass confirms Settings shows Cloud Save off for launch and journal/studio screens do not show Save to Cloud actions.

## Official references

- Google Play Families Policy: https://support.google.com/googleplay/android-developer/answer/9893335
- Manage target audience and app content: https://support.google.com/googleplay/android-developer/answer/9867159
- Google Play User Data policy: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Prepare your app for review: https://support.google.com/googleplay/android-developer/answer/9859455
