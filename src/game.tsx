import { BackToTop, Button, Floating, Callout, Divider, Metrics, Page, Pie, Section, Select, Table, Text, Toggle, Input, useCallback, useEffect, useMemo, useRef, useState, useGrokTheme } from "grok/canvas";
import type { CSSProperties, ReactNode } from "grok/canvas";

type HomeId = "rookie" | "stars" | "legends";
type SeasonId = "superbowl" | "rookies" | "halloween" | "thanksgiving" | "christmas";
type PackId = HomeId | "standard" | "potw" | "boom" | "season";
type RarityId = "base" | "silver" | "kings" | "walls" | "phenom" | "gold" | "potw" | "auto" | "super";
type Stage = "idle" | "tearing" | "reveal" | "multi";
interface Rarity { id: RarityId; name: string; short: string; tenths: Record<PackId, number>; rank: number; frame: string; ink: string; glow: string; bg: string }
interface Team { abbr: string; name: string; primary: string; secondary: string }
interface Player { id: string; name: string; team: Team; pos: string; num: number; tier: number; packId: HomeId | "season"; season?: SeasonId }
interface Card { uid: string; playerId: string; rarity: RarityId; packId: PackId; seq: number }
interface RCard extends Card { flipped: boolean }
interface Pack { id: PackId; name: string; hint: string; blurb: string; bg: string; trim: string; thumb: string; price: number }
interface Meta { daily: string; dailyN: number; sets: string[]; ach: string[] }
interface Save { v: 2; collection: Card[]; openedCounts: Record<PackId, number>; soundOn: boolean; cardSeq: number; readyPack: { packId: PackId } | null; balance: number; pulls: Record<string, number>; supers: string[]; locked: boolean; meta: Meta }

const SET = "Gridiron Legends";
const VERSION = "3.6"; // bump by 0.1 with each change
const YEAR = "2026";
const HOME: HomeId[] = ["rookie", "stars", "legends"];
const SEASON_IDS: SeasonId[] = ["superbowl", "rookies", "halloween", "thanksgiving", "christmas"];
const seasonOf = (d: Date = new Date()): SeasonId => {
  const m = d.getMonth();
  if (m >= 1 && m <= 7) return "superbowl";
  if (m === 8) return "rookies";
  if (m === 9) return "halloween";
  if (m === 10) return "thanksgiving";
  return "christmas";
};
const nextSeasonChange = (d: Date = new Date()): { id: SeasonId; at: Date } => {
  const y = d.getFullYear(), m = d.getMonth(), cur = seasonOf(d);
  if (cur === "superbowl") return { id: "rookies", at: new Date(y, 8, 1) };
  if (cur === "rookies") return { id: "halloween", at: new Date(y, 9, 1) };
  if (cur === "halloween") return { id: "thanksgiving", at: new Date(y, 10, 1) };
  if (cur === "thanksgiving") return { id: "christmas", at: new Date(y, 11, 1) };
  return { id: "superbowl", at: new Date(m === 0 ? y : y + 1, 1, 1) };
};
const formatLongDate = (d: Date): string => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
interface SeasonTheme { id: SeasonId; name: string; range: string; hint: string; blurb: string; bg: string; trim: string; skin: { a: string; b: string; ink: string; edge: string } }
const SEASON_THEME: Record<SeasonId, SeasonTheme> = {
  superbowl: { id: "superbowl", name: "Super Bowl", range: "February–August", hint: "Super Bowl", blurb: "Stars from recent Super Bowls: the players who shone on the biggest stage, from this year's champions back through recent February Sundays.", bg: "linear-gradient(165deg, #0b1a33 0%, #c9a227 42%, #f5e2a3 58%, #7a5b12 100%)", trim: "#fff3c0", skin: { a: "#d4b14a", b: "#14244a", ink: "#ffffff", edge: "#fff0b0" } },
  rookies: { id: "rookies", name: "Rookies", range: "September", hint: "Rookies", blurb: "A fresh-class Season pack: standout current and recent rookies, with three exclusive chase 1/1s that rotate in only during September.", bg: "linear-gradient(165deg, #05261a 0%, #1aa35a 45%, #0a4a2c 100%)", trim: "#c8ffd9", skin: { a: "#1dbf6a", b: "#06351f", ink: "#ffffff", edge: "#b9ffd4" } },
  halloween: { id: "halloween", name: "Halloween", range: "October", hint: "Halloween", blurb: "A spooky-fun Season pack: Scary Terry, pass-rush monsters and other Halloween-fitting names, in orange and black.", bg: "linear-gradient(165deg, #14080e 0%, #ef7a16 42%, #5b1480 100%)", trim: "#ffc07a", skin: { a: "#ff7a18", b: "#1a0a16", ink: "#ffffff", edge: "#ffc07a" } },
  thanksgiving: { id: "thanksgiving", name: "Thanksgiving", range: "November", hint: "Thanksgiving", blurb: "Built around the classic Thanksgiving games: Cowboys and Lions stars, plus the supporting casts who show up every late November.", bg: "linear-gradient(165deg, #2a1408 0%, #c45c12 40%, #7a2e0a 100%)", trim: "#ffd7a0", skin: { a: "#e07020", b: "#3a1608", ink: "#ffffff", edge: "#ffd7a0" } },
  christmas: { id: "christmas", name: "Christmas", range: "December–January", hint: "Christmas", blurb: "A holiday Season pack: stars of Christmas Day and weekend games, with a nod to St. Nick, in green, red and gold.", bg: "linear-gradient(165deg, #0a2a18 0%, #1f8a4a 38%, #b81c2c 72%, #7a1218 100%)", trim: "#ffe08a", skin: { a: "#1e9a4e", b: "#7a1020", ink: "#ffffff", edge: "#ffe08a" } },
};
const SEASON_PRICE = 80;
const makeSeasonPack = (d: Date = new Date()): Pack => {
  const t = SEASON_THEME[seasonOf(d)];
  return { id: "season", name: "Season Pack", hint: t.hint, blurb: t.blurb, bg: t.bg, trim: t.trim, thumb: "S", price: SEASON_PRICE };
};

const PIDS: PackId[] = ["standard", "rookie", "stars", "legends", "season", "potw", "boom"];
const RAINBOW = "linear-gradient(120deg, #ff4d6d, #ffb000, #3dff8a, #3dc6ff, #c44dff, #ff4d6d)";

// Boom or Bust pack odds in tenths of a percent: Base is the bust, Auto and 1/1 are the booms, plus the usual 0.4 percent POTW. Nothing else drops.
const BOOM_TENTHS: Partial<Record<RarityId, number>> = { base: 800, auto: 130, potw: 4, super: 66 };
// Boom or Bust value floors: the cheapest Auto, 1/1 and POTW in this pack.
const BOOM_FLOOR = { potw: 100, auto: 300, super: 540 };
const RARITIES: Rarity[] = ([
  ["base", "Base", "Base", 526, 534, 230, 684, 0, "#c8c2b4", "#2a2a28", "transparent", "linear-gradient(180deg, #fbf8f1, #e7e1d4)"],
  ["silver", "Silver Parallel", "Silver", 240, 240, 300, 150, 700, "#b8c0c8", "#1c242c", "rgba(192,206,220,0.85)", "linear-gradient(180deg, #f4f7fb, #d5dce6)"],
  ["kings", "Gridiron Kings", "Kings", 6, 6, 8, 4, 0, "#9a63ff", "#f3e9ff", "rgba(160,110,255,0.95)", "linear-gradient(180deg, #f1e6ff, #cdb0ff)"],
  ["walls", "Defensive Walls", "Walls", 6, 6, 8, 4, 0, "#27b6d6", "#06222b", "rgba(40,190,225,0.9)", "linear-gradient(180deg, #e2f9ff, #a9e4f2)"],
  ["phenom", "Rookie Phenoms", "Phenom", 8, 0, 0, 4, 0, "#ff7a2f", "#2e1204", "rgba(255,130,50,0.95)", "linear-gradient(180deg, #fff0e2, #ffc79f)"],
  ["gold", "Gold", "Gold", 140, 140, 250, 135, 0, "#e0b23a", "#3a2a08", "rgba(240,196,64,0.95)", "linear-gradient(180deg, #fff6d0, #f0d37a)"],
  ["potw", "Player of the Week", "POTW", 4, 4, 4, 4, 300, "#1fd37a", "#04281a", "rgba(40,235,130,0.95)", "linear-gradient(180deg, #eafff3, #b6f2d0)"],
  ["auto", "Autograph", "Auto", 55, 55, 150, 14, 0, "#6ee0c4", "#083028", "rgba(80,230,190,0.95)", "linear-gradient(180deg, #f3fff9, #d9f3ea)"],
  ["super", "1/1 Superfractal", "1/1", 15, 15, 50, 1, 0, "#d46cff", "#fbeaff", "rgba(210,120,255,1)", "linear-gradient(135deg, #3b0a4a 0%, #1a1040 35%, #0d2a3a 70%, #3a0a2a 100%)"],
] as [RarityId, string, string, number, number, number, number, number, string, string, string, string][]).map(([id, name, short, r, s, l, t, w, frame, ink, glow, bg], i) => ({ id, name, short, tenths: { rookie: r, stars: s, legends: l, standard: t, potw: w, boom: BOOM_TENTHS[id] ?? 0, season: s }, rank: i + 1, frame, ink, glow, bg }));
const RB = Object.fromEntries(RARITIES.map((r) => [r.id, r])) as Record<RarityId, Rarity>;

const PACKS: Pack[] = [
  { id: "standard", name: "Standard Pack", hint: "All players", blurb: "Players from across the whole set at regular odds. No chase cards.", bg: "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, rgba(0,0,0,0.05) 1px 3px), linear-gradient(165deg, #1e2429 0%, #8e98a3 45%, #39414a 100%)", trim: "#e6ebf0", thumb: "1", price: 10 },
  { id: "rookie", name: "Rising Stars Pack", hint: "80+", blurb: "Current young players and recent standouts from across the league.", bg: "linear-gradient(165deg, #061a40 0%, #2f7bff 45%, #0a2c78 100%)", trim: "#cfe2ff", thumb: "9", price: 75 },
  { id: "stars", name: "Stars Pack", hint: "80+", blurb: "Today's established star players from across the league.", bg: "linear-gradient(165deg, #3a0612 0%, #e0314f 45%, #5a0a1f 100%)", trim: "#ffd0d8", thumb: "15", price: 75 },
  { id: "legends", name: "Legends Pack", hint: "88+", blurb: "Retired all-time greats, three from each team, with the best odds in the set.", bg: "linear-gradient(165deg, #4a3408 0%, #f0c44a 40%, #8a5a10 100%)", trim: "#fff3c0", thumb: "88", price: 300 },
  makeSeasonPack(),
  { id: "potw", name: "Player of the Week Pack", hint: "30% POTW", blurb: "Green Player of the Week cards: 30% POTW, 70% Silver parallels from the whole set.", bg: "repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 10px, rgba(0,0,0,0.05) 10px 20px), linear-gradient(165deg, #04301c 0%, #1fd37a 45%, #0a6b3c 100%)", trim: "#d6ffe9", thumb: "W", price: 45 },
  { id: "boom", name: "Boom or Bust Pack", hint: "Boom/Bust", blurb: "All-or-nothing, from every player in the set: four in five pulls are a Bust worth a few coins, but one in five is a Boom: an Autograph (typically 350+) or 1/1 (typically 650+). The average pull sits just below the price.", bg: "linear-gradient(115deg, #0c0c10 0%, #0c0c10 47%, #e0141e 47%, #8f0a12 100%)", trim: "#ffb3a0", thumb: "B", price: 100 },
];
const PB = Object.fromEntries(PACKS.map((p) => [p.id, p])) as Record<PackId, Pack>;
const packOf = (id: PackId): Pack => (id === "season" ? makeSeasonPack() : PB[id]);

const TEAMS: Team[] = "ARI,Arizona Cardinals,97233F,FFB612;ATL,Atlanta Falcons,A71930,101820;BAL,Baltimore Ravens,241773,9E7C0C;BUF,Buffalo Bills,00338D,C60C30;CAR,Carolina Panthers,0085CA,101820;CHI,Chicago Bears,0B162A,C83803;CIN,Cincinnati Bengals,FB4F14,101820;CLE,Cleveland Browns,311D00,FF3C00;DAL,Dallas Cowboys,041E42,869397;DEN,Denver Broncos,FB4F14,002244;DET,Detroit Lions,0076B6,B0B7BC;GB,Green Bay Packers,203731,FFB612;HOU,Houston Texans,03202F,A71930;IND,Indianapolis Colts,002C5F,A2AAAD;JAX,Jacksonville Jaguars,006778,D7A22A;KC,Kansas City Chiefs,E31837,FFB612;LV,Las Vegas Raiders,101820,A5ACAF;LAC,Los Angeles Chargers,0080C6,FFC20E;LAR,Los Angeles Rams,003594,FFA300;MIA,Miami Dolphins,008E97,FC4C02;MIN,Minnesota Vikings,4F2683,FFC62F;NE,New England Patriots,002244,C60C30;NO,New Orleans Saints,101820,D3BC8D;NYG,New York Giants,0B2265,A71930;NYJ,New York Jets,125740,101820;PHI,Philadelphia Eagles,004C54,A5ACAF;PIT,Pittsburgh Steelers,101820,FFB612;SF,San Francisco 49ers,AA0000,B3995D;SEA,Seattle Seahawks,002244,69BE28;TB,Tampa Bay Buccaneers,D50A0A,0A0A08;TEN,Tennessee Titans,0C2340,4B92DB;WAS,Washington Commanders,5A1414,FFB612".split(";").map((row) => {
  const [abbr = "", name = "", a = "", b = ""] = row.split(",");
  return { abbr, name, primary: "#" + a, secondary: "#" + b };
});

// Three players per team per pack. The first 64 entries are two per team in team order (original IDs); the last 32 are one more per team, appended. Name,POS,jersey,tier
const ROSTER: Record<HomeId, string> = {
  rookie: "Marvin Harrison Jr.,WR,18,4,ARI,HOU;Trey Benson,RB,33,3;Michael Penix Jr.,QB,9,3;Jalon Walker,LB,11,3;Zay Flowers,WR,4,4;Nate Wiggins,CB,2,3;Dalton Kincaid,TE,86,3;Keon Coleman,WR,15,3;Bryce Young,QB,9,3;Tetairoa McMillan,WR,4,4;Caleb Williams,QB,18,4;Rome Odunze,WR,15,4;Chase Brown,RB,30,3;Amarius Mims,OT,71,2;Mason Graham,DT,94,3;Quinshon Judkins,RB,10,3;Tyler Guyton,OT,60,3;James Pearce Jr.,DE,27,3,DAL,ATL,Marshawn Kneeland;Troy Franklin,WR,11,3;Jonah Elliss,LB,52,3;Terrion Arnold,CB,17,3,DET,SEA;Ennis Rakestraw Jr.,CB,7,2;Jayden Reed,WR,11,3;Edgerrin Cooper,LB,56,3;Kamari Lassiter,CB,4,3;Calen Bullock,S,2,3;Adonai Mitchell,WR,15,3,IND,NYJ;Laiatu Latu,DE,97,3;Brian Thomas Jr.,WR,7,4;Travis Hunter,WR,12,4;Xavier Worthy,WR,1,3;Rashee Rice,WR,4,3;Ashton Jeanty,RB,2,4;Jack Bech,WR,18,3;Ladd McConkey,WR,15,4;Omarion Hampton,RB,8,4;Jared Verse,DE,8,4,LAR,CLE;Blake Corum,RB,22,3;Chop Robinson,LB,44,3;Jaylen Wright,RB,25,3;J.J. McCarthy,QB,18,3,MIN,NYG;Jordan Addison,WR,3,3;Drake Maye,QB,10,4;Will Campbell,OT,77,3;Spencer Rattler,QB,18,2;Kool-Aid McKinstry,CB,14,3;Jaxson Dart,QB,6,3;Tyrone Tracy Jr.,RB,29,3;Braelon Allen,RB,8,3;Olu Fashanu,OT,74,3;Cooper DeJean,CB,33,3;Quinyon Mitchell,CB,27,4;Payton Wilson,LB,41,3;Kaleb Johnson,RB,26,3,PIT,GB;Ricky Pearsall,WR,14,3;Isaac Guerendo,RB,31,3;Byron Murphy II,DT,91,3;AJ Barner,TE,88,2;Bucky Irving,RB,7,4;Emeka Egbuka,WR,2,3;Cam Ward,QB,1,4;Tyjae Spears,RB,2,3;Jer'Zhan Newton,DT,95,3;Ben Sinnott,TE,82,2;Michael Wilson,WR,14,3;Kyle Pitts,TE,8,4;Isaiah Likely,TE,9,3,BAL,NYG;Ray Davis,RB,22,3;Xavier Legette,WR,17,3;Gervon Dexter,DT,95,3,CHI,ATL;Andrei Iosivas,WR,80,2;Shedeur Sanders,QB,12,3;Luke Schoonmaker,TE,86,2;Marvin Mims Jr.,WR,19,3;Sam LaPorta,TE,87,4;Luke Musgrave,TE,88,3;Tank Dell,WR,3,3;Anthony Richardson,QB,5,3;Tank Bigsby,RB,8,3,JAX,PHI;Leo Chenal,LB,54,3,KC,WAS;Michael Mayer,TE,87,3;Joe Alt,OT,76,4;Kyren Williams,RB,23,4;Jaylen Waddle,WR,17,4,MIA,DEN;Jalen Nailor,WR,9,3,MIN,LV;TreVeyon Henderson,RB,32,3;Taliese Fuaga,OT,71,3;Abdul Carter,LB,51,4;Breece Hall,RB,20,4;Jalen Carter,DT,98,4;Broderick Jones,OT,77,3,PIT,DAL;Brock Purdy,QB,13,4;Kenneth Walker III,RB,9,4,SEA,KC;Rachaad White,RB,1,3,TB,WAS;Will Levis,QB,4,3,TEN,NYJ;Brian Robinson Jr.,RB,15,3,WAS,ATL;Colston Loveland,TE,84,3,CHI;Luther Burden III,WR,10,3,CHI;Tyler Warren,TE,44,3,IND;Matthew Golden,WR,2,3,GB;Armand Membou,OT,74,3,NYJ;Mason Taylor,TE,85,3,NYJ;Mykel Williams,DE,95,3,SF;Kelvin Banks Jr.,OT,72,3,NO;Tyler Shough,QB,9,3,NO;Dillon Gabriel,QB,2,3,CLE;Jalen Milroe,QB,2,2,SEA;Cam Skattebo,RB,44,3,NYG;RJ Harvey,RB,12,3,DEN;Jayden Higgins,WR,9,3,HOU;Tre Harris,WR,11,3,LAC;Harold Fannin Jr.,TE,0,3,CLE;Carson Schwesinger,LB,3,3,CLE;Malaki Starks,S,3,3,BAL;Jahdae Barron,CB,7,3,DEN;Will Johnson,CB,2,3,ARI;Walter Nolen,DT,90,3,ARI;Shemar Stewart,DE,98,3,CIN;Nick Emmanwori,S,3,3,SEA;Luke McCaffrey,WR,12,3,WAS;Mike Sainristil,CB,0,3,WAS;Dallas Turner,LB,15,3,MIN;Troy Fautanu,OT,76,3,PIT;JC Latham,OT,76,3,TEN;Theo Johnson,TE,83,2,NYG;Cole Bishop,S,24,3,BUF;Tyler Nubin,S,27,3,MIN,NYG;Jalen McMillan,WR,11,3,NE,TB,Ja'Lynn Polk;Brenton Strange,TE,85,3,JAX;Jack Campbell,LB,46,3,DET;Josh Downs,WR,2,3,IND,KC;Christian Watson,WR,9,3,GB;Brian Branch,S,32,3,DET;Jaylen Warren,RB,30,3,PIT;Zach Charbonnet,RB,26,3,SEA;Dontayvion Wicks,WR,13,3,GB,PHI",
  stars: "Kyler Murray,QB,1,4,ARI,MIN;Trey McBride,TE,85,4;Bijan Robinson,RB,7,5;Drake London,WR,5,4;Lamar Jackson,QB,8,5;Derrick Henry,RB,22,4;Josh Allen,QB,17,5;James Cook,RB,4,4;Derrick Brown,DT,95,3;Chuba Hubbard,RB,30,3;DJ Moore,WR,2,4,CHI,BUF;Montez Sweat,DE,98,4;Joe Burrow,QB,9,5;Ja'Marr Chase,WR,1,5;Myles Garrett,DE,95,5,CLE,LAR;Denzel Ward,CB,21,4;Dak Prescott,QB,4,4;CeeDee Lamb,WR,88,5;Bo Nix,QB,10,4;Patrick Surtain II,CB,2,5;Jahmyr Gibbs,RB,26,5;Amon-Ra St. Brown,WR,14,5;Jordan Love,QB,10,4;Micah Parsons,DE,1,5;C.J. Stroud,QB,7,4;Nico Collins,WR,12,4;Jonathan Taylor,RB,28,4;DeForest Buckner,DT,99,4,IND,SF;Trevor Lawrence,QB,16,3;Josh Hines-Allen,DE,41,4;Patrick Mahomes,QB,15,5;Travis Kelce,TE,87,5;Maxx Crosby,DE,98,5;Brock Bowers,TE,89,5;Justin Herbert,QB,10,5;Derwin James,S,3,4;Matthew Stafford,QB,9,4;Puka Nacua,WR,12,5;Jameson Williams,WR,1,4,MIA,DET,Tyreek Hill;De'Von Achane,RB,28,4;Justin Jefferson,WR,18,5;Aaron Jones,RB,33,3;Stefon Diggs,WR,3,3,NE,WAS;Christian Gonzalez,CB,6,4;Alvin Kamara,RB,41,4;Chris Olave,WR,12,4;Malik Nabers,WR,1,5;Dexter Lawrence,DT,97,4,NYG,CIN;Garrett Wilson,WR,5,4;Sauce Gardner,CB,1,5,NYJ,IND;Jalen Hurts,QB,1,5;Saquon Barkley,RB,26,5;T.J. Watt,LB,90,5;DK Metcalf,WR,4,4;Christian McCaffrey,RB,23,5;Nick Bosa,DE,97,5;Jaxon Smith-Njigba,WR,11,4;Devon Witherspoon,CB,21,4;Baker Mayfield,QB,6,4;Mike Evans,WR,5,4,TB,SF;Jeffery Simmons,DT,99,4,TEN,CHI;Calvin Ridley,WR,0,3;Jayden Daniels,QB,5,5;Terry McLaurin,WR,17,4;Budda Baker,S,3,4;A.J. Terrell,CB,24,4;Roquan Smith,LB,0,4;Khalil Shakir,WR,10,4;Jaycee Horn,CB,8,4;Tremaine Edmunds,LB,49,3,CHI,NYG;Trey Hendrickson,DE,91,4,CIN,BAL;Jerry Jeudy,WR,3,3;Trevon Diggs,CB,16,4,DAL,SEA;Courtland Sutton,WR,14,4;Aidan Hutchinson,DE,97,5;Josh Jacobs,RB,8,4;Will Anderson Jr.,DE,51,5;Michael Pittman Jr.,WR,11,4,IND,PIT;Travon Walker,DE,44,4;Chris Jones,DT,95,5;Jakobi Meyers,WR,3,3,LV,JAX;Rashawn Slater,OT,70,4;Davante Adams,WR,17,4;Zach Sieler,DT,92,3;Harrison Smith,S,22,4;Hunter Henry,TE,85,3;Demario Davis,LB,56,3,NO,NYJ;Brian Burns,DE,0,4;Quinnen Williams,DT,92,4,NYJ,DAL;A.J. Brown,WR,1,5,PHI,NE;Cameron Heyward,DT,97,4;George Kittle,TE,85,5;Sam Darnold,QB,14,4;Antoine Winfield Jr.,S,31,4;Tony Pollard,RB,20,3;Zaire Franklin,LB,44,3,WAS,GB,Bobby Wagner;Aaron Rodgers,QB,8,4,PIT;Tua Tagovailoa,QB,1,4,MIA,ATL;Jared Goff,QB,16,4,DET;Kirk Cousins,QB,8,3,ATL,MIN;Geno Smith,QB,7,3,LV,NYJ;Jameis Winston,QB,19,3,NYG,NYG,Russell Wilson;Daniel Jones,QB,17,3,IND;Justin Fields,QB,6,3,NYJ,KC;Cooper Kupp,WR,10,4,SEA;Brandon Aiyuk,WR,11,4,SF;George Pickens,WR,3,4,DAL;Chris Godwin,WR,14,4,TB;Tee Higgins,WR,5,4,CIN;DeVonta Smith,WR,6,4,PHI;Deebo Samuel,WR,19,3,WAS,SF;Jauan Jennings,WR,14,3,BAL,MIN,DeAndre Hopkins;Mark Andrews,TE,89,4,BAL;T.J. Hockenson,TE,87,4,MIN;Jake Ferguson,TE,87,3,DAL;David Njoku,TE,83,3,CLE,LAC;David Montgomery,RB,32,4,DET,HOU;Javonte Williams,RB,33,3,HOU,DAL,Joe Mixon;James Conner,RB,6,4,ARI;Isiah Pacheco,RB,10,3,KC,DET;Travis Etienne Jr.,RB,3,3,JAX,NO;D'Andre Swift,RB,4,3,CHI;Penei Sewell,OT,58,4,DET;Lane Johnson,OT,65,4,PHI;Tristan Wirfs,OT,78,4,TB;Trent Williams,OT,71,4,SF;Tyler Smith,OT,73,4,DAL,DAL,Zack Martin;Danielle Hunter,DE,55,4,HOU;Fred Warner,LB,54,5,SF;Kyle Hamilton,S,14,4,BAL;Minkah Fitzpatrick,S,29,4,MIA,NYJ;Jalen Ramsey,CB,5,4,PIT;Marlon Humphrey,CB,44,4,BAL;Trent McDuffie,CB,22,4,KC,LAR;Kayvon Thibodeaux,DE,5,4,NYG;Rashan Gary,DE,7,4,GB,DAL;Foyesade Oluokun,LB,23,3,TB,JAX,Lavonte David;Patrick Queen,LB,6,3,PIT;Vita Vea,DT,50,4,TB;Leonard Williams,DT,99,3,SEA;Xavier McKinney,S,29,3,GB;Jonathan Greenard,DE,52,4,MIN,PHI;Nik Bonitto,DE,15,3,NYJ,DEN,Haason Reddick;Pat Freiermuth,TE,88,3,PIT;Evan Engram,TE,17,3,DEN;Jordan Mailata,OT,68,4,PHI",
  legends: "Larry Fitzgerald,WR,11,5;Kurt Warner,QB,13,5;Julio Jones,WR,11,5;Michael Vick,QB,7,4;Ray Lewis,LB,52,5;Ed Reed,S,20,5;Jim Kelly,QB,12,5;Thurman Thomas,RB,34,5;Cam Newton,QB,1,5;Luke Kuechly,LB,59,5;Walter Payton,RB,34,5;Dick Butkus,LB,51,5;Anthony Muñoz,OT,78,5;Chad Johnson,WR,85,4;Jim Brown,RB,32,5;Joe Thomas,OT,73,5;Troy Aikman,QB,8,5;Emmitt Smith,RB,22,5;John Elway,QB,7,5;Terrell Davis,RB,30,5;Barry Sanders,RB,20,5;Calvin Johnson,WR,81,5;Brett Favre,QB,4,5;Reggie White,DE,92,5;Andre Johnson,WR,80,5;J.J. Watt,DE,99,5;Peyton Manning,QB,18,5;Marvin Harrison,WR,88,5;Maurice Jones-Drew,RB,32,4;Tony Boselli,OT,71,5;Tony Gonzalez,TE,88,5;Derrick Thomas,LB,58,5;Tim Brown,WR,81,5;Marcus Allen,RB,32,5;LaDainian Tomlinson,RB,21,5;Antonio Gates,TE,85,5;Eric Dickerson,RB,29,5;Aaron Donald,DT,99,5;Dan Marino,QB,13,5;Larry Csonka,RB,39,5;Randy Moss,WR,84,5;Cris Carter,WR,80,5;Tom Brady,QB,12,5;Rob Gronkowski,TE,87,5;Drew Brees,QB,9,5;Rickey Jackson,LB,57,5;Lawrence Taylor,LB,56,5;Eli Manning,QB,10,5;Joe Namath,QB,12,5;Curtis Martin,RB,28,5;Brian Dawkins,S,20,5;Donovan McNabb,QB,5,4;Joe Greene,DT,75,5;Troy Polamalu,S,43,5;Jerry Rice,WR,80,5;Joe Montana,QB,16,5;Steve Largent,WR,80,5;Marshawn Lynch,RB,24,5;Warren Sapp,DT,99,5;Derrick Brooks,LB,55,5;Eddie George,RB,27,5;Steve McNair,QB,9,5;Darrell Green,CB,28,5;John Riggins,RB,44,5;Aeneas Williams,CB,35,5;Deion Sanders,CB,21,5;Jonathan Ogden,OT,75,5;Bruce Smith,DE,78,5;Julius Peppers,DE,90,5;Brian Urlacher,LB,54,5;Boomer Esiason,QB,7,4;Ozzie Newsome,TE,82,5;Michael Irvin,WR,88,5;Shannon Sharpe,TE,84,5;Ndamukong Suh,DT,90,4;Charles Woodson,CB,21,5;Arian Foster,RB,23,4;Edgerrin James,RB,32,5;Fred Taylor,RB,28,4;Len Dawson,QB,16,5;Ken Stabler,QB,12,5;Dan Fouts,QB,14,5;Marshall Faulk,RB,28,5;Zach Thomas,LB,54,4;Adrian Peterson,RB,28,5;Ty Law,CB,24,5;Reggie Bush,RB,25,4;Michael Strahan,DE,92,5;Darrelle Revis,CB,24,5;Randall Cunningham,QB,12,4;Jerome Bettis,RB,36,5;Steve Young,QB,8,5;Walter Jones,OT,71,5;Ronde Barber,CB,20,4;Earl Campbell,RB,34,5;Art Monk,WR,81,5",
};

