/**
 * Entrenador · cerebro de la app
 * Va en el MISMO proyecto de Apps Script que Bot.gs, Surf.gs y Tareas.gs (la agenda) y usa sus funciones
 * (calendario, Deshacer, notas al planificador). Así los dos comparten las mismas reglas de calendario.
 *  - Planifica la semana de entrenamiento (fuerza, carrera, bici, natación) en los huecos LIBRES del calendario:
 *    el estudio manda; si una sesión clave no cabe, te pregunta.
 *  - Recibe lo que haces en la app (series, cierre de sesión, "hoy no puedo"), importa actividades de intervals.icu
 *    y lleva las estadísticas.
 *  - Chat con el entrenador: Groq (rápido) y Gemini de respaldo. Las cuentas y las reglas las hace el código;
 *    la IA entiende lo que dices y explica el porqué. Solo puede citar estudios verificados de la pestaña Evidencia.
 *  - Avisos por Telegram (un bot aparte, solo para avisar) con botón para abrir la app.
 *
 * Instalación: ver README.md del repositorio. Hay que añadir una línea a doPost de Bot.gs y ejecutar setupEntreno().
 * Tus datos personales (perfil, objetivos, ciudad) van en MiPerfil.gs, que no se sube al repositorio.
 */

const ENT = {
  TAG: 'Agenda entreno',            // marca en la descripción de los eventos del entrenador
  COLOR: '6',                       // mandarina
  SHEET: 'Entrenador',
  GYM_TRAVEL: 10,                   // minutos de casa al gimnasio
  SWIM_TRAVEL: 15,                  // minutos al centro de natación (ajustable en la pestaña Perfil)
  SWIM_BOOK_H: 48,                  // hay que reservar con 48 h
  BIKE_MIN_TEMP: 10, BIKE_MAX_RAIN: 40,
  STEP: 15,                         // minutos entre horas de inicio que se prueban
  BLOCK_WEEKS: 4,                   // bloques de 4 semanas: 3 de carga y 1 suave
};

// Ventanas en las que se busca hueco, por orden de preferencia. L-V = laborables; FS = fin de semana.
// El gimnasio abre de 8:00 a 22:00 (el evento incluye ida y vuelta). La natación tiene su propio horario.
const ENT_WINDOWS = {
  gym:  { LV: [['18:00', '22:10'], ['07:50', '09:30'], ['13:30', '15:40']], FS: [['09:30', '13:30'], ['16:30', '21:00']] },
  casa: { LV: [['20:00', '22:30'], ['07:00', '09:00'], ['13:30', '15:30']], FS: [['09:00', '13:30'], ['16:00', '21:00']] },
  calle: { LV: [['18:00', '21:30'], ['07:00', '09:00'], ['13:30', '15:30']], FS: [['09:00', '13:00'], ['17:00', '20:00']] },
  bici: { LV: [['14:00', '20:00'], ['08:00', '13:00']], FS: [['09:00', '14:00'], ['15:00', '19:00']] },
  piscina: { LV: [['09:00', '13:00']], D: [['15:00', '21:00']] },
};

// Ejercicios: el id coincide con la ficha de la app (app/data/ejercicios.js).
// t: plio | fuerza | acc | core. En 'plio' las reps son contactos con el suelo (o lanzamientos).
const ENT_SESSIONS = {
  FA: { tipo: 'fuerza', titulo: 'Fuerza A · Tren inferior', icono: '🏋️', prio: 'clave', lugar: 'gym', min: 60, piernas: true, ej: [
    { id: 'pogo', t: 'plio' }, { id: 'salto_cajon', t: 'plio' },
    { id: 'sentadilla_goblet', t: 'fuerza', reps: 8 }, { id: 'peso_muerto_rumano', t: 'fuerza', reps: 8 },
    { id: 'zancada_atras', t: 'fuerza', reps: 8, lado: true },
    { id: 'puente_gluteo_unilateral', t: 'acc', reps: 10, lado: true }, { id: 'elevacion_talones', t: 'acc', reps: 12 },
    { id: 'pallof', t: 'core', reps: 10, lado: true }] },
  FB: { tipo: 'fuerza', titulo: 'Fuerza B · Tren superior y rotación', icono: '🏋️', prio: 'clave', lugar: 'gym', min: 60, ej: [
    { id: 'lanzamiento_rotacional', t: 'plio' },
    { id: 'press_mancuernas', t: 'fuerza', reps: 8 }, { id: 'jalon_pecho', t: 'fuerza', reps: 10 }, { id: 'remo_mancuerna', t: 'fuerza', reps: 8, lado: true },
    { id: 'face_pull', t: 'acc', reps: 12 }, { id: 'rotacion_externa', t: 'acc', reps: 12, lado: true }, { id: 'ytw', t: 'acc', reps: 8 },
    { id: 'plancha_lateral', t: 'core', reps: 25, seg: true, lado: true }] },
  FC: { tipo: 'fuerza', titulo: 'Fuerza C · Unilateral y core', icono: '🏋️', prio: 'normal', lugar: 'gym', min: 50, piernas: true, ej: [
    { id: 'saltos_laterales', t: 'plio' },
    { id: 'bulgara', t: 'fuerza', reps: 8, lado: true }, { id: 'step_up', t: 'fuerza', reps: 8, lado: true },
    { id: 'peso_muerto_unilateral', t: 'fuerza', reps: 8, lado: true }, { id: 'flexiones', t: 'fuerza', reps: 10 },
    { id: 'monster_walk', t: 'acc', reps: 12, lado: true }, { id: 'lenador_polea', t: 'core', reps: 10, lado: true },
    { id: 'dead_bug', t: 'core', reps: 8, lado: true }] },
  CS: { tipo: 'carrera', titulo: 'Carrera suave', icono: '🏃', prio: 'normal', lugar: 'calle', min: 40 },
  CL: { tipo: 'carrera', titulo: 'Tirada larga suave', icono: '🏃', prio: 'clave', lugar: 'calle', min: 60, larga: true },
  BI: { tipo: 'bici', titulo: 'Bici de carretera', icono: '🚴', prio: 'normal', lugar: 'bici', min: 75 },
  NA: { tipo: 'natacion', titulo: 'Natación técnica', icono: '🏊', prio: 'normal', lugar: 'piscina', min: 40 },
};

// Versión de casa (mancuernas de 1 a 6 kg, bandas, agarraderas, esterilla) y versión corta de cada fuerza.
const ENT_CASA = {
  FA: ['pogo', 'sentadilla_goblet', 'zancada_atras', 'puente_gluteo_unilateral', 'monster_walk', 'dead_bug'],
  FB: ['flexiones', 'remo_banda', 'rotacion_externa', 'ytw', 'plancha_lateral'],
  FC: ['saltos_laterales', 'bulgara', 'peso_muerto_unilateral', 'flexiones', 'dead_bug'],
};
const ENT_CORTA = { FA: ['pogo', 'sentadilla_goblet', 'peso_muerto_rumano', 'pallof'], FB: ['press_mancuernas', 'remo_mancuerna', 'face_pull', 'plancha_lateral'], FC: ['bulgara', 'peso_muerto_unilateral', 'dead_bug'] };

// Qué sesiones lleva la semana según el modo. El orden es el de prioridad al buscar hueco.
const ENT_MODES = {
  normal: ['FA', 'FB', 'CL', 'FC', 'CS', 'BI|NA'],
  corto: ['FA', 'FB', 'CS'],             // semana con poco tiempo: lo esencial, sesiones cortas
  mantenimiento: ['FA', 'FB'],           // exámenes: mínimo para no perder (versión corta)
};
// Día ideal (0 = domingo) de cada sesión: se usa para repartir, no es obligatorio.
const ENT_IDEAL = { FA: 1, FB: 3, FC: 5, CS: 2, CL: 0, BI: 6, NA: 4 };

const ENT_TABS = {
  Plan: ['id', 'semana', 'fecha', 'inicio', 'fin', 'clave', 'tipo', 'titulo', 'prioridad', 'minutos', 'lugar', 'version', 'estado', 'evento', 'cierre', 'origen', 'avisos'],
  Series: ['id', 'fecha', 'sesion', 'ejercicio', 'serie', 'kg', 'reps', 'rir'],
  Medidas: ['id', 'fecha', 'tipo', 'valor', 'unidad', 'nota'],
  Objetivos: ['id', 'creado', 'titulo', 'detalle', 'fecha', 'prioridad', 'estado'],
  Evidencia: ['id', 'afirmacion', 'autores', 'año', 'titulo', 'revista', 'doi', 'tipo', 'solidez', 'estado', 'verificado', 'tema'],
  Perfil: ['clave', 'valor'],
  Chat: ['id', 'fecha', 'rol', 'texto', 'citas'],
  Buzon: ['id', 'fecha', 'de', 'tipo', 'detalle', 'estado', 'opciones', 'contexto'],
  Actividades: ['id', 'fecha', 'fuente', 'tipo', 'minutos', 'km', 'fc', 'sesion', 'externo'],
};

// ------------------------------------------------------------------ instalación

function setupEntreno() {
  if (!key_()) throw new Error('Primero tiene que estar instalada la agenda (setup() y setupBot()).');
  const props = PropertiesService.getScriptProperties();
  if (!prop_('ENT_KEY')) props.setProperty('ENT_KEY', Utilities.getUuid().replace(/-/g, '').slice(0, 20));
  entBook_();
  Object.keys(ENT_TABS).forEach(entTab_);
  seedEntreno_();
  // el bot de avisos: busca tu chat en los últimos mensajes que le has mandado
  if (prop_('ENT_TG_TOKEN') && !prop_('ENT_TG_CHAT')) {
    const r = entTg_('getUpdates', {});
    const u = (r.result || []).filter(x => x.message).pop();
    if (u) setProp_('ENT_TG_CHAT', String(u.message.chat.id));
    else Logger.log('Escribe cualquier cosa a tu bot de avisos en Telegram y vuelve a ejecutar setupEntreno().');
  }
  ScriptApp.getProjectTriggers()
    .filter(t => ['entrenoTick', 'entrenoMorning', 'entrenoEvening', 'entrenoWeekly', 'entrenoResearch'].indexOf(t.getHandlerFunction()) >= 0)
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('entrenoTick').timeBased().everyMinutes(30).create();
  ScriptApp.newTrigger('entrenoMorning').timeBased().atHour(7).nearMinute(30).everyDays(1).create();
  ScriptApp.newTrigger('entrenoEvening').timeBased().atHour(21).nearMinute(30).everyDays(1).create();
  ScriptApp.newTrigger('entrenoResearch').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(16).create();
  ScriptApp.newTrigger('entrenoWeekly').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(18).create();
  // el planificador de estudio tiene que saber que los entrenos ceden ante el estudio
  if (!prop_('ENT_NOTE')) {
    note_('preferencia', '', 'Los eventos mandarina con "' + ENT.TAG + '" en la descripción son entrenos del entrenador. El estudio manda: si necesitas ese hueco, ponle estudio encima y el entrenador recoloca el entreno solo.');
    setProp_('ENT_NOTE', '1');
  }
  // primera semana
  if (!entRows_('Plan').length) planWeek_(new Date(), 'normal', 'inicio');
  Logger.log('Hoja del entrenador: ' + entBook_().getUrl());
  Logger.log('URL de la API (pégala en la app): ' + (prop_('WEB_URL') || webUrl_()) + '?app=entreno');
  Logger.log('Clave de la app: ' + prop_('ENT_KEY'));
}

function entBook_() {
  const id = prop_('ENT_SHEET_ID');
  let ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create(ENT.SHEET); setProp_('ENT_SHEET_ID', ss.getId()); }
  return ss;
}

