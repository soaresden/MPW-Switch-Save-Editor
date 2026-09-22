// MPW Switch Save Editor - core (no dependencies). Works in browser and Node.
(function (root) {
  const LCG_MUL = 0x02E90EDD;
  const MAIN = { header: 0x00, region: 0x40, size: 0x387F0 };
  const L = {
    NAME: 0x188, GMP: 0xB570,
    AI_A: 0x13860, AI_B: 0x9D48, AI_TYPES: 4, AI_PER: 100,
    VEH_COUNT: 0x115D8,
    ZEKE_COUNT: 0x1385C, ZEKE_TABLE: 0x139F4, ZEKE_SIZE: 12, ZEKE_MAX: 100, ZEKE_FRAG: 0x13784,
    STAFF: 0x1FA80, STAFF_SIZE: 0xA0, STAFF_COUNT: 350, VEH_TABLE: 0x115E0, VEH_SIZE: 0xA0, VEH_NAME: 0x28, VEH_MAX: 50, VEH_UID: 0x18, VEH_SQUAD: 0x1C, VEH_HP: 0x4A, VEH_HPMAX: 0x4C,
  };
  const SOLDIER = {
    name: 0x20, assign: 0x30, type: 0x31, sex: 0x34,
    lifeCur: 0x42, lifeMax: 0x44, psyCur: 0x4A, psyMax: 0x4C,
    hostility: 0x7E, morale: 0x82, skills: 0x98,
    battle: { Tir: 0x58, Rechargement: 0x5A, Lancer: 0x5C, Pose: 0x5E, Marche: 0x54, Course: 0x52, 'Combat rapproché': 0x56, 'Défense': 0x60 },
    team: { 'R&D': 0x6C, Cantine: 0x64, 'Médical': 0x68, Renseignement: 0x70 },
  };
  const ZEKE_PARTS = [
    { kind: 1, sub: 1, name: 'Tête', color: 'P', main: true },
    { kind: 2, sub: 1, name: 'Jambes', color: 'L', main: true },
    { kind: 3, sub: 1, name: 'Module Alim.', color: 'A', main: true },
    { kind: 4, sub: 1, name: 'Module Loco.', color: 'S', main: true },
    { kind: 5, sub: 1, name: 'Jet pack', color: 'L', main: false },
    { kind: 5, sub: 2, name: 'Radôme', color: 'S', main: false },
    { kind: 5, sub: 3, name: 'Blindage', color: 'S', main: false },
    { kind: 5, sub: 4, name: 'Railgun', color: 'A', main: false },
  ];
  const ZEKE_FRAG_ORDER = ['Tête', 'Module Alim.', 'Module Loco.', 'Jambes'];
  const ASSIGN = ['Non assigné', "Salle d'attente", 'Unité de combat', 'R&D', 'Équipe médicale', 'Cantine', 'Renseignement', 'Attente échange', 'Cellule', 'Infirmerie'];
  const GRADES = ['E', 'D', 'C', 'B', 'A', 'S'];
  const BATTLE_MIN = [0, 209, 417, 626, 834, 1042];
  const TEAM_MIN = [1, 100, 200, 500, 750, 1001];
  const battleGrade = v => { for (let g = 5; g >= 0; g--) if (v >= BATTLE_MIN[g]) return GRADES[g]; return 'E'; };
  const teamGrade = v => { if (!v) return '-'; for (let g = 5; g >= 0; g--) if (v >= TEAM_MIN[g]) return GRADES[g]; return 'E'; };
  const mul32 = (a, b) => Number((BigInt(a >>> 0) * BigInt(b >>> 0)) & 0xFFFFFFFFn);

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
          model: this.data[rec + 0x48], hp: this.dv.getUint16(rec + L.VEH_HP, true), hpMax: this.dv.getUint16(rec + L.VEH_HPMAX, true) });
      }
      return out;
    }
    setVehicleHp(i, v) {
      const rec = L.VEH_TABLE + i * L.VEH_SIZE, max = this.dv.getUint16(rec + L.VEH_HPMAX, true);
      this.dv.setUint16(rec + L.VEH_HP, Math.max(1, Math.min(max, v | 0)), true);
    }
    repairVehicles() { this.vehicles().forEach(v => this.setVehicleHp(v.index, v.hpMax)); }
    duplicateVehicle(i) {
      const n = this.dv.getUint32(L.VEH_COUNT, true);
      if (n >= L.VEH_MAX) throw new Error('Garage plein');
      const src = L.VEH_TABLE + i * L.VEH_SIZE, dst = L.VEH_TABLE + n * L.VEH_SIZE;
      this.data.copyWithin(dst, src, src + L.VEH_SIZE);
      let uid; const used = new Set(this.vehicles().map(v => this.dv.getUint32(v.offset + L.VEH_UID, true)));
      do { uid = (Math.random() * 0x7FFFFFFF) >>> 0; } while (used.has(uid) || uid === 0);
      this.dv.setUint32(dst + L.VEH_UID, uid, true);
      this.dv.setUint32(dst + L.VEH_SQUAD, 0, true);
      this.dv.setUint16(dst + L.VEH_HP, this.dv.getUint16(dst + L.VEH_HPMAX, true), true);
      this.dv.setUint32(L.VEH_COUNT, n + 1, true);
    }
    zekeParts() {
      const n = Math.min(this.data[L.ZEKE_COUNT], L.ZEKE_MAX), out = [];
      for (let i = 0; i < n; i++) {
        const r = L.ZEKE_TABLE + i * L.ZEKE_SIZE, kind = this.data[r + 4], sub = this.data[r + 5];
        const def = ZEKE_PARTS.find(p => p.kind === kind && p.sub === sub);
        out.push({ index: i, kind, sub, name: def ? def.name : `Inconnu (${kind}/${sub})`, equipped: this.data[r + 2] !== 0, condition: this.data[r + 6] });
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
        lifeCur: dv.getUint16(r + SOLDIER.lifeCur, true), lifeMax: dv.getUint16(r + SOLDIER.lifeMax, true),
        psyCur: dv.getUint16(r + SOLDIER.psyCur, true), psyMax: dv.getUint16(r + SOLDIER.psyMax, true),
        hostility: dv.getUint16(r + SOLDIER.hostility, true), morale: dv.getUint16(r + SOLDIER.morale, true),
        battle: {}, team: {} };
      let sum = 0;
      for (const [k, o] of Object.entries(SOLDIER.battle)) { s.battle[k] = dv.getUint16(r + o, true); sum += s.battle[k]; }
      for (const [k, o] of Object.entries(SOLDIER.team)) s.team[k] = dv.getUint16(r + o, true);
      s.combat = Math.round(sum / 8);
      return s;
    }
    setSoldierField(i, field, value) {
      const r = this.soldierOffset(i), dv = this.dv;
      const clamp = (v, m) => Math.max(0, Math.min(m, Math.round(Number(v) || 0)));
      if (field === 'name') {
        const b = new Uint8Array(16); const t = String(value).toUpperCase().replace(/[^\x20-\x7E]/g, '').slice(0, 15);
        for (let k = 0; k < t.length; k++) b[k] = t.charCodeAt(k);
        this.data.set(b, r + SOLDIER.name); return;
      }
      if (field === 'assign') { this.data[r + SOLDIER.assign] = clamp(value, 9); return; }
      if (['lifeCur', 'lifeMax', 'psyCur', 'psyMax'].includes(field)) { dv.setUint16(r + SOLDIER[field], clamp(value, 9999), true); return; }
      if (['hostility', 'morale'].includes(field)) { dv.setUint16(r + SOLDIER[field], clamp(value, 999), true); return; }
      if (field in SOLDIER.battle) { dv.setUint16(r + SOLDIER.battle[field], clamp(value, 1250), true); return; }
      if (field in SOLDIER.team) { dv.setUint16(r + SOLDIER.team[field], clamp(value, 1250), true); return; }
      throw new Error('champ inconnu ' + field);
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
  const api = { PWSave, filenameChecksum, LAYOUT: L, ZEKE_PARTS, SOLDIER, ASSIGN, battleGrade, teamGrade };
  if (typeof module !== 'undefined') module.exports = api; else root.PWCore = api;
})(this);