const PLAYERS: Player[] = ([] as Player[]).concat(...HOME.map((packId) => ROSTER[packId].split(";").map((row, i) => {
  const [name = "", pos = "", num = "0", tier = "3", ab = "", cur = "", idn = ""] = row.split(",");
  const home = ((ab ? TEAMS.find((t) => t.abbr === ab) : TEAMS[i < 64 ? Math.floor(i / 2) : i - 64]) ?? TEAMS[0]) as Team; // team the ID was first minted with
  const team = ((cur ? TEAMS.find((t) => t.abbr === cur) : home) ?? home) as Team; // current team; idn keeps an old ID when a row is swapped
  return { id: home.abbr + "-" + (idn || name), name, team, pos, num: Number(num), tier: Number(tier), packId };
})));
const PBYID: Record<string, Player> = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));
// Seasonal pack: a themed roster for each window of the year. Players are cloned from the main set with unique ids so a Super Bowl Mahomes 1/1 is not the same card as the Stars chase Mahomes. All seasons stay in PBYID so pulled cards still load after the season ends.
const SEASON_ROSTER: Record<SeasonId, { chase: string[]; pool: string[] }> = {
  superbowl: { chase: ["Jalen Hurts", "Saquon Barkley", "Patrick Mahomes"], pool: ["Christian McCaffrey", "Brock Purdy", "Travis Kelce", "A.J. Brown", "DeVonta Smith", "Jalen Carter", "Fred Warner", "George Kittle", "Puka Nacua", "Matthew Stafford", "Ja'Marr Chase", "Joe Burrow", "Isiah Pacheco", "Chris Jones", "Trent Williams", "Cooper DeJean", "Xavier McKinney", "Deebo Samuel"] },
  rookies: { chase: ["Cam Ward", "Ashton Jeanty", "Travis Hunter"], pool: ["Tetairoa McMillan", "Abdul Carter", "Omarion Hampton", "Tyler Warren", "Colston Loveland", "Jaxson Dart", "Shedeur Sanders", "Mason Graham", "Luther Burden III", "Emeka Egbuka", "Matthew Golden", "Will Johnson", "Walter Nolen", "Drake Maye", "Caleb Williams", "Jayden Daniels", "Malik Nabers"] },
  halloween: { chase: ["Terry McLaurin", "Myles Garrett", "Maxx Crosby"], pool: ["T.J. Watt", "Dexter Lawrence", "Sauce Gardner", "Roquan Smith", "Derrick Henry", "DK Metcalf", "Patrick Surtain II", "Brock Bowers", "Stefon Diggs", "Baker Mayfield", "Justin Herbert", "Jordan Addison"] },
  thanksgiving: { chase: ["CeeDee Lamb", "Amon-Ra St. Brown", "Micah Parsons"], pool: ["Dak Prescott", "Jared Goff", "Jahmyr Gibbs", "David Montgomery", "Sam LaPorta", "Penei Sewell", "Brian Branch", "Jake Ferguson", "Trevon Diggs", "Tyler Smith", "Jack Campbell", "Jameson Williams", "Javonte Williams", "Tony Pollard", "Aidan Hutchinson"] },
  christmas: { chase: ["Justin Jefferson", "Lamar Jackson", "Nick Bosa"], pool: ["Chris Godwin", "Mark Andrews", "Zay Flowers", "C.J. Stroud", "Nico Collins", "Tee Higgins", "Jordan Love", "Sam Darnold", "George Pickens", "Ladd McConkey", "Breece Hall", "Jalen Ramsey", "Derwin James"] },
};
const seasonPlayer = (season: SeasonId, name: string): Player => {
  const src = PLAYERS.find((p) => p.name === name);
  if (!src) throw new Error("Missing seasonal player: " + name);
  return { ...src, id: "szn-" + season + "-" + src.id, packId: "season", season };
};
const SEASON_PLAYERS: Player[] = SEASON_IDS.flatMap((id) => {
  const r = SEASON_ROSTER[id];
  return r.chase.concat(r.pool).map((n) => seasonPlayer(id, n));
});
for (const p of SEASON_PLAYERS) PBYID[p.id] = p;
const SEASON_CHASE: Record<SeasonId, Player[]> = Object.fromEntries(SEASON_IDS.map((id) => [id, SEASON_PLAYERS.filter((p) => p.season === id && SEASON_ROSTER[id].chase.includes(p.name))])) as Record<SeasonId, Player[]>;
const ALL_SEASON_CHASE: Player[] = SEASON_IDS.flatMap((id) => SEASON_CHASE[id]);
const SEASON_CHASE_IDS = new Set(ALL_SEASON_CHASE.map((p) => p.id));
const currentSeasonPlayers = (): Player[] => SEASON_PLAYERS.filter((p) => p.season === seasonOf());
// Players of the Week: standout performers named weekly award winners in the 2026 season (NFL.com / Pro-Football-Reference). Any pack can pull one at a very rare rate; the POTW pack draws from this list too.
const POTW_NAMES = ["Kenneth Walker III", "D'Andre Swift", "Josh Allen", "Brock Purdy", "Brock Bowers", "Bijan Robinson", "Drake Maye", "Tetairoa McMillan", "Jaylen Warren", "Jahmyr Gibbs", "C.J. Stroud", "Caleb Williams", "Joe Burrow", "Michael Penix Jr.", "Tee Higgins", "Jordan Love", "T.J. Watt", "Foyesade Oluokun", "Jalen Ramsey", "Chris Jones"];
const POTW_PLAYERS: Player[] = POTW_NAMES.map((n) => PLAYERS.find((p) => p.name === n)).filter((p): p is Player => p !== undefined);
const playerOf = (id: string): Player => PBYID[id] ?? (PLAYERS[0] as Player);
const isDal = (c: Card): boolean => playerOf(c.playerId).team.abbr === "DAL";

// Chase cards: named true one-of-ones in each home pack. On a 1/1 roll there is a CHASE_SHARE chance the 1/1 is one of the pack's chase players (while any are unpulled); otherwise it is a regular 1/1. The Standard pack draws from every player but never a chase 1/1.
const CHASE_SHARE = 0.12;
const poolOf = (id: PackId): Player[] => (id === "season" ? currentSeasonPlayers() : (id === "standard" || id === "potw" || id === "boom" ? PLAYERS : PLAYERS.filter((p) => p.packId === id)));
const valuePoolOf = (id: PackId): Player[] => (id === "season" ? SEASON_PLAYERS : poolOf(id));
// Insert sets: themed subsets drawn from the pack's own pool. Gridiron Kings are the top quarterbacks, Defensive Walls the top defenders, Rookie Phenoms the best young players (Rising Stars pack only).
const INSERT_POOL: Partial<Record<RarityId, (p: Player) => boolean>> = {
  kings: (p) => p.pos === "QB" && ratingOf(p) >= 75,
  walls: (p) => ["DE", "DT", "LB", "CB", "S"].includes(p.pos) && ratingOf(p) >= 82,
  phenom: (p) => p.packId === "rookie" && ratingOf(p) >= 80,
};
const poolCache: Record<string, Player[]> = {};
const rpool = (id: PackId, r: RarityId, allSeasons = false): Player[] => {
  if (r === "potw") return POTW_PLAYERS;
  const base = allSeasons ? valuePoolOf(id) : poolOf(id);
  const f = INSERT_POOL[r];
  if (!f) return base;
  const k = id + "|" + r + (allSeasons ? "|all" : "");
  return poolCache[k] ?? (poolCache[k] = base.filter(f));
};
const CHASE_NAMES: Record<HomeId, string[]> = { rookie: ["Caleb Williams", "Travis Hunter", "Cam Ward", "Ashton Jeanty", "Drake Maye", "Marvin Harrison Jr."], stars: ["Patrick Mahomes", "Josh Allen", "Lamar Jackson", "Joe Burrow", "Bijan Robinson", "Ja'Marr Chase"], legends: ["Tom Brady", "Jerry Rice", "Joe Montana", "Jim Brown", "Walter Payton", "Emmitt Smith"] };
const CHASE: Record<HomeId, Player[]> = { rookie: [], stars: [], legends: [] };
for (const h of HOME) CHASE[h] = PLAYERS.filter((p) => p.packId === h && CHASE_NAMES[h].includes(p.name));
const HOME_CHASE_IDS = new Set(([] as Player[]).concat(...HOME.map((h) => CHASE[h])).map((p) => p.id));
const CHASE_IDS = new Set(([] as string[]).concat(Array.from(HOME_CHASE_IDS), Array.from(SEASON_CHASE_IDS)));
const chaseOf = (id: PackId): Player[] => (id === "season" ? SEASON_CHASE[seasonOf()] : (id === "standard" || id === "potw" || id === "boom" ? [] : CHASE[id]));
// Boom or Bust is the one pack outside the three home packs that can hit a chase 1/1: on a 1/1 roll it draws from all of the chase players, at the same CHASE_SHARE.
const ALL_CHASE: Player[] = ([] as Player[]).concat(...HOME.map((h) => CHASE[h]));
const chaseDraw = (id: PackId): Player[] => (id === "boom" ? ALL_CHASE : chaseOf(id));
const isChaseCard = (c: Card): boolean => c.rarity === "super" && CHASE_IDS.has(c.playerId);
const isIns = (r: RarityId): boolean => r === "kings" || r === "walls" || r === "phenom";
// Pull chance (percent) of a card's rarity in the pack it came from; a named chase 1/1 gets its own, smaller chance.
const pullChance = (c: Card): number => {
  const base = RB[c.rarity].tenths[c.packId] / 10;
  return isChaseCard(c) ? (base * CHASE_SHARE) / Math.max(1, chaseDraw(c.packId).length) : base;
};
const rarityPct = (c: Card): number => RB[c.rarity].tenths[c.packId] / 10;
// Chance (percent) of pulling this exact card from one pack: its rarity chance split over the players that can fill it.
const exactChance = (c: Card): number => {
  if (isChaseCard(c)) return pullChance(c);
  const pool = rpool(c.packId, c.rarity);
  if (c.rarity !== "super") return rarityPct(c) / pool.length;
  const reg = pool.filter((p) => !CHASE_IDS.has(p.id)).length;
  return (rarityPct(c) * (chaseDraw(c.packId).length > 0 ? 1 - CHASE_SHARE : 1)) / Math.max(1, reg);
};
const chanceText = (c: Card): string => RB[c.rarity].short + " · " + formatPct(rarityPct(c)) + " · this card " + formatPct(exactChance(c)) + (isChaseCard(c) ? " · ★ chase" : "") + (c.packId === "boom" && c.rarity === "base" ? " · bust" : "");

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function hu(seed: number, i: number): number { const x = Math.sin(seed * 0.001 + i * 12.9898) * 43758.5453; return x - Math.floor(x); }
function rm(): boolean { try { return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } }
const sp = (fast: string, slow: string): string => (rm() ? slow : fast);

// Ratings: current-season Madden-style overalls plus the four position attributes shown on the card back (Name|overall,attr1..attr4). Retired Legends use an all-time rating from their tier instead.
const RATINGS: Record<string, number[]> = Object.fromEntries("Marvin Harrison Jr.|79,93,84,80,76;Trey Benson|77,93,94,85,95;Michael Penix Jr.|75,92,84,75,84;Jalon Walker|79,81,41,86,76;Zay Flowers|87,93,88,87,79;Nate Wiggins|82,80,96,85,75;Dalton Kincaid|81,92,60,86,84;Keon Coleman|77,87,86,76,79;Bryce Young|74,87,83,73,87;Tetairoa McMillan|80,89,87,81,82;Caleb Williams|76,93,82,66,89;Rome Odunze|83,91,87,84,78;Chase Brown|80,93,95,86,86;Amarius Mims|74,78,75,91,74;Mason Graham|80,90,85,78,78;Quinshon Judkins|80,90,91,85,96;Tyler Guyton|72,76,77,85,81;James Pearce Jr.|75,72,70,76,90;Troy Franklin|76,92,85,77,74;Jonah Elliss|73,77,44,81,76;Terrion Arnold|75,74,90,72,69;Ennis Rakestraw Jr.|72,72,89,74,69;Jayden Reed|80,94,81,82,73;Edgerrin Cooper|79,83,74,89,77;Kamari Lassiter|81,84,92,81,81;Calen Bullock|74,70,65,90,77;Adonai Mitchell|73,94,81,75,66;Laiatu Latu|77,78,79,77,84;Brian Thomas Jr.|81,97,81,83,77;Travis Hunter|82,93,85,81,80;Xavier Worthy|79,99,84,79,68;Rashee Rice|84,90,95,84,87;Ashton Jeanty|83,90,92,91,92;Jack Bech|73,89,83,75,79;Ladd McConkey|84,92,89,85,69;Omarion Hampton|80,90,93,82,91;Jared Verse|88,84,81,92,89;Blake Corum|75,88,91,89,87;Chop Robinson|75,77,48,88,74;Jaylen Wright|72,93,93,84,86;J.J. McCarthy|73,91,82,67,85;Jordan Addison|84,90,91,86,74;Drake Maye|85,94,90,84,89;Will Campbell|81,84,80,87,82;Spencer Rattler|71,90,81,67,83;Kool-Aid McKinstry|75,74,90,76,72;Jaxson Dart|73,88,83,72,84;Tyrone Tracy Jr.|79,90,91,90,90;Braelon Allen|72,88,89,83,87;Olu Fashanu|75,79,78,88,75;Cooper DeJean|84,85,92,78,86;Quinyon Mitchell|87,87,94,85,86;Payton Wilson|75,85,62,92,76;Kaleb Johnson|74,88,90,92,89;Ricky Pearsall|81,92,90,79,73;Isaac Guerendo|73,92,92,84,88;Byron Murphy II|79,86,82,83,79;AJ Barner|72,85,62,78,76;Bucky Irving|87,89,91,88,92;Emeka Egbuka|80,90,85,85,79;Cam Ward|72,91,81,64,82;Tyjae Spears|79,88,91,88,95;Jer'Zhan Newton|75,85,79,79,71;Ben Sinnott|69,79,59,83,64;Michael Wilson|78,89,88,77,75;Kyle Pitts|78,85,56,90,70;Isaiah Likely|77,89,64,83,70;Ray Davis|74,88,88,86,93;Xavier Legette|74,93,80,73,71;Gervon Dexter|79,85,81,82,85;Andrei Iosivas|71,92,82,72,64;Shedeur Sanders|66,88,80,53,78;Luke Schoonmaker|69,80,64,85,66;Marvin Mims Jr.|77,92,86,79,68;Sam LaPorta|87,93,62,86,90;Luke Musgrave|70,85,61,89,65;Tank Dell|81,92,86,82,77;Anthony Richardson|69,96,77,51,91;Tank Bigsby|78,92,92,84,88;Leo Chenal|84,86,66,88,83;Michael Mayer|73,82,64,82,63;Joe Alt|85,88,85,89,88;Kyren Williams|87,86,90,83,89;Jaylen Waddle|85,97,88,81,80;Jalen Nailor|75,91,82,76,75;TreVeyon Henderson|76,91,90,86,94;Taliese Fuaga|78,73,82,93,74;Abdul Carter|81,76,52,88,82;Breece Hall|86,93,92,90,84;Jalen Carter|90,94,82,85,90;Broderick Jones|71,74,74,86,74;Brock Purdy|82,86,89,81,78;Kenneth Walker III|88,94,94,92,94;Rachaad White|80,90,92,87,89;Will Levis|69,94,80,58,80;Brian Robinson Jr.|79,88,90,80,94;Colston Loveland|72,80,61,86,64;Luther Burden III|78,92,83,76,74;Tyler Warren|83,86,62,84,88;Matthew Golden|79,95,84,79,75;Armand Membou|80,82,81,89,79;Mason Taylor|75,84,62,83,70;Mykel Williams|77,74,80,86,81;Kelvin Banks Jr.|76,81,79,86,76;Tyler Shough|68,92,79,66,84;Dillon Gabriel|68,84,81,71,83;Jalen Milroe|65,92,76,49,93;Cam Skattebo|81,85,90,87,90;RJ Harvey|77,92,94,85,88;Jayden Higgins|74,89,86,73,77;Tre Harris|72,88,82,74,74;Harold Fannin Jr.|74,84,63,82,69;Carson Schwesinger|79,86,68,87,82;Malaki Starks|75,73,72,89,71;Jahdae Barron|77,77,93,73,78;Will Johnson|78,80,89,74,84;Walter Nolen|77,87,79,79,75;Shemar Stewart|77,76,80,87,86;Nick Emmanwori|76,70,72,93,76;Luke McCaffrey|72,90,83,74,65;Mike Sainristil|78,79,90,78,73;Dallas Turner|73,80,52,90,61;Troy Fautanu|77,80,79,87,78;JC Latham|76,76,80,94,72;Theo Johnson|76,80,62,87,80;Cole Bishop|74,70,66,91,70;Tyler Nubin|74,74,68,87,78;Jalen McMillan|74,90,82,77,71;Brenton Strange|77,86,64,83,79;Jack Campbell|86,92,68,85,87;Josh Downs|80,90,90,80,69;Christian Watson|78,96,85,78,69;Brian Branch|90,88,74,88,90;Jaylen Warren|81,90,94,80,92;Zach Charbonnet|78,88,89,82,95;Dontayvion Wicks|75,89,82,78,73;Kyler Murray|79,90,83,71,92;Trey McBride|94,98,62,87,97;Bijan Robinson|94,91,92,92,93;Drake London|91,88,97,84,91;Lamar Jackson|98,93,93,95,96;Derrick Henry|96,93,87,83,91;Josh Allen|99,98,92,96,88;James Cook|92,92,93,94,90;Derrick Brown|96,98,95,86,97;Chuba Hubbard|84,92,92,88,90;DJ Moore|85,91,91,81,85;Montez Sweat|82,79,84,80,88;Joe Burrow|96,88,97,98,84;Ja'Marr Chase|99,95,98,97,97;Myles Garrett|99,96,96,96,87;Denzel Ward|92,89,93,93,92;Dak Prescott|91,92,91,94,84;CeeDee Lamb|95,90,93,95,98;Bo Nix|80,93,86,80,88;Patrick Surtain II|97,96,94,97,98;Jahmyr Gibbs|97,96,95,93,97;Amon-Ra St. Brown|96,90,99,94,90;Jordan Love|86,92,89,87,84;Micah Parsons|98,94,81,89,90;C.J. Stroud|78,91,86,77,82;Nico Collins|88,94,96,87,92;Jonathan Taylor|95,94,94,86,95;DeForest Buckner|91,90,90,89,94;Trevor Lawrence|77,92,83,73,88;Josh Hines-Allen|89,86,81,83,88;Patrick Mahomes|97,97,92,97,85;Travis Kelce|92,93,65,82,96;Maxx Crosby|97,93,92,88,86;Brock Bowers|91,96,61,89,92;Justin Herbert|90,96,89,92,86;Derwin James|93,84,79,90,95;Matthew Stafford|92,95,92,95,78;Puka Nacua|94,93,96,91,86;Jameson Williams|82,98,84,79,73;De'Von Achane|86,96,96,91,92;Justin Jefferson|99,91,96,98,99;Aaron Jones|82,89,92,91,86;Stefon Diggs|89,91,92,88,88;Christian Gonzalez|96,89,96,97,97;Alvin Kamara|82,88,92,87,91;Chris Olave|85,93,94,85,83;Malik Nabers|88,96,87,86,78;Dexter Lawrence|97,99,96,91,96;Garrett Wilson|87,92,92,85,78;Sauce Gardner|93,93,93,94,91;Jalen Hurts|87,86,89,89,89;Saquon Barkley|99,95,94,95,97;T.J. Watt|96,96,62,83,98;DK Metcalf|86,95,89,83,89;Christian McCaffrey|91,90,93,94,92;Nick Bosa|95,96,91,94,80;Jaxon Smith-Njigba|91,91,97,92,84;Devon Witherspoon|88,84,91,89,85;Baker Mayfield|88,95,88,91,86;Mike Evans|92,90,93,87,94;Jeffery Simmons|94,97,92,91,96;Calvin Ridley|79,93,83,76,80;Jayden Daniels|83,92,87,75,90;Terry McLaurin|92,96,98,90,95;Budda Baker|90,80,80,90,91;A.J. Terrell|88,93,91,88,91;Roquan Smith|93,97,73,86,91;Khalil Shakir|82,90,94,82,74;Jaycee Horn|87,84,92,88,83;Tremaine Edmunds|82,89,68,86,88;Trey Hendrickson|92,90,78,83,84;Jerry Jeudy|83,91,82,83,80;Trevon Diggs|83,84,91,76,93;Courtland Sutton|86,90,86,80,88;Aidan Hutchinson|93,92,85,87,82;Josh Jacobs|89,90,90,86,88;Will Anderson Jr.|91,87,85,86,87;Michael Pittman Jr.|83,89,89,80,86;Travon Walker|80,76,82,88,88;Chris Jones|96,96,93,92,97;Jakobi Meyers|82,89,95,81,72;Rashawn Slater|93,95,84,93,88;Davante Adams|90,89,88,90,96;Zach Sieler|83,89,86,83,86;Harrison Smith|88,78,78,87,93;Hunter Henry|85,94,66,85,93;Demario Davis|90,90,71,88,96;Brian Burns|89,82,79,76,87;Quinnen Williams|89,92,91,88,87;A.J. Brown|89,91,94,85,89;Cameron Heyward|95,94,96,89,96;George Kittle|98,95,77,87,98;Sam Darnold|82,88,90,79,81;Antoine Winfield Jr.|92,84,77,90,95;Tony Pollard|83,92,94,85,91;Zaire Franklin|80,88,58,84,83;Aaron Rodgers|79,94,85,78,78;Tua Tagovailoa|75,87,86,70,83;Jared Goff|89,90,90,93,74;Kirk Cousins|71,85,83,71,69;Geno Smith|72,88,84,64,87;Jameis Winston|70,90,82,62,76;Daniel Jones|81,87,87,85,87;Justin Fields|74,91,82,57,92;Cooper Kupp|85,89,90,84,87;Brandon Aiyuk|86,91,90,85,85;George Pickens|86,91,87,84,78;Chris Godwin|83,88,93,84,84;Tee Higgins|87,91,97,82,90;DeVonta Smith|90,92,95,90,83;Deebo Samuel|84,91,86,82,82;Jauan Jennings|81,88,89,79,81;Mark Andrews|90,90,68,87,91;T.J. Hockenson|86,94,64,83,89;Jake Ferguson|84,91,66,81,85;David Njoku|87,87,62,86,82;David Montgomery|85,87,88,84,93;Javonte Williams|84,88,90,84,92;James Conner|84,89,87,81,89;Isiah Pacheco|81,93,95,86,95;Travis Etienne Jr.|85,93,93,89,93;D'Andre Swift|82,90,91,89,91;Penei Sewell|97,88,99,97,97;Lane Johnson|99,98,97,93,99;Tristan Wirfs|96,95,89,94,97;Trent Williams|97,92,98,95,98;Tyler Smith|88,86,88,97,85;Danielle Hunter|90,88,82,82,88;Fred Warner|97,91,82,88,99;Kyle Hamilton|91,84,80,88,89;Minkah Fitzpatrick|92,86,78,91,91;Jalen Ramsey|94,90,94,91,96;Marlon Humphrey|90,90,91,89,93;Trent McDuffie|95,92,92,95,95;Kayvon Thibodeaux|78,76,78,81,88;Rashan Gary|84,75,83,83,85;Foyesade Oluokun|86,92,70,87,92;Patrick Queen|81,86,60,88,87;Vita Vea|93,98,94,83,90;Leonard Williams|87,90,88,83,95;Xavier McKinney|93,85,83,88,94;Jonathan Greenard|85,82,83,81,86;Nik Bonitto|88,86,78,82,88;Pat Freiermuth|82,92,61,83,87;Evan Engram|80,87,62,84,77;Jordan Mailata|94,90,96,97,97".split(";").map((kv) => { const [n = "", v = ""] = kv.split("|"); return [n, v.split(",").map(Number)]; }));
const ratingOf = (p: Player): number => RATINGS[p.name]?.[0] ?? (p.tier >= 5 ? 95 + (hashStr(p.id) % 5) : p.tier === 4 ? 89 + (hashStr(p.id) % 4) : 56 + p.tier * 5 + (hashStr(p.id) % 5));
const RARITY_BUMP: Record<RarityId, number> = { base: 0, silver: 4, kings: 6, walls: 6, phenom: 6, gold: 8, potw: 10, auto: 12, super: 18 };
// Higher rarities add to the player's real rating, with the bump shrinking near the 99 cap so elite players stay distinct.
function overallOf(p: Player, r: RarityId): number {
  const base = ratingOf(p);
  return Math.max(60, Math.min(99, base + Math.round(RARITY_BUMP[r] * (base >= 92 ? 0.35 : base >= 85 ? 0.7 : 1))));
}
const cardOvr = (c: Card): number => overallOf(playerOf(c.playerId), c.rarity);

// Simulated money only. Est. value is modeled on modern NFL card market shapes: rarity sets the tier, and a player hype multiplier (position, star power, rookie premium) scales it; pack prices sit a bit above the average card value.
const START_BAL = 350;
const BAILOUT = 75;
// value = minimum + premium: the minimum is the rarity's floor ($5 Base up to $1,000 for every 1/1), and the premium grows with player hype so values spread widely.
const V_MIN: Record<RarityId, number> = { base: 5, silver: 8, kings: 12, walls: 12, phenom: 12, gold: 20, potw: 25, auto: 30, super: 1000 };
const V_BASE: Record<RarityId, number> = { base: 1.9, silver: 4.5, kings: 11, walls: 11, phenom: 11, gold: 18, potw: 27, auto: 40, super: 15 };
const V_EXP: Record<RarityId, number> = { base: 0.9, silver: 1, kings: 1.05, walls: 1.05, phenom: 1.05, gold: 1.1, potw: 1.2, auto: 1.3, super: 2.5 };
const V_CAP: Record<RarityId, number> = { base: 25, silver: 60, kings: 220, walls: 220, phenom: 220, gold: 500, potw: 1200, auto: 3000, super: 50000 };
const POS_HYPE: Record<string, number> = { QB: 1.7, WR: 1.15, RB: 1, TE: 0.8, CB: 0.55, S: 0.5, LB: 0.55, DE: 0.65, DT: 0.45, OT: 0.3 };
// Star power from the player's real rating: about 0.6 at an 80, 1.0 at 86, 2 at 93 and 3.4 at 99.
const ratingHype = (r: number): number => 0.7 * 0.6 * Math.exp(0.0907 * (Math.min(99, Math.max(60, r)) - 80));
const ELITE: Record<string, number> = Object.fromEntries("Patrick Mahomes:4;Josh Allen:3.5;Lamar Jackson:3.5;Joe Burrow:3;Bijan Robinson:3;Christian McCaffrey:2.5;Justin Jefferson:3;Ja'Marr Chase:3;Caleb Williams:4;Jayden Daniels:3.5;Travis Kelce:2.5;Saquon Barkley:2.5;CeeDee Lamb:2.5;Jalen Hurts:2.5;Cam Ward:3;Drake Maye:3;Travis Hunter:4;Ashton Jeanty:3;Malik Nabers:2.5;Brock Bowers:2.5;Puka Nacua:2.2;Justin Herbert:2;Micah Parsons:2;Myles Garrett:2;Tom Brady:8;Jerry Rice:6;Joe Montana:6;Walter Payton:6;Deion Sanders:6;Emmitt Smith:5;Peyton Manning:6;Barry Sanders:6;Randy Moss:5;Jim Brown:5;Dan Marino:5;John Elway:5;Brett Favre:4;Lawrence Taylor:5;Ray Lewis:3;Troy Aikman:3;Steve Young:3;Marshall Faulk:3;Adrian Peterson:4;Aaron Donald:3;Rob Gronkowski:3;Jim Kelly:2;Eli Manning:2;Drew Brees:3;Kurt Warner:2.5;Larry Fitzgerald:3;Michael Irvin:2;Terrell Davis:2;Reggie White:3;Eric Dickerson:3;LaDainian Tomlinson:3;Michael Strahan:2;Charles Woodson:2;Ed Reed:2;Troy Polamalu:2;Brian Urlacher:2;Cam Newton:2.5;Calvin Johnson:3;Tony Gonzalez:2;Jerome Bettis:2;Shannon Sharpe:2;Dak Prescott:1.5;Matthew Stafford:1.4;Aaron Rodgers:2;Brock Purdy:1.3;Jared Goff:1.2;Bo Nix:1.5;Jordan Love:1.3;C.J. Stroud:1.6;Trevor Lawrence:1.2;Baker Mayfield:1.2;Sam Darnold:1.2;Tua Tagovailoa:1.1;Kyler Murray:1.4;Jaxson Dart:1.8;Shedeur Sanders:2.5;Michael Penix Jr.:1.5;J.J. McCarthy:1.5;Marvin Harrison Jr.:1.8;Brian Thomas Jr.:1.5;Jaxon Smith-Njigba:2;Tetairoa McMillan:1.6;Omarion Hampton:1.5;Rome Odunze:1.3;Jahmyr Gibbs:2;Amon-Ra St. Brown:1.6;Jonathan Taylor:1.5;Derrick Henry:1.5;Trey McBride:1.8;George Kittle:1.5;Abdul Carter:1.8;Will Anderson Jr.:1.3;Nick Bosa:1.3;Aidan Hutchinson:1.3;T.J. Watt:1.3;Maxx Crosby:1.4;Fred Warner:1.2;Patrick Surtain II:1.3;Colston Loveland:1.3;Mason Graham:1.3;Jalen Carter:1.2;Dalton Kincaid:1.1;Sam LaPorta:1.1;Zay Flowers:1.1;Rashee Rice:1.3;Xavier Worthy:1.1".split(";").map((kv) => { const i = kv.lastIndexOf(":"); return [kv.slice(0, i), Number(kv.slice(i + 1))]; }));
const PACK_PREM: Record<HomeId | "season", number> = { rookie: 1.5, stars: 0.82, legends: 0.792, season: 1 };
const MIN_PRICE = Math.min(...PACKS.map((x) => x.price));
const hypeOf = (p: Player): number => (POS_HYPE[p.pos] ?? 1) * ratingHype(ratingOf(p)) * (ELITE[p.name] ?? 1) * PACK_PREM[p.packId];
const rawValue = (p: Player, r: RarityId): number => {
  const v = Math.min(V_CAP[r], V_MIN[r] + V_BASE[r] * Math.pow(hypeOf(p), V_EXP[r]) * (0.9 + (hashStr(p.id + r) % 21) / 100));
  return Math.max(V_MIN[r], Math.round(v));
};
// Per-pack minimum: a pack-specific offset lifts every card so the cheapest Base card in that pack is exactly this value; higher rarities and hype still scale upward from it.
const PACK_MIN: Record<PackId, number> = { rookie: 30, stars: 54, legends: 120, standard: 5, potw: 5, boom: 5, season: 50 };
// Premium scale: how much of a card's hype premium above its rarity minimum a pack keeps (Standard keeps 30% so its values suit a low price).
const PACK_K: Record<PackId, number> = { rookie: 1, stars: 1, legends: 1, standard: 0.3, potw: 0.3, boom: 0.1, season: 1 };
const PACK_OFF = Object.fromEntries(PIDS.map((id) => [id, PACK_MIN[id] - Math.min(...valuePoolOf(id).map((p) => rawValue(p, "base")))])) as Record<PackId, number>;
const baseValue = (p: Player, r: RarityId, via: PackId = p.packId): number => {
  const raw = rawValue(p, r), k = PACK_K[via];
  return (k === 1 ? raw : Math.round(V_MIN[r] + (raw - V_MIN[r]) * k)) + PACK_OFF[via];
};
// Gold and Auto floors per pack: a lift added to every card of that rarity so the cheapest one equals the floor (about 1.5-2x the pack price for Gold, 3-4x for Auto); hype spread above it is kept and 1/1s are untouched.
const RARITY_FLOOR: Record<PackId, Partial<Record<RarityId, number>>> = { standard: { kings: 14, walls: 14, phenom: 14, gold: 25, potw: 38, auto: 55 }, rookie: { kings: 60, walls: 60, phenom: 60, gold: 223, potw: 338, auto: 512 }, stars: { kings: 80, walls: 80, phenom: 80, gold: 112, potw: 170, auto: 270 }, legends: { kings: 150, walls: 150, phenom: 150, gold: 300, potw: 425, auto: 600 }, season: { kings: 80, walls: 80, gold: 120, potw: 180, auto: 290 }, potw: { potw: 80 }, boom: BOOM_FLOOR };
const RARITY_LIFT = Object.fromEntries(PIDS.map((id) => [id, Object.fromEntries(Object.entries(RARITY_FLOOR[id]).map(([r, f]) => [r, (f as number) - Math.min(...rpool(id, r as RarityId, true).map((p) => baseValue(p, r as RarityId, id)))]))])) as Record<PackId, Record<string, number>>;
const preValue = (p: Player, r: RarityId, via: PackId = p.packId): number => baseValue(p, r, via) + (RARITY_LIFT[via][r] ?? 0);
// Per-card variation: a stable hash of player id + rarity adds 0 to 30% of the pack's cheapest value for that rarity, so cards of one rarity differ but never drop below the floor (and never change between renders or saves).
const FLOOR_V = Object.fromEntries(PIDS.map((id) => [id, Object.fromEntries(RARITIES.filter((r) => r.tenths[id] > 0 || (RARITY_FLOOR[id][r.id] ?? 0) > 0).map((r) => [r.id, Math.min(...(rpool(id, r.id, true).length ? rpool(id, r.id, true) : poolOf(id)).map((p) => preValue(p, r.id, id)))]))])) as Record<PackId, Record<string, number>>;
const valueOf = (p: Player, r: RarityId, via: PackId = p.packId): number => preValue(p, r, via) + Math.round(((hashStr(p.id + "|" + r + "|v") % 1000) / 1000) * 0.3 * (FLOOR_V[via][r] ?? 0));
const cardVal = (c: Card): number => valueOf(playerOf(c.playerId), c.rarity, c.packId);
const money = (n: number): string => "🪙 " + Math.round(n).toLocaleString("en-US");
function evOf(id: PackId): number {
  const pl = poolOf(id);
  const ch = chaseDraw(id);
  const reg = pl.filter((p) => !CHASE_IDS.has(p.id));
  const avg = (a: Player[], r: RarityId): number => a.reduce((s, p) => s + valueOf(p, r, id), 0) / a.length;
  let ev = 0;
  for (const r of RARITIES) {
    if (r.tenths[id] === 0) continue;
    const a = r.id === "super" ? (ch.length > 0 ? CHASE_SHARE * avg(ch, r.id) + (1 - CHASE_SHARE) * avg(reg, r.id) : avg(reg, r.id)) : avg(rpool(id, r.id), r.id);
    ev += (r.tenths[id] / 1000) * a;
  }
  return ev;
}

