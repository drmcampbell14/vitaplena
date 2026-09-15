/* Vita Plena — what a brand-new household starts with.
   Deliberately free of Firebase and of the DOM, so the Netlify function that
   creates households can import exactly the same seed the app used to write from
   the browser. One definition, one shape, no drift between client and server. */

export const DEFAULT_PRACTICES = [
  { id: "p1", name: "Morning Offering", emoji: "🙏", time: "07:00", mins: 5, days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "p2", name: "Holy Mass", emoji: "✝️", time: "08:00", mins: 60, days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "p3", name: "Angelus", emoji: "🔔", time: "12:00", mins: 5, days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "p4", name: "Holy Rosary", emoji: "📿", time: "19:00", mins: 20, days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "p5", name: "Evening Examen", emoji: "🕯️", time: "21:00", mins: 10, days: [0, 1, 2, 3, 4, 5, 6] }
];

export const DEFAULT_PLAN = [
  { id: "pl1", text: "Daily Mass" },
  { id: "pl2", text: "Holy Rosary" },
  { id: "pl3", text: "Spiritual reading 15 min" },
  { id: "pl4", text: "Weekly confession" }
];

/* Invite codes skip I, L, O, 0 and 1 — the characters people mistype when reading
   a code off a phone screen to their spouse. */
export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A random 6-character invite code. Uniqueness is checked where it is written. */
export function makeCode(random = Math.random) {
  let out = "";
  for (let i = 0; i < 6; i++) out += INVITE_ALPHABET[Math.floor(random() * INVITE_ALPHABET.length)];
  return out;
}

/** Short id for seeded rows; the app's rid() by another name, without the DOM. */
const sid = () => Math.random().toString(36).slice(2, 10);

/** The household document for a brand-new household, owned by `uid`. */
export function newHousehold({ uid, houseName, profile, now = new Date() }) {
  const trialEnds = new Date(now);
  trialEnds.setDate(trialEnds.getDate() + 30);
  return {
    name: houseName,
    owner: uid,
    members: [uid],
    profiles: { [uid]: profile },
    /* Always "trial". The rules refuse any other status at creation, and only the
       billing webhook (Admin SDK, rules bypassed) may change it afterwards. */
    subscription: { status: "trial", plan: "family", source: "none", trialEndsAt: trialEnds.toISOString().slice(0, 10) },
    countdown: { label: "", date: "" }
  };
}

/** The state/main document for a brand-new household. */
export function newState(uid) {
  return {
    practices: DEFAULT_PRACTICES, plan: DEFAULT_PLAN, rhythmDone: {},
    taskSections: {
      [uid]: [{ id: sid(), name: "Career & Goals", emoji: "🎯" }],
      together: [
        { id: sid(), name: "Household", emoji: "🏡" },
        { id: sid(), name: "Faith", emoji: "✝️" },
        { id: sid(), name: "Health", emoji: "💪" }
      ]
    },
    meals: {}, grocery: [], budget: { income: [], expense: [], savings: [] }, funds: [], debts: [],
    focus: [], countdowns: [], books: [], virtue: {}, confession: {}, people: [],
    modules: { meals: false, finance: false, family: false, notes: false }
  };
}

/** Name and initials, trimmed and bounded. Throws a plain Error on junk. */
export function cleanProfile({ name, initials }) {
  const n = String(name || "").trim().slice(0, 60);
  const i = String(initials || "").trim().toUpperCase().slice(0, 4);
  if (!n) throw new Error("Add your name.");
  if (!i) throw new Error("Add your initials.");
  return { name: n, initials: i };
}