function entTab_(name) {
  const ss = entBook_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, ENT_TABS[name].length).setValues([ENT_TABS[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
    const first = ss.getSheets()[0];
    if (first.getName() === 'Hoja 1' || first.getName() === 'Sheet1') ss.deleteSheet(first);
  }
  return sh;
}

/** Filas de una pestaña como objetos (con su número de fila). */
function entRows_(name) {
  const sh = entTab_(name), head = ENT_TABS[name];
  const n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  // Sheets convierte "2026-11-02" o "18:30" en fechas: en el plan y el perfil se devuelven como texto
  const asText = name === 'Plan' ? { semana: 'd', fecha: 'd', inicio: 't', fin: 't' } : name === 'Perfil' ? { valor: 'd' } : {};
  return sh.getRange(2, 1, n, head.length).getValues().map((r, i) => {
    const o = { _row: i + 2 };
    head.forEach((h, j) => { o[h] = r[j] instanceof Date && asText[h] ? (asText[h] === 't' ? hhmm_(r[j]) : ymd_(r[j])) : r[j]; });
    return o;
  });
}
function entAppend_(name, obj) {
  const sh = entTab_(name);
  if (name === 'Plan' || name === 'Perfil') sh.getRange(sh.getLastRow() + 1, 1, 1, ENT_TABS[name].length).setNumberFormat('@');
  sh.appendRow(ENT_TABS[name].map(h => obj[h] == null ? '' : obj[h]));
}
function entUpdate_(name, row, obj) {
  const head = ENT_TABS[name], sh = entTab_(name);
  Object.keys(obj).forEach(k => { const j = head.indexOf(k); if (j >= 0) sh.getRange(row._row, j + 1).setValue(obj[k]); row[k] = obj[k]; });
}

function perfil_() {
  const o = {};
  entRows_('Perfil').forEach(r => { o[String(r.clave)] = String(r.valor); });
  return o;
}
function setPerfil_(k, v) {
  const r = entRows_('Perfil').find(x => String(x.clave) === k);
  if (r) entUpdate_('Perfil', r, { valor: v }); else entAppend_('Perfil', { clave: k, valor: v });
}

/**
 * Tus datos de partida. Vienen de MiPerfil.gs (const ENT_MI_PERFIL), un archivo que solo está en tu Apps Script
 * y nunca en el repositorio. Sin él, se empieza con un perfil vacío que puedes rellenar en la pestaña Perfil.
 */
function miPerfil_() {
  const m = typeof ENT_MI_PERFIL !== 'undefined' ? ENT_MI_PERFIL : {};
  return { nombre: m.nombre || '', home: m.home || { lat: 40.4168, lon: -3.7038 }, perfil: m.perfil || [], objetivos: m.objetivos || [], peso: m.peso || null };
}

/** Datos de partida y estudios verificados en Crossref. */
function seedEntreno_() {
  const mi = miPerfil_();
  if (!entRows_('Perfil').length) {
    [['nombre', mi.nombre]].concat(mi.perfil).concat([['modo', 'normal'], ['bloque_inicio', ymd_(weekStart_(new Date()))]])
      .forEach(([clave, valor]) => entAppend_('Perfil', { clave, valor }));
  }
  if (!entRows_('Objetivos').length) {
    mi.objetivos.forEach((o, i) => entAppend_('Objetivos', { id: newId_('o'), creado: new Date(), titulo: o.titulo, detalle: o.detalle || '', fecha: o.fecha || '', prioridad: o.prioridad || i + 1, estado: 'activo' }));
  }
  if (!entRows_('Evidencia').length) ENT_EVIDENCE.forEach((e, i) => entAppend_('Evidencia', Object.assign({ id: 'E' + (i + 1), estado: 'verificado', verificado: '2026-10-30' }, e)));
  if (!entRows_('Medidas').length && mi.peso) entAppend_('Medidas', { id: newId_('m'), fecha: new Date(), tipo: 'peso', valor: mi.peso, unidad: 'kg', nota: 'en ayunas' });
}

// Cada referencia se comprobó en api.crossref.org el 30-10-2026 (título, primer autor, revista, año y páginas).
// La "afirmacion" es un resumen propio y prudente de su conclusión principal.
const ENT_EVIDENCE = [
  { tema: 'lesiones', afirmacion: 'El entrenamiento de fuerza reduce el riesgo de lesiones deportivas; el estiramiento por sí solo apenas lo cambia.', autores: 'Lauersen JB, Bertelsen DM, Andersen LB', año: 2014, titulo: 'The effectiveness of exercise interventions to prevent sports injuries: a systematic review and meta-analysis of randomised controlled trials', revista: 'Br J Sports Med 48(11):871-877', doi: '10.1136/bjsports-2013-092538', tipo: 'Metaanálisis de ensayos', solidez: 'alta' },
  { tema: 'volumen', afirmacion: 'Más series semanales por músculo se asocian a más ganancia muscular (relación dosis-respuesta).', autores: 'Schoenfeld BJ, Ogborn D, Krieger JW', año: 2017, titulo: 'Dose-response relationship between weekly resistance training volume and increases in muscle mass: A systematic review and meta-analysis', revista: 'J Sports Sci 35(11):1073-1082', doi: '10.1080/02640414.2016.1210197', tipo: 'Metaanálisis', solidez: 'alta' },
  { tema: 'carrera', afirmacion: 'Añadir fuerza mejora la economía de carrera en corredores entrenados.', autores: 'Balsalobre-Fernández C, Santos-Concejero J, Grivas GV', año: 2016, titulo: 'Effects of Strength Training on Running Economy in Highly Trained Runners: A Systematic Review With Meta-Analysis of Controlled Trials', revista: 'J Strength Cond Res 30:2361-2368', doi: '10.1519/JSC.0000000000001316', tipo: 'Metaanálisis', solidez: 'alta' },
  { tema: 'resistencia', afirmacion: 'La fuerza pesada y explosiva bien programada mejora el rendimiento en carrera y ciclismo sin estorbar al entrenamiento de resistencia.', autores: 'Rønnestad BR, Mujika I', año: 2014, titulo: 'Optimizing strength training for running and cycling endurance performance: A review', revista: 'Scand J Med Sci Sports 24(4):603-612', doi: '10.1111/sms.12104', tipo: 'Revisión narrativa', solidez: 'media' },
  { tema: 'pliometria', afirmacion: 'El entrenamiento pliométrico mejora la altura de salto vertical.', autores: 'Markovic G', año: 2007, titulo: 'Does plyometric training improve vertical jump height? A meta-analytical review', revista: 'Br J Sports Med 41(6):349-355', doi: '10.1136/bjsm.2007.035113', tipo: 'Metaanálisis', solidez: 'alta' },
  { tema: 'progresion_carrera', afirmacion: 'En corredores novatos, un programa más gradual que la regla del 10 % no redujo las lesiones: la regla del 10 % es una referencia, no una ley.', autores: 'Buist I, Bredeweg SW, van Mechelen W, et al.', año: 2008, titulo: 'No Effect of a Graded Training Program on the Number of Running-Related Injuries in Novice Runners: A Randomized Controlled Trial', revista: 'Am J Sports Med 36(1):33-39', doi: '10.1177/0363546507307505', tipo: 'Ensayo aleatorizado', solidez: 'media' },
  { tema: 'progresion_carrera', afirmacion: 'Subir más de un 30 % la distancia semanal se asoció a más lesiones de algunos tipos.', autores: 'Nielsen RO, Parner ET, Nohr EA, et al.', año: 2014, titulo: 'Excessive Progression in Weekly Running Distance and Risk of Running-Related Injuries: An Association Which Varies According to Type of Injury', revista: 'J Orthop Sports Phys Ther 44(10):739-747', doi: '10.2519/jospt.2014.5164', tipo: 'Estudio de cohortes', solidez: 'media' },
  { tema: 'rir', afirmacion: 'Las repeticiones en reserva (RIR) son una forma válida de medir el esfuerzo en fuerza.', autores: 'Zourdos MC, Klemp A, Dolan C, et al.', año: 2016, titulo: 'Novel Resistance Training-Specific Rating of Perceived Exertion Scale Measuring Repetitions in Reserve', revista: 'J Strength Cond Res 30:267-275', doi: '10.1519/JSC.0000000000001049', tipo: 'Estudio de validación', solidez: 'media' },
  { tema: 'descanso', afirmacion: 'Para ganar fuerza máxima, descansos de más de 2 minutos entre series suelen ir mejor que los muy cortos.', autores: 'Grgic J, Schoenfeld BJ, Skrepnik M, et al.', año: 2018, titulo: 'Effects of Rest Interval Duration in Resistance Training on Measures of Muscular Strength: A Systematic Review', revista: 'Sports Med 48:137-151', doi: '10.1007/s40279-017-0788-x', tipo: 'Revisión sistemática', solidez: 'media' },
  { tema: 'dolor', afirmacion: 'Seguir con el deporte controlando el dolor (que no pase de un umbral y se calme al día siguiente) fue igual de eficaz que parar en tendinopatía aquílea.', autores: 'Silbernagel KG, Thomeé R, Eriksson BI, Karlsson J', año: 2007, titulo: 'Continued Sports Activity, Using a Pain-Monitoring Model, during Rehabilitation in Patients with Achilles Tendinopathy: A Randomized Controlled Study', revista: 'Am J Sports Med 35(6):897-906', doi: '10.1177/0363546506298279', tipo: 'Ensayo aleatorizado', solidez: 'media' },
  { tema: 'carga', afirmacion: 'Esfuerzo de la sesión (RPE) por minutos es una forma sencilla y útil de medir la carga de entrenamiento.', autores: 'Foster C, Florhaug JA, Franklin J, et al.', año: 2001, titulo: 'A New Approach to Monitoring Exercise Training', revista: 'J Strength Cond Res 15(1):109-115', doi: '10.1519/00124278-200102000-00019', tipo: 'Estudio de validación', solidez: 'media' },
  { tema: 'concurrente', afirmacion: 'Combinar resistencia y fuerza puede restar algo de ganancia de fuerza y potencia, sobre todo con mucha carrera; el ciclismo interfiere menos.', autores: 'Wilson JM, Marin PJ, Rhea MR, et al.', año: 2012, titulo: 'Concurrent Training: A Meta-Analysis Examining Interference of Aerobic and Resistance Exercises', revista: 'J Strength Cond Res 26(8):2293-2307', doi: '10.1519/JSC.0b013e31823a3e2d', tipo: 'Metaanálisis', solidez: 'media' },
  { tema: 'descarga', afirmacion: 'Reducir el volumen manteniendo la intensidad antes de competir mejora el rendimiento.', autores: 'Bosquet L, Montpetit J, Arvisais D, Mujika I', año: 2007, titulo: 'Effects of Tapering on Performance: A Meta-Analysis', revista: 'Med Sci Sports Exerc 39(8):1358-1365', doi: '10.1249/mss.0b013e31806010e0', tipo: 'Metaanálisis', solidez: 'alta' },
  { tema: 'postura', afirmacion: 'La relación entre las curvas de la columna y la salud o el dolor es débil e inconsistente.', autores: 'Christensen ST, Hartvigsen J', año: 2008, titulo: 'Spinal Curves and Health: A Systematic Critical Review of the Epidemiological Literature Dealing With Associations Between Sagittal Spinal Curves and Health', revista: 'J Manipulative Physiol Ther 31(9):690-714', doi: '10.1016/j.jmpt.2008.10.004', tipo: 'Revisión sistemática', solidez: 'media' },
  { tema: 'intensidad', afirmacion: 'En resistencia, la mayor parte del entrenamiento suele hacerse a intensidad baja, con poca a intensidad alta.', autores: 'Seiler S', año: 2010, titulo: 'What is Best Practice for Training Intensity and Duration Distribution in Endurance Athletes?', revista: 'Int J Sports Physiol Perform 5(3):276-291', doi: '10.1123/ijspp.5.3.276', tipo: 'Revisión', solidez: 'media' },
  { tema: 'isquios', afirmacion: 'El ejercicio nórdico de isquios redujo las lesiones de isquios en futbolistas aficionados.', autores: 'van der Horst N, Smits DW, Petersen J, et al.', año: 2015, titulo: 'The Preventive Effect of the Nordic Hamstring Exercise on Hamstring Injuries in Amateur Soccer Players: A Randomized Controlled Trial', revista: 'Am J Sports Med 43:1316-1323', doi: '10.1177/0363546515574057', tipo: 'Ensayo aleatorizado', solidez: 'alta' },
  { tema: 'rodilla', afirmacion: 'Trabajar cadera y glúteo (además de la rodilla) es eficaz para el dolor femoropatelar.', autores: 'Lack S, Barton C, Sohan O, et al.', año: 2015, titulo: 'Proximal muscle rehabilitation is effective for patellofemoral pain: a systematic review with meta-analysis', revista: 'Br J Sports Med 49:1365-1376', doi: '10.1136/bjsports-2015-094723', tipo: 'Metaanálisis', solidez: 'alta' },
];

// ------------------------------------------------------------------ fechas (puras, se prueban en node)

function entAt_(ymd, hm) { const d = String(ymd).split('-').map(Number), t = String(hm || '00:00').split(':').map(Number); return new Date(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0).getTime(); }
function entYmd_(t) { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function entHm_(t) { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function entAddDays_(ymd, n) { const d = String(ymd).split('-').map(Number); return entYmd_(new Date(d[0], d[1] - 1, d[2] + n, 12).getTime()); }
function entDow_(ymd) { const d = String(ymd).split('-').map(Number); return new Date(d[0], d[1] - 1, d[2], 12).getDay(); }
function entMonday_(ymd) { const w = entDow_(ymd); return entAddDays_(ymd, -((w + 6) % 7)); }

// ------------------------------------------------------------------ prescripción

/** Semana dentro del bloque (1-4) y número de bloque (1, 2, …) para un lunes. */
function blockWeek_(monday, startMonday) {
  const weeks = Math.max(0, Math.round((entAt_(monday, '12:00') - entAt_(startMonday, '12:00')) / (7 * 86400000)));
  return { semana: weeks % ENT.BLOCK_WEEKS + 1, bloque: Math.floor(weeks / ENT.BLOCK_WEEKS) + 1 };
}

/** Series, repeticiones, RIR y descanso de cada ejercicio según la semana del bloque. La 4.ª es de descarga. */
function prescribe_(key, w, version) {
  const s = ENT_SESSIONS[key];
  if (!s.ej) return null;
  const list = version === 'casa' ? ENT_CASA[key] : version === 'corta' ? ENT_CORTA[key] : s.ej.map(e => e.id);
  const byId = {};
  s.ej.forEach(e => { byId[e.id] = e; });
  const deload = w.semana === 4;
  // pliometría: se cuenta por contactos y sube poco a poco (40 → 60 en el primer bloque), con descarga en la 4.ª
  const contacts = Math.min(100, [40, 50, 60, 30][w.semana - 1] + 10 * (w.bloque - 1));
  const main = [{ series: 3, reps: 10, rir: 3 }, { series: 3, reps: 8, rir: 2 }, { series: 4, reps: 8, rir: 2 }, { series: 2, reps: 8, rir: 4 }][w.semana - 1];
  return list.map(id => {
    const e = byId[id] || { id, t: /flexiones|remo_banda/.test(id) ? 'fuerza' : /dead_bug|plancha/.test(id) ? 'core' : /pogo|saltos/.test(id) ? 'plio' : 'acc', reps: 10 };
    if (e.t === 'plio') {
      // los contactos de la sesión se reparten entre sus ejercicios de salto
      const throwing = /lanzamiento/.test(id);
      const share = list.filter(x => (byId[x] || {}).t === 'plio').length || 1;
      const total = Math.round(contacts / share);
      return { id, t: 'plio', series: deload ? 2 : 3, reps: Math.max(4, Math.round(total / 3)), contactos: total, descanso: 60, nota: throwing ? 'lanzamientos por lado contra el frontón' : 'contactos suaves, aterriza en silencio' };
    }
    // los básicos (8 reps de serie) siguen la progresión del bloque; el resto mantiene sus repeticiones
    if (e.t === 'fuerza') return { id, t: 'fuerza', series: main.series, reps: e.reps === 8 ? main.reps : e.reps, rir: main.rir, descanso: 120, lado: !!e.lado };
    if (e.t === 'core') return { id, t: 'core', series: deload ? 1 : 2, reps: e.reps, seg: !!e.seg, rir: 3, descanso: 45, lado: !!e.lado };
    return { id, t: 'acc', series: deload ? 1 : 2, reps: e.reps, rir: 3, descanso: 60, lado: !!e.lado };
  });
}

/** Minutos de las sesiones de resistencia: suben despacio de bloque en bloque y bajan en la semana de descarga. */
function cardioMinutes_(key, w) {
  const base = { CS: [35, 40, 45, 30], CL: [60, 65, 70, 45], BI: [60, 75, 90, 50], NA: [30, 35, 40, 25] }[key];
  if (!base) return ENT_SESSIONS[key].min;
  const step = { CS: 5, CL: 5, BI: 10, NA: 5 }[key], cap = { CS: 60, CL: 100, BI: 150, NA: 60 }[key];
  return Math.min(cap, base[w.semana - 1] + step * (w.bloque - 1));
}

/** Peso sugerido: doble progresión. Si en la última sesión hiciste todas las reps con el RIR pedido o más, sube. */
function suggestKg_(ejercicio, target, history) {
  const last = history.filter(h => h.ejercicio === ejercicio);
  if (!last.length) return { kg: '', texto: 'Primera vez: elige un peso con el que te sobren ' + target.rir + ' repeticiones.' };
  const lastDay = last.reduce((a, h) => (+new Date(h.fecha) > +new Date(a) ? h.fecha : a), last[0].fecha);
  const sets = last.filter(h => entYmd_(+new Date(h.fecha)) === entYmd_(+new Date(lastDay)));
  const kg = Math.max.apply(null, sets.map(h => Number(h.kg) || 0));
  const allReps = sets.length >= Math.min(2, target.series) && sets.every(h => Number(h.reps) >= target.reps && (h.rir === '' || h.rir == null || Number(h.rir) >= target.rir));
  if (!kg) return { kg: '', texto: 'Última vez: ' + sets.map(h => h.reps).join(', ') + ' reps' };
  const step = kg >= 20 ? 2.5 : kg >= 8 ? 2 : 1;
  return allReps
    ? { kg: kg + step, texto: 'La última vez te sobró: sube a ' + (kg + step) + ' kg (' + sets.length + ' series a ' + kg + ' kg).' }
    : { kg, texto: 'Repite ' + kg + ' kg hasta completar todas las repeticiones con el RIR pedido.' };
}

// ------------------------------------------------------------------ reparto de la semana (puro)

/**
 * Coloca las sesiones en los días y horas libres. Puro: no toca el calendario, así se prueba en node.
 * ctx: { days: ['2026-11-02', …], now, busy: [[s, e], …], light: { ymd: [amanecer, puesta] }, weather: { 'ymdTHH': { t, p } },
 *        fixedHard: { ymd: true } (días con partido o competición), placed: [{ key, date }] (ya hechas o fijas esta semana) }
 * items: [{ key, min, lugar }] en orden de prioridad.
 * Devuelve { placed: [{ key, date, start, end }], missing: [key] }.
 */
function layoutWeek_(items, ctx) {
  const placed = (ctx.placed || []).slice();
  const out = [], missing = [];
  const busy = ctx.busy.slice();
  const strength = k => /^F/.test(k);
  const legs = k => k === 'FA' || k === 'FC';
  items.forEach(it => {
    const scored = ctx.days.map(day => {
      const dow = entDow_(day);
      let pen = Math.abs(((dow - ENT_IDEAL[it.key] + 7) % 7) > 3 ? 7 - ((dow - ENT_IDEAL[it.key] + 7) % 7) : (dow - ENT_IDEAL[it.key] + 7) % 7) * 1.5;
      const same = placed.filter(p => p.date === day);
      if (same.length >= 2) return null;
      if (same.length) pen += 40;
      const prev = placed.filter(p => p.date === entAddDays_(day, -1)), next = placed.filter(p => p.date === entAddDays_(day, 1));
      // nada de pierna pesada el día antes de la tirada larga, un partido o una competición
      if (legs(it.key) && (next.some(p => p.key === 'CL') || (ctx.fixedHard || {})[entAddDays_(day, 1)])) return null;
      if (it.key === 'CL' && prev.some(p => legs(p.key))) return null;
      if (strength(it.key) && (prev.concat(next)).some(p => strength(p.key))) pen += 12;
      if (it.key === 'CL' && dow !== 0 && dow !== 6) pen += 8;
      if (it.key === 'BI' && dow !== 0 && dow !== 6) pen += 5;
      return { day, pen };
    }).filter(Boolean).sort((a, b) => a.pen - b.pen);
    let done = null;
    for (const c of scored) {
      done = findTime_(it, c.day, ctx, busy);
      if (done) break;
    }
    if (!done) { missing.push(it.key); return; }
    placed.push({ key: it.key, date: done.date });
    busy.push([done.start, done.end]);
    out.push(Object.assign({ key: it.key }, done));
  });
  return { placed: out, missing };
}

/** Primera hora libre del día para una sesión, según sus ventanas (y la luz y el tiempo para la bici). */
function findTime_(it, day, ctx, busy) {
  const dow = entDow_(day);
  const travel = it.lugar === 'gym' ? ENT.GYM_TRAVEL : it.lugar === 'piscina' ? ENT.SWIM_TRAVEL : 0;
  const len = (it.min + 2 * travel) * 60000;
  const w = ENT_WINDOWS[it.lugar];
  let wins = dow === 0 && w.D ? w.D : (dow === 0 || dow === 6) ? (w.FS || []) : (w.LV || []);
  if (it.lugar === 'piscina' && dow === 6) wins = [];
  const earliest = Math.max(ctx.now + 60 * 60000, it.lugar === 'piscina' ? ctx.now + ENT.SWIM_BOOK_H * 3600000 : 0);
  for (const [a, b] of wins) {
    let lo = entAt_(day, a), hi = entAt_(day, b);
    if (it.lugar === 'bici' && ctx.light && ctx.light[day]) { lo = Math.max(lo, ctx.light[day][0] + 15 * 60000); hi = Math.min(hi, ctx.light[day][1] - 15 * 60000); }
    for (let s = Math.ceil(Math.max(lo, earliest) / (ENT.STEP * 60000)) * ENT.STEP * 60000; s + len <= hi; s += ENT.STEP * 60000) {
      const e = s + len;
      if (busy.some(([x, y]) => x < e && y > s)) continue;
      if (it.lugar === 'bici' && !bikeWeatherOk_(s, e, ctx.weather)) continue;
      return { date: day, start: s, end: e };
    }
  }
  return null;
}

/** Bici fuera solo sin lluvia y a 10 °C o más (si no hay previsión para ese día, se da por buena y se revisa luego). */
function bikeWeatherOk_(s, e, weather) {
  if (!weather) return true;
  for (let t = Math.floor(s / 3600000) * 3600000; t < e; t += 3600000) {
    const h = weather[entYmd_(t) + 'T' + entHm_(t).slice(0, 2)];
    if (!h) continue;
    if (h.t < ENT.BIKE_MIN_TEMP || h.p > ENT.BIKE_MAX_RAIN) return false;
  }
  return true;
}

// ------------------------------------------------------------------ planificar en el calendario

function isEntreno_(ev) { return (ev.getDescription() || '').indexOf(ENT.TAG) >= 0; }

/** Huecos ocupados (todo lo que no es del entrenador) y días con partido o competición. */
function calendarBusy_(from, to) {
  const evs = cal_().getEvents(new Date(from), new Date(to));
  const busy = [], fixedHard = {};
  evs.forEach(ev => {
    if (/partido|competici|torneo|carrera popular|triatl/i.test(ev.getTitle())) fixedHard[ymd_(ev.isAllDayEvent() ? ev.getAllDayStartDate() : ev.getStartTime())] = true;
    if (ev.isAllDayEvent() || isEntreno_(ev)) return;
    busy.push([+ev.getStartTime(), +ev.getEndTime()]);
  });
  return { busy, fixedHard };
}

/** Amanecer, puesta, temperatura y probabilidad de lluvia por horas en tu ciudad (Open-Meteo, gratis). Se guarda 3 h. */
function entWeather_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('entWx');
  if (hit) return JSON.parse(hit);
  const out = { light: {}, weather: {} };
  const home = miPerfil_().home;
  try {
    const r = UrlFetchApp.fetch('https://api.open-meteo.com/v1/forecast?latitude=' + home.lat + '&longitude=' + home.lon +
      '&timezone=Europe%2FMadrid&forecast_days=14&hourly=temperature_2m,precipitation_probability&daily=sunrise,sunset', { muteHttpExceptions: true });
    const f = JSON.parse(r.getContentText());
    f.daily.time.forEach((d, i) => { out.light[d] = [entAt_(d, f.daily.sunrise[i].slice(11)), entAt_(d, f.daily.sunset[i].slice(11))]; });
    f.hourly.time.forEach((t, i) => { out.weather[t.slice(0, 13)] = { t: f.hourly.temperature_2m[i], p: f.hourly.precipitation_probability[i] == null ? 0 : f.hourly.precipitation_probability[i] }; });
    cache.put('entWx', JSON.stringify(out), 10800);
  } catch (err) { console.error('Open-Meteo: ' + err); }
  return out;
}

/**
 * Planifica la semana del día "when" (si es la actual, solo desde mañana… o desde ahora si hay hueco hoy).
 * mode: normal | corto | mantenimiento. Las sesiones que ya están hechas o planificadas en el futuro se respetan.
 */
function planWeek_(when, mode, origen) {
  mode = mode || perfil_().modo || 'normal';
  const now = Date.now();
  const monday = entMonday_(ymd_(new Date(when)));
  const sunday = entAddDays_(monday, 6);
  const pf = perfil_();
  const w = blockWeek_(monday, pf.bloque_inicio || monday);
  const existing = entRows_('Plan').filter(r => String(r.semana) === monday && ['planificada', 'hecha', 'a medias', 'reservar'].indexOf(String(r.estado)) >= 0);
  const have = {};
  existing.forEach(r => { have[String(r.clave)] = true; });
  // alterna bici y natación cada semana
  const weekNo = Math.round(entAt_(monday, '12:00') / (7 * 86400000));
  const keys = ENT_MODES[mode].map(k => k === 'BI|NA' ? (weekNo % 2 ? 'NA' : 'BI') : k).filter(k => !have[k]);
  const version = mode === 'normal' ? 'gym' : 'corta';
  const items = keys.map(k => ({ key: k, lugar: ENT_SESSIONS[k].lugar, min: ENT_SESSIONS[k].ej ? (version === 'corta' ? 30 : ENT_SESSIONS[k].min - (w.semana === 4 ? 15 : 0)) : cardioMinutes_(k, w) }));
  const days = [];
  for (let d = monday; d <= sunday; d = entAddDays_(d, 1)) if (entAt_(d, '23:59') > now) days.push(d);
  const cb = calendarBusy_(entAt_(monday, '00:00'), entAt_(entAddDays_(sunday, 1), '00:00'));
  const wx = entWeather_();
  const res = layoutWeek_(items, { days, now, busy: cb.busy, fixedHard: cb.fixedHard, light: wx.light, weather: wx.weather,
    placed: existing.map(r => ({ key: String(r.clave), date: String(r.fecha) })) });
  const undo = [];
  res.placed.forEach(p => {
    const it = items.find(i => i.key === p.key);
    undo.push(createSession_(monday, p, it, version, mode, origen || 'semanal'));
  });
  // la bici que no cabe con buen tiempo pasa a carrera suave; lo clave que no cabe, te lo pregunto
  res.missing.forEach(k => {
    if (k === 'BI' && !have.CS) {
      const alt = layoutWeek_([{ key: 'CS', lugar: 'calle', min: cardioMinutes_('CS', w) }], { days, now, busy: cb.busy.concat(res.placed.map(p => [p.start, p.end])), light: wx.light, weather: wx.weather, placed: res.placed.map(p => ({ key: p.key, date: p.date })) });
      if (alt.placed.length) { undo.push(createSession_(monday, alt.placed[0], { key: 'CS', min: cardioMinutes_('CS', w), lugar: 'calle' }, version, mode, 'bici→carrera por el tiempo')); return; }
    }
    if (ENT_SESSIONS[k].prio === 'clave') askNoRoom_(k, monday, mode);
    else entAppend_('Plan', { id: newId_('p'), semana: monday, fecha: '', clave: k, tipo: ENT_SESSIONS[k].tipo, titulo: ENT_SESSIONS[k].titulo, prioridad: ENT_SESSIONS[k].prio, minutos: '', lugar: ENT_SESSIONS[k].lugar, version, estado: 'sin hueco', origen: origen || 'semanal' });
  });
  return { placed: res.placed.length, missing: res.missing, semana: w, undo: [].concat.apply([], undo) };
}

function createSession_(monday, p, it, version, mode, origen) {
  const s = ENT_SESSIONS[p.key];
  const id = newId_('p');
  const v = s.ej ? version : s.lugar;
  const ev = create_({ title: s.icono + ' ' + s.titulo + (s.ej && v === 'corta' ? ' (corta)' : s.ej && v === 'casa' ? ' (casa)' : ''), color: ENT.COLOR, allDay: false, start: p.start, end: p.end,
    desc: sessionDesc_(p.key, it.min, v) + '\n\n' + ENT.TAG + ' · ' + id });
  try { ev.addPopupReminder(30); } catch (err) {}
  entAppend_('Plan', { id, semana: monday, fecha: p.date, inicio: entHm_(p.start), fin: entHm_(p.end), clave: p.key, tipo: s.tipo, titulo: s.titulo,
    prioridad: s.prio, minutos: it.min, lugar: s.lugar, version: v, estado: s.lugar === 'piscina' ? 'reservar' : 'planificada', evento: ev.getId(), origen });
  return [{ op: 'delete', id: ev.getId() }, { op: 'entplan', id }];
}

function sessionDesc_(key, min, version) {
  const s = ENT_SESSIONS[key];
  if (!s.ej) return {
    carrera: s.larga ? min + ' min a ritmo cómodo (puedes hablar). Si algo molesta más de 3 de 10, corta y avisa en la app.' : min + ' min suaves, ritmo conversacional.',
    bici: min + ' min suaves. Solo si no llueve y hace 10 °C o más; si no, cámbialo en la app.',
    natacion: min + ' min de técnica. Reserva con 48 h de antelación.',
  }[s.tipo];
  return (version === 'corta' ? 'Versión corta, ~30 min. ' : version === 'casa' ? 'En casa, ~25 min. ' : '~' + min + ' min. ') + 'Calentamiento, pliometría al principio, fuerza, accesorios y core. Ábrela en la app para ver series y pesos.';
}

/** Una sesión clave sin hueco: te pregunta (en la app y por Telegram) si entrenar igual encima de un bloque de estudio. */
function askNoRoom_(key, monday, mode) {
  const s = ENT_SESSIONS[key];
  const id = newId_('b');
  entAppend_('Buzon', { id, fecha: new Date(), de: 'entrenador', tipo: 'sin_hueco', detalle: s.titulo + ': no hay hueco libre esta semana sin tocar el estudio.', estado: 'pregunta',
    opciones: 'Mantener estudio|Entrenar igual|Versión corta en casa', contexto: JSON.stringify({ key, monday, mode }) });
  notify_('⚠️ <b>' + esc_(s.titulo) + '</b> no cabe esta semana sin tocar el estudio. Decide en la app qué hacemos.');
}

// ------------------------------------------------------------------ acciones (desde la app o el chat)

function planRow_(id) { return entRows_('Plan').find(r => String(r.id) === String(id)); }

/** "Hoy no puedo": la quita y, si es clave, la recoloca esta semana. */
function cantDo_(id) {
  const r = planRow_(id);
  if (!r) throw new Error('No encuentro esa sesión.');
  const undo = [];
  const ev = r.evento ? cal_().getEventById(String(r.evento)) : null;
  if (ev) { undo.push({ op: 'restore', s: snap_(ev) }); ev.deleteEvent(); }
  undo.push({ op: 'entrow', id: r.id, estado: r.estado, evento: r.evento, fecha: r.fecha, inicio: r.inicio, fin: r.fin });
  entUpdate_('Plan', r, { estado: 'no hecha', evento: '' });
  let msg = 'Quitada: ' + r.titulo + '.';
  if (r.prioridad === 'clave' || r.prioridad === 'normal') {
    const moved = relocate_(r, entAddDays_(ymd_(new Date()), 1));
    if (moved) { undo.push.apply(undo, moved.undo); msg += ' La he pasado al ' + dayName_(new Date(moved.start)) + ' a las ' + entHm_(moved.start) + '.'; }
    else msg += r.prioridad === 'clave' ? ' No hay otro hueco libre esta semana; la semana que viene lo tengo en cuenta.' : ' Esta semana no la recoloco: no pasa nada por saltarse una.';
  }
  return { msg, undo: saveEntUndo_(undo) };
}

/** Recoloca una sesión desde "fromDay" hasta el domingo, respetando las reglas. Crea una fila nueva. */
function relocate_(r, fromDay, onlyDay, hm) {
  const monday = String(r.semana), sunday = entAddDays_(monday, 6);
  const days = [];
  for (let d = fromDay; d <= sunday; d = entAddDays_(d, 1)) if (!onlyDay || d === onlyDay) days.push(d);
  if (!days.length) return null;
  const cb = calendarBusy_(entAt_(days[0], '00:00'), entAt_(entAddDays_(sunday, 1), '00:00'));
  const wx = entWeather_();
  const others = entRows_('Plan').filter(x => String(x.semana) === monday && String(x.id) !== String(r.id) && ['planificada', 'hecha', 'a medias', 'reservar'].indexOf(String(x.estado)) >= 0);
  const it = { key: String(r.clave), lugar: String(r.version) === 'casa' ? 'casa' : ENT_SESSIONS[r.clave].lugar, min: Number(r.minutos) || ENT_SESSIONS[r.clave].min };
  let p;
  if (hm) {
    const s = entAt_(onlyDay, hm), travel = it.lugar === 'gym' ? ENT.GYM_TRAVEL : it.lugar === 'piscina' ? ENT.SWIM_TRAVEL : 0;
    p = { date: onlyDay, start: s, end: s + (it.min + 2 * travel) * 60000 };
    if (cb.busy.some(([a, b]) => a < p.end && b > p.start)) throw new Error('A esa hora ya tienes algo en el calendario.');
  } else {
    const res = layoutWeek_([it], { days, now: Date.now(), busy: cb.busy, fixedHard: cb.fixedHard, light: wx.light, weather: wx.weather, placed: others.map(x => ({ key: String(x.clave), date: String(x.fecha) })) });
    p = res.placed[0];
  }
  if (!p) return null;
  const undo = createSession_(monday, p, it, String(r.version), perfil_().modo, 'recolocada');
  return { start: p.start, undo };
}

/** Mover a otro día (y hora, si la dices). */
function moveSession_(id, day, hm) {
  const r = planRow_(id);
  if (!r) throw new Error('No encuentro esa sesión.');
  if (day < String(r.semana) || day > entAddDays_(String(r.semana), 6)) throw new Error('Solo puedo moverla dentro de su semana.');
  const ev = r.evento ? cal_().getEventById(String(r.evento)) : null;
  const undo = [];
  const snap = ev ? snap_(ev) : null;
  if (ev) ev.deleteEvent();
  let moved = null;
  try { moved = relocate_(r, day, day, hm); } catch (err) { if (snap) entUpdate_('Plan', r, { evento: create_(snap).getId() }); throw err; }
  if (!moved) { if (snap) entUpdate_('Plan', r, { evento: create_(snap).getId() }); throw new Error('Ese día no hay hueco libre para ' + r.titulo + '.'); }
  if (snap) undo.push({ op: 'restore', s: snap });
  undo.push({ op: 'entrow', id: r.id, estado: r.estado, evento: r.evento });
  undo.push.apply(undo, moved.undo);
  entUpdate_('Plan', r, { estado: 'cambiada', evento: '' });
  return { msg: r.titulo + ' pasa al ' + dayName_(new Date(moved.start)) + ' a las ' + entHm_(moved.start) + '.', undo: saveEntUndo_(undo) };
}

/** La bici con lluvia o frío pasa a carrera suave, el mismo día y a la misma hora. */
function swapToRun_(id) {
  const r = planRow_(id);
  if (!r || String(r.clave) !== 'BI') throw new Error('Solo se puede cambiar la bici por carrera.');
  const w = blockWeek_(String(r.semana), perfil_().bloque_inicio || String(r.semana));
  const min = cardioMinutes_('CS', w);
  const undo = [];
  const ev = r.evento ? cal_().getEventById(String(r.evento)) : null;
  if (ev) { undo.push({ op: 'restore', s: snap_(ev) }); ev.deleteEvent(); }
  undo.push({ op: 'entrow', id: r.id, estado: r.estado, evento: r.evento });
  entUpdate_('Plan', r, { estado: 'cambiada', evento: '' });
  const start = entAt_(String(r.fecha), String(r.inicio));
  undo.push.apply(undo, createSession_(String(r.semana), { key: 'CS', date: String(r.fecha), start, end: start + min * 60000 }, { key: 'CS', min, lugar: 'calle' }, 'calle', perfil_().modo, 'bici→carrera'));
  return { msg: 'Cambiada por ' + ENT_SESSIONS.CS.titulo.toLowerCase() + ' de ' + min + ' min a las ' + r.inicio + '.', undo: saveEntUndo_(undo) };
}

/** Cambia el modo de lo que queda de semana (y lo guarda para las siguientes si es "normal"). */
function setMode_(mode) {
  if (!ENT_MODES[mode]) throw new Error('Modo desconocido.');
  const today = ymd_(new Date()), monday = entMonday_(today);
  const undo = [];
  entRows_('Plan').filter(r => String(r.semana) === monday && String(r.fecha) >= today && ['planificada', 'reservar', 'sin hueco'].indexOf(String(r.estado)) >= 0 && +entAt_(String(r.fecha) || today, String(r.inicio) || '23:59') > Date.now())
    .forEach(r => {
      const ev = r.evento ? cal_().getEventById(String(r.evento)) : null;
      if (ev) { undo.push({ op: 'restore', s: snap_(ev) }); ev.deleteEvent(); }
      undo.push({ op: 'entrow', id: r.id, estado: r.estado, evento: r.evento });
      entUpdate_('Plan', r, { estado: 'replanificada', evento: '' });
    });
  setPerfil_('modo', mode);
  const res = planWeek_(new Date(), mode, 'modo ' + mode);
  undo.push.apply(undo, res.undo);
  const txt = { normal: 'Semana normal', corto: 'Semana con poco tiempo: lo esencial y en versión corta', mantenimiento: 'Semana de mantenimiento: dos sesiones cortas para no perder lo ganado' }[mode];
  return { msg: txt + '. He colocado ' + res.placed + ' sesión(es)' + (res.missing.length ? ' y ' + res.missing.length + ' no caben.' : '.'), undo: saveEntUndo_(undo) };
}

/** Respuesta a una pregunta del buzón (p. ej. sesión clave sin hueco). */
function answerBox_(id, i) {
  const b = entRows_('Buzon').find(x => String(x.id) === String(id));
  if (!b || b.estado !== 'pregunta') return { msg: 'Esa pregunta ya está respondida.' };
  const opt = String(b.opciones).split('|')[i];
  entUpdate_('Buzon', b, { estado: 'respondida: ' + opt });
  if (b.tipo !== 'sin_hueco') return { msg: 'Apuntado.' };
  const c = JSON.parse(b.contexto || '{}');
  if (i === 0) return { msg: 'Vale, el estudio manda. La semana que viene le doy prioridad.' };
  const w = blockWeek_(c.monday, perfil_().bloque_inicio || c.monday);
  const s = ENT_SESSIONS[c.key];
  const days = [];
  for (let d = entAddDays_(ymd_(new Date()), 1); d <= entAddDays_(c.monday, 6); d = entAddDays_(d, 1)) days.push(d);
  if (i === 2) {
    // en casa y corta: cabe en casi cualquier hueco de 30 min
    const cb = calendarBusy_(entAt_(days[0] || ymd_(new Date()), '00:00'), entAt_(entAddDays_(c.monday, 7), '00:00'));
    const res = layoutWeek_([{ key: c.key, lugar: 'casa', min: 25 }], { days, now: Date.now(), busy: cb.busy, fixedHard: cb.fixedHard });
    if (!res.placed.length) return { msg: 'Ni en versión corta cabe esta semana. Lo tengo en cuenta para la siguiente.' };
    return { msg: s.titulo + ' en casa, el ' + dayName_(new Date(res.placed[0].start)) + ' a las ' + entHm_(res.placed[0].start) + '.', undo: saveEntUndo_(createSession_(c.monday, res.placed[0], { key: c.key, min: 25, lugar: 'casa' }, 'casa', c.mode, 'sin hueco → casa')) };
  }
  // "Entrenar igual": se busca un hueco donde solo haya bloques azules del planificador, que se recortan
  const all = cal_().getEvents(new Date(entAt_(days[0], '00:00')), new Date(entAt_(entAddDays_(c.monday, 7), '00:00'))).filter(ev => !ev.isAllDayEvent());
  const hard = all.filter(ev => !isEntreno_(ev) && !((ev.getDescription() || '').indexOf(PLANNER_TAG) >= 0 && (ev.getDescription() || '').indexOf(BOT_TAG) < 0 && !isPracticas_(ev))).map(ev => [+ev.getStartTime(), +ev.getEndTime()]);
  const min = ENT_SESSIONS[c.key].ej ? s.min : cardioMinutes_(c.key, w);
  const res = layoutWeek_([{ key: c.key, lugar: s.lugar, min }], { days, now: Date.now(), busy: hard });
  if (!res.placed.length) return { msg: 'No hay ningún hueco esta semana que no sea de clases, exámenes o prácticas.' };
  const p = res.placed[0];
  const out = { undo: [] };
  const cleared = clearPlanner_(new Date(p.start), new Date(p.end), out);
  out.undo.push.apply(out.undo, createSession_(c.monday, p, { key: c.key, min, lugar: s.lugar }, 'gym', c.mode, 'entrenar igual'));
  note_('no_disponible', '', (perfil_().nombre || 'El usuario') + ' entrena el ' + dayName_(new Date(p.start)) + ' de ' + range_(new Date(p.start), new Date(p.end)) + ' (' + s.titulo + '). Recoloca el estudio que se ha quitado.', out.undo);
  return { msg: s.titulo + ' el ' + dayName_(new Date(p.start)) + ' a las ' + entHm_(p.start) + '. ' + clearedText_(cleared), undo: saveEntUndo_(out.undo) };
}

function closeSession_(id, estado, rpe, dolor, nota) {
  const r = planRow_(id);
  if (!r) throw new Error('No encuentro esa sesión.');
  entUpdate_('Plan', r, { estado, cierre: JSON.stringify({ rpe: Number(rpe) || '', dolor: dolor === '' || dolor == null ? '' : Number(dolor), nota: nota || '', at: Date.now() }) });
  let msg = estado === 'hecha' ? '¡Hecha! ' : estado === 'a medias' ? 'Apuntada a medias. ' : 'Apuntado. ';
  if (Number(dolor) >= 4) msg += 'Molestia de ' + dolor + '/10: la próxima sesión de impacto la bajo y te propongo bici o natación. Si dura más de un día o va a más, que te lo mire un profesional.';
  else if (Number(rpe) >= 9 && r.prioridad !== 'clave') msg += 'Esfuerzo muy alto: la siguiente la hago algo más suave.';
  if (Number(dolor) >= 4) setPerfil_('dolor_alerta', ymd_(new Date()));
  return { msg };
}

function logSet_(sesion, ejercicio, serie, kg, reps, rir) {
  const prev = entRows_('Series').find(x => String(x.sesion) === String(sesion) && String(x.ejercicio) === ejercicio && Number(x.serie) === Number(serie));
  const o = { fecha: new Date(), kg: kg === '' ? '' : Number(kg), reps: reps === '' ? '' : Number(reps), rir: rir === '' || rir == null ? '' : Number(rir) };
  if (prev) entUpdate_('Series', prev, o);
  else entAppend_('Series', Object.assign({ id: newId_('s'), sesion, ejercicio, serie: Number(serie) }, o));
  return { ok: true };
}

/** Deshacer: lo del calendario lo hace undo_ de la agenda; lo de la hoja del entrenador, aquí. */
function saveEntUndo_(ops) { return saveUndo_(ops.filter(o => ['delete', 'restore', 'update', 'ajuste'].indexOf(o.op) >= 0).concat([{ op: 'ent', ops: ops.filter(o => /^ent/.test(o.op)) }])); }
function entUndo_(id) {
  const raw = CacheService.getScriptCache().get('undo' + id);
  if (!raw) return { msg: 'Ya no se puede deshacer (han pasado más de 6 horas).' };
  const ent = (JSON.parse(raw).find(o => o.op === 'ent') || { ops: [] }).ops;
  undo_(id);
  ent.reverse().forEach(o => {
    const r = entRows_('Plan').find(x => String(x.id) === String(o.id)); // se relee: borrar filas mueve las demás
    if (!r) return;
    if (o.op === 'entplan') entTab_('Plan').deleteRow(r._row);
    if (o.op === 'entrow') {
      entUpdate_('Plan', r, { estado: o.estado, evento: '' });
      // el evento se ha vuelto a crear con otro id: se busca por la marca
      const ev = cal_().getEvents(new Date(Date.now() - 7 * DAY), new Date(Date.now() + 14 * DAY)).find(e => (e.getDescription() || '').indexOf(ENT.TAG + ' · ' + r.id) >= 0);
      if (ev) entUpdate_('Plan', r, { evento: ev.getId() });
    }
  });
  return { msg: 'Deshecho.' };
}

// ------------------------------------------------------------------ lo que hace solo

/** Cada 30 min: recoloca lo que pisa el estudio, importa actividades y pregunta por las sesiones acabadas. */
function entrenoTick() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    fixClashes_();
    try { importIntervals_(); } catch (err) { console.error('intervals.icu: ' + err); }
    askFinished_();
  } finally { lock.releaseLock(); }
}