// ---- set completion ----
interface SetDef { id: string; name: string; group: string; players: string[]; need?: RarityId; reward: number }
const SETS: SetDef[] = (() => {
  const out: SetDef[] = [];
  const ids = (l: Player[]): string[] => l.map((p) => p.id);
  const chase = HOME.flatMap((h) => CHASE[h]);
  out.push({ id: "full", name: "Complete Set (every player)", group: "master", players: ids(PLAYERS), reward: 3000 });
  for (const h of HOME) { const l = PLAYERS.filter((p) => p.packId === h); out.push({ id: "roster-" + h, name: PB[h].name + " full roster", group: "master", players: ids(l), reward: Math.round(l.length * PB[h].price * 0.25) }); }
  out.push({ id: "potw", name: "Players of the Week (POTW card of each)", group: "master", players: ids(POTW_PLAYERS), need: "potw", reward: POTW_PLAYERS.length * 125 });
  out.push({ id: "chase", name: "Chase 1/1s (every home chase card)", group: "master", players: ids(chase), need: "super", reward: chase.length * 400 });
  for (const sid of SEASON_IDS) {
    const ch = SEASON_CHASE[sid];
    out.push({ id: "szn-chase-" + sid, name: SEASON_THEME[sid].name + " chase 1/1s", group: "master", players: ids(ch), need: "super", reward: 450 });
  }
  // One set per NFL team: every player on the team from any pack. The reward adds up 35% of each player's own pack price. Older saves may hold retired per-pack ids ("team-rookie-DAL"); those stay in the claim list so nothing is clawed back, but they match no set here.
  for (const t of TEAMS) {
    const l = PLAYERS.filter((p) => p.team.abbr === t.abbr);
    if (l.length > 0) out.push({ id: "team-" + t.abbr, name: t.name, group: "teams", players: ids(l), reward: Math.round(l.reduce((s, p) => s + PB[p.packId].price * 0.35, 0)) });
  }
  return out;
})();

// ---- achievements ----
interface AchCtx { packs: number; opened: Record<PackId, number>; cards: Card[]; value: number; unique: number; sets: number; daily: number }
interface AchDef { id: string; name: string; desc: string; reward: number; ok: (x: AchCtx) => boolean; prog?: (x: AchCtx) => [number, number] }
const hasR = (x: AchCtx, r: RarityId): boolean => x.cards.some((c) => c.rarity === r);
const dalOwned = (x: AchCtx): number => new Set(x.cards.filter((c) => playerOf(c.playerId).team.abbr === "DAL").map((c) => c.playerId)).size;
const DAL_ALL = PLAYERS.filter((p) => p.team.abbr === "DAL").length;
const cnt = (name: string, id: string, desc: string, reward: number, n: number, f: (x: AchCtx) => number): AchDef => ({ id, name, desc, reward, ok: (x) => f(x) >= n, prog: (x) => [Math.min(n, f(x)), n] });
const ACH: AchDef[] = [
  cnt("Rip It", "pack1", "Open your first pack.", 15, 1, (x) => x.packs),
  cnt("Getting Started", "pack10", "Open 10 packs.", 30, 10, (x) => x.packs),
  cnt("Regular", "pack50", "Open 50 packs.", 75, 50, (x) => x.packs),
  cnt("Century Club", "pack100", "Open 100 packs.", 150, 100, (x) => x.packs),
  cnt("Pack Rat", "pack500", "Open 500 packs.", 600, 500, (x) => x.packs),
  { id: "gold", name: "Gold Standard", desc: "Pull your first Gold card.", reward: 30, ok: (x) => hasR(x, "gold") },
  { id: "insert", name: "Special Delivery", desc: "Pull an insert (Kings, Walls or Phenoms).", reward: 45, ok: (x) => hasR(x, "kings") || hasR(x, "walls") || hasR(x, "phenom") },
  { id: "inserts", name: "Full Insert Set", desc: "Pull all three insert groups.", reward: 180, ok: (x) => hasR(x, "kings") && hasR(x, "walls") && hasR(x, "phenom") },
  { id: "potw", name: "Player of the Week", desc: "Pull your first POTW card.", reward: 75, ok: (x) => hasR(x, "potw") },
  { id: "auto", name: "Signed, Sealed", desc: "Pull your first Autograph.", reward: 60, ok: (x) => hasR(x, "auto") },
  { id: "super", name: "One of One", desc: "Pull your first 1/1.", reward: 300, ok: (x) => hasR(x, "super") },
  { id: "chase", name: "Chase Hunter ★", desc: "Pull a chase 1/1.", reward: 750, ok: (x) => x.cards.some((c) => isChaseCard(c)) },
  cnt("Complete Rainbow", "rainbow", "Own at least one card of every rarity.", 450, RARITIES.length, (x) => new Set(x.cards.map((c) => c.rarity)).size),
  cnt("Cowboys Fan", "dal5", "Own 5 different Cowboys.", 60, 5, dalOwned),
  cnt("America's Team", "dalall", "Own every Cowboy in the set.", 300, DAL_ALL, dalOwned),
  cnt("Four Figures", "val1k", "Binder worth 1,000 coins.", 75, 1000, (x) => x.value),
  cnt("Five Figures", "val10k", "Binder worth 10,000 coins.", 450, 10000, (x) => x.value),
  cnt("Collector", "uniq50", "Own 50 different players.", 75, 50, (x) => x.unique),
  cnt("Completionist", "uniq200", "Own 200 different players.", 300, 200, (x) => x.unique),
  cnt("Free Pack Habit", "daily1", "Claim a free pack.", 15, 1, (x) => x.daily),
  cnt("Free Pack Regular", "daily7", "Claim 7 free packs.", 150, 7, (x) => x.daily),
  { id: "seasonpack", name: "Season Ticket", desc: "Open a Season pack.", reward: 30, ok: (x) => (x.opened.season ?? 0) > 0 },
  { id: "seasonchase", name: "Season Star ★", desc: "Pull a seasonal chase 1/1.", reward: 400, ok: (x) => x.cards.some((c) => c.rarity === "super" && SEASON_CHASE_IDS.has(c.playerId)) },
  cnt("Set Builder", "set1", "Complete and claim a set.", 90, 1, (x) => x.sets),
  cnt("Set Master", "set10", "Complete and claim 10 sets.", 450, 10, (x) => x.sets),
  cnt("Pack Explorer", "allpacks", "Open every kind of pack.", 90, PIDS.length, (x) => PIDS.filter((id) => x.opened[id] > 0).length),
  { id: "ovr99", name: "Maxed Out", desc: "Own a card rated 99.", reward: 45, ok: (x) => x.cards.some((c) => cardOvr(c) >= 99) },
];

const ATTRS: Record<string, string> = {
  QB: "Throw Power,Accuracy,Awareness,Speed", WR: "Speed,Catching,Route Running,Release", RB: "Speed,Acceleration,Agility,Carrying",
  TE: "Catching,Run Block,Speed,Awareness", OT: "Pass Block,Run Block,Strength,Awareness", DT: "Strength,Block Shed,Pursuit,Awareness",
  DE: "Pass Rush,Block Shed,Strength,Speed", LB: "Tackling,Coverage,Speed,Awareness", CB: "Coverage,Speed,Man Cover,Awareness", S: "Coverage,Tackling,Speed,Awareness",
};
// Card-back attributes come from the player's real position ratings (QBs show throw power and accuracy, linemen block ratings and so on); rarer cards add a share of the card's overall bump.
function gameAttrs(p: Player, r: RarityId): { label: string; value: number }[] {
  const ovr = overallOf(p, r), real = RATINGS[p.name], lift = ovr - ratingOf(p);
  return (ATTRS[p.pos] ?? "Speed,Strength,Awareness,Agility").split(",").map((label, i) => {
    const b = real?.[i + 1];
    const v = b !== undefined ? b + Math.round(lift * 0.6) : ovr + (hashStr(p.id + ":" + label + ":" + r) % 13) - 6 + (i === 0 ? 3 : 0);
    return { label, value: Math.max(25, Math.min(99, v)) };
  });
}

// Autograph: the player's name in a script font stack (first initial + last name, slanted, with a pen swash under it), drawn in SVG so it scales to any tile.
const SIG_FONT = "'Snell Roundhand','Savoye LET','Zapfino','Segoe Script','Lucida Handwriting','Bradley Hand','Apple Chancery','Brush Script MT',cursive";
function sigText(name: string): string {
  const parts = name.replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "").trim().split(/\s+/);
  const first = parts[0] ?? name;
  return parts.length > 1 ? first.charAt(0) + ". " + parts.slice(1).join(" ") : first;
}
function Signature(p: { name: string; ink: string; compact: boolean }): ReactNode {
  const text = sigText(p.name), h = hashStr(p.name);
  const tl = Math.min(176, 15 * text.length);
  const x0 = (200 - tl) / 2 + 6;
  const y0 = 47 + (h % 3), dip = 4 + ((h >>> 3) % 6);
  const swash = "M " + (x0 - 2) + " " + y0 + " C " + (x0 + tl * 0.3) + " " + (y0 + dip + 3) + ", " + (x0 + tl * 0.62) + " " + (y0 - dip) + ", " + (x0 + tl + 4) + " " + (y0 - 3);
  return (
    <svg viewBox="0 0 200 58" width="100%" height={p.compact ? 24 : 38} preserveAspectRatio="xMidYMid meet" style={{ display: "block", overflow: "visible" }} aria-hidden="true">
      <text x={x0} y="36" textLength={tl} lengthAdjust="spacingAndGlyphs" fontFamily={SIG_FONT} fontSize="36" fontStyle="italic" fill={p.ink} stroke={p.ink} strokeWidth="0.7" transform="rotate(-4 100 30) skewX(-10)">{text}</text>
      <path d={swash} fill="none" stroke={p.ink} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Original team emblem (generic shield / circle / hexagon in the team's two colors with its abbreviation). Not an official logo.
function lum(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
function TeamBadge(p: { team: Team; size: number }): ReactNode {
  const t = p.team;
  const i = Math.max(0, TEAMS.findIndex((x) => x.abbr === t.abbr));
  const shape = i % 3, deco = Math.floor(i / 3) % 3;
  const txt = lum(t.primary) > 0.62 ? "#101418" : "#ffffff";
  const inner = "translate(20 20) scale(0.8) translate(-20 -20)";
  const ring = "rgba(0,0,0,0.4)";
  return (
    <svg viewBox="0 0 40 40" width={p.size} height={p.size} style={{ display: "block", flexShrink: 0 }} aria-label={t.name + " emblem"} role="img">
      {shape === 0 ? <><path d="M20 1.5 L36.5 7 V21 C36.5 30.5 29 36.5 20 39 C11 36.5 3.5 30.5 3.5 21 V7 Z" fill={t.secondary} stroke={ring} strokeWidth="1" /><path d="M20 1.5 L36.5 7 V21 C36.5 30.5 29 36.5 20 39 C11 36.5 3.5 30.5 3.5 21 V7 Z" fill={t.primary} transform={inner} /></> : null}
      {shape === 1 ? <><circle cx="20" cy="20" r="18.5" fill={t.secondary} stroke={ring} strokeWidth="1" /><circle cx="20" cy="20" r="14.8" fill={t.primary} /></> : null}
      {shape === 2 ? <><polygon points="20,1.5 36,10.5 36,29.5 20,38.5 4,29.5 4,10.5" fill={t.secondary} stroke={ring} strokeWidth="1" /><polygon points="20,1.5 36,10.5 36,29.5 20,38.5 4,29.5 4,10.5" fill={t.primary} transform={inner} /></> : null}
      {deco === 0 ? <rect x="11" y="28" width="18" height="2.6" rx="1.3" fill={t.secondary} /> : null}
      {deco === 1 ? <polygon points="13,9 20,14 27,9 27,12 20,17 13,12" fill={t.secondary} /> : null}
      {deco === 2 ? <><circle cx="14" cy="29.5" r="1.6" fill={t.secondary} /><circle cx="20" cy="29.5" r="1.6" fill={t.secondary} /><circle cx="26" cy="29.5" r="1.6" fill={t.secondary} /></> : null}
      <text x="20" y={deco === 1 ? 26 : 24} textAnchor="middle" fontSize={t.abbr.length > 2 ? 10.5 : 12.5} fontWeight="900" fontFamily="Arial, Helvetica, sans-serif" fill={txt} stroke={txt === "#ffffff" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.25)"} strokeWidth="0.6" paintOrder="stroke">{t.abbr}</text>
    </svg>
  );
}

function formatPct(n: number): string {
  if (n >= 10) { const r = Math.round(n * 10) / 10; return (Number.isInteger(r) ? String(r) : r.toFixed(1)) + "%"; }
  if (n > 0 && n < 0.01) return "<0.01%";
  const r = Math.round(n * 100) / 100;
  return (Number.isInteger(r) ? String(r) : String(r)) + "%";
}

let cardSeq = 0;
function drawCard(packId: PackId, takenSuper: Set<string>): Card {
  const roll = Math.floor(Math.random() * 1000);
  let acc = 0;
  let rarity: RarityId = "base";
  for (const r of RARITIES) { acc += r.tenths[packId]; if (roll < acc) { rarity = r.id; break; } }
  const all = poolOf(packId);
  let pool = all;
  if (rarity === "potw") pool = POTW_PLAYERS;
  else if (INSERT_POOL[rarity]) { pool = rpool(packId, rarity); if (pool.length === 0) { rarity = "base"; pool = all; } }
  if (rarity === "super") {
    const chase = chaseDraw(packId).filter((p) => !takenSuper.has(p.id));
    const reg = all.filter((p) => !takenSuper.has(p.id) && !CHASE_IDS.has(p.id));
    if (chase.length > 0 && (reg.length === 0 || Math.random() < CHASE_SHARE)) pool = chase;
    else if (reg.length > 0) pool = reg;
    else rarity = "auto";
  }
  const player = (pool[Math.floor(Math.random() * pool.length)] ?? all[0]) as Player;
  if (rarity === "super") takenSuper.add(player.id);
  cardSeq += 1;
  return { uid: "c" + cardSeq + "-" + Date.now().toString(36), playerId: player.id, rarity, packId, seq: cardSeq };
}

// ---- persistence (localStorage with in-memory fallback) ----
const SAVE_KEY = "gl-legends-2026-v2";
const zeroCounts = (): Record<PackId, number> => ({ rookie: 0, stars: 0, legends: 0, standard: 0, potw: 0, boom: 0, season: 0 });
const defaultMeta = (): Meta => ({ daily: "", dailyN: 0, sets: [], ach: [] });
const localDay = (d: Date = new Date()): string => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
function loadMeta(raw: unknown): Meta {
  const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  let daily = typeof m.daily === "string" ? m.daily : "";
  // Old daily-pack saves stored a YYYY-MM-DD claim date. Turn "claimed today" into a timestamp so the 5-minute cooldown can start; older dates are already expired.
  if (/^\d{4}-\d{2}-\d{2}$/.test(daily)) daily = daily === localDay() ? String(Date.now()) : "";
  return { daily, dailyN: typeof m.dailyN === "number" && m.dailyN >= 0 ? Math.floor(m.dailyN) : 0, sets: strs(m.sets), ach: strs(m.ach) };
}
const isPack = (v: unknown): v is PackId => v === "rookie" || v === "stars" || v === "legends" || v === "standard" || v === "potw" || v === "boom" || v === "season";
const isRarity = (v: unknown): v is RarityId => typeof v === "string" && v in RB;
const defaultSave = (): Save => ({ v: 2, collection: [], openedCounts: zeroCounts(), soundOn: true, cardSeq: 0, readyPack: null, balance: START_BAL, pulls: {}, supers: [], locked: true, meta: defaultMeta() });
function saveScore(s: Save): number {
  let packs = 0, pullN = 0;
  for (const id of PIDS) packs += s.openedCounts[id] ?? 0;
  for (const k of Object.keys(s.pulls)) pullN += s.pulls[k] ?? 0;
  return packs * 1e7 + s.collection.length * 1e4 + pullN * 100 + s.cardSeq + s.meta.sets.length * 20 + s.meta.ach.length + s.meta.dailyN;
}
function compactOf(s: Save): Record<string, unknown> {
  return { v: 2, c: s.collection.map((x) => [x.uid, x.playerId, x.rarity, x.packId, x.seq]), o: s.openedCounts, s: s.soundOn ? 1 : 0, q: s.cardSeq, b: s.balance, p: s.pulls, u: s.supers, l: s.locked ? 1 : 0, m: s.meta };
}
function inflateRow(raw: string): Record<string, unknown> | null {
  try {
    const json = decodeBackup(raw);
    return json ? JSON.parse(json) as Record<string, unknown> : null;
  } catch { return null; }
}
function loadSave(override?: string): Save {
  try {
    if (override === undefined && typeof window === "undefined") return defaultSave();
    const raw = override ?? readSaved();
    if (!raw) return defaultSave();
    const row = inflateRow(raw);
    if (!row || (row.v !== 2 && row.v !== 1 && !Array.isArray(row.collection))) return defaultSave();
    const collection: Card[] = [];
    if (Array.isArray(row.collection)) {
      for (const it of row.collection as Record<string, unknown>[]) {
        if (!it || typeof it.uid !== "string" || typeof it.playerId !== "string" || !PBYID[it.playerId] || !isRarity(it.rarity) || !isPack(it.packId)) continue;
        collection.push({ uid: it.uid, playerId: it.playerId, rarity: it.rarity, packId: it.packId, seq: typeof it.seq === "number" ? it.seq : collection.length + 1 });
      }
    }
    const oc = zeroCounts();
    const rc = (row.openedCounts ?? {}) as Record<string, unknown>;
    for (const id of PIDS) { const n = rc[id]; if (typeof n === "number" && n >= 0) oc[id] = Math.floor(n); }
    const rp = row.readyPack as Record<string, unknown> | null;
    const seq = Math.max(typeof row.cardSeq === "number" ? row.cardSeq : 0, collection.reduce((m, c) => Math.max(m, c.seq), 0));
    if (seq > cardSeq) cardSeq = seq;
    const pulls: Record<string, number> = {};
    const rawPulls = row.pulls as Record<string, unknown> | undefined;
    if (rawPulls && typeof rawPulls === "object") { for (const k of Object.keys(rawPulls)) { const n = rawPulls[k]; if (typeof n === "number" && n >= 0) pulls[k] = Math.floor(n); } }
    else { for (const c of collection) { const k = c.packId + "|" + c.rarity; pulls[k] = (pulls[k] ?? 0) + 1; } }
    const sup = new Set<string>(collection.filter((c) => c.rarity === "super").map((c) => c.playerId));
    if (Array.isArray(row.supers)) { for (const s of row.supers as unknown[]) { if (typeof s === "string" && PBYID[s]) sup.add(s); } }
    const balance = typeof row.balance === "number" && row.balance >= 0 ? Math.round(row.balance) : START_BAL;
    return { v: 2, collection, openedCounts: oc, soundOn: row.soundOn !== false, cardSeq: seq, readyPack: rp && isPack(rp.packId) ? { packId: rp.packId } : null, balance, pulls, supers: Array.from(sup), locked: row.locked !== false, meta: loadMeta(row.meta) };
  } catch { return defaultSave(); }
}
// ---- persistence chain: localStorage, sessionStorage, IndexedDB, small cookie, window.name ----
// The canvas kit has no storage hook, so this probes each browser mechanism at runtime and writes to every one that works.
type StoreName = "local" | "session" | "idb" | "cookie" | "name";
let lastStores: StoreName[] = [];
let lastErr = "";
let idbOk = false;
const errName = (e: unknown): string => (e instanceof Error ? e.name : "error");
const toUrl = (c: string): string => c.slice(4).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromUrl = (u: string): string => { let b = u.replace(/-/g, "+").replace(/_/g, "/"); while (b.length % 4) b += "="; return "GL2:" + b; };

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    try {
      const rq = indexedDB.open("gl-legends", 1);
      rq.onupgradeneeded = () => { rq.result.createObjectStore("s"); };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
      rq.onblocked = () => rej(new Error("blocked"));
    } catch (e) { rej(e); }
  });
}
// IndexedDB is read before the first allowed autosave. idbPut also refuses to overwrite a richer save unless force is set.
let idbBoot: Promise<string | null> | null = null;
function idbBootRead(): Promise<string | null> { if (!idbBoot) idbBoot = idbGet(); return idbBoot; }
function idbPut(json: string, force = false): Promise<boolean> {
  return idbBootRead().then((existing) => {
    if (!force && existing) {
      const incoming = loadSave(json), held = loadSave(existing);
      if (saveScore(incoming) < saveScore(held)) { idbOk = true; return true; }
    }
    return idbOpen().then((db) => new Promise<boolean>((res) => {
      const tx = db.transaction("s", "readwrite");
      tx.objectStore("s").put(json, SAVE_KEY);
      tx.oncomplete = () => { idbOk = true; db.close(); res(true); };
      tx.onerror = () => { idbOk = false; db.close(); res(false); };
    }));
  }).catch(() => { idbOk = false; return false; });
}
function idbGet(): Promise<string | null> {
  return idbOpen().then((db) => new Promise<string | null>((res) => {
    const rq = db.transaction("s", "readonly").objectStore("s").get(SAVE_KEY);
    rq.onsuccess = () => { db.close(); res(typeof rq.result === "string" ? rq.result : null); };
    rq.onerror = () => { db.close(); res(null); };
  })).catch(() => null);
}
// Cookies ride along on requests, so only a small save (4 KB or less) goes in one.
function cookieRead(): string | null {
  try {
    const jar = document.cookie;
    const m = jar.match(/(?:^|; )gl2n=(\d+)/);
    if (!m) return null;
    let out = "";
    for (let i = 0; i < Number(m[1]); i++) { const mm = jar.match(new RegExp("(?:^|; )gl2c" + i + "=([^;]*)")); if (!mm) return null; out += mm[1] ?? ""; }
    return out ? fromUrl(out) : null;
  } catch { return null; }
}
function cookieClear(): void {
  try {
    const attrs = "; path=/; max-age=0";
    document.cookie = "gl2n=" + attrs;
    for (let i = 0; i < 3; i++) document.cookie = "gl2c" + i + "=" + attrs;
  } catch { /* ignore */ }
}
function cookieWrite(code: string): boolean {
  try {
    const u = toUrl(code);
    // A too-big write must clear any older, smaller cookie so a stale empty save can't shadow IndexedDB or localStorage on the next load.
    if (u.length > 4000) { cookieClear(); return false; }
    const attrs = "; path=/; max-age=31536000; SameSite=Lax";
    const n = Math.ceil(u.length / 2000);
    for (let i = 0; i < n; i++) document.cookie = "gl2c" + i + "=" + u.slice(i * 2000, (i + 1) * 2000) + attrs;
    document.cookie = "gl2n=" + n + attrs;
    for (let i = n; i < 3; i++) document.cookie = "gl2c" + i + "=; path=/; max-age=0";
    return cookieRead() === code;
  } catch { return false; }
}
let memRaw: string | null = null;
let memSave: Save | null = null;
let lastIdbWrite: Promise<boolean> = Promise.resolve(false);
function readSaved(): string | null {
  const raws: string[] = [];
  const add = (v: string | null | undefined): void => { if (v) raws.push(v); };
  try { add(window.localStorage.getItem(SAVE_KEY)); } catch { /* blocked */ }
  try { add(window.sessionStorage.getItem(SAVE_KEY)); } catch { /* blocked */ }
  add(cookieRead());
  try { if (window.name.startsWith("GLN:")) add(window.name.slice(4)); } catch { /* ignore */ }
  add(memRaw);
  if (raws.length === 0) return null;
  let best: Save | null = null;
  for (const raw of raws) {
    const s = loadSave(raw);
    if (!best || saveScore(s) > saveScore(best)) best = s;
  }
  return best ? JSON.stringify(best) : null;
}
/** Writes to every mechanism that works. True when at least one durable one (local, IndexedDB, cookie) took it. Pass force to allow an explicit reset to overwrite a richer save. */
function writeSave(s: Save, force = false): boolean {
  if (!force && memSave && saveScore(s) < saveScore(memSave)) return lastStores.some((x) => x === "local" || x === "idb" || x === "cookie") || idbOk;
  const ok: StoreName[] = [];
  lastErr = "";
  let compact = "";
  let code = "";
  try { compact = JSON.stringify(compactOf(s)); code = encodeBackup(s); memRaw = JSON.stringify(s); memSave = s; } catch { return false; }
  const put = (store: Storage, name: StoreName): void => {
    try { store.setItem(SAVE_KEY, compact); ok.push(name); } catch (e) {
      try { store.setItem(SAVE_KEY, memRaw ?? compact); ok.push(name); } catch (e2) { if (!lastErr) lastErr = errName(e2); }
    }
  };
  try { put(window.localStorage, "local"); } catch (e) { lastErr = errName(e); }
  try { put(window.sessionStorage, "session"); } catch (e) { if (!lastErr) lastErr = errName(e); }
  lastIdbWrite = idbPut(compact, force);
  if (idbOk) ok.push("idb");
  if (cookieWrite(code)) ok.push("cookie");
  try { window.name = "GLN:" + code; if (window.name === "GLN:" + code) ok.push("name"); } catch { /* ignore */ }
  lastStores = ok;
  return ok.some((x) => x === "local" || x === "idb" || x === "cookie") || idbOk;
}
function legacyCopy(text: string): boolean {
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    el.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch { return false; }
}
function askStorageAccess(): Promise<boolean> {
  try {
    const d = document as Document & { requestStorageAccess?: () => Promise<void> };
    if (typeof d.requestStorageAccess !== "function") return Promise.resolve(false);
    return d.requestStorageAccess().then(() => true).catch(() => false);
  } catch { return Promise.resolve(false); }
}

// ---- backup code: compact base64 of the save ----
function scrubBackup(code: string): string {
  let t = code.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u180E]/g, "").replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'").replace(/[\u201C\u201D\u201E\u201F\u2033]/g, "\"").trim();
  while ((t.startsWith("\"") && t.endsWith("\"")) || (t.startsWith("'") && t.endsWith("'"))) t = t.slice(1, -1).trim();
  return t;
}
function fromB64(s: string): string | null {
  try {
    let b = s.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    const bin = atob(b);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch { return null; }
}
function fullFromRow(c: Record<string, unknown>): string | null {
  if (!c || typeof c !== "object") return null;
  if ((c.v === 2 || c.v === 1) && Array.isArray(c.c) && !Array.isArray(c.collection)) {
    const rows = (c.c as unknown[][]).map((a) => ({ uid: a[0], playerId: a[1], rarity: a[2], packId: a[3], seq: a[4] }));
    return JSON.stringify({ v: 2, collection: rows, openedCounts: c.o, soundOn: c.s !== 0, cardSeq: c.q, balance: c.b, pulls: c.p, supers: c.u, locked: c.l !== 0, readyPack: null, meta: c.m });
  }
  if (c.v === 2 || c.v === 1 || Array.isArray(c.collection)) return JSON.stringify(c);
  return null;
}
function encodeBackup(s: Save): string {
  const bytes = new TextEncoder().encode(JSON.stringify(compactOf(s)));
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return "GL2:" + btoa(bin);
}
function decodeBackup(code: string): string | null {
  try {
    let t = scrubBackup(code);
    if (/^gl2:/i.test(t)) t = t.slice(4).trim();
    const text = t.startsWith("{") ? t : fromB64(t);
    if (!text) return null;
    return fullFromRow(JSON.parse(text) as Record<string, unknown>);
  } catch { return null; }
}
const timeStr = (t: number): string => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// ---- sound: HTML audio WAV first, Web Audio fallback, all wrapped in try/catch ----
type Note = [number, number, number, number];
const RATE = 22050;
let actx: AudioContext | null = null;
let hp: HTMLAudioElement | null = null;
let unlocked = false;
let silent = "";
type SoundId = RarityId | "tear" | "ach" | "daily" | "setdone" | "boom" | "bust";
const wavCache: Partial<Record<SoundId, string>> = {};

// A rising whoosh under each sound: [start Hz, end Hz, seconds, gain]. It grows with the rarity.
type Sweep = [number, number, number, number];
const SWEEP: Partial<Record<SoundId, Sweep>> = {
  base: [300, 900, 0.1, 0.12], silver: [300, 1200, 0.16, 0.14], kings: [250, 900, 0.2, 0.14], walls: [200, 500, 0.16, 0.12], phenom: [400, 1600, 0.22, 0.14],
  gold: [300, 1400, 0.24, 0.16], potw: [300, 1700, 0.32, 0.18], auto: [300, 1800, 0.4, 0.18], super: [200, 2400, 0.7, 0.22],
  tear: [250, 1300, 0.28, 0.2], setdone: [300, 1500, 0.3, 0.14], boom: [150, 2800, 0.55, 0.26], bust: [520, 110, 0.35, 0.14],
};
function spec(r: SoundId): { notes: Note[]; noise: number; sweep?: Sweep } {
  const sweep = SWEEP[r];
  if (r === "tear") return { notes: [], noise: 0.22, sweep };
  if (r === "ach") return { notes: [[880, 0, 0.16, 0.4], [1319, 0.11, 0.36, 0.4]], noise: 0 };
  if (r === "daily") return { notes: [523, 659, 784, 1046].map((f, i): Note => [f, i * 0.1, 0.24, 0.38]), noise: 0 };
  if (r === "setdone") return { notes: [[392, 0, 0.3, 0.38], [523, 0.12, 0.3, 0.38], [659, 0.24, 0.3, 0.38], [784, 0.36, 0.34, 0.38], [1046, 0.5, 0.7, 0.4], [1318, 0.5, 0.7, 0.3]], noise: 0, sweep };
  if (r === "kings") return { notes: [[392, 0, 0.3, 0.38], [494, 0.08, 0.3, 0.36], [587, 0.16, 0.36, 0.36], [784, 0.26, 0.5, 0.34]], noise: 0.05, sweep };
  if (r === "walls") return { notes: [[130, 0, 0.28, 0.5], [196, 0, 0.22, 0.4], [392, 0.12, 0.3, 0.3], [523, 0.2, 0.25, 0.26]], noise: 0.12, sweep };
  if (r === "phenom") return { notes: [[784, 0, 0.14, 0.36], [988, 0.07, 0.14, 0.36], [1175, 0.14, 0.14, 0.36], [1568, 0.21, 0.3, 0.34], [2093, 0.3, 0.3, 0.26]], noise: 0, sweep };
  // Boom or Bust bust: a short, soft sad-trombone slide (four falling notes) over a downward deflate whoosh.
  if (r === "bust") return { notes: [[349, 0, 0.2, 0.3], [330, 0.2, 0.2, 0.3], [311, 0.4, 0.2, 0.3], [294, 0.6, 0.5, 0.3]], noise: 0, sweep };
  // Boom or Bust hit: a deep explosion, a long noise tail and a quick bright fanfare on top.
  if (r === "boom") return { notes: [[48, 0, 1.1, 0.8], [72, 0, 0.9, 0.6], [110, 0.03, 0.6, 0.5], [523, 0.35, 0.3, 0.35], [784, 0.43, 0.3, 0.35], [1046, 0.5, 0.35, 0.35], [1568, 0.58, 0.6, 0.32]], noise: 0.6, sweep };
  const b = specBase(r);
  // The 1/1 gets a low boom under the rising chord.
  return r === "super" ? { notes: b.notes.concat([[55, 0, 0.9, 0.7], [82, 0, 0.7, 0.5]]), noise: b.noise, sweep } : { ...b, sweep };
}
function specBase(r: RarityId): { notes: Note[]; noise: number } {
  if (r === "base") return { notes: [[1040, 0, 0.07, 0.42]], noise: 0.04 };
  if (r === "silver") return { notes: [[980, 0, 0.18, 0.4], [1470, 0.05, 0.16, 0.32]], noise: 0 };
  if (r === "gold") return { notes: [[523, 0, 0.24, 0.4], [784, 0.07, 0.26, 0.38], [1046, 0.14, 0.3, 0.36]], noise: 0 };
  if (r === "potw") return { notes: [[659, 0, 0.22, 0.4], [880, 0.1, 0.22, 0.4], [1175, 0.2, 0.3, 0.4], [1319, 0.3, 0.4, 0.38], [1760, 0.4, 0.5, 0.34]], noise: 0 };
  if (r === "auto") return { notes: [523, 659, 784, 1046].map((f, i): Note => [f, i * 0.08, 0.3, 0.42]).concat([[1318, 0.34, 0.42, 0.38]]), noise: 0 };
  const notes: Note[] = [];
  [392, 523, 659, 784, 1046, 1318, 1568].forEach((f, i) => { notes.push([f, i * 0.09, 0.48, 0.32], [f * 2, i * 0.09, 0.36, 0.22]); });
  return { notes, noise: 0.2 };
}
function wav(s: Float32Array): string {
  const n = s.length;
  const v = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o: number, t: string): void => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-0.95, Math.min(0.95, s[i] ?? 0)) * 0x7fff), true);
  const bytes = new Uint8Array(v.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
  return "data:audio/wav;base64," + btoa(bin);
}
function rarityWav(r: SoundId): string {
  const hit = wavCache[r];
  if (hit) return hit;
  const { notes, noise, sweep } = spec(r);
  const end = Math.max(noise, sweep ? sweep[2] : 0, ...notes.map((nt) => nt[1] + nt[2])) + 0.05;
  const s = new Float32Array(Math.ceil(end * RATE));
  const att = Math.floor(0.012 * RATE);
  for (const [f, st, d, g] of notes) {
    const a = Math.floor(st * RATE), n = Math.floor(d * RATE);
    for (let i = 0; i < n && a + i < s.length; i++) { const rel = 1 - i / n; s[a + i] = (s[a + i] ?? 0) + Math.sin((2 * Math.PI * f * i) / RATE) * g * Math.min(1, i / att) * rel * rel; }
  }
  if (sweep) {
    const [f0, f1, d, g] = sweep, n = Math.floor(d * RATE);
    let ph = 0;
    for (let i = 0; i < n && i < s.length; i++) { const x = i / n; ph += (2 * Math.PI * (f0 + (f1 - f0) * x * x)) / RATE; s[i] = (s[i] ?? 0) + (Math.sin(ph) * 0.55 + (Math.random() * 2 - 1) * 0.45) * g * Math.pow(Math.sin(Math.PI * x), 1.4); }
  }
  const nn = Math.floor(noise * RATE);
  for (let i = 0; i < nn && i < s.length; i++) s[i] = (s[i] ?? 0) + (Math.random() * 2 - 1) * 0.17 * (1 - i / nn);
  const uri = wav(s);
  wavCache[r] = uri;
  return uri;
}
function setSession(): void { try { const s = (navigator as Navigator & { audioSession?: { type: string } }).audioSession; if (s) s.type = "playback"; } catch { /* ignore */ } }
function getCtx(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const C = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    if (!actx) actx = new C();
    return actx;
  } catch { return null; }
}
function getEl(): HTMLAudioElement | null {
  try {
    if (typeof Audio === "undefined") return null;
    if (!hp) { hp = new Audio(); hp.preload = "auto"; hp.setAttribute("playsinline", "true"); }
    return hp;
  } catch { return null; }
}
/** Runs synchronously inside a tap. Never throws, never preventDefault. */
function unlockAudio(): void {
  try {
    setSession();
    const c = getCtx();
    if (c) {
      if (c.state !== "running") void c.resume().catch(() => undefined);
      try { const src = c.createBufferSource(); src.buffer = c.createBuffer(1, 1, c.sampleRate || RATE); src.connect(c.destination); src.start(0); } catch { /* ignore */ }
    }
    const el = getEl();
    if (el && !unlocked) {
      if (!silent) silent = wav(new Float32Array(1));
      el.src = silent;
      el.volume = 0.05;
      const p = el.play();
      if (p) void p.then(() => { el.pause(); el.volume = 1; unlocked = true; }).catch(() => undefined);
    }
  } catch { /* never block pack opening */ }
}
function playWA(c: AudioContext, r: SoundId): void {
  try {
    const t = c.currentTime;
    const { notes, noise, sweep } = spec(r);
    if (sweep) {
      const o = c.createOscillator(), a = c.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(sweep[0], t);
      o.frequency.exponentialRampToValueAtTime(sweep[1], t + sweep[2]);
      a.gain.setValueAtTime(0.0001, t);
      a.gain.exponentialRampToValueAtTime(sweep[3] * 0.5, t + sweep[2] * 0.6);
      a.gain.exponentialRampToValueAtTime(0.0001, t + sweep[2]);
      o.connect(a); a.connect(c.destination); o.start(t); o.stop(t + sweep[2] + 0.02);
    }
    for (const [f, st, d, g] of notes) {
      const o = c.createOscillator(), a = c.createGain();
      o.type = r === "base" || r === "silver" ? "sine" : "triangle";
      o.frequency.value = f;
      a.gain.setValueAtTime(0.0001, t + st);
      a.gain.exponentialRampToValueAtTime(g, t + st + 0.02);
      a.gain.exponentialRampToValueAtTime(0.0001, t + st + d);
      o.connect(a); a.connect(c.destination); o.start(t + st); o.stop(t + st + d + 0.02);
    }
    if (noise > 0) {
      const len = Math.max(1, Math.floor(c.sampleRate * noise));
      const b = c.createBuffer(1, len, c.sampleRate);
      const dd = b.getChannelData(0);
      for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.2;
      const src = c.createBufferSource(); src.buffer = b; src.connect(c.destination); src.start(t);
    }
  } catch { /* ignore */ }
}
function playSound(r: SoundId, on: boolean, layer = false): void {
  if (!on) return;
  try {
    setSession();
    const c = getCtx();
    // Layered sounds (achievements, daily, sets) ride on Web Audio so they never cut off a reveal sound.
    if (layer && c && c.state === "running") { playWA(c, r); return; }
    if (c && c.state !== "running") void c.resume().catch(() => undefined);
    const fallback = (): void => { const k = getCtx(); if (k) playWA(k, r); };
    let uri = "";
    try { uri = rarityWav(r); } catch { uri = ""; }
    const el = getEl();
    if (el && uri) {
      el.pause(); el.src = uri; el.volume = 0.9;
      try { el.currentTime = 0; } catch { /* ignore */ }
      const p = el.play();
      if (p) void p.catch(fallback);
    } else fallback();
  } catch { /* never block the reveal */ }
}

