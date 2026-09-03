# VITA PLENA — FINAL PRODUCT SPECIFICATION (v5, the launch build)

**Single source of truth.** Every Claude Code session starts: *"Read CLAUDE.md and VITA-PLENA-FINAL-PRODUCT-SPEC.md. We're on Phase X, task Y. Propose in 3–5 sentences, wait for my OK, build, run the acceptance test, commit."* Check boxes as tasks land. Keep §7 (status and decisions) current.

Revision 2 (2026-09-03): concept settled around *the house keeps the rule* (see §0); Phase 0 and Phase 1.2 built; decisions recorded in §7.

---

## 0. The decision: structured rebuild, and what the product is

A from-scratch rewrite is the riskiest thing you can do with working software. But "build on what I have" doesn't mean keeping the mess. The approach is a **module-by-module rebuild on the existing Firebase project and data model**, on a branch that deploys in parallel with the live app:

- The Firebase project, Auth, and Firestore data shape stay. The household's data survives untouched.
- Every UI module gets rewritten cleanly, one at a time, behind the same data; the old module is deleted when the new one passes its tests.
- The backend is rebuilt properly: real project structure, real server functions, real security, real tests.
- The v5 branch deploys to its own Netlify URL. `main` stays live until v5 is better, then v5 becomes `main`. There is never a day the app doesn't work.

**Definition of "done":** a stranger can find it in the App Store, install it, sign up, set up their household in five minutes, use it daily, pay for it, invite their spouse, and get help if something breaks, without ever talking to Mitch.

### The concept: the house keeps the rule

The diagnosis from v4: *"we barely use the thing."* An app its own founders don't open has a broken core loop, not a missing feature. v4 waits to be typed at. v5 comes to the family.

- **One app, two modes.** *Your phone* is where the parents set the household up and talk to the companion. *Family mode* is the same app on a tablet on the kitchen counter: big text, no login for kids, today's feast and saint, whose chores are whose, the next prayer. A Fire HD running family mode is the wall. Family mode ships after launch, but its data model (people without accounts, chores by person, bells) ships in the first build so it is a screen later, not a rewrite.
- **The house rings.** Bells at the hours: Morning Offering, Angelus, family Rosary, examen. On a phone it's a notification with a real bell sound. On the counter it's the kitchen ringing. Nobody has to remember; the house does. This is the daily reason the app is open.
- **Tradition speaks, science confirms.** The Church had habit science fifteen centuries before anyone wrote a book about it. Every practice carries one line from the tradition on *why* and one line from the evidence on *what it does to you*. The Church is the authority; the studies are the footnote. Never the modern therapeutic voice. This is the Cognitive Christian brand in six words.
- **Games that are Catholic, not Duolingo.** Sacrifice beads, the spiritual bouquet, virtue of the month, seasons with a shape, the chore ordo. No streak-shaming.
- **The public domain is the content strategy.** Douay-Rheims, Baltimore Catechism, Butler's Lives, the 1910 Raccolta, the Imitation of Christ. Free, legal, in-app, offline. Readings, saints, teachings, prayers, and quotes all come from sources instead of hand-typed arrays.
- **The 1962 calendar alongside the current one,** as a household setting. Large families and traditional practice correlate heavily; that is the buyer.

The full concept memo: *The House Keeps the Rule* (artifact, 2026-09-03).

---

## 1. Target architecture

