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