// ---- team reveal effects: sounds (Web Audio only, layered over the rarity sound, no files) ----
type TeamMotif = "star" | "bolt" | "wave" | "wing" | "burst";
function teamMotifOf(abbr: string): TeamMotif {
  return abbr === "DAL" ? "star" : abbr === "LAC" ? "bolt" : abbr === "MIA" ? "wave" : abbr === "PHI" ? "wing" : "burst";
}
function playTeam(team: Team, on: boolean, rarity: RarityId): void {
  if (!on) return;
  try {
    const c = getCtx();
    if (!c) return;
    if (c.state !== "running") { void c.resume().catch(() => undefined); return; }
    const t0 = c.currentTime, motif = teamMotifOf(team.abbr);
    const big = rarity === "gold" || rarity === "potw" || rarity === "auto" || rarity === "super";
    const g = big ? 0.2 : 0.13;
    const len = Math.max(1, Math.floor(c.sampleRate * 0.26));
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(), flt = c.createBiquadFilter(), ag = c.createGain();
    src.buffer = buf; flt.type = "bandpass"; flt.frequency.setValueAtTime(motif === "bolt" ? 2200 : 700, t0); flt.frequency.exponentialRampToValueAtTime(motif === "wave" ? 400 : 1600, t0 + 0.22);
    ag.gain.setValueAtTime(0.0001, t0); ag.gain.exponentialRampToValueAtTime(g, t0 + 0.018); ag.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
    src.connect(flt); flt.connect(ag); ag.connect(c.destination); src.start(t0); src.stop(t0 + 0.28);
    const beep = (f0: number, f1: number, st: number, dur: number, gain: number, typ: OscillatorType): void => {
      const o = c.createOscillator(), a = c.createGain();
      o.type = typ; o.frequency.setValueAtTime(f0, t0 + st); o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + st + dur);
      a.gain.setValueAtTime(0.0001, t0 + st); a.gain.exponentialRampToValueAtTime(gain, t0 + st + 0.012); a.gain.exponentialRampToValueAtTime(0.0001, t0 + st + dur);
      o.connect(a); a.connect(c.destination); o.start(t0 + st); o.stop(t0 + st + dur + 0.02);
    };
    if (motif === "star") { beep(523, 784, 0, 0.22, g, "triangle"); beep(784, 1046, 0.1, 0.28, g * 0.8, "triangle"); }
    else if (motif === "bolt") { beep(1800, 220, 0, 0.12, g * 1.1, "sawtooth"); beep(90, 50, 0.05, 0.35, g * 0.7, "sine"); }
    else if (motif === "wave") { beep(220, 440, 0, 0.3, g * 0.7, "sine"); beep(330, 262, 0.14, 0.32, g * 0.6, "sine"); }
    else if (motif === "wing") { beep(196, 392, 0, 0.28, g * 0.75, "triangle"); beep(392, 294, 0.16, 0.3, g * 0.6, "triangle"); }
    else { beep(392, 587, 0, 0.2, g, "triangle"); beep(587, 523, 0.12, 0.22, g * 0.7, "triangle"); }
  } catch { /* never block the reveal */ }
}

// ---- effects ----
const SPARK = ["#ffd24a", "#fff6d0", "#ff4d6d", "#3dc6ff", "#3dff8a", "#c44dff", "#ffffff"];
const SILVER = ["#f4f8ff", "#c8d4e0", "#9aabb8", "#ffffff", "#dce6f0"];
const GOLDP = ["#ffe27a", "#fff6c8", "#ffbf3a", "#ffffff", "#e09a16"];
const PUFF = ["#ffffff", "#f7f4ea", "#ece7dc"];
const ABS: CSSProperties = { position: "absolute", pointerEvents: "none" };

function Burst(p: { kind: "spark" | "confetti" | "puff"; seed: string; count: number; colors?: string[] }): ReactNode {
  const reduce = rm(), s = hashStr(p.seed), cf = p.kind === "confetti", pf = p.kind === "puff";
  let n = reduce ? Math.max(4, Math.floor(p.count * 0.45)) : p.count;
  if (typeof window !== "undefined" && window.innerWidth < 520) n = Math.max(4, Math.ceil(n * 0.72));
  const k = reduce ? 0.5 : 1;
  const cols = p.colors ?? (pf ? PUFF : SPARK);
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const a = hu(s, i) * Math.PI * 2;
    const d = ((cf ? 70 : pf ? 22 : 40) + hu(s, i + 19) * (cf ? 150 : pf ? 36 : 80)) * k;
    const size = (cf || pf ? 6 : 4) + hu(s, i + 3) * (cf ? 6 : pf ? 5 : 4);
    out.push(<div key={i} style={{
      ...ABS, left: "50%", top: "50%", width: size, height: cf ? size * 0.55 + 6 : size, borderRadius: cf ? 1 : "50%", background: cols[i % cols.length] ?? "#fff", opacity: pf ? 0.85 : 1,
      animation: (cf ? "glConfetti " : pf ? "glPuff " : "glSpark ") + (reduce ? "0.45s" : cf ? "1.25s" : pf ? "0.75s" : "0.95s") + " ease-out forwards",
      animationDelay: hu(s, i + 23) * (pf ? 0.04 : 0.1) + "s",
      ["--dx" as string]: Math.cos(a) * d + "px", ["--dy" as string]: Math.sin(a) * d - (cf ? 48 : pf ? 10 : 0) * k + "px", ["--rot" as string]: hu(s, i + 11) * 520 - 260 + "deg",
    } as CSSProperties} />);
  }
  return <>{out}</>;
}

function Rise(p: { seed: string; count: number }): ReactNode {
  const reduce = rm(), s = hashStr(p.seed);
  const n = reduce ? Math.max(5, Math.floor(p.count * 0.5)) : p.count;
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const size = 4 + hu(s, i + 3) * 6, color = SPARK[i % SPARK.length] ?? "#fff";
    out.push(<div key={i} style={{ ...ABS, left: 18 + hu(s, i) * 64 + "%", bottom: "8%", width: size, height: size, borderRadius: "50%", background: color, boxShadow: "0 0 8px " + color, animation: "glRise " + (reduce ? 0.7 : 1.4 + hu(s, i + 15) * 0.6) + "s ease-out infinite", animationDelay: hu(s, i + 9) * (reduce ? 0.4 : 0.9) + "s" }} />);
  }
  return <>{out}</>;
}

const ring = (key: string, size: number, border: string, anim: string, d: string, delay = 0): ReactNode => (
  <div key={key} style={{ ...ABS, left: "50%", top: "46%", width: size, height: size, borderRadius: "50%", border, animation: anim + " " + d + " ease-out forwards", animationDelay: delay + "s" }} />
);
const disc = (size: number, bg: string, anim: string): ReactNode => (
  <div style={{ ...ABS, left: "50%", top: "46%", width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, borderRadius: "50%", background: bg, animation: anim }} />
);

const WASH: Record<RarityId, string> = {
  base: "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.72), rgba(236,236,236,0.28) 42%, transparent 74%)",
  silver: "radial-gradient(circle at 50% 42%, rgba(220,232,245,0.82), rgba(140,160,180,0.4) 46%, rgba(80,100,120,0.18) 70%, transparent 82%)",
  gold: "radial-gradient(circle at 50% 42%, rgba(255,232,140,0.88), rgba(230,150,30,0.42) 48%, rgba(80,40,0,0.16) 74%, transparent 86%)",
  kings: "radial-gradient(circle at 50% 42%, rgba(224,200,255,0.82), rgba(130,80,230,0.38) 48%, transparent 80%)",
  walls: "radial-gradient(circle at 50% 42%, rgba(200,244,255,0.82), rgba(30,170,205,0.38) 48%, transparent 80%)",
  phenom: "radial-gradient(circle at 50% 42%, rgba(255,226,196,0.85), rgba(255,120,40,0.4) 48%, transparent 80%)",
  potw: "radial-gradient(circle at 50% 42%, rgba(214,255,232,0.9), rgba(40,235,130,0.48) 46%, rgba(4,70,38,0.2) 72%, transparent 86%)",
  auto: "radial-gradient(circle at 50% 40%, rgba(180,255,230,0.7), rgba(80,180,255,0.38) 38%, rgba(200,80,255,0.28) 62%, transparent 84%)",
  super: "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.7), rgba(200,90,255,0.5) 32%, rgba(40,0,70,0.42) 64%, transparent 86%)",
};
const RAYS: Partial<Record<RarityId, [string, string, number, number]>> = {
  gold: ["rgba(255,210,70,0) 0deg, rgba(255,230,140,0.7) 7deg, rgba(255,210,70,0) 14deg", "7s", 560, 0.85],
  potw: ["rgba(40,235,130,0) 0deg, rgba(120,255,190,0.7) 6deg, rgba(40,235,130,0) 12deg", "6s", 600, 0.85],
  auto: ["rgba(255,80,140,0) 0deg, rgba(255,90,140,0.65) 5deg, rgba(80,255,180,0) 10deg, rgba(80,200,255,0.65) 15deg, rgba(200,80,255,0) 20deg", "5.5s", 620, 0.8],
  super: ["rgba(255,80,140,0) 0deg, rgba(255,80,140,0.8) 4deg, rgba(255,200,60,0) 8deg, rgba(60,255,160,0.8) 12deg, rgba(60,180,255,0) 16deg, rgba(180,80,255,0.85) 20deg, rgba(255,80,140,0) 24deg", "4.2s", 680, 0.9],
};

function burstFx(r: RarityId, seed: string): ReactNode {
  if (r === "base") return <>{ring("a", 160, "3px solid rgba(255,255,255,0.9)", "glRipple", sp("0.85s", "0.45s"))}{ring("b", 160, "2px solid rgba(255,255,255,0.5)", "glRipple", sp("1.05s", "0.55s"), 0.08)}<Burst kind="puff" seed={seed} count={10} /></>;
  if (r === "silver") return <>{ring("a", 150, "2px solid rgba(220,232,245,0.9)", "glBurstRing", sp("0.8s", "0.45s"))}<Burst kind="spark" seed={seed} count={18} colors={SILVER} /></>;
  if (r === "gold") return <>{disc(220, "radial-gradient(circle, rgba(255,240,180,0.9), rgba(255,200,60,0.35) 46%, transparent 70%)", "glFlashHard " + sp("0.9s", "0.5s") + " ease forwards")}<Burst kind="spark" seed={seed} count={24} colors={GOLDP} /></>;
  if (r === "kings" || r === "walls" || r === "phenom") { const c = INSERT_FX[r] ?? []; return <>{ring("a", 130, "3px solid " + (c[0] ?? "#fff"), "glBurstRing", sp("0.9s", "0.5s"))}{ring("b", 110, "2px solid " + (c[1] ?? "#fff"), "glBurstRing", sp("1.1s", "0.6s"), 0.1)}<Burst kind="spark" seed={seed} count={20} colors={c.slice(2)} /></>; }
  if (r === "potw") return <>{disc(240, "radial-gradient(circle, rgba(220,255,236,0.95), rgba(40,235,130,0.45) 46%, transparent 70%)", "glFlashHard " + sp("0.9s", "0.5s") + " ease forwards")}{ring("a", 140, "4px solid rgba(60,240,140,0.95)", "glBurstRing", sp("1s", "0.5s"))}{ring("b", 140, "3px solid rgba(220,255,236,0.9)", "glBurstRing", sp("1.2s", "0.6s"), 0.1)}<Burst kind="confetti" seed={seed + "c"} count={30} colors={POTWP} /><Burst kind="spark" seed={seed + "s"} count={18} colors={POTWP} /><div style={{ ...ABS, left: "50%", top: "46%", fontSize: 60, lineHeight: 1, animation: "glTrophy " + sp("1.3s", "0.7s") + " ease-out forwards" }}>🏆</div></>;
  if (r === "auto") return <>{ring("a", 130, "4px solid rgba(120,255,220,0.9)", "glBurstRing", sp("0.95s", "0.5s"))}{ring("b", 130, "3px solid rgba(80,180,255,0.8)", "glBurstRing", sp("1.15s", "0.6s"), 0.1)}<Burst kind="spark" seed={seed + "s"} count={22} /><Burst kind="confetti" seed={seed + "c"} count={20} /></>;
  return (
    <>
      <div style={{ ...ABS, inset: -24, borderRadius: 20, background: "#fff", animation: "glFlashHard " + sp("0.7s", "0.4s") + " ease forwards" }} />
      {ring("a", 150, "5px solid rgba(255,210,80,0.95)", "glBurstRing", sp("1s", "0.55s"))}
      {ring("b", 150, "4px solid rgba(196,77,255,0.9)", "glBurstRing", sp("1.2s", "0.65s"), 0.1)}
      {ring("c", 150, "3px solid rgba(60,200,255,0.85)", "glBurstRing", sp("1.35s", "0.7s"), 0.2)}
      <Burst kind="spark" seed={seed + "s"} count={20} />
      <Burst kind="confetti" seed={seed + "c"} count={32} />
    </>
  );
}

function Backdrop(p: { r: RarityId; charged: boolean; burst: boolean; token: number }): ReactNode {
  const ry = RAYS[p.r];
  const seed = String(p.token) + p.r;
  return (
    <div style={{ ...ABS, inset: 0, zIndex: 0 }}>
      <div style={{ ...ABS, inset: 0, borderRadius: 18, background: WASH[p.r], animation: "glWashIn " + sp("0.4s", "0.25s") + " ease both" }} />
      {ry ? <div style={{ ...ABS, left: "50%", top: "46%", width: ry[2], height: ry[2], marginLeft: -ry[2] / 2, marginTop: -ry[2] / 2, borderRadius: "50%", background: "repeating-conic-gradient(from 0deg, " + ry[0] + ")", animation: "glSpinRays " + sp(ry[1], "10s") + " linear infinite, glRayPulse " + sp("1.4s", "2.4s") + " ease-in-out infinite", mixBlendMode: "screen", opacity: ry[3] }} /> : null}
      {p.charged ? <>{disc(p.r === "super" ? 280 : 220, p.r === "super" ? "radial-gradient(circle, rgba(255,255,255,0.55), rgba(200,80,255,0.45) 40%, transparent 70%)" : "radial-gradient(circle, rgba(255,240,180,0.45), transparent 70%)", "glCardCharge " + sp("0.55s", "0.8s") + " ease-in-out infinite")}{p.r === "super" ? <Rise seed={seed + "c"} count={14} /> : null}</> : null}
      {p.burst ? burstFx(p.r, seed) : null}
    </div>
  );
}

// ---- team reveal effects: visuals (CSS and inline SVG, transform/opacity only, short) ----
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
}
function teamScale(r: RarityId): number {
  if (r === "base" || r === "silver") return 0.7;
  if (r === "gold" || r === "potw" || r === "auto" || r === "super") return 1.2;
  return 0.9;
}
function teamDur(r: RarityId): number {
  if (r === "base" || r === "silver") return 1.05;
  if (r === "gold" || r === "potw" || r === "auto" || r === "super") return 1.45;
  return 1.25;
}
function TeamFx(p: { team: Team; rarity: RarityId; token: number }): ReactNode {
  const t = p.team, calm = rm(), k = teamScale(p.rarity), dur = teamDur(p.rarity);
  const fill: CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 };
  const motif = teamMotifOf(t.abbr);
  const s = hashStr("tm" + t.abbr + p.token);
  const small = typeof window !== "undefined" && window.innerWidth < 520;
  const cnt = (n: number): number => Math.max(4, Math.round(n * k * (small ? 0.7 : 1)));
  const ink = lum(t.secondary) >= lum(t.primary) ? t.secondary : t.primary;
  const edge = ink === t.secondary ? t.primary : t.secondary;
  const word = lum(ink) > 0.35 ? ink : "#ffffff";
  const stroke = lum(edge) < 0.55 ? edge : "#101418";
  const wrap = (kids: ReactNode): ReactNode => (
    <div aria-hidden="true" data-gl-team={t.abbr} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 89, pointerEvents: "none", overflow: "hidden", willChange: "opacity" }}>{kids}</div>
  );
  const wash = <div style={{ ...fill, background: "radial-gradient(circle at 50% 46%, " + hexA(t.secondary, 0.42) + ", " + hexA(t.primary, 0.38) + " 55%, " + hexA(t.primary, 0) + " 82%)", animation: (calm ? "glTeamSoft " : "glTeamFlash ") + dur + "s ease-out forwards" }} />;
  if (calm) {
    return wrap(<><div style={{ ...fill, background: hexA(t.primary, 0.4), animation: "glTeamSoft " + dur + "s ease-out forwards" }} /><div style={{ position: "absolute", left: "50%", top: "42%", transform: "translate(-50%,-50%)", fontSize: "min(" + (12 * k) + "vmin, " + (80 * k) + "px)", fontWeight: 900, fontStyle: "italic", letterSpacing: 3, color: word, opacity: 0.7, animation: "glTeamSoft " + dur + "s ease-out forwards" }}>{t.abbr}</div></>);
  }
  const streaks: ReactNode[] = [];
  const n = cnt(8);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hu(s, i) * 0.35;
    const len = (70 + hu(s, i + 5) * 90) * k;
    const thick = (3 + hu(s, i + 9) * 4) * (0.8 + k * 0.3);
    const d = (90 + hu(s, i + 13) * 140) * k;
    streaks.push(<div key={"st" + i} style={{ ...ABS, left: "50%", top: "46%", width: len, height: thick, borderRadius: 99, background: i % 2 === 0 ? t.primary : t.secondary, boxShadow: "0 0 8px " + hexA(i % 2 === 0 ? t.secondary : t.primary, 0.7), animation: "glTeamStreak " + dur + "s ease-out both", animationDelay: hu(s, i + 17) * 0.08 + "s", ["--dx" as string]: Math.cos(a) * d + "px", ["--dy" as string]: Math.sin(a) * d + "px", ["--rot" as string]: (a * 180 / Math.PI) + "deg" } as CSSProperties} />);
  }
  let motifNode: ReactNode = null;
  const svgBox: CSSProperties = { ...ABS, left: "50%", top: "46%", width: 220 * k, height: 220 * k, marginLeft: -110 * k, marginTop: -110 * k, overflow: "visible" };
  if (motif === "star") {
    motifNode = <svg viewBox="0 0 100 100" aria-hidden="true" style={{ ...svgBox, animation: "glTeamStar " + dur + "s ease-out both" }}><polygon points="50,6 61,38 95,38 68,58 78,92 50,72 22,92 32,58 5,38 39,38" fill={t.secondary} stroke={t.primary} strokeWidth="2" strokeLinejoin="round" /></svg>;
  } else if (motif === "bolt") {
    motifNode = <svg viewBox="0 0 100 100" aria-hidden="true" style={{ ...svgBox, animation: "glTeamBolt " + dur + "s linear both" }}><path d="M58 4 L28 48 H50 L36 96 L78 42 H54 Z" fill={t.secondary} stroke={t.primary} strokeWidth="2" strokeLinejoin="round" /><path d="M70 8 L48 40 H62 L52 78 L86 38 H68 Z" fill="none" stroke={t.secondary} strokeWidth="2" opacity="0.8" /></svg>;
  } else if (motif === "wave") {
    motifNode = <svg viewBox="0 0 200 80" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ ...ABS, left: "50%", top: "58%", width: 360 * k, height: 90 * k, marginLeft: -180 * k, marginTop: -45 * k, animation: "glTeamWave " + dur + "s ease-out both" }}><path d="M0 40 Q25 10 50 40 T100 40 T150 40 T200 40" fill="none" stroke={t.primary} strokeWidth="7" strokeLinecap="round" /><path d="M0 52 Q25 28 50 52 T100 52 T150 52 T200 52" fill="none" stroke={t.secondary} strokeWidth="5" strokeLinecap="round" opacity="0.9" /></svg>;
  } else if (motif === "wing") {
    motifNode = <svg viewBox="0 0 200 100" aria-hidden="true" style={{ ...ABS, left: "50%", top: "46%", width: 420 * k, height: 160 * k, marginLeft: -210 * k, marginTop: -80 * k, animation: "glTeamWing " + dur + "s ease-out both" }}><path d="M100 52 C78 40 48 44 12 28 C40 42 52 22 78 32 C62 16 78 8 100 22 C94 32 96 44 100 52Z" fill={t.primary} stroke={t.secondary} strokeWidth="2" /><path d="M100 52 C122 40 152 44 188 28 C160 42 148 22 122 32 C138 16 122 8 100 22 C106 32 104 44 100 52Z" fill={t.primary} stroke={t.secondary} strokeWidth="2" /></svg>;
  }
  const fs = "min(" + (20 * k) + "vmin, " + (130 * k) + "px)";
  return wrap(<>{wash}{streaks}{motifNode}<div style={{ position: "absolute", left: "50%", top: "42%", fontSize: fs, fontWeight: 900, fontStyle: "italic", letterSpacing: 4, lineHeight: 1, color: word, textShadow: "0 0 18px " + hexA(stroke, 0.8) + ", 0 3px 0 " + stroke, animation: "glTeamText " + dur + "s ease-out both", fontFamily: "Impact, Haettenschweiler, 'Arial Black', sans-serif" }}>{t.abbr}</div></>);
}