/** Si la agenda (o tú) ha puesto algo encima de un entreno, el entreno cede y se busca otro hueco. */
function fixClashes_() {
  const now = Date.now();
  const rows = entRows_('Plan').filter(r => ['planificada', 'reservar'].indexOf(String(r.estado)) >= 0 && r.evento && entAt_(String(r.fecha), String(r.inicio)) > now);
  if (!rows.length) return;
  const cb = calendarBusy_(now, now + 8 * DAY);
  rows.forEach(r => {
    const s = entAt_(String(r.fecha), String(r.inicio)), e = entAt_(String(r.fecha), String(r.fin));
    if (!cb.busy.some(([a, b]) => a < e && b > s)) return;
    const ev = cal_().getEventById(String(r.evento));
    if (ev) ev.deleteEvent();
    entUpdate_('Plan', r, { estado: 'cambiada', evento: '' });
    const moved = relocate_(r, String(r.fecha));
    notify_(moved
      ? '🔁 ' + esc_(r.titulo) + ' chocaba con algo del calendario. La he pasado al ' + dayName_(new Date(moved.start)) + ' a las ' + entHm_(moved.start) + '.'
      : '🔁 ' + esc_(r.titulo) + ' chocaba con algo del calendario y no hay otro hueco esta semana. ' + (r.prioridad === 'clave' ? 'La semana que viene le doy prioridad.' : 'Esta vez se salta.'));
  });
}

