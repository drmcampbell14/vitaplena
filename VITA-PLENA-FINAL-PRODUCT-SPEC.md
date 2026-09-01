# VITA PLENA — FINAL PRODUCT SPECIFICATION (v5, the launch build)

**Supersedes** VITA-PLENA-V5-BUILD-SPEC.md. Put this in the repo root as the single source of truth. Every Claude Code session starts: *"Read CLAUDE.md and VITA-PLENA-FINAL-PRODUCT-SPEC.md. We're on Phase X, task Y. Propose in 3–5 sentences, wait for my OK, build, run the acceptance test, commit."*

---

## 0. The decision: structured rebuild, not blank-page rewrite

A from-scratch rewrite is the riskiest thing you can do with working software. But "build on what I have" doesn't mean keeping the mess. The approach is a **module-by-module rebuild on the existing Firebase project and data model**:

- The Firebase project, Auth, and Firestore data shape stay. Your household's data survives untouched.
- Every UI module gets rewritten cleanly, one at a time, behind the same data — old module deleted when the new one passes its tests.
- The backend is rebuilt properly: real project structure, real server functions, real security, real tests.
- At the end, every line of the app is new, but there was never a day it didn't work.

**Definition of "done" for this run:** a stranger can find it in the App Store, install it, sign up, set up their household in five minutes, use it daily, pay for it, invite their spouse, and get help if something breaks — without ever talking to you. That's a product. Everything below serves that sentence.

---

## 1. Target architecture