| Layer | v4 (was) | v5 (target) | Status |
|---|---|---|---|
| Project | 14 flat files, CDN imports, no build | Vite, ES modules in `src/` (`core/ views/ companion/ lib/`), JS with JSDoc and `checkJs`, `npm run build` → `dist/` | **done** |
| Tests | None | Vitest; GitHub Actions on every push (test + build) | **done**, growing |
| Frontend | Vanilla JS, hand-built DOM | Vanilla JS, component-style modules, one render bus; framework-free (fast, Capacitor-friendly) | in progress |
| Auth | Google only | **Email + password primary**, Google secondary, Sign in with Apple at Phase 6 (required by Apple when Google is offered) | **done** (needs provider enabled in console) |
| Data | Firestore | Same model + `people`, `subscription`, `briefings`, `meta/usage`, `bells`, `orgs` | rules drafted |
| Server | 1 open Netlify function | Netlify functions with Firebase Admin SDK: companion (**locked**), briefing, stripe-webhook, revenuecat-webhook, household-admin, bell-dispatch | companion done |
| AI | Anthropic API via companion | Same, with verified identity, per-household quotas, named persona (Beacon, default) | identity done |
| Calendar | Google pull, token lost each session | Server-side OAuth (refresh tokens in `users/{uid}/private`), pull + push, `.ics` feed for Apple Calendar | pending |
| Liturgical | Hand-coded season math + saints table | `romcal` (US) for the current calendar; 1962 calendar as a household option; tested | pending |
| Readings | universalis.com JSONP (Jerusalem Bible) | Douay-Rheims in-app (public domain) + one-tap USCCB (NABRE) link; NABRE license seam preserved | pending |
| Notifications | None | Firebase Cloud Messaging: **bells** at practice times, Sunday briefing, spouse-assigned tasks | pending |
| Payments | None | RevenueCat (Apple + Google) + Stripe (web); `subscription` doc drives entitlements | pending |
| Mobile | Website | Capacitor iOS + Android, native push, TestFlight | pending |
| Ops | None | Sentry, analytics events, scheduled Firestore backups, support email, runbook | pending |

---

## 2. Principles (Claude Code enforces these)

1. **Two taps or it's wrong.** Any daily action is reachable in ≤2 taps from Today.
2. **Five first-run tabs:** Today · Calendar · Tasks · Faith · Us. Meals, Finance, Notes, Family behind "More", off by default.
3. **The companion is the product.** Everything routes through it or is one tap away. Name: Beacon (default; Mitch may rename; single constant).
4. **The house rings.** Bells are a first-class feature, not a notification setting buried in preferences.
5. **Ladder-aware everywhere.** God → Family → Vocation → Rest shows up in placement, in the Today layout, in what gets protected.
6. **Tradition speaks, science confirms.** Every practice carries both lines. Never the reverse; never the therapeutic voice.
7. **Nothing wonky ships.** Half-features get finished or removed.
8. **No secrets in the repo. No `sed`. Propose before building. Small commits. Test before deploy.** (CLAUDE.md.)

---

## 3. The build — phases, tasks, acceptance tests

### Phase 0 — Foundation
- [x] **0.1 Project scaffold.** Vite; `src/` module map; `package.json`, `.gitignore`, `netlify.toml` publishing `dist/`. Firebase from npm pinned to 10.12.2 (same as the CDN version). *Test passed:* build succeeds; built app boots and renders the gate in headless Chromium.
- [ ] **0.2 Dev/prod split.** Separate Firebase project for dev so beta families never hit test data. Env-driven `FIREBASE_CONFIG`. *Console work (Mitch).* *Test:* two URLs, two databases.
- [x] **0.3 Test harness.** Vitest; pure modules split out of `data.js` (`liturgical.js`, `recurrence.js`, `util.js`); 35 tests; GitHub Actions on push. *Test passed:* `npm test` green.

