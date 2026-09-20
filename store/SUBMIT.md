# Vita Plena — from "I have a Mac" to "it's in the store"

Every step, in order, written for someone who has never opened Xcode. The
code side is done: the iOS and Android projects are in `ios/` and `android/`,
the icons and launch screens are drawn, the permission strings are written,
the privacy manifest is in place, the screenshots and listing copy are in
`store/`. What remains needs accounts and a Mac, so it is yours to do.

Budget: Apple Developer Program $99/year. Google Play Console $25 once.
RevenueCat is free until the app makes real money. Time: an afternoon for the
first build on your Mac; a few days of waiting on Apple in between.

---

## Part 1 — The Mac, once

### 1. Install the tools

1. Mac App Store → search **Xcode** → Get. It is large (about 12 GB); let it finish.
2. Open Xcode once. Agree to the licence. When it offers to install additional components, say yes.
3. Install Node: go to https://nodejs.org and download the **LTS** installer (20 or newer). Run it.
4. Open **Terminal** (Spotlight: type Terminal). Check both:
   ```
   node -v
   xcodebuild -version
   ```
   Each should print a version.
5. Get the code: in Terminal,
   ```
   cd ~/Desktop
   git clone https://github.com/drmcampbell14/vitaplena.git
   cd vitaplena
   npm install
   ```
   (If `git` asks to install command-line tools, say yes and re-run.)

### 2. Build the app and open it in Xcode

```
npm run ios
```
That builds the site, copies it into the iOS project, and opens Xcode on `ios/App/App.xcodeproj` (Capacitor 8 uses Swift Package Manager; there is no workspace and no CocoaPods to install). The first open takes a minute while packages resolve; watch the top bar.

Run it in the simulator before anything else: in the top bar pick **iPhone 16 Pro** (any iPhone) as the device and press the ▶ button. The splash shows, then the sign-in screen. Tap "Look around first". This needs no Apple account.

---

## Part 2 — Apple, once

### 3. Enrol in the Apple Developer Program

1. https://developer.apple.com/programs/enroll/ → **Start Your Enrollment** → sign in with your Apple ID (turn on two-factor if asked).
2. Entity type: **Individual** is fine to start (the store shows your name as the seller; you can move to an organisation later, which needs a D-U-N-S number). Pay the $99.
3. Wait for the "welcome" email. Usually a day; sometimes Apple phones to confirm identity.

### 4. Sign the app in Xcode

1. Xcode → **Settings** (⌘,) → **Accounts** → **+** → Apple ID → sign in with the enrolled account.
2. In the project: click **App** at the top of the left file list → the **App** target → **Signing & Capabilities** tab.
3. Tick **Automatically manage signing**. **Team**: pick your name (the paid team, not "Personal Team").
4. Xcode registers the bundle id `com.cognitivechristian.vitaplena` for you. If it says the id is taken, it's yours already from an earlier attempt: Apple Developer → Certificates, Identifiers & Profiles → Identifiers, and reuse it.
5. Still in Signing & Capabilities → **+ Capability** → add **Push Notifications**? No. The bells are local notifications; they need no capability. Add nothing here yet.

### 5. Create the app record

1. https://appstoreconnect.apple.com → **My Apps** → **+** → **New App**.
2. Platforms: iOS. Name: **Vita Plena**. Primary language: English (U.S.). Bundle ID: pick `com.cognitivechristian.vitaplena`. SKU: `vitaplena-ios`. User access: Full.
3. Open the new app → **App Information**: Category Lifestyle, secondary Productivity. Content rights: you own or have licensed everything (the Bible text is public domain; the fonts are OFL). Age rating: answer "None" to everything → 4+.
4. **App Privacy** → fill from `store/LISTING.md` → "App Privacy answers". Publish.
5. **Pricing and Availability**: Free (the subscription is inside). All countries, or just the United States to start.

---

## Part 3 — The family plan (can wait until after the first TestFlight build)

Skip this part for the very first upload if you want to see the app on a phone sooner. Nothing is locked without it. Come back before submitting for review.

### 6. Products in App Store Connect

1. App → **Monetization → Subscriptions** → **+** Subscription Group: name **Family plan**.
2. Inside the group, **+** two subscriptions:
   - Reference name **Family plan, yearly**, product id `family_yearly`, duration 1 year. Price: your choice (e.g. $39.99).
   - Reference name **Family plan, monthly**, product id `family_monthly`, duration 1 month (e.g. $4.99).
3. For each: a **Subscription Display Name** ("Family plan, yearly") and description ("One plan for every member of the household."), a review screenshot (use `store/screenshots/iphone-6.7/01-today.png`), and **Save**. They show "Ready to submit"; they are submitted with the first version.
4. **App → Monetization → Subscriptions → App Store Localizations** for the group: name "Family plan".
5. **Users and Access → Integrations → In-App Purchase** → **Generate In-App Purchase Key** (name "RevenueCat"). Download the `.p8` once, note the Key ID and Issuer ID. RevenueCat needs these.
6. Sandbox tester for you: **Users and Access → Sandbox → Testers → +**, an email that is not your Apple ID (Gmail "+" addresses work). On your iPhone: Settings → App Store → Sandbox Account → sign in with it. Purchases in TestFlight then cost nothing.

