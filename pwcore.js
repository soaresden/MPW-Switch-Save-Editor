// MPW Switch Save Editor - core (no dependencies). Works in browser and Node.
(function (root) {
  const LCG_MUL = 0x02E90EDD;
  const MAIN = { header: 0x00, region: 0x40, size: 0x387F0 };
  const L = {
    NAME: 0x188, GMP: 0xB570,
    AI_A: 0x13860, AI_B: 0x9D48, AI_TYPES: 4, AI_PER: 100,
    VEH_COUNT: 0x115D8,
    ZEKE_COUNT: 0x1385C, ZEKE_TABLE: 0x139F4, ZEKE_SIZE: 12, ZEKE_MAX: 100, ZEKE_FRAG: 0x13784,
    STAFF: 0x1FA80, STAFF_SIZE: 0xA0, STAFF_COUNT: 350, STAFF_BOUNDARY: 0x1FA70, VEH_TABLE: 0x115E0, VEH_SIZE: 0xA0, VEH_NAME: 0x28, VEH_MAX: 50, VEH_UID: 0x18, VEH_SQUAD: 0x1C, VEH_HP: 0x4A, VEH_HPMAX: 0x4C, VEH_FLAGS: 0x3C, VEH_DEPLOYED: 0x80,
  };
  const SOLDIER = {
    name: 0x20, assign: 0x30, type: 0x31, sex: 0x34, service: 0x18, gmp: 0x38,
    lifeCur: 0x42, lifeMax: 0x44, psyCur: 0x4A, psyMax: 0x4C,
    hostility: 0x7E, morale: 0x82, skills: 0x98,
    battle: { Shooting: 0x58, Reloading: 0x5A, Throwing: 0x5C, Placing: 0x5E, Walking: 0x54, Running: 0x52, CQC: 0x56, Defense: 0x60 },
    team: { 'R&D': 0x6C, 'Mess Hall': 0x64, Medical: 0x68, Intel: 0x70 },
  };
  const ZEKE_PARTS = [
    { kind: 1, sub: 1, name: 'Head', color: 'P', main: true },
    { kind: 2, sub: 1, name: 'Legs', color: 'L', main: true },
    { kind: 3, sub: 1, name: 'Power Unit', color: 'A', main: true },
    { kind: 4, sub: 1, name: 'Walk Unit', color: 'S', main: true },
    { kind: 5, sub: 1, name: 'Jet Pack', color: 'L', main: false },
    { kind: 5, sub: 2, name: 'Radome', color: 'S', main: false },
    { kind: 5, sub: 3, name: 'Armor', color: 'S', main: false },
    { kind: 5, sub: 4, name: 'Railgun', color: 'A', main: false },
  ];
  const ZEKE_FRAG_ORDER = ['Head', 'Power Unit', 'Walk Unit', 'Legs'];
  const SKILLS = {"0": "None", "1": "Sidekick", "2": "Radio Technology", "3": "SWAT", "4": "Rescue", "5": "Decoy", "6": "Engineering", "8": "Channeler", "9": "Voice Actor", "12": "Green Beret", "14": "Pro Wrestling Maniac", "16": "Three-Star Chef", "17": "Four-Star Chef", "18": "Five-Star Chef", "19": "Pharmacist", "20": "Expert Pharmacist", "22": "Counselor", "24": "Physician", "25": "Surgeon", "27": "Gunsmith (Handguns)", "28": "Gunsmith (Shotguns)", "29": "Gunsmith (Assault Rifles)", "30": "Gunsmith (Machine Guns)", "31": "Gunsmith (Sniper Rifles)", "35": "Bipedal Weapons Design", "39": "Gung Ho", "42": "Optical Technology", "43": "FSLN Comandante", "44": "AI Development Technology", "45": "Bird Watcher", "46": "Home Cooking", "47": "Mother Base Deputy Commander", "48": "Gunsmith (Submachine Guns)", "49": "Patriot", "50": "Japanese Patriot", "51": "Anti-tank Rifle Design", "52": "M134 Design", "53": "EM Weapons Design", "54": "Metamaterials Technology"};
  // Game variable table: id -> record at VARS + (id-1)*0x28, value u32 @+0x10, max u32 @+0x18
  const VARS = 0x52B8;
  const PROFILE_VARS = [
    [119, 'Heroism'], [122, 'Missions completed'], [247, 'Missions completed with no alert'],
    [220, 'Missions completed with no recovery item'], [123, 'Total CQC'], [48, 'Total holds'],
    [49, 'Total headshots'], [93, 'Metal Gear parts acquired'],
  ];
  const ASSIGN = ['Unassigned', 'Waiting Room', 'Combat Unit', 'R&D Team', 'Medical Team', 'Mess Hall', 'Intel Team', 'Waiting for trade', 'Brig', 'Sick Bay'];
  const GRADES = ['E', 'D', 'C', 'B', 'A', 'S'];
  const BATTLE_MIN = [0, 209, 417, 626, 834, 1042];
  const battleGrade = v => { for (let g = 5; g >= 0; g--) if (v >= BATTLE_MIN[g]) return GRADES[g]; return 'E'; };
  // Team grade = floor(value / 131.25), value 0..999 (checked against in-game screens)
  const teamGrade = v => v ? GRADES[Math.min(5, Math.floor(v / 131.25))] : '-';
  const mul32 = (a, b) => Number((BigInt(a >>> 0) * BigInt(b >>> 0)) & 0xFFFFFFFFn);


  // --- minimal ZIP reader/writer (JKSV / Checkpoint exports) -------------
  const ZIP_CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[i] = c >>> 0; }
    return t;
  })();
  function zipCrc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = ZIP_CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress the zip');
    const ds = new DecompressionStream('deflate-raw');
    const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(buf);
  }
  // Returns [{name, data:Uint8Array, dir:boolean}] in central-directory order.
  async function zipRead(arrayBuffer) {
    const u8 = new Uint8Array(arrayBuffer), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= 0 && i > u8.length - 0x10100; i--) if (dv.getUint32(i, true) === 0x06054B50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Not a valid zip file');
    const count = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder(), out = [];
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(off, true) !== 0x02014B50) throw new Error('Unreadable zip (entry ' + i + ')');
      const method = dv.getUint16(off + 10, true);
      const csize = dv.getUint32(off + 20, true), usize = dv.getUint32(off + 24, true);
      const nlen = dv.getUint16(off + 28, true), elen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
      const lho = dv.getUint32(off + 42, true);
      const name = dec.decode(u8.subarray(off + 46, off + 46 + nlen));
      const lnlen = dv.getUint16(lho + 26, true), lelen = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lnlen + lelen;
      const raw = u8.subarray(start, start + csize);
      let data;
      if (method === 0) data = raw.slice();
      else if (method === 8) data = await inflateRaw(raw);
      else throw new Error('Unsupported zip compression (method ' + method + ')');
      if (data.length !== usize) throw new Error('Corrupted zip: ' + name);
      out.push({ name, data, dir: name.endsWith('/') });
      off += 46 + nlen + elen + clen;
    }
    return out;
  }
  // Writes a zip with every entry stored (no compression): always readable by JKSV/Checkpoint.
  function zipWrite(entries) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let off = 0;
    for (const e of entries) {
      const name = enc.encode(e.name), data = e.dir ? new Uint8Array(0) : e.data;
      const crc = zipCrc32(data);
      const lh = new Uint8Array(30 + name.length), ldv = new DataView(lh.buffer);
      ldv.setUint32(0, 0x04034B50, true); ldv.setUint16(4, 20, true); ldv.setUint16(6, 0, true); ldv.setUint16(8, 0, true);
      ldv.setUint16(10, 0, true); ldv.setUint16(12, 0x21, true); // time/date placeholder
      ldv.setUint32(14, crc, true); ldv.setUint32(18, data.length, true); ldv.setUint32(22, data.length, true);
      ldv.setUint16(26, name.length, true); ldv.setUint16(28, 0, true);
      lh.set(name, 30);
      parts.push(lh, data);
      const ch = new Uint8Array(46 + name.length), cdv = new DataView(ch.buffer);
      cdv.setUint32(0, 0x02014B50, true); cdv.setUint16(4, 20, true); cdv.setUint16(6, 20, true);
      cdv.setUint16(10, 0, true); cdv.setUint16(12, 0, true); cdv.setUint16(14, 0x21, true);
      cdv.setUint32(16, crc, true); cdv.setUint32(20, data.length, true); cdv.setUint32(24, data.length, true);
      cdv.setUint16(28, name.length, true);
      cdv.setUint32(38, e.dir ? 0x10 : 0, true);
      cdv.setUint32(42, off, true);
      ch.set(name, 46);
      central.push(ch);
      off += lh.length + data.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const eocd = new Uint8Array(22), edv = new DataView(eocd.buffer);
    edv.setUint32(0, 0x06054B50, true);
    edv.setUint16(8, entries.length, true); edv.setUint16(10, entries.length, true);
    edv.setUint32(12, cdSize, true); edv.setUint32(16, off, true);
    const all = parts.concat(central, [eocd]);
    const total = all.reduce((a, b) => a + b.length, 0), res = new Uint8Array(total);
    let p = 0; for (const b of all) { res.set(b, p); p += b.length; }
    return res;
  }
  const SAVE_IN_ZIP = /(^|\/)ST[WJ][0-9A-Fa-f]{8,}$/;
  function zipFindSave(entries) {
    const hit = entries.filter(e => !e.dir && SAVE_IN_ZIP.test(e.name) && e.data.length > 0x10000);
    if (!hit.length) throw new Error("No STW…01 save in this zip (MGS_PW_SAVE/ww expected)");
    return hit[0];
  }

  function keyState(dv, header, slot) {
    const base = header + slot * 4;
    const a = (dv.getUint32(base + 0x08, true) ^ 0x1327DE73) >>> 0;
    const b = (dv.getUint32(base + 0x0C, true) ^ 0x2D71D26C) >>> 0;
    const c = (dv.getUint32(base + 0x1C, true) ^ 0xBC4DEFA2) >>> 0;
    const mixed = (a ^ b) >>> 0;
    const key = ((((mixed ^ 0x6576) << 16) >>> 0) | mixed) >>> 0;
    return [key, mul32(mixed, c)];
  }
  function xorStream(dv, off, size, key, inc) {
    for (let o = off; o < off + size; o += 4) {
      dv.setUint32(o, (dv.getUint32(o, true) ^ key) >>> 0, true);
      key = (mul32(key, LCG_MUL) + inc) >>> 0;
    }
  }
  function detectSlot(bytes) {
    let best = -1, bestScore = -1;
    for (let s = 0; s < 12; s++) {
      const prev = bytes.slice(MAIN.region, MAIN.region + 0x100);
      const [k, i] = keyState(new DataView(bytes.buffer, bytes.byteOffset), MAIN.header, s);
      xorStream(new DataView(prev.buffer), 0, 0x100, k, i);
      let sc = 0; for (const x of prev) if (x === 0 || (x >= 0x20 && x < 0x7F)) sc++;
      if (prev[0] === 0x6F && prev[1] === 0x45 && prev[2] === 0x62 && prev[3] === 0x4E) sc += 1000;
      if (sc > bestScore) { bestScore = sc; best = s; }
    }
    return best;
  }
  function applyCipher(bytes, slot) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const [k, i] = keyState(dv, MAIN.header, slot);
    xorStream(dv, MAIN.region, MAIN.size, k, i);
  }
  function filenameChecksum(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let ck = 0xFFFF;
    for (let o = 0; o < (bytes.length & ~1); o += 2) ck ^= dv.getUint16(o, true);
    return ck;
  }
  let CRC_T = null;
  function crc32(bytes, s, e) {
    if (!CRC_T) { CRC_T = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c >>> 0; } }
    let c = 0xFFFFFFFF; for (let i = s; i < e; i++) c = CRC_T[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function byteSum(bytes, s, e, signed) {
    let t = 0; for (let i = s; i < e; i++) { const v = bytes[i]; t += signed && v >= 0x80 ? v - 0x100 : v; }
    return BigInt.asUintN(32, BigInt(t));
  }
  function updateChecks(bytes, platform) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const signed = platform === 'pc';
    const slot = BigInt(dv.getUint32(0x178, true));
    const ha = dv.getUint32(0x160, true), hb = dv.getUint32(0x164, true);
    dv.setBigUint64(0x168, ((BigInt((ha ^ hb) >>> 0) << 32n) | slot) ^ 0x3F000000E4n, true);
    const a = byteSum(bytes, 0xBD7C, 0xE2FC, signed), b = byteSum(bytes, 0xE2FC, 0x1127C, signed);
    let sh = 0; for (let k = 0; k < 7; k++) sh += dv.getInt16(0x14104 + 2 * k, true);
    const shorts = BigInt.asUintN(32, BigInt(sh));
    dv.setBigUint64(0x170, ((shorts << 32n) | (a ^ b)) ^ 0xCD0000007Cn, true);
    for (const [s, e, at] of [[0x44, 0x1C1C0, 0x38], [0x1C1C0, 0x1F9C0, 0x3C], [0x1F9C0, 0x38828, 0x30]])
      dv.setUint32(at, crc32(bytes, s, e), true);
  }

  class PWSave {
    constructor(buffer, platform = 'switch') {
      this.platform = platform;
      this.raw = new Uint8Array(buffer.slice(0));
      this.origChecksum = filenameChecksum(this.raw);
      this.slot = detectSlot(this.raw);
      this.data = this.raw.slice();
      applyCipher(this.data, this.slot);
      const m = this.data.subarray(0x40, 0x44);
      if (!(m[0] === 0x6F && m[1] === 0x45 && m[2] === 0x62 && m[3] === 0x4E)) throw new Error('Déchiffrement impossible (fichier non reconnu)');
      this.dv = new DataView(this.data.buffer);
    }
    str(off, max) { let s = ''; for (let i = 0; i < max; i++) { const c = this.data[off + i]; if (!c) break; s += String.fromCharCode(c); } return s; }
    get playerName() { return this.str(L.NAME, 16); }
    get gmp() { return this.dv.getUint32(L.GMP, true); }
    set gmp(v) { this.dv.setUint32(L.GMP, Math.max(0, Math.min(0xFFFFFFFF, v | 0)) >>> 0, true); }
    aiBoard(type, idx) { return this.data[L.AI_A + type * L.AI_PER + idx]; }
    setAiBoard(type, idx, on) {
      const i = type * L.AI_PER + idx;
      this.data[L.AI_A + i] = on ? 1 : 0;
      if (on && this.data[L.AI_B + i] === 0) this.data[L.AI_B + i] = 1;
      if (!on) this.data[L.AI_B + i] = 0;
    }
    aiCount(type) { let n = 0; for (let i = 0; i < L.AI_PER; i++) if (this.aiBoard(type, i)) n++; return n; }
    vehicles() {
      const n = this.dv.getUint32(L.VEH_COUNT, true), out = [];
      for (let i = 0; i < n && i < 64; i++) {
        const rec = L.VEH_TABLE + i * L.VEH_SIZE;
        out.push({ index: i, offset: rec, name: this.str(rec + L.VEH_NAME, 16),
          model: this.data[rec + 0x48], deployed: (this.data[rec + L.VEH_FLAGS] & L.VEH_DEPLOYED) !== 0,
          uid: this.dv.getUint32(rec + L.VEH_UID, true), hp: this.dv.getUint16(rec + L.VEH_HP, true), hpMax: this.dv.getUint16(rec + L.VEH_HPMAX, true) });
      }
      return out;
    }
    vehicleStats(i) {
      const rec = L.VEH_TABLE + i * L.VEH_SIZE;
      return { atk: this.dv.getUint16(rec + VEH.ATK, true), armor: this.dv.getUint16(rec + VEH.ARMOR, true),
        st1: this.dv.getUint16(rec + VEH.ST1, true), st2: this.dv.getUint16(rec + VEH.ST2, true) };
    }
    setVehicleField(i, field, value) {
      const rec = L.VEH_TABLE + i * L.VEH_SIZE, v = Math.max(0, Math.round(Number(value) || 0));
      if (field === 'hp') return this.setVehicleHp(i, v);
      if (field === 'armor') { // 4th <CARAC> grade in game (0x76 always holds value x1.25)
        const a = Math.min(v, 9999);
        this.dv.setUint16(rec + VEH.ARMOR, a, true);
        this.dv.setUint16(rec + VEH.ARMOR2, Math.min(Math.round(a * 1.25), 9999), true);
        return;
      }
      if (field === 'atk') { this.dv.setUint16(rec + VEH.ATK, Math.min(v, 9999), true); return; }
      if (field === 'st1') return this.dv.setUint16(rec + VEH.ST1, Math.min(v, 9999), true);
      if (field === 'st2') return this.dv.setUint16(rec + VEH.ST2, Math.min(v, 9999), true);
      throw new Error('unknown field ' + field);
    }
    /** Every model of the game, plus anything unusual already in this save. */
    vehicleModels() {
      const out = new Map();
      for (const m of VEH_MODELS) out.set(m.name, { ...m, builtin: true });
      for (const v of this.vehicles()) if (!out.has(v.name)) {
        const st = this.vehicleStats(v.index);
        out.set(v.name, { name: v.name, cls: vehClass(v.name), hpMax: v.hpMax, atk: st.atk, builtin: false, index: v.index });
      }
      return [...out.values()].sort((a, b) => (a.id39 || 99) - (b.id39 || 99) || a.name.localeCompare(b.name));
    }
    addVehicle(name) {
      const n = this.dv.getUint32(L.VEH_COUNT, true);
      if (n >= L.VEH_MAX) throw new Error('Garage full');
      const dst = L.VEH_TABLE + n * L.VEH_SIZE;
      const model = VEH_MODELS.find(m => m.name === name);
      if (model) {
        // Start from a captured record of the same class, then stamp the model in.
        const base = VEH_MODELS.filter(m => m.cls === model.cls && VEH_TEMPLATES[m.name])[0] || { name: 'T-72A' };
        this.data.set(b64bytes(VEH_TEMPLATES[base.name]), dst);
        this.data[dst + 0x39] = model.id39;
        this.data[dst + VEH.MODEL] = model.id48;
        const nm = new Uint8Array(16);
        for (let k = 0; k < name.length && k < 15; k++) nm[k] = name.charCodeAt(k);
        this.data.set(nm, dst + VEH.NAME);
        this.dv.setUint16(dst + VEH.HPMAX, model.hpMax, true);
        this.dv.setUint16(dst + VEH.HPMAX + 2, Math.round(model.hpMax * 1.2), true);
        this.dv.setUint16(dst + VEH.ATK, model.atk, true);
      } else {
        const src = this.vehicles().find(v => v.name === name);
        if (!src) throw new Error('Unknown model: ' + name);
        this.data.copyWithin(dst, src.offset, src.offset + L.VEH_SIZE);
      }
      let uid; const used = new Set(this.vehicles().map(v => this.dv.getUint32(v.offset + L.VEH_UID, true)));
      do { uid = (Math.random() * 0x7FFFFFFF) >>> 0; } while (used.has(uid) || uid === 0);
      this.dv.setUint32(dst + L.VEH_UID, uid, true);
      this.data[dst + L.VEH_FLAGS] &= ~L.VEH_DEPLOYED;
      this.dv.setUint16(dst + VEH.HP, this.dv.getUint16(dst + VEH.HPMAX, true), true);
      this.dv.setUint32(L.VEH_COUNT, n + 1, true);
      return n;
    }
    /** Helicopters read the 4th <CARAC> grade from the attack value, ground units from 0x74. */
    isHelicopter(i) { return vehClass(this.vehicles()[i].name) === 'helicopter'; }
    gradeField(i) { return this.isHelicopter(i) ? 'atk' : 'armor'; }
    /** Raises the 4th in-game grade to S (checked on a MBTk-70, a LAV-G, a BTR-60PB and an AH56A-R). */
    gradeToS(i) { return this.isHelicopter(i) ? this.setVehicleField(i, 'atk', 9999) : this.setVehicleField(i, 'armor', 999); }
    setVehicleHp(i, v) {
      const rec = L.VEH_TABLE + i * L.VEH_SIZE, max = this.dv.getUint16(rec + L.VEH_HPMAX, true);
      this.dv.setUint16(rec + L.VEH_HP, Math.max(1, Math.min(max, v | 0)), true);
    }
    repairVehicles() { this.vehicles().forEach(v => this.setVehicleHp(v.index, v.hpMax)); }
    duplicateVehicle(i) {
      const n = this.dv.getUint32(L.VEH_COUNT, true);
      if (n >= L.VEH_MAX) throw new Error('Garage full');
      const src = L.VEH_TABLE + i * L.VEH_SIZE, dst = L.VEH_TABLE + n * L.VEH_SIZE;
      this.data.copyWithin(dst, src, src + L.VEH_SIZE);
      let uid; const used = new Set(this.vehicles().map(v => this.dv.getUint32(v.offset + L.VEH_UID, true)));
      do { uid = (Math.random() * 0x7FFFFFFF) >>> 0; } while (used.has(uid) || uid === 0);
      this.dv.setUint32(dst + L.VEH_UID, uid, true);
      this.data[dst + L.VEH_FLAGS] &= ~L.VEH_DEPLOYED;
      this.dv.setUint16(dst + L.VEH_HP, this.dv.getUint16(dst + L.VEH_HPMAX, true), true);
      this.dv.setUint32(L.VEH_COUNT, n + 1, true);
    }
    uidDeployedSomewhere(uid) {
      // Outer Ops squads keep their own copy of deployed vehicles (outside the garage table)
      const start = L.VEH_TABLE + L.VEH_MAX * L.VEH_SIZE;
      for (let o = start; o < 0x1F9C0; o += 4) if (this.dv.getUint32(o, true) === uid) return true;
      return false;
    }
    fixGhostVehicles() {
      let n = 0;
      for (const v of this.vehicles()) if (v.deployed && !this.uidDeployedSomewhere(v.uid)) { this.data[v.offset + L.VEH_FLAGS] &= ~L.VEH_DEPLOYED; n++; }
      return n;
    }
    zekeParts() {
      const n = Math.min(this.data[L.ZEKE_COUNT], L.ZEKE_MAX), out = [];
      for (let i = 0; i < n; i++) {
        const r = L.ZEKE_TABLE + i * L.ZEKE_SIZE, kind = this.data[r + 4], sub = this.data[r + 5];
        const def = ZEKE_PARTS.find(p => p.kind === kind && p.sub === sub);
        out.push({ index: i, kind, sub, name: def ? def.name : `Unknown (${kind}/${sub})`, equipped: this.data[r + 2] !== 0, condition: this.data[r + 6] });
      }
      return out;
    }
    addZekePart(kind, sub) {
      const n = this.data[L.ZEKE_COUNT];
      if (n >= L.ZEKE_MAX) throw new Error('Trop de pièces');
      const r = L.ZEKE_TABLE + n * L.ZEKE_SIZE;
      this.data.fill(0, r, r + L.ZEKE_SIZE);
      this.data[r + 4] = kind; this.data[r + 5] = sub; this.data[r + 6] = 100;
      this.data[L.ZEKE_COUNT] = n + 1;
    }
    removeZekePart(i) {
      const n = this.data[L.ZEKE_COUNT];
      const r = L.ZEKE_TABLE + i * L.ZEKE_SIZE, end = L.ZEKE_TABLE + n * L.ZEKE_SIZE;
      if (this.data[r + 2]) throw new Error('Pièce montée sur le ZEKE : démonte-la dans le jeu avant');
      this.data.copyWithin(r, r + L.ZEKE_SIZE, end);
      this.data.fill(0, end - L.ZEKE_SIZE, end);
      this.data[L.ZEKE_COUNT] = n - 1;
    }
    repairZeke() { const n = this.data[L.ZEKE_COUNT]; for (let i = 0; i < n; i++) this.data[L.ZEKE_TABLE + i * L.ZEKE_SIZE + 6] = 100; }
    zekeFragments() { return ZEKE_FRAG_ORDER.map((name, i) => ({ name, value: this.data[L.ZEKE_FRAG + i] })); }
    setZekeFragment(i, v) { this.data[L.ZEKE_FRAG + i] = Math.max(0, Math.min(4, v | 0)); }
    soldierOffset(i) { return L.STAFF + i * L.STAFF_SIZE; }
    soldiers() {
      const out = [];
      for (let i = 0; i < L.STAFF_COUNT; i++) {
        const r = this.soldierOffset(i), name = this.str(r + SOLDIER.name, 16);
        if (name) out.push(this.soldier(i));
      }
      return out;
    }
    soldier(i) {
      const r = this.soldierOffset(i), dv = this.dv, s = { index: i, name: this.str(r + SOLDIER.name, 16),
        assign: this.data[r + SOLDIER.assign], type: this.data[r + SOLDIER.type], sex: this.data[r + SOLDIER.sex],
        service: this.data[r + SOLDIER.service], gmp: dv.getUint32(r + SOLDIER.gmp, true),
        lifeCur: dv.getUint16(r + SOLDIER.lifeCur, true), lifeMax: dv.getUint16(r + SOLDIER.lifeMax, true),
        psyCur: dv.getUint16(r + SOLDIER.psyCur, true), psyMax: dv.getUint16(r + SOLDIER.psyMax, true),
        hostility: dv.getUint16(r + SOLDIER.hostility, true), morale: dv.getUint16(r + SOLDIER.morale, true),
        battle: {}, team: {} };
      let sum = 0;
      for (const [k, o] of Object.entries(SOLDIER.battle)) { s.battle[k] = dv.getUint16(r + o, true); sum += s.battle[k]; }
      for (const [k, o] of Object.entries(SOLDIER.team)) s.team[k] = dv.getUint16(r + o, true);
      s.power = sum;
      s.skills = [0, 1, 2, 3].map(k => this.data[r + SOLDIER.skills + k]);
      s.combat = Math.round(sum / 8);
      return s;
    }
    varGet(id) { return this.dv.getUint32(VARS + (id - 1) * 0x28 + 0x10, true); }
    varMax(id) { return this.dv.getUint32(VARS + (id - 1) * 0x28 + 0x18, true); }
    varSet(id, v) { this.dv.setUint32(VARS + (id - 1) * 0x28 + 0x10, Math.max(0, Math.min(this.varMax(id), v | 0)) >>> 0, true); }
    freeSoldierSlot() {
      for (let i = 0; i < L.STAFF_COUNT; i++) if (!this.data[this.soldierOffset(i) + SOLDIER.name]) return i;
      return -1;
    }
    cloneSoldier(template, name) {
      const slot = this.freeSoldierSlot();
      if (slot < 0) throw new Error('No free slot (350 soldiers max)');
      const src = this.soldierOffset(template), dst = this.soldierOffset(slot);
      this.data.copyWithin(dst, src, src + L.STAFF_SIZE);
      this.setSoldierField(slot, 'name', name);
      this.data[dst + SOLDIER.assign] = 1; // salle d'attente
      this.data[dst + 0x36] = 0;           // pas malade / blessé
      if (this.dv.getUint32(L.STAFF_BOUNDARY, true) < slot + 1) this.dv.setUint32(L.STAFF_BOUNDARY, slot + 1, true);
      return slot;
    }
    maxSoldier(i) {
      for (const k in SOLDIER.battle) this.setSoldierField(i, k, 1250);
      for (const k in SOLDIER.team) this.setSoldierField(i, k, 999);
      for (const k of ['lifeMax', 'lifeCur', 'psyMax', 'psyCur']) this.setSoldierField(i, k, 9999);
      this.setSoldierField(i, 'morale', 999);
    }
    rosterCount() { return this.soldiers().length; }
    setSoldierField(i, field, value) {
      const r = this.soldierOffset(i), dv = this.dv;
      const clamp = (v, m) => Math.max(0, Math.min(m, Math.round(Number(v) || 0)));
      if (field === 'name') {
        const b = new Uint8Array(16); const t = String(value).toUpperCase().replace(/[^\x20-\x7E]/g, '').slice(0, 15);
        for (let k = 0; k < t.length; k++) b[k] = t.charCodeAt(k);
        this.data.set(b, r + SOLDIER.name); return;
      }
      if (field.startsWith('skill')) { this.data[r + SOLDIER.skills + (+field.slice(5))] = clamp(value, 255); return; }
      if (field === 'assign') { this.data[r + SOLDIER.assign] = clamp(value, 9); return; }
      if (['lifeCur', 'lifeMax', 'psyCur', 'psyMax'].includes(field)) { dv.setUint16(r + SOLDIER[field], clamp(value, 9999), true); return; }
      if (['hostility', 'morale'].includes(field)) { dv.setUint16(r + SOLDIER[field], clamp(value, 999), true); return; }
      if (field in SOLDIER.battle) { dv.setUint16(r + SOLDIER.battle[field], clamp(value, 1250), true); return; }
      if (field in SOLDIER.team) { dv.setUint16(r + SOLDIER.team[field], clamp(value, 999), true); return; }
      throw new Error('unknown field ' + field);
    }
    // --- missions ---
    missions() {
      const dv = this.dv, res = [];
      for (let i = 0; i < MIS.N; i++) {
        const time = dv.getUint32(MIS.TIME + 4 * i, true), rank = dv.getUint16(MIS.RANK + 2 * i, true);
        if (time === 0xFFFFFFFF && rank === 0xFFFF) continue;
        if (time === 0 && rank === 0 && i >= 270) continue; // zero-filled tail
        res.push({ index: i, name: MISSION_NAMES[i] || ('Mission #' + i), checked: MISSION_CHECKED.has(i),
          time: time === 0xFFFFFFFF ? null : time / MIS_TICKS,
          kills: dv.getUint16(MIS.KILLS + 2 * i, true), alerts: dv.getUint16(MIS.ALERTS + 2 * i, true), rank });
      }
      return res;
    }
    setMission(i, field, value) {
      const dv = this.dv, v = Math.max(0, Math.round(Number(value) || 0));
      if (field === 'time') dv.setUint32(MIS.TIME + 4 * i, Math.min(v * MIS_TICKS, 0xFFFFFFFE), true);
      else if (field === 'kills' || field === 'alerts') {
        const off = (field === 'kills' ? MIS.KILLS : MIS.ALERTS) + 2 * i;
        if (dv.getUint16(off, true) !== 0xFFFF) dv.setUint16(off, Math.min(v, 999), true); // "---" stays "---"
      } else if (field === 'rank') dv.setUint16(MIS.RANK + 2 * i, Math.min(v, 5), true);
      else throw new Error('unknown field ' + field);
    }
    allMissionsS(clean) {
      let n = 0;
      for (const m of this.missions()) {
        if (m.time === null) continue;
        this.setMission(m.index, 'rank', 0); n++;
        if (clean) { this.setMission(m.index, 'kills', 0); this.setMission(m.index, 'alerts', 0); }
      }
      return n;
    }
    // --- R&D ---
    devList(kind) {
      const t = DEV[kind], dv = this.dv, n = dv.getUint32(t.count, true), res = [];
      for (let i = 0; i < n; i++) {
        const o = t.table + i * t.size;
        res.push({ index: i, id: dv.getUint32(o, true), state: dv.getUint32(o + 4, true), progress: dv.getUint32(o + 8, true), qty: dv.getUint32(o + 12, true) });
      }
      return res;
    }
    /** Quantity held, at +0x0C of a development record (the number printed in the R&D grid). */
    setDevQty(kind, index, v) {
      const t = DEV[kind];
      this.dv.setUint32(t.table + index * t.size + 12, Math.max(0, Math.min(9999, v | 0)) >>> 0, true);
    }
    finishDevelopments() {
      let n = 0;
      for (const kind in DEV) {
        const t = DEV[kind];
        for (const d of this.devList(kind)) if (d.state === 2) {
          const o = t.table + d.index * t.size;
          this.dv.setUint32(o + 4, 3, true); this.dv.setUint32(o + 8, 100, true); n++;
        }
      }
      return n;
    }
    build() {
      const out = this.data.slice();
      updateChecks(out, this.platform);
      applyCipher(out, this.slot);
      if (filenameChecksum(out) !== this.origChecksum) {
        const dv = new DataView(out.buffer);
        dv.setUint16(out.length - 2, 0, true);
        dv.setUint16(out.length - 2, filenameChecksum(out) ^ this.origChecksum, true);
      }
      return out;
    }
  }
  // --- vehicles ---------------------------------------------------------
  // Record 0xA0: uid u32 @0x18, flags u16 @0x3C (bit 0x80 = deployed in Outer Ops),
  // model id u8 @0x48, hp u16 @0x4A, hp max u16 @0x4C, attack u16 @0x68,
  // two per-unit values @0x50 / @0x58 that differ between two units of the same model.
  // The six <CARAC> grades shown in R&D > Mechas come from this per-record stat block
  // (each unit carries its own copy, so they can be edited unit by unit).
  const VEH_STATS = [0x5A, 0x5C, 0x5E, 0x60, 0x62, 0x64, 0x66, 0x6C, 0x6E, 0x70, 0x72, 0x74, 0x76, 0x78, 0x7A];
  const VEH = { ARMOR: 0x74, ARMOR2: 0x76, NAME: 0x28, UID: 0x18, FLAGS: 0x3C, MODEL: 0x48, HP: 0x4A, HPMAX: 0x4C, HPMAX2: 0x4E, ATK: 0x68, ST1: 0x50, ST2: 0x58, DEPLOYED: 0x80 };
  // Base records captured from real saves (uid cleared, full HP, not deployed).
  const VEH_TEMPLATES = {
    'AH56A-B': 'AAAAAAAAAACyATJg7tUAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAEFINTZBLUIAAAAAAAAAAAAALwMCEQAAAJcXAADa4I4AEACsDawNaBAoAEAfQB9AHwwA4AHgAeAB8ABAAUABQAGwBA8AAAAAAFAAZAAoADIAUABkAAMAAABfAAAAAACEAwAAYwIKAAoAAAAAAAAAAAAAAAAAAAAAAA==',
    'AH56A-R': 'AAAAAAAAAACyATJg7tUAAAAAAAAAAAAAAAAAAAgAAAAIAAAAAAAAAEFINTZBLVIAAAAAAAAAAAAAMAMCEQAAAHgYAADa4I4AEQCgD6APwBJUAEAfQB9AHygA4AHgAeAB8ABAAUABQAGwBBQAUABkAAAAAAAoADIAUABkAAMAAABfAAAAAACEAwAAjwIKAAoAAAAAAAAAAAAAAAAAAAAAAA==',
    'BTR-60PB': 'AAAAAAAAAACyATJg7tUAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAEJUUi02MFBCAAAAAAAAAAAAJgMCAQAAABMYAADa4I4AEwCsDawNaBAUAEAfQB9AH1oA4AHgAeAB8ABAAUABQAHWBgAAUABkAAAAAAAoADIAAAAAAAMAAABfAAAAAACEAwAAKwIKAAoAAAAAAAAAAAAAAAAAAAAAAA==',
    'LAV-C': 'AAAAAAAAAACyATJg7tUAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAExBVi1DAAAAAAAAAAAAAAAAKAMCEQAAANUZAADa4I4AFQCUEZQRGBVhAEAfQB9AHwEA4AHgAeAB8ABAAUABQAHWBgAAUABkAFAAZAAoADIAUABkAAMAAABfAAAAAACEAwAAegIKAAoAAAAAAAAAAAAAAAAAAAAAAA==',
    'LAV-G': 'AAAAAAAAAACyATJg7tUAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAExBVi1HAAAAAAAAAAAAAAAAJwMCAQAAALwYAADa4I4AFACgD6APwBJgAEAfQB9AHxkA4AHgAeAB8ABAAUABQAHcBQAAUABkAAAAAAAoADIAUABkAAMAAABfAAAAAACEAwAALwIKAAoAAAAAAAAAAAAAAAAAAAAAAA==',
    'MBTK-70': 'AAAAAAAAAACyATJg7tUAAAAAAAAAAAAAAAAAAAkAAAAIAAAAAAAAAE1CVEstNzAAAAAAAAAAAAAALAMCEQAAANcZAADa4I4ADQCIE4gTcBcPAEAfQB9AH0MALAEsASwByACWAAAAAAA6BwAAUABkACgAMgB4AJYAAAAAAAMAAABfAAAAAACqAwAABAIKAAoAAAAAAAAAAAAAAAAAAAAAAA==',
    'T-72A': 'AAAAAAAAAACyATJg7tUAAAAAAAAAAAAAAAAAAAoAAAAIAAAAAAAAAFQtNzJBAAAAAAAAAAAAAAAAKgMCEQAAAOsZAADa4I4ACwCUEZQRGBVWAEAfQB9AH0gA4AHgAeABAABAAUABQAE6BwAAAAAAAFAAZAAoADIAUABkAAMAAABfAAAAAACEAwAAZgIKAAoAAAAAAAAAAAAAAAAAAAAAAA=='
  };
  // Every model in the game, found by probing the model id at 0x39 in a real save.
  // id39 = model (0x25..0x30, valid range: outside it the game shows ZEKE or a broken record),
  // id48 = the second per-model index at 0x48. hp/atk marked est: true are guesses.
  const VEH_MODELS = [
    { name: 'BTR-60PA', cls: 'armored',    id39: 0x25, id48: 18, hpMax: 3000, atk: 1500, est: true },
    { name: 'BTR-60PB', cls: 'armored',    id39: 0x26, id48: 19, hpMax: 3500, atk: 1750 },
    { name: 'LAV-G',    cls: 'armored',    id39: 0x27, id48: 20, hpMax: 4000, atk: 1500 },
    { name: 'LAV-C',    cls: 'armored',    id39: 0x28, id48: 21, hpMax: 4500, atk: 1750 },
    { name: 'T-72U',    cls: 'tank',       id39: 0x29, id48: 10, hpMax: 4000, atk: 1750, est: true },
    { name: 'T-72A',    cls: 'tank',       id39: 0x2A, id48: 11, hpMax: 4500, atk: 1850 },
    { name: 'KPZ 70',   cls: 'tank',       id39: 0x2B, id48: 12, hpMax: 4500, atk: 1850, est: true },
    { name: 'MBTK-70',  cls: 'tank',       id39: 0x2C, id48: 13, hpMax: 5000, atk: 1850 },
    { name: 'MI-24A',   cls: 'helicopter', id39: 0x2D, id48: 14, hpMax: 3000, atk: 1200, est: true },
    { name: 'MI-24D',   cls: 'helicopter', id39: 0x2E, id48: 15, hpMax: 3500, atk: 1200, est: true },
    { name: 'AH56A-B',  cls: 'helicopter', id39: 0x2F, id48: 16, hpMax: 3500, atk: 1200 },
    { name: 'AH56A-R',  cls: 'helicopter', id39: 0x30, id48: 17, hpMax: 4000, atk: 1200 },
  ];
  // In-game categories (R&D > Mechas tabs). Prefixes, so Custom variants land in the right one.
  // Same order as the in-game R&D > Mechas tabs; 'all' is the last tab, not a real class.
  const VEH_CLASSES = ['armored', 'tank', 'helicopter', 'all'];
  function vehClass(name) {
    const n = String(name).toUpperCase();
    if (/^(T-72|KPZ|MBTK|MBT)/.test(n)) return 'tank';
    if (/^(BTR|LAV)/.test(n)) return 'armored';
    return 'helicopter';
  }
  function b64bytes(str) {
    if (typeof atob === 'function') { const bin = atob(str), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
    return new Uint8Array(Buffer.from(str, 'base64'));
  }

  // --- Missions: 4 parallel arrays of MIS_N entries (index = mission slot) ---
  // time u32 (1/300 s, 0xFFFFFFFF = never done) / kills u16 / alerts u16 (0xFFFF = "---") / rank u16 (0=S..5=E, 0xFFFF = none)
  const MIS = { N: 288, TIME: 0x29F8 };
  MIS.KILLS = MIS.TIME + 4 * MIS.N; MIS.ALERTS = MIS.KILLS + 2 * MIS.N; MIS.RANK = MIS.ALERTS + 2 * MIS.N;
  const MIS_TICKS = 300;
  const RANKS = ['S', 'A', 'B', 'C', 'D', 'E'];
  // slot -> name. Main Ops 1..33 follow the game's order (1-4 checked in game, the rest translated from the English list).
  const MISSION_NAMES = {
    1: "Début / Enquête dans le Complexe d'Approvisionnement", 2: 'Contact avec le Commandant Sandiniste', 3: "À la Poursuite d'Amanda",
    4: 'Attaque du Blindé LAV-Type G', 5: 'Sauvetage de Chico', 6: 'Poursuite du train dans la jungle', 7: 'Attaque du Char T-72U',
    8: 'Destruction de la barricade', 9: 'Infiltration de la base du cratère', 10: 'Combat contre Pupa', 11: 'Vers la forêt de nuages',
    12: "Attaque de l'hélicoptère Mi-24A", 13: 'Vers le laboratoire', 14: "Trouver la carte d'identité", 15: 'Combat contre Chrysalis',
    16: 'Vers la base minière', 17: 'Éliminer les gardes', 18: 'Combat contre Cocoon', 19: 'Infiltration de la base souterraine',
    20: 'Évasion de la salle de torture', 21: 'Vers le hangar de Peace Walker', 22: 'Combat contre Peace Walker',
    23: 'Infiltration de la base de missiles US', 24: 'Vers la tour de contrôle', 25: 'Combat contre Peace Walker 2', 26: 'Combat contre Peace Walker 3',
    27: 'Recherche de Zadornov 1', 28: 'Recherche de Zadornov 2', 29: 'Recherche de Zadornov 3', 30: 'Recherche de Zadornov 4',
    31: 'Recherche de Zadornov 5', 32: 'Recherche de Zadornov 6', 33: 'Combat contre ZEKE',
    36: "[005] L'Épreuve du Tireur d'Élite", 52: '[010] Récupération Fulton',
  };
  const MISSION_CHECKED = new Set([1, 2, 3, 4, 36, 52]);
  // --- R&D tables (both covered by the byte-sum check at 0x170) ---
  // weapons: u32 count @0xBD7C, records 0x1C: id, state (1 locked / 2 developing / 3 developed), progress %, xp u32, u16, level u16
  // items/uniforms: u32 count @0xE2FC, records 0x18 with the same first 3 fields
  const DEV = { weapons: { count: 0xBD7C, table: 0xBD80, size: 0x1C }, items: { count: 0xE2FC, table: 0xE300, size: 0x18 } };
  const SERVICE = { 2: 'COL', 3: 'TRD', 4: 'UNQ', 6: 'POW', 7: 'VOL', 8: 'NML' };
  const api = { VEH_TEMPLATES, VEH_MODELS, VEH_CLASSES, vehClass, zipRead, zipWrite, zipFindSave, RANKS, MISSION_NAMES, PROFILE_VARS, SKILLS, SERVICE, PWSave, filenameChecksum, LAYOUT: L, ZEKE_PARTS, SOLDIER, ASSIGN, battleGrade, teamGrade };
  if (typeof module !== 'undefined') module.exports = api; else root.PWCore = api;
})(this);