### Phase 1 — Backend done right
- [ ] **1.1 Firestore rules.** Drafted and committed as `firestore.rules` (households members-only; `users` self-only; `invites` get-not-list; `subscription` and `users/{uid}/private` server-only; fail-closed catch-all). **Publish pending (Mitch pastes into console).** Follow-ups: `firebase.json` + rules unit tests on the emulator; CLI deploy from CI. *Test:* second account cannot read the first household.
- [x] **1.2 Verified identity on the companion.** ID token required and verified with Admin SDK; household resolved server-side and membership confirmed on the household doc; origin allow-list. *Test passed locally:* no token → 401; bad origin → 403; misconfigured server → 503. **Needs `FIREBASE_SERVICE_ACCOUNT` in Netlify before the branch deploy's companion works.**
- [ ] **1.3 Usage quotas.** `households/{hid}/meta/usage` daily counters; cap per plan (trial 40/day, paid 150/day; constants). Friendly `say`. *Test:* cap to 2, third call refused.
- [ ] **1.4 Household admin function.** Leave, remove member (owner), regenerate invite code, transfer ownership, delete household (cascade). *Test:* each via Settings on a throwaway household.
- [ ] **1.5 Google Calendar server-side OAuth.** Refresh tokens in `users/{uid}/private/google` (rules already deny clients). Pull on load + hourly; push with per-event toggle. **Requires OAuth verification (7.4) to be useful beyond test users: Testing-mode refresh tokens expire in 7 days.** *Test:* reconnect never needed; in-app event appears in Google.
- [ ] **1.6 `.ics` feed** per household (signed URL) for Apple Calendar. *Test:* subscribe on iPhone; practices appear.

### Phase 2 — Core experience rebuild
- [ ] **2.1 People and the household model.** `households/{hid}.people`: profiles without accounts (kids), with optional age. Tasks, chores, and practices assignable to a member *or* a person. Roles: owner / member. This is the data model family mode needs later; it ships now.
- [ ] **2.2 Today as a rhythm view.** Header: date, liturgical day and color, saint. Capture bar (text + mic → Beacon) pinned top. **Morning → The Day → Evening**, with the next bell visible. Done ring. Briefing card when present. *Test:* Liz uses it a full day without opening another tab.
- [ ] **2.3 Bells (data + client).** `state.bells`: each practice has a time, a sound (church bell / chime / silent), quiet hours. Client-side chime while the app is open (tablet on the counter). Push delivery is Phase 3. Angelus ↔ Regina Caeli switch automated by season. *Test:* the app rings at noon with the Angelus on screen.
- [ ] **2.4 Beacon (companion v2).** Named persona; sheet rebuilt; inline chips; "undo last"; quota shown subtly; system prompt in a versioned file with action-contract tests; knows about people and bells. *Test:* 20-scenario regression suite passes.
- [ ] **2.5 Tasks and the chore ordo.** Rebuilt: sections, assignee (member or person), repeats, due, done-by-date, swipe to complete. Chores rotate weekly by person. *Test:* every v4 task feature works; a chore rotates without editing.
- [ ] **2.6 Calendar.** Month + week; create/edit; source badges; protected time. *Test:* two-way Google verified.
- [ ] **2.7 Liturgical engine.** `romcal` for the current calendar; 1962 calendar as a household setting; season, feast, rank, color, fast/abstinence surfaced. Saints table retired where covered. *Test:* correct feast for any date 2026–2027 on both calendars; Fridays in Lent flagged.
- [ ] **2.8 Readings and sources (public domain).** Douay-Rheims lectionary readings in-app; one-tap USCCB (NABRE) link; Butler's Lives for the saint of the day; Baltimore Catechism Q&A card; quotes drawn from sources with citations. Documented seam for a NABRE license later. *Test:* today's readings load in <1s offline with the translation labeled.
- [ ] **2.9 Prayers and practices.** Library expanded from the Raccolta: Rosary with mysteries by day, Divine Mercy, Angelus/Regina Caeli, Morning Offering, Night Prayer, litanies, guided examen (three questions for kids, full for adults). Each practice carries its two lines (tradition / evidence). *Test:* every default practice has a tap-to-pray card with both lines.
- [ ] **2.10 Us.** Weekly guided check-in with history; three words. *Test:* one complete check-in stored and viewable.
- [ ] **2.11 The spiritual bouquet.** Household intention; every member's and person's prayers tally into it; visible on Today. First game to ship. *Test:* a family of four fills a bouquet in a week.
- [ ] **2.12 Sacrifice beads and virtue of the month.** Per-person beads; monthly virtue chart. *Test:* a child's beads advance from the tablet without a login.
- [ ] **2.13 More.** Meals, Finance, Notes, Family behind a toggle; kept only if they pass the two-tap test.
- [ ] **2.14 Onboarding.** Ladder onboarding rebuilt: progress, back/skip, add-your-people step, invite-spouse step, notification permission, first-day tour. *Test:* a stranger completes it in <5 minutes.
- [ ] **2.15 Family mode** *(after launch, per Mitch)*: the big-text, no-login counter screen. Everything it shows already exists by then. *Test:* Grandma walks into the kitchen and knows what the family is doing tonight.

