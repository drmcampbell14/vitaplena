# Vita Plena — Agent Instructions

## What this is
A Catholic household PWA for Mitch and Liz Campbell. Firebase auth, Firestore, Netlify hosting + serverless functions (one calls the Anthropic API for the AI companion). Deployed at vitaplena13.netlify.app via GitHub → Netlify.

## Core features to protect (never break these)
- Liturgical season theming
- Google Calendar two-way sync
- Per-user task filtering (Mitch vs Liz)
- Traditional Catholic prayer library
- AI companion (Netlify function → Anthropic API)

## Working rules
- Small, reviewable commits with clear messages. Never force-push.
- Test locally before any deploy-affecting change.
- Never touch Firebase security rules, auth config, or the Anthropic API function without explicitly confirming with me first.
- Never commit secrets. Env vars stay in Netlify.
- This app will eventually become a paid product — write code and comments as if another developer will read them.
- When I describe a feature, propose the approach in 3–5 sentences and wait for my OK before implementing anything non-trivial.

## Current priorities
(Keep this list updated)
1. Stability of calendar sync
2. Polish for eventual waitlist/beta users
3. Groundwork for future Capacitor/App Store conversion — avoid PWA-only patterns where possible
