import {
  VERSION, POTW_CHASE, CHASE_IDS, SEASON_CHASE, isChaseCard, originPack, drawCard, chaseOf,
  FREE_COOLDOWN, isFreeReady, armFreeClaim, consumeFreeClaim, peekFreeAt, mergeFreeMeta, resetFreeClaimForTests,
  lastFreeAt,
} from "../src/game";

// rpool may not be exported — gold values use valueOf instead.

let failed = 0;
function ok(cond: boolean, msg: string): void {
  if (!cond) { failed++; console.error("FAIL", msg); }
  else console.log("ok", msg);
}

console.log("VERSION", VERSION);
resetFreeClaimForTests();

ok(POTW_CHASE.length === 3, "3 POTW chase players found");
ok(POTW_CHASE.map((p) => p.name).join(",") === "Derrick Henry,Jayden Daniels,Puka Nacua", "POTW chase names");
for (const p of POTW_CHASE) {
  const home = ([] as string[]).concat(...(["rookie", "stars", "legends"] as const).map((h) => chaseOf(h).map((x) => x.id)));
  const season = ([] as string[]).concat(...(Object.keys(SEASON_CHASE) as (keyof typeof SEASON_CHASE)[]).map((id) => SEASON_CHASE[id].map((x) => x.id)));
  ok(!home.includes(p.id) && !season.includes(p.id), p.name + " is not a chase elsewhere");
  ok(CHASE_IDS.has(p.id), p.name + " is in CHASE_IDS");
}

// Simulate opening a Free Pack (claimDaily + startOpen) twice in the same tick and again after a reload.
const now = 1_800_000_000_000; // fixed "now"
ok(isFreeReady("", now), "first claim is ready");
ok(armFreeClaim("", now), "arm first claim");
ok(!armFreeClaim("", now), "second arm in the same tick is rejected");
ok(!isFreeReady("", now), "tile is not ready after arm");
ok(consumeFreeClaim(), "startOpen consumes the one-shot token");
ok(!consumeFreeClaim(), "a second startOpen (Open another / double tap / readyPack) cannot consume a token");
ok(!armFreeClaim("", now + 1000), "rapid re-claim 1s later is rejected");
ok(!armFreeClaim("", now + FREE_COOLDOWN - 1), "claim 1ms before cooldown ends is rejected");
ok(isFreeReady("", now + FREE_COOLDOWN), "ready after 5 minutes");
ok(armFreeClaim("", now + FREE_COOLDOWN), "arm after cooldown");
consumeFreeClaim();

// Reload during reveal: stamp is already in memory, so a new session that only has the save still sees the cooldown if we merge.
resetFreeClaimForTests();
ok(armFreeClaim("", now), "arm for reload case");
const stamped = peekFreeAt("");
const reloaded = mergeFreeMeta({ daily: "", dailyN: 0, sets: [], ach: [] });
ok(lastFreeAt(reloaded.daily) === stamped, "reload/backup without daily still inherits the side stamp");
ok(!isFreeReady(reloaded.daily, now + 1000), "reload mid-reveal cannot claim again");

// An older backup cannot rewind the stamp.
const oldBackup = mergeFreeMeta({ daily: String(now - 60 * 60 * 1000), dailyN: 3, sets: [], ach: [] });
ok(lastFreeAt(oldBackup.daily) === stamped, "old backup cannot clear a newer claim");

// Clock rolled back: last stamp is in the future relative to "now".
ok(!isFreeReady(String(now), now - 10_000), "clock rollback keeps the cooldown");

// Headless: many rapid claim attempts around one open.
resetFreeClaimForTests();
let opened = 0;
for (let i = 0; i < 20; i++) {
  if (armFreeClaim("", now + i)) {
    if (consumeFreeClaim()) opened++;
  }
}
ok(opened === 1, "20 rapid clicks open exactly one Free Pack, got " + opened);

// Draw a free chase and confirm it keeps home identity.
resetFreeClaimForTests();
const taken = new Set<string>();
let found: { packId: string; via?: string; playerId: string } | null = null;
for (let i = 0; i < 8000 && !found; i++) {
  const c = drawCard("free", taken);
  taken.delete(c.playerId); // don't exhaust, we just want a sample
  if (c.rarity === "super" && CHASE_IDS.has(c.playerId)) found = c;
}
if (found) {
  const card = { uid: "t", playerId: found.playerId, rarity: "super" as const, packId: "free" as const, seq: 1, via: found.via as never };
  const origin = originPack(card);
  ok(origin !== "free", "free-pulled chase origin is the home pack, got " + origin);
  ok(isChaseCard(card), "free-pulled chase counts as a chase card");
} else {
  console.log("note: no chase sampled in 8000 free draws (possible, share is small)");
}

if (failed) {
  console.error("FAILED", failed);
  process.exit(1);
}
console.log("ALL_FREE_CD_OK");
