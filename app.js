/* Open Peeps avatar maker with clothing patches and a layer checker.
   Art: Open Peeps by Pablo Stanley (CC0). Parts converted from @opeepsfun/open-peeps and @dicebear/open-peeps. */
(function () {
  'use strict';
  const P = window.PEEP_PARTS;
  const ADMIN = new URLSearchParams(location.search).has('admin');
  const DRAFT_KEY = 'peeps-layers-draft-v1';
  const STATE_KEY = 'peeps-avatar-v1';
  const NS = 'http://www.w3.org/2000/svg';

  // ---------- layer config (admin drafts override the published file) ----------
  const clone = (o) => JSON.parse(JSON.stringify(o));
  let L = clone(window.PEEP_LAYERS);
  if (ADMIN) { try { const d = localStorage.getItem(DRAFT_KEY); if (d) L = JSON.parse(d); } catch (e) {} }
  L.offsets = L.offsets || {}; L.head = L.head || {}; L.patchSpot = L.patchSpot || {};
  L.hidden = L.hidden || {}; L.conflicts = L.conflicts || []; L.reviewed = L.reviewed || {};
  for (const c of ['hair', 'face', 'beard', 'accessory', 'mask']) L.offsets[c] = L.offsets[c] || {};
  const A = L.anchors;
  const NECK = A.neck;

  // ---------- colors ----------
  const SKIN = ['#FFE4CF', '#F5CFA0', '#E0A97A', '#D08B5B', '#AE5D29', '#8C4F2B', '#694D3D', '#4A3123'];
  const HAIRC = ['#1B1B1B', '#4A3123', '#8C4F2B', '#C9862C', '#E8C86E', '#B7B7B7', '#F2F2F2', '#C93C3C', '#7A4CC2', '#2F7DD1'];
  const CLOTH = ['#1F4E9C', '#6F9BE0', '#FFFFFF', '#F2C230', '#1B1B1B', '#9AA5B1', '#C93C3C', '#2E8B57', '#F28C38', '#BA98DE', '#F5B7C5', '#8C4F2B'];
  const BG = ['transparent', '#FFFFFF', '#E3EBF8', '#1F4E9C', '#F2C230', '#DCEFE4', '#F8E3DC', '#EDE4F7'];
  // which visitor color each part token uses
  const TOKEN = {
    skinColor: 'skin', hairColor: 'hair', beardColor: 'hair', topColor: 'top', pantsColor: 'pants',
    jacketColor: 'jacket', blazerColor: 'jacket', coatColor: 'jacket', shoesColor: 'shoes',
    capColor: 'hat', beanieColor: 'hat', turbanColor: 'hat', hijabColor: 'hat', clipColor: 'hat',
    frameColor: 'accent', cupColor: 'accent', paperColor: 'accent', computerColor: 'accent', knifeColor: 'accent',
    pocketColor: 'accent', wheelchairColor: 'accent', bikeFrameColor: 'accent', bikeIronColor: 'accent', prothesisColor: 'accent',
  };
  const COLOR_LABEL = { skin: 'Skin', hair: 'Hair', top: 'Top', pants: 'Pants', jacket: 'Jacket', shoes: 'Shoes', hat: 'Headwear', accent: 'Props', bg: 'Background' };

  // ---------- state ----------
  const DEFAULT = {
    view: 'bust',
    body: { bust: 'Hoodie', standing: 'ShirtColorTee', sitting: 'MidColorTee' },
    hair: 'ShortOne', face: 'Smile', beard: null, accessory: null, mask: null,
    colors: { skin: '#E0A97A', hair: '#1B1B1B', top: '#1F4E9C', pants: '#1B1B1B', jacket: '#6F9BE0', shoes: '#FFFFFF', hat: '#1F4E9C', accent: '#F2C230', bg: '#E3EBF8' },
    patches: [],
  };
  let S = clone(DEFAULT);
  try { const s = JSON.parse(localStorage.getItem(STATE_KEY)); if (s && s.body) S = Object.assign(clone(DEFAULT), s); } catch (e) {}
  const save = () => { try { localStorage.setItem(STATE_KEY, JSON.stringify(S)); } catch (e) {} };
  let selectedPatch = null;

  // ---------- patches library ----------
  const PATCHES = (window.PEEP_PATCHES || []).map((p) => ({ ...p, href: p.svg ? 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(p.svg))) : p.src, w: 120, h: 120 }));
  PATCHES.forEach((p) => {
    // read the aspect ratio; inline file-based patches so downloads keep them
    const img = new Image();
    img.onload = () => { p.w = img.naturalWidth || 120; p.h = img.naturalHeight || 120; render(); };
    img.src = p.href;
    if (!p.svg && p.src) {
      fetch(p.src).then((r) => r.blob()).then((b) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }))
        .then((url) => { p.href = url; render(); }).catch(() => {});
    }
  });
  const patchById = (id) => PATCHES.find((p) => p.id === id);

  // ---------- helpers ----------
  const visible = (cat, name) => !(L.hidden[cat] || []).includes(name);
  const list = (cat, includeHidden) => Object.keys(P[cat]).filter((n) => includeHidden || visible(cat, n));
  const bodyCat = () => S.view;
  const curBody = () => S.body[S.view];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const label = (n) => (P.mask[n] ? P.mask[n].name : n.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2'));

  function paint(svg, colors) {
    return svg.replace(/\{\{(\w+)\}\}/g, (m, t) => (t === 'outlineColor' ? '#000' : colors[TOKEN[t]] || '#9AA5B1'));
  }
  function offT(cat, name) {
    const o = L.offsets[cat][name] || {};
    return `translate(${o.x || 0} ${o.y || 0}) scale(${o.sx || 1} ${o.sy || 1})`;
  }
  function headT(view, body) {
    const h = (L.head[view] || {})[body] || { x: 0, y: 0, s: 1, r: 0 };
    return { h, str: `translate(${h.x} ${h.y}) scale(${h.s}) rotate(${h.r || 0} ${NECK[0]} ${NECK[1]})` };
  }
  // neck point of the current body, in body coordinates
  function neckPoint(view, body) { const { h } = headT(view, body); return [h.x + h.s * NECK[0], h.y + h.s * NECK[1], h.s]; }

  function headSVG(st) {
    const c = st.colors; let out = '';
    const g = (cat, name) => (name && P[cat][name] ? `<g data-layer="${cat}" transform="translate(${A[cat][0]} ${A[cat][1]})"><g transform="${offT(cat, name)}">${paint(P[cat][name].svg, c)}</g></g>` : '');
    out += g('hair', st.hair); out += g('face', st.face); out += g('beard', st.beard); out += g('mask', st.mask); out += g('accessory', st.accessory);
    return out;
  }
  function patchesSVG(st, withSel) {
    const [nx, ny, s] = neckPoint(st.view, st.body[st.view]);
    return st.patches.map((pt, i) => {
      const p = patchById(pt.pid); if (!p) return '';
      const w = pt.size * s, h = w * (p.h / p.w);
      const x = nx + pt.dx * s, y = ny + pt.dy * s;
      const sel = withSel && i === selectedPatch ? `<rect class="sel-box" x="${-w / 2 - 6}" y="${-h / 2 - 6}" width="${w + 12}" height="${h + 12}"/>` : '';
      return `<g class="patch" data-i="${i}" transform="translate(${x} ${y}) rotate(${pt.rot || 0})"><image href="${p.href}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}"/>${sel}</g>`;
    }).join('');
  }
  function figureSVG(st, withSel) {
    const view = st.view, body = st.body[view], part = P[view][body];
    const { str } = headT(view, body);
    return `<g data-layer="body">${paint(part.svg, st.colors)}</g><g data-layer="patches">${patchesSVG(st, withSel)}</g><g data-layer="head" transform="${str}">${headSVG(st)}</g>`;
  }

  // measure bounds with a hidden svg
  const meas = document.createElementNS(NS, 'svg');
  meas.setAttribute('style', 'position:absolute;left:-9999px;top:0;width:10px;height:10px;visibility:hidden');
  document.body.appendChild(meas);
  function boundsOf(inner) {
    meas.innerHTML = `<g>${inner}</g>`;
    const b = meas.firstChild.getBBox();
    return b;
  }
  function frame(st, inner) {
    const b = boundsOf(inner);
    const pad = Math.max(b.width, b.height) * 0.06;
    // square frame centered on the figure: suits profile pictures and the square stage
    const side = Math.max(b.width, b.height) + pad * 2;
    const x = b.x + b.width / 2 - side / 2, y = b.y + b.height / 2 - side / 2;
    return `${x.toFixed(1)} ${y.toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}`;
  }
  function fullSVG(st, withSel) {
    const inner = figureSVG(st, false);
    const vb = frame(st, inner);
    const [x, y, w, h] = vb.split(' ').map(Number);
    const bg = st.colors.bg !== 'transparent' ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${st.colors.bg}"/>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${esc(describe(st))}">${bg}${withSel ? figureSVG(st, true) : inner}</svg>`;
  }
  function describe(st) {
    const bits = [label(st.body[st.view]) + ' outfit', label(st.hair) + ' hair', label(st.face) + ' face'];
    if (st.beard) bits.push(label(st.beard) + ' facial hair');
    if (st.accessory) bits.push(label(st.accessory));
    if (st.mask) bits.push(label(st.mask));
    if (st.patches.length) bits.push(st.patches.length + ' patch' + (st.patches.length > 1 ? 'es' : ''));
    return 'Avatar: ' + bits.join(', ');
  }

  // ---------- conflicts ----------
  const CATS = ['hair', 'face', 'beard', 'accessory', 'mask', 'body'];
  function valueOf(st, cat) { return cat === 'body' ? st.body[st.view] : st[cat]; }
  function matches(term, cat, name) { const [c, n] = term.split(':'); return c === cat && (n === '*' ? name != null : n === name); }
  // Returns conflicting [cat, name] pairs if `cat` were set to `name`
  function conflictsFor(cat, name, st) {
    const out = [];
    if (name == null) return out;
    for (const [a, b] of L.conflicts) {
      for (const [mine, other] of [[a, b], [b, a]]) {
        if (!matches(mine, cat, name)) continue;
        const oc = other.split(':')[0]; const ov = valueOf(st, oc);
        if (oc !== cat && matches(other, oc, ov)) out.push([oc, ov]);
      }
    }
    return out;
  }
  const REQUIRED = ['body', 'hair', 'face'];
  // a clash with a required part (outfit, hair, face) blocks the choice; optional parts get cleared
  const blockers = (cat, name, st) => conflictsFor(cat, name, st).filter(([oc]) => REQUIRED.includes(oc));
  function setPart(cat, name) {
    const block = blockers(cat, name, S);
    if (block.length) {
      const [oc, ov] = block[0];
      status(`${label(name)} doesn’t work with the ${label(ov)} ${oc === 'body' ? 'outfit' : oc}. Change that first.`);
      return;
    }
    const clash = conflictsFor(cat, name, S);
    for (const [oc] of clash) S[oc] = null;
    if (cat === 'body') S.body[S.view] = name; else S[cat] = name;
    status(clash.length ? 'Removed ' + clash.map(([c, n]) => label(n)).join(', ') + ': it doesn’t fit with ' + label(name) + '.' : '');
    save(); render(); renderTab();
  }

  // ---------- stage ----------
  const stage = document.getElementById('stage');
  function render() {
    stage.innerHTML = fullSVG(S, true);
    document.querySelectorAll('.views button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === S.view));
    if (ADMIN) renderAdmin();
  }
  function status(msg) { document.getElementById('status').textContent = msg; }

  // drag patches
  let drag = null;
  function svgPoint(evt) {
    const svg = stage.querySelector('svg'); const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  stage.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('.patch');
    if (!g) { if (selectedPatch != null) { selectedPatch = null; render(); renderTab(); } return; }
    const i = Number(g.dataset.i); selectedPatch = i;
    const p = svgPoint(e); const pt = S.patches[i]; const s = neckPoint(S.view, curBody())[2];
    drag = { i, sx: p.x, sy: p.y, dx: pt.dx, dy: pt.dy, s };
    stage.setPointerCapture(e.pointerId); render(); renderTab(); e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return; const p = svgPoint(e); const pt = S.patches[drag.i];
    pt.dx = drag.dx + (p.x - drag.sx) / drag.s; pt.dy = drag.dy + (p.y - drag.sy) / drag.s; render();
  });
  stage.addEventListener('pointerup', () => { if (drag) { drag = null; save(); } });

  // ---------- tabs ----------
  const TABS = [
    ['outfit', 'Outfit'], ['hair', 'Hair'], ['face', 'Face'], ['beard', 'Facial hair'],
    ['accessory', 'Glasses'], ['mask', 'Mask'], ['colors', 'Colors'], ['patches', 'Patches'],
  ];
  let tab = 'outfit';
  const tabsEl = document.getElementById('tabs'), bodyEl = document.getElementById('tabbody');
  tabsEl.innerHTML = TABS.map(([id, t]) => `<button role="tab" data-tab="${id}" aria-selected="${id === tab}">${t}</button>`).join('');
  tabsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; tabsEl.querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', x === b)); renderTab(); });

  // small preview of one option
  function thumb(cat, name) {
    const st = clone(S); st.patches = [];
    if (cat === 'body') { st.body[st.view] = name; }
    else st[cat] = name;
    let inner;
    if (cat === 'body') inner = `<g>${paint(P[st.view][name].svg, st.colors)}</g>`;
    else inner = headSVG(st);
    const vb = cat === 'body' ? P[st.view][name].viewBox : thumbBox[cat] || '300 120 600 600';
    return `<svg viewBox="${vb}" aria-hidden="true">${inner}</svg>`;
  }
  const thumbBox = { hair: '230 60 720 720', face: '470 330 420 420', beard: '440 470 420 420', accessory: '400 360 460 460', mask: '380 430 480 480' };

  function optionGrid(cat, current, allowNone) {
    const names = cat === 'body' ? list(S.view) : list(cat);
    let h = '<div class="grid">';
    if (allowNone) h += `<button class="opt none" data-cat="${cat}" data-name="" aria-pressed="${current == null}">None</button>`;
    for (const n of names) {
      const b = n === current ? [] : blockers(cat, n, S);
      const why = b.length ? ` (doesn’t work with ${label(b[0][1])})` : '';
      h += `<button class="opt${b.length ? ' is-hidden' : ''}" data-cat="${cat}" data-name="${n}" aria-pressed="${n === current}" title="${esc(label(n) + why)}" aria-label="${esc(label(n) + why)}">${thumb(cat, n)}</button>`;
    }
    return h + '</div>';
  }
  function swatchRow(key, palette) {
    return `<div class="row"><label>${COLOR_LABEL[key]}</label><div class="swatches">${palette.map((c) => `<button class="sw" data-color="${key}" data-val="${c}" aria-label="${COLOR_LABEL[key]} ${c}" aria-pressed="${S.colors[key] === c}" style="background:${c === 'transparent' ? 'repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0/10px 10px' : c}"></button>`).join('')}${key !== 'bg' ? `<input type="color" data-color="${key}" value="${S.colors[key]}" aria-label="Custom ${COLOR_LABEL[key]} color">` : ''}</div></div>`;
  }
  function usedColorKeys() {
    const keys = new Set(['skin']);
    const add = (part) => part && part.colors && part.colors.forEach((t) => TOKEN[t] && keys.add(TOKEN[t]));
    add(P[S.view][curBody()]); add(P.hair[S.hair]); if (S.beard) add(P.beard[S.beard]);
    return keys;
  }
  function renderTab() {
    let h = '';
    if (tab === 'outfit') h = optionGrid('body', curBody(), false);
    else if (tab === 'hair') h = optionGrid('hair', S.hair, false);
    else if (tab === 'face') h = optionGrid('face', S.face, false);
    else if (tab === 'beard') h = optionGrid('beard', S.beard, true);
    else if (tab === 'accessory') h = optionGrid('accessory', S.accessory, true);
    else if (tab === 'mask') h = optionGrid('mask', S.mask, true);
    else if (tab === 'colors') {
      const used = usedColorKeys();
      h += swatchRow('skin', SKIN);
      if (used.has('hair')) h += swatchRow('hair', HAIRC); else h += '<p class="hint">This hairstyle is drawn in ink and has no color option.</p>';
      for (const k of ['top', 'jacket', 'pants', 'shoes', 'hat', 'accent']) if (used.has(k)) h += swatchRow(k, CLOTH);
      h += swatchRow('bg', BG);
    } else if (tab === 'patches') {
      h += '<h2>Add a patch</h2><p class="hint">Pick one, then drag it on the avatar to place it.</p><div class="grid">';
      for (const p of PATCHES) h += `<button class="opt" data-addpatch="${p.id}" title="${esc(p.name)}" aria-label="Add ${esc(p.name)}"><img src="${p.href}" alt="" style="max-width:80%;max-height:80%"></button>`;
      h += '</div>';
      if (S.patches.length) {
        h += '<h2>Your patches</h2><div class="row" style="gap:4px">';
        S.patches.forEach((pt, i) => { const p = patchById(pt.pid); h += `<button class="btn" data-selpatch="${i}" aria-pressed="${i === selectedPatch}" style="${i === selectedPatch ? 'border-color:var(--accent);background:var(--accent-soft)' : ''}">${esc(p ? p.name : pt.pid)}</button>`; });
        h += '</div>';
      }
      if (selectedPatch != null && S.patches[selectedPatch]) {
        const pt = S.patches[selectedPatch];
        h += `<h2>Selected patch</h2>
        <div class="row"><label for="p-size">Size</label><input id="p-size" type="range" min="20" max="400" value="${Math.round(pt.size)}" data-pprop="size"></div>
        <div class="row"><label for="p-rot">Tilt</label><input id="p-rot" type="range" min="-45" max="45" value="${Math.round(pt.rot || 0)}" data-pprop="rot"></div>
        <div class="row"><button class="btn" data-pact="back">Send back</button><button class="btn" data-pact="front">Bring forward</button><button class="btn" data-pact="dup">Duplicate</button><button class="btn" data-pact="del">Remove</button></div>
        <p class="hint">Arrow keys nudge the selected patch (hold Shift for bigger steps).</p>`;
      }
    }
    bodyEl.innerHTML = h;
  }
  bodyEl.addEventListener('click', (e) => {
    const o = e.target.closest('[data-cat]');
    if (o) { setPart(o.dataset.cat, o.dataset.name || null); return; }
    const sw = e.target.closest('button[data-color]');
    if (sw) { S.colors[sw.dataset.color] = sw.dataset.val; save(); render(); renderTab(); return; }
    const ap = e.target.closest('[data-addpatch]');
    if (ap) {
      const spot = (L.patchSpot[S.view] || {})[curBody()] || { dx: 95, dy: 260, size: 110 };
      S.patches.push({ pid: ap.dataset.addpatch, dx: spot.dx + S.patches.length * 18, dy: spot.dy + S.patches.length * 18, size: spot.size, rot: 0 });
      selectedPatch = S.patches.length - 1; save(); render(); renderTab(); status('Patch added. Drag it into place.'); return;
    }
    const sp = e.target.closest('[data-selpatch]');
    if (sp) { selectedPatch = Number(sp.dataset.selpatch); render(); renderTab(); return; }
    const pa = e.target.closest('[data-pact]');
    if (pa && selectedPatch != null) {
      const i = selectedPatch, a = pa.dataset.pact, arr = S.patches;
      if (a === 'del') { arr.splice(i, 1); selectedPatch = null; }
      if (a === 'dup') { arr.push({ ...arr[i], dx: arr[i].dx + 20, dy: arr[i].dy + 20 }); selectedPatch = arr.length - 1; }
      if (a === 'front' && i < arr.length - 1) { [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; selectedPatch = i + 1; }
      if (a === 'back' && i > 0) { [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]; selectedPatch = i - 1; }
      save(); render(); renderTab();
    }
  });
  bodyEl.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('input[type=color]')) { S.colors[t.dataset.color] = t.value; save(); render(); }
    if (t.dataset.pprop && selectedPatch != null) { S.patches[selectedPatch][t.dataset.pprop] = Number(t.value); save(); render(); }
  });
  bodyEl.addEventListener('change', (e) => { if (e.target.matches('input[type=color]')) renderTab(); });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input,select,textarea')) return;
    if (ADMIN && adminKeys(e)) return;
    if (selectedPatch == null || !S.patches[selectedPatch]) return;
    const step = e.shiftKey ? 20 : 4, pt = S.patches[selectedPatch];
    const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (k) { pt.dx += k[0]; pt.dy += k[1]; save(); render(); e.preventDefault(); }
    if (e.key === 'Delete' || e.key === 'Backspace') { S.patches.splice(selectedPatch, 1); selectedPatch = null; save(); render(); renderTab(); e.preventDefault(); }
  });

  document.querySelector('.views').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]'); if (!b) return;
    S.view = b.dataset.view; selectedPatch = null; save(); render(); renderTab();
  });

  // ---------- randomize ----------
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  document.getElementById('random').addEventListener('click', () => {
    const st = S;
    st.body[st.view] = pick(list(st.view)); st.hair = pick(list('hair')); st.face = pick(list('face'));
    st.beard = Math.random() < 0.3 ? pick(list('beard')) : null;
    st.accessory = Math.random() < 0.35 ? pick(list('accessory')) : null;
    st.mask = Math.random() < 0.1 ? pick(list('mask')) : null;
    st.colors.skin = pick(SKIN); st.colors.hair = pick(HAIRC);
    for (const k of ['top', 'pants', 'jacket', 'shoes', 'hat', 'accent']) st.colors[k] = pick(CLOTH);
    // resolve clashes, last pick wins
    // drop any optional part that clashes with anything else
    for (const c of ['mask', 'beard', 'accessory']) if (st[c] && conflictsFor(c, st[c], st).length) st[c] = null;
    for (const c of ['body', 'hair', 'face']) { const v = valueOf(st, c); for (const [oc] of conflictsFor(c, v, st)) if (!REQUIRED.includes(oc)) st[oc] = null; }
    save(); render(); renderTab(); status('');
  });

  // ---------- downloads ----------
  function download(name, href) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  document.getElementById('dl-svg').addEventListener('click', () => {
    const blob = new Blob([fullSVG(S, false)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob); download('my-avatar.svg', url); setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  document.getElementById('dl-png').addEventListener('click', () => {
    const svg = fullSVG(S, false), img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 1024;
      c.getContext('2d').drawImage(img, 0, 0, 1024, 1024);
      try { download('my-avatar.png', c.toDataURL('image/png')); } catch (err) { status('PNG download failed. Try SVG instead.'); }
    };
    img.onerror = () => status('PNG download failed. Try SVG instead.');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg width="1024" height="1024" '));
  });

  // =====================================================================
  // Admin: step through every part, nudge positions, hide items, record clashes
  // =====================================================================
  const AD = { cat: 'hair', item: null };
  const AD_CATS = [
    ['hair', 'Hair'], ['face', 'Faces'], ['beard', 'Facial hair'], ['accessory', 'Glasses'], ['mask', 'Masks'],
    ['head', 'Head on outfit (this view)'], ['spot', 'Default patch spot (this view)'],
  ];
  function adItems() {
    if (AD.cat === 'head' || AD.cat === 'spot') return Object.keys(P[S.view]);
    return Object.keys(P[AD.cat]);
  }
  function adCurrent() {
    if (AD.cat === 'head' || AD.cat === 'spot') return curBody();
    return S[AD.cat] || AD.item || adItems()[0];
  }
  function adSel(name) {
    if (AD.cat === 'head' || AD.cat === 'spot') S.body[S.view] = name; else S[AD.cat] = name;
    AD.item = name; render(); renderTab();
  }
  const revKey = () => (AD.cat === 'head' || AD.cat === 'spot' ? AD.cat + ':' + S.view : AD.cat);
  const hiddenCat = () => (AD.cat === 'head' || AD.cat === 'spot' ? S.view : AD.cat);
  function persist() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(L)); } catch (e) {} }
  function nudge(dx, dy, ds, dr) {
    const name = adCurrent();
    if (AD.cat === 'head') {
      const h = (L.head[S.view] = L.head[S.view] || {})[name] = (L.head[S.view] || {})[name] || { x: 0, y: 0, s: 1, r: 0 };
      // scale and rotate around the neck so the head stays attached
      if (ds) { const nx = h.x + h.s * NECK[0], ny = h.y + h.s * NECK[1]; h.s = +(h.s + ds).toFixed(3); h.x = +(nx - h.s * NECK[0]).toFixed(1); h.y = +(ny - h.s * NECK[1]).toFixed(1); }
      h.x = +(h.x + dx).toFixed(1); h.y = +(h.y + dy).toFixed(1); h.r = +((h.r || 0) + (dr || 0)).toFixed(1);
    } else if (AD.cat === 'spot') {
      return;
    } else {
      const o = (L.offsets[AD.cat][name] = L.offsets[AD.cat][name] || {});
      o.x = +((o.x || 0) + dx).toFixed(1); o.y = +((o.y || 0) + dy).toFixed(1);
      if (ds) { o.sx = +((o.sx || 1) + ds).toFixed(3); o.sy = +((o.sy || 1) + ds).toFixed(3); }
    }
    persist(); render();
  }
  function adminKeys(e) {
    if (AD.cat === 'spot' && selectedPatch != null) return false; // let arrows move the patch
    const step = e.shiftKey ? 10 : 1;
    const map = { ArrowLeft: [-step, 0, 0], ArrowRight: [step, 0, 0], ArrowUp: [0, -step, 0], ArrowDown: [0, step, 0], '=': [0, 0, 0.01], '+': [0, 0, 0.01], '-': [0, 0, -0.01] };
    if (map[e.key]) { nudge(...map[e.key], 0); e.preventDefault(); return true; }
    if (e.key === ',' && AD.cat === 'head') { nudge(0, 0, 0, -1); return true; }
    if (e.key === '.' && AD.cat === 'head') { nudge(0, 0, 0, 1); return true; }
    if (e.key === ']' || e.key === '[') { step2(e.key === ']' ? 1 : -1); e.preventDefault(); return true; }
    if (e.key.toLowerCase() === 'k') { markReviewed(); step2(1); return true; }
    return false;
  }
  function step2(d) {
    const items = adItems(); const i = items.indexOf(adCurrent());
    adSel(items[(i + d + items.length) % items.length]);
  }
  function markReviewed() {
    const k = revKey(), n = adCurrent(); const arr = (L.reviewed[k] = L.reviewed[k] || []);
    if (!arr.includes(n)) arr.push(n); persist();
  }
  function renderAdmin() {
    const el = document.getElementById('admin'); el.hidden = false;
    const items = adItems(), cur = adCurrent(), idx = items.indexOf(cur);
    const rev = L.reviewed[revKey()] || [];
    const hid = (L.hidden[hiddenCat()] || []).includes(cur);
    let pos = '';
    if (AD.cat === 'head') { const h = (L.head[S.view] || {})[cur] || {}; pos = `x ${h.x} · y ${h.y} · scale ${h.s} · tilt ${h.r || 0}°`; }
    else if (AD.cat === 'spot') { const sp = (L.patchSpot[S.view] || {})[cur]; pos = sp ? `dx ${Math.round(sp.dx)} · dy ${Math.round(sp.dy)} · size ${Math.round(sp.size)}` : 'Using the default spot'; }
    else { const o = L.offsets[AD.cat][cur] || {}; pos = `x ${o.x || 0} · y ${o.y || 0} · scale ${o.sx || 1}×${o.sy || 1}`; }
    const mine = L.conflicts.map((c, i) => [c, i]).filter(([c]) => c.some((t) => matches(t, AD.cat === 'head' || AD.cat === 'spot' ? 'body' : AD.cat, cur)));
    const others = CATS.filter((c) => c !== (AD.cat === 'head' || AD.cat === 'spot' ? 'body' : AD.cat));
    el.innerHTML = `<div class="tabbody">
      <h2>Layer checker <span class="pill">${rev.length}/${items.length} checked</span></h2>
      <div class="row"><label for="ad-cat">Check</label><select id="ad-cat">${AD_CATS.map(([v, t]) => `<option value="${v}" ${v === AD.cat ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <button class="btn" id="ad-wall" data-ad="wall">Show all</button></div>
      <div class="row"><button class="btn" data-ad="prev" aria-label="Previous">←</button>
        <strong>${esc(label(cur))}</strong> <span class="pill">${idx + 1}/${items.length}</span>
        ${rev.includes(cur) ? '<span class="pill ok">checked</span>' : ''}${hid ? '<span class="pill bad">hidden</span>' : ''}
        <button class="btn" data-ad="next" aria-label="Next">→</button></div>
      <div class="hint">${pos}</div>
      ${AD.cat === 'spot' ? `<p class="hint">Add a patch, drag and size it where it should land on this outfit, then save.</p><div class="row"><button class="btn" data-ad="spot">Save selected patch as this outfit's spot</button><button class="btn" data-ad="resetspot">Use default</button></div>` : `
      <div class="row"><button class="btn" data-n="0,-1">↑</button><button class="btn" data-n="0,1">↓</button><button class="btn" data-n="-1,0">←</button><button class="btn" data-n="1,0">→</button>
        <button class="btn" data-n="0,0,0.01">Bigger</button><button class="btn" data-n="0,0,-0.01">Smaller</button>
        ${AD.cat === 'head' ? '<button class="btn" data-n="0,0,0,-1">Tilt ↺</button><button class="btn" data-n="0,0,0,1">Tilt ↻</button>' : ''}
        <button class="btn" data-ad="reset">Reset</button></div>
      <p class="hint"><span class="kbd">←↑→↓</span> nudge (Shift ×10) · <span class="kbd">+</span>/<span class="kbd">-</span> size ${AD.cat === 'head' ? '· <span class="kbd">,</span>/<span class="kbd">.</span> tilt ' : ''}· <span class="kbd">[</span>/<span class="kbd">]</span> previous/next · <span class="kbd">K</span> mark checked and go next</p>`}
      <div class="row"><button class="btn" data-ad="ok">Looks right</button><button class="btn" data-ad="hide">${hid ? 'Show to visitors' : 'Hide from visitors'}</button></div>
      <h2>Doesn't work with</h2>
      <div class="row"><select id="ad-ccat">${others.map((c) => `<option value="${c}">${c === 'body' ? 'outfit' : c}: ${esc(valueOf(S, c) ? label(valueOf(S, c)) : 'none')}</option>`).join('')}</select>
        <label style="min-width:0"><input type="checkbox" id="ad-any"> any</label>
        <button class="btn" data-ad="clash">Add clash</button></div>
      ${mine.map(([c, i]) => `<div class="conf"><span>${esc(c[0])} ↔ ${esc(c[1])}</span><button class="btn" data-unclash="${i}">Remove</button></div>`).join('') || '<p class="hint">No clashes recorded for this item.</p>'}
      <h2>Save</h2>
      <p class="hint">Changes save in this browser as you go. To publish them, download <span class="kbd">layers.js</span> and replace <span class="kbd">config/layers.js</span> in the repository.</p>
      <div class="row"><button class="btn primary" data-ad="export">Download layers.js</button><button class="btn" data-ad="import">Load a layers.js</button><button class="btn" data-ad="discard">Discard local changes</button></div>
    </div>`;
  }
  document.getElementById('admin').addEventListener('click', (e) => {
    const n = e.target.closest('[data-n]');
    if (n) { const v = n.dataset.n.split(',').map(Number); nudge(v[0] || 0, v[1] || 0, v[2] || 0, v[3] || 0); return; }
    const u = e.target.closest('[data-unclash]');
    if (u) { L.conflicts.splice(Number(u.dataset.unclash), 1); persist(); render(); return; }
    const b = e.target.closest('[data-ad]'); if (!b) return;
    const a = b.dataset.ad, cur = adCurrent();
    if (a === 'next' || a === 'prev') step2(a === 'next' ? 1 : -1);
    if (a === 'ok') { markReviewed(); step2(1); }
    if (a === 'hide') { const hc = hiddenCat(); const arr = (L.hidden[hc] = L.hidden[hc] || []); const i = arr.indexOf(cur); if (i >= 0) arr.splice(i, 1); else arr.push(cur); persist(); render(); renderTab(); }
    if (a === 'reset') {
      if (AD.cat === 'head') { const orig = ((window.PEEP_LAYERS.head || {})[S.view] || {})[cur]; if (orig) L.head[S.view][cur] = clone(orig); }
      else { const orig = (window.PEEP_LAYERS.offsets[AD.cat] || {})[cur]; if (orig) L.offsets[AD.cat][cur] = clone(orig); else delete L.offsets[AD.cat][cur]; }
      persist(); render();
    }
    if (a === 'spot') {
      if (selectedPatch == null) { status('Select a patch on the avatar first.'); return; }
      const pt = S.patches[selectedPatch]; (L.patchSpot[S.view] = L.patchSpot[S.view] || {})[cur] = { dx: Math.round(pt.dx), dy: Math.round(pt.dy), size: Math.round(pt.size) };
      markReviewed(); persist(); render();
    }
    if (a === 'resetspot') { if (L.patchSpot[S.view]) delete L.patchSpot[S.view][cur]; persist(); render(); }
    if (a === 'clash') {
      const oc = document.getElementById('ad-ccat').value, any = document.getElementById('ad-any').checked;
      const ov = valueOf(S, oc); if (!any && ov == null) { status('Pick something in that category first, or tick “any”.'); return; }
      const me = (AD.cat === 'head' || AD.cat === 'spot' ? 'body' : AD.cat) + ':' + cur;
      L.conflicts.push([me, oc + ':' + (any ? '*' : ov)]); persist(); render();
    }
    if (a === 'export') {
      const txt = '// Layer positions and combo rules. Edit with the admin mode (?admin=1), then replace this file with the export.\nwindow.PEEP_LAYERS = ' + JSON.stringify(L, null, 1) + ';\n';
      download('layers.js', URL.createObjectURL(new Blob([txt], { type: 'text/javascript' })));
    }
    if (a === 'import') {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.js,.json';
      inp.onchange = () => inp.files[0].text().then((t) => {
        try { L = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); persist(); render(); renderTab(); status('Loaded.'); } catch (err) { status('That file could not be read.'); }
      });
      inp.click();
    }
    if (a === 'discard') { if (confirm('Discard every local layer change and go back to the published file?')) { localStorage.removeItem(DRAFT_KEY); location.reload(); } }
    if (a === 'wall') openWall();
  });
  document.getElementById('admin').addEventListener('change', (e) => {
    if (e.target.id === 'ad-cat') { AD.cat = e.target.value; AD.item = null; if (!['head', 'spot'].includes(AD.cat) && !S[AD.cat]) S[AD.cat] = adItems()[0]; render(); renderTab(); }
  });
  // wall of every item in the chosen category, drawn with the current avatar
  function openWall() {
    const wall = document.getElementById('wall'), inner = document.getElementById('wall-inner');
    const items = adItems(); const rev = L.reviewed[revKey()] || [];
    let h = `<div class="row" style="justify-content:space-between"><strong>${esc(AD_CATS.find((c) => c[0] === AD.cat)[1])}: ${items.length} items</strong><button class="btn" id="wall-close">Close</button></div><p class="hint">Click one to open it in the checker.</p><div class="grid">`;
    for (const n of items) {
      const st = clone(S);
      if (AD.cat === 'head' || AD.cat === 'spot') st.body[st.view] = n; else st[AD.cat] = n;
      const hidden = (L.hidden[hiddenCat()] || []).includes(n);
      h += `<button class="opt ${hidden ? 'is-hidden' : ''}" data-wall="${n}">${fullSVG(st, false)}<span>${esc(label(n))}${rev.includes(n) ? ' ✓' : ''}${hidden ? ' (hidden)' : ''}</span></button>`;
    }
    inner.innerHTML = h + '</div>'; wall.classList.add('open');
  }
  document.getElementById('wall').addEventListener('click', (e) => {
    const w = e.target.closest('[data-wall]');
    if (w) { adSel(w.dataset.wall); }
    if (w || e.target.id === 'wall-close' || e.target.id === 'wall') document.getElementById('wall').classList.remove('open');
  });

  render(); renderTab();
  if (ADMIN) status('Layer checker is on. Visitors never see it.');
})();