/** Al acabar una sesión, una sola vez: "¿Cómo ha ido?". Para la natación, recuerda reservar. */
function askFinished_() {
  const now = Date.now();
  entRows_('Plan').forEach(r => {
    if (!r.fecha || !r.fin) return;
    const avisos = String(r.avisos || '');
    const end = entAt_(String(r.fecha), String(r.fin)), start = entAt_(String(r.fecha), String(r.inicio));
    if (['planificada', 'reservar'].indexOf(String(r.estado)) >= 0 && end < now && end > now - DAY && avisos.indexOf('fin') < 0) {
      entUpdate_('Plan', r, { avisos: avisos + ' fin' });
      notify_('✅ ¿Cómo ha ido <b>' + esc_(r.titulo) + '</b>? Ciérrala en la app (esfuerzo y molestias).', 'sesion=' + r.id);
    }
    if (String(r.estado) === 'reservar' && start - now < (ENT.SWIM_BOOK_H + 24) * 3600000 && start > now + ENT.SWIM_BOOK_H * 3600000 && avisos.indexOf('reserva') < 0) {
      entUpdate_('Plan', r, { avisos: avisos + ' reserva' });
      notify_('🏊 Reserva la natación del ' + dayName_(new Date(start)) + ' a las ' + r.inicio + ' (hay que hacerlo con 48 h).', 'sesion=' + r.id);
    }
  });
}

