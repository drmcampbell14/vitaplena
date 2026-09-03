import { describe, it, expect } from "vitest";
import { extraOrigins, isAllowedOrigin, parseBearer } from "../netlify/functions/companion.mjs";

/* The handler itself needs Firebase Admin and the network; these cover the pure
   request-gating helpers it relies on. The end-to-end acceptance test is manual:
   curl without a token → 401, with a real token → 200 (see the spec, task 1.2). */

const FN = "https://vitaplena13.netlify.app/.netlify/functions/companion";
const BRANCH_FN = "https://claude-phase-1-security-auth-hsb3x5--vitaplena13.netlify.app/.netlify/functions/companion";

describe("parseBearer()", () => {
  it("extracts the token and tolerates case and whitespace", () => {
    expect(parseBearer("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(parseBearer("  bearer   abc  ")).toBe("abc");
  });
  it("rejects anything that isn't a bearer token", () => {
    expect(parseBearer("")).toBeNull();
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer("Basic abc")).toBeNull();
    expect(parseBearer("Bearer")).toBeNull();
    expect(parseBearer("Bearer a b")).toBeNull();
  });
});

describe("extraOrigins()", () => {
  it("includes ALLOWED_ORIGIN (slash stripped), the dev server, and the Capacitor shells", () => {
    const set = extraOrigins({ ALLOWED_ORIGIN: "https://app.cognitivechristian.com/" });
    expect(set.has("https://app.cognitivechristian.com")).toBe(true);
    expect(set.has("http://localhost:5173")).toBe(true);
    expect(set.has("capacitor://localhost")).toBe(true);
    expect(set.has("http://localhost")).toBe(true);
    expect(set.has("https://app.cognitivechristian.com/")).toBe(false);
  });
  it("ignores an unset ALLOWED_ORIGIN", () => {
    expect(extraOrigins({}).has(undefined)).toBe(false);
  });
});

describe("isAllowedOrigin()", () => {
  const none = new Set();

  it("always allows the site's own origin, so production and branch deploys need no config", () => {
    expect(isAllowedOrigin("https://vitaplena13.netlify.app", FN, none)).toBe(true);
    expect(isAllowedOrigin("https://vitaplena13.netlify.app/", FN, none)).toBe(true);
    expect(isAllowedOrigin("https://claude-phase-1-security-auth-hsb3x5--vitaplena13.netlify.app", BRANCH_FN, none)).toBe(true);
  });

  it("does not let production's origin call a branch deploy's function, or vice versa", () => {
    expect(isAllowedOrigin("https://vitaplena13.netlify.app", BRANCH_FN, none)).toBe(false);
    expect(isAllowedOrigin("https://claude-phase-1-security-auth-hsb3x5--vitaplena13.netlify.app", FN, none)).toBe(false);
  });

  it("blocks other browser origins, including a scheme mismatch", () => {
    expect(isAllowedOrigin("https://evil.example", FN, none)).toBe(false);
    expect(isAllowedOrigin("http://vitaplena13.netlify.app", FN, none)).toBe(false);
  });

  it("allows configured extra origins", () => {
    const extra = new Set(["https://app.cognitivechristian.com", "capacitor://localhost"]);
    expect(isAllowedOrigin("https://app.cognitivechristian.com", FN, extra)).toBe(true);
    expect(isAllowedOrigin("capacitor://localhost", FN, extra)).toBe(true);
  });

  it("lets non-browser callers (no Origin header) through to the token check", () => {
    expect(isAllowedOrigin("", FN, none)).toBe(true);
    expect(isAllowedOrigin(undefined, FN, none)).toBe(true);
  });

  it("survives an unparseable request URL by falling back to the extra list", () => {
    expect(isAllowedOrigin("https://evil.example", "not a url", none)).toBe(false);
    expect(isAllowedOrigin("http://localhost:5173", "not a url", new Set(["http://localhost:5173"]))).toBe(true);
  });
});