### 7. RevenueCat

1. https://app.revenuecat.com → sign up → **Create new project** "Vita Plena".
2. **Project settings → Apps → + New → App Store**. Name "Vita Plena iOS", bundle id `com.cognitivechristian.vitaplena`. Upload the In-App Purchase key from step 6.5, paste the Issuer ID. Also add the **App-Specific Shared Secret**: App Store Connect → App → App Information → **App-Specific Shared Secret → Manage → Generate**.
3. **Products → + New**: `family_yearly` and `family_monthly` (App Store, exactly those ids).
4. **Entitlements → + New**: identifier **`family`** (this exact word; the app looks for it). Attach both products.
5. **Offerings**: the **default** offering → **+ Package**: `$rc_annual` → `family_yearly`; `$rc_monthly` → `family_monthly`. Make sure "default" is the current offering.
6. **Project settings → API keys**: copy the **Public app-specific API key** for the iOS app (starts with `appl_`). That is `VITE_RC_IOS_KEY` in step 8. (Android later: a `goog_` key → `VITE_RC_ANDROID_KEY`.)
7. **Integrations → Webhooks → + New**:
   - Webhook URL: `https://vitaplena13.netlify.app/.netlify/functions/revenuecat-webhook`
   - Authorization header value: make a long random string (in Terminal: `openssl rand -hex 32`) and paste it.
   - Environment: both (sandbox events are marked as such by the function and never count as revenue).
8. Netlify → the site → **Site configuration → Environment variables → Add a variable**: key `REVENUECAT_WEBHOOK_SECRET`, value = that same random string. Redeploy (Deploys → Trigger deploy).
9. Test: RevenueCat → Webhooks → **Send test event**. Netlify → Functions → revenuecat-webhook → the log shows a 200 with `type: "TEST"`.

### 8. Tell the build about the keys

On the Mac, in the project folder, make a file named `.env` (it is ignored by git and never leaves the Mac):
```
VITE_RC_IOS_KEY=appl_xxxxxxxxxxxxxxxxxxxx
```
Then `npm run ios` again. The Plan row in Settings now shows **Subscribe** and the sheet lists the two prices from the store.

Optional, also in `.env`:
- `VITE_SITE_URL=https://…` if the app should talk to a different deploy than production.
- `VITE_APPLE_SIGNIN=1` after Part 4.

---

## Part 4 — Sign in with Apple (optional, but do it)

Apple requires it only if a third-party sign-in is offered in the app. The iOS app shows **email only** (the Google button is hidden inside the app), so you can submit without it. It is still worth doing: existing Google users (you and Liz) can then sign in on the phone without setting a password. Otherwise: on the phone, tap **Forgot password?** with the Google address; the reset email creates a password for that same account.

1. Xcode → target **App** → **Signing & Capabilities** → **+ Capability** → **Sign in with Apple**. (Xcode adds `App.entitlements` and turns the capability on for the App ID.)
2. Apple Developer → **Certificates, Identifiers & Profiles → Identifiers → +** → **Services IDs** → identifier `com.cognitivechristian.vitaplena.web`, description "Vita Plena web". Register. Open it → tick **Sign in with Apple** → **Configure**: primary App ID = the app; Domains: `vita-plena-a7efa.firebaseapp.com`; Return URLs: `https://vita-plena-a7efa.firebaseapp.com/__/auth/handler`. Save.
3. **Keys → +** → name "Vita Plena Sign in with Apple" → tick **Sign in with Apple** → Configure → primary App ID = the app → Register → **Download** the `.p8` (only once) and note the **Key ID**. Your **Team ID** is at the top right of the developer site.
4. Firebase Console → **Authentication → Sign-in method → Add new provider → Apple** → Enable. Services ID: `com.cognitivechristian.vitaplena.web`. OAuth code flow: Team ID, Key ID, and paste the contents of the `.p8`. Save.
5. `.env` on the Mac: add `VITE_APPLE_SIGNIN=1`. `npm run ios`. The sign-in screen shows **Continue with Apple**.
6. For the website too: Netlify → Environment variables → `VITE_APPLE_SIGNIN` = `1` → redeploy.

---

## Part 5 — Upload, test, submit

### 9. The reviewer's account

In the app (simulator or website), create an account `reviewer@cognitivechristian.com` (any address you control) with a password you'll paste into the review notes, create a household "The Review Household", walk through the four steps, add a task and an event. This is the demo account in `store/LISTING.md`.

### 10. Archive and upload

