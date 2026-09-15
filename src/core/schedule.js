/* Vita Plena — placing the day's tasks into its free time.

   The day's fixed shape is the rule (practices) and the calendar (events). Tasks
   have no fixed hour; each has a length, maybe a preferred part of the day, and
   maybe a locked time. This packs the undone ones into the gaps, from now
   forward, so a task not done by its slot simply flows into the next gap on the
   next render rather than nagging from a time that has passed.

   Pure: takes plain values, returns plain values, no dates beyond "HH:MM". */

export const BUFFER_MINS = 15;       // travel and reset either side of an event
export const DAY_END = "21:30";       // nothing is placed after this
export const DEFAULT_TASK_MINS = 15;
const STEP = 5;                       // slots start on a five-minute boundary

/** "HH:MM" → minutes since midnight, or null for junk. */
export function toMin(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  const h = +m[1], mm = +m[2];
  return h > 23 || mm > 59 ? null : h * 60 + mm;
}
/** minutes since midnight → "HH:MM", clamped to the day. */
export function toHHMM(n) {
  const x = Math.max(0, Math.min(1439, Math.round(n)));
  return String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0");
}
const roundUp = (n, step) => Math.ceil(n / step) * step;

/* The parts of the day a hint names. A hint of "HH:MM" means the part containing it. */
const PARTS = { morning: [0, 12 * 60], afternoon: [12 * 60, 17 * 60], evening: [17 * 60, 24 * 60] };
export function hintRange(hint) {
  if (!hint) return null;
  if (PARTS[hint]) return PARTS[hint];
  const t = toMin(hint);
  if (t === null) return null;
  return t < 12 * 60 ? PARTS.morning : t < 17 * 60 ? PARTS.afternoon : PARTS.evening;
}

/** Merge overlapping [start,end] minute ranges, sorted. */
function merge(blocks) {
  const s = blocks.filter((b) => b[1] > b[0]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const b of s) {
    const last = out[out.length - 1];
    if (last && b[0] <= last[1]) last[1] = Math.max(last[1], b[1]);
    else out.push([b[0], b[1]]);
  }
  return out;
}

/** The gaps between blocks, inside [from, to]. */
function gaps(blocks, from, to) {
  const out = [];
  let cursor = from;
  for (const [s, e] of merge(blocks)) {
    if (e <= cursor) continue;
    if (s > cursor) out.push([cursor, Math.min(s, to)]);
    cursor = Math.max(cursor, e);
    if (cursor >= to) break;
  }
  if (cursor < to) out.push([cursor, to]);
  return out.filter(([s, e]) => e - s >= STEP);
}

/**
 * Place tasks into the day.
 * @param {object} args
 * @param {{id:string, mins?:number, lock?:string|null, hint?:string|null, due?:string}[]} args.tasks  undone tasks for today
 * @param {{start:string, end:string, pad?:boolean}[]} args.busy   practices (pad false) and events (pad true)
 * @param {string} [args.dayStart]  when the day begins, "HH:MM"
 * @param {string} [args.dayEnd]
 * @param {string} [args.now]       nothing is placed before this
 * @param {number} [args.buffer]    minutes either side of a padded block
 * @returns {{placed: {id:string,start:string,end:string,locked:boolean}[], later: string[]}}
 *   `later` are the ids that fit nowhere today.
 */
export function scheduleTasks({ tasks, busy, dayStart = "07:00", dayEnd = DAY_END, now = dayStart, buffer = BUFFER_MINS }) {
  const start = toMin(dayStart) ?? 7 * 60;
  const end = toMin(dayEnd) ?? toMin(DAY_END);
  const cursor = Math.max(start, roundUp(toMin(now) ?? start, STEP));

  const blocks = busy.map((b) => {
    const s = toMin(b.start), e = toMin(b.end);
    if (s === null || e === null) return null;
    const pad = b.pad ? buffer : 0;
    return [s - pad, Math.max(e, s + STEP) + pad];
  }).filter(Boolean);

  const placed = [];
  const later = [];
  const rest = [];

  /* Locked tasks first: a lock still ahead of us is kept and blocks the slot.
     A lock already behind us is released — the task flows forward like any other,
     which is the whole point of not being strict. */
  for (const t of tasks) {
    const mins = Math.max(STEP, t.mins || DEFAULT_TASK_MINS);
    const lock = toMin(t.lock);
    if (lock !== null && lock >= cursor && lock + mins <= end + 60) {
      placed.push({ id: t.id, start: toHHMM(lock), end: toHHMM(lock + mins), locked: true });
      blocks.push([lock, lock + mins]);
    } else rest.push({ ...t, mins });
  }

  /* Soonest due first, undated last; among equals the longer task first, so the
     big thing gets the big gap and the small ones fill what is left. */
  rest.sort((a, b) => ((a.due || "￿") < (b.due || "￿") ? -1 : (a.due || "￿") > (b.due || "￿") ? 1 : b.mins - a.mins));

  let free = gaps(blocks, cursor, end);
  const take = (t, idx, at) => {
    const [s, e] = free[idx];
    placed.push({ id: t.id, start: toHHMM(at), end: toHHMM(at + t.mins), locked: false });
    const next = [];
    if (at - s >= STEP) next.push([s, at]);
    if (e - (at + t.mins) >= STEP) next.push([at + t.mins, e]);
    free.splice(idx, 1, ...next);
  };
  for (const t of rest) {
    const range = hintRange(t.hint);
    let hit = -1, at = 0;
    if (range) {
      for (let i = 0; i < free.length; i++) {
        const [s, e] = free[i];
        const from = roundUp(Math.max(s, range[0]), STEP);
        if (from < range[1] && from + t.mins <= e) { hit = i; at = from; break; }
      }
    }
    if (hit < 0) {
      for (let i = 0; i < free.length; i++) {
        const [s, e] = free[i];
        if (s + t.mins <= e) { hit = i; at = s; break; }
      }
    }
    if (hit < 0) later.push(t.id); else take(t, hit, at);
  }
  placed.sort((a, b) => a.start.localeCompare(b.start));
  return { placed, later };
}
