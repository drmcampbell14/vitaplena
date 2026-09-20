# Vita Plena

A Catholic household's rule of life. God → Family → Vocation → Rest, a companion that runs the schedule from plain English, and a house that rings for prayer.

- **Production (v4):** https://vitaplena13.netlify.app (from `main`)
- **v5 build:** https://claude-phase-1-security-auth-hsb3x5--vitaplena13.netlify.app (from `claude/phase-1-security-auth-hsb3x5`)
- **Preview without signing in:** add `?demo=1` to either URL for a sample household in memory
- **Spec:** [VITA-PLENA-FINAL-PRODUCT-SPEC.md](VITA-PLENA-FINAL-PRODUCT-SPEC.md) — the single source of truth
- **Agent instructions:** [CLAUDE.md](CLAUDE.md)

## Run it

```
npm install
npm run dev        # http://localhost:5173 (companion calls go to the deployed function)
npm test           # Vitest
npm run build      # → dist/
```

## Put it on a phone

Open the site in Safari (iPhone) or Chrome (Android), then **Share → Add to Home Screen**. It opens full screen, keeps its icon, and the shell works offline. A Fire HD on the kitchen counter is the same steps.

## The store apps

The same `dist/` runs inside an iOS app and an Android app (Capacitor 8; projects in `ios/` and `android/`, bundle id `com.cognitivechristian.vitaplena`). On a Mac with Xcode:

```
npm run ios        # build, copy into ios/, open Xcode
npm run android    # same for Android Studio
npm run native     # build + copy only
npm run icons      # redraw icons and launch screens from scripts/build-icons.mjs
```

Inside the app the bells are local notifications, calls go to the production site by name, Google sign-in is hidden (email is the way in; Sign in with Apple switches on with `VITE_APPLE_SIGNIN=1`), and the family plan appears once RevenueCat keys are set. `store/SUBMIT.md` is the click-by-click from Apple enrolment to submission; `store/LISTING.md` is the listing copy; `store/screenshots/` are made by `scripts/store-shots.mjs`.

## Stack

Vite + vanilla ES modules (no framework), Firebase Auth + Firestore, Netlify hosting and functions. The companion function uses the Firebase Admin SDK and the Anthropic API.

```
index.html                   shell
src/main.js                  boot: auth → household → screens
src/app/                     shell (tabs, header, liturgical colour), gate, onboarding, demo
src/screens/                 today, pray, calendar, tasks, us, more (settings + modules)
src/companion/               Beacon: capture bar, sheet, action executor
src/content/prayers.js       the prayer library and guided flows
src/core/                    data (Firebase, state, writes), liturgical, recurrence, util, bells
src/ui/dom.js                sheet, modal, toast, icons, the A action registry
src/styles/app.css           design system
netlify/functions/           companion (Beacon), household-admin, ics (calendar feed), briefing (scheduled, Sundays)
netlify/functions/_shared/   admin (Firebase Admin, auth, quotas), ics builder
public/                      manifest, service worker, icons, fonts, privacy/terms/support pages, data (Bible, lectionary)
ios/ android/                the native shells (Capacitor); capacitor.config.ts
store/                       listing copy, submission guide, screenshots
firestore.rules              security rules (published by hand until CI deploy lands)
test/                        Vitest
```

Secrets live in Netlify environment variables only: `ANTHROPIC_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, optional `ALLOWED_ORIGIN`. See spec §7.
