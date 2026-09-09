/* Vita Plena — calling our own Netlify functions with the signed-in user's token. */
import { auth } from "../core/data.js";

/** POST JSON to /.netlify/functions/<name>. Resolves the parsed body; rejects with
    { status, error } so callers can show the server's plain-English reason. */
export async function callFn(name, body = {}) {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  if (!token) throw { status: 401, error: "You've been signed out. Sign in again." };
  const r = await fetch("/.netlify/functions/" + name, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw { status: r.status, error: data.error || ("Request failed (" + r.status + ")") };
  return data;
}
