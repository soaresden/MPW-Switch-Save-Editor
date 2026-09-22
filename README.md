# MPW Switch Save Editor

Save editor for **METAL GEAR SOLID: Peace Walker – Master Collection Version** on **Nintendo Switch**.

> ⚠️ Work in progress. Always keep a backup of your save (Checkpoint / JKSV) before writing an edited one.

## Status
- [x] Decrypt / re-encrypt Switch saves (byte-identical round trip)
- [x] Rebuild integrity checks (Switch-specific unsigned byte sums)
- [x] Keep the original file name (`STW000000xxxx01`)
- [x] AI memory boards – view / edit / unlock all (tested in game)
- [x] Soldiers – stats, ranks, assignment, name
- [ ] Garage vehicles – add / edit rank
- [x] Metal Gear ZEKE – parts, options, condition, fragments
- [ ] Weapon / item development tree
- [ ] Mother Base team levels
- [ ] Mission stats

## Usage

### Web interface (recommended)
Open `web/index.html` in a browser (or the GitHub Pages site), drop your `STW…01` file, edit, click **Enregistrer**. Everything runs locally in the browser; the save never leaves your computer.

### Command line
Requires Python 3.9+ (no dependencies).

```
python -m pwsave info STW00000006ec01
python -m pwsave unlock-ai-boards STW00000006ec01 out/STW00000006ec01
```
Export the save with Checkpoint or JKSV, edit the file in `MGS_PW_SAVE/ww/`, copy it back into the backup folder and restore.

## Credits
- Encryption scheme and integrity checks were first documented by
  [ShadowLite1/PeaceWalkerSaveEditor](https://github.com/ShadowLite1/PeaceWalkerSaveEditor) (PC).
  This project re-implements them and adds Switch support.
