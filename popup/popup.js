// Popup del Pomodoro: consulta el estado al background cada 250 ms y envía
// los comandos de configuración y control.

let state = null;

const $ = (id) => document.getElementById(id);

function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return (m < 10 ? "0" + m : "" + m) + ":" + (s < 10 ? "0" + s : "" + s);
}

function render() {
  if (!state) return;

  const isStudy = state.phase === "study";
  $("phase").textContent = state.waiting ? "Esperando" : isStudy ? "Estudio" : "Descanso";
  $("phase").style.color = state.running ? (isStudy ? "var(--study)" : "var(--break)") : "var(--text-2)";

  $("sessions").textContent =
    state.completed > 0
      ? state.completed + (state.completed === 1 ? " pomodoro" : " pomodoros")
      : "";

  $("time").textContent = fmt(state.remaining);

  $("studyVal").textContent = state.settings.studyMinutes + " min";
  $("breakVal").textContent = state.settings.breakMinutes + " min";

  $("startPauseIcon").textContent = state.running ? "❚❚" : "▶";
  $("startPauseText").textContent = state.running ? "Pausar" : state.waiting ? (isStudy ? "Comenzar estudio" : "Comenzar descanso") : "Iniciar";

  $("themeColors").checked = !!state.settings.themeColors;
  $("sound").checked = !!state.settings.sound;
  $("pageCat").checked = state.settings.pageCat !== false;

  applyThemeStyle();
  renderCat();
}

// ---------------------------------------------------------------- gato

// Estados: esperando (fin de estudio), estudiando y descansando. Al descansar
// juega con el ovillo (4 cuadros: el ovillo rueda, el hilo ondula, mueve la
// cola) y parpadea cada ~5 s.
const CAT_DIR = "cat/gato_";

function restSprite(now) {
  if (now % 5000 < 160) return "jugando_blink";
  return "jugando_" + ((Math.floor(now / 260) % 4) + 1);
}

// Animación mínima al estudiar/esperar: la cola se mueve cada ~0,8 s y
// parpadea un instante cada ~4 s.
function idleSprite(base, now) {
  if (now % 4200 < 160) return base + "_blink";
  return base + "_" + ((Math.floor(now / 800) % 2) + 1);
}

// Estudiando: 3 cuadros de assets/gato_estudiando_nuevo.jpg (cola y cabeza
// se mueven mientras lee). Ida y vuelta para que el movimiento sea suave.
const STUDY_SEQ = [1, 3, 2, 3];
function studySprite(now) {
  return "estudiando_" + STUDY_SEQ[Math.floor(now / 700) % STUDY_SEQ.length];
}

function renderCat() {
  let name;
  if (state.waiting) name = idleSprite("esperando", Date.now());
  else if (state.phase === "study") name = studySprite(Date.now());
  else name = restSprite(Date.now());
  const src = CAT_DIR + name + ".png";
  const img = $("cat");
  if (img.getAttribute("src") !== src) img.setAttribute("src", src);
}

// Con "Usar colores del tema de Zen" activado, sobrescribe las variables
// base del CSS con lo leído del tema activo; los derivados (bordes,
// hover, texto tenue) se recalculan solos vía color-mix.
const THEME_VARS = ["--bg", "--card", "--text", "--accent", "--accent-text"];

function luminance(hex) {
  const c = (hex.match(/[0-9a-f]{2}/gi) || []).map((x) => parseInt(x, 16) / 255);
  if (c.length < 3) return 0.5;
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function applyThemeStyle() {
  const rootStyle = document.documentElement.style;
  const t = state.themeColors;
  const useTheme = state.settings.themeColors && t && t.available;

  if (useTheme) {
    rootStyle.setProperty("--bg", t.bg);
    rootStyle.setProperty("--card", t.card);
    rootStyle.setProperty("--text", t.text);
    rootStyle.setProperty("--accent", t.accent);
    rootStyle.setProperty(
      "--accent-text",
      luminance(t.accent) > 0.55 ? "#1a1a1a" : "#ffffff"
    );
  } else {
    THEME_VARS.forEach((v) => rootStyle.removeProperty(v));
  }
}

async function refresh() {
  try {
    state = await browser.runtime.sendMessage({ type: "getState" });
    render();
  } catch (e) {
    // El background puede estar reiniciando; el próximo ciclo reintenta.
  }
}

function send(msg) {
  return browser.runtime.sendMessage(msg).then((s) => {
    state = s;
    render();
  });
}

// Controles
$("startPause").addEventListener("click", () => send({ type: "startPause" }));
$("skip").addEventListener("click", () => send({ type: "skip" }));
$("reset").addEventListener("click", () => send({ type: "reset" }));

$("studyMinus").addEventListener("click", () =>
  send({ type: "stepStudy", dir: -1 }));
$("studyPlus").addEventListener("click", () =>
  send({ type: "stepStudy", dir: 1 }));

$("breakMinus").addEventListener("click", () =>
  send({ type: "stepBreak", dir: -1 }));
$("breakPlus").addEventListener("click", () =>
  send({ type: "stepBreak", dir: 1 }));

$("themeColors").addEventListener("change", () => send({ type: "toggleThemeColors" }));
$("pageCat").addEventListener("change", () => send({ type: "toggleCat" }));
$("sound").addEventListener("change", () => send({ type: "toggleSound" }));

setInterval(refresh, 250);
setInterval(() => { if (state) renderCat(); }, 100);
refresh();
