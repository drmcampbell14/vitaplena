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

## Wrap it for the stores

The app is a plain `dist/` folder with no web-only tricks, so Capacitor wraps it as-is:

```
npm i -D @capacitor/cli @capacitor/core @capacitor/ios @capacitor/android
npx cap init "Vita Plena" com.cognitivechristian.vitaplena --web-dir dist
npm run build && npx cap add ios && npx cap add android && npx cap sync
npx cap open ios      # Xcode → sign with the Apple Developer account → archive → TestFlight
```

Before submission: Sign in with Apple (required because Google sign-in is offered), a privacy policy URL, a support URL, and the `?demo=1` preview as the reviewers' demo account. See spec §3 Phase 6.

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
public/                      manifest, service worker, icons, privacy.html, terms.html
firestore.rules              security rules (published by hand until CI deploy lands)
test/                        Vitest
```

Secrets live in Netlify environment variables only: `ANTHROPIC_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, optional `ALLOWED_ORIGIN`. See spec §7.