1. In Xcode, device menu (top bar) → **Any iOS Device (arm64)**.
2. Menu **Product → Archive**. Wait. The Organizer window opens with the archive.
3. **Distribute App → App Store Connect → Upload** → Next through the defaults (keep "Upload your app's symbols" and "Manage version and build number" ticked) → **Upload**.
4. Five to thirty minutes later, App Store Connect emails "completed processing".

Versions: `MARKETING_VERSION` 1.0 and `CURRENT_PROJECT_VERSION` 1 are in the Xcode project (General tab: Version, Build). Every new upload needs a higher Build number; Xcode's "manage version" does that for you.

### 11. TestFlight

1. App Store Connect → the app → **TestFlight**. The build shows "Missing Compliance"? No: `ITSAppUsesNonExemptEncryption` is already false in Info.plist, so it goes straight to Ready.
2. **Internal Testing → +** group "Us", add yourself and Liz (they need to be users in App Store Connect: Users and Access → +, role Customer Support is enough). Install the **TestFlight** app on the phones, accept the invite, install.
3. Live with it for a week: the bells ring on time, quiet hours hold, a purchase in sandbox flips the plan (Settings → Plan shows "Family plan · active" within a minute; that is the webhook).

### 12. Fill the version page and submit

App Store Connect → the app → **1.0 Prepare for Submission**:

1. **Screenshots**: drag `store/screenshots/iphone-6.7/*.png` into the 6.7" slot (Apple uses them for the smaller phones too) and `store/screenshots/ipad-13/*.png` into the 13" iPad slot.
2. Promotional text, Description, Keywords, Support URL, Marketing URL: from `store/LISTING.md`.
3. **Build**: pick the TestFlight build.
4. **App Review Information**: tick Sign-in required; user name and password = the reviewer account; Notes = the review notes from LISTING.md. Your phone number.
5. **In-App Purchases and Subscriptions**: attach both subscriptions (only if Part 3 is done).
6. **Version Release**: Manually release this version (so you choose the day).
7. **Add for Review → Submit to App Review**. Review takes one to three days. If they write back, the message tells you exactly what to change; email support@cognitivechristian.com is in the listing so they can reach you.

### 13. After approval

- Press **Release this version**.
- Firebase → Authentication → Settings → **Authorized domains** already includes the site; nothing changes for the app (it uses its own origin).
- Bump the version for the next build: Xcode → General → Version 1.0.1, and repeat step 10.

---

## Part 6 — Google Play (later; same code)

1. https://play.google.com/console → pay $25 → create developer account (identity verification takes a day or two).
2. Android Studio: https://developer.android.com/studio → install. Then `npm run android` opens the project.
3. **Build → Generate Signed Bundle / APK → Android App Bundle** → **Create new** keystore (save it and its passwords somewhere safe; losing it means never updating the app) → release → the `.aab` lands in `android/app/release/`.
4. Play Console → **Create app** → Vita Plena, App, Free. Complete **Dashboard → Set up your app**: privacy policy URL, app access (the reviewer account), ads (none), content rating questionnaire, target audience (18+ is simplest), data safety (from LISTING.md).
5. **Testing → Internal testing → Create release** → upload the `.aab` → add testers by email → roll out. Install from the link on your Android phone (or Liz's).
6. RevenueCat → Apps → + Play Store app, upload the service-account JSON it asks for (the Console walks you through it), copy the `goog_` key into `.env` as `VITE_RC_ANDROID_KEY`, rebuild. Products `family_yearly` / `family_monthly` also need creating in Play Console → Monetize → Subscriptions.
7. **Production → Create release** → the same `.aab` → store listing (screenshots from `store/screenshots/iphone-6.7`, a 1024×500 feature graphic) → send for review.

---

## If something goes wrong

| You see | Do |
|---|---|
| Xcode: "Signing for App requires a development team" | Step 4.3: pick the team. |
| Xcode: red errors about `CapacitorLocalNotifications` or packages | File → Packages → **Reset Package Caches**, then Product → Clean Build Folder (⇧⌘K), build again. |
| The simulator shows a blank white screen | `npm run native` in Terminal (it rebuilds and copies the site), then ▶ again. |
| The app can't reach Beacon or the readings ("origin … isn't allowed") | The site's functions allow `capacitor://localhost`; if you changed `VITE_SITE_URL` to a branch deploy, that deploy must carry the same functions. |
| Bells never ring on the phone | Settings → The bells → Notifications must say Allowed. On the phone: Settings → Notifications → Vita Plena → Allow. Practices need a time and the day ticked. |
| Purchase sheet says "No plans are on offer" | RevenueCat: the offering isn't current, or the products aren't attached, or App Store Connect subscriptions aren't "Ready to submit". Wait ten minutes after changes. |
| Plan doesn't flip to active after a sandbox purchase | Netlify → Functions → revenuecat-webhook logs. 401 = the secret differs between RevenueCat and Netlify. |
| "Look around first" opens but nothing saves | Correct: the sample household is in memory. Sign in for the real thing. |
