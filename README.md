# Entrenador

App de móvil (Android, se instala desde el navegador) que hace de entrenador personal:

- **Planifica la semana** de fuerza, carrera, bici y natación en los huecos libres de tu calendario. El estudio manda: si una sesión clave no cabe, te pregunta.
- **Se adapta**: "hoy no puedo", semana con poco tiempo, exámenes, mover una sesión, bici con lluvia → carrera. Todo con botón de Deshacer.
- **Modo gimnasio**: dibujo de la posición inicial y final de cada ejercicio, series con peso propuesto (doble progresión), temporizador de descanso. Las series se guardan aunque no haya cobertura.
- **Chat con el entrenador**: Groq (rápido) y Gemini de respaldo, gratis. Solo puede citar estudios verificados; si no hay estudio, lo dice.
- **Bibliotecas** de ejercicios (25 fichas con dibujos propios) y de estudios (17 verificados en Crossref).
- **Progreso**: racha semanal, sesiones, carga, kilómetros, fuerza estimada, peso y objetivos.
- **Perfil**: tus gustos, lesiones y horarios (los usa el entrenador) y los datos del reloj vía intervals.icu: VO2max, pulso en reposo, pulso medio entrenando, zonas de pulso, forma y fatiga. Strava no deja que otras apps lean tus actividades, así que el reloj se conecta a intervals.icu a través de Garmin.
- **Avisos** por un bot de Telegram aparte, con botón para abrir la app.

No hay servidor propio: el cerebro vive en el mismo proyecto de Apps Script que tu agenda, y la app es una página estática. No gasta tokens de Claude.

```
app/            la app (HTML, CSS y JS sin dependencias) → GitHub Pages
apps-script/    Entreno.gs → se pega en el proyecto de Apps Script de la agenda
tests/          pruebas de la lógica de planificación (node)
tools/          genera los datos del modo demostración a partir de Entreno.gs
```

## Instalación (unos 15 minutos, una sola vez)

### 1. El cerebro, en el proyecto de la agenda

1. Abre el proyecto de Apps Script de la agenda (el de `Bot.gs`, `Surf.gs` y `Tareas.gs`).
2. Crea un archivo nuevo `Entreno.gs` y pega el contenido de [`apps-script/Entreno.gs`](apps-script/Entreno.gs).
3. En `Bot.gs`, dentro de `doPost`, añade **una línea** justo después de `const p = …`:

   ```js
   function doPost(e) {
     const ok = HtmlService.createHtmlOutput('ok');
     const p = (e && e.parameter) || {};
     if (p.app === 'entreno') return entrenoApi_(e);   // ← esta
     if (p.key !== key_() || p.tg !== '1' || !e.postData) return ok;
   ```

4. Crea otro archivo `MiPerfil.gs` copiando [`apps-script/MiPerfil.ejemplo.gs`](apps-script/MiPerfil.ejemplo.gs) y rellénalo con tus datos (nombre, ciudad, perfil y objetivos). Este archivo solo vive en tu Apps Script: no se sube al repositorio, así el código puede ser público sin que se vean tus datos.
5. **Configuración del proyecto → Propiedades del script**, añade:

   | Propiedad | Para qué | Dónde se consigue |
   |---|---|---|
   | `GROQ_API_KEY` | Chat rápido | console.groq.com → API Keys (gratis) |
   | `GEMINI_API_KEY` | Respaldo y resumen semanal | Ya la tienes de la agenda |
   | `ENT_TG_TOKEN` | Avisos | Crea un bot nuevo con @BotFather y pega su token |
   | `ENT_APP_URL` | Botón "Abrir la app" de los avisos | La dirección de la app (paso 2) |
   | `INTERVALS_KEY` y `INTERVALS_ATHLETE` | Datos del reloj (opcional) | Mejor desde la app: **Perfil → Reloj**, que comprueba que funcionan |

   Opcional: `GROQ_MODEL` si quieres otro modelo (por defecto `openai/gpt-oss-120b`).

6. Escribe cualquier cosa a tu bot nuevo de avisos en Telegram (así sabe a quién avisar).
7. Ejecuta `setupEntreno()` una vez y acepta los permisos. Crea la hoja **Entrenador**, mete tus datos de `MiPerfil.gs`, los estudios y los avisos automáticos, planifica la primera semana y deja en el registro la **URL de la API** y la **clave de la app**.
8. **Implementar → Gestionar implementaciones → editar (lápiz) → Versión: nueva → Implementar.** Sin esto la línea nueva de `doPost` no se activa. La URL no cambia.

### 2. La app, en GitHub Pages

GitHub Pages es gratis en repositorios **públicos** (en privados hace falta GitHub Pro). En este repositorio no hay ninguna clave ni dato personal: las claves están en las propiedades del script, tus datos en `MiPerfil.gs` y la URL y la clave de la app solo en tu móvil. Dos opciones:

- **Hacerlo público** (lo más sencillo): Settings → General → Change visibility → Public. Luego Settings → Pages → Source: **GitHub Actions**. Cada cambio en `app/` se publica solo en `https://<tu-usuario>.github.io/<repositorio>/`.
- **Mantenerlo privado**: conéctalo a Cloudflare Pages (gratis): Create → Pages → conecta el repositorio, sin comando de build y con `app` como carpeta de salida.

### 3. En el móvil

1. Abre la dirección de la app en Chrome.
2. Pega la URL de la API y la clave (o abre `https://…/<repositorio>/#u=<URL de la API>&k=<clave>` y se configura sola).
3. Menú de Chrome → **Añadir a pantalla de inicio**. Ya es una app.

Para verla sin conectar nada, pulsa **Probar con datos de ejemplo**.

## Qué hace solo

| Cuándo | Qué |
|---|---|
| Cada 30 min | Si pones estudio encima de un entreno, lo recoloca. Importa lo del reloj. Pregunta por las sesiones acabadas y recuerda reservar la piscina con 48 h. |
| 7:30 | Lo que toca hoy (y si la bici se cae por lluvia o frío). |
| 21:30 | Lo que queda por cerrar. |
| Domingo 16:00 | Busca estudios nuevos y solo guarda los que existen en Crossref con el mismo título. |
| Domingo 18:00 | Repaso de la semana y plan de la siguiente (bloques de 4 semanas, la 4.ª de descarga). |

## Si algo falla

- **La app dice "La clave no es correcta"**: copia otra vez `ENT_KEY` de las propiedades del script en Ajustes.
- **"Respuesta rara del servidor"**: falta el paso 1.8 (publicar una versión nueva).
- **El chat no contesta**: se ha acabado el cupo gratuito de Groq y Gemini del día. Los botones (hoy no puedo, mover, cerrar, series) funcionan igual porque no usan IA.
- **Sin cobertura en el gimnasio**: las series se guardan en el móvil y se envían solas al volver la conexión.

## Desarrollo

```
TZ=Europe/Madrid node tests/entreno.test.js   # pruebas de la planificación
TZ=Europe/Madrid node tools/make-demo.js      # regenera la demo tras tocar Entreno.gs
```

Para probar la app en local: `npx serve app` (o cualquier servidor estático) y abre el modo demostración.

Las fichas de ejercicios están en `app/data/ejercicios.js` y los dibujos en `app/figures.js` (cada postura son las coordenadas de las articulaciones). Ningún ejercicio viene todavía de tus reels de Instagram: cada ficha lo indica.