| Layer | v4 (now) | v5 (target) |
|---|---|---|
| Project | 14 flat files, CDN imports, no build | Vite project, ES modules, `npm run build`, TypeScript **optional** (Claude Code's call — prefer JS with JSDoc if it keeps velocity) |
| Frontend | Vanilla JS, hand-built DOM | Vanilla JS, component-style modules, one shared render bus (keep it framework-free — it's fast and Capacitor-friendly) |
| Auth | Firebase Auth (Google) | Firebase Auth (Google + **Sign in with Apple** — required by Apple if Google sign-in is offered, + email link as fallback) |
| Data | Firestore | Firestore, same model + `people`, `subscription`, `briefings`, `usage`, `notifications` |
| Server | 1 Netlify function | Netlify functions with Firebase Admin SDK: companion, briefing (scheduled), stripe-webhook, household-admin, push-dispatch (scheduled) |
| AI | Anthropic API via companion | Same, with identity verification, per-household quotas, named persona |
| Calendar | Google pull, token lost each session | Server-side OAuth (refresh tokens stored server-side), pull + **push** (create events from app), Apple Calendar via `.ics` subscription feed |
| Liturgical | Hand-coded season math + saints table | `romcal` (US General Roman Calendar): seasons, feasts, ranks, fast/abstinence, colors |
| Readings | universalis.com JSONP (Jerusalem Bible) | See §3.4 — licensing decision required |
| Notifications | None | Firebase Cloud Messaging: practice reminders, Sunday briefing, spouse-assigned tasks |
| Payments | None | RevenueCat (unifies Apple IAP + Google Play Billing) + Stripe for web; `subscription` doc drives entitlements |
| Mobile | Website | Capacitor iOS + Android shells, native push, TestFlight beta |
| Ops | None | Sentry, analytics events, scheduled Firestore backups, status/support email |
| Tests | None | Vitest unit tests for recurrence, liturgical, companion action executor; a smoke test for the critical path |

---

## 2. Principles (Claude Code enforces these)

1. **Two taps or it's wrong.** Any daily action — check off a prayer, add a task, see tomorrow — is reachable in ≤2 taps from Today. If a flow needs more, simplify it or cut it.
2. **Five first-run tabs:** Today · Calendar · Tasks · Faith · Us. Meals, Finance, Notes, Family move to a "More" area, off by default.
3. **The companion is the product.** Everything routes through it or is one tap away from it. It gets a name and a consistent voice (Mitch decides the name; default proposal: "Beacon").
4. **Ladder-aware everywhere.** God → Family → Vocation → Rest ordering shows up in placement, in the Today layout, in what gets protected when the day is tight.
5. **Nothing wonky ships.** If a feature "kinda works," it either gets finished to the standard of the rest or removed. No half-features in the store build.
6. **No secrets in the repo. No `sed`. Propose before building. Small commits. Test before deploy.** (Standing rules from CLAUDE.md.)

---

## 3. The build — phases, tasks, acceptance tests

### Phase 0 — Foundation (1–2 sessions)
- [ ] **0.1 Project scaffold.** Vite project; move the 14 files into `src/` with a module map (`core/`, `views/`, `companion/`, `lib/`); `package.json`, `.gitignore`, `netlify.toml` updated for `dist/` publish + functions bundling. **Test:** `npm run build` produces `dist/`, deploys to Netlify, app works identically.
- [ ] **0.2 Dev/prod split.** Separate Firebase project (or at least separate Firestore database) for dev so beta families never hit test data. Env-driven config. **Test:** two URLs, two databases.
- [ ] **0.3 Test harness.** Vitest; first tests for `taskOccursOn`, `season()`, and `cmpApply` action executor. **Test:** `npm test` green in CI (GitHub Actions on push).

### Phase 1 — Backend done right (2–3 sessions)
- [ ] **1.1 Firestore rules** (done/verify): household access only for members; `users` self-only; invites narrow. Committed as `firestore.rules`, deployed via Firebase CLI in CI.
- [ ] **1.2 Verified identity on every function.** Firebase ID token required and verified server-side (Admin SDK now that there's a build). Server looks up `users/{uid}.hid` — never trusts a client-sent household ID. **Test:** no token → 401; token from another household → 403.
- [ ] **1.3 Usage quotas.** `households/{hid}/meta/usage` daily counters; companion cap per plan (trial 40/day, paid 150/day, configurable). Friendly limit message. **Test:** cap to 2, third call refused.
- [ ] **1.4 Household admin function.** Server-side: leave, remove member (owner only), regenerate invite code, transfer ownership, delete household (cascades subcollections). **Test:** each operation via the Settings UI on a throwaway household.
- [ ] **1.5 Google Calendar server-side OAuth.** Function-based OAuth flow storing refresh tokens in `users/{uid}/private/google` (rules: server-only). Pull on load + hourly; **push**: events created in Vita Plena can be written to Google with a per-event toggle. **Test:** reconnect never needed; an event created in-app appears in Google Calendar.
- [ ] **1.6 Apple/other calendars.** Per-household read-only `.ics` feed URL (signed token) so the household's rhythm + events subscribe into Apple Calendar. **Test:** subscribe on iPhone, practices appear.

### Phase 2 — Core experience rebuild (4–6 sessions)
- [ ] **2.1 Today (rhythm view).** Header: date, liturgical day, color, saint. **Capture bar** (text + mic → companion) pinned top. Morning block → The Day → Evening block (examen). Done ring. Briefing card when present. **Test:** Liz uses it a full day and doesn't open any other tab.
- [ ] **2.2 Companion v2.** Named persona; conversation sheet rebuilt; inline chips; "undo last" action; per-message cost awareness (quota shown subtly). System prompt moved to a versioned file with tests for the action contract. **Test:** 20-scenario regression suite (plan my day, clear my day, constraints, dumps) passes.
- [ ] **2.3 Tasks.** Rebuilt: sections, assignee (member or person), repeats, due, done-by-date, swipe to complete, drag to reorder. **Test:** every v4 task feature works; nothing needs the modal for the common case.
- [ ] **2.4 Calendar.** Month + week views; create/edit event; source badges (Vita Plena / Google); protected time visual. **Test:** two-way with Google verified.
- [ ] **2.5 Faith — liturgical engine.** `romcal` integrated; season, feast, rank, liturgical color, fast/abstinence surfaced in Today and Calendar; Regina Caeli/Angelus switch automated; saints table retired where romcal covers. **Test:** prints correct feast for any date in 2026–2027; Fridays in Lent flagged.
- [ ] **2.6 Faith — readings (see §3.4 decision).** Implement the chosen option cleanly. **Test:** today's readings load in <1s with the correct translation label, and gracefully degrade offline.
- [ ] **2.7 Faith — prayers & practices.** Prayer library expanded (Rosary with mysteries by day, Divine Mercy, Angelus/Regina Caeli, Morning Offering, Night Prayer, Litanies, Examen guided flow). Practices editable inline. **Test:** every default practice has a tap-to-pray card.
- [ ] **2.8 Us.** Couples check-in rebuilt as a guided weekly flow with history; "three words." **Test:** one complete check-in stored and viewable.
- [ ] **2.9 More.** Meals, Finance, Notes, Family behind a toggle — kept only if they pass the two-tap test; otherwise removed for v5.
- [ ] **2.10 Onboarding.** Ladder onboarding rebuilt with progress, back/skip, invite-spouse step, notification permission step, "your first day" tour. **Test:** stranger completes it in <5 minutes without help.

### Phase 3 — Notifications (1–2 sessions)
- [ ] **3.1 FCM setup** (web + native via Capacitor). Token stored per user/device.
- [ ] **3.2 Practice reminders** at each practice's time (user-configurable, quiet hours). Scheduled dispatch function.
- [ ] **3.3 Sunday briefing** (scheduled function + romcal + Claude) → card on Today + push + email. **Test:** arrives Sunday 5 PM local.
- [ ] **3.4 Spouse notifications:** task assigned to you; check-in due. **Test:** Liz gets a push when Mitch assigns her a task.

### Phase 4 — Households (2 sessions)
- [ ] **4.1 People (kids) as profiles** without accounts; assignable; shown in rhythm; ages optional.
- [ ] **4.2 Roles:** owner / member. Owner controls billing and lifecycle.
- [ ] **4.3 Data export** (JSON) and account deletion (required by Apple and GDPR/CCPA). **Test:** delete account → all household data gone within 24h.

### Phase 5 — Monetization (2 sessions)
- [ ] **5.1 Entitlements.** `households/{hid}.subscription = {status, plan, source, renewsAt, trialEndsAt}`. 14-day trial on create. Gates: companion + briefing + push require `trial|active`.
- [ ] **5.2 RevenueCat** for Apple IAP + Google Play (annual family plan; monthly optional). Webhook → subscription doc.
- [ ] **5.3 Stripe** for web checkout (same products). Webhook → subscription doc.
- [ ] **5.4 Paywall & trial UX:** soft, honest, Catholic — no dark patterns. Restore purchases. **Test:** sandbox purchase on iOS flips entitlements live.
- [ ] **5.5 Parish/group plan (data only).** `orgs/{orgId}` with member households and a group code; billing later. This is the future institutional channel — model it now, sell it after launch.

### Phase 6 — App Store readiness (2–3 sessions)
- [ ] **6.1 Capacitor** iOS + Android projects; app icons, splash, status bar, safe areas, haptics, native share.
- [ ] **6.2 Sign in with Apple** (Apple requires it when third-party sign-in is offered). Account linking with existing Google users.
- [ ] **6.3 Privacy manifest, permissions strings, ATT** (none needed if no tracking — keep it that way).
- [ ] **6.4 App Review checklist:** functional demo account for reviewers, no placeholder content, subscription terms visible, restore purchases, account deletion in-app, support URL, privacy URL.
- [ ] **6.5 TestFlight + Play internal testing** with 5–10 beta families for 3–4 weeks. Feedback loop in-app.
- [ ] **6.6 Store listings:** screenshots (Today, Companion, Calendar, Faith, Us), 30-second preview video, description, keywords (Catholic family, household, rule of life, liturgical calendar).

### Phase 7 — Launch operations (1–2 sessions)
- [ ] **7.1 Landing page** at cognitivechristian.com / vitaplena: what it is, the doctor couple, screenshots, store badges, web signup.
- [ ] **7.2 Legal:** privacy policy, terms, subscription terms, support email, response-time promise.
- [ ] **7.3 Ops:** Sentry client+server; analytics events (no PII); scheduled Firestore backups; uptime check; a runbook (what to do when the companion is down, when Stripe webhooks fail, when a user asks for deletion).
- [ ] **7.4 Google OAuth verification** for the calendar scope (start at Phase 1.5 — takes weeks).
- [ ] **7.5 Launch checklist** signed off by Mitch and Liz.

---

## 3.4 The readings decision (Mitch must choose — Claude Code implements)

The "wonky, wrong translation" problem is a licensing problem, not a bug. US Catholics expect the **NABRE** (the translation read at Mass). NABRE is copyrighted by the Confraternity of Christian Doctrine; there is no free public API for it. Universalis uses the Jerusalem Bible, which is why it reads "off."

Options, honest trade-offs:

| Option | What it is | Cost/risk |
|---|---|---|
| **A. Link out** | Show the day's reading *references* (from romcal/lectionary data) and one tap opens USCCB's daily readings page (NABRE) in an in-app browser. | Free, legal, fast. Readings aren't "in" the app. Many Catholic apps do exactly this. |
| **B. License NABRE** | Contact USCCB/CCD for a digital license. | Real cost (typically annual fee + per-user terms), weeks of paperwork. This is what Hallow-tier apps do. Right move *after* revenue proves the app. |
| **C. Public-domain text** | Douay-Rheims (public domain) for reading texts, matched to the lectionary references. | Free, legal, fully in-app. Translation is archaic; some users love it, most expect NABRE. |
| **D. Hybrid (recommended)** | A now, B when revenue justifies, C as an optional "traditional" setting. | Ships clean today; upgrade path preserved. |

**Default if no answer: D.** Claude Code builds A cleanly (readings references via lectionary data + one-tap USCCB), adds C as a toggle, and leaves a documented seam for B.

---

## 4. Timeline (honest)

~20–25 Claude Code sessions. At three sessions a week, roughly **8–10 weeks** to TestFlight beta; **3–4 weeks of beta**; then store submission. Realistic launch window: **12–14 weeks from Phase 0** if sessions actually happen. Every skipped week adds a week. The longest external dependencies — Google OAuth verification and Apple Developer enrollment — should start in week 1.

---

## 5. What makes it sellable (the buyer's checklist)

A person buys it because: it's in the App Store, looks finished, sets up in five minutes, the companion feels like a gift, it reminds them to pray, it knows the feast days, their spouse is in it, and it costs less than Hallow.

A parish buys it because: there's a group code, an owner can see who's in, it's Catholic in substance not decoration, and two doctors stand behind it.

An acquirer would buy it because: clean codebase with tests, real subscription revenue, documented backend, no licensing landmines, and a defensible niche. Build it so all three are true.

---

## 6. Session 0 prompt (copy-paste to begin the final run)

```
Read CLAUDE.md and VITA-PLENA-FINAL-PRODUCT-SPEC.md. This is the launch build. We're on Phase 0, task 0.1: scaffold the project with Vite, move the existing 14 files into a src/ structure with a module map, add package.json and .gitignore, and update netlify.toml to publish dist/ and bundle functions. The app must work identically after this step — nothing else changes. Propose the folder structure and migration steps first, wait for my OK, then build, run the build, and give me the deploy verification steps.
```

*One codebase, finished. Ship it.*
