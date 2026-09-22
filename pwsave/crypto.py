"""Save encryption: 32-bit XOR stream driven by a linear congruential generator.

The generator state is derived from one of twelve 32-byte header slots stored
at the start of the file. The slot actually used is detected by decrypting a
preview of the payload and looking for the "oEbN" magic.
"""
import struct

LCG_MUL = 0x02E90EDD

# (header_offset, region_offset, region_size)
MAIN_BLOCK = (0x00, 0x40, 0x387F0)
SECOND_BLOCK = (0x38830, 0x38870, 0xF0E0)

MAGIC = b"oEbN"


def _u32(buf, off):
    return struct.unpack_from("<I", buf, off)[0]


def key_state(buf, header_offset, slot):
    """Return (start_key, increment) for header slot `slot` (0..11)."""
    base = header_offset + slot * 4
    a = _u32(buf, base + 0x08) ^ 0x1327DE73
    b = _u32(buf, base + 0x0C) ^ 0x2D71D26C
    c = _u32(buf, base + 0x1C) ^ 0xBC4DEFA2
    mixed = (a ^ b) & 0xFFFFFFFF
    key = ((((mixed ^ 0x6576) << 16) & 0xFFFFFFFF) | mixed) & 0xFFFFFFFF
    inc = (mixed * c) & 0xFFFFFFFF
    return key, inc


def xor_stream(buf, region_offset, region_size, key, inc):
    """XOR `region_size` bytes of `buf` in place. Symmetric (encrypt == decrypt)."""
    for off in range(region_offset, region_offset + region_size, 4):
        struct.pack_into("<I", buf, off, _u32(buf, off) ^ key)
        key = (key * LCG_MUL + inc) & 0xFFFFFFFF


def _score(buf, region_offset, key, inc):
    preview = bytearray(buf[region_offset:region_offset + 0x100])
    xor_stream(preview, 0, len(preview), key, inc)
    score = sum(1 for x in preview if x == 0 or 0x20 <= x < 0x7F)
    if preview[:4] == MAGIC:
        score += 1000
    return score


def detect_slot(buf, block=MAIN_BLOCK):
    header, region, _ = block
    return max(range(12), key=lambda s: _score(buf, region, *key_state(buf, header, s)))


def apply(buf, slot, block=MAIN_BLOCK):
    header, region, size = block
    xor_stream(buf, region, size, *key_state(buf, header, slot))


def filename_checksum(buf):
    """16-bit XOR of the whole encrypted file: it is embedded in the file name
    STW000000<xxxx>01 (EU/US) or STJ000000<xxxx>01 (JP)."""
    ck = 0xFFFF
    for off in range(0, len(buf) & ~1, 2):
        ck ^= struct.unpack_from("<H", buf, off)[0]
    return ck
