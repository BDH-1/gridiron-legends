import { defaultSave, loadSave, writeSave, wipeAllProgress, forgetMemorySaves, SAVE_KEY, START_BAL, PLAYERS, saveScore, cookieRead, peekFreeAt, seasonLeftToday, SEASON_DAILY_LIMIT, FREE_AT_KEY, SEASON_DAY_KEY, persistFreeAt, persistSeasonStamp, encodeBackup } from "../src/game";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string): void { this.m.set(k, String(v)); }
  removeItem(k: string): void { this.m.delete(k); }
  clear(): void { this.m.clear(); }
  get length(): number { return this.m.size; }
  key(i: number): string | null { return Array.from(this.m.keys())[i] ?? null; }
}

function installBrowser(): { local: MemStorage; session: MemStorage; cookies: () => string } {
  const local = new MemStorage();
  const session = new MemStorage();
  const jar = new Map<string, string>();
  const doc = {
    get cookie(): string {
      return Array.from(jar.entries()).map(([k, v]) => k + "=" + v).join("; ");
    },
    set cookie(v: string) {
      const raw = String(v);
      const [pair, ...attrs] = raw.split(";").map((s) => s.trim());
      const eq = (pair ?? "").indexOf("=");
      const name = eq >= 0 ? (pair ?? "").slice(0, eq) : (pair ?? "");
      const val = eq >= 0 ? (pair ?? "").slice(eq + 1) : "";
      const joined = attrs.join(";").toLowerCase();
      if (joined.includes("max-age=0")) jar.delete(name);
      else jar.set(name, val);
    },
  };
  const win: Record<string, unknown> = {
    localStorage: local,
    sessionStorage: session,
    name: "",
  };
  (globalThis as { window?: unknown; document?: unknown }).window = win;
  (globalThis as { document?: unknown }).document = doc;
  // game uses window.localStorage and document.cookie and window.name
  Object.assign(globalThis, { window: win, document: doc });
  return { local, session, cookies: () => doc.cookie };
}

function richSave() {
  const p = PLAYERS[0]!;
  const s = defaultSave();
  s.collection = [{ uid: "c1", playerId: p.id, rarity: "gold", packId: "legends", seq: 1 }];
  s.balance = 9999;
  s.rebirth = 4;
  s.cardSeq = 12;
  s.openedCounts.legends = 5;
  s.pulls["legends|gold"] = 1;
  s.supers = [p.id];
  s.bestPull = { name: p.name, value: 21000, packId: "legends", date: "2026-11-18", rarity: "super", playerId: p.id };
  s.bestCollection = 50000;
  s.meta = { daily: String(Date.now()), dailyN: 3, sets: ["chase"], ach: ["first"], seasonDay: "2026-11-18", seasonN: 8 };
  return s;
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const { local, session } = installBrowser();
const seed = richSave();
assert(writeSave(seed, true), "seed write failed");
persistFreeAt(Date.now());
persistSeasonStamp("2026-11-18", 8, Date.now());
assert(loadSave().collection.length === 1, "seed did not load");
assert(loadSave().balance === 9999, "seed balance");
assert(loadSave().rebirth === 4, "seed rebirth");
assert(peekFreeAt() > 0, "free cooldown stamp missing");
assert(seasonLeftToday(loadSave().meta) < SEASON_DAILY_LIMIT, "season counter missing");
assert(!!local.getItem(SAVE_KEY), "local missing seed");
assert(!!session.getItem(SAVE_KEY), "session missing seed");
assert(!!local.getItem(FREE_AT_KEY), "local free stamp missing");
assert(!!local.getItem(SEASON_DAY_KEY), "local season stamp missing");
assert(!!cookieRead(), "cookie missing seed");
assert(String((globalThis as { window: { name: string } }).window.name).startsWith("GLN:"), "window.name missing seed");

const fresh = defaultSave();
fresh.soundOn = seed.soundOn;
wipeAllProgress(fresh).then((ok) => {
  assert(ok, "wipe did not write a durable empty save");
  const after = loadSave();
  assert(after.collection.length === 0, "cards remain after wipe");
  assert(after.balance === START_BAL, "coins not reset, got " + after.balance);
  assert(after.rebirth === 0, "rebirth not reset");
  assert(after.bestPull == null, "best pull remains");
  assert(after.bestCollection === 0, "best collection remains");
  assert(after.meta.ach.length === 0 && after.meta.dailyN === 0 && after.meta.sets.length === 0, "achievements/dailies remain");
  assert(after.meta.daily === "" && (after.meta.seasonN ?? 0) === 0, "cooldowns remain in save meta");
  assert(peekFreeAt() === 0, "free cooldown stamp remains, " + peekFreeAt());
  assert(seasonLeftToday(after.meta) === SEASON_DAILY_LIMIT, "season daily not cleared");
  assert(saveScore(after) === saveScore(defaultSave()) || after.collection.length === 0, "score not fresh");

  // Simulate a full reload: drop in-memory copies so only durable stores can win.
  forgetMemorySaves();
  const reloaded = loadSave();
  assert(reloaded.collection.length === 0, "reload restored cards");
  assert(reloaded.balance === START_BAL, "reload restored coins");
  assert(reloaded.rebirth === 0, "reload restored rebirth");
  assert(reloaded.bestPull == null && reloaded.bestCollection === 0, "reload restored records");
  assert(reloaded.meta.ach.length === 0 && reloaded.meta.dailyN === 0, "reload restored achievements");
  assert(peekFreeAt() === 0, "reload restored free cooldown");
  assert(seasonLeftToday(reloaded.meta) === SEASON_DAILY_LIMIT, "reload restored season counter");
  // A leftover rich cookie/name/local would win here. Prove none is richer than default.
  assert(saveScore(reloaded) <= saveScore(defaultSave()) + 1, "richest-save still has progress, score " + saveScore(reloaded));
  console.log("RESET_ALL_OK", "reload stayed fresh, coins", reloaded.balance);
});
