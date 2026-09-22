/* MPW Switch Save Editor — UI. English source strings, translated through PW_FR. */
const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FR = window.PW_FR || {};
let LANG = 'en';
try { LANG = localStorage.getItem('pwlang') || ((navigator.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en'); } catch (e) {}
function T(s, vars) {
  let out = (LANG === 'fr' && FR[s]) || s;
  if (vars) for (const k in vars) out = out.split('{' + k + '}').join(vars[k]);
  return out;
}
const REF = () => (window.PW_REF ? window.PW_REF[LANG] || window.PW_REF.en : null);

/* ---------- static translation ---------- */
function walkText(el) {
  if (el.classList && el.classList.contains('dyn')) return;
  for (const n of el.childNodes) {
    if (n.nodeType === 3) {
      const src = n._src ?? (n._src = n.nodeValue);
      const k = src.trim();
      if (k) n.nodeValue = src.replace(k, T(k));
    } else if (n.nodeType === 1 && !n.hasAttribute('data-i18n-html')) walkText(n);
  }
}
function applyStatic() {
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = T(el._src ?? (el._src = el.innerHTML)); });
  walkText(document.body);
  document.querySelectorAll('[placeholder]').forEach(el => { el.placeholder = T(el._ph ?? (el._ph = el.placeholder)); });
  document.querySelectorAll('[title]').forEach(el => { el.title = T(el._ti ?? (el._ti = el.title)); });
  document.documentElement.lang = LANG;
  document.querySelectorAll('.langsw button').forEach(b => b.classList.toggle('on', b.dataset.lang === LANG));
}
function setLang(l) {
  LANG = l;
  try { localStorage.setItem('pwlang', l); } catch (e) {}
  applyStatic();
  if (save) render(); else setDirty(dirty);
}
document.querySelector('.langsw').onclick = e => { const b = e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); };

/* ---------- state ---------- */
const TYPES = [['L', 'Mobility', '#58c73a'], ['P', 'Sense', '#d7c832'], ['A', 'Attack', '#34c3d0'], ['S', 'Control', '#d9588f']];
const COLOR = Object.fromEntries(TYPES.map(t => [t[0], t[2]]));
let save = null, fileName = 'STW.bin', aiType = 0, dirty = false;
let zipEntries = null, zipEntry = null, zipName = null;

function toast(m) { const t = $('toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', 3200); }
function setDirty(d) { dirty = d; $('status').textContent = save ? ((zipName ? zipName + ' › ' + fileName : fileName) + (d ? ' — ' + T('modified') : '')) : ''; }

function load(file) {
  const r = new FileReader();
  r.onload = async () => {
    try {
      zipEntries = zipEntry = zipName = null;
      const u = new Uint8Array(r.result, 0, 4);
      let buf = r.result;
      if (u[0] === 0x50 && u[1] === 0x4B) {
        zipEntries = await PWCore.zipRead(r.result);
        zipEntry = PWCore.zipFindSave(zipEntries);
        zipName = file.name;
        buf = zipEntry.data.buffer.slice(zipEntry.data.byteOffset, zipEntry.data.byteOffset + zipEntry.data.length);
        fileName = zipEntry.name.split('/').pop();
      } else fileName = file.name;
      save = new PWCore.PWSave(buf);
      render(); $('drop').classList.add('hidden'); $('editor').classList.remove('hidden'); $('btnSave').disabled = false; setDirty(false);
      toast(zipEntries ? T('Zip loaded — {f}', { f: fileName }) : T('Save loaded'));
    } catch (e) { toast(T('Error: {m}', { m: T(e.message) })); }
  };
  r.readAsArrayBuffer(file);
}
function download(bytes, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes])); a.download = name; a.click(); }

function render() {
  $('gName').textContent = save.playerName || '—';
  $('gGmp').value = save.gmp;
  $('gFile').textContent = fileName;
  $('gVars').innerHTML = PWCore.PROFILE_VARS.map(([id, n]) => `<div class="field"><label>${T(n)}</label><input type="number" data-var="${id}" min="0" max="${save.varMax(id)}" value="${save.varGet(id)}"></div>`).join('');
  renderAI(); renderZeke(); renderSolFilter(); solSel = -1; renderSolList(); renderSolEdit();
  renderVeh(); renderMis(); renderDev(); renderRef(); renderDone();
}

/* ---------- general / R&D progress ---------- */
function renderDev() {
  const n = save.devList('weapons').concat(save.devList('items')).filter(d => d.state === 2);
  $('devInfo').textContent = n.length ? T('{n} development(s) in progress ({p})', { n: n.length, p: n.map(d => d.progress + ' %').join(', ') }) : T('No development in progress');
  $('devFinish').disabled = !n.length;
}
$('devFinish').onclick = () => { const n = save.finishDevelopments(); renderDev(); setDirty(true); toast(T('{n} development(s) finished', { n })); };
$('gVars').addEventListener('change', e => { const id = e.target.dataset.var; if (!id) return; save.varSet(+id, +e.target.value); e.target.value = save.varGet(+id); setDirty(true); });
$('gGmp').onchange = e => { save.gmp = Number(e.target.value); $('gGmp').value = save.gmp; setDirty(true); };

/* ---------- AI boards ---------- */
function renderAI() {
  $('aiTypes').innerHTML = TYPES.map((t, i) => `<button data-i="${i}" class="${i === aiType ? 'on' : ''}"><span style="color:${t[2]}">■</span> ${T(t[1])} <b>${save.aiCount(i)}</b></button>`).join('');
  let h = ''; for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) { const idx = c * 10 + r; h += `<div class="cell ${save.aiBoard(aiType, idx) ? 'on' : ''}" data-i="${idx}" title="${T('Board {n}', { n: idx + 1 })}"></div>`; }
  $('board').innerHTML = h;
}
$('aiTypes').onclick = e => { const b = e.target.closest('button'); if (!b) return; aiType = +b.dataset.i; renderAI(); };
$('board').onclick = e => { const c = e.target.closest('.cell'); if (!c) return; const i = +c.dataset.i; save.setAiBoard(aiType, i, !save.aiBoard(aiType, i)); renderAI(); setDirty(true); };
$('aiAllType').onclick = () => { for (let i = 0; i < 100; i++) save.setAiBoard(aiType, i, true); renderAI(); setDirty(true); };
$('aiNoneType').onclick = () => { for (let i = 0; i < 100; i++) save.setAiBoard(aiType, i, false); renderAI(); setDirty(true); };
$('aiAll').onclick = () => { for (let t = 0; t < 4; t++) for (let i = 0; i < 100; i++) save.setAiBoard(t, i, true); renderAI(); setDirty(true); };