function entrenoMorning() {
  const today = ymd_(new Date());
  const rows = entRows_('Plan').filter(r => String(r.fecha) === today && ['planificada', 'reservar'].indexOf(String(r.estado)) >= 0);
  if (!rows.length) return;
  const wx = entWeather_();
  const lines = rows.map(r => {
    let l = '• <b>' + esc_(r.titulo) + '</b> a las ' + r.inicio + ' (' + r.minutos + ' min)';
    if (String(r.clave) === 'BI' && !bikeWeatherOk_(entAt_(today, String(r.inicio)), entAt_(today, String(r.fin)), wx.weather)) l += '\n  ⚠️ Lluvia o frío previstos: cámbiala por carrera suave en la app.';
    return l;
  });
  notify_('☀️ <b>Hoy toca</b>\n' + lines.join('\n'));
}

function entrenoEvening() {
  const today = ymd_(new Date());
  const open = entRows_('Plan').filter(r => String(r.fecha) === today && ['planificada', 'reservar'].indexOf(String(r.estado)) >= 0 && entAt_(today, String(r.fin)) < Date.now());
  if (open.length) notify_('🌙 Te queda por cerrar: ' + open.map(r => esc_(r.titulo)).join(', ') + '. ¿La hiciste?');
}

/** Domingo 18:00: repaso de la semana y plan de la siguiente, con su porqué. */
function entrenoWeekly() {
  const monday = entMonday_(ymd_(new Date()));
  const rows = entRows_('Plan').filter(r => String(r.semana) === monday);
  const done = rows.filter(r => ['hecha', 'a medias'].indexOf(String(r.estado)) >= 0);
  const planned = rows.filter(r => ['hecha', 'a medias', 'no hecha', 'planificada', 'reservar', 'sin hueco'].indexOf(String(r.estado)) >= 0);
  const pf = perfil_();
  const nextMonday = entAddDays_(monday, 7);
  // si la semana fue muy floja, no se avanza en el bloque: se repite la carga
  if (planned.length && done.length / planned.length < 0.5) setPerfil_('bloque_inicio', entAddDays_(pf.bloque_inicio || monday, 7));
  const mode = pf.modo_siguiente || 'normal';
  if (pf.modo_siguiente) setPerfil_('modo_siguiente', '');
  setPerfil_('modo', mode);
  const res = planWeek_(entAt_(nextMonday, '12:00'), mode, 'semanal');
  const facts = {
    semana_pasada: { planificadas: planned.length, hechas: done.length, rpe_medio: avg_(done.map(r => (JSON.parse(r.cierre || '{}').rpe))), dolor_max: Math.max.apply(null, [0].concat(done.map(r => Number(JSON.parse(r.cierre || '{}').dolor) || 0))) },
    siguiente: { modo: mode, semana_del_bloque: res.semana.semana, bloque: res.semana.bloque, colocadas: res.placed, sin_hueco: res.missing },
    actividades: entRows_('Actividades').filter(a => ymd_(new Date(a.fecha)) >= monday).map(a => a.tipo + ' ' + a.minutos + ' min'),
  };
  let text = 'Semana: ' + done.length + ' de ' + planned.length + ' sesiones. La que viene es la ' + res.semana.semana + '.ª del bloque ' + res.semana.bloque + (res.semana.semana === 4 ? ' (descarga)' : '') + '.';
  try {
    const out = askLlm_(coachSystem_() + '\nAhora escribe el resumen del domingo: qué tal fue la semana y qué cambia en la siguiente y por qué. Máximo 90 palabras. Devuelve {"reply": "...", "cites": ["E1"]}.', JSON.stringify(facts), true);
    text = cleanCites_(out).reply || text;
  } catch (err) { console.error(err); }
  entAppend_('Chat', { id: newId_('c'), fecha: new Date(), rol: 'entrenador', texto: text, citas: '' });
  notify_('🗞️ <b>Tu semana</b>\n' + esc_(text));
}
function avg_(xs) { xs = xs.map(Number).filter(x => x > 0); return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 10) / 10 : ''; }

