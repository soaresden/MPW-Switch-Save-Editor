import argparse
from pathlib import Path

from . import PWSave, crypto


def main():
    p = argparse.ArgumentParser(prog="pwsave", description="MGS Peace Walker (Switch) save tool")
    p.add_argument("--platform", choices=["switch", "pc"], default="switch")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("info", "decrypt", "roundtrip", "unlock-ai-boards"):
        s = sub.add_parser(name)
        s.add_argument("input")
        if name != "info":
            s.add_argument("output")
    a = p.parse_args()

    sv = PWSave(a.input, a.platform)
    if a.cmd == "info":
        print(f"header slot : {sv.slot}")
        print(f"file cksum  : {sv.original_checksum:04x}")
        print(f"GMP         : {sv.u32(0xB570)}")
        print(f"AI boards   : {sv.ai_board_counts()}")
        for i, n in sv.vehicles():
            print(f"vehicle {i}   : {n}")
        return
    if a.cmd == "decrypt":
        Path(a.output).write_bytes(sv.data)
        return
    if a.cmd == "unlock-ai-boards":
        sv.unlock_all_ai_boards()
    out = sv.build()
    Path(a.output).write_bytes(out)
    print(f"wrote {a.output} (name checksum {crypto.filename_checksum(out):04x})")


if __name__ == "__main__":
    main()
