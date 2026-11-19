import { defaultSave, peekSeasonUsed, seasonLeftToday, armSeasonClaim, consumeSeasonClaim, mergeSeasonMeta, resetSeasonClaimForTests, SEASON_DAILY_LIMIT } from "../src/game";

// applySeasonOpen may not be exported; use arm/consume only.
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

resetSeasonClaimForTests();
const save = defaultSave();
let meta = save.meta;
const now = Date.now();

// 20 rapid claims → 10 opens
let opened = 0;
for (let i = 0; i < 20; i++) {
  if (!armSeasonClaim(meta, 1, now)) continue;
  const n = consumeSeasonClaim();
  assert(n === 1, "consume 1");
  const used = peekSeasonUsed(meta.seasonDay, meta.seasonN, now);
  meta = { ...meta, seasonDay: used.day, seasonN: used.n };
  opened += 1;
}
assert(opened === SEASON_DAILY_LIMIT, "rapid opens " + opened + " != " + SEASON_DAILY_LIMIT);
assert(seasonLeftToday(meta, now) === 0, "no leftovers");

// reload: peek from side stamp with empty meta
const reload = peekSeasonUsed("", 0, now);
assert(reload.n === SEASON_DAILY_LIMIT, "reload still " + reload.n);

// old backup with lower count cannot rewind
const merged = mergeSeasonMeta({ ...meta, seasonDay: meta.seasonDay, seasonN: 2 });
assert(merged.seasonN === SEASON_DAILY_LIMIT, "restore cannot rewind, got " + merged.seasonN);

// clock rollback keeps the count
const rolled = peekSeasonUsed(meta.seasonDay, meta.seasonN, now - 86400_000);
assert(rolled.n === SEASON_DAILY_LIMIT, "clock rollback kept " + rolled.n);

// next local day (forward) resets
const tomorrow = now + 36 * 60 * 60 * 1000;
const nxt = peekSeasonUsed(meta.seasonDay, meta.seasonN, tomorrow);
assert(nxt.n === 0, "next day reset, got " + nxt.n + " day " + nxt.day);
assert(seasonLeftToday({ ...meta, seasonDay: nxt.day, seasonN: nxt.n }, tomorrow) === SEASON_DAILY_LIMIT, "full 10 tomorrow");

console.log("ALL_SEASON_CD_OK", opened + "/" + SEASON_DAILY_LIMIT);
