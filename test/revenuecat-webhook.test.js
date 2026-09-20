import { describe, it, expect } from "vitest";
import { applyEvent, householdsFor } from "../netlify/functions/revenuecat-webhook.mjs";

/* The webhook is the only writer of households/{hid}.subscription once the
   stores are live, so its mapping from RevenueCat events to our one status
   field is pinned down here. */
const now = Date.UTC(2026, 8, 22, 12);
const day = 864e5;
const ev = (type, extra = {}) => ({ type, app_user_id: "house1", product_id: "family_yearly", store: "APP_STORE", environment: "PRODUCTION",
  event_timestamp_ms: now, purchased_at_ms: now, expiration_at_ms: now + 365 * day, period_type: "NORMAL", ...extra });
const trial = { status: "trial", plan: "family", source: "none", trialEndsAt: "2026-10-10" };

describe("applyEvent", () => {
  it("a first purchase makes the household active and keeps the trial date for the record", () => {
    const s = applyEvent(trial, ev("INITIAL_PURCHASE"), now);
    expect(s.status).toBe("active");
    expect(s.source).toBe("apple");
    expect(s.renewsAt).toBe("2027-09-22");
    expect(s.trialEndsAt).toBe("2026-10-10");
    expect(s.sandbox).toBe(false);
    expect(s.introductory).toBe(false);
  });
  it("a store free trial is active and marked introductory", () => {
    expect(applyEvent(trial, ev("INITIAL_PURCHASE", { period_type: "TRIAL" }), now).introductory).toBe(true);
  });
  it("renewal extends; cancellation keeps it paid through the period; expiration lapses it", () => {
    const active = applyEvent(trial, ev("INITIAL_PURCHASE"), now);
    const renewed = applyEvent(active, ev("RENEWAL", { event_timestamp_ms: now + 1, expiration_at_ms: now + 730 * day }), now);
    expect(renewed.renewsAt).toBe("2028-09-21");
    const cancelled = applyEvent(renewed, ev("CANCELLATION", { event_timestamp_ms: now + 2 }), now);
    expect(cancelled.status).toBe("active");
    expect(cancelled.cancelled).toBe(true);
    const expired = applyEvent(cancelled, ev("EXPIRATION", { event_timestamp_ms: now + 3, expiration_reason: "UNSUBSCRIBE" }), now);
    expect(expired.status).toBe("lapsed");
    expect(expired.expiredBecause).toBe("UNSUBSCRIBE");
    const back = applyEvent(expired, ev("INITIAL_PURCHASE", { event_timestamp_ms: now + 4 }), now);
    expect(back.status).toBe("active");
    expect(back.cancelled).toBe(false);
  });
  it("a cancellation whose period already ended lapses at once", () => {
    const s = applyEvent({ status: "active" }, ev("CANCELLATION", { expiration_at_ms: now - day }), now);
    expect(s.status).toBe("lapsed");
  });
  it("a billing issue does not cut anyone off; a pause does", () => {
    expect(applyEvent({ status: "active" }, ev("BILLING_ISSUE"), now)).toMatchObject({ status: "active", billingIssue: true });
    expect(applyEvent({ status: "active" }, ev("SUBSCRIPTION_PAUSED", { store: "PLAY_STORE" }), now)).toMatchObject({ status: "lapsed", paused: true, source: "google" });
  });
  it("ignores test pings, aliases, unknown types, and stale events", () => {
    expect(applyEvent(trial, ev("TEST"), now)).toBeNull();
    expect(applyEvent(trial, ev("SUBSCRIBER_ALIAS"), now)).toBeNull();
    expect(applyEvent(trial, ev("SOMETHING_NEW"), now)).toBeNull();
    const active = applyEvent(trial, ev("INITIAL_PURCHASE"), now);
    expect(applyEvent(active, ev("EXPIRATION", { event_timestamp_ms: now - 10 }), now)).toBeNull();
  });
  it("records sandbox purchases as such, so testing never looks like revenue", () => {
    expect(applyEvent(trial, ev("INITIAL_PURCHASE", { environment: "SANDBOX" }), now).sandbox).toBe(true);
  });
});

describe("householdsFor", () => {
  it("names the household on an ordinary event, once, ignoring ids that aren't ours", () => {
    expect(householdsFor(ev("RENEWAL", { original_app_user_id: "house1", aliases: ["house1", "$RCAnonymousID:abc/def"] }))).toEqual({ lapsed: [], active: ["house1"] });
  });
  it("on a transfer, the old household lapses and the new one gains", () => {
    expect(householdsFor({ type: "TRANSFER", transferred_from: ["houseA"], transferred_to: ["houseB"] })).toEqual({ lapsed: ["houseA"], active: ["houseB"] });
  });
});