// Full-viewport pull effect: fixed overlay tinted to the rarity, fades out, never intercepts taps.
const SCREEN_TINT: Record<RarityId, { bg: string; edge: string; spread: string; dur: number }> = {
  base: { bg: "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.45), rgba(255,255,255,0.1) 60%, rgba(255,255,255,0) 85%)", edge: "rgba(255,255,255,0.2)", spread: "0 0 70px 20px", dur: 1.15 },
  silver: { bg: "radial-gradient(circle at 50% 45%, rgba(225,236,248,0.7), rgba(150,172,195,0.38) 55%, rgba(90,110,130,0.2) 100%)", edge: "rgba(210,225,240,0.55)", spread: "0 0 80px 26px", dur: 1.5 },
  gold: { bg: "radial-gradient(circle at 50% 45%, rgba(255,240,170,0.92), rgba(255,196,60,0.62) 50%, rgba(255,140,0,0.34) 100%)", edge: "rgba(255,200,70,0.85)", spread: "0 0 110px 40px", dur: 1.8 },
  kings: { bg: "radial-gradient(circle at 50% 45%, rgba(230,210,255,0.78), rgba(140,90,240,0.45) 55%, rgba(40,10,90,0.3) 100%)", edge: "rgba(170,120,255,0.75)", spread: "0 0 90px 30px", dur: 1.6 },
  walls: { bg: "radial-gradient(circle at 50% 45%, rgba(210,246,255,0.78), rgba(40,180,215,0.45) 55%, rgba(6,50,70,0.3) 100%)", edge: "rgba(60,200,235,0.75)", spread: "0 0 90px 30px", dur: 1.6 },
  phenom: { bg: "radial-gradient(circle at 50% 45%, rgba(255,232,205,0.8), rgba(255,130,50,0.45) 55%, rgba(90,30,0,0.3) 100%)", edge: "rgba(255,150,70,0.8)", spread: "0 0 90px 30px", dur: 1.6 },
  potw: { bg: "radial-gradient(circle at 50% 45%, rgba(214,255,232,0.9), rgba(40,235,130,0.58) 46%, rgba(4,70,38,0.5) 100%)", edge: "rgba(60,255,150,0.9)", spread: "0 0 120px 44px", dur: 2.1 },
  auto: { bg: "radial-gradient(circle at 50% 45%, rgba(190,255,235,0.8), rgba(80,190,255,0.5) 42%, rgba(210,90,255,0.4) 100%)", edge: "rgba(120,255,220,0.8)", spread: "0 0 110px 40px", dur: 2.4 },
  super: { bg: "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.9), rgba(210,100,255,0.6) 38%, rgba(30,0,60,0.55) 100%)", edge: "rgba(255,120,220,0.9)", spread: "0 0 130px 50px", dur: 3 },
};
function ScreenFx(p: { r: RarityId; token: number; dal: boolean; boom?: boolean; bust?: boolean }): ReactNode {
  const t = SCREEN_TINT[p.r], ry = RAYS[p.r], calm = rm();
  const anim = (calm ? "glScreenSoft " : "glScreenFlash ") + t.dur + "s ease-out forwards";
  const fill: CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 };
  return (
    <div key={p.token} aria-hidden="true" data-gl-screenfx={p.r} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 90, pointerEvents: "none", overflow: "hidden", willChange: "opacity" }}>
      <div style={{ ...fill, background: p.bust ? "radial-gradient(circle at 50% 50%, rgba(150,150,158,0.62), rgba(60,16,22,0.62) 70%, rgba(20,4,8,0.7) 100%)" : t.bg, boxShadow: "inset " + (p.bust ? "0 0 90px 30px rgba(70,0,12,0.75)" : t.spread + " " + t.edge), animation: anim }} />
      {p.bust ? <div style={{ position: "absolute", left: "50%", top: "45%", transform: "translate(-50%,-50%)", fontSize: calm ? "min(16vmin, 90px)" : "min(30vmin, 190px)", fontWeight: 900, fontStyle: "italic", letterSpacing: 4, lineHeight: 1, color: "#d9d9de", textShadow: "0 4px 0 #3a0a10, 0 0 24px rgba(0,0,0,0.6)", animation: (calm ? "glScreenSoft 1.2s" : "glDeflate 1.3s") + " ease-out forwards" }}>BUST</div> : null}
      {ry && !calm ? <div style={{ position: "absolute", left: "50%", top: "45%", width: "150vmax", height: "150vmax", marginLeft: "-75vmax", marginTop: "-75vmax", borderRadius: "50%", background: "repeating-conic-gradient(from 0deg, " + ry[0] + ")", animation: "glSpinRays " + ry[1] + " linear infinite, glScreenRays " + t.dur + "s ease-out forwards" }} /> : null}
      {p.r === "super" && !calm ? <div style={{ ...fill, background: "#ffffff", animation: "glScreenWhite 0.9s ease-out forwards" }} /> : null}
      {p.boom ? <div style={{ ...fill, background: "radial-gradient(circle at 50% 45%, rgba(255,244,176,0.95), rgba(255,90,20,0.72) 34%, rgba(120,0,8,0.62) 100%)", animation: calm ? anim : "glScreenWhite 1.2s ease-out forwards" }} /> : null}
      {p.boom && !calm ? <><div style={{ position: "absolute", left: "50%", top: "45%", width: 0, height: 0, transform: "scale(3.2)" }}><Burst kind="spark" seed={"sb" + p.token} count={44} colors={BOOMP} /></div><div style={{ position: "absolute", left: "50%", top: "45%", fontSize: "min(52vmin, 320px)", lineHeight: 1, animation: "glTrophy 1.7s ease-out forwards" }}>💥</div></> : null}
      {p.r === "potw" && !calm ? <><div style={{ position: "absolute", left: "50%", top: "45%", width: 0, height: 0, transform: "scale(2.6)" }}><Burst kind="confetti" seed={"sc" + p.token} count={36} colors={POTWP} /></div><div style={{ position: "absolute", left: "50%", top: "45%", fontSize: "min(34vmin, 200px)", lineHeight: 1, animation: "glTrophy 1.7s ease-out forwards" }}>🏆</div></> : null}
      {p.dal ? <div style={{ ...fill, background: "radial-gradient(circle at 50% 45%, rgba(4,30,66,0) 30%, rgba(4,30,66,0.55) 100%)", boxShadow: "inset 0 0 70px 18px rgba(134,147,151,0.75)", animation: anim }} /> : null}
    </div>
  );
}

const CSS = `
@keyframes glIdleWobble{0%,100%{transform:rotate(-1.1deg) translateY(0)}50%{transform:rotate(1.3deg) translateY(-3px)}}
@keyframes glTearL{to{transform:translate(-18%,-8%) rotate(-18deg);opacity:0}}
@keyframes glTearR{to{transform:translate(18%,8%) rotate(16deg);opacity:0}}
@keyframes glDeal{from{transform:translateY(16px) scale(.86);opacity:0}to{transform:none;opacity:1}}
@keyframes glGlowPulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.18)}}
@keyframes glRainbow{to{background-position:200% 0}}
@keyframes glShimmer{0%{background-position:-120% 0}100%{background-position:220% 0}}
@keyframes glHoloSweep{0%{background-position:-140% 0}100%{background-position:240% 0}}
@keyframes glFoilDrift{0%{background-position:0% 50%}100%{background-position:200% 50%}}
@keyframes glPrism{0%{background-position:0% 0%}100%{background-position:200% 100%}}
@keyframes glGoldGlow{0%,100%{box-shadow:0 0 10px rgba(240,196,64,.5),0 0 20px rgba(240,196,64,.22)}50%{box-shadow:0 0 20px rgba(255,220,100,.95),0 0 36px rgba(240,196,64,.5)}}
@keyframes glPopShake{0%,100%{transform:scale(1) rotate(0)}25%{transform:scale(1.08) rotate(-3deg)}50%{transform:scale(1.12) rotate(3deg)}75%{transform:scale(1.04) rotate(-1.5deg)}}
@keyframes glCardCharge{0%,100%{box-shadow:0 0 8px rgba(210,120,255,.4);filter:brightness(1)}50%{box-shadow:0 0 28px rgba(210,120,255,1),0 0 48px rgba(80,180,255,.75);filter:brightness(1.28)}}
@keyframes glPackCharge{0%,100%{box-shadow:0 0 14px rgba(210,120,255,.4)}50%{box-shadow:0 0 38px rgba(255,80,200,.95),0 0 64px rgba(80,180,255,.8)}}
@keyframes glScreenShake{0%,100%{transform:translate(0,0)}20%{transform:translate(-6px,3px)}40%{transform:translate(7px,-4px)}60%{transform:translate(-5px,-2px)}80%{transform:translate(5px,3px)}}
@keyframes glBigShake{0%,100%{transform:translate(0,0) rotate(0)}12%{transform:translate(-12px,7px) rotate(-1.4deg)}28%{transform:translate(14px,-9px) rotate(1.5deg)}44%{transform:translate(-11px,-6px) rotate(-1deg)}60%{transform:translate(11px,6px) rotate(.8deg)}76%{transform:translate(-7px,3px) rotate(-.4deg)}}
@keyframes glSpark{0%{transform:translate(-50%,-50%) scale(.35);opacity:0}18%{opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(0);opacity:0}}
@keyframes glConfetti{0%{transform:translate(-50%,-50%) rotate(0);opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(var(--rot));opacity:0}}
@keyframes glPuff{0%{transform:translate(-50%,-50%) scale(.4);opacity:.7}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.85);opacity:0}}
@keyframes glBurstRing{0%{transform:translate(-50%,-50%) scale(.15);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.6);opacity:0}}
@keyframes glRipple{0%{transform:translate(-50%,-50%) scale(.25);opacity:.5}100%{transform:translate(-50%,-50%) scale(2.15);opacity:0}}
@keyframes glTeamFlash{0%{opacity:0}12%{opacity:1}100%{opacity:0}}
@keyframes glTeamSoft{0%{opacity:0}30%{opacity:.45}100%{opacity:0}}
@keyframes glTeamText{0%{transform:translate(-50%,-50%) scale(.55);opacity:0}18%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}70%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{transform:translate(-50%,-50%) scale(1.15);opacity:0}}
@keyframes glTeamStreak{0%{transform:translate(-50%,-50%) rotate(var(--rot)) scaleX(.25);opacity:0}18%{opacity:.95}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(var(--rot)) scaleX(1.25);opacity:0}}
@keyframes glTeamStar{0%{transform:scale(.2) rotate(-20deg);opacity:0}25%{opacity:1;transform:scale(1.05) rotate(8deg)}100%{transform:scale(1.35) rotate(16deg);opacity:0}}
@keyframes glTeamBolt{0%{opacity:0}8%{opacity:1}16%{opacity:.2}28%{opacity:1}100%{opacity:0}}
@keyframes glTeamWave{0%{transform:translateX(-12%) translateY(8%);opacity:0}30%{opacity:.9;transform:none}100%{transform:translateX(10%) translateY(-6%);opacity:0}}
@keyframes glTeamWing{0%{transform:scale(.4,.6);opacity:0}24%{opacity:1;transform:scale(1,1)}100%{transform:scale(1.35,1.05);opacity:0}}
@keyframes glBannerIn{0%{transform:scale(.62) translateY(12px);opacity:0}40%{transform:scale(1.08);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes glSpinRays{to{transform:rotate(360deg)}}
@keyframes glRayPulse{0%,100%{opacity:.32}50%{opacity:.72}}
@keyframes glRise{0%{transform:translate(-50%,24px) scale(.5);opacity:0}18%{opacity:1}100%{transform:translate(-50%,-210px) scale(1);opacity:0}}
@keyframes glWashIn{from{opacity:0}to{opacity:1}}
@keyframes glCoinShine{0%{background-position:-140% 0;opacity:0}18%{opacity:.95}100%{background-position:240% 0;opacity:0}}
@keyframes glPulseFrame{0%,100%{box-shadow:0 0 14px 5px rgba(210,120,255,.7),0 0 44px rgba(255,80,200,.4)}50%{box-shadow:0 0 32px 10px rgba(120,220,255,.95),0 0 72px rgba(255,200,80,.55)}}
@keyframes glFlashHard{0%{opacity:0}6%{opacity:1}100%{opacity:0}}
@keyframes glPotwGlow{0%,100%{box-shadow:0 0 12px rgba(40,235,130,.6),0 0 24px rgba(40,235,130,.28)}50%{box-shadow:0 0 24px rgba(140,255,200,1),0 0 46px rgba(40,235,130,.65)}}
@keyframes glTrophy{0%{transform:translate(-50%,-50%) scale(.2);opacity:0}22%{opacity:1}70%{opacity:1}100%{transform:translate(-50%,-50%) scale(1.6);opacity:0}}
@keyframes glScreenFlash{0%{opacity:0}7%{opacity:1}100%{opacity:0}}
@keyframes glScreenSoft{0%{opacity:0}30%{opacity:.55}100%{opacity:0}}
@keyframes glScreenRays{0%{opacity:0}16%{opacity:.6}100%{opacity:0}}
@keyframes glScreenWhite{0%{opacity:0}5%{opacity:1}40%{opacity:0}100%{opacity:0}}
@keyframes glDeflate{0%{transform:translate(-50%,-50%) scale(1.5);opacity:0}15%{opacity:1}50%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-38%) scale(.8,.4);opacity:0}}
.gl-scene{perspective:1100px}
.gl-flip{transform-style:preserve-3d;transition:transform .55s cubic-bezier(.2,.7,.2,1);position:relative}
.gl-flip.gl-on{transform:rotateY(180deg)}
.gl-flip.gl-stats{transform:rotateY(360deg)}
.gl-flip.gl-super{transition-duration:1.28s}
.gl-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:10px;overflow:hidden}
.gl-front{transform:rotateY(180deg)}
.gl-btn{appearance:none;border:none;background:transparent;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.gl-pack-btn{display:block;margin:0 auto;border-radius:16px;touch-action:manipulation}
.gl-pack-btn:hover .gl-shell,.gl-pack-btn:focus-visible .gl-shell{transform:scale(1.04)}
.gl-pack-btn:focus-visible{outline:2px solid #c3cad6;outline-offset:4px}
.gl-shell{transform-origin:50% 60%;transition:transform .2s ease}
@media (prefers-reduced-motion:reduce){.gl-flip{transition-duration:.35s}.gl-flip.gl-super{transition-duration:.45s}.gl-pack-btn:hover .gl-shell{transform:none}}
.gl-store{background:radial-gradient(120% 60% at 50% -8%,rgba(70,225,205,0.24),rgba(70,225,205,0) 62%),repeating-linear-gradient(0deg,rgba(255,255,255,0) 0 46px,rgba(255,255,255,0.045) 46px 48px),linear-gradient(180deg,#0b2447 0%,#0a3547 55%,#06222c 100%);color:#eef7fb;border-radius:16px;padding:12px 12px 16px;overflow:hidden}
.gl-store-title{margin:0;font-style:italic;font-weight:800;font-size:30px;letter-spacing:1px;line-height:1;text-transform:uppercase}
.gl-grid3{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.gl-blurb{font-size:11px;opacity:.8;margin-top:4px}
@keyframes glHi{0%{box-shadow:0 0 0 0 rgba(255,226,122,0)}22%{box-shadow:0 0 0 4px rgba(255,226,122,.95),0 0 26px 8px rgba(255,226,122,.7)}100%{box-shadow:0 0 0 0 rgba(255,226,122,0)}}
.gl-hi{animation:glHi 1.5s ease-out 1}
@media (prefers-reduced-motion:reduce){.gl-hi{animation:none;outline:3px solid #ffe27a;outline-offset:2px}}
@media (max-width:560px){.gl-grid3{gap:8px}.gl-store-title{font-size:24px}.gl-tile{padding:7px 5px 9px}.gl-tile-name{font-size:11px}.gl-blurb{font-size:10px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}}
.gl-tabs{display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;touch-action:pan-x pan-y;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:8px;border-radius:16px;background:radial-gradient(120% 140% at 50% -40%,rgba(70,225,205,0.28),rgba(70,225,205,0) 65%),linear-gradient(180deg,#0b2447 0%,#07303a 100%)}
.gl-tabs::-webkit-scrollbar{display:none}
.gl-tab{flex:0 0 auto;appearance:none;-webkit-appearance:none;min-height:44px;padding:0 15px;border-radius:999px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:#eef7fb;font:inherit;font-size:14px;font-weight:800;font-style:italic;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent}
.gl-tab[aria-selected="true"]{background:linear-gradient(180deg,#ffe27a,#ffc83a);color:#2b1a02;border-color:#fff3b0;box-shadow:0 0 0 2px rgba(255,226,122,0.35)}
.gl-tile{appearance:none;border:2px solid rgba(255,255,255,.12);background:linear-gradient(180deg,#14425a 0%,#0a2433 100%);color:inherit;border-radius:12px;padding:8px 8px 10px;cursor:pointer;text-align:center;width:100%}
.gl-tile.gl-sel{border-color:#35e0c8;box-shadow:0 0 0 1px #35e0c8,0 0 16px rgba(53,224,200,.4)}
.gl-tile-name{font-style:italic;font-weight:800;text-transform:uppercase;font-size:12px;margin-top:6px;line-height:1.2}
.gl-odds{appearance:none;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;border-radius:999px;padding:3px 8px;margin-top:6px;cursor:pointer}
.gl-sell{appearance:none;width:100%;margin-top:6px;border:1px solid rgba(0,0,0,.15);background:#f4efe4;color:#1a140c;font-size:10px;font-weight:700;border-radius:8px;padding:5px 4px;cursor:pointer}
.gl-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px}
`;

// ---- cards ----
// Card color comes from the pack (blue Rising Stars, crimson Stars, gold Legends, plus a themed Season pack); rarity is a finish layered on top.
interface PackSkin { a: string; b: string; ink: string; edge: string }
const PCOL: Record<PackId, PackSkin> = {
  rookie: { a: "#2f7bff", b: "#0a2c78", ink: "#ffffff", edge: "#9cc4ff" },
  stars: { a: "#e0314f", b: "#5a0a1f", ink: "#ffffff", edge: "#ffb3c0" },
  legends: { a: "#f6d160", b: "#c2901e", ink: "#2b1a02", edge: "#fff0b0" },
  standard: { a: "#7b858f", b: "#30373e", ink: "#ffffff", edge: "#d3dae1" },
  potw: { a: "#19c26c", b: "#04502b", ink: "#ffffff", edge: "#b9ffd9" },
  boom: { a: "#d6141e", b: "#120608", ink: "#ffffff", edge: "#ff9a8a" },
  season: SEASON_THEME[seasonOf()].skin,
};
const skinOf = (card: Card): PackSkin => {
  if (card.packId === "season") {
    const sid = playerOf(card.playerId).season;
    if (sid) return SEASON_THEME[sid].skin;
  }
  return PCOL[card.packId];
};
// Player of the Week cards are always emerald, whichever pack they come from.
const POTW_SKIN: PackSkin = { a: "#20d97d", b: "#06603a", ink: "#ffffff", edge: "#c8ffe2" };
const POTWP = ["#1fd37a", "#7dffb8", "#eafff3", "#ffffff", "#0fa85e", "#ffe27a"];
const BOOMP = ["#ff3b1f", "#ffb000", "#fff1a8", "#ffffff", "#ff6a2a", "#8f0a12"];
const FINISH: Partial<Record<RarityId, string>> = {
  kings: "linear-gradient(135deg, #f1e6ff, #9a63ff 30%, #ffd76a 52%, #9a63ff 74%, #e6d4ff)",
  walls: "repeating-linear-gradient(0deg, #bff0ff 0 7px, #1f9fbf 7px 9px)",
  phenom: "linear-gradient(135deg, #fff0e2, #ff7a2f 35%, #ffd24a 55%, #ff4d6d 80%)",
  silver: "repeating-linear-gradient(100deg, #f4f6f8 0 3px, #aab3bd 3px 6px, #dfe4e9 6px 9px)",
  gold: "linear-gradient(135deg, #fff3b0, #e0b030 35%, #fff0a0 55%, #b8860b)",
  potw: "linear-gradient(135deg, #eafff3, #19d27a 28%, #067a40 50%, #8dffc2 72%, #0fb866)",
  auto: "linear-gradient(120deg, #7dffe0, #8cb4ff, #e08cff, #ffe08c, #7dffe0)",
  super: RAINBOW,
};
const INSERT_ICON: Partial<Record<RarityId, string>> = { kings: "♛", walls: "▦", phenom: "✦" };
const INSERT_FX: Record<string, string[]> = {
  kings: ["rgba(170,120,255,0.95)", "rgba(255,215,106,0.9)", "#c8a2ff", "#ffd76a", "#ffffff", "#9a63ff"],
  walls: ["rgba(40,190,225,0.95)", "rgba(200,245,255,0.9)", "#7fe3f5", "#27b6d6", "#ffffff", "#b8f3ff"],
  phenom: ["rgba(255,130,50,0.95)", "rgba(255,215,90,0.9)", "#ff7a2f", "#ffd24a", "#ffffff", "#ff4d6d"],
};
const BADGE: Record<RarityId, [string, string]> = {
  kings: ["linear-gradient(180deg, #e6d4ff, #9a63ff)", "#1c0a3a"],
  walls: ["linear-gradient(180deg, #d4f6ff, #27b6d6)", "#06222b"],
  phenom: ["linear-gradient(180deg, #ffe0c8, #ff7a2f)", "#2e1204"],
  base: ["rgba(255,255,255,0.88)", "#222222"],
  silver: ["linear-gradient(180deg, #f4f6f8, #aab3bd)", "#1c242c"],
  gold: ["linear-gradient(180deg, #fff3b0, #d9a521)", "#3a2a08"],
  potw: ["linear-gradient(180deg, #eafff3, #19d27a)", "#04281a"],
  auto: ["linear-gradient(120deg, #7dffe0, #8cb4ff, #e08cff, #ffe08c)", "#0a1a2a"],
  super: [RAINBOW, "#1a0a2a"],
};
const badgeStyle = (r: RarityId, c: boolean): CSSProperties => ({ display: "inline-block", padding: c ? "2px 5px" : "3px 7px", borderRadius: 4, fontSize: c ? 8 : 10, fontWeight: 800, letterSpacing: 0.6, lineHeight: 1, textTransform: "uppercase", color: BADGE[r][1], background: BADGE[r][0], border: "1px solid rgba(0,0,0,0.35)" });
// Base cards from the Boom or Bust pack are duds: a dull, desaturated gray-brown frame and background. The save already records each card's pack, so this applies everywhere (reveal, binder, enlarge view).
const BUST_SKIN: PackSkin = { a: "#857b70", b: "#4d4741", ink: "#f2ece3", edge: "#6b635a" };
const isBust = (c: Card): boolean => c.packId === "boom" && c.rarity === "base";
function skin(card: Card): Rarity {
  const base = RB[card.rarity], p = isBust(card) ? BUST_SKIN : card.rarity === "potw" ? POTW_SKIN : skinOf(card);
  return { ...base, ink: p.ink, frame: card.rarity === "base" ? p.edge : base.frame, bg: (card.packId === "standard" ? "repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, rgba(0,0,0,0.06) 1px 3px), " : "") + "linear-gradient(180deg, " + p.a + ", " + p.b + ")" };
}
function PosBadge(p: { pos: string; compact?: boolean }): ReactNode {
  const c = p.compact === true;
  return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: c ? 28 : 36, padding: c ? "2px 5px" : "3px 8px", borderRadius: 5, background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.6)", color: "#fff", fontSize: c ? 10 : 12, fontWeight: 800, letterSpacing: 0.8, lineHeight: 1 }}>{p.pos}</span>;
}

function chrome(card: Card, compact: boolean, font: string): { wrap: CSSProperties; inner: CSSProperties } {
  const r = skin(card), sup = card.rarity === "super";
  const anim = sup ? "glRainbow " + sp("3s", "8s") + " linear infinite" : card.rarity === "gold" ? "glGoldGlow " + sp("1.8s", "3.6s") + " ease-in-out infinite" : card.rarity === "potw" ? "glPotwGlow " + sp("1.6s", "3.2s") + " ease-in-out infinite" : card.rarity === "auto" ? "glGlowPulse " + sp("1.8s", "3.6s") + " ease-in-out infinite" : undefined;
  return {
    wrap: { width: "100%", height: "100%", boxSizing: "border-box", borderRadius: 10, padding: compact ? 5 : 7, background: FINISH[card.rarity] ?? r.frame, backgroundSize: card.rarity === "auto" ? "300% 100%" : sup ? "200% 200%" : undefined, animation: anim, boxShadow: card.rarity === "base" ? "0 2px 8px rgba(0,0,0,0.18)" : "0 0 14px " + r.glow, color: r.ink, fontFamily: font, display: "flex", flexDirection: "column", position: "relative" },
    inner: { flex: 1, minHeight: 0, background: r.bg, borderRadius: 7, border: (sup ? 4 : card.rarity === "base" ? 2 : 3) + "px solid " + (sup ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.08)"), display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" },
  };
}

const FOIL: Partial<Record<RarityId, CSSProperties>> = {
  kings: { background: "linear-gradient(115deg, transparent 20%, rgba(255,230,160,0.45) 44%, rgba(255,255,255,0.6) 50%, transparent 76%)", backgroundSize: "250% 100%" },
  walls: { background: "linear-gradient(115deg, transparent 20%, rgba(160,240,255,0.45) 44%, rgba(255,255,255,0.6) 50%, transparent 76%)", backgroundSize: "250% 100%" },
  phenom: { background: "linear-gradient(115deg, transparent 20%, rgba(255,210,120,0.5) 44%, rgba(255,255,255,0.6) 50%, transparent 76%)", backgroundSize: "250% 100%" },
  silver: { background: "linear-gradient(115deg, transparent 28%, rgba(255,255,255,0.7) 50%, transparent 72%)", backgroundSize: "220% 100%" },
  gold: { background: "linear-gradient(115deg, transparent 12%, rgba(255,230,140,0.28) 32%, rgba(255,255,255,0.7) 50%, rgba(255,210,80,0.35) 68%, transparent 86%)", backgroundSize: "250% 100%" },
  potw: { background: "linear-gradient(115deg, transparent 18%, rgba(190,255,220,0.5) 38%, rgba(255,255,255,0.85) 50%, rgba(120,255,190,0.5) 62%, transparent 82%)", backgroundSize: "250% 100%" },
  auto: { mixBlendMode: "soft-light", background: "linear-gradient(120deg, rgba(255,80,120,0.55), rgba(255,200,60,0.55), rgba(80,255,160,0.55), rgba(60,180,255,0.55), rgba(200,80,255,0.55), rgba(255,80,120,0.55))", backgroundSize: "300% 100%" },
  super: { mixBlendMode: "overlay", opacity: 0.65, background: RAINBOW, backgroundSize: "300% 300%" },
};
const FOIL_ANIM: Record<RarityId, [string, string, string]> = {
  base: ["", "", ""], kings: ["glHoloSweep", "2s ease-in-out", "6s ease-in-out"], walls: ["glHoloSweep", "2s ease-in-out", "6s ease-in-out"], phenom: ["glHoloSweep", "2s ease-in-out", "6s ease-in-out"], potw: ["glHoloSweep", "1.6s linear", "4.5s linear"], silver: ["glHoloSweep", "2.2s ease-in-out", "6s ease-in-out"], gold: ["glHoloSweep", "1.8s linear", "5.5s linear"],
  auto: ["glFoilDrift", "2.4s linear", "7s linear"], super: ["glPrism", "3s linear", "8s linear"],
};

