# Save format notes (Switch, EU "ww" folder)

File: `MGS_PW_SAVE/ww/STW000000xxxx01`, 325 984 bytes. `xxxx` = 16-bit XOR checksum of the whole encrypted file.

## Encryption
* Main block: bytes `0x40..0x38830`, key from header slots at `0x00`.
* Second block: bytes `0x38870..0x47950`, key from header slots at `0x38830` (not edited yet).
* 32-bit XOR, key advanced by `key = key * 0x02E90EDD + inc` (see `pwsave/crypto.py`).
* Decrypted main block starts with magic `oEbN`.

## Integrity (decrypted data)
| where | what |
|---|---|
| 0x168 | u64 check from 0x160/0x164/0x178 |
| 0x170 | u64 = (sum of 7 shorts @0x14104) << 32 \| (bytesum(0xBD7C..0xE2FC) ^ bytesum(0xE2FC..0x1127C)), xor 0xCD0000007C. **Unsigned byte sums on Switch, signed on PC.** |
| 0x38 / 0x3C / 0x30 | CRC32 of 0x44..0x1C1C0 / 0x1C1C0..0x1F9C0 / 0x1F9C0..0x38828 |

## Data
| offset | content | status |
|---|---|---|
| 0x188 | player name | confirmed |
| 0xB570 | GMP (u32) | from PC editor |
| 0x9D48 | AI memory boards copy B, 4x100 bytes (L,P,A,S), column-major | confirmed |
| 0x13860 | AI memory boards copy A, 4x100 bytes | confirmed |
| 0x115D8 | vehicle count (u32) | likely |
| 0x115E0 | vehicle records, 0xA0 each, name at +0x28 | likely |
| 0x1FA80 | staff: 350 records x 0xA0 (name +0x20, assignment +0x30, life +0x42/44, psyche +0x4A/4C, battle +0x52..0x60, teams +0x64..0x70) | confirmed on Switch |

## ZEKE parts (confirmed in game)
* 0x1385C: u8 number of part records
* 0x139F4: part records, 12 bytes: +2 = non-zero when mounted on ZEKE, +4 kind, +5 sub, +6 condition (0x64 = 100 %)
  * kind 1 Head, 2 Legs, 3 Power unit, 4 Walk unit (sub = 1)
  * kind 5 = option, sub 1 Jet pack, 2 Radome, 3 Armor, 4 Railgun
* 0x13784: 4 x u8 fragment counters (x/5): Head, Power unit, Walk unit, Legs

## Vehicles
* confirmed: adding BTR-60PB appended a 0xA0 record at 0x115E0 + 6*0xA0 and incremented 0x115D8.

## Soldier grades
* Battle aptitudes: 0..1250, grade thresholds 209/417/626/834/1042 (D..S). Combat grade = average of the 8.
* Teams (R&D, Mess, Medical, Intel): 0..999, grade = floor(value / 131.25) (E..S), 0 = "-". Matched against in-game screens.
* Roster boundary (highest used slot + 1) at 0x1FA70.
* Life/Psyche: the value shown in game is at +0x44 / +0x4C; +0x42 / +0x4A hold a lower base value.
* In-game default sort = combat power (descending), close to the sum of the 8 battle aptitudes.

## Missions (records SOLO)

Four parallel arrays of 288 entries, indexed by mission slot:

| Offset | Type | Content |
|---|---|---|
| 0x29F8 | u32 × 288 | best time, in 1/300 s (`0xFFFFFFFF` = never finished) |
| 0x2E78 | u16 × 288 | fewest kills (`0xFFFF` = "---", not applicable) |
| 0x30B8 | u16 × 288 | fewest alerts (`0xFFFF` = "---") |
| 0x32F8 | u16 × 288 | best rank: 0 S, 1 A, 2 B, 3 C, 4 D, 5 E (`0xFFFF` = none) |

Slots 1–33 are the Main Ops in story order (1 "Investigate the Supply Facility" … 4 "LAV-Type G" checked in game).
Checked Extra Ops: slot 36 = [005] Marksmanship Challenge, slot 52 = [010] Fulton Recovery.
Game variable 39 holds the time of the last mission played (same unit).

## R&D

| Offset | Content |
|---|---|
| 0xBD7C | u32 count (253), then records of 0x1C bytes: u32 id, u32 state (1 not developed, 2 in development, 3 developed), u32 progress %, u32 xp, u16 ?, u16 level |
| 0xE2FC | u32 count (380), then records of 0x18 bytes with the same first three fields (items / uniforms) |

Both tables are covered by the byte-sum check stored at 0x170.
Weapon id 186 = Stun Grenade (seen in development at 85 % then 90 %).

## Garage vehicle record (0xA0 bytes, table at 0x115E0, count at 0x115D8)