### Phase 3 — Bells delivered
- [ ] **3.1 FCM setup** (web + native). Token per user/device.
- [ ] **3.2 Bell dispatch** at each practice's time with the chosen sound, honoring quiet hours. Scheduled function. *Test:* the Angelus rings on both phones at noon.
- [ ] **3.3 Sunday briefing** (scheduled function + romcal + Claude) → Today card + push + email. *Test:* arrives Sunday 5 PM local.
- [ ] **3.4 Spouse notifications:** task assigned to you; check-in due.

### Phase 4 — Households
- [ ] **4.1 Limited accounts for older kids** at a parent-set age (people already exist from 2.1). Owner controls.
- [ ] **4.2 Data export** (JSON) and account deletion (Apple, GDPR/CCPA). *Test:* delete account → household data gone within 24h.

### Phase 5 — Monetization
- [ ] **5.1 Entitlements.** `households/{hid}.subscription = {status, plan, source, renewsAt, trialEndsAt}`; 14-day trial on create; gates: Beacon, briefing, bells require `trial|active`. Rules already forbid clients writing this field.
- [ ] **5.2 RevenueCat** (Apple IAP + Google Play). Webhook → subscription doc.
- [ ] **5.3 Stripe** (web). Webhook → subscription doc.
- [ ] **5.4 Paywall and trial UX:** soft, honest, Catholic. Restore purchases. *Test:* sandbox purchase flips entitlements live.
- [ ] **5.5 Parish/group plan (data only).** `orgs/{orgId}` with member households and a group code.

### Phase 6 — App Store readiness
- [ ] **6.1 Capacitor** iOS + Android; icons, splash, safe areas, haptics, native share. Fire HD runs the Android build from Amazon's store.
- [ ] **6.2 Sign in with Apple** (required because Google sign-in is offered). Account linking for existing Google users (Mitch and Liz).
- [ ] **6.3 Privacy manifest, permission strings; no tracking, no ATT.**
- [ ] **6.4 App Review checklist:** demo account, no placeholders, subscription terms, restore, in-app deletion, support URL, privacy URL.
- [ ] **6.5 TestFlight + Play internal testing** with 5–10 families for 3–4 weeks.
- [ ] **6.6 Store listings:** screenshots (Today, Beacon, Calendar, Faith, Us), preview video, description, keywords.

### Phase 7 — Launch operations
- [ ] **7.1 Domain + landing page.** **The domain and a minimal page move up to Phase 1.5**: Google OAuth verification requires a homepage and privacy policy on a domain Mitch owns and has verified; `*.netlify.app` won't do. Full landing page (what it is, the doctor couple, screenshots, store badges) later.
- [ ] **7.2 Legal:** privacy policy and terms (needed for 7.4 and App Review), subscription terms, support email, response-time promise.
- [ ] **7.3 Ops:** Sentry client+server; analytics (no PII); scheduled Firestore backups; uptime check; runbook.
- [ ] **7.4 Google OAuth verification** for `calendar.readonly` (a *sensitive* scope: verification review, no CASA assessment). Start as soon as 7.1/7.2's slice exists. Takes weeks.
- [ ] **7.5 Launch checklist** signed off by Mitch and Liz.

---

## 4. Timeline (honest)

