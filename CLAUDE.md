# Vita Plena — Agent Instructions

## What this is
A Catholic household app for Mitch and Liz Campbell, becoming a paid product (Cognitive Christian). Firebase Auth + Firestore, Vite front end, Netlify hosting + functions (the companion calls the Anthropic API). Production: vitaplena13.netlify.app from `main`. The v5 rebuild lives on a branch with its own Netlify branch deploy.

**Read `VITA-PLENA-FINAL-PRODUCT-SPEC.md` first.** It is the single source of truth: concept, phases, acceptance tests, status, decisions, console errands.

## Layout
```
index.html               Vite entry
src/main.js              boot, auth gate, onboarding, render loop
src/core/data.js         Firebase init, state S, write helpers, constants, prayer library
src/core/liturgical.js   easter(), season(), SAINTS         (pure, tested)
src/core/recurrence.js   taskOccursOn() and friends         (pure, tested)
src/core/util.js         $, esc, ids, formatting, toast     (pure, tested)
src/views/*.js           today, calendar, tasks, faith, us, extras, settings
src/companion/           companion sheet + action executor
src/lib/gcal.js          Google Calendar pull
netlify/functions/       companion.mjs (Admin SDK, verified identity)
firestore.rules          security rules (source of truth; published by hand until CI deploy lands)
test/                    Vitest
```
Commands: `npm run dev` · `npm test` · `npm run build`. CI runs test + build on every push.

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
