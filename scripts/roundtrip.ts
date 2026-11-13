import { encodeBackup, decodeBackup, loadSave, compactOf, defaultSave, PLAYERS } from "../src/game";

type PackId = "rookie" | "stars" | "legends" | "standard" | "potw" | "boom";
type RarityId = "base" | "silver" | "kings" | "walls" | "phenom" | "gold" | "potw" | "auto" | "super";
const RARS: RarityId[] = ["base", "silver", "kings", "walls", "phenom", "gold", "potw", "auto", "super"];
const PACKS: PackId[] = ["standard", "rookie", "stars", "legends", "potw", "boom"];

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function sameSave(a: ReturnType<typeof defaultSave>, b: ReturnType<typeof defaultSave>, label: string): void {
  assert(a.collection.length === b.collection.length, label + ": collection length " + a.collection.length + " vs " + b.collection.length);
  for (let i = 0; i < a.collection.length; i++) {
    const x = a.collection[i], y = b.collection[i];
    assert(x && y && x.uid === y.uid && x.playerId === y.playerId && x.rarity === y.rarity && x.packId === y.packId && x.seq === y.seq, label + ": card " + i + " mismatch " + JSON.stringify(x) + " vs " + JSON.stringify(y));
  }
  for (const id of PACKS) assert((a.openedCounts[id] ?? 0) === (b.openedCounts[id] ?? 0), label + ": openedCounts." + id);
  assert(a.soundOn === b.soundOn, label + ": soundOn");
  assert(a.cardSeq === b.cardSeq, label + ": cardSeq " + a.cardSeq + " vs " + b.cardSeq);
  assert(a.balance === b.balance, label + ": balance");
  assert(a.locked === b.locked, label + ": locked");
  const pk = new Set([...Object.keys(a.pulls), ...Object.keys(b.pulls)]);
  for (const k of pk) assert((a.pulls[k] ?? 0) === (b.pulls[k] ?? 0), label + ": pulls." + k);
  assert([...a.supers].sort().join("|") === [...b.supers].sort().join("|"), label + ": supers");
  assert(a.meta.daily === b.meta.daily && a.meta.dailyN === b.meta.dailyN, label + ": daily");
  assert([...a.meta.sets].join("|") === [...b.meta.sets].join("|"), label + ": sets");
  assert([...a.meta.ach].join("|") === [...b.meta.ach].join("|"), label + ": ach");
}

function buildBig(): ReturnType<typeof defaultSave> {
  const s = defaultSave();
  s.balance = 128_450;
  s.soundOn = false;
  s.locked = false;
  s.openedCounts = { standard: 412, rookie: 88, stars: 76, legends: 21, potw: 40, boom: 33 };
  s.meta = { daily: "2026-11-12", dailyN: 17, sets: ["rookie-ARI", "stars-DAL", "unicode-José–🏆"], ach: ["first-pack", "hundred-cards", "1/1-club"] };
  const pulls: Record<string, number> = {};
  let seq = 0;
  // Several cards per player, mixed rarities and packs, including unicode-ish names already in the roster.
  for (let i = 0; i < PLAYERS.length; i++) {
    const p = PLAYERS[i]!;
    const copies = i % 7 === 0 ? 3 : i % 5 === 0 ? 2 : 1;
    for (let n = 0; n < copies; n++) {
      seq += 1;
      const rarity = RARS[(i + n * 3) % RARS.length]!;
      const packId = n === 2 ? "boom" : n === 1 ? "standard" : (i % 5 === 0 ? "potw" : p.packId);
      s.collection.push({ uid: "c" + seq + "-abc" + i + "ñ", playerId: p.id, rarity, packId, seq });
      const k = packId + "|" + rarity;
      pulls[k] = (pulls[k] ?? 0) + 1;
      if (rarity === "super" && !s.supers.includes(p.id)) s.supers.push(p.id);
    }
  }
  s.cardSeq = seq + 4;
  s.pulls = pulls;
  return s;
}

function mutate(code: string, kind: string): string {
  const body = code.replace(/^GL2:/i, "");
  if (kind === "plain") return code;
  if (kind === "lower") return "gl2:" + body;
  if (kind === "mixed") return "Gl2:" + body;
  if (kind === "noprefix") return body;
  if (kind === "ws") return "  GL2:\n" + body.slice(0, 40) + " \n " + body.slice(40) + "  \t";
  if (kind === "zwc") return "\uFEFF\u200Bgl2:\u200C" + body + "\u200D";
  if (kind === "smart") return "\u201Cgl2:" + body + "\u201D";
  if (kind === "urlsafe") return "GL2:" + body.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  if (kind === "nopad") return "GL2:" + body.replace(/=+$/, "");
  if (kind === "urlsafe-nopad-lower-ws") {
    const u = body.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return "  gl2: " + u.slice(0, 20) + "\n" + u.slice(20) + " ";
  }
  throw new Error("unknown kind " + kind);
}

const kinds = ["plain", "lower", "mixed", "noprefix", "ws", "zwc", "smart", "urlsafe", "nopad", "urlsafe-nopad-lower-ws"] as const;

const original = buildBig();
console.log("players", PLAYERS.length, "cards", original.collection.length, "supers", original.supers.length);

const code = encodeBackup(original);
assert(code.startsWith("GL2:"), "exporter should prefix GL2:");
assert(code.slice(4, 12) === "eyJ2Ijoy", "compact v2 payload should start eyJ2Ijoy, got " + code.slice(0, 20));

const compact = compactOf(original);
assert(compact.v === 2 && Array.isArray(compact.c), "compact v2");
assert((compact.c as unknown[]).length === original.collection.length, "compact rows");

const decoded = decodeBackup(code);
assert(decoded && decoded.startsWith("{"), "decodeBackup should return JSON");
sameSave(original, loadSave(decoded!), "canonical encode→decode→loadSave");

// raw compact JSON (no prefix, no base64)
const rawCompact = JSON.stringify(compact);
{
  const d = decodeBackup(rawCompact);
  assert(d, "raw compact JSON should decode");
  sameSave(original, loadSave(d!), "raw compact JSON");
}

// raw full JSON
{
  const d = decodeBackup(JSON.stringify(original));
  assert(d, "raw full JSON should decode");
  sameSave(original, loadSave(d!), "raw full JSON");
}

for (const kind of kinds) {
  const variant = mutate(code, kind);
  const d = decodeBackup(variant);
  assert(d, "decode failed for " + kind + " sample=" + variant.slice(0, 40));
  sameSave(original, loadSave(d), kind);
  console.log("ok", kind, "len", variant.length);
}

// Rhett's exact failure mode: lowercase gl2: + compact v2 base64 starting {"v":2,"c":[["...
const rhettLike = "gl2:" + code.slice(4);
assert(rhettLike.startsWith("gl2:eyJ2IjoyLCJjIjpbWyJ"), "shape should match Rhett's pasted prefix+payload start, got " + rhettLike.slice(0, 30));
const rhettDecoded = decodeBackup(rhettLike);
assert(rhettDecoded, "Rhett-like lowercase gl2: code should decode");
sameSave(original, loadSave(rhettDecoded!), "rhett-like gl2:");
console.log("RHELT_EXACT_SHAPE_WOULD_RESTORE=yes");
console.log("ALL_TESTS_PASSED", original.collection.length, "cards");
