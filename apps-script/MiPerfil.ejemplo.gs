/**
 * Copia este archivo como MiPerfil.gs en tu proyecto de Apps Script y rellénalo con tus datos.
 * MiPerfil.gs NO se sube al repositorio (está en .gitignore): así el código puede ser público.
 * setupEntreno() lo usa solo la primera vez para rellenar las pestañas Perfil, Objetivos y Medidas;
 * después se cambia todo desde la hoja o desde la app.
 */
const ENT_MI_PERFIL = {
  nombre: 'Tu nombre',
  home: { lat: 40.4168, lon: -3.7038 },     // tu ciudad, para la previsión de la bici (Open-Meteo)
  peso: 70,                                 // kg en ayunas (opcional)
  perfil: [                                 // lo que el entrenador debe saber de ti: clave y texto libre
    ['altura_cm', '175'],
    ['nivel_gimnasio', 'principiante'],
    ['deportes', 'carrera, bici'],
    ['gustos', 'qué te gusta y qué no'],
    ['lesiones', 'molestias o lesiones a tener en cuenta'],
    ['gimnasio', 'horario y a cuántos minutos está'],
    ['casa', 'material que tienes en casa'],
    ['reloj', 'modelo de reloj'],
  ],
  objetivos: [
    { titulo: 'Tu objetivo principal', detalle: '', fecha: '', prioridad: 1 },
  ],
};
