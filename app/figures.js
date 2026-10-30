// Dibujos propios de cada ejercicio: un muñeco de perfil en posición inicial y final, con los músculos que trabajan en color.
// Cada postura es una lista de articulaciones (x, y) en un lienzo de 140 × 150; el suelo está en y = 143.
// h cabeza · s hombro · hp cadera · k rodilla · a tobillo · t punta del pie · e codo · w mano
// k2/a2/t2 y e2/w2 son la pierna y el brazo del otro lado (se dibujan más claros, detrás).
(function () {
  const STAND = { h: [60, 19], s: [60, 34], hp: [60, 80], k: [61, 110], a: [60, 137], t: [74, 140], e: [61, 57], w: [63, 79] };
  const P = (base, over) => Object.assign({}, base, over);

  const POSES = {
    stand: [STAND, STAND],
    squat: [
      P(STAND, { s: [60, 36], hp: [60, 82], k: [62, 112], e: [69, 52], w: [74, 44], h: [61, 21], props: [{ db: 'w' }] }),
      { h: [70, 48], s: [64, 62], hp: [46, 104], k: [82, 110], a: [66, 137], t: [82, 140], e: [75, 80], w: [80, 68], props: [{ db: 'w' }] }],
    hinge: [
      P(STAND, { e: [61, 58], w: [62, 82], props: [{ db: 'w' }] }),
      { h: [101, 54], s: [88, 61], hp: [52, 82], k: [60, 110], a: [60, 137], t: [76, 140], e: [89, 81], w: [89, 101], props: [{ db: 'w' }] }],
    lunge: [
      P(STAND, { w: [62, 82], props: [{ db: 'w' }] }),
      { h: [61, 39], s: [60, 54], hp: [58, 98], k: [82, 104], a: [80, 137], t: [96, 140], k2: [50, 134], a2: [28, 130], t2: [20, 141], e: [62, 76], w: [63, 96], props: [{ db: 'w' }] }],
    bridge: [
      { h: [18, 128], s: [32, 132], hp: [68, 134], k: [88, 114], a: [100, 137], t: [112, 140], k2: [86, 118], a2: [106, 108], e: [46, 137], w: [60, 139] },
      { h: [18, 128], s: [32, 130], hp: [68, 108], k: [90, 106], a: [100, 137], t: [112, 140], k2: [90, 94], a2: [112, 86], e: [46, 137], w: [60, 139] }],
    calf: [STAND, P(STAND, { h: [60, 9], s: [60, 24], hp: [60, 70], k: [61, 100], a: [62, 128], t: [73, 140], e: [61, 47], w: [63, 69] })],
    pallof: [
      { h: [60, 22], s: [59, 37], hp: [57, 84], k: [64, 112], a: [60, 137], t: [74, 140], e: [66, 58], w: [74, 52], props: [{ band: ['w', [130, 56]] }] },
      { h: [60, 22], s: [59, 37], hp: [57, 84], k: [64, 112], a: [60, 137], t: [74, 140], e: [80, 51], w: [98, 51], props: [{ band: ['w', [130, 56]] }] }],
    pogo: [
      P(STAND, { a: [62, 132], t: [72, 140], k: [62, 106], hp: [60, 76], s: [60, 30], h: [60, 15], e: [66, 52], w: [72, 66] }),
      P(STAND, { h: [60, 7], s: [60, 22], hp: [60, 66], k: [61, 95], a: [62, 120], t: [70, 128], e: [66, 44], w: [72, 58] })],
    boxjump: [
      { h: [72, 46], s: [66, 60], hp: [50, 98], k: [72, 110], a: [62, 137], t: [76, 140], e: [54, 72], w: [44, 84], props: [{ box: [86, 121, 44, 22] }] },
      { h: [92, 36], s: [86, 50], hp: [74, 88], k: [96, 96], a: [92, 119], t: [106, 121], e: [98, 64], w: [106, 56], props: [{ box: [74, 121, 44, 22] }] }],
    throw: [
      { h: [58, 24], s: [58, 39], hp: [58, 84], k: [66, 112], a: [64, 137], t: [78, 140], k2: [50, 112], a2: [42, 137], t2: [54, 140], e: [46, 64], w: [36, 78], props: [{ ball: ['w', 9] }] },
      { h: [66, 24], s: [64, 39], hp: [58, 84], k: [68, 112], a: [64, 137], t: [78, 140], k2: [50, 112], a2: [42, 137], t2: [54, 140], e: [82, 48], w: [100, 46], props: [{ ball: [[118, 44], 9] }, { wall: 134 }] }],
    bench: [
      { h: [26, 92], s: [40, 97], hp: [84, 99], k: [106, 94], a: [110, 137], t: [122, 140], e: [36, 112], w: [44, 90], props: [{ bench: [16, 103, 96, 7] }, { db: 'w' }] },
      { h: [26, 92], s: [40, 97], hp: [84, 99], k: [106, 94], a: [110, 137], t: [122, 140], e: [43, 74], w: [44, 52], props: [{ bench: [16, 103, 96, 7] }, { db: 'w' }] }],
    pulldown: [
      { h: [60, 44], s: [58, 60], hp: [60, 104], k: [86, 104], a: [86, 137], t: [100, 140], e: [64, 34], w: [68, 14], props: [{ seat: [44, 106, 40, 6] }, { bar: ['w', 16] }] },
      { h: [58, 44], s: [58, 60], hp: [60, 104], k: [86, 104], a: [86, 137], t: [100, 140], e: [48, 82], w: [62, 62], props: [{ seat: [44, 106, 40, 6] }, { bar: ['w', 16] }] }],
    row: [
      { h: [110, 86], s: [96, 90], hp: [52, 92], k: [52, 116], a: [50, 137], t: [64, 140], k2: [72, 104], a2: [54, 106], e: [92, 108], w: [92, 126], e2: [98, 98], w2: [100, 106], props: [{ bench: [64, 107, 56, 7] }, { db: 'w' }] },
      { h: [110, 86], s: [96, 90], hp: [52, 92], k: [52, 116], a: [50, 137], t: [64, 140], k2: [72, 104], a2: [54, 106], e: [74, 80], w: [86, 98], e2: [98, 98], w2: [100, 106], props: [{ bench: [64, 107, 56, 7] }, { db: 'w' }] }],
    facepull: [
      P(STAND, { e: [80, 46], w: [100, 44], props: [{ band: ['w', [132, 40]] }] }),
      P(STAND, { e: [52, 44], w: [70, 34], props: [{ band: ['w', [132, 40]] }] })],
    extrot: [
      P(STAND, { e: [62, 62], w: [86, 62], props: [{ band: ['w', [132, 62]] }] }),
      P(STAND, { e: [62, 62], w: [70, 58], props: [{ band: ['w', [132, 62]] }, { arrow: [[86, 70], [72, 70]] }] })],
    ytw: [
      { h: [22, 126], s: [34, 132], hp: [78, 134], k: [104, 136], a: [126, 137], t: [130, 130], e: [50, 139], w: [64, 139] },
      { h: [22, 124], s: [34, 129], hp: [78, 134], k: [104, 136], a: [126, 137], t: [130, 130], e: [20, 116], w: [6, 106] }],
    sideplank: [
      { h: [22, 106], s: [32, 120], hp: [76, 134], k: [100, 136], a: [122, 138], t: [128, 140], e: [32, 140], w: [48, 140] },
      { h: [22, 104], s: [32, 118], hp: [76, 122], k: [100, 130], a: [122, 137], t: [128, 140], e: [32, 140], w: [48, 140] }],
    skater: [
      { h: [78, 44], s: [72, 58], hp: [60, 96], k: [72, 114], a: [62, 137], t: [76, 140], k2: [50, 118], a2: [38, 132], e: [82, 72], w: [90, 84] },
      { h: [96, 30], s: [92, 44], hp: [86, 84], k: [96, 104], a: [92, 124], t: [102, 128], k2: [76, 104], a2: [70, 124], e: [76, 60], w: [70, 74] }],
    bulgarian: [
      { h: [62, 26], s: [60, 41], hp: [60, 82], k: [68, 110], a: [68, 137], t: [82, 140], k2: [46, 108], a2: [30, 110], t2: [20, 106], e: [62, 62], w: [63, 84], props: [{ bench: [6, 112, 36, 7] }, { db: 'w' }] },
      { h: [64, 44], s: [62, 59], hp: [56, 100], k: [82, 108], a: [74, 137], t: [88, 140], k2: [46, 130], a2: [30, 112], t2: [20, 106], e: [64, 80], w: [65, 102], props: [{ bench: [6, 112, 36, 7] }, { db: 'w' }] }],
    stepup: [
      { h: [62, 22], s: [60, 37], hp: [58, 82], k: [84, 90], a: [84, 118], t: [98, 120], k2: [56, 112], a2: [54, 137], t2: [68, 140], e: [61, 60], w: [63, 82], props: [{ box: [70, 121, 46, 22] }] },
      { h: [83, 10], s: [82, 25], hp: [82, 66], k: [83, 92], a: [84, 118], t: [98, 120], k2: [96, 78], a2: [94, 104], t2: [104, 106], e: [83, 48], w: [85, 70], props: [{ box: [70, 121, 46, 22] }] }],
    slrdl: [
      P(STAND, { k2: [60, 106], a2: [58, 128], t2: [66, 132], w: [63, 82], props: [{ db: 'w' }] }),
      { h: [114, 72], s: [100, 76], hp: [60, 80], k: [62, 110], a: [60, 137], t: [74, 140], k2: [36, 78], a2: [14, 74], t2: [10, 82], e: [99, 96], w: [99, 114], props: [{ db: 'w' }] }],
    pushup: [
      { h: [108, 100], s: [96, 106], hp: [54, 116], k: [32, 126], a: [12, 136], t: [8, 140], e: [96, 124], w: [96, 140] },
      { h: [110, 124], s: [98, 128], hp: [54, 132], k: [32, 136], a: [12, 138], t: [8, 141], e: [84, 128], w: [96, 140] }],
    monster: [
      { h: [62, 26], s: [61, 41], hp: [58, 88], k: [68, 114], a: [64, 137], t: [78, 140], k2: [54, 114], a2: [50, 137], t2: [62, 140], e: [64, 62], w: [70, 76], props: [{ ring: 'k' }] },
      { h: [64, 26], s: [63, 41], hp: [60, 88], k: [80, 114], a: [80, 137], t: [94, 140], k2: [52, 114], a2: [44, 137], t2: [56, 140], e: [66, 62], w: [72, 76], props: [{ ring: 'k' }] }],
    chop: [
      { h: [56, 22], s: [56, 37], hp: [58, 84], k: [66, 112], a: [64, 137], t: [78, 140], k2: [50, 112], a2: [42, 137], t2: [54, 140], e: [46, 24], w: [34, 12], props: [{ band: ['w', [8, 6]] }] },
      { h: [64, 24], s: [62, 39], hp: [58, 86], k: [68, 112], a: [64, 137], t: [78, 140], k2: [50, 112], a2: [42, 137], t2: [54, 140], e: [76, 70], w: [90, 90], props: [{ band: ['w', [8, 6]] }] }],
    deadbug: [
      { h: [18, 126], s: [32, 130], hp: [74, 132], k: [78, 106], a: [98, 106], t: [102, 100], e: [34, 110], w: [36, 90] },
      { h: [18, 126], s: [32, 130], hp: [74, 132], k: [98, 122], a: [122, 126], t: [128, 120], k2: [78, 106], a2: [98, 106], e: [18, 118], w: [4, 112] }],
    bandrow: [
      P(STAND, { e: [80, 62], w: [100, 64], props: [{ band: ['w', [132, 68]] }] }),
      P(STAND, { e: [46, 66], w: [64, 66], props: [{ band: ['w', [132, 68]] }] })],
  };

  // dónde se pinta cada grupo muscular en el muñeco de perfil
  const ZONES = {
    cuadriceps: { seg: ['hp', 'k'] }, isquios: { seg: ['hp', 'k'] }, gluteo: { dot: 'hp', dx: -7, r: 9 }, gluteo_medio: { dot: 'hp', dx: -2, dy: -6, r: 7 },
    gemelos: { seg: ['k', 'a'] }, core: { seg: ['s', 'hp'] }, oblicuos: { seg: ['s', 'hp'] }, pecho: { seg: ['s', 'hp'], part: 0.35 },
    espalda: { seg: ['s', 'hp'], part: 0.5 }, dorsal: { seg: ['s', 'hp'], part: 0.5 }, lumbar: { seg: ['s', 'hp'], from: 0.6 },
    hombro: { dot: 's', r: 7 }, manguito: { dot: 's', r: 7 }, escapula: { dot: 's', dx: -5, r: 7 }, triceps: { seg: ['s', 'e'] }, biceps: { seg: ['s', 'e'] },
    aductores: { seg: ['hp', 'k'] }, tobillo: { seg: ['k', 'a'] },
  };
  const INK = '#4A4540', BACK = '#A39C94', HI = '#B83A0B', HI2 = '#F0A47F', PROP = '#2B2724', LINE = '#D8D2CA';

  function line(a, b, w, c) { return '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round"/>'; }
  function lerp(a, b, f) { return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }

  function draw(p, prim, sec) {
    const out = [line([12, 143], [128, 143], 2, LINE)];
    const props = p.props || [];
    const at = v => typeof v === 'string' ? p[v] : v;
    props.forEach(o => {
      if (o.box) out.push('<rect x="' + o.box[0] + '" y="' + o.box[1] + '" width="' + o.box[2] + '" height="' + o.box[3] + '" rx="3" fill="#E6E0D8"/>');
      if (o.bench || o.seat) { const b = o.bench || o.seat; out.push('<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" rx="3" fill="#CFC8BF"/>', line([b[0] + 8, b[1] + b[3]], [b[0] + 8, 143], 3, '#CFC8BF'), line([b[0] + b[2] - 8, b[1] + b[3]], [b[0] + b[2] - 8, 143], 3, '#CFC8BF')); }
      if (o.wall) out.push('<rect x="' + o.wall + '" y="10" width="6" height="133" fill="#E6E0D8"/>');
      if (o.band) out.push('<line x1="' + at(o.band[0])[0] + '" y1="' + at(o.band[0])[1] + '" x2="' + o.band[1][0] + '" y2="' + o.band[1][1] + '" stroke="#2457B3" stroke-width="2" stroke-dasharray="4 3"/>', '<circle cx="' + o.band[1][0] + '" cy="' + o.band[1][1] + '" r="3" fill="#2457B3"/>');
    });
    // lado de atrás, más claro
    if (p.k2) out.push(line(p.hp, p.k2, 12, BACK), line(p.k2, p.a2, 10, BACK), p.t2 ? line(p.a2, p.t2, 5, BACK) : '');
    if (p.e2) out.push(line(p.s, p.e2, 7, BACK), line(p.e2, p.w2, 6, BACK));
    const color = z => prim.indexOf(z) >= 0 ? HI : sec.indexOf(z) >= 0 ? HI2 : null;
    // glúteos detrás de la cadera
    ['gluteo', 'gluteo_medio'].forEach(z => { const c = color(z); if (c) { const d = ZONES[z]; out.push('<circle cx="' + (p.hp[0] + (d.dx || 0)) + '" cy="' + (p.hp[1] + (d.dy || 0)) + '" r="' + d.r + '" fill="' + c + '"/>'); } });
    const segColor = (a, b, def) => {
      let c = null;
      Object.keys(ZONES).forEach(z => { const d = ZONES[z]; if (d.seg && d.seg[0] === a && d.seg[1] === b && !d.part && !d.from) { const k = color(z); if (k === HI || (k && !c)) c = k; } });
      return c || def;
    };
    out.push(line(p.s, p.hp, 15, segColor('s', 'hp', INK)));
    // zonas parciales del tronco (pecho arriba, lumbar abajo)
    Object.keys(ZONES).forEach(z => { const d = ZONES[z], c = color(z); if (!c || !d.seg || d.seg[0] !== 's') return; if (d.part) out.push(line(p.s, lerp(p.s, p.hp, d.part), 15, c)); if (d.from) out.push(line(lerp(p.s, p.hp, d.from), p.hp, 15, c)); });
    out.push(line(p.hp, p.k, 13, segColor('hp', 'k', INK)), line(p.k, p.a, 11, segColor('k', 'a', INK)), line(p.a, p.t, 6, INK));
    out.push(line(p.s, p.e, 8, segColor('s', 'e', INK)), line(p.e, p.w, 7, INK));
    ['hombro', 'manguito', 'escapula'].forEach(z => { const c = color(z); if (c) { const d = ZONES[z]; out.push('<circle cx="' + (p.s[0] + (d.dx || 0)) + '" cy="' + p.s[1] + '" r="' + d.r + '" fill="' + c + '"/>'); } });
    props.forEach(o => {
      if (o.db) { const w = at(o.db); out.push('<rect x="' + (w[0] - 6) + '" y="' + (w[1] - 8) + '" width="12" height="16" rx="3" fill="' + PROP + '"/>'); }
      if (o.ball) { const c = at(o.ball[0]); out.push('<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + o.ball[1] + '" fill="#2457B3"/>'); }
      if (o.bar) { const w = at(o.bar[0]); out.push(line([w[0] - 22, w[1]], [w[0] + 22, w[1]], 4, PROP), line([w[0], w[1]], [w[0], 2], 1.5, '#8A847D')); }
      if (o.ring) { const k = at(o.ring); out.push('<ellipse cx="' + (k[0] - 6) + '" cy="' + k[1] + '" rx="14" ry="4" fill="none" stroke="#2457B3" stroke-width="3"/>'); }
      if (o.arrow) out.push('<path d="M' + o.arrow[0][0] + ' ' + o.arrow[0][1] + 'L' + o.arrow[1][0] + ' ' + o.arrow[1][1] + '" stroke="#2457B3" stroke-width="2" marker-end="url(#arr)"/>');
    });
    out.push('<circle cx="' + p.h[0] + '" cy="' + p.h[1] + '" r="11" fill="' + INK + '"/>');
    return out.join('');
  }

  /** SVG de una postura (0 = inicio, 1 = final). */
  window.figureSvg = function (ex, i, size) {
    const pose = (POSES[ex.pose] || POSES.stand)[i];
    const prim = ex.musculos.primarios.map(m => m.zona), sec = ex.musculos.secundarios.map(m => m.zona);
    const label = (i ? 'Posición final' : 'Posición inicial') + ': ' + ex.nombre;
    return '<svg viewBox="0 0 140 150" width="' + (size || 140) + '" height="' + Math.round((size || 140) * 150 / 140) + '" role="img" aria-label="' + label + '">' +
      '<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#2457B3"/></marker></defs>' + draw(pose, prim, sec) + '</svg>';
  };
  window.FIGURE_COLORS = { HI, HI2 };
})();
