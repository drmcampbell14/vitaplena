import { describe, it, expect } from "vitest";
import { createHousehold } from "../netlify/functions/household-admin.mjs";

/* Sign-up is the one path every new user walks exactly once, and it cannot be
   exercised against real Firestore from a test. So it is driven here against a
   fake that records what would be written, and the assertions are about the
   things that actually go wrong: a half-written household, a duplicated invite
   code, and a double-tap making two. */

function fakeFirestore(seed = {}) {
  const docs = new Map(Object.entries(seed));
  const writes = [];
  let commits = 0;
  let autoId = 0;
  const snap = (path) => ({
    exists: docs.has(path),
    get: (field) => (docs.get(path) || {})[field]
  });
  const fs = {
    doc: (path) => ({ id: path.split("/").pop(), path, get: async () => snap(path) }),
    collection: (name) => ({ doc: () => { const id = "h" + ++autoId; return { id, path: `${name}/${id}` }; } }),
    batch: () => ({
      set(ref, data) { writes.push({ path: ref.path, data }); },
      async commit() { commits++; for (const w of writes) docs.set(w.path, w.data); }
    })
  };
  return { fs, writes, docs, commits: () => commits };
}

const args = { uid: "u1", name: "Mitch", initials: "mc", houseName: "The Campbells" };

describe("createHousehold()", () => {
  it("writes the household, its state, the invite and the user pointer in ONE batch", async () => {
    const f = fakeFirestore();
    const out = await createHousehold({ fs: f.fs, uid: "u1", ...args, code: () => "ABC234" });
    expect(f.commits()).toBe(1);                       // all four land together, or none do
    expect(f.writes.map((w) => w.path)).toEqual([
      "households/h1", "households/h1/state/main", "invites/ABC234", "users/u1"
    ]);
    expect(out).toEqual({ hid: "h1", code: "ABC234" });
  });

  it("seeds a household owned solely by its creator, on trial", async () => {
    const f = fakeFirestore();
    await createHousehold({ fs: f.fs, ...args, code: () => "ABC234" });
    const house = f.writes[0].data;
    expect(house.members).toEqual(["u1"]);
    expect(house.owner).toBe("u1");
    expect(house.code).toBe("ABC234");
    expect(Object.keys(house.profiles)).toEqual(["u1"]);
    expect(house.profiles.u1).toEqual({ name: "Mitch", initials: "MC" });   // initials upper-cased
    /* The rules refuse any status but "trial" at creation; anything else here
       would make every sign-up fail. */
    expect(house.subscription.status).toBe("trial");
    expect(f.writes[1].data.practices.length).toBeGreaterThan(0);
    expect(f.writes[2].data).toEqual({ hid: "h1" });
    expect(f.writes[3].data).toEqual({ hid: "h1", name: "Mitch", initials: "MC" });
  });

  it("never reuses an invite code that is already taken", async () => {
    const f = fakeFirestore({ "invites/TAKEN1": { hid: "old" }, "invites/TAKEN2": { hid: "old" } });
    const codes = ["TAKEN1", "TAKEN2", "FREE33"];
    let i = 0;
    const out = await createHousehold({ fs: f.fs, ...args, code: () => codes[i++] });
    expect(out.code).toBe("FREE33");
    expect(f.writes.some((w) => w.path === "invites/FREE33")).toBe(true);
  });

  it("gives up rather than stealing a code when every attempt collides", async () => {
    const f = fakeFirestore({ "invites/TAKEN1": { hid: "old" } });
    await expect(createHousehold({ fs: f.fs, ...args, code: () => "TAKEN1", tries: 3 }))
      .rejects.toMatchObject({ status: 503 });
    expect(f.commits()).toBe(0);                       // nothing written on the way out
  });

  it("a second tap returns the household already made instead of making another", async () => {
    const f = fakeFirestore({ "users/u1": { hid: "h0" }, "households/h0": { members: ["u1"] } });
    const out = await createHousehold({ fs: f.fs, ...args, code: () => "ABC234" });
    expect(out).toEqual({ hid: "h0", existed: true });
    expect(f.commits()).toBe(0);
  });

  it("ignores a stale pointer to a household the user is no longer in", async () => {
    const f = fakeFirestore({ "users/u1": { hid: "hGone" }, "households/hGone": { members: ["someone-else"] } });
    const out = await createHousehold({ fs: f.fs, ...args, code: () => "ABC234" });
    expect(out.hid).toBe("h1");
  });

  it("refuses junk instead of creating a nameless household", async () => {
    const f = fakeFirestore();
    await expect(createHousehold({ fs: f.fs, uid: "u1", name: "  ", initials: "MC" })).rejects.toThrow(/name/i);
    await expect(createHousehold({ fs: f.fs, uid: "u1", name: "Mitch", initials: " " })).rejects.toThrow(/initials/i);
    expect(f.commits()).toBe(0);
  });

  it("falls back to a household name when none is given", async () => {
    const f = fakeFirestore();
    await createHousehold({ fs: f.fs, uid: "u1", name: "Mitch", initials: "MC", houseName: "", code: () => "ABC234" });
    expect(f.writes[0].data.name).toBe("Mitch's Household");
  });
});
