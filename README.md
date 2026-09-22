# MPW Switch Save Editor

Save editor for **METAL GEAR SOLID: Peace Walker – Master Collection Version** on **Nintendo Switch**.

> ⚠️ Work in progress. Always keep a backup of your save (Checkpoint / JKSV) before writing an edited one.

## Status
- [x] Decrypt / re-encrypt Switch saves (byte-identical round trip)
- [x] Rebuild integrity checks (Switch-specific unsigned byte sums)
- [x] Keep the original file name (`STW000000xxxx01`)
- [x] Read and rewrite a **JKSV / Checkpoint zip** directly
- [x] AI memory boards – view / edit / unlock all (tested in game)
- [x] Soldiers – stats, ranks, assignment, name
- [x] Garage vehicles – repair, duplicate, add **any of the 12 known models** (pickers: tanks / armored / helicopters / all), raise the editable in-game grade to S
- [x] Metal Gear ZEKE – parts, modules, condition, fragments
- [x] Mission records – time / kills / alerts / rank (all missions to S), filters "below A" / "below S"
- [x] Finish the R&D development in progress
- [x] Unlocks tab – mission rewards, S-rank rewards, R&D requirements, uniform unlocks
- [x] R&D development tree (reference: names are not mapped to the save ids yet)
- [x] **100 % tab** – completionist checklist: rank goals per chapter, blueprints to collect, collections
- [x] English / French interface
- [ ] Map the R&D item / weapon ids to their names
- [ ] Outer Ops progress
- [ ] Mother Base team levels

## Usage

### Web interface (recommended)

👉 **https://soaresden.github.io/MPW-Switch-Save-Editor/**

Drop **the JKSV/Checkpoint zip** (or the `STW…01` file alone), edit, click **Save**.
A zip is rebuilt with every other file untouched, under the same name, so it can go straight back into `/JKSV/METAL GEAR SOLID Peace Walker - Master Collection Version/` and be restored. Everything runs locally in the browser; the save never leaves your computer.
(If a zip holds several saves, the first `STW…`/`STJ…` file is opened.)

### Command line
Requires Python 3.9+ (no dependencies).

```
python -m pwsave info STW00000006ec01
python -m pwsave unlock-ai-boards STW00000006ec01 out/STW00000006ec01
```
Export the save with Checkpoint or JKSV, edit the file in `MGS_PW_SAVE/ww/`, copy it back into the backup folder and restore.

## Save format
The reverse-engineering notes live in [`docs/FORMAT.md`](docs/FORMAT.md): encryption, integrity
checks, mission records, R&D tables, vehicle records and the vehicle model-id table.

## Credits
- Encryption scheme and integrity checks were first documented by
  [ShadowLite1/PeaceWalkerSaveEditor](https://github.com/ShadowLite1/PeaceWalkerSaveEditor) (PC).
  This project re-implements them and adds Switch support.
- Unlock conditions and rewards cross-checked against the Metal Gear Wiki (Fandom),
  the Steam "Peace Walker Complete Guide", Dayngls guides and jeuxvideo.com.

## License
MIT — see [LICENSE](LICENSE). Unofficial fan tool, not affiliated with Konami or Nintendo;
it ships no game code and no game assets.