// ------------------------------------------------------------------ actividades (intervals.icu)

const ENT_ACT_TYPES = { Run: 'carrera', TrailRun: 'carrera', VirtualRun: 'carrera', Ride: 'bici', VirtualRide: 'bici', GravelRide: 'bici', Swim: 'natacion', OpenWaterSwim: 'natacion',
  Tennis: 'tenis', Padel: 'padel', Surfing: 'surf', WeightTraining: 'fuerza', Workout: 'fuerza', Walk: 'andar', Hike: 'andar' };

/** Lee las actividades de los últimos 3 días de intervals.icu (propiedades INTERVALS_KEY e INTERVALS_ATHLETE). */
function importIntervals_() {
  if (!prop_('INTERVALS_KEY') || !prop_('INTERVALS_ATHLETE')) return 0;
  const oldest = ymd_(new Date(Date.now() - 3 * DAY)), newest = ymd_(new Date());
  const r = UrlFetchApp.fetch('https://intervals.icu/api/v1/athlete/' + prop_('INTERVALS_ATHLETE') + '/activities?oldest=' + oldest + '&newest=' + newest, {
    headers: { Authorization: 'Basic ' + Utilities.base64Encode('API_KEY:' + prop_('INTERVALS_KEY')) }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error(r.getResponseCode() + ' ' + r.getContentText().slice(0, 200));
  const known = {};
  entRows_('Actividades').forEach(a => { known[String(a.externo)] = true; });
  const plan = entRows_('Plan');
  let n = 0;
  JSON.parse(r.getContentText()).forEach(a => {
    if (!a.id || known[String(a.id)]) return;
    const tipo = ENT_ACT_TYPES[a.type] || String(a.type || 'otro').toLowerCase();
    const fecha = new Date(a.start_date_local || a.start_date);
    const min = Math.round((a.moving_time || a.elapsed_time || 0) / 60);
    const match = plan.find(p => String(p.fecha) === ymd_(fecha) && String(p.tipo) === tipo && ['planificada', 'reservar', 'cambiada'].indexOf(String(p.estado)) >= 0);
    entAppend_('Actividades', { id: newId_('a'), fecha, fuente: 'intervals.icu', tipo, minutos: min, km: a.distance ? Math.round(a.distance / 100) / 10 : '', fc: a.average_heartrate || '', sesion: match ? match.id : '', externo: a.id });
    if (match) {
      entUpdate_('Plan', match, { estado: 'hecha', cierre: JSON.stringify({ minutos: min, fuente: 'reloj', at: Date.now() }) });
      notify_('⌚ He apuntado <b>' + esc_(match.titulo) + '</b> desde el reloj (' + min + ' min). Ponle esfuerzo y molestias en la app.', 'sesion=' + match.id);
    }
    n++;
  });
  return n;
}

// ------------------------------------------------------------------ chat con el entrenador

function coachSystem_() {
  const ev = entRows_('Evidencia').filter(e => String(e.estado) === 'verificado');
  const pf = perfil_();
  return [
    'Eres el entrenador personal de ' + (pf.nombre || 'tu usuario') + '. Hablas en español de España, claro, directo y cercano. Respuestas cortas (máximo 120 palabras salvo que pida detalle).',
    'Buscas siempre la forma de entrenar más eficaz que respalda la evidencia, adaptada a él.',
    'REGLAS DE EVIDENCIA (obligatorias):',
    '1. Solo puedes citar estudios de esta lista, y SOLO por su id entre corchetes, p. ej. [E3]. Nunca escribas autores, años, revistas ni títulos de estudios que no estén aquí. Nunca inventes un estudio ni una cifra.',
    '2. Si no hay un estudio de la lista que respalde algo, dilo con naturalidad ("esto es criterio propio" o "es práctica habitual, sin estudio sólido detrás").',
    '3. Siempre incluye tu propio razonamiento aplicado a él (su nivel, sus deportes, sus molestias o lesiones, su tiempo). Si la evidencia es débil o contradictoria, dilo.',
    'Estudios verificados:',
    ev.map(e => '[' + e.id + '] ' + e.afirmacion + ' (' + e.tipo + ', solidez ' + e.solidez + ')').join('\n'),
    'Perfil: ' + JSON.stringify(pf),
    'Objetivos: ' + entRows_('Objetivos').filter(o => o.estado === 'activo').map(o => o.titulo + (o.fecha ? ' (' + ymd_(new Date(o.fecha)) + ')' : '')).join('; '),
    'No eres fisioterapeuta ni médico: ante dolor que no se calma, que dura más de un día o que va a más, recomienda que se lo mire un profesional.',
  ].join('\n');
}

/**
 * Mensaje del chat → respuesta + acciones que ejecuta el código.
 * La IA solo entiende y explica; lo que cambia el plan lo hace el código, con las mismas reglas que los botones.
 */
function chat_(text) {
  const today = ymd_(new Date()), monday = entMonday_(today);
  const week = entRows_('Plan').filter(r => String(r.semana) === monday).map(r => ({ id: r.id, titulo: r.titulo, fecha: r.fecha, inicio: r.inicio, estado: r.estado, prioridad: r.prioridad }));
  const hist = entRows_('Chat').slice(-8).map(c => (c.rol === 'yo' ? (perfil_().nombre || 'Usuario') + ': ' : 'Entrenador: ') + c.texto).join('\n');
  const system = coachSystem_() + '\n\nHoy es ' + DIAS[new Date().getDay()] + ' ' + today + '. Plan de esta semana: ' + JSON.stringify(week) +
    '\nConversación reciente:\n' + hist +
    '\n\nDevuelve SOLO un JSON: {"reply": "texto para él", "cites": ["E1"], "actions": [ ... ]}. Acciones posibles (solo si él lo pide o lo dice claro):' +
    '\n{"type":"skip","id":"<id de la sesión>"} — no puede hacer esa sesión' +
    '\n{"type":"move","id":"<id>","date":"YYYY-MM-DD","time":"HH:MM opcional"}' +
    '\n{"type":"mode","mode":"normal|corto|mantenimiento"} — esta semana va con poco tiempo, exámenes, o vuelve a lo normal' +
    '\n{"type":"next_mode","mode":"normal|corto|mantenimiento"} — lo mismo, pero para la semana que viene' +
    '\n{"type":"log","tipo":"tenis|padel|surf|carrera|bici|natacion|fuerza|otro","minutos":60,"date":"YYYY-MM-DD"} — algo que ya ha hecho fuera del plan' +
    '\n{"type":"goal","titulo":"…","fecha":"YYYY-MM-DD opcional","prioridad":1} — objetivo nuevo o cambiado' +
    '\n{"type":"pref","texto":"…"} — preferencia general para planificar (p. ej. "prefiero entrenar por la mañana")' +
    '\n{"type":"measure","tipo":"peso|cintura|…","valor":71.5}';
  entAppend_('Chat', { id: newId_('c'), fecha: new Date(), rol: 'yo', texto: text, citas: '' });
  const out = cleanCites_(askLlm_(system, text, false));
  const results = [], undo = [];
  (out.actions || []).forEach(a => {
    try {
      let r = null;
      if (a.type === 'skip') r = cantDo_(a.id);
      else if (a.type === 'move') r = moveSession_(a.id, a.date, a.time);
      else if (a.type === 'mode') r = setMode_(a.mode);
      else if (a.type === 'next_mode' && ENT_MODES[a.mode]) { setPerfil_('modo_siguiente', a.mode); r = { msg: 'La semana que viene irá en modo ' + a.mode + '.' }; }
      else if (a.type === 'log') { entAppend_('Actividades', { id: newId_('a'), fecha: new Date(entAt_(/^\d{4}-\d\d-\d\d$/.test(a.date || '') ? a.date : today, '12:00')), fuente: 'chat', tipo: a.tipo, minutos: Number(a.minutos) || '' }); r = { msg: 'Apuntado: ' + a.tipo + (a.minutos ? ' ' + a.minutos + ' min' : '') + '.' }; }
      else if (a.type === 'goal') { entAppend_('Objetivos', { id: newId_('o'), creado: new Date(), titulo: a.titulo, detalle: a.detalle || '', fecha: a.fecha || '', prioridad: Number(a.prioridad) || 2, estado: 'activo' }); r = { msg: 'Objetivo apuntado: ' + a.titulo + '.' }; }
      else if (a.type === 'pref') { setPerfil_('pref_' + newId_(''), a.texto); r = { msg: 'Lo tendré en cuenta al planificar.' }; }
      else if (a.type === 'measure') { entAppend_('Medidas', { id: newId_('m'), fecha: new Date(), tipo: a.tipo, valor: Number(a.valor), unidad: a.tipo === 'peso' ? 'kg' : 'cm' }); r = { msg: 'Apuntado: ' + a.tipo + ' ' + a.valor + '.' }; }
      if (r) { results.push(r.msg); if (r.undo) undo.push(r.undo); }
    } catch (err) { results.push('⚠️ ' + err.message); }
  });
  const reply = out.reply + (results.length ? '\n\n' + results.join('\n') : '');
  entAppend_('Chat', { id: newId_('c'), fecha: new Date(), rol: 'entrenador', texto: reply, citas: (out.cites || []).join(',') });
  return { reply, cites: citeObjects_(out.cites), undo: undo[0] || '', model: out.model };
}

/**
 * Quita del texto cualquier cita que no sea un id verificado y cualquier referencia escrita a mano
 * ("Smith et al., 2019", "(García, 2020)"). Así es imposible que llegue un estudio inventado.
 */
function cleanCites_(out) {
  const ok = {};
  entRows_('Evidencia').filter(e => String(e.estado) === 'verificado').forEach(e => { ok[String(e.id)] = true; });
  let reply = String(out.reply || '');
  let removed = false;
  const drop = () => { removed = true; return ''; };
  const W = "[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü'-]+";
  reply = reply.replace(/\[(E\d+)\]/g, (m, id) => ok[id] ? m : drop());
  reply = reply
    .replace(new RegExp(W + ' et al\\.?,? \\(?(19|20)\\d{2}[a-z]?\\)?', 'g'), drop)                                   // García et al., 2019
    .replace(new RegExp('\\((?:' + W + '(?: (?:y|and|&) ' + W + ')?,? (19|20)\\d{2}[a-z]?;? ?)+\\)', 'g'), drop)      // (García, 2019)
    .replace(new RegExp(W + ' \\((19|20)\\d{2}[a-z]?\\)', 'g'), drop)                                                // García (2019)
    .replace(/\b10\.\d{4,9}\/[^\s)\]]+/g, m => ok[m] ? m : drop());                                                    // un DOI suelto
  if (removed) reply = reply.replace(/ +([.,;:])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim() + '\n\n(He quitado una referencia que no está en tu biblioteca verificada.)';
  const cites = (out.cites || []).filter(id => ok[id]);
  (reply.match(/\[E\d+\]/g) || []).forEach(m => { const id = m.slice(1, -1); if (cites.indexOf(id) < 0) cites.push(id); });
  return Object.assign({}, out, { reply, cites });
}

function citeObjects_(ids) {
  const ev = entRows_('Evidencia');
  return (ids || []).map(id => ev.find(e => String(e.id) === id)).filter(Boolean).map(e => ({ id: e.id, afirmacion: e.afirmacion, autores: e.autores, año: e.año, revista: e.revista, doi: e.doi }));
}

/**
 * IA en JSON. Primero Groq (gpt-oss-120b, muy rápido); si falla o se acaba el cupo, Gemini Flash.
 * deep = true: primero Gemini (razona mejor), para el resumen del domingo.
 */
function askLlm_(system, user, deep) {
  const order = deep ? ['gemini', 'groq'] : ['groq', 'gemini'];
  let last = null;
  for (const who of order) {
    try {
      const out = who === 'groq' ? groqJson_(system, user) : geminiJson_(system, user, false);
      if (out) { out.model = who; return out; }
    } catch (err) { last = err; console.error(who + ': ' + err); }
  }
  throw last || new Error('La IA no responde ahora mismo. Los botones de la app siguen funcionando.');
}

function groqJson_(system, user) {
  if (!prop_('GROQ_API_KEY')) return null;
  const r = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + prop_('GROQ_API_KEY') }, muteHttpExceptions: true,
    payload: JSON.stringify({ model: prop_('GROQ_MODEL') || 'openai/gpt-oss-120b', temperature: 0.4, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  if (r.getResponseCode() !== 200) throw new Error('Groq ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
  return parseJsonLoose_(JSON.parse(r.getContentText()).choices[0].message.content);
}

function geminiJson_(system, user, search) {
  if (!prop_('GEMINI_API_KEY')) return null;
  const models = [prop_('GEMINI_MODEL'), 'gemini-flash-latest', 'gemini-2.5-flash'].filter(Boolean);
  for (const model of models) {
    const body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }] };
    if (search) body.tools = [{ google_search: {} }]; else body.generationConfig = { responseMimeType: 'application/json' };
    const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
      method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': prop_('GEMINI_API_KEY') }, payload: JSON.stringify(body), muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) { console.error('Gemini ' + model + ' ' + r.getResponseCode()); continue; }
    const parts = ((JSON.parse(r.getContentText()).candidates || [])[0] || { content: { parts: [] } }).content.parts || [];
    const out = parseJsonLoose_(parts.filter(p => !p.thought).map(p => p.text || '').join(''));
    if (out) return out;
  }
  throw new Error('Gemini no ha respondido');
}

