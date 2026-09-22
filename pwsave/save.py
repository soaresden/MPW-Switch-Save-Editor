import struct
from pathlib import Path

from . import checks, crypto, layout


class PWSave:
    """Load a STW/STJ save, expose the decrypted payload, write it back."""

    def __init__(self, path, platform="switch"):
        self.path = Path(path)
        self.platform = platform
        self.raw = bytearray(self.path.read_bytes())
        self.original_checksum = crypto.filename_checksum(self.raw)
        self.slot = crypto.detect_slot(self.raw)
        self.data = bytearray(self.raw)
        crypto.apply(self.data, self.slot)
        if self.data[0x40:0x44] != crypto.MAGIC:
            raise ValueError("Decryption failed (magic not found) - unsupported save?")

    # --- helpers -----------------------------------------------------------
    def u32(self, off):
        return struct.unpack_from("<I", self.data, off)[0]

    def set_u32(self, off, value):
        struct.pack_into("<I", self.data, off, value & 0xFFFFFFFF)

    # --- features ----------------------------------------------------------
    def ai_board_counts(self):
        out = {}
        for name, base in (("A", layout.AI_BOARDS_A), ("B", layout.AI_BOARDS_B)):
            arr = self.data[base:base + layout.AI_BOARD_TYPES * layout.AI_BOARDS_PER_TYPE]
            out[name] = [sum(1 for x in arr[i * 100:(i + 1) * 100] if x) for i in range(4)]
        return out

    def unlock_all_ai_boards(self):
        n = layout.AI_BOARD_TYPES * layout.AI_BOARDS_PER_TYPE
        for i in range(n):
            self.data[layout.AI_BOARDS_A + i] = 1
            if self.data[layout.AI_BOARDS_B + i] == 0:
                self.data[layout.AI_BOARDS_B + i] = 1

    def vehicles(self):
        count = self.u32(layout.VEHICLE_COUNT)
        res = []
        for i in range(count):
            rec = layout.VEHICLE_TABLE + i * layout.VEHICLE_SIZE
            raw = self.data[rec + layout.VEHICLE_NAME:rec + layout.VEHICLE_NAME + 16]
            res.append((i, raw.split(b"\0")[0].decode("ascii", "replace")))
        return res

    # --- output ------------------------------------------------------------
    def build(self, keep_filename=True):
        out = bytearray(self.data)
        checks.update(out, self.platform)
        crypto.apply(out, self.slot)
        if keep_filename and crypto.filename_checksum(out) != self.original_checksum:
            # last word is padding (outside the encrypted region); it may already hold
            # a previous compensation, so reset it first
            struct.pack_into("<H", out, len(out) - 2, 0)
            struct.pack_into("<H", out, len(out) - 2, crypto.filename_checksum(out) ^ self.original_checksum)
        return out

    def save(self, path, keep_filename=True):
        Path(path).write_bytes(self.build(keep_filename))