/* ---------- soldiers ---------- */
let solSel = -1, solTab = -1, solSort = 'power', solDir = -1;
const SOL_TABS = [['All', -1], ['Waiting', 1], ['Combat', 2], ['R&D', 3], ['Mess', 5], ['Medical', 4], ['Intel', 6], ['Sick Bay', 9], ['Brig', 8]];
function renderSolFilter() { $('solTabs').innerHTML = SOL_TABS.map(([n, v]) => `<button data-tab="${v}" class="${v === solTab ? 'on' : ''}">${T(n)}</button>`).join(''); }
function renderSolList() {
  const q = $('solSearch').value.trim().toUpperCase();
  const list = save.soldiers().filter(s => (!q || s.name.includes(q)) && (solTab < 0 || s.assign === solTab));
  const key = s => solSort === 'name' ? s.name : (solSort in s.team ? s.team[solSort] : s[solSort]);
  if (solSort) list.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * solDir; });
  $('solCount').textContent = '👤 ' + save.rosterCount() + '/350';
  document.querySelectorAll('#solTable th').forEach(th => { const on = th.dataset.sort === solSort; th.classList.toggle('sorted', on); th.dataset.arrow = on ? (solDir < 0 ? ' ▼' : ' ▲') : ''; });
  const g = PWCore.teamGrade;
  $('solBody').innerHTML = list.map(s => `<tr data-i="${s.index}" class="${s.index === solSel ? 'on' : ''}">
    <td class="l"><span class="tag">${PWCore.SERVICE[s.service] || '???'}</span>${esc(s.name)}</td>
    <td>${s.lifeMax}</td><td>${s.psyMax}</td>
    <td class="g">${PWCore.battleGrade(s.combat)}</td>
    <td class="g">${g(s.team['R&D'])}</td><td class="g">${g(s.team['Mess Hall'])}</td><td class="g">${g(s.team['Medical'])}</td><td class="g">${g(s.team['Intel'])}</td>
    <td>${s.gmp}</td></tr>`).join('') || `<tr><td colspan=9>${T('No soldier')}</td></tr>`;
}
$('solTabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; solTab = +b.dataset.tab; renderSolFilter(); renderSolList(); };
$('solTable').querySelector('thead').onclick = e => { const th = e.target.closest('th'); if (!th) return; const k = th.dataset.sort; if (solSort === k) solDir = -solDir; else { solSort = k; solDir = k === 'name' ? 1 : -1; } renderSolList(); };
$('solSearch').oninput = renderSolList;
function renderSolEdit() {
  if (solSel < 0) { $('solEdit').innerHTML = ''; return; }
  const s = save.soldier(solSel);
  const row = (k, v, g) => `<div class="stat"><span>${T(k)}</span><input data-f="${k}" type="number" min="0" max="1250" value="${v}"><span class="grade">${g}</span></div>`;
  $('solEdit').innerHTML = `<div class="panel" style="background:#10130e">
   <h3 style="margin-top:0">${esc(s.name)} — ${PWCore.SERVICE[s.service] || ''}</h3>
   <div class="grid2">
    <div class="field"><label>${T('Name')}</label><input data-f="name" value="${esc(s.name)}" maxlength="15"></div>
    <div class="field"><label>${T('Assignment')}</label><select data-f="assign">${PWCore.ASSIGN.map((a, i) => `<option value="${i}" ${i === s.assign ? 'selected' : ''}>${T(a)}</option>`).join('')}</select></div>
   </div>
   <div class="grid2" style="margin-top:10px">
    <div class="field"><label>${T('Life (shown in game / base)')}</label><div style="display:flex;gap:6px"><input data-f="lifeMax" type="number" value="${s.lifeMax}"><input data-f="lifeCur" type="number" value="${s.lifeCur}"></div></div>
    <div class="field"><label>${T('Psyche (shown in game / base)')}</label><div style="display:flex;gap:6px"><input data-f="psyMax" type="number" value="${s.psyMax}"><input data-f="psyCur" type="number" value="${s.psyCur}"></div></div>
    <div class="field"><label>${T('Hostility')}</label><input data-f="hostility" type="number" value="${s.hostility}"></div>
    <div class="field"><label>${T('Morale')}</label><input data-f="morale" type="number" value="${s.morale}"></div>
   </div>
   <h3>${T('Skills')}</h3>
   <div class="grid2">${s.skills.map((v, k) => `<div class="field"><select data-f="skill${k}">${Object.entries(PWCore.SKILLS).concat(PWCore.SKILLS[v] === undefined ? [[v, T('Unknown ({v})', { v })]] : []).map(([id, n]) => `<option value="${id}" ${+id === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`).join('')}</div>
   <h3>${T('Combat aptitudes (rank {g})', { g: PWCore.battleGrade(s.combat) })}</h3>
   ${Object.entries(s.battle).map(([k, v]) => row(k, v, PWCore.battleGrade(v))).join('')}
   <h3>${T('Teams')}</h3>
   ${Object.entries(s.team).map(([k, v]) => row(k, v, PWCore.teamGrade(v)).replace('max="1250"', 'max="999"')).join('')}
   <div class="row"><button id="solMax">${T('This soldier to S everywhere')}</button><button id="solClone">${T('Clone this soldier')}</button></div></div>`;
}
$('solBody').onclick = e => { const d = e.target.closest('[data-i]'); if (!d) return; solSel = +d.dataset.i; renderSolList(); renderSolEdit(); $('solEdit').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
$('solEdit').addEventListener('change', e => { const f = e.target.dataset.f; if (!f) return; save.setSoldierField(solSel, f, e.target.value); setDirty(true); renderSolEdit(); if (f === 'name' || f === 'assign') renderSolList(); });
$('solEdit').addEventListener('click', e => {
  if (e.target.id === 'solMax') { save.maxSoldier(solSel); renderSolEdit(); renderSolList(); setDirty(true); }
  if (e.target.id === 'solClone') {
    const n = prompt(T('Clone name (15 characters max)'), save.soldier(solSel).name.slice(0, 13) + ' 2'); if (!n) return;
    try { solSel = save.cloneSoldier(solSel, n); renderSolList(); renderSolEdit(); setDirty(true); toast(T('Soldier cloned')); } catch (err) { toast(T(err.message)); }
  }
});
$('solNew').onclick = () => {
  const pool = save.soldiers().filter(s => s.type >= 1 && s.type <= 6);
  if (!pool.length) { toast(T('No combat soldier to use as a template')); return; }
  const n = prompt(T('New soldier name (15 characters max)'), ''); if (!n) return;
  try { const t = pool[Math.floor(Math.random() * pool.length)]; const i = save.cloneSoldier(t.index, n); save.maxSoldier(i); solSel = i; renderSolList(); renderSolEdit(); setDirty(true); toast(T('{n} joins the waiting room', { n: n.toUpperCase() })); } catch (err) { toast(T(err.message)); }
};
$('solAllS').onclick = () => { if (!confirm(T('Move every soldier to S (combat + teams)?'))) return; save.soldiers().forEach(s => save.maxSoldier(s.index)); renderSolList(); renderSolEdit(); setDirty(true); toast(T('Every soldier is now S')); };

/* ---------- garage ---------- */
const inp = 'background:#0b0d0a;color:var(--text);border:1px solid var(--line);border-radius:6px;padding:4px 6px';
function renderVeh() {
  const list = save.vehicles();
  $('vehCount').textContent = list.length + '/50';
  $('vehBody').innerHTML = list.map(v => {
    const st = save.vehicleStats(v.index);
    return `<tr><td>${v.index + 1}</td><td><b>${esc(v.name)}</b></td>
    <td><input type="number" data-f="hp" data-v="${v.index}" value="${v.hp}" min="1" max="${v.hpMax}" style="width:80px;${inp}"> / ${v.hpMax}</td>
    <td>${Math.round(100 * v.hp / v.hpMax)} %</td>
    <td><input type="number" data-f="atk" data-v="${v.index}" value="${st.atk}" min="0" max="9999" style="width:80px;${inp}"></td>
    <td><input type="number" data-f="armor" data-v="${v.index}" value="${st.armor}" min="0" max="9999" style="width:80px;${inp}"></td>
    <td><span class="unk">${save.gradeField(v.index) === 'atk' ? T('attack') : T('armor')}</span> <button data-armor="${v.index}" title="${T('Sets the value that the game turns into the 4th grade')}">S</button></td>
    <td><input type="number" data-f="st1" data-v="${v.index}" value="${st.st1}" min="0" max="9999" style="width:70px;${inp}"></td>
    <td><input type="number" data-f="st2" data-v="${v.index}" value="${st.st2}" min="0" max="9999" style="width:70px;${inp}"></td>
    <td>${v.deployed ? 'Outer Ops' : T('Garage')}</td><td><button data-dup="${v.index}">${T('Duplicate')}</button></td></tr>`;
  }).join('') || `<tr><td colspan=9>${T('No vehicle')}</td></tr>`;
  const models = save.vehicleModels();
  $('vehAdd').innerHTML = PWCore.VEH_CLASSES.map(c => {
    const list = c === 'all' ? models : models.filter(m => m.cls === c);
    const opts = list.map(m => `<option value="${esc(m.name)}">${esc(m.name)} — ${m.hpMax} ${T('HP')} · ${T('ATK')} ${m.atk}${m.est ? ' ≈' : ''}</option>`).join('');
    return `<div class="addbox">
      <label>${T(CLASS_LABEL[c])}</label>
      <div class="row" style="margin:0">
        <select data-cls="${c}" ${list.length ? '' : 'disabled'}>${opts || `<option>${T('none known yet')}</option>`}</select>
        <button data-add="${c}" ${list.length ? '' : 'disabled'}>+</button>
      </div></div>`;
  }).join('');
}
$('vehBody').addEventListener('change', e => { const i = e.target.dataset.v; if (i === undefined) return; save.setVehicleField(+i, e.target.dataset.f, e.target.value); renderVeh(); setDirty(true); });
$('vehBody').addEventListener('click', e => { const b = e.target.closest('[data-dup]'); if (!b) return; try { save.duplicateVehicle(+b.dataset.dup); renderVeh(); setDirty(true); toast(T('Vehicle duplicated')); } catch (err) { toast(T(err.message)); } });
const CLASS_LABEL = { armored: 'Armored', tank: 'Tanks', helicopter: 'Helicopters', all: 'All' };
$('vehAdd').addEventListener('click', e => {
  const b = e.target.closest('[data-add]'); if (!b) return;
  const n = $('vehAdd').querySelector(`select[data-cls="${b.dataset.add}"]`).value;
  try { save.addVehicle(n); renderVeh(); setDirty(true); toast(T('{n} added to the garage', { n })); } catch (err) { toast(T(err.message)); }
});
$('vehBody').addEventListener('click', e => { const b = e.target.closest('[data-armor]'); if (!b) return; save.gradeToS(+b.dataset.armor); renderVeh(); setDirty(true); toast(T('4th grade set to S')); });
$('vehRepair').onclick = () => { save.repairVehicles(); renderVeh(); setDirty(true); toast(T('Vehicles repaired')); };

/* ---------- ZEKE ---------- */
function partColor(name) { const d = PWCore.ZEKE_PARTS.find(p => p.name === name); return d ? COLOR[d.color] : '#888'; }
function renderZeke() {
  const parts = save.zekeParts();
  const ord = n => { const i = PWCore.ZEKE_PARTS.findIndex(x => x.name === n); return i < 0 ? 99 : i; };
  const group = main => parts.filter(p => { const d = PWCore.ZEKE_PARTS.find(x => x.name === p.name); return d ? d.main === main : main; })
    .sort((a, b) => ord(a.name) - ord(b.name) || a.index - b.index);
  const rows = list => list.map(p => `<tr><td>${p.index + 1}</td><td><span class="dot" style="background:${partColor(p.name)}"></span>${T(p.name)}</td><td>${p.condition} %</td><td>${p.equipped ? T('yes') : ''}</td><td>${p.equipped ? '' : `<button data-del="${p.index}">${T('Remove')}</button>`}</td></tr>`).join('');
  const m = group(true), o = group(false);
  $('zekeBody').innerHTML = (m.length || o.length)
    ? `<tr><td colspan=5 class="zgrp">${T('Main parts')}</td></tr>${rows(m) || `<tr><td colspan=5>${T('No part')}</td></tr>`}<tr><td colspan=5 class="zgrp">${T('Modules')}</td></tr>${rows(o) || `<tr><td colspan=5>${T('No part')}</td></tr>`}`
    : `<tr><td colspan=5>${T('No part')}</td></tr>`;
  $('zekeAddSel').innerHTML = PWCore.ZEKE_PARTS.map((p, i) => `<option value="${i}">${p.main ? T(p.name) : T('{p} (module)', { p: T(p.name) })}</option>`).join('');
  $('zekeFrag').innerHTML = save.zekeFragments().map((f, i) => `<div class="field"><label><span class="dot" style="background:${partColor(f.name)}"></span>${T(f.name)}</label><input type="number" min="0" max="4" data-frag="${i}" value="${f.value}"></div>`).join('');
}
$('zekeBody').onclick = e => { const b = e.target.closest('[data-del]'); if (!b) return; try { save.removeZekePart(+b.dataset.del); renderZeke(); setDirty(true); } catch (err) { toast(T(err.message)); } };
$('zekeAdd').onclick = () => { const p = PWCore.ZEKE_PARTS[+$('zekeAddSel').value]; try { save.addZekePart(p.kind, p.sub); renderZeke(); setDirty(true); } catch (err) { toast(T(err.message)); } };
$('zekeAll').onclick = () => { try { PWCore.ZEKE_PARTS.forEach(p => save.addZekePart(p.kind, p.sub)); renderZeke(); setDirty(true); } catch (err) { toast(T(err.message)); } };
$('zekeRepair').onclick = () => { save.repairZeke(); renderZeke(); setDirty(true); toast(T('Every part at 100%')); };
$('zekeFrag').addEventListener('change', e => { const i = e.target.dataset.frag; if (i === undefined) return; save.setZekeFragment(+i, +e.target.value); renderZeke(); setDirty(true); });

/* ---------- missions ---------- */
const EXTRA_SLOT = { 36: 5, 52: 10 };   // save slot -> Extra Op number (confirmed in game)
const slotForExtra = n => +Object.keys(EXTRA_SLOT).find(k => EXTRA_SLOT[k] === n) || 0;
function refForSlot(i) { const R = REF(); if (!R) return null; if (i >= 1 && i <= 33) return R.main[i - 1]; if (EXTRA_SLOT[i]) return R.extra[EXTRA_SLOT[i] - 1]; return null; }
const VEH_CAPTURE = { 4: 'LAV-G', 7: 'T-72U', 12: 'MI-24A' };
const ZEKE_DROP = { 10: 'Jet Pack', 15: 'Radome', 18: 'Armor' };
/** What can actually be checked in the save for a mission's reward. */
function gotReward(slot) {
  if (VEH_CAPTURE[slot]) {
    const want = VEH_CAPTURE[slot].replace(/-/g, '').toUpperCase();
    const has = save.vehicles().some(v => v.name.replace(/-/g, '').toUpperCase() === want);
    return { ok: has, txt: has ? '✅' : '❌', title: T(has ? 'Vehicle {v} in the garage' : 'Vehicle {v} missing', { v: VEH_CAPTURE[slot] }) };
  }
  if (ZEKE_DROP[slot]) {
    const p = ZEKE_DROP[slot], has = save.zekeParts().some(x => x.name === p);
    return { ok: has, txt: has ? '✅' : '❌', title: T(has ? 'ZEKE part {p} owned' : 'ZEKE part {p} missing', { p: T(p) }) };
  }
  return { ok: null, txt: '❔', title: T('Not detectable in the save yet') };
}
const fmtT = t => { if (t === null) return ''; t = Math.floor(t); return Math.floor(t / 3600) + ':' + String(Math.floor(t % 3600 / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
const parseT = v => String(v).split(':').map(Number).reduce((a, b) => a * 60 + (b || 0), 0);
function missionName(m) { const r = refForSlot(m.index); if (!r) return m.name; if (LANG === 'fr') return (m.checked ? m.name : (r.fr || m.name)); return r.en || m.name; }
function rewardHtml(r, withSp = true) {
  if (!r) return '';
  const a = [];
  if (r.s && r.s.length) a.push('<span class="srk" title="' + esc(T('only at S rank')) + '">S</span><b>' + r.s.map(esc).join(' · ') + '</b>');
  if (r.rw && r.rw.length) a.push(r.rw.map(esc).join(' · '));
  if (withSp && r.sp && r.sp.length) a.push('<i>' + r.sp.map(esc).join(' · ') + '</i>');
  return a.join('<br>') || '<i>—</i>';
}
let misFilter = 'all';
function renderMis() {
  let list = save.missions();
  const total = list.length, atS = list.filter(m => m.rank === 0).length;
  if (misFilter === 'notA') list = list.filter(m => m.rank > 1);
  else if (misFilter === 'notS') list = list.filter(m => m.rank > 0);
  $('misCount').textContent = misFilter === 'all'
    ? T('{n} / {t} at S', { n: atS, t: total })
    : T('{n} shown · {s} / {t} at S', { n: list.length, s: atS, t: total });
  const num = (m, f) => m[f] === 0xFFFF ? '---' : `<input data-m="${m.index}" data-f="${f}" type="number" min="0" max="999" value="${m[f]}" style="width:70px;${inp}">`;
  $('misBody').innerHTML = list.map(m => {
    const r = refForSlot(m.index), g = gotReward(m.index);
    return `<tr><td>${m.index}</td><td class="l" style="white-space:normal;min-width:220px">${m.checked ? '' : '≈ '}${esc(missionName(m)).replace(' (≈)', '')}</td>
   <td>${m.time === null ? '---' : `<input data-m="${m.index}" data-f="time" value="${fmtT(m.time)}" style="width:90px;${inp}">`}</td>
   <td>${num(m, 'kills')}</td><td>${num(m, 'alerts')}</td>
   <td><select data-m="${m.index}" data-f="rank" style="${inp}">${PWCore.RANKS.map((rk, i) => `<option value="${i}" ${i === m.rank ? 'selected' : ''}>${rk}</option>`).join('')}</select></td>
   <td class="${g.ok === true ? 'okv' : g.ok === false ? 'kov' : 'unk'}" title="${esc(g.title)}">${g.txt}</td>
   <td class="rw">${rewardHtml(r)}</td></tr>`;
  }).join('');
}
$('misBody').addEventListener('change', e => { const i = e.target.dataset.m, f = e.target.dataset.f; if (i === undefined) return; save.setMission(+i, f, f === 'time' ? parseT(e.target.value) : e.target.value); renderMis(); renderRef(); setDirty(true); });
$('misAllS').onclick = () => { const n = save.allMissionsS(false); renderMis(); renderRef(); setDirty(true); toast(T('{n} missions at S', { n })); };
$('misAllSClean').onclick = () => { const n = save.allMissionsS(true); renderMis(); renderRef(); setDirty(true); toast(T('{n} missions at S, 0 kill / 0 alert', { n })); };
$('t-mis').querySelector('.filters').addEventListener('click', e => {
  const b = e.target.closest('[data-mf]'); if (!b) return;
  misFilter = b.dataset.mf;
  $('t-mis').querySelectorAll('[data-mf]').forEach(x => x.classList.toggle('on', x === b));
  renderMis();
});

/* ---------- unlocks / reference ---------- */
let refTab = 'main', treeCat = 'all', onlyMissed = false, treeView = 'list', onlyTodo = true;
const REF_TABS = [['main', 'Main Ops'], ['extra', 'Extra Ops'], ['tree', 'R&D tree'], ['uniforms', 'Uniforms']];
/** Status of a mission for the "what did I miss" filter. */
function misStatus(kind, n) {
  if (!save) return null;
  const slot = kind === 'main' ? n : slotForExtra(n);
  if (!slot) return { k: 'unknown', txt: '?', cls: 'unk' };
  const m = save.missions().find(x => x.index === slot);
  const done = m && m.time !== null;
  const entry = (REF()[kind])[n - 1];
  const hasS = entry.s && entry.s.length;
  if (!done) {
    const maxDone = Math.max(...save.missions().filter(x => x.index <= 33 && x.time !== null).map(x => x.index), 0);
    if (kind === 'main' && slot < maxDone) return { k: 'skipped', txt: '⚠ ' + T('skipped'), cls: 'kov' };
    return { k: 'todo', txt: '— ' + T('not done'), cls: 'unk' };
  }
  if (hasS && m.rank !== 0) return { k: 'missedS', txt: '❌ ' + T('S reward missed'), cls: 'kov' };
  if (hasS) return { k: 'okS', txt: '✅ ' + T('S reward taken'), cls: 'okv' };
  return { k: 'done', txt: '✅ ' + T('finished'), cls: 'okv' };
}
function renderRef() {
  const R = REF();
  if (!R) { $('refBody').innerHTML = `<tr><td>${T('pwref.js not found')}</td></tr>`; return; }
  $('refTabs').innerHTML = REF_TABS.map(([k, n]) => `<button data-rt="${k}" class="${k === refTab ? 'on' : ''}">${T(n)}${k === 'tree' ? '' : ' <b>' + R[k].length + '</b>'}</button>`).join('')
    + `<button id="btnMissed" class="${onlyMissed ? 'on' : ''}" style="margin-left:12px">${T('What did I miss?')}</button>`;
  const tree = refTab === 'tree';
  $('refTreeWrap').classList.toggle('hidden', !tree);
  $('refTableWrap').classList.toggle('hidden', tree);
  if (tree) return renderTree();
  const q = $('refSearch').value.trim().toLowerCase();
  const hit = o => !q || JSON.stringify(o).toLowerCase().includes(q);
  const onlyS = $('refOnlyS').checked;
  const ranks = save ? Object.fromEntries(save.missions().map(m => [m.index, m])) : {};
  const rk = m => m ? (m.time === null ? '—' : PWCore.RANKS[m.rank] || '—') : '';
  let list = R[refTab].filter(o => hit(o) && (!onlyS || (o.s && o.s.length) || /rank S|rang S/i.test(o.u || '') || /rank S|rang S/i.test(o.bp || '')));
  let head, rows;
  if (refTab === 'main' || refTab === 'extra') {
    if (onlyMissed && save) list = list.filter(m => { const st = misStatus(refTab, m.n); return st && (st.k === 'missedS' || st.k === 'skipped'); });
    head = `<tr><th>${T('No.')}</th><th class="l">${T('MISSION')}</th><th>${T('YOUR RANK')}</th><th>${T('WHERE I AM')}</th><th class="l">${T('REWARDS')}</th><th class="l">${T('CONDITIONS / GOOD TO KNOW')}</th></tr>`;
    rows = list.map(m => {
      const sl = refTab === 'main' ? m.n : slotForExtra(m.n);
      const st = misStatus(refTab, m.n);
      return `<tr><td class="c">${refTab === 'extra' ? String(m.n).padStart(3, '0') : m.n}</td>
      <td><b>${esc((LANG === 'fr' ? m.fr : m.en) || m.en)}</b><br><i style="color:#b9b5a6">${esc(LANG === 'fr' ? m.en : (m.fr || ''))}</i>${m.ch ? '<br><i style="color:#8d8a7e">' + esc(m.ch) + '</i>' : ''}</td>
      <td class="c g">${sl ? rk(ranks[sl]) : '?'}</td>
      <td class="c ${st ? st.cls : ''}">${st ? st.txt : ''}</td>
      <td>${rewardHtml(m, false)}</td><td>${m.sp.map(esc).join('<br>') || ''}</td></tr>`;
    }).join('');
  } else {
    head = `<tr><th class="l">${T('UNIFORM (FR GAME)')}</th><th class="l">${T('ENGLISH NAME')}</th><th class="l">${T('HOW TO UNLOCK')}</th><th class="l">${T('NOTES')}</th></tr>`;
    rows = list.map(u => `<tr><td><b>${esc(u.fr || '—')}</b></td><td>${esc(u.n)}</td><td>${esc(u.u)}</td><td>${esc(u.no)}</td></tr>`).join('');
  }
  $('refHead').innerHTML = head;
  $('refBody').innerHTML = rows || `<tr><td>${T('No result')}</td></tr>`;
  $('refCount').textContent = list.length + ' / ' + R[refTab].length;
  $('refNote').innerHTML = refTab === 'main'
    ? T('No Main Op gives an S-rank-only item: Main Op S ranks are for the trophies / insignia (every Main Op at A, then at S, BIG BOSS title). Main Op 26 is unranked. Rewards come from finishing the mission or from items picked up in the stage.')
    : refTab === 'extra'
      ? T('“YOUR RANK” is only known for the Extra Ops whose slot I could confirm in the save (005 and 010). Battle Dress with helmet: S rank on Extra Ops 022-027 and 038-044.')
      : T('Team levels = the Mother Base team level (R&D, Mess Hall, Medical, Intel, Combat Unit). GMP cost = the Master Collection cost, half of the PSP cost given by the wiki (checked: Stun Grenade rank 4 = 71,055 GMP, R&D 63). “(?)” = sources disagree or unverified. Sources: Metal Gear Wiki (Fandom), Steam “Peace Walker Complete Guide”, Dayngls guides, jeuxvideo.com.');
}
$('refTabs').addEventListener('click', e => {
  const b = e.target.closest('[data-rt]');
  if (b) { refTab = b.dataset.rt; renderRef(); return; }
  if (e.target.closest('#btnMissed')) { onlyMissed = !onlyMissed; if (refTab === 'tree') refTab = 'main'; renderRef(); }
});
$('refSearch').oninput = renderRef;
$('refOnlyS').onchange = renderRef;


/* ---------- R&D conditions: what the save can actually tell us ---------- */
const TEAM_KEYS = [['rnd', 'R&D'], ['mess', 'Mess Hall'], ['med', 'Medical'], ['intel', 'Intel'], ['combat', 'Combat Unit']];
function teamLevels() {
  const o = {};
  for (const [k] of TEAM_KEYS) { let v = 0; try { v = +localStorage.getItem('pwlvl_' + k) || 0; } catch (e) {} o[k] = v; }
  return o;
}
/** "R&D 42 · Médical 27 · Rens. 27" -> {rnd:42, med:27, intel:27} */
function parseReq(req) {
  const out = {};
  for (const part of String(req || '').split('·')) {
    const m = /^\s*(.+?)\s+(\d+)\s*$/.exec(part); if (!m) continue;
    const n = m[1].toLowerCase(), v = +m[2];
    if (n.startsWith('r&d')) out.rnd = v;
    else if (n.startsWith('mess') || n.startsWith('cant')) out.mess = v;
    else if (n.startsWith('med') || n.startsWith('méd')) out.med = v;
    else if (n.startsWith('intel') || n.startsWith('rens')) out.intel = v;
    else if (n.startsWith('combat')) out.combat = v;
  }
  return out;
}
/** Mission named in a blueprint line -> is it finished in this save? */
function blueprintState(bp) {
  if (!bp) return { k: 'none', txt: '—', title: T('No blueprint needed') };
  const main = /Main Op\s*0*(\d+)/i.exec(bp), extra = /Extra Op\s*0*(\d+)/i.exec(bp);
  const stage = /(Trouvé sur le terrain|Found in stage|found in stage)/i.test(bp);
  let slot = null;
  if (main) slot = +main[1];
  else if (extra) slot = slotForExtra(+extra[1]) || null;
  if (slot === null) return { k: 'unknown', txt: '?', title: T('Mission not identified in the save') };
  const m = save.missions().find(x => x.index === slot);
  const done = !!(m && m.time !== null);
  if (!done) return { k: 'no', txt: '❌', title: T('Mission {n} not finished', { n: slot }) };
  return stage
    ? { k: 'maybe', txt: '✅?', title: T('Mission finished, but the blueprint is picked up in the stage — check in game') }
    : { k: 'yes', txt: '✅', title: T('Mission finished') };
}
/** Skill required by a line -> does anyone on the roster have it? */
function skillState(sk) {
  if (!sk) return { k: 'none', txt: '—', title: T('No skill needed') };
  const ids = Object.entries(PWCore.SKILLS).filter(([, n]) => n !== 'None' && sk.includes(n));
  if (!ids.length) return { k: 'unknown', txt: '?', title: sk };
  const want = new Set(ids.map(([id]) => +id));
  const who = save.soldiers().find(s => s.skills.some(v => want.has(v)));
  return who
    ? { k: 'yes', txt: '✅', title: T('{n} has it', { n: who.name }) }
    : { k: 'no', txt: '❌', title: T('Nobody on the roster has {s}', { s: ids[0][1] }) };
}
function levelState(req) {
  const need = parseReq(req), have = teamLevels(), missing = [];
  for (const [k, label] of TEAM_KEYS) if (need[k] && (!have[k] || have[k] < need[k])) missing.push(T(label) + ' ' + need[k]);
  if (!Object.keys(need).length) return { k: 'none', txt: '—', title: '' };
  const unknown = TEAM_KEYS.some(([k]) => need[k] && !have[k]);
  if (missing.length) return { k: unknown ? 'unknown' : 'no', txt: unknown ? '?' : '❌', title: (unknown ? T('Enter your team levels above') + ' — ' : '') + T('Needs {x}', { x: missing.join(', ') }) };
  return { k: 'yes', txt: '✅', title: T('Your team levels are high enough') };
}
function devStatus(w) {
  const bp = blueprintState(w.bp), sk = skillState(w.sk), lv = levelState(w.req);
  const bad = [bp, sk, lv].filter(x => x.k === 'no'), unk = [bp, sk, lv].filter(x => x.k === 'unknown' || x.k === 'maybe');
  const ready = !bad.length && !unk.length;
  const verdict = ready ? T('All conditions met') : bad.length ? bad.map(x => x.title).join(' · ') : unk.map(x => x.title).join(' · ');
  return { bp, sk, lv, ready, blocked: !!bad.length, verdict };
}

/* ---------- R&D tree ---------- */
function devNodes() {
  const R = REF();
  const all = R.weapons.map((w, i) => ({ ...w, kind: 'weapons', i })).concat(R.items.map((w, i) => ({ ...w, kind: 'items', i })));
  const key = w => w.n + '|' + (w.r || 1);
  const byKey = new Map(all.map(w => [key(w), w]));
  for (const w of all) {
    const m = /^(.*?)\s+(?:Rank|Rang)\s+(\d)/.exec(w.pre || '');
    w.parent = m ? byKey.get(m[1] + '|' + (+m[2])) || null : null;
    w.children = [];
  }
  for (const w of all) if (w.parent) w.parent.children.push(w);
  return all;
}
function renderTree() {
  const all = devNodes();
  const cats = [...new Set(all.map(w => w.c.split(' (')[0]))];
  if (treeCat !== 'all' && !cats.includes(treeCat)) treeCat = 'all';
  $('treeCats').innerHTML =
    `<button data-view="list" class="${treeView === 'list' ? 'on' : ''}">${T('List')}</button>`
    + `<button data-view="tree" class="${treeView === 'tree' ? 'on' : ''}">${T('Tree')}</button>`
    + `<span style="width:14px"></span>`
    + `<button data-cat="all" class="${treeCat === 'all' ? 'on' : ''}">${T('All')} <b>${all.length}</b></button>`
    + cats.map(c => `<button data-cat="${esc(c)}" class="${c === treeCat ? 'on' : ''}">${esc(c)} <b>${all.filter(w => w.c.split(' (')[0] === c).length}</b></button>`).join('');
  const q = $('refSearch').value.trim().toLowerCase();
  const inCat = treeCat === 'all' ? all : all.filter(w => w.c.split(' (')[0] === treeCat);
  if (treeView === 'list') return renderDevList(all, inCat, q);
  const roots = inCat.filter(w => !w.parent || !inCat.includes(w.parent));
  let row = 0; const cells = [];
  const walk = (w, r) => {
    const col = Math.min(5, Math.max(1, w.r || 1));
    cells.push({ w, r, col, linked: w.parent && w.parent._row === r && w.parent._col === col - 1 });
    w._row = r; w._col = col;
    const ch = inCat.filter(c => c.parent === w);
    ch.forEach((c, k) => walk(c, k === 0 ? r : ++row));
  };
  roots.forEach(w => { walk(w, ++row); });
  const show = cells.filter(c => !q || JSON.stringify(c.w).toLowerCase().includes(q));
  $('tree').innerHTML = show.map(({ w, r, col, linked }) => {
    const cls = ['tnode']; if (linked) cls.push('link'); if (w.sk) cls.push('skill'); else if (w.bp) cls.push('bp');
    const from = (!linked && w.parent) ? `<span class="from">${T('from {p} ★{r}', { p: esc(w.parent.n), r: w.parent.r || 1 })}</span>` : '';
    const title = [w.bp, w.pre, w.sk, w.no].filter(Boolean).join(' — ');
    return `<div class="${cls.join(' ')}" style="grid-row:${r};grid-column:${col}" title="${esc(title)}">
      <b>${esc(w.n)} ${w.r ? '★' + w.r : ''}</b>${from}
      <span class="meta">${esc(w.req || '—')}</span>
      ${w.gmp ? `<span class="cost">${Math.round(w.gmp / 2).toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-US')} ${LANG === 'fr' ? 'PIM' : 'GMP'}</span>` : ''}
    </div>`;
  }).join('');
  $('refCount').textContent = show.length + ' / ' + all.length;
  $('refNote').innerHTML = T('The tree follows the development chains (a rank needs the previous one). It is reference data: the save only stores numeric ids, so the editor cannot tell yet which line is developed in your game.');
  renderHisto(all);
}
function renderDevList(all, inCat, q) {
  const rows = inCat.filter(w => !q || JSON.stringify(w).toLowerCase().includes(q)).map(w => ({ w, st: devStatus(w) }))
    .filter(r => !onlyTodo || !r.st.ready);
  const cell = (x) => `<td class="c ${x.k === 'yes' ? 'okv' : x.k === 'no' ? 'kov' : 'unk'}" title="${esc(x.title)}">${x.txt}</td>`;
  $('tree').innerHTML = `<table class="gtable reft" style="grid-column:1/-1">
    <thead><tr><th class="l">${T('NAME')}</th><th>${T('RANK')}</th><th class="l">${T('CATEGORY')}</th>
      <th title="${T('Is the mission that gives the blueprint finished?')}">${T('BLUEPRINT')}</th>
      <th title="${T('Are your team levels high enough?')}">${T('LEVELS')}</th>
      <th title="${T('Is there a soldier with the required skill?')}">${T('SKILL')}</th>
      <th class="l">${T('WHAT IT TAKES')}</th><th>${T('GMP')}</th></tr></thead><tbody>`
    + rows.map(({ w, st }) => `<tr><td class="l"><b>${esc(w.n)}</b></td><td class="c">${w.r ? '★' + w.r : ''}</td><td>${esc(w.c)}</td>
      ${cell(st.bp)}${cell(st.lv)}${cell(st.sk)}
      <td>${st.ready ? '<b class="okv">' + T('All conditions met') + '</b>' : esc(st.verdict)}${w.pre ? '<br><i style="color:#8d8a7e">' + T('after {p}', { p: esc(w.pre) }) + '</i>' : ''}${w.bp ? '<br><i style="color:#8d8a7e">' + esc(w.bp) + '</i>' : ''}</td>
      <td class="c">${w.gmp ? Math.round(w.gmp / 2).toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-US') : ''}</td></tr>`).join('')
    + '</tbody></table>';
  $('refCount').textContent = rows.length + ' / ' + all.length;
  $('refNote').innerHTML = T('FOR INFORMATION — this tab does not unlock anything: it lists what the game asks for before a line shows up in R&D. The save knows whether the mission that gives the blueprint is finished and whether a soldier has the required skill; enter your team levels above for the rest. Whether a line is already developed is not readable yet: the save only stores numeric ids.');
}
$('treeCats').addEventListener('click', e => {
  const v = e.target.closest('[data-view]'); if (v) { treeView = v.dataset.view; return renderTree(); }
  const b = e.target.closest('[data-cat]'); if (!b) return; treeCat = b.dataset.cat; renderTree();
});
$('devTodo').onchange = () => { onlyTodo = $('devTodo').checked; renderTree(); };
$('devLevels').addEventListener('change', e => {
  const k = e.target.dataset.lvl; if (!k) return;
  try { localStorage.setItem('pwlvl_' + k, e.target.value || ''); } catch (err) {}
  if (k === 'rnd') $('histoLvl').value = e.target.value;
  renderTree();
});
function renderHisto(all) {
  const box = $('histo'); if (!box) return;
  const lvl = +($('histoLvl').value || 0);
  const buckets = new Array(20).fill(0);
  for (const w of all) { const m = /R&D (\d+)/.exec(w.req || ''); if (m) buckets[Math.min(19, Math.floor((+m[1] - 1) / 5))]++; }
  const max = Math.max(...buckets, 1);
  box.innerHTML = buckets.map((v, i) => {
    const lo = i * 5 + 1, hi = i * 5 + 5, on = lvl >= lo;
    return `<div class="hbar" title="R&D ${lo}-${hi} : ${v}"><span style="height:${Math.round(100 * v / max)}%;background:${on ? 'var(--accent2)' : '#3c4436'}"></span><i>${lo}</i></div>`;
  }).join('');
}
$('histoLvl').oninput = () => { try { localStorage.setItem('pwrnd', $('histoLvl').value); localStorage.setItem('pwlvl_rnd', $('histoLvl').value); } catch (e) {} renderTree(); };

/* ---------- 100 % / completionist ---------- */
let doneFilter = 'notA', bpFilter = 'todo';
const RANK_A = 1;           /* PWCore.RANKS = S A B C D E */
function mainOpRows() {
  const R = REF(); if (!R || !save) return [];
  const byIdx = Object.fromEntries(save.missions().map(m => [m.index, m]));
  return R.main.map((e, i) => {
    const m = byIdx[e.n] || null, done = !!(m && m.time !== null);
    return { n: e.n, name: (LANG === 'fr' ? (e.fr || e.en) : e.en), ch: chLabel(i), done, rank: done ? m.rank : null, ref: e, unranked: e.n === 26 };
  });
}
/** Chapter label of Main Op #i, in the current language. */
function chLabel(i) {
  const R = REF(); const raw = (LANG === 'fr' ? window.PW_REF.fr.main : window.PW_REF.en.main)[i];
  const t = (raw && raw.ch) || (R.main[i] && R.main[i].ch) || '—';
  return t.replace(/\s*\((?:FR|EN)\s*:[^)]*\)\s*$/, '');
}
function card(title, got, total, note, unknown) {
  if (unknown) return `<div class="card"><h4>${esc(title)}</h4><div class="big" style="color:var(--muted)">?</div><small>${esc(note || '')}</small></div>`;
  const pct = total ? Math.round(100 * got / total) : 0;
  return `<div class="card${got >= total && total ? ' full' : ''}"><h4>${esc(title)}</h4>
    <div class="big">${got} <span style="color:var(--muted);font-size:14px">/ ${total}</span></div>
    <div class="bar"><i style="width:${pct}%"></i></div>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
}

/* --- blueprints ------------------------------------------------------- */
const BP_RE = /Design Specs|Blueprint|Spécifications|Plans? de conception/i;
/** Every "Design Specs" the reference data mentions, with where it comes from and whether I can see it done. */
function blueprintList() {
  if (!window.PW_REF || !save) return [];
  const EN = window.PW_REF.en, CUR = window.PW_REF[LANG] || EN;
  const byIdx = Object.fromEntries(save.missions().map(m => [m.index, m]));
  const out = [];
  for (const kind of ['main', 'extra']) {
    EN[kind].forEach((e, i) => {
      const cur = (CUR[kind] || EN[kind])[i] || e;
      const slot = kind === 'main' ? e.n : slotForExtra(e.n);
      const m = slot ? byIdx[slot] : null;
      const done = !!(m && m.time !== null);
      const src = (kind === 'main' ? T('Main Op {n}', { n: e.n }) : T('Extra Op {n}', { n: String(e.n).padStart(3, '0') }))
        + ' · ' + ((LANG === 'fr' ? (cur.fr || cur.en) : cur.en) || e.en);
      for (const field of ['rw', 's', 'sp']) {
        (e[field] || []).forEach((txt, k) => {
          if (!BP_RE.test(txt)) return;
          const shown = ((cur[field] || [])[k]) || txt;     /* translated line when there is one */
          const inStage = /Found in stage/i.test(txt);
          let st;
          if (!slot) st = { i: '❔', k: 'todo', cls: 'unk', w: T('slot unknown in the save') };
          else if (inStage) st = done ? { i: '🔍', k: 'maybe', cls: 'unk', w: T('picked up inside the stage — I cannot check it') }
                                      : { i: '❌', k: 'todo', cls: 'kov', w: T('mission not done') };
          else if (field === 's') st = !done ? { i: '❌', k: 'todo', cls: 'kov', w: T('mission not done') }
                                   : m.rank === 0 ? { i: '✅', k: 'ok', cls: 'okv', w: T('S rank reached') }
                                   : { i: '⚠', k: 'todo', cls: 'kov', w: T('needs S rank — you are at {r}', { r: PWCore.RANKS[m.rank] }) };
          else st = done ? { i: '✅', k: 'ok', cls: 'okv', w: T('mission finished') }
                         : { i: '❌', k: 'todo', cls: 'kov', w: T('mission not done') };
          const lo = Math.floor((e.n - 1) / 20) * 20 + 1;
          const ch = kind === 'main' ? chLabel(i)
            : T('Extra Ops {a}-{b}', { a: String(lo).padStart(3, '0'), b: String(lo + 19).padStart(3, '0') });
          const where = inStage ? (/\(([^()]+)\)\s*$/.exec(shown) || [])[1] : null;
          out.push({ name: bpName(shown, inStage), full: shown, where, key: bpKey(txt, inStage), src, ch, st, sRank: field === 's' });
        });
      }
    });
  }
  return mergeBp(out);
}
/** Short display name: drop the "Found in stage:" prefix and the "Design Specs" suffix. */
function bpName(t, inStage) {
  let x = t.replace(/^(Found in stage|Trouvé sur le terrain|Trouvé dans)\s*:\s*/i, '');
  if (inStage) x = x.replace(/\s*\([^()]+\)\s*$/, '');          /* the stage location */
  x = x.replace(/\s*\((?:Fandom|Steam|source|sources)[^()]*\)/gi, '').replace(/\s*\(\?\)\s*$/, '');
  return x
          .replace(/\s*(Design Specs|Blueprint)\b/i, '')
          .replace(/^(Spécifications?|Spécifi\.|Spéc\.|Spé\.|Plans?)\s+(de\s+conception\s+|conception\s+)?(du |de la |de l['’]|des |d['’])?/i, '')
          .replace(/\s{2,}/g, ' ').replace(/^[\s·-]+|[\s·-]+$/g, '') || t;
}
/** Key used to merge the same blueprint written several ways across the reference. */
function bpKey(enText, inStage) {
  return bpName(enText, inStage).toLowerCase()
    .replace(/\bw\/\s*/g, '').replace(/\((bj|barrel jacket)\)/g, '(barrel jacket)')
    .replace(/[^a-z0-9]/g, '');
}
const BP_RANK = { ok: 2, maybe: 1, todo: 0 };
/** One row per blueprint: merge the duplicates, keep the best status, list every source. */
function mergeBp(list) {
  const by = new Map();
  for (const b of list) {
    const g = by.get(b.key);
    if (!g) { by.set(b.key, { ...b, srcs: [b.src + (b.sRank ? ' (S)' : '')] }); continue; }
    g.srcs.push(b.src + (b.sRank ? ' (S)' : ''));
    if (BP_RANK[b.st.k] > BP_RANK[g.st.k]) { g.st = b.st; g.sRank = b.sRank; }
    if (b.name.length > g.name.length) g.name = b.name;
    if (!g.where && b.where) g.where = b.where;
  }
  return [...by.values()];
}
function renderBp() {
  let list = blueprintList();
  const total = list.length;
  const q = ($('bpSearch').value || '').trim().toLowerCase();
  if (bpFilter === 'todo') list = list.filter(b => b.st.k !== 'ok');
  if (q) list = list.filter(b => (b.name + ' ' + b.srcs.join(' ')).toLowerCase().includes(q));
  $('bpCount').textContent = list.length + ' / ' + total;
  const groups = [];
  for (const b of list) { let g = groups.find(x => x.ch === b.ch); if (!g) groups.push(g = { ch: b.ch, rows: [] }); g.rows.push(b); }
  $('doneBp').innerHTML = groups.map((g, i) => `<details class="ch" ${i < 2 ? 'open' : ''}><summary>${esc(g.ch)} <b>${g.rows.length}</b></summary>
    <div class="gtable-wrap"><table class="gtable"><tbody>${g.rows.map(b => `<tr>
      <td class="c ${b.st.cls}" style="width:40px" title="${esc(b.st.w)}">${b.st.i}</td>
      <td class="l"><b>${esc(b.name)}</b>${b.sRank ? ' <span class="srk" title="' + esc(T('only at S rank')) + '">S</span>' : ''}${b.where ? ' <span class="bpsrc">— ' + esc(b.where) + '</span>' : ''}<br><span class="bpsrc">${esc(b.srcs.join(' · '))} — ${esc(b.st.w)}</span></td>
    </tr>`).join('')}</tbody></table></div></details>`).join('')
    || `<p class="note">${T('Nothing left here — well done.')}</p>`;
}

function renderDone() {
  if (!save || !REF()) return;
  const rows = mainOpRows();
  const ranked = rows.filter(r => !r.unranked);
  const atA = ranked.filter(r => r.done && r.rank <= RANK_A).length;
  const atS = ranked.filter(r => r.done && r.rank === 0).length;
  const fin = rows.filter(r => r.done).length;
  const bps = blueprintList(), bpOk = bps.filter(b => b.st.k === 'ok').length, bpMaybe = bps.filter(b => b.st.k === 'maybe').length;

  const zAll = PWCore.ZEKE_PARTS, zHave = new Set(save.zekeParts().map(p => p.name));
  const vAll = PWCore.VEH_MODELS.map(v => v.name);
  const vHave = new Set(save.vehicles().map(v => v.name.replace(/-/g, '').toUpperCase()));
  const vMiss = vAll.filter(n => !vHave.has(n.replace(/-/g, '').toUpperCase()));
  const wDev = save.devList('weapons').filter(d => d.state === 3).length, wTot = save.devList('weapons').length;
  const iDev = save.devList('items').filter(d => d.state === 3).length, iTot = save.devList('items').length;
  const aiGot = [0, 1, 2, 3].reduce((a, t) => a + save.aiCount(t), 0);

  $('doneCards').innerHTML = [
    card(T('Main Ops finished'), fin, rows.length, T('Main Op 26 has no rank')),
    card(T('Main Ops at A or better'), atA, ranked.length, T('goal: every Main Op at A')),
    card(T('Main Ops at S'), atS, ranked.length, T('goal: BIG BOSS title')),
    card(T('Blueprints reachable'), bpOk, bps.length, T('+ {n} probably picked up in a stage', { n: bpMaybe })),
    card(T('Weapons developed'), wDev, wTot, T('R&D lines present in the save')),
    card(T('Items developed'), iDev, iTot, T('R&D lines present in the save')),
    card(T('ZEKE parts'), zAll.length - zAll.filter(p => !zHave.has(p.name)).length, zAll.length, ''),
    card(T('Known vehicle models'), vAll.length - vMiss.length, vAll.length, T('models I can add from the garage')),
    card(T('AI Memory boards'), aiGot, 400, ''),
    card(T('Outer Ops'), 0, 0, T('not located in the save yet'), true)
  ].join('');

  let list = rows;
  if (doneFilter === 'notA') list = rows.filter(r => !r.unranked && (!r.done || r.rank > RANK_A));
  else if (doneFilter === 'notS') list = rows.filter(r => !r.unranked && (!r.done || r.rank !== 0));
  else if (doneFilter === 'todo') list = rows.filter(r => !r.done);
  $('doneCount').textContent = list.length + ' / ' + rows.length;
  const chs = [];
  for (const r of list) { let g = chs.find(x => x.ch === r.ch); if (!g) chs.push(g = { ch: r.ch, rows: [] }); g.rows.push(r); }
  const head = `<tr><th>${T('No.')}</th><th class="l">${T('MAIN OP')}</th><th>${T('YOUR RANK')}</th><th>${T('MISSING FOR A')}</th><th>${T('MISSING FOR S')}</th><th class="l">${T('REWARDS')}</th></tr>`;
  $('doneMain').innerHTML = chs.map((g, i) => `<details class="ch" ${i < 3 ? 'open' : ''}><summary>${esc(g.ch)} <b>${g.rows.length}</b></summary>
    <div class="gtable-wrap"><table class="gtable"><thead>${head}</thead><tbody>${g.rows.map(r => {
      const rk = r.unranked ? '—' : r.done ? PWCore.RANKS[r.rank] : T('not done');
      const needA = r.unranked ? '—' : (r.done && r.rank <= RANK_A) ? '✅' : '❌';
      const needS = r.unranked ? '—' : (r.done && r.rank === 0) ? '✅' : '❌';
      return `<tr><td class="c">${r.n}</td><td class="l"><b>${esc(r.name)}</b></td>
        <td class="c g">${esc(rk)}</td><td class="c">${needA}</td><td class="c">${needS}</td>
        <td>${rewardHtml(r.ref, false)}</td></tr>`;
    }).join('')}</tbody></table></div></details>`).join('')
    || `<p class="note">${T('Nothing left here — well done.')}</p>`;

  const chips = (arr, ok) => arr.length ? `<div class="chips">${arr.map(n => `<span class="chip ${ok ? 'ok' : 'ko'}">${esc(T(n))}</span>`).join('')}</div>` : `<p class="note" style="margin:0">${T('Nothing left here — well done.')}</p>`;
  $('doneColl').innerHTML =
    `<div class="collgrp"><h4>${T('ZEKE parts still missing')}</h4>${chips(zAll.filter(p => !zHave.has(p.name)).map(p => p.name), false)}</div>` +
    `<div class="collgrp"><h4>${T('Vehicle models not in the garage')}</h4>${chips(vMiss, false)}</div>` +
    `<p class="note">${T('Weapons and items cannot be listed by name yet: the save stores R&D lines by id, without a name. That mapping is the last missing piece.')}</p>` +
    `<p class="note">${T('Outer Ops: I have not found where the save stores its progress. Send me two zips — one before an Outer Ops battle, one just after — and I will locate it in one pass.')}</p>`;
  renderBp();
}
$('t-done').addEventListener('click', e => {
  const d = e.target.closest('[data-dq]'), b = e.target.closest('[data-bq]');
  if (d) { doneFilter = d.dataset.dq; $('t-done').querySelectorAll('[data-dq]').forEach(x => x.classList.toggle('on', x === d)); renderDone(); }
  else if (b) { bpFilter = b.dataset.bq; $('t-done').querySelectorAll('[data-bq]').forEach(x => x.classList.toggle('on', x === b)); renderBp(); }
});
$('bpSearch').oninput = renderBp;

/* ---------- tabs, files ---------- */
$('tabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b)); ['gen', 'ai', 'sol', 'veh', 'zeke', 'mis', 'ref', 'done'].forEach(t => $('t-' + t).classList.toggle('hidden', t !== b.dataset.t)); if (b.dataset.t === 'done' && save) renderDone(); };
$('btnOpen').onclick = () => $('file').click();
$('drop').onclick = () => $('file').click();
$('file').onchange = e => e.target.files[0] && load(e.target.files[0]);
['dragover', 'dragenter'].forEach(ev => $('drop').addEventListener(ev, e => { e.preventDefault(); $('drop').classList.add('hover'); }));
['dragleave', 'drop'].forEach(ev => $('drop').addEventListener(ev, e => { e.preventDefault(); $('drop').classList.remove('hover'); }));
$('drop').addEventListener('drop', e => e.dataTransfer.files[0] && load(e.dataTransfer.files[0]));
$('btnSave').onclick = () => {
  try {
    const out = save.build();
    if (zipEntries) { zipEntry.data = out; download(PWCore.zipWrite(zipEntries), zipName); setDirty(false); toast(T('Zip written: {f} — put it back in /JKSV/…', { f: zipName })); }
    else { download(out, fileName); setDirty(false); toast(T('File written: {f}', { f: fileName })); }
  } catch (e) { toast(T('Error: {m}', { m: T(e.message) })); }
};
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
try {
  $('histoLvl').value = localStorage.getItem('pwrnd') || '';
  for (const [k] of TEAM_KEYS) { const el = document.querySelector(`[data-lvl="${k}"]`); if (el) el.value = localStorage.getItem('pwlvl_' + k) || ''; }
} catch (e) {}
applyStatic();