function parseJsonLoose_(text) {
  text = String(text || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { return JSON.parse(text); } catch (e) {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

// ------------------------------------------------------------------ biblioteca de estudios: búsqueda y verificación

const ENT_TOPICS = ['entrenamiento de fuerza en triatletas', 'pliometría y economía de carrera', 'potencia rotacional en tenis', 'fuerza de hombro y prevención en natación o surf',
  'entrenamiento unilateral y control de rodilla en corredores', 'core antirrotación y rendimiento', 'entrenamiento concurrente y orden de las sesiones', 'progresión de carga en principiantes'];

/** Domingo 16:00: busca UN estudio nuevo de un tema y solo lo añade si Crossref confirma que existe y coincide. */
function entrenoResearch() {
  if (!prop_('GEMINI_API_KEY')) return;
  const n = Number(prop_('ENT_TOPIC') || 0);
  setProp_('ENT_TOPIC', String(n + 1));
  const topic = ENT_TOPICS[n % ENT_TOPICS.length];
  const have = entRows_('Evidencia').map(e => String(e.doi).toLowerCase());
  let found;
  try {
    found = geminiJson_('Eres un investigador en ciencias del deporte. Busca en Google UN estudio revisado por pares (mejor revisión sistemática o metaanálisis) sobre el tema. Devuelve SOLO un JSON {"doi":"10.…","titulo":"…","afirmacion":"conclusión principal en una frase, en español","tipo":"Metaanálisis|Revisión sistemática|Ensayo aleatorizado|…"}. Si no estás seguro del DOI, devuelve {"doi":""}.',
      'Tema: ' + topic + '. No repitas estos DOI: ' + have.join(', '), true);
  } catch (err) { console.error(err); return; }
  if (!found || !found.doi || have.indexOf(String(found.doi).toLowerCase()) >= 0) return;
  const v = verifyDoi_(found.doi, found.titulo);
  const rows = entRows_('Evidencia');
  entAppend_('Evidencia', { id: 'E' + (rows.length + 1), afirmacion: found.afirmacion, autores: v.autores || '', año: v.año || '', titulo: v.titulo || found.titulo, revista: v.revista || '', doi: found.doi,
    tipo: found.tipo || '', solidez: /metaan|sistem/i.test(found.tipo || '') ? 'alta' : 'media', estado: v.ok ? 'verificado' : 'pendiente: ' + v.why, verificado: v.ok ? ymd_(new Date()) : '', tema: topic });
}

/** Comprueba en Crossref que el DOI existe y que su título se parece al que dio la IA. */
function verifyDoi_(doi, title) {
  const r = UrlFetchApp.fetch('https://api.crossref.org/works/' + encodeURIComponent(doi), { muteHttpExceptions: true, headers: { 'User-Agent': 'EntrenadorApp/1.0 (uso personal)' } });
  if (r.getResponseCode() !== 200) return { ok: false, why: 'el DOI no existe en Crossref' };
  const m = JSON.parse(r.getContentText()).message;
  const real = (m.title || [''])[0];
  const words = s => norm_(s).split(/[^a-z0-9]+/).filter(w => w.length > 3);
  const a = words(real), b = words(title || '');
  const common = b.filter(w => a.indexOf(w) >= 0).length;
  const out = { titulo: real, revista: (m['container-title'] || [''])[0], año: ((m.issued || {})['date-parts'] || [[0]])[0][0],
    autores: (m.author || []).slice(0, 3).map(x => x.family + ' ' + String(x.given || '').split(/\s+/).map(g => g[0]).join('')).join(', ') + ((m.author || []).length > 3 ? ', et al.' : '') };
  out.ok = b.length > 0 && common / b.length >= 0.6;
  if (!out.ok) out.why = 'el título no coincide';
  return out;
}

// ------------------------------------------------------------------ avisos (bot de Telegram aparte, solo envía)

function entTg_(method, payload) {
  const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + prop_('ENT_TG_TOKEN') + '/' + method, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(payload || {}), muteHttpExceptions: true });
  try { return JSON.parse(res.getContentText()); } catch (e) { return { ok: false }; }
}

function notify_(html, query) {
  if (!prop_('ENT_TG_TOKEN') || !prop_('ENT_TG_CHAT')) return;
  const app = prop_('ENT_APP_URL');
  const p = { chat_id: prop_('ENT_TG_CHAT'), text: cut_(html), parse_mode: 'HTML', disable_web_page_preview: true };
  if (app) p.reply_markup = { inline_keyboard: [[{ text: 'Abrir la app', url: app + (query ? (app.indexOf('?') >= 0 ? '&' : '?') + query : '') }]] };
  entTg_('sendMessage', p);
}

// ------------------------------------------------------------------ API de la app

/** Bot.gs → doPost: if (p.app === 'entreno') return entrenoApi_(e); */
function entrenoApi_(e) {
  let body = {};
  try { body = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (err) {}
  const json = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  if (!prop_('ENT_KEY') || body.k !== prop_('ENT_KEY')) return json({ error: 'clave' });
  try {
    return json(entrenoAction_(body));
  } catch (err) {
    console.error(err && err.stack || err);
    return json({ error: String(err && err.message || err) });
  }
}

function entrenoAction_(b) {
  switch (b.action) {
    case 'state': return apiState_();
    case 'week': return apiWeek_(Number(b.offset) || 0);
    case 'session': return apiSession_(b.id);
    case 'log_set': return logSet_(b.sesion, b.ejercicio, b.serie, b.kg, b.reps, b.rir);
    case 'close': return closeSession_(b.id, b.estado, b.rpe, b.dolor, b.nota);
    case 'cant': return cantDo_(b.id);
    case 'move': return moveSession_(b.id, b.date, b.time);
    case 'swap_run': return swapToRun_(b.id);
    case 'mode': return setMode_(b.mode);
    case 'answer': return answerBox_(b.id, Number(b.option));
    case 'undo': return entUndo_(b.undo);
    case 'chat': return chat_(String(b.text || '').slice(0, 2000));
    case 'chat_history': return { messages: entRows_('Chat').slice(-40).map(c => ({ rol: c.rol, texto: c.texto, fecha: +new Date(c.fecha), cites: citeObjects_(String(c.citas || '').split(',').filter(Boolean)) })) };
    case 'evidence': return { items: entRows_('Evidencia').map(e => ({ id: e.id, afirmacion: e.afirmacion, autores: e.autores, año: e.año, titulo: e.titulo, revista: e.revista, doi: e.doi, tipo: e.tipo, solidez: e.solidez, estado: e.estado, tema: e.tema })) };
    case 'stats': return apiStats_();
    case 'measure': entAppend_('Medidas', { id: newId_('m'), fecha: new Date(), tipo: b.tipo, valor: Number(b.valor), unidad: b.unidad || '', nota: b.nota || '' }); return { msg: 'Apuntado.' };
    case 'goal': entAppend_('Objetivos', { id: newId_('o'), creado: new Date(), titulo: b.titulo, detalle: b.detalle || '', fecha: b.fecha || '', prioridad: Number(b.prioridad) || 2, estado: 'activo' }); return { msg: 'Objetivo apuntado.' };
    case 'goal_done': { const g = entRows_('Objetivos').find(x => String(x.id) === String(b.id)); if (g) entUpdate_('Objetivos', g, { estado: b.estado || 'conseguido' }); return { msg: 'Hecho.' }; }
    case 'plan_now': return planWeek_(new Date(), perfil_().modo || 'normal', 'manual');
    case 'log_sport': entAppend_('Actividades', { id: newId_('a'), fecha: new Date(entAt_(b.date || ymd_(new Date()), '12:00')), fuente: 'app', tipo: b.tipo, minutos: Number(b.minutos) || '' }); return { msg: 'Apuntado.' };
  }
  throw new Error('Acción desconocida: ' + b.action);
}

function sessionOut_(r) {
  const c = r.cierre ? JSON.parse(r.cierre) : {};
  return { id: r.id, clave: r.clave, tipo: r.tipo, titulo: r.titulo, fecha: String(r.fecha), inicio: String(r.inicio), fin: String(r.fin), prioridad: r.prioridad, minutos: r.minutos, lugar: r.lugar, version: r.version, estado: r.estado, cierre: c };
}

function weekRings_(rows, acts) {
  const ring = (tipos) => {
    const p = rows.filter(r => tipos.indexOf(String(r.tipo)) >= 0 && ['hecha', 'a medias', 'planificada', 'reservar', 'no hecha', 'sin hueco'].indexOf(String(r.estado)) >= 0);
    return [p.filter(r => ['hecha', 'a medias'].indexOf(String(r.estado)) >= 0).length, p.length];
  };
  const sport = acts.filter(a => ['tenis', 'padel', 'surf'].indexOf(String(a.tipo)) >= 0).length;
  return { fuerza: ring(['fuerza']), cardio: ring(['carrera', 'bici', 'natacion']), deporte: [sport, Math.max(1, sport)] };
}

/** Racha: semanas seguidas (sin contar la actual) en las que hiciste al menos el 60 % de lo planificado y 2 sesiones. */
function streak_(rows) {
  const byWeek = {};
  rows.forEach(r => {
    const w = String(r.semana);
    byWeek[w] = byWeek[w] || { p: 0, d: 0 };
    if (['hecha', 'a medias', 'planificada', 'reservar', 'no hecha', 'sin hueco'].indexOf(String(r.estado)) >= 0) byWeek[w].p++;
    if (['hecha', 'a medias'].indexOf(String(r.estado)) >= 0) byWeek[w].d++;
  });
  let n = 0, w = entAddDays_(entMonday_(ymd_(new Date())), -7);
  while (byWeek[w] && byWeek[w].d >= Math.max(2, Math.ceil(0.6 * byWeek[w].p))) { n++; w = entAddDays_(w, -7); }
  return n;
}

function surfThisWeek_(monday) {
  return cal_().getEvents(new Date(entAt_(monday, '00:00')), new Date(Math.min(Date.now(), entAt_(entAddDays_(monday, 7), '00:00'))))
    .filter(ev => ev.getColor() === '7' || /surf/i.test(ev.getTitle())).map(ev => ({ tipo: 'surf', fecha: ev.getStartTime() }));
}

function apiState_() {
  const today = ymd_(new Date()), monday = entMonday_(today);
  const all = entRows_('Plan');
  const rows = all.filter(r => String(r.semana) === monday);
  const acts = entRows_('Actividades').filter(a => ymd_(new Date(a.fecha)) >= monday).concat(surfThisWeek_(monday));
  const pf = perfil_();
  const live = ['planificada', 'reservar', 'hecha', 'a medias'];
  return {
    hoy: today,
    today: rows.filter(r => String(r.fecha) === today && live.indexOf(String(r.estado)) >= 0).map(sessionOut_),
    next: all.filter(r => String(r.fecha) > today && ['planificada', 'reservar'].indexOf(String(r.estado)) >= 0).sort((a, b) => (String(a.fecha) + a.inicio).localeCompare(String(b.fecha) + b.inicio)).slice(0, 4).map(sessionOut_),
    week: rows.filter(r => live.concat(['no hecha']).indexOf(String(r.estado)) >= 0).map(sessionOut_),
    rings: weekRings_(rows, acts),
    streak: streak_(all),
    toClose: all.filter(r => ['planificada', 'reservar'].indexOf(String(r.estado)) >= 0 && r.fecha && entAt_(String(r.fecha), String(r.fin)) < Date.now() && entAt_(String(r.fecha), String(r.fin)) > Date.now() - 3 * DAY).map(sessionOut_),
    questions: entRows_('Buzon').filter(b => b.estado === 'pregunta').map(b => ({ id: b.id, texto: b.detalle, opciones: String(b.opciones).split('|') })),
    goals: entRows_('Objetivos').filter(o => o.estado === 'activo').sort((a, b) => a.prioridad - b.prioridad).map(o => ({ id: o.id, titulo: o.titulo, detalle: o.detalle, fecha: o.fecha ? ymd_(new Date(o.fecha)) : '' })),
    modo: pf.modo || 'normal',
    bloque: blockWeek_(monday, pf.bloque_inicio || monday),
  };
}

function apiWeek_(offset) {
  const monday = entAddDays_(entMonday_(ymd_(new Date())), 7 * offset);
  const evs = cal_().getEvents(new Date(entAt_(monday, '00:00')), new Date(entAt_(entAddDays_(monday, 7), '00:00')))
    .filter(ev => !isEntreno_(ev))
    .map(ev => ({ titulo: ev.getTitle(), todoElDia: ev.isAllDayEvent(), fecha: ymd_(ev.isAllDayEvent() ? ev.getAllDayStartDate() : ev.getStartTime()),
      inicio: ev.isAllDayEvent() ? '' : hhmm_(ev.getStartTime()), fin: ev.isAllDayEvent() ? '' : hhmm_(ev.getEndTime()), color: ev.getColor() }));
  const rows = entRows_('Plan').filter(r => String(r.semana) === monday && ['planificada', 'reservar', 'hecha', 'a medias', 'no hecha', 'sin hueco'].indexOf(String(r.estado)) >= 0);
  return { monday, sessions: rows.map(sessionOut_), events: evs, bloque: blockWeek_(monday, perfil_().bloque_inicio || monday) };
}

function apiSession_(id) {
  const r = planRow_(id);
  if (!r) throw new Error('No encuentro esa sesión.');
  const out = sessionOut_(r);
  const s = ENT_SESSIONS[r.clave];
  const w = blockWeek_(String(r.semana), perfil_().bloque_inicio || String(r.semana));
  out.semanaBloque = w;
  if (s && s.ej) {
    const series = entRows_('Series');
    const hist = series.filter(x => String(x.sesion) !== String(r.id));
    const mine = series.filter(x => String(x.sesion) === String(r.id));
    out.ejercicios = prescribe_(r.clave, w, String(r.version)).map(p => {
      const sug = p.t === 'fuerza' ? suggestKg_(p.id, p, hist) : null;
      return Object.assign(p, { sugerido: sug, hechas: mine.filter(x => x.ejercicio === p.id).map(x => ({ serie: x.serie, kg: x.kg, reps: x.reps, rir: x.rir })) });
    });
  } else {
    out.texto = sessionDesc_(r.clave, Number(r.minutos), String(r.version));
  }
  out.porque = whySession_(r.clave, w);
  return out;
}

/** El porqué de cada sesión, con su respaldo (id de la Evidencia o criterio propio). */
function whySession_(key, w) {
  const base = {
    FA: { t: 'Pierna y glúteo para correr, la bici y los cambios de dirección en tenis y pádel. La pliometría va al principio, sin fatiga, y se cuenta por contactos. El trabajo de cadera y glúteo ayuda a controlar la rodilla.', e: ['E3', 'E5', 'E17'] },
    FB: { t: 'Remada y hombro para nadar y remar en el surf, rotación para el golpe de tenis y pádel, y ejercicios de escápula para la postura. Sobre la postura, la evidencia de que "corregirla" cambie el dolor o el rendimiento es débil: el objetivo es fuerza y control.', e: ['E1', 'E14'] },
    FC: { t: 'Trabajo a una pierna y core antirrotación: es como corres, pedaleas y golpeas. Volumen moderado para no cargar demasiado las piernas.', e: ['E1', 'E2'] },
    CS: { t: 'Rodaje suave: la base aeróbica se construye sobre todo a intensidad baja.', e: ['E15'] },
    CL: { t: 'La tirada larga desarrolla la resistencia. Sube poco a poco: la regla del 10 % no es una ley, pero los saltos grandes de volumen sí se asocian a lesiones.', e: ['E6', 'E7'] },
    BI: { t: 'Volumen aeróbico con poco impacto: cuida las articulaciones y suma para el triatlón. El ciclismo interfiere menos con la fuerza que la carrera.', e: ['E12'] },
    NA: { t: 'Técnica de natación para el triatlón, también descarga el impacto.', e: [] },
  }[key];
  const extra = w.semana === 4 ? ' Esta semana es de descarga: menos volumen para asimilar el bloque.' : '';
  return { texto: base.t + extra, cites: citeObjects_(base.e.concat(w.semana === 4 ? ['E13'] : [])) };
}

function apiStats_() {
  const plan = entRows_('Plan'), series = entRows_('Series'), acts = entRows_('Actividades'), med = entRows_('Medidas');
  const weeks = [];
  let w = entAddDays_(entMonday_(ymd_(new Date())), -7 * 11);
  for (let i = 0; i < 12; i++, w = entAddDays_(w, 7)) {
    const rows = plan.filter(r => String(r.semana) === w);
    const done = rows.filter(r => ['hecha', 'a medias'].indexOf(String(r.estado)) >= 0);
    const load = done.reduce((a, r) => { const c = r.cierre ? JSON.parse(r.cierre) : {}; return a + (Number(c.rpe) || 0) * (Number(c.minutos || r.minutos) || 0); }, 0);
    const wa = acts.filter(a => ymd_(new Date(a.fecha)) >= w && ymd_(new Date(a.fecha)) < entAddDays_(w, 7));
    weeks.push({ semana: w, hechas: done.length, planificadas: rows.filter(r => String(r.estado) !== 'replanificada' && String(r.estado) !== 'cambiada').length, carga: load,
      km_carrera: Math.round(wa.filter(a => a.tipo === 'carrera').reduce((s, a) => s + (Number(a.km) || 0), 0) * 10) / 10,
      km_bici: Math.round(wa.filter(a => a.tipo === 'bici').reduce((s, a) => s + (Number(a.km) || 0), 0)) });
  }
  // fuerza: 1RM estimado (Epley) del mejor set de cada día, por ejercicio principal
  const strength = {};
  ['sentadilla_goblet', 'peso_muerto_rumano', 'press_mancuernas', 'jalon_pecho', 'remo_mancuerna', 'bulgara'].forEach(id => {
    const byDay = {};
    series.filter(s => s.ejercicio === id && Number(s.kg) > 0 && Number(s.reps) > 0).forEach(s => {
      const d = ymd_(new Date(s.fecha)), e1 = Number(s.kg) * (1 + Number(s.reps) / 30);
      byDay[d] = Math.max(byDay[d] || 0, Math.round(e1 * 10) / 10);
    });
    const pts = Object.keys(byDay).sort().map(d => ({ fecha: d, valor: byDay[d] }));
    if (pts.length) strength[id] = pts;
  });
  const measures = {};
  med.forEach(m => { (measures[m.tipo] = measures[m.tipo] || []).push({ fecha: ymd_(new Date(m.fecha)), valor: Number(m.valor) }); });
  return { weeks, strength, measures, streak: streak_(plan) };
}
