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
  $("phase").textContent = isStudy ? "Estudio" : "Descanso";
  $("phase").style.color = state.running ? (isStudy ? "var(--study)" : "var(--break)") : "var(--text-2)";

  $("sessions").textContent =
    state.completed > 0
      ? state.completed + (state.completed === 1 ? " pomodoro" : " pomodoros")
      : "";

  $("time").textContent = fmt(state.remaining);

  $("studyVal").textContent = state.settings.studyMinutes + " min";
  $("breakVal").textContent = state.settings.breakMinutes + " min";

  $("startPauseIcon").textContent = state.running ? "❚❚" : "▶";
  $("startPauseText").textContent = state.running ? "Pausar" : "Iniciar";

  $("autoStart").checked = !!state.settings.autoStart;
  $("themeColors").checked = !!state.settings.themeColors;
  $("sound").checked = !!state.settings.sound;

  applyThemeStyle();
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
  send({ type: "setStudy", value: state.settings.studyMinutes - 5 }));
$("studyPlus").addEventListener("click", () =>
  send({ type: "setStudy", value: state.settings.studyMinutes + 5 }));

$("breakMinus").addEventListener("click", () =>
  send({ type: "setBreak", value: state.settings.breakMinutes - 1 }));
$("breakPlus").addEventListener("click", () =>
  send({ type: "setBreak", value: state.settings.breakMinutes + 1 }));

$("autoStart").addEventListener("change", () => send({ type: "toggleAuto" }));
$("themeColors").addEventListener("change", () => send({ type: "toggleThemeColors" }));
$("sound").addEventListener("change", () => send({ type: "toggleSound" }));

setInterval(refresh, 250);
refresh();
