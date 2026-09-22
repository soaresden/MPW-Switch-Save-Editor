"""Integrity values the game verifies when loading (computed on decrypted data)."""
import struct
import zlib

# On Switch (ARM, unsigned char) the byte sums are unsigned.
# On PC (x86, signed char) they are signed. Getting this wrong makes the save invalid.


def _byte_sum(buf, start, end, signed):
    if signed:
        return sum(v if v < 0x80 else v - 0x100 for v in buf[start:end]) & 0xFFFFFFFF
    return sum(buf[start:end]) & 0xFFFFFFFF


def update(buf, platform="switch"):
    signed = platform == "pc"
    slot = struct.unpack_from("<I", buf, 0x178)[0]
    ha, hb = struct.unpack_from("<II", buf, 0x160)
    struct.pack_into("<Q", buf, 0x168, ((((ha ^ hb) & 0xFFFFFFFF) << 32) | slot) ^ 0x3F000000E4)

    a = _byte_sum(buf, 0xBD7C, 0xE2FC, signed)
    b = _byte_sum(buf, 0xE2FC, 0x1127C, signed)
    shorts = sum(struct.unpack_from("<7h", buf, 0x14104)) & 0xFFFFFFFF
    struct.pack_into("<Q", buf, 0x170, ((shorts << 32) | ((a ^ b) & 0xFFFFFFFF)) ^ 0xCD0000007C)

    for start, end, at in ((0x44, 0x1C1C0, 0x38), (0x1C1C0, 0x1F9C0, 0x3C), (0x1F9C0, 0x38828, 0x30)):
        struct.pack_into("<I", buf, at, zlib.crc32(buf[start:end]) & 0xFFFFFFFF)
