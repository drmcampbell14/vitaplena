/* VITA PLENA — Netlify function: /.netlify/functions/household-admin
   Lifecycle operations that must not be done from the client, because they cross
   the household boundary or delete data the rules protect. Every call carries a
   verified Firebase ID token.

   POST { op, ... } with op one of:
     leave                       leave the household (owner must transfer first unless alone)
     remove_member  { uid }      owner only
     regenerate_code             owner only: new invite code, old one revoked
     transfer_owner { uid }      owner only, to another member
     delete_household            owner only; cascades state, items, briefings, meta, invite
     delete_account              deletes the caller's Firebase account and their user record;
                                 leaves the household first (or deletes it if they were alone)
   Returns { ok: true, ...details } or an error with a plain-English reason. */
import { authenticate, db, adminAuth, gate, handle, json, ownerOf, HttpError, FieldValue } from "./_shared/admin.mjs";

import { makeCode, newHousehold, newState, cleanProfile } from "../../src/core/defaults.js";

const newCode = () => makeCode();

/* ---------------- creating a household ----------------
   This used to happen in the browser as four separate writes: the household, the
   invite code, the state document, then the user's pointer record. Any failure
   in the middle left a half-made household and a user who could not get into it,
   reported as "Could not create household" even though one had just been made.

   It cannot be fixed with a client-side batch. The rules check membership by
   reading the household document (isMemberOf does a get()), and a document
   written earlier in the same batch is not visible to those reads — so the state
   and invite writes would be denied. Doing it here, where the Admin SDK bypasses
   rules, is the only way all four land or none do.

   Split out and exported so it can be tested against a fake Firestore; the live
   one is passed in. */
/** @param {{fs:any, uid:string, name:string, initials:string, houseName?:string,
 *           code?:()=>string, now?:Date, tries?:number}} args */
export async function createHousehold({ fs, uid, name, initials, houseName, code = newCode, now = new Date(), tries = 5 }) {
  const profile = cleanProfile({ name, initials });
  const house = String(houseName || "").trim().slice(0, 80) || `${profile.name}'s Household`;

  /* Refuse if this account is already in a household, so a double-tap on Create
     cannot strand the first household with nobody pointing at it. */
  const userSnap = await fs.doc(`users/${uid}`).get();
  const existing = userSnap.exists ? userSnap.get("hid") : null;
  if (existing) {
    const prior = await fs.doc(`households/${existing}`).get();
    if (prior.exists && (prior.get("members") || []).includes(uid)) return { hid: existing, existed: true };
  }

  /* A code is only useful if it is free: two households sharing one code would
     send a joining spouse to whichever was written first. */
  let invite = null;
  for (let i = 0; i < tries; i++) {
    const candidate = code();
    const taken = await fs.doc(`invites/${candidate}`).get();
    if (!taken.exists) { invite = candidate; break; }
  }
  if (!invite) throw new HttpError(503, "Could not allocate an invite code. Try again.");

  const ref = fs.collection("households").doc();      // id minted here, so the batch can use it
  const batch = fs.batch();
  batch.set(ref, { ...newHousehold({ uid, houseName: house, profile, now }), code: invite });
  batch.set(fs.doc(`households/${ref.id}/state/main`), newState(uid));
  batch.set(fs.doc(`invites/${invite}`), { hid: ref.id });
  batch.set(fs.doc(`users/${uid}`), { hid: ref.id, name: profile.name, initials: profile.initials });
  await batch.commit();
  return { hid: ref.id, code: invite };
}

export default handle(async (req, headers) => {
  const early = gate(req, headers);
  if (early) return early;

  let body;
  try { body = await req.json(); } catch { throw new HttpError(400, "Bad request"); }
  const op = String(body.op || "");

  const needsHousehold = op !== "delete_account" && op !== "create_household";
  const { uid, hid, house, houseRef } = await authenticate(req, { requireHousehold: needsHousehold });
  const fs = db();
  const owner = house ? ownerOf(house) : null;
  const isOwner = house && owner === uid;
  const members = house ? (house.members || []) : [];

  const leaveHousehold = async () => {
    if (isOwner && members.length > 1) throw new HttpError(400, "Transfer ownership to someone else before leaving");
    if (members.length === 1) return deleteHousehold();
    await houseRef.update({ members: FieldValue.arrayRemove(uid), [`profiles.${uid}`]: FieldValue.delete() });
    await fs.doc(`users/${uid}`).set({ hid: FieldValue.delete() }, { merge: true });
    return { left: true };
  };
  const deleteHousehold = async () => {
    if (house.code) await fs.doc(`invites/${house.code}`).delete().catch(() => {});
    for (const m of members) await fs.doc(`users/${m}`).set({ hid: FieldValue.delete() }, { merge: true }).catch(() => {});
    await fs.recursiveDelete(houseRef);
    return { deleted: true };
  };

  switch (op) {
    case "create_household":
      return json(200, await createHousehold({ fs, uid, name: body.name, initials: body.initials, houseName: body.houseName }), headers);

    case "leave":
      return json(200, { ok: true, ...(await leaveHousehold()) }, headers);

    case "remove_member": {
      if (!isOwner) throw new HttpError(403, "Only the owner can remove a member");
      const target = String(body.uid || "");
      if (!members.includes(target)) throw new HttpError(400, "That person isn't in this household");
      if (target === uid) throw new HttpError(400, "Use Leave to remove yourself");
      await houseRef.update({ members: FieldValue.arrayRemove(target), [`profiles.${target}`]: FieldValue.delete() });
      await fs.doc(`users/${target}`).set({ hid: FieldValue.delete() }, { merge: true });
      return json(200, { ok: true, removed: target }, headers);
    }

    case "regenerate_code": {
      if (!isOwner) throw new HttpError(403, "Only the owner can change the invite code");
      let code = newCode();
      for (let i = 0; i < 5 && (await fs.doc(`invites/${code}`).get()).exists; i++) code = newCode();
      if (house.code) await fs.doc(`invites/${house.code}`).delete().catch(() => {});
      await fs.doc(`invites/${code}`).set({ hid });
      await houseRef.update({ code });
      return json(200, { ok: true, code }, headers);
    }

    case "transfer_owner": {
      if (!isOwner) throw new HttpError(403, "Only the owner can transfer ownership");
      const target = String(body.uid || "");
      if (!members.includes(target) || target === uid) throw new HttpError(400, "Choose another member");
      await houseRef.update({ owner: target });
      return json(200, { ok: true, owner: target }, headers);
    }

    case "delete_household": {
      if (!isOwner) throw new HttpError(403, "Only the owner can delete the household");
      return json(200, { ok: true, ...(await deleteHousehold()) }, headers);
    }

    case "delete_account": {
      if (house) {
        if (isOwner && members.length > 1) throw new HttpError(400, "Transfer ownership of the household before deleting your account");
        await leaveHousehold();
      }
      await fs.doc(`users/${uid}`).delete().catch(() => {});
      await adminAuth().deleteUser(uid);
      return json(200, { ok: true, accountDeleted: true }, headers);
    }

    default:
      throw new HttpError(400, "Unknown operation");
  }
});
