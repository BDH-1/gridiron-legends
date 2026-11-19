import { evOf, seasonOf, SEASON_ROSTER, SEASON_CHASE, SEASON_PRICE, packOf, PACKS, PIDS, VERSION, valueOf, PLAYERS, POTW_PLAYERS, FREE_TENTHS, RARITIES, setLiveRebirth, packUnlockAt, rebirthReq, RB_CHASE } from "../src/game";

const money = (n: number) => Math.round(n * 10) / 10;
const span = (vals: number[]): string => {
  if (vals.length === 0) return "none";
  const a = [...vals].sort((x, y) => x - y);
  const avg = a.reduce((s, n) => s + n, 0) / a.length;
  return "min " + money(a[0]) + " max " + money(a[a.length - 1]) + " avg " + money(avg) + " n " + a.length;
};

console.log("VERSION", VERSION);
console.log("season", seasonOf(), "price", SEASON_PRICE);
setLiveRebirth(6);
console.log("--- unlock at ---");
for (const id of PIDS) console.log(" ", id, packOf(id).name, "rebirth", packUnlockAt(id));
console.log("--- rebirth req ---");
for (let i = 0; i < 8; i++) console.log(" ", i, "->", i + 1, rebirthReq(i));
console.log("--- rebirth chases ---");
for (const p of RB_CHASE) console.log(" ", p.name);
console.log("--- ev by pack (rebirth 6, all packs unlocked) ---");
for (const id of PIDS) {
  const pack = packOf(id);
  const ev = evOf(id);
  const ratio = pack.price > 0 ? Math.round((ev / pack.price) * 100) + "%" : "free";
  console.log(id, pack.name, "price", pack.price, "ev", money(ev), "ratio", ratio);
}

console.log("--- Free Pack odds (tenths of a percent → percent) ---");
for (const r of RARITIES) {
  if (FREE_TENTHS[r.id] > 0) console.log(" ", r.name, (FREE_TENTHS[r.id] / 10) + "%");
}
console.log("free ev (average pull)", money(evOf("free")));

console.log("--- insert values (kings/walls/phenom) ---");
for (const r of ["kings", "walls", "phenom"] as const) {
  const vals = PLAYERS.map((p) => valueOf(p, r));
  console.log(r, "default pack", span(vals));
  for (const id of PIDS) {
    const vs = PLAYERS.map((p) => valueOf(p, r, id));
    console.log(" ", id, span(vs));
  }
}

console.log("--- POTW values ---");
const swift = POTW_PLAYERS.find((p) => p.name === "D'Andre Swift") ?? PLAYERS.find((p) => p.name === "D'Andre Swift");
for (const id of PIDS) {
  const vs = POTW_PLAYERS.map((p) => valueOf(p, "potw", id));
  console.log("potw via", id, span(vs));
  if (swift) console.log("  Swift via", id, valueOf(swift, "potw", id));
}

const seen = new Set<string>();
const dups: string[] = [];
for (const id of Object.keys(SEASON_ROSTER) as (keyof typeof SEASON_ROSTER)[]) {
  const r = SEASON_ROSTER[id];
  const ch = SEASON_CHASE[id].map((p) => p.name);
  console.log("SEASON", id, "chase:", ch.join(", "), "pool", r.chase.length + r.pool.length);
  if (ch.length !== 3) throw new Error(id + " chase count " + ch.length);
  for (const n of r.chase.concat(r.pool)) {
    if (r.chase.includes(n) && r.pool.includes(n)) throw new Error(id + " chase also in pool: " + n);
  }
  for (const n of r.chase) {
    if (seen.has(n)) dups.push(id + ":" + n);
    seen.add(n);
  }
}
if (dups.length) throw new Error("duplicate chase across seasons: " + dups.join(", "));
if (seen.size !== 15) throw new Error("expected 15 unique chase names, got " + seen.size);
console.log("UNIQUE_CHASE_OK", seen.size);

console.log("--- gold values (Rising Stars / Stars should be 70-79) ---");
for (const id of ["rookie", "stars", "legends", "season", "standard"] as const) {
  const pool = PLAYERS.filter((p) => id === "standard" || id === "season" || p.packId === id || (id === "season" && p.season));
  const vs = pool.map((p) => valueOf(p, "gold", id));
  console.log("gold via", id, span(vs));
}

console.log("--- season tenths ---");
let sum = 0;
for (const r of RARITIES) {
  const n = r.tenths.season;
  sum += n;
  if (n) console.log(" ", r.id, (n / 10) + "%");
}
console.log("season tenths sum", sum, "base", RARITIES.find((r) => r.id === "base")?.tenths.season);
