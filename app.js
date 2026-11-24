/* Open Peeps avatar maker with clothing patches and a layer checker.
   Art: Open Peeps by Pablo Stanley (CC0). Parts converted from @opeepsfun/open-peeps and @dicebear/open-peeps. */
(function () {
  'use strict';
  const P = window.PEEP_PARTS;
  const ADMIN = new URLSearchParams(location.search).has('admin');
  const DRAFT_KEY = 'peeps-layers-draft-v1';
  const STATE_KEY = 'peeps-avatar-v1';
  const NS = 'http://www.w3.org/2000/svg';

  // ---------- embed-address options ----------
  // ?accent=1f4e9c  ?bg=e3ebf8  ?patches=https://example.edu/patches.json
  const Q = new URLSearchParams(location.search);
  const hex = (v) => (v && /^#?[0-9a-f]{6}$/i.test(v) ? '#' + v.replace('#', '') : null);
  const ACCENT = hex(Q.get('accent'));
  if (ACCENT) {
    const r = document.documentElement.style;
    r.setProperty('--accent', ACCENT);
    r.setProperty('--accent-soft', `color-mix(in srgb, ${ACCENT} 14%, white)`);
  }
  const BG_PARAM = hex(Q.get('bg'));

  // ---------- layer config (admin drafts override the published file) ----------
  const clone = (o) => JSON.parse(JSON.stringify(o));
  let L = clone(window.PEEP_LAYERS);
  if (ADMIN) { try { const d = localStorage.getItem(DRAFT_KEY); if (d) L = JSON.parse(d); } catch (e) {} }
  L.offsets = L.offsets || {}; L.head = L.head || {}; L.patchSpot = L.patchSpot || {};
  // an older admin draft may lack the measured hair shapes: use the published ones
  if (!L.hairGeometry) L.hairGeometry = clone(window.PEEP_LAYERS.hairGeometry || {});
  L.hidden = L.hidden || {}; L.conflicts = L.conflicts || []; L.reviewed = L.reviewed || {};
  for (const c of ['hair', 'face', 'beard', 'accessory', 'mask']) L.offsets[c] = L.offsets[c] || {};
  const A = L.anchors;
  const NECK = A.neck;

  // ---------- colors ----------
  // palettes: [color, name]
  const SKIN = [['#FFE0BD', 'Light'], ['#F6C9A0', 'Fair'], ['#E8B080', 'Medium'], ['#C68642', 'Tan'], ['#A56B43', 'Brown'], ['#7A4E2D', 'Deep'], ['#5C3A21', 'Dark'], ['#3F2A1B', 'Ebony']];
  const HAIRC = [['#1A1A1A', 'Black'], ['#3B2219', 'Dark brown'], ['#5A3825', 'Brown'], ['#8B5A2B', 'Chestnut'], ['#B87333', 'Auburn'], ['#D9A441', 'Blonde'],
    ['#9AA0A6', 'Grey'], ['#C9CDD2', 'Silver'], ['#E6E6E6', 'White'], ['#E67EA6', 'Pink'], ['#6C8EE0', 'Blue'], ['#57B894', 'Green'], ['#8E6FD1', 'Purple']];
  const CLOTH = [['#7FA7D9', 'Blue'], ['#5B7FB4', 'Navy'], ['#1F4E9C', 'Royal'], ['#57B894', 'Green'], ['#E4915B', 'Orange'], ['#E06C7A', 'Red'], ['#E67EA6', 'Pink'],
    ['#8E6FD1', 'Purple'], ['#F2C94C', 'Yellow'], ['#6B7280', 'Slate'], ['#3A3A3A', 'Charcoal'], ['#222222', 'Black'], ['#F5F5F5', 'White'], ['#C68642', 'Tan']];
  const BG = [['#F2E9D8', 'Cream'], ['#FBE3D6', 'Blush'], ['#DCEFE4', 'Mint'], ['#D7ECF0', 'Sky'], ['#E9E1F4', 'Lilac'], ['#FBEFC7', 'Butter'], ['#FFFFFF', 'White'], ['transparent', 'Transparent']];
  const BACKDROP_C = [['#F7C948', 'Sun'], ['#F58A7A', 'Coral'], ['#8ECAE6', 'Sky'], ['#A3D9A5', 'Sage'], ['#C3A6E0', 'Lilac'], ['#F4A9C7', 'Rose'],
    ['#FBD38D', 'Peach'], ['#7FB2E5', 'Blue'], ['#E7A977', 'Clay'], ['#B8B8D1', 'Slate'], ['#5C6B73', 'Steel'], ['#2E2E38', 'Ink']];
  const SHAPES = [['', 'None'], ['circle', 'Circle'], ['squircle', 'Rounded square'], ['arch', 'Arch'], ['blob', 'Blob']];
  const PNG_SIZES = [[512, 'Small'], [1024, 'Medium'], [2048, 'Large']];
  let pngMax = 1024;
  // which visitor color each part token uses
  const TOKEN = {
    skinColor: 'skin', hairColor: 'hair', beardColor: 'hair', topColor: 'top', pantsColor: 'pants',
    jacketColor: 'jacket', blazerColor: 'jacket', coatColor: 'jacket', shoesColor: 'shoes',
    capColor: 'hat', beanieColor: 'hat', turbanColor: 'hat', hijabColor: 'hat', clipColor: 'hat',
    frameColor: 'accent', cupColor: 'accent', paperColor: 'accent', computerColor: 'accent', knifeColor: 'accent',
    pocketColor: 'accent', wheelchairColor: 'accent', bikeFrameColor: 'accent', bikeIronColor: 'accent', prothesisColor: 'accent',
  };
  const COLOR_LABEL = { skin: 'Skin', hair: 'Hair color', top: 'Top', pants: 'Pants', jacket: 'Jacket', shoes: 'Shoes', hat: 'Headwear', accent: 'Props', bg: 'Background', backdrop: 'Shape color', second: 'Second color', hair2: 'Second hair color', hair3: 'Third hair color' };
  const PALETTE = { skin: SKIN, hair: HAIRC, top: CLOTH, pants: CLOTH, jacket: CLOTH, shoes: CLOTH, hat: CLOTH, accent: CLOTH, second: CLOTH, hair2: HAIRC, hair3: HAIRC, bg: BG, backdrop: BACKDROP_C };

  // ---------- state ----------
  const DEFAULT = {
    view: 'bust',
    body: { bust: 'Hoodie', standing: 'ShirtColorTee', sitting: 'MidColorTee' },
    hair: 'ShortOne', face: 'Smile', beard: null, accessory: null, mask: null, backdrop: 'circle',
    colors: { skin: '#E8B080', hair: '#1A1A1A', top: '#7FA7D9', pants: '#3A3A3A', jacket: '#5B7FB4', shoes: '#F5F5F5', hat: '#7FA7D9', accent: '#F2C94C', bg: '#DCEFE4', backdrop: '#F7C948', second: '#1A1A1A', hair2: '#C9CDD2', hair3: '#E67EA6' },
    hairMix: { style: null, pos: 0.42 }, hairMix3: { style: null, pos: 0.7 },
    patches: [],
  };
  let S = clone(DEFAULT);
  if (BG_PARAM) DEFAULT.colors.bg = BG_PARAM;
  if (ACCENT) DEFAULT.colors.top = ACCENT;
  S = clone(DEFAULT);
  try { const s = JSON.parse(localStorage.getItem(STATE_KEY)); if (s && s.body) { S = Object.assign(clone(DEFAULT), s); S.colors = Object.assign(clone(DEFAULT.colors), s.colors || {}); } } catch (e) {}
  // each avatar has an id and a last-changed time, so an old shortcut never undoes newer changes
  const newId = () => Math.random().toString(36).slice(2, 10);
  if (!S.id) S.id = newId();
  const save = () => { S.t = Date.now(); try { localStorage.setItem(STATE_KEY, JSON.stringify(S)); } catch (e) {} };
  let selectedPatch = null;

  // ---------- patches library ----------
  const IMG_TYPES = /^image\/(svg\+xml|png|jpeg|webp|gif)$/;
  const toDataURL = (blob) => new Promise((res, rej) => {
    if (!IMG_TYPES.test(blob.type)) return rej(new Error('not an image'));
    const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob);
  });
  let PATCHES = [];
  function addPatches(defs, base) {
    PATCHES = defs.filter((p) => p && p.id && (p.svg || p.src)).map((p) => {
      const src = p.src ? new URL(p.src, base).href : null;
      // tilt: false keeps a patch upright, for marks whose rules forbid angling them
      return { id: String(p.id), name: String(p.name || p.id), svg: p.svg, src, w: 120, h: 120, noTilt: p.tilt === false,
        href: p.svg ? 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(p.svg))) : src };
    });
    PATCHES.forEach((p) => {
      // read the aspect ratio
      const img = new Image();
      img.onload = () => { p.w = img.naturalWidth || 120; p.h = img.naturalHeight || 120; render(); if (tab === 'patches') renderTab(); };
      img.src = p.href;
      // inline file-based patches so downloads keep them (needs the host to allow cross-site requests)
      if (!p.svg && p.src) fetch(p.src).then((r) => r.blob()).then(toDataURL).then((url) => { p.href = url; render(); }).catch(() => { p.noInline = true; });
    });
  }
  const remote = Q.get('patches');
  const devHost = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (remote && (/^https:\/\//i.test(remote) || (devHost && /^http:\/\/(localhost|127\.0\.0\.1)[:/]/i.test(remote)))) {
    fetch(remote).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((j) => {
        const defs = (Array.isArray(j) ? j : j.patches || []).map((p) => ({ id: p.id, name: p.name, src: p.src, tilt: p.tilt })); // remote lists may only point to files
        addPatches(defs, remote); render(); renderTab();
      })
      .catch(() => { addPatches(window.PEEP_PATCHES || [], location.href); status('Couldn’t load this site’s patches, so the standard ones are shown.'); renderTab(); });
  } else {
    addPatches(window.PEEP_PATCHES || [], location.href);
  }
  const patchById = (id) => PATCHES.find((p) => p.id === id);

  // ---------- helpers ----------
  const visible = (cat, name) => !(L.hidden[cat] || []).includes(name);
  const list = (cat, includeHidden) => Object.keys(P[cat]).filter((n) => includeHidden || visible(cat, n));
  const bodyCat = () => S.view;
  const curBody = () => S.body[S.view];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const label = (n) => (P.mask[n] ? P.mask[n].name : n.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2'));

  let TAGGING = false; // while drawing the main picture, label each colored area for click-to-edit
  function paint(svg, colors) {
    const color = (t) => (t === 'outlineColor' ? '#000' : colors[TOKEN[t]] || '#9AA5B1');
    if (TAGGING) svg = svg.replace(/(fill|stroke)="\{\{(\w+)\}\}"/g, (m, a, t) => `${a}="${color(t)}" data-c="${t === 'outlineColor' ? 'ink' : TOKEN[t] || 'accent'}"`);
    return svg.replace(/\{\{(\w+)\}\}/g, (m, t) => color(t));
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

  // Hair with a built-in mask or face shield (the Doc styles) is drawn under the face,
  // so those styles get the eyes-only "With Mask" faces made for them.
  const MASKED_FACES = L.maskedFaces || [];
  const isMaskedHair = (h) => (L.maskedHair || []).includes(h) && MASKED_FACES.length > 0;
  function faceOf(st) {
    if (!isMaskedHair(st.hair)) return st.face;
    if (MASKED_FACES.includes(st.face)) return st.face;
    return MASKED_FACES.includes(st.maskedFace) ? st.maskedFace : MASKED_FACES[0];
  }

  // Hair color. Most hair and beards are drawn as one black ink shape, so color is added
  // with a copy of that shape shrunk inward: thick areas take the color, while the edges and
  // thin strands stay as ink lines. Parts with their own hair color, and hats, are left alone.
  const TINT_SKIP = L.tintSkip || ['HatHip', 'Hijab', 'Turban', 'DocOne', 'DocTwo', 'DocThree'];
  const tintable = (cat, name) => (cat === 'hair' || cat === 'beard') && P[cat][name] &&
    !P[cat][name].colors.some((t) => t === 'hairColor' || t === 'beardColor') && !TINT_SKIP.includes(name);
  const TINT_FILTER = '<filter id="peeps-tint" x="-5%" y="-5%" width="110%" height="110%"><feMorphology operator="erode" radius="11"/><feMorphology operator="dilate" radius="5"/></filter>';
  // Mask of where the finished drawing is black: ink in white, every other fill in black, drawn
  // in order, so a face or mouth drawn over the ink stays clear. The filter shrinks it inward.
  function inkMask(svg) {
    return svg.replace(/(fill|stroke)="([^"]*)"/g, (m, a, v) => (a === 'fill' ? (v === '{{outlineColor}}' ? 'fill="#fff"' : v === 'none' ? m : 'fill="#000"') : `${a}="none"`));
  }
  // Strand gaps: in some hairstyles the strands are gaps in the ink where the skin underneath
  // shows through. They were white paper in the original art, so they get a highlight: white on
  // black hair, a lighter shade on colored hair. Only gaps inside the solid hair mass count.
  const HAIR_GAPS = L.hairGaps || [];
  const GAP_FILTER = '<filter id="peeps-gaps" x="-5%" y="-5%" width="110%" height="110%"><feMorphology in="SourceGraphic" operator="erode" radius="10" result="e"/><feMorphology in="e" operator="dilate" radius="10" result="o"/><feMorphology in="o" operator="dilate" radius="9" result="d"/><feMorphology in="d" operator="erode" radius="9" result="c"/><feComposite in="c" in2="SourceGraphic" operator="out"/></filter>';
  function shine(hex) {
    if (isInk(hex)) return '#FFFFFF';
    const n = parseInt(hex.slice(1), 16), mix = (v) => Math.round(v + (255 - v) * 0.55);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => mix(v).toString(16).padStart(2, '0')).join('');
  }
  function gapLayer(name, part, color) {
    const [vx, vy, vw, vh] = part.viewBox.split(' ').map(Number);
    const ink = part.svg.replace(/(fill|stroke)="([^"]*)"/g, (m, a, v) => (a === 'fill' && v === '{{outlineColor}}' ? 'fill="#fff"' : `${a}="none"`));
    const x = vx - 60, y = vy - 60, w = vw + 120, h = vh + 120;
    return `<defs>${GAP_FILTER}<mask id="pg-${name}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><g filter="url(#peeps-gaps)">${ink}</g></mask></defs>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" mask="url(#pg-${name})" pointer-events="none"/>`;
  }
  // Two hair colors: the main color, plus a second color laid on in a pattern (a streak,
  // highlights, ombre...), both seen through the same mask of the hair.
  const HAIR_PATTERNS = [['', 'None'], ['frame', 'Face-framing'], ['streak', 'Streak'], ['two', 'Two streaks'], ['highlights', 'Highlights'], ['ombre', 'Ombré'], ['tips', 'Tips'], ['split', 'Split']];
  const PATTERN_HAS_POS = ['streak', 'two', 'highlights', 'split'];
  // where the slider starts for each pattern: for split, 0.5 is the part; for streaks and
  // highlights, how far back from the face the locks sit
  const PATTERN_POS = { streak: 0.2, two: 0.15, highlights: 0.2, split: 0.5 };
  const HAIR_GEOM = L.hairGeometry || {};
  // the two extra hair-color slots: [state key, color key, label]
  const HAIR_SLOTS = [['hairMix', 'hair2', 'Second color'], ['hairMix3', 'hair3', 'Third color']];
  function hairColorLayers(name, part, st) {
    const c = st.colors, own = part.colors.includes('hairColor');
    if (!own && !tintable('hair', name)) return '';
    const [vx, vy, vw, vh] = part.viewBox.split(' ').map(Number);
    const X = vx - 60, Y = vy - 60, W = vw + 120, H = vh + 120, id = `pm-hair-${name}`, n = (v) => v.toFixed(1);
    // styles with their own hair-color areas use those; ink-drawn styles use the shrunk ink
    const maskBody = own
      ? part.svg.replace(/(fill|stroke)="([^"]*)"/g, (m, a, v) => (a === 'fill' ? (v === '{{hairColor}}' ? 'fill="#fff"' : v === 'none' ? m : 'fill="#000"') : `${a}="none"`))
      : `<g filter="url(#peeps-tint)">${inkMask(part.svg)}</g>`;
    let defs = `${own ? '' : TINT_FILTER}<mask id="${id}" maskUnits="userSpaceOnUse" x="${X}" y="${Y}" width="${W}" height="${H}">${maskBody}</mask>`;
    const m = `mask="url(#${id})" pointer-events="none"`;
    let out = !own && !isInk(c.hair) ? `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="${c.hair}" ${m}/>` : '';

    // where the hair really is (measured by tools/measure-hair.mjs); the drawing's frame is a fallback
    const g = HAIR_GEOM[name] || { x0: vx, y0: vy, x1: vx + vw, y1: vy + vh, part: vx + vw * 0.5, face: vy + vh * 0.35 };
    const gw = g.x1 - g.x0, lo = g.x0 + gw * 0.08, hi = g.x1 - gw * 0.08;
    // patterns stop just under the hair, so thick ink at the chin or neck isn't colored
    const bottom = g.y1 + 8;
    // split position: 0.5 is the part, lower values toward the back of the head, higher toward the face
    const across = (p) => (p <= 0.5 ? lo + (g.part - lo) * Math.max(0, p) / 0.5 : g.part + (hi - g.part) * (Math.min(1, p) - 0.5) / 0.5);
    // the visible skin, for patterns that follow the face
    const skinMask = part.svg.replace(/(fill|stroke)="([^"]*)"/g, (mm, a, v) => (a === 'fill' ? (v === '{{skinColor}}' ? 'fill="#fff"' : v === 'none' ? mm : 'fill="#000"') : `${a}="none"`));
    // copies shifted downward carry a face-shaped band on down long hair below the jaw
    const dropStep = Math.round(vh * 0.07);
    const dropCopies = (src, res) => [1, 2, 3, 4].map((k) => `<feOffset in="${src}" dy="${dropStep * k}" result="${src}d${k}"/>`).join('') +
      `<feMerge result="${res}"><feMergeNode in="${src}"/>${[1, 2, 3, 4].map((k) => `<feMergeNode in="${src}d${k}"/>`).join('')}</feMerge>`;
    for (const [key, colorKey] of HAIR_SLOTS) {
      const mix = st[key] || {}, col = c[colorKey];
      if (!mix.style || !col) continue;
      const pos = mix.pos == null ? (PATTERN_POS[mix.style] || 0.5) : mix.pos;
      // Locks of hair that follow the face, as Face-framing does: grow the visible skin outward to
      // two distances and keep the band between them. The outer growth is nudged along (dx, dy), so
      // the band is a crescent, thin where it starts and wider where it falls. The face is first
      // stretched down with shifted copies, so the locks carry on down long hair. Seen through the hair mask, a lock follows each style's shape.
      // Each lock: [distance from the face, width, nudge x, nudge y], as fractions of the hair's depth
      // above the forehead; side keeps one side of the part.
      const locks = (list, side, tag) => {
        const T = Math.max(60, g.face - g.y0), lid = `pl-${key}-${name}-${tag}`;
        const grow = (r, res) => `<feGaussianBlur in="sD" stdDeviation="${(Math.max(4, r) / 2.2).toFixed(1)}" result="${res}b"/><feComponentTransfer in="${res}b" result="${res}"><feFuncA type="discrete" tableValues="0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1"/></feComponentTransfer>`;
        let f = `<filter id="${lid}-f" filterUnits="userSpaceOnUse" x="${X}" y="${Y}" width="${W}" height="${H}"><feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="s"/>${dropCopies('s', 'sD')}`;
        const bands = list.map(([r, w, dx, dy], i) => {
          const R = r * T, Wd = w * T, sx = side === 'left' ? -1 : 1; // taper away from the part
          f += grow(R, `i${i}`) + grow(R + Wd, `o${i}`) + `<feOffset in="o${i}" dx="${n(sx * dx * Wd)}" dy="${n(dy * Wd)}" result="p${i}"/>` +
            `<feComposite in="p${i}" in2="i${i}" operator="out" result="b${i}"/>`;
          return `<feMergeNode in="b${i}"/>`;
        }).join('');
        f += `<feMerge result="all">${bands}</feMerge><feFlood flood-color="#fff"/><feComposite in2="all" operator="in"/><feGaussianBlur stdDeviation="2"/></filter>`;
        defs += f + `<mask id="${lid}" maskUnits="userSpaceOnUse" x="${X}" y="${Y}" width="${W}" height="${H}"><g filter="url(#${lid}-f)">${skinMask}</g></mask>`;
        // the side cut runs from the part, slanting back a little as it goes down
        const top = g.part, bot = g.part - gw * 0.12;
        const shape = side === 'both' ? `<rect x="${X}" y="${Y}" width="${W}" height="${H}"`
          : side === 'left' ? `<polygon points="${X},${Y} ${n(top)},${Y} ${n(bot)},${Y + H} ${X},${Y + H}"`
          : `<polygon points="${n(top)},${Y} ${X + W},${Y} ${X + W},${Y + H} ${n(bot)},${Y + H}"`;
        return `<g ${m}>${shape} fill="${col}" mask="url(#${lid})"/></g>`;
      };
      const side = mix.side || 'left', d = Math.round(pos * 100);
      // both sides: a mirrored lock on each side of the part
      const sided = (list, tag) => (side === 'both' ? locks(list, 'left', tag + 'l') + locks(list, 'right', tag + 'r') : locks(list, side, tag + side));
      // position: how far back from the face the lock sits
      if (mix.style === 'streak') out += sided([[0.2 + pos * 0.8, 0.3, 0.45, 0.5]], `s${d}`);
      if (mix.style === 'two') out += sided([[0.18 + pos * 0.7, 0.24, 0.45, 0.5], [0.62 + pos * 0.7, 0.16, 0.45, 0.5]], `t${d}`);
      // thin locks at several depths, all around the face, tapering in turn one way and the other
      if (mix.style === 'highlights') out += locks([[0.08 + pos * 0.3, 0.12, 0.6, 0.6], [0.35 + pos * 0.3, 0.1, -0.6, 0.6], [0.62 + pos * 0.3, 0.12, 0.5, 0.7], [0.9 + pos * 0.3, 0.1, -0.5, 0.7]], 'both', `h${d}`);
      if (mix.style === 'split') out += `<rect x="${X}" y="${Y}" width="${n(across(pos) - X)}" height="${n(bottom - Y)}" fill="${col}" ${m}/>`;
      if (mix.style === 'ombre') {
        // fades in from a third of the way down the hair to fully colored near its ends
        const gid = `pgr-${key}-${name}-${c.hair.slice(1)}-${col.slice(1)}`, top = g.y0 + (g.y1 - g.y0) * 0.3, bot = g.y0 + (g.y1 - g.y0) * 0.9;
        defs += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${n(top)}" x2="0" y2="${n(bot)}"><stop offset="0" stop-color="${col}" stop-opacity="0"/><stop offset="1" stop-color="${col}"/></linearGradient>`;
        out += `<rect x="${X}" y="${Y}" width="${W}" height="${n(bottom - Y)}" fill="url(#${gid})" ${m}/>`;
      }
      if (mix.style === 'tips') {
        // the ends of the hair: the part of the hair within reach of its edge, found by comparing
        // the hair with a copy of itself shifted along. Long hair gets its lower ends colored;
        // short hair gets frosted tips on top. Small gaps between strands are closed first.
        const down = g.tips ? g.tips === 'down' : g.y1 - g.face > 240;
        const d = Math.round(down ? Math.min(150, Math.max(45, (g.y1 - g.face) * 0.3)) : Math.min(70, Math.max(35, (g.face - g.y0) * 0.4)));
        const tid = `pt-${key}-${name}-${down ? 'd' : 'u'}${d}`;
        defs += `<filter id="${tid}-f" filterUnits="userSpaceOnUse" x="${X}" y="${Y}" width="${W}" height="${H}"><feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="s"/>` +
          `<feComponentTransfer in="s" result="b"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer>` +
          `<feMorphology in="b" operator="dilate" radius="10" result="d1"/><feMorphology in="d1" operator="erode" radius="10" result="cl"/>` +
          `<feOffset in="cl" dy="${down ? -d : d}" result="sh"/><feComposite in="cl" in2="sh" operator="out" result="t"/>` +
          `<feFlood flood-color="#fff"/><feComposite in2="t" operator="in"/><feGaussianBlur stdDeviation="1.5"/></filter>` +
          `<mask id="${tid}" maskUnits="userSpaceOnUse" x="${X}" y="${Y}" width="${W}" height="${H}"><g filter="url(#${tid}-f)">${maskBody}</g></mask>`;
        // keep long-hair tips below the forehead, so bangs and the hairline stay the main color, and
        // leave out hair that ends on skin (at the temples, over the ears): only loose ends count
        const ty = down ? g.face + 40 : Y, th = down ? bottom - ty : g.face + 20 - Y;
        const skinOnly = part.svg.replace(/(fill|stroke)="([^"]*)"/g, (mm, a, v) => (a === 'fill' && v === '{{skinColor}}' ? 'fill="#000"' : `${a}="none"`));
        if (down) defs += `<mask id="${tid}-s" maskUnits="userSpaceOnUse" x="${X}" y="${Y}" width="${W}" height="${H}"><rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="#fff"/><g transform="translate(0 ${-d})">${skinOnly}</g></mask>`;
        const rect = `<rect x="${X}" y="${n(ty)}" width="${W}" height="${n(th)}" fill="${col}" mask="url(#${tid})"/>`;
        out += `<g ${m}>${down ? `<g mask="url(#${tid}-s)">${rect}</g>` : rect}</g>`;
      }
      if (mix.style === 'frame') {
        // A band of hair along the hairline: grow the visible skin outward, keep only the ring
        // just outside it, and see it through the hair mask, so it follows each style's shape.
        const thick = Math.round(40 + (mix.width == null ? 0.5 : mix.width) * 110), rid = `pr-${key}-${name}-${thick}`;
        // copies shifted downward carry the band on down long hair below the jaw
        const step = Math.round(vh * 0.07), drop = (src, out2) => `<feOffset in="${src}" dy="${step}" result="${src}1"/><feOffset in="${src}" dy="${step * 2}" result="${src}2"/><feOffset in="${src}" dy="${step * 3}" result="${src}3"/><feOffset in="${src}" dy="${step * 4}" result="${src}4"/>` +
          `<feMerge result="${out2}"><feMergeNode in="${src}"/><feMergeNode in="${src}1"/><feMergeNode in="${src}2"/><feMergeNode in="${src}3"/><feMergeNode in="${src}4"/></feMerge>`;
        const skin = part.svg.replace(/(fill|stroke)="([^"]*)"/g, (mm, a, v) => (a === 'fill' ? (v === '{{skinColor}}' ? 'fill="#fff"' : v === 'none' ? mm : 'fill="#000"') : `${a}="none"`));
        defs += `<filter id="${rid}-f" x="-20%" y="-20%" width="140%" height="180%"><feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="s"/>` +
                    // blur-then-threshold grows the shape with round corners (morphology would make square ones)
          `<feGaussianBlur in="s" stdDeviation="${(thick / 2.2).toFixed(1)}" result="sb"/><feComponentTransfer in="sb" result="a"><feFuncA type="discrete" tableValues="0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1"/></feComponentTransfer>` +
                    // the face shape with small gaps (inside the ear) closed, so the band has no holes
          `<feGaussianBlur in="s" stdDeviation="6" result="sb2"/><feComponentTransfer in="sb2" result="b"><feFuncA type="discrete" tableValues="0 1 1 1 1 1 1 1"/></feComponentTransfer>` +
          drop('a', 'A') + drop('b', 'B') +
          `<feComposite in="A" in2="B" operator="out" result="ring"/><feFlood flood-color="#fff"/><feComposite in2="ring" operator="in"/></filter>` +
          `<mask id="${rid}" maskUnits="userSpaceOnUse" x="${X}" y="${Y}" width="${W}" height="${H}"><g filter="url(#${rid}-f)">${skin}</g></mask>`;
        // one side is cut along a slanted line from the part, so the color starts at the part
        const side = mix.side || 'left', top = vx + vw * 0.56, bot = vx + vw * 0.4;
        const shape = side === 'both' ? `<rect x="${X}" y="${Y}" width="${W}" height="${H}"`
          : side === 'left' ? `<polygon points="${X},${Y} ${n(top)},${Y} ${n(bot)},${Y + H} ${X},${Y + H}"`
          : `<polygon points="${n(top)},${Y} ${X + W},${Y} ${X + W},${Y + H} ${n(bot)},${Y + H}"`;
        out += `<g ${m}>${shape} fill="${col}" mask="url(#${rid})"/></g>`;
      }
    }
    return out ? `<defs>${defs}</defs>${out}` : '';
  }
  // a color layer over the thick black areas of one part; minY/maxY (0-1) limit it to a band,
  // eg pants only, so shoes and shirt shading keep their ink
  function tintLayer(id, part, color, maxY, minY, key, minX, maxX) {
    const [vx, vy, vw, vh] = (part.viewBox || `0 0 ${part.w} ${part.h}`).split(' ').map(Number);
    // minX/maxX are in the part's own units, for trimming specks at a garment's edge
    const x = minX != null ? minX : vx - 60, w = (maxX != null ? maxX : vx + vw + 60) - x;
    const y = minY ? vy + vh * minY : vy - 60, h = (maxY ? vy + vh * maxY : vy + vh + 60) - y;
    return `<defs>${TINT_FILTER}<mask id="pm-${id}" maskUnits="userSpaceOnUse" x="${vx - 60}" y="${vy - 60}" width="${vw + 120}" height="${vh + 120}"><g filter="url(#peeps-tint)">${inkMask(part.svg)}</g></mask></defs>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" mask="url(#pm-${id})" pointer-events="none"/>`;
  }
  // dark lenses and the size of their glare gap (grow-then-shrink radius)
  const GLARE = L.glare || { Sunglasses: 7, SunglassesTwo: 16 };
  const GLARE_COLOR = '#DCE9F2';
  // closing (grow, then shrink) fills the small glare gaps without growing the frame
  const glareDefs = (r) => `<defs><filter id="peeps-close-${r}" x="-5%" y="-5%" width="110%" height="110%"><feMorphology operator="dilate" radius="${r}"/><feMorphology operator="erode" radius="${r}"/></filter></defs>`;
  // near-black hair needs no tint layer: the ink already shows
  const isInk = (hex) => { const n = parseInt(String(hex).slice(1), 16); return ((n >> 16) + ((n >> 8) & 255) + (n & 255)) < 90; };
  function tintCopy(svg, color) {
    return svg.replace(/(fill|stroke)="([^"]*)"/g, (m, a, v) => (a === 'fill' && v === '{{outlineColor}}' ? `fill="${color}"` : `${a}="none"`));
  }

  function headSVG(st) {
    const c = st.colors; let out = '';
    const g = (cat, name) => {
      if (!name || !P[cat][name]) return '';
      const svg = P[cat][name].svg;
      let tint = '';
      if (cat === 'hair') tint = hairColorLayers(name, P.hair[name], st);
      else if (tintable(cat, name) && !isInk(c.hair)) tint = tintLayer(`${cat}-${name}`, P[cat][name], c.hair, 0, 0, 'hair');
      if (cat === 'hair' && HAIR_GAPS.includes(name)) tint += gapLayer(name, P[cat][name], shine(c.hair));
      // dark lenses: their glare is a gap in the ink, so lay a light glare color underneath
      const glare = cat === 'accessory' && GLARE[name] ? `${glareDefs(GLARE[name])}<g filter="url(#peeps-close-${GLARE[name]})">${tintCopy(svg, GLARE_COLOR)}</g>` : '';
      return `<g data-layer="${cat}" transform="translate(${A[cat][0]} ${A[cat][1]})"><g transform="${offT(cat, name)}">${glare}${paint(svg, c)}${tint}</g></g>`;
    };
    out += g('hair', st.hair); out += g('face', faceOf(st)); out += g('beard', st.beard); out += g('mask', st.mask); out += g('accessory', st.accessory);
    return out;
  }
  function patchesSVG(st, withSel) {
    const [nx, ny, s] = neckPoint(st.view, st.body[st.view]);
    return st.patches.map((pt, i) => {
      const p = patchById(pt.pid); if (!p) return '';
      const w = pt.size * s, h = w * (p.h / p.w);
      const x = nx + pt.dx * s, y = ny + pt.dy * s;
      const r = HANDLE_R, gap = r * 0.6, rot = p.noTilt ? 0 : pt.rot || 0;
      const sel = withSel && i === selectedPatch ? `<rect class="sel-box" x="${-w / 2 - gap}" y="${-h / 2 - gap}" width="${w + gap * 2}" height="${h + gap * 2}"/>` +
        (p.noTilt ? '' : `<line class="sel-line" x1="0" y1="${-h / 2 - gap}" x2="0" y2="${-h / 2 - gap - r * 2.2}"/>` +
        `<circle class="handle" data-handle="rotate" cx="0" cy="${-h / 2 - gap - r * 2.2}" r="${r}"><title>Drag to tilt</title></circle>`) +
        `<circle class="handle" data-handle="resize" cx="${w / 2 + gap}" cy="${h / 2 + gap}" r="${r}"><title>Drag to resize</title></circle>` : '';
      return `<g class="patch" data-i="${i}" transform="translate(${x} ${y}) rotate(${rot})"><image href="${p.href}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}"/>${sel}</g>`;
    }).join('');
  }
  // what each outfit's colors are called, and which color its black garment takes
  const garment = (view, body) => ((L.garments || {})[view] || {})[body] || {};
  function figureSVG(st, withSel) {
    const view = st.view, body = st.body[view], part = P[view][body];
    const { str } = headT(view, body);
    const g = garment(view, body), inkColor = g.ink ? st.colors[g.ink.key] : null;
    const tint = inkColor && !isInk(inkColor) ? tintLayer(`${view}-${body}`, part, inkColor, g.ink.maxY, g.ink.minY, g.ink.key, g.ink.minX, g.ink.maxX) : '';
    return `<g data-layer="body">${paint(part.svg, st.colors)}${tint}</g><g data-layer="patches">${patchesSVG(st, withSel)}</g><g data-layer="head" transform="${str}">${headSVG(st)}</g>`;
  }

  // measure bounds with a hidden svg
  const meas = document.createElementNS(NS, 'svg');
  meas.setAttribute('style', 'position:absolute;left:-9999px;top:0;width:10px;height:10px;opacity:0;pointer-events:none');
  meas.setAttribute('aria-hidden', 'true');
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
    const bg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${st.colors.bg === 'transparent' ? 'none' : st.colors.bg}" pointer-events="all"/>`;
    HANDLE_R = w * 0.018;
    const back = `<g data-layer="backdrop">${bg}${backdropSVG(st.backdrop, st.colors.backdrop, x, y, w)}</g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${esc(describe(st))}">${back}${withSel ? figureSVG(st, true) : inner}</svg>`;
  }
  // an optional colored shape behind the figure, sized from the square frame
  function backdropSVG(shape, color, x, y, side) {
    if (!shape || !color) return '';
    const cx = x + side / 2, cy = y + side / 2, f = `fill="${color}"`, n = (v) => v.toFixed(1);
    if (shape === 'circle') return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(side * 0.43)}" ${f}/>`;
    if (shape === 'squircle') { const s = side * 0.84, r = side * 0.2; return `<rect x="${n(cx - s / 2)}" y="${n(cy - s / 2)}" width="${n(s)}" height="${n(s)}" rx="${n(r)}" ${f}/>`; }
    if (shape === 'arch') {
      const hw = side * 0.36, top = cy - side * 0.06, bot = y + side + 1;
      return `<path ${f} d="M${n(cx - hw)},${n(bot)} L${n(cx - hw)},${n(top)} A${n(hw)},${n(hw)} 0 0 1 ${n(cx + hw)},${n(top)} L${n(cx + hw)},${n(bot)} Z"/>`;
    }
    if (shape === 'blob') {
      return `<path transform="translate(${n(cx)} ${n(cy)}) scale(${n(side * 0.43)})" ${f} d="M0.9,-0.42 C1.12,0.08 0.72,0.72 0.12,0.92 C-0.5,1.12 -1.02,0.6 -1.0,0.02 C-0.98,-0.6 -0.6,-1.12 0.0,-1.02 C0.42,-0.95 0.72,-0.82 0.9,-0.42 Z"/>`;
    }
    return '';
  }
  function describe(st) {
    const bits = [label(st.body[st.view]) + ' outfit', label(st.hair) + ' hair', label(faceOf(st)) + ' face'];
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
    if (cat === 'body') S.body[S.view] = name;
    else if (cat === 'face' && isMaskedHair(S.hair) && MASKED_FACES.includes(name)) S.maskedFace = name; // keeps the usual face for later
    else S[cat] = name;
    status(clash.length ? 'Removed ' + clash.map(([c, n]) => label(n)).join(', ') + ': it doesn’t fit with ' + label(name) + '.' : '');
    save(); render(); renderTab();
  }

  // ---------- stage ----------
  const stage = document.getElementById('stage');
  let HANDLE_R = 20;
  function render() {
    TAGGING = true;
    try { stage.innerHTML = fullSVG(S, true); } finally { TAGGING = false; }
    renderContext();
    updateFavicon();
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
  // where a patch's center sits in picture coordinates
  function patchCenter(pt) { const [nx, ny, s] = neckPoint(S.view, curBody()); return [nx + pt.dx * s, ny + pt.dy * s, s]; }
  stage.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('[data-handle]');
    const g = e.target.closest('.patch');
    if (handle && selectedPatch != null) {
      const pt = S.patches[selectedPatch], p = svgPoint(e), [cx, cy] = patchCenter(pt);
      drag = { kind: handle.dataset.handle, i: selectedPatch, cx, cy, d0: Math.hypot(p.x - cx, p.y - cy) || 1, size0: pt.size };
    } else if (g) {
      const i = Number(g.dataset.i); selectedPatch = i;
      const p = svgPoint(e), pt = S.patches[i], s = neckPoint(S.view, curBody())[2];
      drag = { kind: 'move', i, sx: p.x, sy: p.y, dx: pt.dx, dy: pt.dy, s };
      showTab('patches');
    } else {
      pickFromPicture(e.target);
      return;
    }
    stage.setPointerCapture(e.pointerId); render(); e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = svgPoint(e), pt = S.patches[drag.i];
    if (drag.kind === 'move') { pt.dx = drag.dx + (p.x - drag.sx) / drag.s; pt.dy = drag.dy + (p.y - drag.sy) / drag.s; }
    if (drag.kind === 'resize') pt.size = Math.max(20, Math.min(500, drag.size0 * Math.hypot(p.x - drag.cx, p.y - drag.cy) / drag.d0));
    if (drag.kind === 'rotate') { let a = Math.atan2(p.y - drag.cy, p.x - drag.cx) * 180 / Math.PI + 90; if (a > 180) a -= 360; pt.rot = Math.round(a); }
    render();
  });
  stage.addEventListener('pointerup', () => { if (drag) { drag = null; save(); render(); } });

  // ---------- click-to-edit ----------
  // Clicking part of the picture opens the controls for it.
  let focusColor = null; // the garment row to highlight under the picture
  const LAYER_TAB = { hair: 'hair', face: 'face', beard: 'beard', mask: 'extras', accessory: 'extras', backdrop: 'backdrop' };
  function pickFromPicture(el) {
    const hadPatch = selectedPatch != null; selectedPatch = null; focusColor = null;
    const c = el.closest('[data-c]'), c2 = c && c.dataset.c, layer = (el.closest('[data-layer]') || {}).dataset || {};
    const where = layer.layer;
    if (c2 === 'skin') showTab('skin');
    else if (where === 'body') {
      // a click on black ink inside the outfit means its black garment, when it has one
      const g = garment(S.view, curBody()), key = c2 === 'ink' && g.ink ? g.ink.key : c2;
      focusColor = key && key !== 'ink' && clothingRows().some(([k]) => k === key) ? key : null;
      showTab('outfit');
    } else if (c2 === 'hat') showTab('hair');
    else if (LAYER_TAB[where]) showTab(LAYER_TAB[where]);
    else if (hadPatch) render();
    if (focusColor || where === 'body') {
      render();
      const row = document.querySelector(`#context-body [data-row="${focusColor}"]`) || document.getElementById('context');
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
  function showTab(id) {
    tab = id; tabsEl.querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', x.dataset.tab === id));
    renderTab();
    const panel = document.getElementById('tabbody');
    panel.classList.remove('flash'); void panel.offsetWidth; panel.classList.add('flash');
  }

  // The area under the picture edits whatever is selected: a patch, or the outfit's colors.
  // quick spots, as the viewer sees them
  const SPOTS = [['left', 'Left', -110, 300], ['center', 'Center', 0, 330], ['right', 'Right', 110, 300]];
  function renderContext() {
    const head = document.getElementById('context-h'), body = document.getElementById('context-body');
    if (!head) return;
    const pt = selectedPatch != null ? S.patches[selectedPatch] : null;
    if (pt) {
      const p = patchById(pt.pid);
      head.textContent = 'Selected patch: ' + (p ? p.name : '');
      body.innerHTML = `<p class="hint">Drag the patch to move it. Drag the round handles to resize or tilt it.</p>
        <div class="row" role="group" aria-label="Place on chest"><span class="mini">Place on chest</span>${SPOTS.map(([id, name]) => `<button class="btn small" data-spot="${id}">${name}</button>`).join('')}</div>
        <div class="row"><label for="p-size">Size</label><input id="p-size" type="range" min="20" max="500" value="${Math.round(pt.size)}" data-pprop="size"></div>
        ${p && p.noTilt ? '<p class="hint">This logo stays upright: its brand rules don\u2019t allow angling it.</p>' : `<div class="row"><label for="p-rot">Tilt</label><input id="p-rot" type="range" min="-180" max="180" value="${Math.round(pt.rot || 0)}" data-pprop="rot"></div>`}
        <div class="row"><button class="btn small" data-pact="back">Send back</button><button class="btn small" data-pact="front">Bring forward</button><button class="btn small" data-pact="dup">Duplicate</button><button class="btn small" data-pact="del">Remove</button><button class="btn small primary" data-pact="done">Done</button></div>`;
      return;
    }
    head.textContent = 'Clothing colors';
    body.innerHTML = clothingRows().map(([k, lab]) => swatchRow(k, lab).replace('<div class="row">', `<div class="row${focusColor === k ? ' focus' : ''}" data-row="${k}">`)).join('') +
      '<p class="hint">Tip: click any part of your avatar to edit it.</p>';
  }


  // ---------- tabs ----------
  const TABS = [
    // build order: the person, then their style, then what frames them
    ['skin', 'Skin'], ['hair', 'Hair'], ['face', 'Face'], ['beard', 'Facial hair'], ['extras', 'Glasses & mask'],
    ['outfit', 'Outfit'], ['patches', 'Patches'], ['backdrop', 'Backdrop'],
  ];
  let tab = 'skin';
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

  function optionGrid(cat, current, allowNone, only) {
    const names = only || (cat === 'body' ? list(S.view) : list(cat));
    let h = '<div class="grid">';
    if (allowNone) h += `<button class="opt none" data-cat="${cat}" data-name="" aria-pressed="${current == null}">None</button>`;
    for (const n of names) {
      const b = n === current ? [] : blockers(cat, n, S);
      const why = b.length ? ` (doesn’t work with ${label(b[0][1])})` : '';
      h += `<button class="opt${b.length ? ' is-hidden' : ''}" data-cat="${cat}" data-name="${n}" aria-pressed="${n === current}" title="${esc(label(n) + why)}" aria-label="${esc(label(n) + why)}">${thumb(cat, n)}</button>`;
    }
    return h + '</div>';
  }
  function swatchRow(key, label) {
    const lab = label || COLOR_LABEL[key];
    const pal = PALETTE[key], cur = String(S.colors[key]).toLowerCase();
    const custom = key !== 'bg' && /^#[0-9a-f]{6}$/i.test(S.colors[key]) ? S.colors[key] : '#ffffff';
    return `<div class="row"><label>${esc(lab)}</label><div class="swatches">${pal.map(([c, name]) => `<button class="sw" data-color="${key}" data-val="${c}" title="${name}" aria-label="${esc(lab)}: ${name}" aria-pressed="${cur === c.toLowerCase()}" style="background:${c === 'transparent' ? 'repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0/10px 10px' : c}"></button>`).join('')}${key !== 'bg' ? `<input type="color" data-color="${key}" value="${custom}" title="Pick any color" aria-label="Pick any ${esc(lab.toLowerCase())} color">` : ''}</div></div>`;
  }
  // clothing colors the current outfit (and hat) actually use
  function usedColorKeys() {
    const keys = new Set();
    const add = (part) => part && part.colors && part.colors.forEach((t) => TOKEN[t] && keys.add(TOKEN[t]));
    add(P[S.view][curBody()]); add(P.hair[S.hair]);
    return keys;
  }
  const hairHasColor = (h) => tintable('hair', h) || (P.hair[h] && P.hair[h].colors.includes('hairColor'));
  // clothing colors live under the picture, always in view
  // the current outfit's garments, named for what they are (Blazer, Tee, Pants...)
  function clothingRows() {
    const used = usedColorKeys(), g = garment(S.view, curBody()), labels = g.labels || {};
    const rows = [];
    for (const k of ['jacket', 'top', 'second', 'pants', 'shoes', 'accent']) {
      const isInkGarment = g.ink && g.ink.key === k;
      if (used.has(k) || isInkGarment) rows.push([k, isInkGarment ? g.ink.label : labels[k] || COLOR_LABEL[k]]);
    }
    return rows;
  }

  const ctxEl = document.getElementById('context-body');
  ctxEl.addEventListener('click', (e) => {
    const sw = e.target.closest('button[data-color]');
    if (sw) { S.colors[sw.dataset.color] = sw.dataset.val; focusColor = sw.dataset.color; save(); render(); return; }
    patchAction(e);
  });
  ctxEl.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('input[type=color]')) { S.colors[t.dataset.color] = t.value; save(); TAGGING = true; try { stage.innerHTML = fullSVG(S, true); } finally { TAGGING = false; } }
    if (t.dataset.pprop && selectedPatch != null) { S.patches[selectedPatch][t.dataset.pprop] = Number(t.value); save(); TAGGING = true; try { stage.innerHTML = fullSVG(S, true); } finally { TAGGING = false; } }
  });
  ctxEl.addEventListener('change', () => render());
  function patchAction(e) {
    const spot = e.target.closest('[data-spot]');
    if (spot && selectedPatch != null) {
      const [, , dx, dy] = SPOTS.find((x) => x[0] === spot.dataset.spot);
      Object.assign(S.patches[selectedPatch], { dx, dy, rot: 0 }); save(); render(); return true;
    }
    const pa = e.target.closest('[data-pact]');
    if (!pa || selectedPatch == null) return false;
    const i = selectedPatch, a = pa.dataset.pact, arr = S.patches;
    if (a === 'del') { arr.splice(i, 1); selectedPatch = null; }
    if (a === 'done') selectedPatch = null;
    if (a === 'dup') { arr.push({ ...arr[i], dx: arr[i].dx + 20, dy: arr[i].dy + 20 }); selectedPatch = arr.length - 1; }
    if (a === 'front' && i < arr.length - 1) { [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; selectedPatch = i + 1; }
    if (a === 'back' && i > 0) { [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]; selectedPatch = i - 1; }
    save(); render(); renderTab(); return true;
  }
  function renderTab() {
    renderContext();
    let h = '';
    const used = usedColorKeys();
    if (tab === 'outfit') {
      h += '<p class="hint">Change clothing colors under the picture.</p>' + optionGrid('body', curBody(), false);
    } else if (tab === 'skin') {
      h = swatchRow('skin') + '<p class="hint">Use the color picker at the end of the row for any other shade.</p>';
    } else if (tab === 'hair') {
      if (hairHasColor(S.hair)) {
        h += swatchRow('hair');
        // second color, then a third once the second is in use
        HAIR_SLOTS.forEach(([key, colorKey, lab], si) => {
          if (si > 0 && !(S[HAIR_SLOTS[si - 1][0]] || {}).style) return;
          const mix = S[key] || {};
          h += `<div class="row" role="group" aria-label="${lab} pattern"><label>${si ? 'Third color' : 'Two-tone'}</label><div class="chips">` +
            HAIR_PATTERNS.map(([id, nm]) => `<button class="chip" data-hairmix="${id}" data-slot="${key}" aria-pressed="${(mix.style || '') === id}">${nm}</button>`).join('') + '</div></div>';
          if (!mix.style) return;
          h += swatchRow(colorKey, lab);
          if (PATTERN_HAS_POS.includes(mix.style)) h += `<div class="row"><label for="pos-${key}">${mix.style === 'split' ? 'Position' : 'Distance from face'}</label><input id="pos-${key}" type="range" min="5" max="95" value="${Math.round((mix.pos == null ? PATTERN_POS[mix.style] : mix.pos) * 100)}" data-hairpos="${key}"></div>`;
          if (['frame', 'streak', 'two'].includes(mix.style)) h += `<div class="row" role="group" aria-label="Side"><label>Side</label><div class="chips">${[['left', 'Left'], ['right', 'Right'], ['both', 'Both']].map(([v, t]) => `<button class="chip" data-hairside="${v}" data-slot="${key}" aria-pressed="${(mix.side || 'left') === v}">${t}</button>`).join('')}</div></div>`;
          if (mix.style === 'frame') h += `<div class="row"><label for="w-${key}">Width</label><input id="w-${key}" type="range" min="0" max="100" value="${Math.round((mix.width == null ? 0.5 : mix.width) * 100)}" data-hairwidth="${key}"></div>`;
        });
      } else h += '<p class="hint">This style is a hat or head covering, so it has no hair color.</p>';
      if (used.has('hat')) h += swatchRow('hat');
      h += optionGrid('hair', S.hair, false);
    }
    else if (tab === 'face') {
      h = isMaskedHair(S.hair)
        ? '<p class="hint">This style comes with its own mask, so these faces are made to go with it.</p>' + optionGrid('face', faceOf(S), false, MASKED_FACES)
        : optionGrid('face', S.face, false);
    }
    else if (tab === 'beard') h = swatchRow('hair', 'Color') + '<p class="hint">Facial hair shares the hair color.</p>' + optionGrid('beard', S.beard, true);
    else if (tab === 'extras') h = '<h2>Glasses</h2>' + optionGrid('accessory', S.accessory, true) + '<h2>Mask</h2>' + optionGrid('mask', S.mask, true);
    else if (tab === 'backdrop') {
      h += '<h2>Shape</h2><div class="grid">';
      for (const [id, name] of SHAPES) {
        const icon = id ? `<svg viewBox="0 0 100 100" aria-hidden="true">${backdropSVG(id, S.colors.backdrop, 0, 0, 100)}</svg>` : 'None';
        h += `<button class="opt${id ? '' : ' none'}" data-shape="${id}" aria-pressed="${(S.backdrop || '') === id}" title="${name}" aria-label="${name}">${icon}</button>`;
      }
      h += '</div>' + swatchRow('backdrop') + swatchRow('bg') + '<p class="hint">Transparent gives a see-through PNG.</p>';
    } else if (tab === 'patches') {
      h += '<h2>Add a patch</h2><p class="hint">Pick one, then drag it on the avatar to place it.</p><div class="grid patchgrid">';
      for (const p of PATCHES) h += `<button class="opt" data-addpatch="${p.id}" title="${esc(p.name)}" aria-label="Add ${esc(p.name)}"><img src="${p.href}" alt="" style="max-width:80%;max-height:80%"></button>`;
      h += '</div>';
      if (S.patches.length) {
        h += '<h2>Your patches</h2><div class="row" style="gap:4px">';
        S.patches.forEach((pt, i) => { const p = patchById(pt.pid); h += `<button class="btn" data-selpatch="${i}" aria-pressed="${i === selectedPatch}" style="${i === selectedPatch ? 'border-color:var(--accent);background:var(--accent-soft)' : ''}">${esc(p ? p.name : pt.pid)}</button>`; });
        h += '</div>';
      }
      if (S.patches.length) h += '<p class="hint">Click a patch to edit it: its controls appear under the picture. Arrow keys nudge it (hold Shift for bigger steps).</p>';
    }
    bodyEl.innerHTML = h;
  }
  bodyEl.addEventListener('click', (e) => {
    const o = e.target.closest('[data-cat]');
    if (o) { setPart(o.dataset.cat, o.dataset.name || null); return; }
    const sw = e.target.closest('button[data-color]');
    if (sw) { S.colors[sw.dataset.color] = sw.dataset.val; save(); render(); renderTab(); return; }
    const hm = e.target.closest('[data-hairmix]');
    if (hm) {
      // a new pattern starts its position slider where that pattern looks best
      const k = hm.dataset.slot, style = hm.dataset.hairmix || null, prev = S[k] || {};
      S[k] = Object.assign({ pos: 0.5 }, prev, { style }, style !== prev.style && PATTERN_POS[style] != null ? { pos: PATTERN_POS[style] } : {});
      if (k === 'hairMix' && !S[k].style) S.hairMix3 = Object.assign({}, S.hairMix3, { style: null }); // no third without a second
      save(); render(); renderTab(); return;
    }
    const hs = e.target.closest('[data-hairside]');
    if (hs) { const k = hs.dataset.slot; S[k] = Object.assign({}, S[k], { side: hs.dataset.hairside }); save(); render(); renderTab(); return; }
    const sh = e.target.closest('[data-shape]');
    if (sh) { S.backdrop = sh.dataset.shape || null; save(); render(); renderTab(); return; }
    const ap = e.target.closest('[data-addpatch]');
    if (ap) {
      const spot = (L.patchSpot[S.view] || {})[curBody()] || { dx: 110, dy: 340, size: 110 };
      S.patches.push({ pid: ap.dataset.addpatch, dx: spot.dx + S.patches.length * 18, dy: spot.dy + S.patches.length * 18, size: spot.size, rot: 0 });
      selectedPatch = S.patches.length - 1; save(); render(); renderTab(); status('Patch added. Drag it into place.'); return;
    }
    const sp = e.target.closest('[data-selpatch]');
    if (sp) { selectedPatch = Number(sp.dataset.selpatch); render(); renderTab(); return; }
    patchAction(e);
  });
  bodyEl.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('input[type=color]')) { S.colors[t.dataset.color] = t.value; save(); render(); }
    if (t.dataset.hairpos) { const k = t.dataset.hairpos; S[k] = Object.assign({}, S[k], { pos: Number(t.value) / 100 }); save(); render(); }
    if (t.dataset.hairwidth) { const k = t.dataset.hairwidth; S[k] = Object.assign({}, S[k], { width: Number(t.value) / 100 }); save(); render(); }
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
    if (MASKED_FACES.length) st.maskedFace = pick(MASKED_FACES);
    st.beard = Math.random() < 0.3 ? pick(list('beard')) : null;
    st.accessory = Math.random() < 0.35 ? pick(list('accessory')) : null;
    st.mask = Math.random() < 0.1 ? pick(list('mask')) : null;
    st.colors.skin = pick(SKIN)[0]; st.colors.hair = pick(HAIRC)[0];
    const mixStyle = pick(HAIR_PATTERNS.slice(1))[0];
    st.hairMix = Math.random() < 0.15 ? { style: mixStyle, pos: (PATTERN_POS[mixStyle] || 0.5) + (Math.random() - 0.5) * 0.16 } : { style: null, pos: 0.5 };
    st.colors.hair2 = pick(HAIRC)[0];
    for (const k of ['top', 'pants', 'jacket', 'shoes', 'hat', 'accent']) st.colors[k] = pick(CLOTH)[0];
    st.backdrop = Math.random() < 0.5 ? pick(SHAPES.slice(1))[0] : null;
    st.colors.backdrop = pick(BACKDROP_C)[0];
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
    if (S.patches.some((pt) => (patchById(pt.pid) || {}).noInline)) status('Some patches come from a site that blocks downloads, so they may be missing from the PNG.');
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = pngMax;
      c.getContext('2d').drawImage(img, 0, 0, pngMax, pngMax);
      try { download('my-avatar.png', c.toDataURL('image/png')); } catch (err) { status('PNG download failed. Try SVG instead.'); }
    };
    img.onerror = () => status('PNG download failed. Try SVG instead.');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', `<svg width="${pngMax}" height="${pngMax}" `));
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

  // ---------- PNG size, saving and the about panel ----------
  const sizesEl = document.getElementById('sizes');
  const drawSizes = () => { sizesEl.innerHTML = PNG_SIZES.map(([px, name]) => `<button data-px="${px}" aria-pressed="${px === pngMax}" title="${px}\u00d7${px} pixels">${name}</button>`).join(''); };
  sizesEl.addEventListener('click', (e) => { const b = e.target.closest('[data-px]'); if (b) { pngMax = Number(b.dataset.px); drawSizes(); } });
  drawSizes();
  // an avatar link carries the settings after # so it works on any computer
  const toB64 = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromB64 = (b) => decodeURIComponent(escape(atob(b.replace(/-/g, '+').replace(/_/g, '/'))));
  const avatarLink = () => location.href.split('#')[0] + '#avatar=' + toB64(JSON.stringify(S));
  document.getElementById('copy-link').addEventListener('click', () => {
    copyText(avatarLink(), 'Link copied. Open it any time to get this avatar back.');
  });
  // a desktop shortcut file that opens the tool with this avatar
  const UA = navigator.userAgent;
  const isPhone = /iPhone|iPad|iPod|Android/i.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
  const isMac = /Macintosh|Mac OS X/.test(UA) && !isPhone;
  const isLinux = /Linux/.test(UA) && !/Android/.test(UA);
  document.getElementById('save-shortcut').addEventListener('click', () => {
    const link = avatarLink();
    if (isPhone) {
      window.open(link, '_blank', 'noopener');
      status(/Android/i.test(UA) ? 'Opened in a new tab. Tap the ⋮ menu, then “Add to Home screen”.' : 'Opened in a new tab. Tap Share, then “Add to Home Screen”.');
      return;
    }
    const iconURL = new URL('icons/favicon.ico', location.href.split('#')[0]).href;
    const xmlEsc = (v) => v.replace(/&/g, '&amp;');
    let name, body;
    if (isMac) {
      name = 'My avatar.webloc';
      body = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>URL</key><string>${xmlEsc(link)}</string></dict></plist>\n`;
    } else if (isLinux) {
      name = 'My avatar.desktop';
      body = `[Desktop Entry]\nType=Link\nName=My avatar\nURL=${link}\nIcon=${iconURL}\n`;
    } else {
      name = 'My avatar.url';
      body = `[InternetShortcut]\r\nURL=${link}\r\nIconFile=${iconURL}\r\nIconIndex=0\r\n`;
    }
    const url = URL.createObjectURL(new Blob([body], { type: 'application/octet-stream' }));
    download(name, url); setTimeout(() => URL.revokeObjectURL(url), 2000);
    status(`“${name}” is in your Downloads folder. Drag it to your desktop, then double-click it to open your avatar.`);
  });
  // on the standalone page, the tab icon shows the avatar's face, so bookmarks get it too
  let iconTimer = null;
  function updateFavicon() {
    if (window.top !== window.self) return;
    clearTimeout(iconTimer);
    iconTimer = setTimeout(() => {
      const st = clone(S); st.patches = []; st.colors.bg = 'transparent';
      const svg = fullSVG(st, false);
      const [x, y, w] = /viewBox="([^"]+)"/.exec(svg)[1].split(' ').map(Number);
      const crop = svg.replace(/viewBox="[^"]+"/, `viewBox="${x + w * 0.15} ${y} ${w * 0.7} ${w * 0.7}" width="64" height="64"`);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 64; c.getContext('2d').drawImage(img, 0, 0, 64, 64);
        try { document.getElementById('favicon').href = c.toDataURL('image/png'); } catch (e) {}
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(crop);
    }, 600);
  }
  document.getElementById('start-over').addEventListener('click', () => {
    if (!confirm('Start over with a new avatar? Your current one will be replaced.')) return;
    S = clone(DEFAULT); S.id = newId(); selectedPatch = null; save(); render(); renderTab(); status('Started over.');
  });
  function copyText(text, msg) {
    const done = () => status(msg);
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { prompt('Copy this:', text); } t.remove(); }
  }
  document.querySelector('.about').addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]'); if (b) copyText(document.getElementById(b.dataset.copy).textContent, 'Copied.');
  });
  function applyHashAvatar() {
    const m = /#avatar=([\w-]+)/.exec(location.hash);
    if (m) {
      try {
        const s = JSON.parse(fromB64(m[1]));
        if (s && s.body && s.colors) {
          if (s.id && s.id === S.id && (S.t || 0) >= (s.t || 0)) status('Welcome back. This is the latest version of your avatar.');
          else { S = Object.assign(clone(DEFAULT), s); S.colors = Object.assign(clone(DEFAULT.colors), s.colors); save(); status('Welcome back. Your avatar is loaded.'); }
        }
      } catch (e) { status('That avatar link could not be read.'); }
      // drop the snapshot from the address so a reload shows the latest changes
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    }
  }
  applyHashAvatar();
  // a shortcut opened in a tab that already shows the tool changes only the # part
  window.addEventListener('hashchange', () => { if (/#avatar=/.test(location.hash)) { applyHashAvatar(); selectedPatch = null; render(); renderTab(); } });

  render(); renderTab();
  if (ADMIN) status('Layer checker is on. Visitors never see it.');
})();