| Offset | Type | Content |
|---|---|---|
| 0x18 | u32 | unit id (also referenced by the Outer Ops squads) |
| 0x28 | char[16] | model name ("MBTK-70", "AH56A-B"…) |
| 0x3C | u16 | flags, bit 0x80 = deployed in Outer Ops |
| 0x39 | u8 | **model id** — what the game displays. Valid range 0x25-0x30 (below, the whole table) |
| 0x48 | u8 | second per-model index (tanks 10-13, helicopters 14-17, armored 18-21) |
| 0x4A / 0x4C / 0x4E | u16 | current HP / max HP / max HP x1.2 |
| 0x50, 0x58 | u16 | the only two values that differ between two units of the same model (0-100 range) — most likely what the in-game rank comes from, **unconfirmed** |
| 0x68 | u16 | attack power (1200 helicopters, 1500 LAV-G, 1750 BTR-60PB / LAV-C, 1850 T-72A / MBTk-70) |

Everything else is identical for every unit of a model, so a new vehicle can be created by copying a
captured record (`pwcore.js` ships one base record per class), stamping the model id in and giving
it a fresh unit id.

### Model ids (0x39), found by probing every value in a real save

| id | Model | Class | id48 |
|---|---|---|---|
| 0x25 | BTR-60PA | armored | 18 |
| 0x26 | BTR-60PB | armored | 19 |
| 0x27 | LAV-G | armored | 20 |
| 0x28 | LAV-C | armored | 21 |
| 0x29 | T-72U | tank | 10 |
| 0x2A | T-72A | tank | 11 |
| 0x2B | KPZ 70 | tank | 12 |
| 0x2C | MBTk-70 | tank | 13 |
| 0x2D | Mi-24A | helicopter | 14 |
| 0x2E | Mi-24D | helicopter | 15 |
| 0x2F | AH56A-B | helicopter | 16 |
| 0x30 | AH56A-R | helicopter | 17 |

Outside that range the game falls back to **ZEKE** (about ten values above 0x30) or draws a broken
record (a "T-72A" with a helicopter silhouette and no weapon) — usable as a probe, not worth keeping.
The **Custom** variants captured in the Extra Ops are not separate models: no probe produced one, and
the in-game mission list confirms they are separate *missions* (Extra Ops 070, 072, 073, 075…) for the
same twelve vehicles, so a captured Custom must be the same model id carrying better stats.

### Vehicle <CARAC> grades

The six letter grades shown in **R&D > Mechas** come from a stat block inside each vehicle record,
so two units of the same model can in theory be given different grades:

| Offsets | MBTK-70 | other models | note |
|---|---|---|---|
| 0x5A / 0x5C / 0x5E | 300 | 480 | |
| 0x60 / 0x62 / 0x64 / 0x66 | 200 / 150 / 0 / 0 | 240 / 320 / 320 / 320 | |
| 0x68 | 1850 | 1200-1850 | attack power |
| 0x6C-0x7A | pairs (value, value x1.25) | | one pair per target type |

Tested in game by raising the whole block on one unit: **only the 4th grade changed**, on both a
MBTK-70 (S C B A E E -> S C B S E E) and a LAV-G (D B B B E A -> D B B S E A). So only one of the
six grades is stored per unit:

* **0x74 = the 4th grade** (0x76 always holds the same value x1.25). Observed: 40 -> B, 120 -> A
  (the MBTK-70 default), 999 -> S.
* The five other grades follow the model and its weapons (static game data), not the save: raising
  0x5A-0x66, 0x68 (attack) or 0x6C-0x7A changed nothing on screen.
* The two values at 0x50 and 0x58 differ between units of the same model but have no visible effect.
* **Helicopters read the 4th grade from 0x68 (attack) instead**: on five AH56A-R, only the one with
  0x68 = 9999 moved from C to S; 0x6C / 0x70 / 0x74 / 0x78, 0x5A-0x66, 0x86, 0x52-0x56 and the tail
  fields (0x7C / 0x80 / 0x8C / 0x8E) changed nothing. Ground units are the opposite: raising 0x68 on
  a LAV-G did nothing, raising 0x74 moved the grade.
* The other five grades track the model and its weapons (AH56A-B "30MM MT + bomb" shows C B S C B S,
  AH56A-R "30MM CG + AT missile" shows A B S C A A).
* The **displayed model name comes from the model id at 0x48, not from the 16-byte string at 0x28**:
  renaming a record changes nothing on screen (harmless, but useless).

Observed grade scale for the 4th grade (0x74), which differs by vehicle class:

| Class | 40 | 80 | 120 | 200 | 500 | 999 |
|---|---|---|---|---|---|---|
| Armored (LAV, BTR) | B | B | - | B | A | S |
| Tank (MBTk-70) | - | - | A | - | - | S |
| Helicopter | C | - | - | - | - | C (0x74 has no effect; 0x68 = 9999 gives S) |