function CardFace(p: { card: Card; compact?: boolean }): ReactNode {
  const theme = useGrokTheme();
  const c = p.compact === true, card = p.card, player = playerOf(card.playerId), r = skin(card), team = player.team;
  const { wrap, inner } = chrome(card, c, theme.font.family);
  const foil = FOIL[card.rarity], fa = FOIL_ANIM[card.rarity];
  const row: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: c ? 8 : 9, letterSpacing: 0.4, textTransform: "uppercase", color: r.ink };
  return (
    <div style={wrap}>
      <div style={inner}>
        <div style={{ ...row, padding: c ? "3px 5px" : "5px 7px", fontWeight: theme.weight.semibold, opacity: 0.85 }}><span>{SET}</span><span>{YEAR}</span></div>
        <div style={{ height: c ? (card.rarity === "auto" || card.rarity === "super" || card.rarity === "potw" ? 72 : 78) : 112, margin: c ? "0 5px" : "0 7px", borderRadius: 6, position: "relative", filter: isBust(card) ? "grayscale(0.85) sepia(0.2) brightness(0.88)" : undefined, background: "linear-gradient(160deg, " + team.primary + " 0%, " + team.primary + " 55%, " + team.secondary + " 100%)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {card.rarity === "super" ? (
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, opacity: 0.45 }}>
              <defs><linearGradient id={"fg-" + card.uid} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff4d6d" /><stop offset="40%" stopColor="#ffd24a" /><stop offset="70%" stopColor="#4ad6ff" /><stop offset="100%" stopColor="#c44dff" /></linearGradient></defs>
              <polygon points="50,4 62,38 98,38 68,58 80,94 50,72 20,94 32,58 2,38 38,38" fill={"url(#fg-" + card.uid + ")"} />
            </svg>
          ) : null}
          {card.rarity === "potw" ? <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35, background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.55) 0 1px, transparent 1px 12px), radial-gradient(circle at 50% 45%, rgba(60,255,150,0.45), transparent 70%)" }} /> : null}
          {INSERT_ICON[card.rarity] ? <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: c ? 58 : 100, lineHeight: 1, color: "rgba(255,255,255,0.28)", fontWeight: 900 }}>{INSERT_ICON[card.rarity]}</div> : null}
          {isChaseCard(card) ? <div title="Chase 1/1" style={{ position: "absolute", left: "50%", top: c ? 4 : 5, marginLeft: c ? -9 : -12, zIndex: 3, width: c ? 18 : 24, height: c ? 18 : 24 }}><svg viewBox="0 0 24 24" width="100%" height="100%" aria-label="Chase card"><defs><linearGradient id={"cg-" + card.uid} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fff2a8" /><stop offset="100%" stopColor="#e0a21a" /></linearGradient></defs><circle cx="12" cy="12" r="11" fill="#2b1a02" stroke="#ffd76a" strokeWidth="1.5" /><polygon points="12,4 14.4,9.6 20.4,10.2 15.8,14.2 17.2,20 12,16.9 6.8,20 8.2,14.2 3.6,10.2 9.6,9.6" fill={"url(#cg-" + card.uid + ")"} /></svg></div> : null}
          <div style={{ position: "absolute", left: 5, top: 5, zIndex: 2, minWidth: c ? 22 : 26, height: c ? 22 : 26, padding: "0 4px", borderRadius: 4, background: "rgba(0,0,0,0.72)", border: "1px solid rgba(255,220,80,0.85)", color: "#ffe27a", fontWeight: 800, fontSize: c ? 10 : 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{overallOf(player, card.rarity)}</div>
          <div style={{ position: "relative", zIndex: 1, color: "#fff", fontSize: c ? 32 : 62, marginTop: c ? 4 : 0, fontWeight: 900, fontStyle: "italic", letterSpacing: c ? -1 : -2, lineHeight: 0.85, textShadow: "0 2px 0 rgba(0,0,0,0.35), 0 6px 14px rgba(0,0,0,0.4)" }}>{player.num}</div>
          <div style={{ position: "absolute", left: 6, bottom: 5, zIndex: 2 }}><PosBadge pos={player.pos} compact={c} /></div>
          <div style={{ position: "absolute", right: 5, bottom: 4, zIndex: 2 }}><TeamBadge team={team} size={c ? 24 : 32} /></div>
          <div style={{ ...badgeStyle(card.rarity, c), ...(isBust(card) ? { background: "#b8aea2", color: "#2b2620" } : {}), position: "absolute", right: 5, top: 5, zIndex: 2 }}>{isBust(card) ? "Bust" : RB[card.rarity].short}</div>
        </div>
        <div style={{ padding: c ? "5px 6px 4px" : "7px 8px 6px", textAlign: "center", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
            <div style={{ fontSize: c ? 11 : 13, fontWeight: 700, lineHeight: 1.15 }}>{player.name}</div>
            <PosBadge pos={player.pos} compact />
          </div>
          <div style={{ fontSize: c ? 8 : 10, marginTop: 2, opacity: 0.8 }}>{team.name}</div>
          <div style={{ fontSize: c ? 7 : 9, marginTop: 3, fontWeight: 800, opacity: 0.95, lineHeight: 1.2 }}>Pull {formatPct(exactChance(card))} · {RB[card.rarity].short} {formatPct(rarityPct(card))}</div>
        </div>
        {card.rarity === "potw" ? <div style={{ flexShrink: 0, margin: c ? "0 6px 2px" : "2px 8px 5px", padding: c ? "1px 3px" : "3px 6px", borderRadius: 6, background: "linear-gradient(90deg, #0b6b3a, #1fd37a, #0b6b3a)", border: "1px solid rgba(255,255,255,0.7)", color: "#ffffff", textAlign: "center", fontWeight: 900, fontSize: c ? 6.5 : 9, letterSpacing: c ? 0.4 : 1, lineHeight: 1.1, whiteSpace: "nowrap" }}>★ PLAYER OF THE WEEK ★</div> : null}
        {card.rarity === "auto" || card.rarity === "super" ? <div style={{ flexShrink: 0, margin: c ? "0 6px 2px" : "2px 8px 5px", padding: c ? "0 3px" : "1px 6px", borderRadius: 6, background: "rgba(255,255,255,0.82)", border: "1px solid rgba(0,0,0,0.18)" }}><Signature name={player.name} ink="#0b1f4a" compact={c} /></div> : null}
        <div style={{ ...row, fontSize: c ? 7 : 9, letterSpacing: c ? 0.2 : 0.4, padding: c ? "3px 6px 5px" : "4px 8px 6px", fontWeight: 700, position: "relative", zIndex: 2 }}>
          <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{c && r.name.length > 9 ? r.short : r.name}</span><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, marginLeft: 4 }}>{card.rarity === "super" ? "1 of 1" : c ? PB[card.packId].name.replace(" Pack", "") : PB[card.packId].name}</span>
        </div>
        {foil ? <div style={{ ...ABS, ...foil, inset: 0, borderRadius: 7, zIndex: 3, animation: fa[0] + " " + sp(fa[1], fa[2]) + " infinite" }} /> : null}
      </div>
    </div>
  );
}

function CardStats(p: { card: Card; compact?: boolean }): ReactNode {
  const theme = useGrokTheme();
  const c = p.compact === true, card = p.card, player = playerOf(card.playerId), r = skin(card);
  const { wrap, inner } = chrome(card, c, theme.font.family);
  return (
    <div style={wrap}>
      <div style={{ ...inner, padding: c ? "5px 6px 6px" : "7px 8px 8px", color: r.ink }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: c ? 8 : 9, fontWeight: theme.weight.semibold, letterSpacing: 0.4, textTransform: "uppercase", opacity: 0.85 }}><span>{SET}</span><span>{YEAR}</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: c ? 6 : 8, marginTop: c ? 4 : 6 }}>
          <div style={{ minWidth: c ? 32 : 40, height: c ? 32 : 40, borderRadius: 8, background: "rgba(0,0,0,0.78)", border: "1px solid rgba(255,220,80,0.85)", color: "#ffe27a", fontWeight: 800, fontSize: c ? 14 : 18, display: "flex", alignItems: "center", justifyContent: "center" }}>{overallOf(player, card.rarity)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: c ? 11 : 13, fontWeight: 800, lineHeight: 1.15 }}>{player.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}><PosBadge pos={player.pos} compact={c} /><span style={{ fontSize: c ? 9 : 11, fontWeight: 800 }}>#{player.num}</span></div>
          </div>
          <TeamBadge team={player.team} size={c ? 30 : 38} />
        </div>
        <div style={{ fontSize: c ? 8 : 10, marginTop: c ? 4 : 6, opacity: 0.85, lineHeight: 1.35 }}>
          <div>{player.team.name}</div>
          <div><span style={badgeStyle(card.rarity, c)}>{RB[card.rarity].short}</span> {r.name} · {PB[card.packId].name} · {overallOf(player, card.rarity)} OVR</div>
          <div>Value {money(cardVal(card))} · Pull chance {chanceText(card)}</div>
        </div>
        <div style={{ marginTop: c ? 6 : 8, fontSize: c ? 8 : 9, fontWeight: 800, letterSpacing: 0.7, textTransform: "uppercase" }}>Game ratings</div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: c ? 3 : 5, marginTop: 4 }}>
          {gameAttrs(player, card.rarity).map((a) => (
            <div key={a.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: c ? 78 : 96, fontSize: c ? 8 : 10, fontWeight: 700, lineHeight: 1.15 }}>{a.label}</div>
              <div style={{ flex: 1, height: c ? 6 : 8, borderRadius: 99, background: "rgba(0,0,0,0.14)", overflow: "hidden" }}><div style={{ width: a.value + "%", height: "100%", borderRadius: 99, background: r.ink }} /></div>
              <div style={{ width: 20, fontSize: c ? 9 : 11, fontWeight: 800, textAlign: "right" }}>{a.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: c ? 4 : 6, fontSize: c ? 7 : 8, lineHeight: 1.3, opacity: 0.75, fontWeight: 600 }}>Simulated video-game ratings, not official or career stats.</div>
      </div>
    </div>
  );
}

function CardBack(p: { packId: PackId; season?: SeasonId }): ReactNode {
  const sk = p.packId === "season" ? SEASON_THEME[p.season ?? seasonOf()].skin : PCOL[p.packId];
  const theme = useGrokTheme();
  return (
    <div style={{ width: "100%", height: "100%", boxSizing: "border-box", borderRadius: 10, padding: 7, background: "linear-gradient(160deg, " + sk.b + " 0%, " + sk.a + " 55%, " + sk.b + " 100%)", boxShadow: "0 2px 8px rgba(0,0,0,0.25)", display: "flex" }}>
      <div style={{ flex: 1, borderRadius: 7, border: "2px solid " + sk.edge, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: sk.ink, fontFamily: theme.font.family, textAlign: "center", padding: 8, background: "repeating-linear-gradient(135deg, rgba(195,202,214,0.08) 0 6px, transparent 6px 12px)" }}>
        <div style={{ fontSize: 9, letterSpacing: 1.4, fontWeight: 700, color: sk.edge }}>{YEAR}</div>
        <div style={{ width: 36, height: 22, borderRadius: "18px 18px 8px 8px", border: "2px solid " + sk.edge, position: "relative" }}><div style={{ position: "absolute", left: 6, right: 6, top: 8, height: 4, borderRadius: 2, background: sk.edge }} /></div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6 }}>{SET}</div>
      </div>
    </div>
  );
}

function FlipCard(p: { card: RCard; onFlip?: () => void; charged?: boolean; burst?: boolean; inspect?: boolean }): ReactNode {
  const [stats, setStats] = useState(false);
  const r = p.card.rarity;
  const flipped = p.inspect === true || p.card.flipped;
  useEffect(() => { setStats(false); }, [p.card.uid, flipped]);
  let motion: string | undefined = p.inspect ? undefined : "glDeal 0.35s ease both";
  if (!p.inspect && flipped && (r === "auto" || r === "super" || r === "potw")) motion = "glPopShake " + sp(r === "super" ? "0.85s" : "0.6s", "0.4s") + " ease";
  else if (!p.inspect && p.charged) motion = "glCardCharge " + sp("0.6s", "0.9s") + " ease-in-out infinite";
  const name = playerOf(p.card.playerId).name;
  const sweep = flipped && (r === "silver" || r === "gold" || r === "potw");
  return (
    <button
      type="button"
      className="gl-btn"
      onClick={() => { if (!flipped) { p.onFlip?.(); return; } setStats((v) => !v); }}
      aria-label={!flipped ? "Flip card" : stats ? "Flip back to the front of " + name : "Show game ratings for " + name}
      style={{ width: "100%", height: 300, position: "relative", zIndex: 2, animation: motion, borderRadius: 12 }}
    >
      <div className="gl-scene" style={{ width: "100%", height: "100%", borderRadius: 12, animation: flipped && r === "super" ? "glPulseFrame " + sp("1.15s", "2.2s") + " ease-in-out infinite" : undefined }}>
        <div className={"gl-flip" + (flipped && stats ? " gl-stats" : flipped ? " gl-on" : "") + (r === "super" ? " gl-super" : "")} style={{ width: "100%", height: "100%" }}>
          <div className="gl-face">{flipped ? <CardStats card={p.card} /> : <CardBack packId={p.card.packId} season={playerOf(p.card.playerId).season} />}</div>
          <div className="gl-face gl-front">
            <CardFace card={p.card} />
            {sweep ? <div style={{ ...ABS, inset: 0, borderRadius: 10, zIndex: 4, background: "linear-gradient(115deg, transparent 32%, " + (r === "gold" ? "rgba(255,255,230,0.85)" : r === "potw" ? "rgba(200,255,225,0.9)" : "rgba(255,255,255,0.85)") + " 50%, transparent 68%)", backgroundSize: "180% 100%", animation: (r === "gold" ? "glCoinShine " + sp("1.1s", "0.7s") + " ease-out 2" : "glHoloSweep " + sp("0.85s", "1.4s") + " linear 3") }} /> : null}
          </div>
        </div>
      </div>
      {p.burst && flipped ? (
        <div style={{ ...ABS, inset: 0 }}>
          {r === "base" ? <>{ring("r", 110, "3px solid rgba(255,255,255,0.85)", "glRipple", sp("0.8s", "0.45s"))}<Burst kind="puff" seed={p.card.uid} count={8} /></> : <Burst kind="spark" seed={p.card.uid} count={r === "super" ? 16 : r === "auto" || r === "potw" ? 14 : r === "gold" ? 12 : 10} colors={r === "silver" ? SILVER : r === "gold" ? GOLDP : r === "potw" ? POTWP : undefined} />}
          {p.card.packId === "boom" && (r === "auto" || r === "super") ? <>{ring("bm", 170, "6px solid rgba(255,90,30,0.95)", "glBurstRing", sp("1s", "0.55s"))}<Burst kind="spark" seed={p.card.uid + "b"} count={28} colors={BOOMP} /></> : null}
        </div>
      ) : null}
    </button>
  );
}

// ---- packs ----
// Pack emblems: one inline SVG per pack, tinted to the pack's colors.
function PackEmblem(p: { id: PackId }): ReactNode {
  const g = "pe-" + p.id;
  const grad = (c1: string, c2: string): ReactNode => <defs><linearGradient id={g} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c1} /><stop offset="100%" stopColor={c2} /></linearGradient></defs>;
  const fill = "url(#" + g + ")";
  const star = "12,2.5 14.9,8.7 21.7,9.5 16.6,14.1 18,20.9 12,17.5 6,20.9 7.4,14.1 2.3,9.5 9.1,8.7";
  let body: ReactNode;
  if (p.id === "standard") body = <>{grad("#f4f7fa", "#8d98a4")}<path d="M12 2 L21 5.2 V12 C21 17.2 17 20.8 12 22.6 C7 20.8 3 17.2 3 12 V5.2 Z" fill={fill} stroke="#d3dae1" strokeWidth="1.2" /><path d="M12 5.5 V19 M6.5 11.5 H17.5" stroke="#5f6a76" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" /></>;
  else if (p.id === "rookie") body = <>{grad("#ffffff", "#7fb0ff")}<polygon points="12,1.5 14.2,6.4 19.6,7 15.6,10.6 16.7,15.9 12,13.2 7.3,15.9 8.4,10.6 4.4,7 9.8,6.4" fill={fill} stroke="#cfe2ff" strokeWidth="0.9" strokeLinejoin="round" /><path d="M12 15.5 L9.4 22.5 L12 20.4 L14.6 22.5 Z" fill="#9cc4ff" opacity="0.9" /><path d="M7.2 17 L6.2 21 M16.8 17 L17.8 21" stroke="#cfe2ff" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" /></>;
  else if (p.id === "stars") body = <>{grad("#fff0f3", "#ff5c7c")}<polygon points={star} fill={fill} stroke="#ffd0d8" strokeWidth="1" strokeLinejoin="round" /></>;
  else if (p.id === "legends") body = <>{grad("#fff3c0", "#f0b930")}<path d="M3 8 L7.5 12.5 L12 4.5 L16.5 12.5 L21 8 L19 19 H5 Z" fill={fill} stroke="#4a3408" strokeWidth="1.3" strokeLinejoin="round" /><rect x="5" y="19.5" width="14" height="2.4" rx="1" fill="#4a3408" /><circle cx="12" cy="4.2" r="1.4" fill="#fff3c0" stroke="#4a3408" strokeWidth="0.8" /></>;
  else if (p.id === "boom") body = <>{grad("#6e6e7c", "#0a0a0e")}<path d="M17.3 6.4 C18.4 4.9 19.4 4.6 20.6 5" fill="none" stroke="#ffd9a8" strokeWidth="1.5" strokeLinecap="round" /><polygon points="21.2,0.9 22.1,3.2 24,3.4 22.5,4.8 23,6.9 21.2,5.8 19.4,6.9 19.9,4.8 18.4,3.4 20.3,3.2" fill="#ffb000" stroke="#ff3b1f" strokeWidth="0.6" strokeLinejoin="round" /><circle cx="10.5" cy="14.2" r="8" fill={fill} stroke="#ff6a55" strokeWidth="1.3" /><rect x="13.9" y="6.4" width="4" height="3.2" rx="0.8" transform="rotate(45 15.9 8)" fill="#3a3a44" stroke="#ff6a55" strokeWidth="0.9" /><path d="M6.2 12.4 C6.7 10.8 8 9.8 9.5 9.6" fill="none" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" opacity="0.65" /></>;
  else if (p.id === "season") {
    const sid = seasonOf();
    if (sid === "superbowl") body = <>{grad("#fff3c0", "#c9a227")}<path d="M7 4.2 H17 V9.2 C17 12.4 14.8 15 12 15.8 C9.2 15 7 12.4 7 9.2 Z" fill={fill} stroke="#fff3c0" strokeWidth="1" /><path d="M6.2 4.2 H17.8 M12 15.8 V18.6 M8 21 H16 V18.6 H8 Z" fill="#c9a227" stroke="#fff3c0" strokeWidth="1" strokeLinejoin="round" /><circle cx="12" cy="8.5" r="2" fill="#fff8dc" /></>;
    else if (sid === "rookies") body = <>{grad("#c8ffd9", "#1aa35a")}<polygon points="12,2 14.2,8 20.5,8.2 15.6,12 17.4,18 12,14.6 6.6,18 8.4,12 3.5,8.2 9.8,8" fill={fill} stroke="#c8ffd9" strokeWidth="0.9" /><circle cx="12" cy="21" r="1.6" fill="#c8ffd9" /></>;
    else if (sid === "halloween") body = <>{grad("#ffb04a", "#ef7a16")}<ellipse cx="12" cy="14" rx="8.2" ry="7.2" fill={fill} stroke="#ffc07a" strokeWidth="1" /><path d="M12 7 C12 7 14 3.2 16.2 4.6 C14.4 6 12 7 12 7 Z" fill="#3a8a2a" stroke="#c8ffd9" strokeWidth="0.6" /><path d="M8.4 13.2 L10.2 15.2 L8.2 15.6 M15.6 13.2 L13.8 15.2 L15.8 15.6 M9.2 18 Q12 20 14.8 18" fill="none" stroke="#2a0a12" strokeWidth="1.1" strokeLinecap="round" /></>;
    else if (sid === "thanksgiving") body = <>{grad("#ffd7a0", "#c45c12")}<ellipse cx="12" cy="14.5" rx="5.2" ry="4.4" fill={fill} stroke="#ffd7a0" strokeWidth="0.9" /><path d="M12 10.2 C10 6.5 7 5.5 5.5 7.2 C8.2 8 10.2 10.5 12 10.2 M12 10.2 C14 6.5 17 5.5 18.5 7.2 C15.8 8 13.8 10.5 12 10.2" fill="#e07020" stroke="#ffd7a0" strokeWidth="0.7" /><circle cx="12" cy="13.6" r="1.5" fill="#2a1408" /><path d="M12 18.8 V21.4 M10.2 21.4 H13.8" stroke="#ffd7a0" strokeWidth="1.1" strokeLinecap="round" /></>;
    else body = <>{grad("#ffe08a", "#1f8a4a")}<path d="M12 3 L13.6 9 H18.5 L14.6 12.4 L16.2 18.2 L12 14.8 L7.8 18.2 L9.4 12.4 L5.5 9 H10.4 Z" fill="#c81c2c" stroke="#ffe08a" strokeWidth="0.7" /><path d="M12 8 V22 M8.5 21.4 H15.5" stroke="#1f8a4a" strokeWidth="1.6" strokeLinecap="round" /><path d="M12 10 L7.2 16.5 M12 10 L16.8 16.5 M12 12 L8.6 18.5 M12 12 L15.4 18.5" stroke="#c8ffd0" strokeWidth="1.3" strokeLinecap="round" /></>;
  }
  else body = <>{grad("#f2fff8", "#4fe39a")}<path d="M7 3 H17 V9 C17 12.3 14.8 14.5 12 14.5 C9.2 14.5 7 12.3 7 9 Z" fill={fill} stroke="#d6ffe9" strokeWidth="1" strokeLinejoin="round" /><path d="M7 5 H3.8 V7 C3.8 9 5.2 10.3 7.3 10.6 M17 5 H20.2 V7 C20.2 9 18.8 10.3 16.7 10.6" fill="none" stroke="#d6ffe9" strokeWidth="1.3" strokeLinecap="round" /><path d="M12 14.5 V18" stroke="#d6ffe9" strokeWidth="1.8" /><path d="M8 21.5 H16 V18.3 H8 Z" fill={fill} stroke="#d6ffe9" strokeWidth="1" strokeLinejoin="round" /></>;
  return <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.4))" }}>{body}</svg>;
}
function PackThumb(p: { pack: Pack }): ReactNode {
  return (
    <div style={{ width: 70, height: 100, borderRadius: 8, margin: "0 auto", background: p.pack.bg, border: "2px solid " + p.pack.trim, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", boxShadow: "0 4px 10px rgba(0,0,0,0.35)" }}>
      <div style={{ fontSize: 8, letterSpacing: 1, fontWeight: 700, opacity: 0.85 }}>{YEAR}</div>
      <div style={{ margin: "4px 0 3px", height: 34, display: "flex", alignItems: "center" }}><PackEmblem id={p.pack.id} /></div>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#ffe27a" }}>{p.pack.hint}</div>
    </div>
  );
}

function PackArt(p: { tearing: boolean; packId: PackId; charged: boolean; disabled: boolean; short: boolean; onOpen: () => void }): ReactNode {
  const theme = useGrokTheme();
  const pack = PB[p.packId];
  const canOpen = !p.tearing && !p.disabled && !p.short;
  const half = (left: boolean): CSSProperties => ({
    position: "absolute", inset: 0, background: pack.bg, boxSizing: "border-box", padding: "22px 14px 16px", textAlign: "center",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    clipPath: left ? "polygon(0 0, 54% 0, 46% 100%, 0 100%)" : "polygon(54% 0, 100% 0, 100% 100%, 46% 100%)",
    animation: p.tearing ? (left ? "glTearL" : "glTearR") + " 0.7s ease forwards" : undefined,
  });
  // Both halves carry the full face so the text reads whole and still tears.
  const face = (
    <>
      <div style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: 700, color: pack.trim, width: "100%" }}>{YEAR} SET</div>
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1, margin: "8px 0 6px", width: "100%" }}>{SET.split(" ").map((w) => <div key={w}>{w}</div>)}</div>
      <div style={{ width: 54, height: 32, flexShrink: 0, borderRadius: "22px 22px 12px 12px", border: "2px solid " + pack.trim, position: "relative", margin: "6px 0 10px" }}><div style={{ position: "absolute", left: 10, right: 10, top: 12, height: 5, borderRadius: 2, background: pack.trim }} /></div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: pack.trim, width: "100%", lineHeight: 1.25 }}>{pack.name.split(" ").map((w) => <div key={w}>{w}</div>)}</div>
      <div style={{ fontSize: 10, marginTop: 6, opacity: 0.85, width: "100%" }}>1 card · {pack.hint}</div>
      {!p.tearing ? <div style={{ ...ABS, left: "14%", right: "14%", top: 10, height: 8, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)", backgroundSize: "200% 100%", animation: "glShimmer 2.8s ease-in-out infinite" }} /> : null}
    </>
  );
  const shell = (
    <div className="gl-shell" style={{ width: "min(220px, 86vw)", height: 280, borderRadius: 14, position: "relative", overflow: "hidden", background: pack.bg, boxShadow: "0 10px 28px rgba(0,0,0,0.28)", border: "2px solid " + pack.trim, boxSizing: "border-box", fontFamily: theme.font.family, color: "#f6f3ea", animation: p.tearing ? undefined : p.charged ? "glPackCharge 0.7s ease-in-out infinite" : "glIdleWobble " + sp("2.6s", "5s") + " ease-in-out infinite" }}>
      <div style={half(true)}>{face}</div>
      <div style={half(false)}>{face}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0 12px" }}>
      {canOpen ? <button type="button" className="gl-btn gl-pack-btn" onPointerDown={() => unlockAudio()} onClick={() => { unlockAudio(); p.onOpen(); }} aria-label={"Open " + pack.name}>{shell}</button> : shell}
      {!p.tearing ? <div style={{ marginTop: 10, fontSize: theme.font.label.fontSize, fontWeight: theme.weight.semibold, letterSpacing: 0.6, textTransform: "uppercase", color: theme.text.secondary, fontFamily: theme.font.family }}>{p.disabled ? "Opening…" : p.short ? "Not enough funds" : "Tap to open · " + money(pack.price)}</div> : null}
    </div>
  );
}

function ChaseRow(p: { packId: PackId; supers: string[]; season?: SeasonId }): ReactNode {
  const list = p.packId === "season" ? SEASON_CHASE[p.season ?? seasonOf()] : chaseOf(p.packId);
  if (list.length === 0) return null;
  const title = p.packId === "season" ? "Season Pack · " + SEASON_THEME[p.season ?? seasonOf()].name : packOf(p.packId).name;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, textAlign: "center" }}>★ Chase 1/1s · {title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(" + Math.min(list.length, 3) + ", minmax(0, 124px))", gap: 10, justifyContent: "center" }}>
        {list.map((pl) => {
          const gone = p.supers.includes(pl.id);
          const card: Card = { uid: "chase-" + pl.id, playerId: pl.id, rarity: "super", packId: p.packId, seq: 0 };
          return (
            <div key={pl.id} style={{ opacity: gone ? 0.55 : 1, filter: gone ? "grayscale(0.7)" : undefined }}>
              <div style={{ height: 196, borderRadius: 12, boxShadow: gone ? "none" : "0 0 0 2px #ffd76a, 0 0 18px rgba(255,200,80,0.8)" }}><CardFace card={card} compact /></div>
              <div style={{ marginTop: 6, textAlign: "center", fontSize: 10, lineHeight: 1.35 }}>
                <div style={{ fontWeight: 800 }}><span style={{ color: "#ffd76a" }}>★</span> 1 of 1 · {gone ? "Pulled" : "Available"}</div>
                <div style={{ opacity: 0.85 }}>{money(cardVal(card))} · {formatPct(pullChance(card))}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniCard(p: { card: Card; count?: number; onRemove?: (c: Card) => void; onInspect: (c: Card) => void }): ReactNode {
  const name = playerOf(p.card.playerId).name;
  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="gl-btn" onClick={() => p.onInspect(p.card)} aria-label={"Enlarge " + name + " and flip for game ratings"} style={{ width: "100%", display: "block" }}>
        <div style={{ height: 196 }}><CardFace card={p.card} compact /></div>
      </button>
      {p.count !== undefined && p.count > 1 ? <div style={{ position: "absolute", top: -6, right: -4, minWidth: 22, height: 22, padding: "0 5px", borderRadius: 11, background: "#041E42", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>×{p.count}</div> : null}
      <div style={{ fontSize: 10, textAlign: "center", marginTop: 4, lineHeight: 1.3, opacity: 0.85 }}>{name}<div style={{ fontSize: 9, marginTop: 2, opacity: 0.75 }}>Value {money(cardVal(p.card))} · Tap to enlarge</div><div style={{ fontSize: 9, marginTop: 2, fontWeight: 700, opacity: 0.9 }}>{chanceText(p.card)}</div></div>
      {p.onRemove ? <button type="button" className="gl-sell" onClick={() => p.onRemove?.(p.card)}>Remove</button> : null}
    </div>
  );
}

function InspectModal(p: { card: Card; onClose: () => void; onSell: (c: Card) => void }): ReactNode {
  const [ask, setAsk] = useState(false);
  const theme = useGrokTheme();
  const onClose = p.onClose;
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const html = document.documentElement, body = document.body;
    const prevHtml = html.style.overflow, prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={"Card details for " + playerOf(p.card.playerId).name} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(4,14,24,0.82)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))" }}>
      <div onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()} style={{ width: "min(280px, 92vw)", position: "relative" }}>
        <FlipCard card={{ ...p.card, flipped: true }} inspect />
        <div style={{ textAlign: "center", marginTop: 10, color: "#eef7fb", fontSize: 12, fontWeight: 600, fontFamily: theme.font.family }}>Tap the card to flip between the front and game ratings</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginTop: 10 }}><Button label={(ask ? "Confirm sell · " : "Sell · ") + money(cardVal(p.card))} onClick={() => { if (!ask) { setAsk(true); return; } p.onSell(p.card); }} />{ask ? <Button label="Cancel" onClick={() => setAsk(false)} /> : null}<Button label="Close" onClick={onClose} /></div>
      </div>
    </div>
  );
}

const FREE_COOLDOWN = 5 * 60 * 1000;
function lastFreeAt(raw: string): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 1e11) return n;
  if (Number.isFinite(n) && n > 1e9) return n * 1000;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}
function freeReadyAt(raw: string): number {
  const last = lastFreeAt(raw);
  return last === 0 ? 0 : last + FREE_COOLDOWN;
}
function FreeClock(p: { until: number; onReady: () => void }): ReactNode {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= p.until) p.onReady();
    }, 250);
    return () => window.clearInterval(t);
  }, [p.until, p.onReady]);
  const left = Math.max(0, p.until - now);
  const two = (n: number): string => String(n).padStart(2, "0");
  return <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{two(Math.floor(left / 60000))}:{two(Math.floor((left % 60000) / 1000))}</span>;
}

function SetRow(p: { def: SetDef; n: number; claimed: boolean; onClaim: () => void; hl?: boolean }): ReactNode {
  const theme = useGrokTheme();
  const d = p.def, total = d.players.length, done = p.n >= total;
  return (
    <div id={"set-" + d.id} className={p.hl ? "gl-hi" : undefined} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid " + (p.claimed ? "#d9a521" : theme.border.default), background: p.claimed ? "rgba(240,196,64,0.12)" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{p.claimed ? "🏅 " : ""}{d.name}</div>
        <div style={{ fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>{p.n}/{total}</div>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: "rgba(128,128,128,0.25)", overflow: "hidden", marginTop: 6 }}><div style={{ width: Math.round((p.n / total) * 100) + "%", height: "100%", borderRadius: 99, background: p.claimed ? "#d9a521" : done ? "#1f9d55" : "#4a7bd8" }} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 6, fontSize: 12, flexWrap: "wrap" }}>
        <span style={{ opacity: 0.8 }}>{p.claimed ? "Completed ✓ reward claimed" : "Reward " + money(d.reward)}</span>
        {done && !p.claimed ? <Button label={"Claim " + money(d.reward)} variant="primary" onClick={p.onClaim} /> : null}
      </div>
    </div>
  );
}

// ---- tabs ----
type TabId = "store" | "collection" | "achievements" | "chase" | "sets";
const TABS: [TabId, string][] = [["store", "Store"], ["collection", "Collection"], ["achievements", "Achievements"], ["chase", "Chase Cards"], ["sets", "Sets"]];
const TAB_KEY = "gl-legends-tab";
// A toast links to the tab and element it is about (an achievement card or a set row), found by element id.
interface AppToast { text: string; token: number; tab: TabId; target: string }
const isTab = (v: unknown): v is TabId => TABS.some((t) => t[0] === v);
function readTab(): TabId {
  try { const v = window.localStorage.getItem(TAB_KEY); if (isTab(v)) return v; } catch { /* blocked */ }
  try { const v = window.sessionStorage.getItem(TAB_KEY); if (isTab(v)) return v; } catch { /* blocked */ }
  return "store";
}

