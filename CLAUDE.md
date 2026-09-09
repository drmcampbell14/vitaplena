# Vita Plena — Agent Instructions

## What this is
A Catholic household app for Mitch and Liz Campbell, becoming a paid product (Cognitive Christian). Firebase Auth + Firestore, Vite front end, Netlify hosting + functions (the companion calls the Anthropic API). Production: vitaplena13.netlify.app from `main`. The v5 rebuild lives on a branch with its own Netlify branch deploy.

**Read `VITA-PLENA-FINAL-PRODUCT-SPEC.md` first.** It is the single source of truth: concept, phases, acceptance tests, status, decisions, console errands.

## Layout
```
index.html                 shell (pages, sheet, modal, bell overlay)
src/main.js                boot: auth → household record → realtime → shell; ?demo=1 preview
src/app/shell.js           tabs, header, liturgical colour tokens, render bus, go()
src/app/gate.js            sign in (email primary, Google secondary), create/join household
src/app/onboarding.js      the rule in four steps: God, Family, The bells, Enter
src/app/demo.js            sample household in memory (?demo=1); writes stay in memory
src/screens/*.js           today, pray, calendar, tasks, us, more (settings + Meals/Finance/Family/Notes), family (family mode)
src/core/state.js          S, bus, profOf, partnerName (no Firebase; importable in tests)
src/core/people.js         people without accounts, assignee keys (uid | "together" | "p:<id>"), weekly rotation   (pure, tested)
src/lib/api.js             callFn(name, body): POST to our functions with the user's ID token
netlify/functions/         companion, household-admin, ics, briefing (scheduled); _shared/admin.mjs holds auth + quotas
src/companion/companion.js Beacon: capture bar + sheet, state snapshot, action executor
src/content/prayers.js     prayer library (why / does lines) + guided flows (Rosary, Chaplet, Examen)
src/core/data.js           Firebase init, state S, write helpers (with demo branch), constants
src/core/liturgical.js     easter(), season(), liturgicalColor(), mysteriesFor(), SAINTS   (pure, tested)
src/core/recurrence.js     taskOccursOn() and friends                                      (pure, tested)
src/core/util.js           $, esc, ids, formatting                                           (pure, tested)
src/core/bells.js          the bells: per-device settings, scheduler, synthesized sound, overlay
src/ui/dom.js              openSheet/closeSheet, openModal/confirmModal, toast, ICON, the `A` action registry
src/styles/app.css         design system (tokens, both themes, components)
src/lib/gcal.js            Google Calendar pull
public/                    manifest.webmanifest, sw.js, icons
netlify/functions/         companion.mjs (Admin SDK, verified identity)
firestore.rules            security rules (source of truth; published by hand until CI deploy lands)
test/                      Vitest
```
Commands: `npm run dev` · `npm test` · `npm run build`. CI runs test + build on every push.

Conventions: screens render HTML strings into `#page-<id>` and register with `registerScreen(id, render)`; inline handlers call `A.<name>(...)`, the global action registry in `src/ui/dom.js`. `renderAll()` redraws every screen from `S` on each Firestore snapshot. Full-height readers (prayers, Beacon, check-in) use `openSheet`; small forms use `openModal`.

## Core features to protect (never break these)
- Liturgical season theming
- Google Calendar sync
- Per-person task filtering
- Traditional Catholic prayer library
- The companion (Netlify function → Anthropic API)
- Sign-in: email + password primary, Google secondary

## Working rules
- **No `sed` for edits.** Use the editor tools, or Python string replacement with assertions. Past `sed` runs corrupted files.
- Small, reviewable commits with clear messages. Never force-push.
- Test before anything deploy-affecting: `npm test && npm run build`. For UI changes, serve `dist/` and load it in headless Chromium; the module split once shipped a load-time crash the unit tests couldn't see.
- **Never touch `firestore.rules`, auth config, or `companion.mjs` without an explicit confirm step.** Draft → show Mitch → wait for "go".
- Never commit secrets. `ANTHROPIC_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, and anything else sensitive live in Netlify env vars only.
- Console steps (Firebase, Google Cloud, Netlify, Apple, Stripe) get exact click-by-click instructions. Those are Mitch's to do; the agent has no credentials by design.
- Propose in 3–5 sentences before non-trivial work. Wait for OK.
- Write code and comments as if another developer will read them. JS with JSDoc; `checkJs` is on.
- Protect the core list above. If a change risks one, say so.
- If a session runs past 90 minutes, commit what works and stop.

## Voice of the product
Tradition speaks, science confirms. Traditional Catholic register throughout; the Church is the authority, the evidence is the footnote. Never the modern therapeutic voice. The companion's name is Beacon (a single constant; Mitch may rename).

## Current priorities
1. Get the branch deploy live and the console errands done (spec §7)
2. Phase 1.3 quotas, then Phase 2.1 people model and 2.2/2.3 Today with bells
3. Groundwork for Capacitor: avoid PWA-only patterns; keep it framework-free
