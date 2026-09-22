"""Known offsets inside the DECRYPTED main block. Work in progress - see docs/FORMAT.md."""

GMP = 0xB570                 # u32

# AI memory boards: 4 types x 100 boards, one byte per board.
# Order: Locomotion, Pursuit, Attack, System (confirmed)
AI_BOARDS_A = 0x13860        # values 0/1 (confirmed in game)
AI_BOARDS_B = 0x9D48         # values 0/1/2 (meaning of 2 unknown)
# In-game grid is column-major: index = column*10 + row
AI_BOARD_TYPES = 4
AI_BOARDS_PER_TYPE = 100

# Vehicles (garage)
VEHICLE_COUNT = 0x115D8      # u32
VEHICLE_TABLE = 0x115E0      # records of 0xA0 bytes
VEHICLE_SIZE = 0xA0
VEHICLE_NAME = 0x28          # ASCII, NUL terminated, inside a record

# Staff (soldiers) start around 0x1F9C0 (see ShadowLite1's PC editor for the record layout)
STAFF_TABLE = 0x1FA80        # 350 records x 0xA0 (Snake's record is just before)
