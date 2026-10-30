// Genera app/data/demo.js (datos del modo demostración) con la misma lógica de Entreno.gs,
// para que la demo enseñe exactamente lo que prescribiría el cerebro.
// Ejecutar: TZ=Europe/Madrid node tools/make-demo.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ctx = { console, Math, Date, JSON, String, Number, Object, Array, RegExp,
  norm_: s => String(s || '').toLowerCase(), HOUR: 3600000, DAY: 86400000 };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Entreno.gs'), 'utf8') +
  '\n;Object.assign(this, { ENT_SESSIONS, ENT_EVIDENCE });', ctx);
const evidence = ctx.ENT_EVIDENCE.map((e, i) => Object.assign({ id: 'E' + (i + 1), estado: 'verificado', verificado: '2026-10-30' }, e));
ctx.entRows_ = name => name === 'Evidencia' ? evidence : [];

const w = { semana: 2, bloque: 1 };
const sessions = {}, why = {};
Object.keys(ctx.ENT_SESSIONS).forEach(k => {
  const s = ctx.ENT_SESSIONS[k];
  sessions[k] = { titulo: s.titulo, tipo: s.tipo, prioridad: s.prio, lugar: s.lugar,
    minutos: s.ej ? s.min : ctx.cardioMinutes_(k, w),
    ejercicios: s.ej ? JSON.parse(JSON.stringify(ctx.prescribe_(k, w, 'gym'))) : null,
    texto: s.ej ? null : ctx.sessionDesc_(k, ctx.cardioMinutes_(k, w), 'gym') };
  why[k] = JSON.parse(JSON.stringify(ctx.whySession_(k, w)));
});
const out = '// Generado por tools/make-demo.js a partir de Entreno.gs. No editar a mano.\nwindow.DEMO_DATA = ' +
  JSON.stringify({ semanaBloque: w, sessions, why, evidence }, null, 1) + ';\n';
fs.writeFileSync(path.join(__dirname, '../app/data/demo.js'), out);
console.log('app/data/demo.js: ' + Object.keys(sessions).length + ' sesiones, ' + evidence.length + ' estudios');