~20–25 sessions. At three a week, roughly **8–10 weeks** to TestFlight; **3–4 weeks of beta**; then submission. **12–14 weeks from Phase 0** if sessions happen. Code is not the bottleneck; the queues are: Apple Developer enrollment (days), OAuth verification (weeks), App Review (days to weeks), beta (weeks). Start Apple enrollment and the domain this week.

---

## 5. What makes it sellable

A family buys it because: it's in the App Store, looks finished, sets up in five minutes, the house rings for prayer, it knows the feast days, the kids are in it without phones, the spouse is in it, and it costs less than Hallow.

A parish buys it because: there's a group code, an owner can see who's in, it's Catholic in substance not decoration, and two doctors stand behind it.

An acquirer would buy it because: clean codebase with tests, real subscription revenue, documented backend, no licensing landmines (public-domain content), and a defensible niche.

---

## 6. Next-session prompt (copy-paste)

```
Read CLAUDE.md and VITA-PLENA-FINAL-PRODUCT-SPEC.md. Phase 1, task 1.3 (usage quotas) and Phase 2, task 2.1 (people and the household model). Propose in 3–5 sentences, wait for my OK, build, run the acceptance tests, commit.
```

---

## 7. Status, deploy strategy, and decisions log

### Where things are (2026-09-03)
Branch `claude/phase-1-security-auth-hsb3x5` carries the v5 build: docs, rules file, Vite scaffold, tests + CI, email sign-in, locked companion function. `main` is the untouched v4 and stays live.

### Deploy strategy: branch deploy = the parallel site
Netlify: **Site configuration → Build & deploy → Continuous deployment → Branches and deploy contexts → Branch deploys → "Let me add individual branches"** → add `claude/phase-1-security-auth-hsb3x5`. The branch then deploys at `https://claude-phase-1-security-auth-hsb3x5--vitaplena13.netlify.app` and rebuilds on every push. `netlify.toml` already carries the build command, so no build settings change in the console. When v5 is better than v4, merge to `main`.

### Environment variables (Netlify → Site configuration → Environment variables)
| Key | Value | Needed by |
|---|---|---|
| `ANTHROPIC_API_KEY` | (existing) | companion |
| `FIREBASE_SERVICE_ACCOUNT` | service-account JSON, minified to one line | companion (1.2), everything server-side after |
| `ALLOWED_ORIGIN` | `https://vitaplena13.netlify.app` (no trailing slash) | companion, optional; Netlify's own URLs are always allowed |

Service account: Firebase Console → gear → Project settings → **Service accounts** → **Generate new private key**. Minify with `python3 -c "import json,sys;print(json.dumps(json.load(sys.stdin)))" < key.json`. Delete the download afterward. It bypasses all rules; it lives in Netlify only.

### Console errands outstanding (Mitch)
1. Publish `firestore.rules` (Firestore → Rules → paste → Publish), then the second-account test.
2. Firebase Authentication → Sign-in method → **Email/Password → Enable**.
3. Google Cloud → OAuth consent screen → Test users → add the second test account (consent screen is in Testing).
4. Netlify → branch deploy for this branch; env vars above.
5. Apple Developer enrollment (start now; gates TestFlight).
6. Buy/confirm the domain (gates 7.4).

### Decisions taken (2026-09-03, "do all of it and see what sticks")
- Family mode after launch; its data model in the first build.
- Test device for family mode: Amazon Fire HD.
- Bell sound: a real church bell (chime and silent as options).
- 1962 calendar offered as a household setting alongside the current calendar.
- First game: the spiritual bouquet. Then sacrifice beads, virtue of the month.
- Kids: people without accounts; limited accounts at a parent-set age later.
- Companion name: Beacon (default; renameable, single constant).
- Auth: email + password primary; Google kept as secondary (so Sign in with Apple is owed at 6.2).
- Language: JS with JSDoc + `checkJs`, not TypeScript.
- Readings: option D. Douay-Rheims in-app, USCCB link for NABRE, license seam preserved.
- Framing: tradition speaks, science confirms.

*One codebase, finished. Ship it.*
