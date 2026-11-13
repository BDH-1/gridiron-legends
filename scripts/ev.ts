import { evOf, seasonOf, SEASON_ROSTER, SEASON_CHASE, SEASON_PRICE, packOf, PACKS, PIDS, VERSION } from "../src/game";

const money = (n: number) => Math.round(n * 10) / 10;
console.log("VERSION", VERSION);
console.log("season", seasonOf(), "price", SEASON_PRICE);
console.log("--- ev by pack ---");
for (const id of PIDS) {
  const pack = packOf(id);
  const ev = evOf(id);
  console.log(id, pack.name, "price", pack.price, "ev", money(ev), "ratio", Math.round((ev / pack.price) * 100) + "%");
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
