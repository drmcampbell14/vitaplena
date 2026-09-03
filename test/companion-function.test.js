import { describe, it, expect } from "vitest";
import { allowedOrigins, isAllowedOrigin, parseBearer } from "../netlify/functions/companion.mjs";

/* The handler itself needs Firebase Admin and the network; these cover the pure
   request-gating helpers it relies on. The end-to-end acceptance test is manual:
   curl without a token → 401, with a real token → 200 (see the spec, task 1.2). */

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

describe("allowedOrigins()", () => {
  it("collects the configured origin plus Netlify's own URLs, trailing slashes stripped", () => {
    const set = allowedOrigins({
      ALLOWED_ORIGIN: "https://vitaplena13.netlify.app/",
      URL: "https://vitaplena13.netlify.app",
      DEPLOY_PRIME_URL: "https://some-branch--vitaplena13.netlify.app"
    });
    expect(set.has("https://vitaplena13.netlify.app")).toBe(true);
    expect(set.has("https://some-branch--vitaplena13.netlify.app")).toBe(true);
    expect(set.has("http://localhost:5173")).toBe(true);
    expect(set.has("https://vitaplena13.netlify.app/")).toBe(false);
  });
  it("ignores unset values", () => {
    expect(allowedOrigins({}).has(undefined)).toBe(false);
  });
});

describe("isAllowedOrigin()", () => {
  const allowed = new Set(["https://vitaplena13.netlify.app"]);
  it("passes the configured origin, with or without a trailing slash", () => {
    expect(isAllowedOrigin("https://vitaplena13.netlify.app", allowed)).toBe(true);
    expect(isAllowedOrigin("https://vitaplena13.netlify.app/", allowed)).toBe(true);
  });
  it("blocks other browser origins", () => {
    expect(isAllowedOrigin("https://evil.example", allowed)).toBe(false);
    expect(isAllowedOrigin("http://vitaplena13.netlify.app", allowed)).toBe(false);
  });
  it("lets non-browser callers (no Origin header) through to the token check", () => {
    expect(isAllowedOrigin("", allowed)).toBe(true);
    expect(isAllowedOrigin(undefined, allowed)).toBe(true);
  });
  it("is open when nothing is configured", () => {
    expect(isAllowedOrigin("https://anything.example", new Set())).toBe(true);
  });
});