// ---- page ----
export default function GridironLegends() {
  const theme = useGrokTheme();
  const bootRef = useRef<Save | null>(null);
  if (bootRef.current === null) bootRef.current = loadSave();
  const boot = bootRef.current;
  const [packId, setPackId] = useState<PackId>(boot.readyPack?.packId ?? "rookie");
  const [stage, setStage] = useState<Stage>("idle");
  const [reveal, setRevealState] = useState<RCard | null>(null);
  const revealRef = useRef<RCard | null>(null);
  const [multi, setMulti] = useState<Card[]>([]);
  const [collection, setCollection] = useState<Card[]>(boot.collection);
  const [balance, setBalance] = useState(boot.balance);
  const [pulls, setPulls] = useState<Record<string, number>>(boot.pulls);
  const [supers, setSupers] = useState<string[]>(boot.supers);
  const [meta, setMeta] = useState<Meta>(boot.meta);
  const achDone = useRef(new Set<string>(boot.meta.ach));
  const [toastQ, setToastQ] = useState<AppToast[]>([]);
  const toast = toastQ[0] ?? null;
  const [hi, setHi] = useState("");
  const [, setDayTick] = useState(0);
  const [tab, setTab] = useState<TabId>(readTab);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const pickTab = (t: TabId, toTop = true): void => {
    setTab(t);
    try { window.localStorage.setItem(TAB_KEY, t); } catch { /* blocked */ }
    try { window.sessionStorage.setItem(TAB_KEY, t); } catch { /* blocked */ }
    if (toTop) {
      try { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; } catch { /* ignore */ }
    }
  };
  useEffect(() => {
    const c = tabsRef.current;
    if (!c) return;
    const el = Array.from(c.children).find((x) => x.getAttribute("aria-selected") === "true") as HTMLElement | undefined;
    if (el) c.scrollLeft = Math.max(0, el.offsetLeft - (c.clientWidth - el.offsetWidth) / 2);
  }, [tab]);
  const [locked, setLocked] = useState(boot.locked);
  const [savedAt, setSavedAt] = useState<{ t: number; manual: boolean } | null>(null);
  const [backupCode, setBackupCode] = useState("");
  const [restoreText, setRestoreText] = useState("");
  const [pendingRestore, setPendingRestore] = useState<Save | null>(null);
  const codeRef = useRef<HTMLTextAreaElement | null>(null);
  const [kept, setKept] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [confirmSell, setConfirmSell] = useState("");
  const [openedCounts, setOpenedCounts] = useState<Record<PackId, number>>(boot.openedCounts);
  const [readyPack, setReadyPack] = useState<{ packId: PackId } | null>(boot.readyPack);
  const [selectedPack, setSelectedPack] = useState<PackId | null>(boot.readyPack?.packId ?? null);
  const [oddsPack, setOddsPack] = useState<PackId | null>(null);
  const [persistOk, setPersistOk] = useState(true);
  const [persistReady, setPersistReady] = useState(false);
  const latestRef = useRef<Save>(boot);
  const persistReadyRef = useRef(false);
  const [cowboysHit, setCowboysHit] = useState(0);
  const [multiN, setMultiN] = useState(10);
  const [confirmReset, setConfirmReset] = useState(false);
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [rarityFilter, setRarityFilter] = useState("ALL");
  const [packFilter, setPackFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState("rarity");
  const [sortAsc, setSortAsc] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [soundOn, setSoundOn] = useState(boot.soundOn);
  const [fx, setFx] = useState<{ token: number; rarity: RarityId; boom?: boolean; bust?: boolean } | null>(null);
  const [teamFx, setTeamFx] = useState<{ token: number; team: Team; rarity: RarityId } | null>(null);
  const [chargeUid, setChargeUid] = useState<string | null>(null);
  const [burstUid, setBurstUid] = useState<string | null>(null);
  const [tearHot, setTearHot] = useState(false);
  const [inspectCard, setInspectCard] = useState<Card | null>(null);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  latestRef.current = { v: 2, collection, openedCounts, soundOn, cardSeq, readyPack, balance, pulls, supers, locked, meta };
  const busyRef = useRef(false);
  const genRef = useRef(0);

  const setReveal = (c: RCard | null): void => { revealRef.current = c; setRevealState(c); };
  const clearBusy = useCallback(() => { busyRef.current = false; setBusy(false); }, []);

  useEffect(() => {
    let asked = false;
    const on = (): void => {
      unlockAudio();
      if (asked) return;
      asked = true;
      void askStorageAccess().then((granted) => {
        if (granted && persistReadyRef.current) {
          const ok = writeSave(latestRef.current);
          setPersistOk(ok);
          if (ok) setSavedAt({ t: Date.now(), manual: false });
        }
      });
    };
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const evs = ["pointerdown", "touchend", "click"];
    for (const e of evs) window.addEventListener(e, on, opts);
    return () => { for (const e of evs) window.removeEventListener(e, on, opts); };
  }, []);

  useEffect(() => {
    if (!persistReady) return;
    const ok = writeSave({ v: 2, collection, openedCounts, soundOn, cardSeq, readyPack, balance, pulls, supers, locked, meta });
    setPersistOk(ok);
    if (ok) setSavedAt({ t: Date.now(), manual: false });
    void lastIdbWrite.then((idb) => {
      if (!idb) return;
      setPersistOk(true);
      setSavedAt((prev) => prev ?? { t: Date.now(), manual: false });
    });
  }, [persistReady, collection, openedCounts, soundOn, readyPack, balance, pulls, supers, locked, meta]);

  useEffect(() => {
    const flush = (): void => { if (persistReadyRef.current) writeSave(latestRef.current); };
    const onVis = (): void => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // Regular 1/1s stay used up forever once pulled. Chase 1/1s are only taken while one is in the collection: sell it and it goes back into the pot.
  const heldSupers = useMemo(() => collection.filter((c) => c.rarity === "super").map((c) => c.playerId), [collection]);
  const takenSuper = useMemo(() => new Set(supers.filter((id) => !CHASE_IDS.has(id) || heldSupers.includes(id))), [supers, heldSupers]);

  const triggerFx = useCallback((rarity: RarityId, uid?: string, boom = false, bust = false) => {
    try { playSound(bust ? "bust" : boom ? "boom" : rarity, soundRef.current); } catch { /* ignore */ }
    const token = Date.now();
    setFx({ token, rarity, boom, bust });
    if (uid) setBurstUid(uid);
    const wait = { base: 1300, silver: 1700, kings: 1800, walls: 1800, phenom: 1800, gold: 2000, potw: 2400, auto: 2600, super: 3200 }[rarity] + (boom ? 700 : 0);
    window.setTimeout(() => {
      setFx((prev) => (prev && prev.token === token ? null : prev));
      if (uid) setBurstUid((cur) => (cur === uid ? null : cur));
    }, wait);
  }, []);

  const teamSeen = useRef(new Set<string>());
  const triggerTeam = useCallback((card: Card) => {
    if (isBust(card) || teamSeen.current.has(card.uid)) return;
    teamSeen.current.add(card.uid);
    const team = playerOf(card.playerId).team;
    try { playTeam(team, soundRef.current, card.rarity); } catch { /* ignore */ }
    const token = Date.now();
    setTeamFx({ token, team, rarity: card.rarity });
    window.setTimeout(() => {
      setTeamFx((prev) => (prev && prev.token === token ? null : prev));
    }, Math.round(teamDur(card.rarity) * 1000) + 80);
  }, []);

  const flipNow = useCallback(() => {
    const cur = revealRef.current;
    if (!cur || cur.flipped) return;
    const card: RCard = { ...cur, flipped: true };
    revealRef.current = card;
    setRevealState(card);
    setChargeUid(null);
    setTearHot(false);
    triggerFx(card.rarity, card.uid, card.packId === "boom" && (card.rarity === "auto" || card.rarity === "super"), card.packId === "boom" && card.rarity === "base");
    triggerTeam(card);
    if (isDal(card)) setCowboysHit(1);
    clearBusy();
  }, [triggerFx, triggerTeam, clearBusy]);

  // Open 10 shows every card face up, so a Boom or Bust bust "reveals" when you tap it open: play the bust effect once per card. Team effects play once for the best card, or on first tap-to-enlarge for the others.
  const bustSeen = useRef(new Set<string>());
  useEffect(() => {
    if (!inspectCard || stage !== "multi") return;
    if (isBust(inspectCard)) {
      if (bustSeen.current.has(inspectCard.uid)) return;
      bustSeen.current.add(inspectCard.uid);
      triggerFx("base", undefined, false, true);
      return;
    }
    triggerTeam(inspectCard);
  }, [inspectCard, stage, triggerFx, triggerTeam]);

  const resetView = (): void => {
    setReveal(null); setMulti([]); setFx(null); setTeamFx(null); setChargeUid(null); setBurstUid(null); setTearHot(false); setCowboysHit(0); setNotice(""); setConfirmSell(""); teamSeen.current = new Set();
  };

  const startOpen = (freeId?: PackId): void => {
    if (busyRef.current || (!readyPack && !freeId)) return;
    const id = freeId ?? readyPack?.packId ?? "standard";
    const price = freeId ? 0 : PB[id].price;
    if (balance < price) { setNotice("Not enough funds — the " + PB[id].name + " costs " + money(price) + " and you have " + money(balance) + ". Sell cards from your binder to get more."); return; }
    unlockAudio();
    resetView();
    setConfirmReset(false);
    if (!freeId) playSound("tear", soundRef.current);
    let card: Card;
    try { card = drawCard(id, new Set(takenSuper)); } catch { return; }
    genRef.current += 1;
    const gen = genRef.current;
    busyRef.current = true;
    setBusy(true);
    setReadyPack(null);
    setPackId(id);
    setCollection((prev) => prev.concat([card]));
    setBalance((b) => b - price);
    addPulls([card]);
    setOpenedCounts((s) => ({ ...s, [id]: s[id] + 1 }));
    setTearHot(card.rarity === "super");
    setReveal({ ...card, flipped: false });
    setStage("tearing");
    window.setTimeout(() => { if (genRef.current === gen) { setTearHot(false); setStage("reveal"); } }, rm() ? 120 : 720);
    // Safety net: if anything stalls, show the card and unlock the UI.
    window.setTimeout(() => {
      if (genRef.current !== gen || !busyRef.current) return;
      setStage("reveal");
      flipNow();
      clearBusy();
    }, 8000);
  };

  const openTen = (): void => {
    const id = readyPack?.packId ?? selectedPack;
    if (busyRef.current || !id) return;
    if (balance < PB[id].price * 10) { setNotice("Not enough funds — 10 " + PB[id].name + "s cost " + money(PB[id].price * 10) + " and you have " + money(balance) + "."); return; }
    unlockAudio();
    resetView();
    setConfirmReset(false);
    genRef.current += 1;
    const taken = new Set(takenSuper);
    const cards: Card[] = [];
    try { for (let i = 0; i < 10; i++) cards.push(drawCard(id, taken)); } catch { return; }
    setReadyPack(null);
    setPackId(id);
    setCollection((prev) => prev.concat(cards));
    setBalance((b) => b - PB[id].price * 10);
    addPulls(cards);
    setOpenedCounts((s) => ({ ...s, [id]: s[id] + 10 }));
    setMulti(cards);
    setMultiN(10);
    setStage("multi");
    setCowboysHit(cards.filter(isDal).length);
    const top = cards.reduce((a, b) => (RB[b.rarity].rank > RB[a.rarity].rank ? b : a));
    triggerFx(top.rarity, undefined, id === "boom" && (top.rarity === "auto" || top.rarity === "super"));
    triggerTeam(top);
  };

  // Auto-reveal after the tear; rarer cards charge up longer first.
  useEffect(() => {
    if (stage !== "reveal" || !reveal || reveal.flipped) return;
    const gen = genRef.current;
    const r = reveal.rarity;
    setChargeUid(r === "gold" || isIns(r) || r === "potw" || r === "auto" || r === "super" ? reveal.uid : null);
    const delay = rm() ? (r === "super" ? 700 : 280) : { base: 620, silver: 700, kings: 820, walls: 820, phenom: 820, gold: 800, potw: 900, auto: 950, super: 2000 }[r] + (reveal.packId === "boom" && (r === "auto" || r === "super") ? 500 : 0);
    const t = window.setTimeout(() => { if (genRef.current === gen) flipNow(); }, delay);
    return () => window.clearTimeout(t);
  }, [stage, reveal, flipNow]);

  const opening = stage === "tearing" || (stage === "reveal" && busy);
  const freeAt = freeReadyAt(meta.daily);
  const dailyReady = Date.now() >= freeAt;
  // One free pack with a 5-minute cooldown: Standard 63%, Rising Stars 16%, Stars 16%, Legends 5% (never POTW, Boom or Bust, or Season).
  const claimDaily = (): void => {
    if (!dailyReady || opening || busyRef.current) return;
    unlockAudio();
    let n = Math.random() * 100, id: PackId = "standard";
    for (const [pid, w] of [["standard", 63], ["rookie", 16], ["stars", 16], ["legends", 5]] as [PackId, number][]) { n -= w; if (n < 0) { id = pid; break; } }
    setMeta((m) => ({ ...m, daily: String(Date.now()), dailyN: m.dailyN + 1 }));
    playSound("daily", soundRef.current, true);
    setNotice("🎁 Free pack: " + packOf(id).name + " (free)");
    startOpen(id);
  };
  const claimSet = (s: SetDef, n: number): void => {
    if (meta.sets.includes(s.id) || n < s.players.length) return;
    setMeta((m) => ({ ...m, sets: m.sets.concat([s.id]) }));
    setBalance((b) => b + s.reward);
    playSound("setdone", soundRef.current, true);
    setToastQ((q) => q.concat([{ text: "🏅 Set complete: " + s.name + " +" + money(s.reward), token: Date.now() + Math.random(), tab: "sets", target: "set-" + s.id }]));
  };

  const pickPack = (id: PackId): void => {
    setSelectedPack(id);
    setOddsPack(null);
    setConfirmReset(false);
    if (opening) return;
    setReadyPack({ packId: id });
    setPackId(id);
    if (stage !== "idle") { genRef.current += 1; setStage("idle"); resetView(); }
  };

  const backToStore = (again: boolean): void => {
    if (opening) return;
    genRef.current += 1;
    setStage("idle");
    resetView();
    clearBusy();
    if (again) { setReadyPack({ packId }); setSelectedPack(packId); }
  };

  const resetCollection = (): void => {
    if (locked) return;
    if (!confirmReset) { setConfirmReset(true); return; }
    genRef.current += 1;
    cardSeq = 0;
    setCollection([]);
    setOpenedCounts(zeroCounts());
    setBalance(START_BAL);
    setLocked(true);
    setPulls({});
    setSupers([]);
    setMeta((m) => ({ ...defaultMeta(), daily: m.daily, dailyN: m.dailyN }));
    achDone.current = new Set<string>();
    setReadyPack(null);
    setStage("idle");
    resetView();
    setConfirmReset(false);
    clearBusy();
    setSelectedPack(null);
    setOddsPack(null);
    setInspectCard(null);
    writeSave(defaultSave(), true);
  };

  const addPulls = (cards: Card[]): void => {
    const sc = cards.filter((c) => c.rarity === "super").map((c) => c.playerId);
    if (sc.length > 0) setSupers((prev) => Array.from(new Set(prev.concat(sc))));
    setPulls((prev) => {
      const n = { ...prev };
      for (const c of cards) { const k = c.packId + "|" + c.rarity; n[k] = (n[k] ?? 0) + 1; }
      return n;
    });
  };

  const sellCards = (cards: Card[]): void => {
    if (cards.length === 0) return;
    const ids = new Set(cards.map((c) => c.uid));
    const total = cards.reduce((s, c) => s + cardVal(c), 0);
    const first = cards[0];
    setCollection((prev) => prev.filter((c) => !ids.has(c.uid)));
    setMulti((prev) => prev.filter((c) => !ids.has(c.uid)));
    setBalance((b) => Math.round(b + total));
    setConfirmSell("");
    setNotice("Sold " + (first && cards.length === 1 ? playerOf(first.playerId).name : cards.length + " cards") + " for " + money(total) + ".");
  };

  const sellRevealed = (): void => {
    if (!reveal || !reveal.flipped) return;
    sellCards([reveal]);
    genRef.current += 1;
    setStage("idle"); setReveal(null); setFx(null); setTeamFx(null); setChargeUid(null); setBurstUid(null); setCowboysHit(0);
    setReadyPack({ packId }); setSelectedPack(packId);
  };

  // Pulled cards are already in the binder; Keep just confirms it and moves on.
  const keepRevealed = (): void => {
    genRef.current += 1;
    setStage("idle"); setReveal(null); setFx(null); setTeamFx(null); setChargeUid(null); setBurstUid(null); setCowboysHit(0); setConfirmSell("");
    setReadyPack({ packId }); setSelectedPack(packId);
    setNotice("Added to binder ✓");
  };

  const keepOne = (c: Card): void => {
    setKept((k) => k.concat([c.uid]));
    setNotice("Added to binder ✓");
  };

  const keepAll = (): void => {
    const n = multi.length;
    genRef.current += 1;
    setStage("idle"); setMulti([]); setFx(null); setTeamFx(null); setCowboysHit(0); setConfirmSell("");
    setReadyPack({ packId }); setSelectedPack(packId);
    setNotice("Added " + n + " cards to binder ✓");
  };

  const sellAllMulti = (): void => {
    if (multi.length === 0) return;
    sellCards(multi);
    genRef.current += 1;
    setStage("idle"); setFx(null); setTeamFx(null); setCowboysHit(0);
    setReadyPack({ packId }); setSelectedPack(packId);
  };

  const snapshot = (): Save => ({ v: 2, collection, openedCounts, soundOn, cardSeq, readyPack, balance, pulls, supers, locked, meta });

  useEffect(() => {
    let live = true;
    void idbBootRead().then((json) => {
      if (!live) return;
      const idbSave = json ? loadSave(json) : null;
      const syncSave = loadSave();
      const best = [syncSave, idbSave, memSave, latestRef.current].reduce((a, b) => {
        if (!b) return a;
        if (!a || saveScore(b) > saveScore(a)) return b;
        return a;
      }, null as Save | null) ?? defaultSave();
      if (saveScore(best) > saveScore(boot) || (best.collection.length > 0 && boot.collection.length === 0)) applyRestore(best, true);
      persistReadyRef.current = true;
      setPersistReady(true);
    });
    return () => { live = false; };
  }, []);

  const saveNow = (): void => {
    const ok = writeSave(snapshot());
    setPersistOk(ok);
    const t = Date.now();
    if (ok) { setSavedAt({ t, manual: true }); setNotice("Saved ✓"); }
    else {
      void askStorageAccess().then((granted) => {
        if (!granted) return;
        const ok2 = writeSave(snapshot());
        setPersistOk(ok2);
        if (ok2) { setSavedAt({ t: Date.now(), manual: true }); setNotice("Saved ✓"); }
      });
      copyBackup("Backup code copied");
    }
  };

  const copyBackup = (msg?: string): void => {
    const okMsg = typeof msg === "string" ? msg : "Backup code copied ✓ Keep it somewhere safe.";
    const code = encodeBackup(snapshot());
    setBackupCode(code);
    try {
      if (legacyCopy(code)) setNotice(okMsg);
      else void navigator.clipboard.writeText(code).then(() => setNotice(okMsg)).catch(() => setNotice("Couldn't copy automatically — select the code below and copy it."));
    } catch { setNotice("Couldn't copy automatically — select the code below and copy it."); }
  };

  const shareBackup = (): void => {
    const code = encodeBackup(snapshot());
    setBackupCode(code);
    try { void navigator.share({ title: "Gridiron Legends backup", text: code }).catch(() => undefined); } catch { setNotice("Couldn't share from here — use Copy backup code instead."); }
  };

  const startRestore = (): void => {
    const json = decodeBackup(restoreText);
    if (!json) { setNotice("Couldn't restore — that isn't a valid backup code."); return; }
    setPendingRestore(loadSave(json));
  };

  const applyRestore = (s: Save, silent = false): void => {
    genRef.current += 1;
    cardSeq = Math.max(cardSeq, s.cardSeq);
    setCollection(s.collection); setOpenedCounts(s.openedCounts); setBalance(s.balance); setPulls(s.pulls); setSupers(s.supers); setSoundOn(s.soundOn); setLocked(s.locked); setMeta(s.meta); achDone.current = new Set(s.meta.ach);
    setReadyPack(null); setStage("idle"); resetView(); clearBusy(); setSelectedPack(null); setOddsPack(null); setInspectCard(null);
    setPendingRestore(null); setRestoreText(""); setBackupCode("");
    if (!silent) setNotice("Restored " + s.collection.length + " cards and " + money(s.balance) + " from your backup.");
  };

  const bailout = (): void => {
    setBalance((b) => b + BAILOUT);
    setNotice("Added a " + money(BAILOUT) + " bailout.");
  };

  // ---- stats ----
  const totalPacks = PIDS.reduce((n, id) => n + openedCounts[id], 0);
  const packMix = PACKS.filter((p) => openedCounts[p.id] > 0).map((p) => openedCounts[p.id] + " " + p.name).join(" · ") || "None yet";
  const best = collection.length === 0 ? null : collection.reduce((a, b) => {
    const d = RB[b.rarity].rank - RB[a.rarity].rank;
    return d !== 0 ? (d > 0 ? b : a) : cardOvr(b) > cardOvr(a) ? b : a;
  });
  const uniquePlayers = new Set(collection.map((c) => c.playerId)).size;
  const pulledOf = (r: RarityId): number => PIDS.reduce((n, id) => n + (packFilter === "ALL" || packFilter === id ? pulls[id + "|" + r] ?? 0 : 0), 0);
  const totalPulled = Object.keys(pulls).reduce((n, k) => n + (pulls[k] ?? 0), 0);
  const binderValue = collection.reduce((s, c) => s + cardVal(c), 0);
  // Average rating per pull: the card's overall (as shown on the card) over every card still in the binder, overall and by the pack it came from. Sold cards are not in the history, so they are not counted.
  const ovrBy: Record<string, [number, number]> = {};
  let ovrSum = 0;
  for (const c of collection) { const o = cardOvr(c); ovrSum += o; const en = ovrBy[c.packId] ?? [0, 0]; en[0] += o; en[1] += 1; ovrBy[c.packId] = en; }
  const avgOvr = collection.length === 0 ? "—" : (ovrSum / collection.length).toFixed(1);
  const ovrRows = PACKS.filter((p) => ovrBy[p.id]).map((p) => { const en = ovrBy[p.id] ?? [0, 1]; return [p.name, String(en[1]), (en[0] / en[1]).toFixed(1)]; });
  const dupList: Card[] = [];
  const seenKeys = new Set<string>();
  for (const c of collection.slice().sort((a, b) => a.seq - b.seq)) { const k = c.playerId + "|" + c.rarity; if (seenKeys.has(k)) dupList.push(c); else seenKeys.add(k); }
  const dupTotal = dupList.reduce((s, c) => s + cardVal(c), 0);
  const baseList = collection.filter((c) => c.rarity === "base");
  const baseTotal = baseList.reduce((s, c) => s + cardVal(c), 0);
  const statsCards = RARITIES.reduce((n, r) => n + pulledOf(r.id), 0);
  const rateRows = RARITIES.map((r) => {
    let expected = 0;
    for (const id of PIDS) if (packFilter === "ALL" || packFilter === id) expected += (openedCounts[id] * r.tenths[id]) / 1000;
    const pulled = pulledOf(r.id);
    return [r.name, statsCards === 0 ? "—" : formatPct((expected / statsCards) * 100), expected === 0 ? "—" : expected.toFixed(1), String(pulled), statsCards === 0 ? "—" : formatPct((pulled / statsCards) * 100)];
  });
  const pieParts = RARITIES.map((r) => ({ label: r.short, value: pulledOf(r.id) })).filter((x) => x.value > 0).map((x) => ({ ...x, display: String(x.value) }));

  const setProg = useMemo(() => {
    const any = new Set(collection.map((c) => c.playerId));
    const by: Record<string, Set<string>> = {};
    for (const c of collection) { const s = by[c.rarity] ?? new Set<string>(); s.add(c.playerId); by[c.rarity] = s; }
    return Object.fromEntries(SETS.map((s) => { const own = s.need ? by[s.need] : any; return [s.id, own ? s.players.filter((id) => own.has(id)).length : 0]; })) as Record<string, number>;
  }, [collection]);
  const achCtx: AchCtx = { packs: totalPacks, opened: openedCounts, cards: collection, value: binderValue, unique: uniquePlayers, sets: meta.sets.length, daily: meta.dailyN };
  const revealPending = stage === "tearing" || (stage === "reveal" && reveal !== null && !reveal.flipped);
  useEffect(() => {
    if (revealPending) return;
    const fresh = ACH.filter((d) => !achDone.current.has(d.id) && d.ok(achCtx));
    if (fresh.length === 0) return;
    for (const d of fresh) achDone.current.add(d.id);
    const coins = fresh.reduce((s, d) => s + d.reward, 0);
    setMeta((m) => ({ ...m, ach: Array.from(new Set(m.ach.concat(fresh.map((d) => d.id)))) }));
    setBalance((b) => b + coins);
    const items: AppToast[] = fresh.map((d, i) => ({ text: "🏆 " + d.name + " +" + d.reward, token: Date.now() + i + Math.random(), tab: "achievements", target: "ach-" + d.id }));
    window.setTimeout(() => { setToastQ((q) => q.concat(items)); playSound("ach", soundRef.current, true); }, 700);
  }, [collection, openedCounts, meta, revealPending]);
  useEffect(() => {
    if (!toast) return;
    // Queued toasts show one after another, a little faster when more are waiting.
    const t = window.setTimeout(() => setToastQ((q) => q.slice(1)), toastQ.length > 1 ? 2800 : 4200);
    return () => window.clearTimeout(t);
  }, [toast?.token, toastQ.length > 1]);
  // Tapping a toast dismisses it, switches to its tab, smooth-scrolls to the item and pulses it for about 1.5s.
  const openToast = (t: AppToast): void => {
    setToastQ((q) => q.filter((x) => x.token !== t.token));
    pickTab(t.tab, false);
    let tries = 0;
    const go = (): void => {
      const el = document.getElementById(t.target);
      if (el) {
        el.scrollIntoView({ behavior: rm() ? "auto" : "smooth", block: "center" });
        setHi(t.target);
        window.setTimeout(() => setHi((cur) => (cur === t.target ? "" : cur)), 1700);
        return;
      }
      tries += 1;
      if (tries < 12) window.setTimeout(go, 60);
    };
    window.setTimeout(go, 60);
  };

  const binder = useMemo(() => {
    const map = new Map<string, { card: Card; count: number; newest: number }>();
    for (const c of collection) {
      const key = c.playerId + "|" + c.rarity;
      const prev = map.get(key);
      if (prev) { prev.count += 1; if (c.seq >= prev.newest) { prev.newest = c.seq; prev.card = c; } } else map.set(key, { card: c, count: 1, newest: c.seq });
    }
    const q = query.trim().toLowerCase();
    const list = Array.from(map.values()).filter((e) => {
      const pl = playerOf(e.card.playerId);
      return (teamFilter === "ALL" || pl.team.abbr === teamFilter) && (rarityFilter === "ALL" || e.card.rarity === rarityFilter) && (packFilter === "ALL" || e.card.packId === packFilter) && (!q || pl.name.toLowerCase().includes(q));
    });
    const dir = sortAsc ? 1 : -1;
    list.sort((a, b) => {
      const pa = playerOf(a.card.playerId), pb = playerOf(b.card.playerId);
      if (sortKey === "valueHi" || sortKey === "valueLo") {
        const d = cardVal(a.card) - cardVal(b.card);
        if (d !== 0) return sortKey === "valueHi" ? -d : d;
        const rr = RB[b.card.rarity].rank - RB[a.card.rarity].rank;
        return rr !== 0 ? rr : pa.name.localeCompare(pb.name);
      }
      const cmp = sortKey === "rarity" ? RB[a.card.rarity].rank - RB[b.card.rarity].rank
        : sortKey === "rating" ? cardOvr(a.card) - cardOvr(b.card)
        : sortKey === "newest" ? a.newest - b.newest
        : sortKey === "name" ? pa.name.localeCompare(pb.name)
        : sortKey === "team" ? pa.team.name.localeCompare(pb.team.name)
        : sortKey === "pos" ? pa.pos.localeCompare(pb.pos)
        : sortKey === "pack" ? PIDS.indexOf(a.card.packId) - PIDS.indexOf(b.card.packId)
        : a.count - b.count;
      return cmp !== 0 ? cmp * dir : pa.name.localeCompare(pb.name);
    });
    return list;
  }, [collection, teamFilter, rarityFilter, packFilter, sortKey, sortAsc, query]);
  const shownKeys = new Set(binder.map((e) => e.card.playerId + "|" + e.card.rarity));
  const shownList = collection.filter((c) => shownKeys.has(c.playerId + "|" + c.rarity));
  const shownTotal = shownList.reduce((s, c) => s + cardVal(c), 0);
  const filtersOn = teamFilter !== "ALL" || rarityFilter !== "ALL" || packFilter !== "ALL" || query.trim() !== "";

  const packOptions = [{ value: "ALL", label: "All packs" }, ...PACKS.map((p) => ({ value: p.id, label: p.name }))];
  const oddsFocus = oddsPack ?? selectedPack ?? packId;
  const multiTop: RarityId | null = multi.length ? multi.reduce((a, b) => (RB[b.rarity].rank > RB[a.rarity].rank ? b : a)).rarity : null;
  const cowboyCard = reveal && reveal.flipped && isDal(reveal) ? reveal : multi.find(isDal);
  // The Cowboys banner follows the Dallas cards actually on screen, so selling them clears it.
  const dalShown = stage === "reveal" ? (reveal && reveal.flipped && isDal(reveal) ? 1 : 0) : stage === "multi" ? multi.filter(isDal).length : 0;
  const selected = selectedPack ? packOf(selectedPack) : null;
  const curPack = packOf(readyPack?.packId ?? packId);
  const canBuy1 = balance >= curPack.price;
  const canBuy10 = balance >= curPack.price * 10;
  const multiTotal = multi.reduce((s, c) => s + cardVal(c), 0);
  const savedText = savedAt ? (savedAt.manual ? "Saved ✓ at " : "Last saved ") + timeStr(savedAt.t) + (savedAt.manual ? "" : " (autosave on)") : "";
  const shake = fx && (fx.rarity === "super" || fx.rarity === "auto" || fx.rarity === "potw") ? (fx.rarity === "super" && !rm() ? "glBigShake 0.75s ease" : "glScreenShake 0.45s ease") : undefined;

  return (
    <Page title="Gridiron Legends 26" width="column">
      <style>{CSS}</style>
      {fx ? <ScreenFx r={fx.rarity} token={fx.token} dal={cowboysHit > 0} boom={fx.boom === true} bust={fx.bust === true} /> : null}
      {teamFx ? <TeamFx team={teamFx.team} rarity={teamFx.rarity} token={teamFx.token} /> : null}
      <div style={{ marginTop: -6 }}>
        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15, letterSpacing: 0.3, color: "#d4920a" }}>Version {VERSION}</div>
        <button type="button" onClick={saveNow} aria-label="Don't forget to save the game. Tap to save." style={{ appearance: "none", display: "inline-block", marginTop: 8, padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(255,226,122,0.55)", background: "linear-gradient(180deg, #0b2447 0%, #07303a 100%)", color: "#ffe27a", font: "inherit", fontSize: 12, fontWeight: 700, lineHeight: 1.3, cursor: "pointer", touchAction: "manipulation", WebkitTapHighlightColor: "transparent", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>Don't forget to save the game 😁</button>
        <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.4, opacity: 0.6 }}>Fan-made simulator. Not affiliated with the NFL or any card company.</div>
      </div>
      {inspectCard ? <InspectModal card={inspectCard} onClose={() => setInspectCard(null)} onSell={(c: Card) => { sellCards([c]); setInspectCard(null); }} /> : null}
      <div ref={tabsRef} className="gl-tabs" role="tablist" aria-label="Sections">
        {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className="gl-tab" onClick={() => pickTab(id)}>{label}</button>)}
      </div>
      {tab === "store" ? (
      <>
      <Section heading="Store">
        <div className="gl-store">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Button label="💾 Save" variant="primary" onClick={saveNow} />
              {!persistOk && persistReady ? <Button label="Copy backup code" onClick={() => copyBackup()} /> : null}
              <Toggle label={locked ? "Collection locked" : "Collection unlocked"} value={locked} onChange={(v: boolean) => { setLocked(v); if (v) setConfirmReset(false); }} />
              {locked ? null : <Button label={confirmReset ? "Confirm reset" : "Reset collection"} onClick={resetCollection} disabled={opening} />}
              {confirmReset ? <Button label="Cancel" onClick={() => setConfirmReset(false)} /> : null}
              <Toggle label={soundOn ? "Sound on" : "Sound muted"} value={soundOn} onChange={(v: boolean) => { setSoundOn(v); if (v) unlockAudio(); }} />
              <Button label="Test sound" onClick={() => { unlockAudio(); playSound("gold", true); }} />
              <span style={{ fontSize: 12, opacity: 0.8 }}>{savedText}</span>
            </div>
          </div>
          {!persistOk && persistReady ? (
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12, background: "rgba(90,30,0,0.55)", border: "1px solid rgba(255,180,80,0.55)", color: "#ffe9c8", fontSize: 13, lineHeight: 1.4 }}>
              This page couldn't keep a durable save in this browser, which can happen in iPhone Safari. Tap Save and copy a backup code (also on the Collection tab), then paste it into Restore the next time you open the game, or your progress may be lost when you close the page.
            </div>
          ) : null}
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(125,255,176,0.35)", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 800, fontStyle: "italic", textTransform: "uppercase" }}>🎁 Free pack</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{dailyReady ? "Ready: one free pack (Standard, Rising Stars, Stars or Legends; mostly Standard). After you open it, the next one is ready in 5:00." : <>Next free pack in <FreeClock until={freeAt} onReady={() => setDayTick((n) => n + 1)} />.</>} · {meta.dailyN} claimed so far</div>
            </div>
            <Button label={dailyReady ? "Claim free pack" : "On cooldown"} variant="primary" onClick={claimDaily} disabled={!dailyReady || opening} />
          </div>
          {balance < MIN_PRICE && collection.length === 0 ? <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><span style={{ fontSize: 13 }}>You can't afford a pack and have no cards to sell.</span><Button label={"Get " + money(BAILOUT) + " bailout"} variant="primary" onClick={bailout} /></div> : null}
          {(() => { const nx = nextSeasonChange(); return <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 12, background: "rgba(0,0,0,0.22)", border: "1px solid " + SEASON_THEME[seasonOf()].trim, fontSize: 13, lineHeight: 1.4 }}><div style={{ fontWeight: 800, fontStyle: "italic", textTransform: "uppercase" }}>🎟 Season pack · {SEASON_THEME[seasonOf()].name}</div><div style={{ opacity: 0.85, marginTop: 3 }}>Active now ({SEASON_THEME[seasonOf()].range}). Changes to {SEASON_THEME[nx.id].name} on {formatLongDate(nx.at)}. Pulled Season cards stay in your collection after it switches, and only this season's 3 ★ chase 1/1s can be pulled until then.</div></div>; })()}
          <div className="gl-grid3" style={{ marginTop: 16 }}>
            {PACKS.map((pack) => (
              <div key={pack.id} style={{ minWidth: 0 }}>
                <button type="button" className={"gl-tile" + (selectedPack === pack.id ? " gl-sel" : "")} onClick={() => pickPack(pack.id)}>
                  <PackThumb pack={pack} />
                  <div className="gl-tile-name">{pack.id === "season" ? "Season Pack · " + SEASON_THEME[seasonOf()].name : pack.name}</div>
                  <div className="gl-blurb">{pack.blurb}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 6, color: "#ffe27a" }}>{money(pack.price)} <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.75 }}>per pack</span></div>
                </button>
                <button type="button" className="gl-odds" onClick={() => { setOddsPack(oddsPack === pack.id ? null : pack.id); setSelectedPack(pack.id); }}>Odds</button>
              </div>
            ))}
          </div>
          {selected ? (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontWeight: 800, fontStyle: "italic", textTransform: "uppercase" }}>{selected.name}</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{selected.blurb} 1 card · {selected.hint} · {money(selected.price)} per pack (10 packs {money(selected.price * 10)}).</div>
              <div style={{ marginTop: 10, fontSize: 13 }}>{readyPack && readyPack.packId === selected.id ? "Your " + selected.name + " is ready below — tap the sealed pack to open it." : "Tap the tile to get a pack, then rip it below."}</div>
              <ChaseRow packId={selected.id} supers={heldSupers} />
              {selected.id === "boom" ? <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>A 1/1 here can be any of the {HOME_CHASE_IDS.size} ★ home chase 1/1s (see the Chase Cards tab). Seasonal chase cards are only in the Season pack.</div> : selected.id === "season" ? <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>Active season: {SEASON_THEME[seasonOf()].name} ({SEASON_THEME[seasonOf()].range}). Changes to {SEASON_THEME[nextSeasonChange().id].name} on {formatLongDate(nextSeasonChange().at)}. Only this season's 3 ★ chase 1/1s can be pulled now.</div> : null}
            </div>
          ) : <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>Tap a pack to select it.</div>}
          {oddsPack ? (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#fbf8f1", color: "#1a140c" }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Odds for the {PB[oddsFocus].name}</div>
              {RARITIES.filter((r) => r.tenths[oddsFocus] > 0).map((r) => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "5px 0", borderTop: "1px solid rgba(0,0,0,0.08)", fontSize: 13 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: r.id === "super" ? RAINBOW : r.frame }} />{r.name}</span>
                  <span style={{ fontWeight: 700 }}>{formatPct(r.tenths[oddsFocus] / 10)}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700 }}>Price {money(PB[oddsFocus].price)} · average card value {money(evOf(oddsFocus))} ({Math.round((evOf(oddsFocus) / PB[oddsFocus].price) * 100)}% of price)</div>
              <div style={{ fontSize: 12, marginTop: 8, opacity: 0.75 }}>Chance per pack. The cheapest card in this pack is worth {money(Math.min(...poolOf(oddsFocus).map((p) => valueOf(p, oddsFocus === "potw" ? "silver" : "base", oddsFocus))))}{oddsFocus === "potw" ? "." : " and every 1/1 is worth at least " + money(oddsFocus === "boom" ? BOOM_FLOOR.super : 1000) + "."} Card values swing widely: most pulls are worth less than the pack, and a rare hit is worth far more. {oddsFocus === "standard" ? "The Standard pack draws from every player in the set. Player of the Week cards (green) can drop in any pack at 0.4%." : oddsFocus === "potw" ? "Silver cards come from every player in the set; Player of the Week cards come from this season's weekly award winners." : oddsFocus === "boom" ? "Boom or Bust draws from every player in the set. Base is the Bust, worth only a few coins. An Autograph or 1/1 is the Boom: every Auto is worth at least " + money(BOOM_FLOOR.auto) + " and every 1/1 at least " + money(BOOM_FLOOR.super) + ". A 1/1 here can also be one of the " + CHASE_IDS.size + " chase 1/1s. Player of the Week cards (green) drop at 0.4%." : oddsFocus === "season" ? "The Season pack draws from this season's themed player list. Its three ★ chase 1/1s are unique to this season and cannot be pulled after the season changes (cards you already pulled stay in your binder). Player of the Week cards (green) can drop at 0.4%." : "Each pack draws only from its own player pool, never shared with the other packs. Player of the Week cards (green) can drop in any pack at 0.4%."}</div>
            </div>
          ) : null}
        </div>
      </Section>

      <Section heading="The rip">
        <div data-gl-stage={stage} style={{ position: "relative", maxWidth: 520, margin: "0 auto", animation: shake }}>
          {stage === "tearing" || (stage === "idle" && readyPack) ? (
            <>
              <PackArt tearing={stage === "tearing"} packId={readyPack?.packId ?? packId} charged={tearHot && stage === "tearing"} disabled={opening} short={!canBuy1} onOpen={startOpen} />
              {stage === "idle" ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <ChaseRow packId={curPack.id} supers={heldSupers} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                    <Button label={"Open pack · " + money(curPack.price)} variant="primary" onClick={startOpen} disabled={!canBuy1} />
                    <Button label={"Open 10 at once · " + money(curPack.price * 10)} onClick={openTen} disabled={!canBuy10} />
                  </div>
                  {!canBuy1 ? <Text>Not enough funds — a {curPack.name} costs {money(curPack.price)} and you have {money(balance)}. Sell cards from your binder to get more.</Text> : !canBuy10 ? <Text>Not enough funds to open 10 — that costs {money(curPack.price * 10)} and you have {money(balance)}.</Text> : null}
                </div>
              ) : null}
            </>
          ) : stage === "idle" ? <Text>Pick a pack from the Store to start a rip. Your binder is saved on this device.</Text> : null}

          {stage === "reveal" && reveal ? (
            <div style={{ position: "relative", minHeight: 420, padding: "28px 8px 20px" }}>
              <Backdrop r={reveal.rarity} charged={chargeUid === reveal.uid} burst={!!fx} token={fx?.token ?? 1} />
              <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "center" }}>
                <div style={{ width: "min(78%, 240px)" }}><FlipCard card={reveal} onFlip={flipNow} charged={chargeUid === reveal.uid} burst={burstUid === reveal.uid} /></div>
              </div>
              {fx && (fx.rarity === "auto" || fx.rarity === "super" || fx.rarity === "potw" || isIns(fx.rarity)) ? (
                <div aria-live="polite" style={{ position: "relative", zIndex: 5, margin: "14px auto 0", width: "min(92%, 320px)", textAlign: "center", padding: fx.boom || fx.rarity === "super" ? 12 : "9px 12px", borderRadius: 12, pointerEvents: "none", fontFamily: theme.font.family, fontWeight: 800, letterSpacing: 1.4, fontSize: fx.boom ? 32 : fx.rarity === "super" ? 26 : 18, lineHeight: 1.1, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.45)", background: fx.boom ? "linear-gradient(90deg, #4a0000, #ff3b1f, #ffb000, #ff3b1f, #4a0000)" : fx.rarity === "super" ? "linear-gradient(90deg, #ff4d6d, #ffb000, #3dff8a, #3dc6ff, #c44dff)" : isIns(fx.rarity) ? "linear-gradient(90deg, rgba(0,0,0,0.4), " + RB[fx.rarity].frame + ", rgba(0,0,0,0.4))" : fx.rarity === "potw" ? "linear-gradient(90deg, #0b6b3a, #1fd37a, #0b6b3a)" : "linear-gradient(90deg, #0b5c4a, #1fa88a, #0b5c4a)", animation: "glBannerIn " + sp("0.55s", "0.35s") + " ease both" }}>
                  {fx.boom ? <>💥 BOOM! 💥<div style={{ fontSize: 13, letterSpacing: 2, marginTop: 4 }}>{reveal && isChaseCard(reveal) ? "★ CHASE 1 OF 1 ★" : fx.rarity === "super" ? "1 OF 1" : "AUTOGRAPH"}</div></> : fx.rarity === "super" ? (reveal && isChaseCard(reveal) ? "★ CHASE 1 OF 1! ★" : "1 OF 1!") : fx.rarity === "potw" ? "PLAYER OF THE WEEK!" : isIns(fx.rarity) ? RB[fx.rarity].name.toUpperCase() + "!" : "AUTOGRAPH!"}
                </div>
              ) : null}
              {reveal.flipped && reveal.packId === "boom" && reveal.rarity === "base" ? <div style={{ position: "relative", zIndex: 2, textAlign: "center", marginTop: 6, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", opacity: 0.5 }}>Bust</div> : null}
              {reveal.flipped ? <div style={{ position: "relative", zIndex: 2, textAlign: "center", marginTop: 8, fontSize: 12, fontWeight: 600, color: theme.text.secondary }}>Value {money(cardVal(reveal))} · {chanceText(reveal)}</div> : null}
              <div style={{ position: "relative", zIndex: 2, display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, justifyContent: "center" }}>
                {reveal.flipped ? <div style={{ display: "flex", gap: 8, justifyContent: "center", width: "100%", flexWrap: "wrap" }}><Button label="✓ Keep" variant="primary" onClick={keepRevealed} /><Button label={(confirmSell === "rev" ? "Confirm sell · " : "Sell · ") + money(cardVal(reveal))} onClick={() => { if (confirmSell !== "rev") { setConfirmSell("rev"); return; } sellRevealed(); }} /></div> : null}
                <Button label="Open another" onClick={() => backToStore(true)} disabled={opening} />
                <Button label="Back to store" onClick={() => backToStore(false)} disabled={opening} />
              </div>
            </div>
          ) : null}

          {stage === "multi" ? (
            <div style={{ position: "relative", padding: "16px 6px 8px" }}>
              {multiTop ? <Backdrop r={multiTop} charged={false} burst={!!fx} token={fx?.token ?? 1} /> : null}
              <div style={{ position: "relative", zIndex: 2 }}>
                <Text>{PB[packId].name} · {multiN} packs opened · {multi.length === 0 ? "no cards" : multi.length === 1 ? "1 card" : multi.length + " cards"} left{multiN > multi.length ? " (" + (multiN - multi.length) + " sold)" : ""}. Tap any card to enlarge and flip it.</Text>
                <div className="gl-cards" style={{ marginTop: 8 }}>
                  {multi.map((c) => <div key={c.uid} style={{ animation: RB[c.rarity].rank >= 3 ? "glGlowPulse 1.6s ease-in-out 2" : undefined }}><MiniCard card={c} onInspect={setInspectCard} />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <button type="button" className="gl-sell" disabled={kept.includes(c.uid)} style={{ background: "#1f9d55", color: "#ffffff", opacity: kept.includes(c.uid) ? 0.7 : 1 }} onClick={() => keepOne(c)}>{kept.includes(c.uid) ? "Kept ✓" : "✓ Keep"}</button>
                      <button type="button" className="gl-sell" onClick={() => { if (confirmSell !== c.uid) { setConfirmSell(c.uid); return; } sellCards([c]); }}>{confirmSell === c.uid ? "Confirm sell" : "Sell " + money(cardVal(c))}</button>
                    </div>
                  </div>)}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, justifyContent: "center" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", width: "100%", flexWrap: "wrap" }}>
                    <Button label="✓ Keep all" variant="primary" onClick={keepAll} disabled={multi.length === 0} />
                    <Button label={confirmSell === "all" ? "Confirm sell all · " + money(multiTotal) : "Sell all · " + money(multiTotal)} onClick={() => { if (confirmSell !== "all") { setConfirmSell("all"); return; } sellAllMulti(); }} disabled={multi.length === 0} />
                  </div>
                  <Button label="Open another" onClick={() => backToStore(true)} />
                  <Button label="Back to store" onClick={() => backToStore(false)} />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {dalShown > 0 ? (
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, textAlign: "center", background: "linear-gradient(90deg, #041E42, #1a3a6a, #041E42)", color: "#e8eef6", fontWeight: 700, letterSpacing: 0.4, animation: "glBannerIn 0.5s ease both", fontFamily: theme.font.family }}>
            How 'bout them Cowboys! {dalShown > 1 ? dalShown + " Dallas cards in the pack." : cowboyCard ? playerOf(cowboyCard.playerId).name + " lands in the pack." : "A Dallas card lands in the pack."}
          </div>
        ) : null}
      </Section>
      </>
      ) : null}

      {tab === "collection" ? (
      <Section heading="Collection">
        <Text>Your pulls so far across all three packs.</Text>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <Button label="💾 Save" variant="primary" onClick={saveNow} />
          <span style={{ fontSize: 12, color: theme.text.secondary }}>{savedText}</span>
          <Toggle label={locked ? "Collection locked" : "Collection unlocked"} value={locked} onChange={(v: boolean) => { setLocked(v); if (v) setConfirmReset(false); }} />
          <Button label="Copy backup code" onClick={() => copyBackup()} />
          {typeof navigator !== "undefined" && typeof navigator.share === "function" ? <Button label="Share / save backup" onClick={shareBackup} /> : null}
        </div>
        {backupCode ? (
          <div>
            <Text>Backup code. If it didn't copy, tap the box and copy it yourself, then paste it into Restore on any device.</Text>
            <textarea ref={codeRef} readOnly value={backupCode} onFocus={() => codeRef.current?.select()} onClick={() => codeRef.current?.select()} rows={4} autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="off" style={{ width: "100%", boxSizing: "border-box", fontFamily: theme.font.mono, fontSize: 11, padding: 8, borderRadius: 8, border: "1px solid " + theme.border.default, background: theme.bg.subtle, color: theme.text.primary }} />
          </div>
        ) : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Restore from backup code</div>
            <textarea value={restoreText} onChange={(e) => setRestoreText(e.target.value)} placeholder="Paste a code starting with GL2:" rows={3} autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="off" style={{ width: "100%", boxSizing: "border-box", fontFamily: theme.font.mono, fontSize: 11, padding: 8, borderRadius: 8, border: "1px solid " + theme.border.default, background: theme.bg.subtle, color: theme.text.primary }} />
          </div>
          <Button label="Restore from code" onClick={startRestore} disabled={!restoreText.trim()} />
        </div>
        {pendingRestore ? (
          <Callout tone="warning" lead="Replace your collection?">
            <div>This replaces your current collection ({collection.length} cards, {money(balance)}) with the backup ({pendingRestore.collection.length} cards, {money(pendingRestore.balance)}). Copy a backup code first if you may want the current one back.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <Button label="Confirm restore" variant="primary" onClick={() => applyRestore(pendingRestore)} />
              <Button label="Cancel" onClick={() => setPendingRestore(null)} />
            </div>
          </Callout>
        ) : null}
        <Metrics metrics={[
          { value: String(totalPacks), label: "Packs opened", detail: packMix },
          { value: String(totalPulled), label: "Cards pulled", detail: collection.length + " in binder worth " + money(binderValue) + " · " + uniquePlayers + " unique" },
          { value: best ? RB[best.rarity].short : "—", label: "Best pull", detail: best ? RB[best.rarity].name + " · " + playerOf(best.playerId).name + " · " + cardOvr(best) + " OVR" : "—" },
          { value: avgOvr, label: "Avg rating per pull", detail: collection.length === 0 ? "No cards yet" : "OVR across " + collection.length + " cards in binder" },
          { value: money(balance), label: "Balance", detail: "Coins" },
        ]} />
        {ovrRows.length > 0 ? (
          <>
            <Text>Average rating per pull by pack (the pack each card came from; cards still in your binder, sold ones are not counted).</Text>
            <Table columns={["Pack", "Cards", "Avg rating"]} rows={[["All packs", String(collection.length), avgOvr]].concat(ovrRows)} align={["start", "end", "end"]} />
          </>
        ) : null}
        {totalPulled > 0 || collection.length > 0 ? (
          <>
            <Select label="Stats and binder pack" options={packOptions} value={packFilter} onChange={setPackFilter} />
            <Text>Observed rarity rates versus what the odds predicted for {packFilter === "ALL" ? "the mix of packs you opened" : "the " + PB[packFilter as PackId].name + " packs you opened"}.</Text>
            <Table columns={["Rarity", "Expected %", "Expected count", "Pulled", "Observed %"]} rows={rateRows} align={["start", "end", "end", "end", "end"]} />
            {pieParts.length > 0 ? <Pie parts={pieParts} total={statsCards} label="Pulled rarities" /> : null}
            <Divider />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12, alignItems: "flex-end" }}>
              <Input label="Search" value={query} onChange={setQuery} placeholder="Player name" />
              <Select label="Team" options={[{ value: "ALL", label: "All teams" }, ...TEAMS.map((t) => ({ value: t.abbr, label: t.name }))]} value={teamFilter} onChange={setTeamFilter} />
              <Select label="Rarity" options={[{ value: "ALL", label: "All rarities" }, ...RARITIES.map((r) => ({ value: r.id, label: r.name }))]} value={rarityFilter} onChange={setRarityFilter} />
              <Select label="Pack" options={packOptions} value={packFilter} onChange={setPackFilter} />
              <Select label="Sort" options={[{ value: "valueHi", label: "Value: high to low" }, { value: "valueLo", label: "Value: low to high" }, { value: "rarity", label: "Rarity" }, { value: "rating", label: "Rating" }, { value: "newest", label: "Newest" }, { value: "name", label: "Name" }, { value: "team", label: "Team" }, { value: "pos", label: "Position" }, { value: "pack", label: "Pack" }, { value: "count", label: "Most duplicates" }]} value={sortKey} onChange={setSortKey} />
              <Button label={sortAsc ? "Ascending" : "Descending"} onClick={() => setSortAsc((v) => !v)} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
              <Button label={confirmSell === "dup" ? "Confirm: sell " + dupList.length + " duplicates for " + money(dupTotal) : "Sell all duplicates (" + money(dupTotal) + ")"} disabled={dupList.length === 0} onClick={() => { if (confirmSell !== "dup") { setConfirmSell("dup"); return; } sellCards(dupList); }} />
              <Button label={confirmSell === "base" ? "Confirm: sell " + baseList.length + " Base cards for " + money(baseTotal) : "Sell all Base (" + money(baseTotal) + ")"} disabled={baseList.length === 0} onClick={() => { if (confirmSell !== "base") { setConfirmSell("base"); return; } sellCards(baseList); }} />
              {confirmSell === "dup" || confirmSell === "base" ? <Button label="Cancel" onClick={() => setConfirmSell("")} /> : null}
            </div>
            {binder.length === 0 ? <Text>No cards match those filters or search.</Text> : (
              <div className="gl-cards">
                {binder.map((e) => <MiniCard key={e.card.playerId + e.card.rarity} card={e.card} count={e.count} onInspect={setInspectCard} />)}
              </div>
            )}
            {shownList.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 16 }}>
                <Button label={confirmSell === "shown" ? "Confirm: sell " + shownList.length + " cards for " + money(shownTotal) : (filtersOn ? "Sell all shown · " : "Sell all · ") + money(shownTotal)} onClick={() => { if (confirmSell !== "shown") { setConfirmSell("shown"); return; } sellCards(shownList); setConfirmSell(""); }} />
                {confirmSell === "shown" ? <Button label="Cancel" onClick={() => setConfirmSell("")} /> : null}
              </div>
            ) : null}
          </>
        ) : <Text>Open a pack in the Store to start your binder. The Rising Stars, Stars, and Legends packs never share a player.</Text>}
      </Section>
      ) : null}
      {tab === "chase" ? (
      <Section heading="Chase Cards">
        <Text>Every home pack (and the Boom or Bust pack) hides named ★ chase 1/1s. The Season pack has three of its own, unique to the active season and different from every other season. Only the current season's three can be pulled; once you pull one it is gone from the pack, shows as Pulled here, and stays in your binder after the season changes (or you can sell it).</Text>
        <Metrics metrics={[
          { value: heldSupers.filter((id) => HOME_CHASE_IDS.has(id)).length + "/" + HOME_CHASE_IDS.size, label: "Home chase 1/1s", detail: "Rising Stars, Stars and Legends" },
          { value: heldSupers.filter((id) => SEASON_CHASE[seasonOf()].some((p) => p.id === id)).length + "/3", label: "This season", detail: SEASON_THEME[seasonOf()].name + " chase 1/1s" },
          { value: Math.round(CHASE_SHARE * 100) + "%", label: "Chase share of a 1/1", detail: "Of the rare 1/1 slot in each pack" },
        ]} />
        <ChaseRow packId="season" supers={heldSupers} />
        {HOME.filter((h) => chaseOf(h).length > 0).map((h) => <ChaseRow key={h} packId={h} supers={heldSupers} />)}
        {SEASON_IDS.filter((id) => id !== seasonOf() && SEASON_CHASE[id].some((pl) => heldSupers.includes(pl.id))).map((id) => <ChaseRow key={id} packId="season" season={id} supers={heldSupers} />)}
      </Section>
      ) : null}
      {tab === "sets" ? (
      <Section heading="Sets">
        <Text>Collect every player in a set. Any card of a player counts, except the Players of the Week set (needs the POTW card) and the chase sets (need the 1/1). Each team has one set that needs every player on that team from any pack (Rising Stars, Stars or Legends), and its reward adds up 35% of each player's pack price. Each season also has a 3-card chase set. Finishing a set lets you claim its coin reward once; selling cards can lower your count, but a claimed set keeps its badge.</Text>
        <Metrics metrics={[
          { value: SETS.filter((s) => meta.sets.includes(s.id)).length + "/" + SETS.length, label: "Sets completed", detail: "Rewards claimed once" },
          { value: String(SETS.filter((s) => !meta.sets.includes(s.id) && (setProg[s.id] ?? 0) >= s.players.length).length), label: "Ready to claim", detail: "Tap Claim below" },
          { value: money(SETS.filter((s) => meta.sets.includes(s.id)).reduce((n, s) => n + s.reward, 0)), label: "Set rewards earned", detail: "Coins" },
        ]} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 8 }}>
          {SETS.filter((s) => s.group === "master").map((s) => <SetRow key={s.id} hl={hi === "set-" + s.id} def={s} n={setProg[s.id] ?? 0} claimed={meta.sets.includes(s.id)} onClaim={() => claimSet(s, setProg[s.id] ?? 0)} />)}
        </div>
        <Text>Team sets: all {TEAMS.length} NFL teams, closest to complete first.</Text>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 8 }}>
          {SETS.filter((s) => s.group === "teams").sort((x, y) => (setProg[y.id] ?? 0) / y.players.length - (setProg[x.id] ?? 0) / x.players.length || x.name.localeCompare(y.name)).map((s) => <SetRow key={s.id} hl={hi === "set-" + s.id} def={s} n={setProg[s.id] ?? 0} claimed={meta.sets.includes(s.id)} onClaim={() => claimSet(s, setProg[s.id] ?? 0)} />)}
        </div>
      </Section>
      ) : null}

      {tab === "achievements" ? (
      <Section heading="Achievements">
        <Metrics metrics={[
          { value: meta.ach.length + "/" + ACH.length, label: "Unlocked", detail: "Coin rewards" },
          { value: money(ACH.filter((d) => meta.ach.includes(d.id)).reduce((n, d) => n + d.reward, 0)), label: "Coins earned", detail: "From achievements" },
        ]} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
          {ACH.map((d) => {
            const on = meta.ach.includes(d.id), pr = d.prog ? d.prog(achCtx) : null;
            return (
              <div key={d.id} id={"ach-" + d.id} className={hi === "ach-" + d.id ? "gl-hi" : undefined} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid " + (on ? "#d9a521" : theme.border.default), background: on ? "rgba(240,196,64,0.14)" : undefined, opacity: on ? 1 : 0.78 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{on ? "🏆 " : "🔒 "}{d.name}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, whiteSpace: "nowrap", color: on ? "#b07d00" : undefined }}>{on ? "Unlocked" : "+" + d.reward}</div>
                </div>
                <div style={{ fontSize: 12, marginTop: 3, opacity: 0.85 }}>{d.desc}{on ? " +" + d.reward + " coins" : ""}</div>
                {pr && !on ? <div style={{ marginTop: 6 }}><div style={{ height: 6, borderRadius: 99, background: "rgba(128,128,128,0.25)", overflow: "hidden" }}><div style={{ width: Math.round((pr[0] / pr[1]) * 100) + "%", height: "100%", background: "#4a7bd8" }} /></div><div style={{ fontSize: 10, marginTop: 2, opacity: 0.75 }}>{Math.floor(pr[0]).toLocaleString("en-US")} / {pr[1].toLocaleString("en-US")}</div></div> : null}
              </div>
            );
          })}
        </div>
      </Section>
      ) : null}
      <BackToTop />
      {toast ? <Floating edge="bottom" align="center"><div role="status" aria-live="polite"><button key={toast.token} type="button" aria-label={toast.text + ". Tap to view."} onClick={() => openToast(toast)} style={{ appearance: "none", display: "block", textAlign: "left", font: "inherit", minHeight: 44, maxWidth: "min(94vw, 360px)", padding: "6px 14px", borderRadius: 12, color: "#2b1a02", cursor: "pointer", touchAction: "manipulation", WebkitTapHighlightColor: "transparent", background: "linear-gradient(90deg, #ffe27a, #ffc83a)", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 4px 16px rgba(0,0,0,0.35)", animation: "glBannerIn 0.45s ease both" }}><div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.3 }}>{toast.text}</div><div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, marginTop: 1 }}>Tap to view ›{toastQ.length > 1 ? " · " + (toastQ.length - 1) + " more" : ""}</div></button></div></Floating> : null}
      <Floating edge="bottom" align="start"><div role="status" aria-live="polite" style={{ padding: "5px 12px", borderRadius: 999, fontSize: 14, fontWeight: 800, lineHeight: 1.2, color: "#ffe27a", background: "rgba(6,22,34,0.92)", border: "1px solid rgba(255,226,122,0.55)", boxShadow: "0 2px 10px rgba(0,0,0,0.35)", pointerEvents: "none", whiteSpace: "nowrap" }}>{money(balance)}</div></Floating>
      {notice ? <Floating edge="top" align="center"><div role="status" onClick={() => setNotice("")} style={{ maxWidth: "min(92vw, 340px)", padding: "7px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, lineHeight: 1.35, color: "#ffffff", cursor: "pointer", background: notice.startsWith("Not enough") || notice.startsWith("Could") ? "#8a3b00" : "#14633c", boxShadow: "0 4px 14px rgba(0,0,0,0.35)" }}>{notice}</div></Floating> : null}
    </Page>
  );
}
export { encodeBackup, decodeBackup, loadSave, compactOf, defaultSave, PLAYERS, PBYID, evOf, seasonOf, SEASON_ROSTER, SEASON_CHASE, SEASON_PRICE, packOf, PACKS, PIDS, VERSION };
