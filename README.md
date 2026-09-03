# Vita Plena

A Catholic household's rule of life. God → Family → Vocation → Rest, with a companion that runs the schedule from plain English, and a house that rings for prayer.

- **Production (v4):** https://vitaplena13.netlify.app (from `main`)
- **v5 build:** https://claude-phase-1-security-auth-hsb3x5--vitaplena13.netlify.app (from `claude/phase-1-security-auth-hsb3x5`)
- **Spec:** [VITA-PLENA-FINAL-PRODUCT-SPEC.md](VITA-PLENA-FINAL-PRODUCT-SPEC.md) — the single source of truth
- **Agent instructions:** [CLAUDE.md](CLAUDE.md)

## Run it

```
npm install
npm run dev        # http://localhost:5173 (companion calls go to the deployed function)
npm test           # Vitest
npm run build      # → dist/
```

## Stack

Vite + vanilla ES modules (no framework), Firebase Auth + Firestore, Netlify hosting and functions. The companion function uses the Firebase Admin SDK and the Anthropic API.

Secrets live in Netlify environment variables only: `ANTHROPIC_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, optional `ALLOWED_ORIGIN`. See spec §7.
