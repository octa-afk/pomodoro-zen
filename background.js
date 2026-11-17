// Pomodoro — background timer (Firefox / Zen).
// La página de fondo es persistente (MV2), así que el timer corre de forma
// continua mientras el navegador esté abierto. El estado (fase, fin exacto,
// ajustes) se persiste en storage.local para sobrevivir reinicios.

const DEFAULTS = { studyMinutes: 25, breakMinutes: 5, autoStart: true, themeColors: true, sound: true };

const PHASE_NAMES = { study: "Estudio", break: "Descanso" };

// Colores fijos (cuando NO se usan los del tema de Zen).
const FIXED = {
  study: "#c42b1c",   // rojo tomate (Fluent)
  break: "#0f7b0f",   // verde Fluent
  paused: "#767676"   // gris neutro
};

// Fase: "study" | "break"
let settings = { ...DEFAULTS };
let phase = "study";
let running = false;
let remaining = DEFAULTS.studyMinutes * 60;
let endTime = 0;
let completed = 0;

// Colores del tema activo de Zen (leídos vía browser.theme).
let themeColors = { available: false };

// ---------------------------------------------------------------- storage

function persist() {
  browser.storage.local.set({
    settings,
    timer: { phase, running, remaining, endTime, completed }
  });
}

async function load() {
  const data = await browser.storage.local.get(["settings", "timer"]);
  settings = { ...DEFAULTS, ...(data.settings || {}) };
  const t = Object.assign(
    { phase: "study", running: false, remaining: settings.studyMinutes * 60, endTime: 0, completed: 0 },
    data.timer || {}
  );
  phase = t.phase === "break" ? "break" : "study";
  running = t.running;
  remaining = t.remaining;
  endTime = t.endTime;
  completed = t.completed || 0;

  await refreshTheme();

  // Recuperación tras reiniciar el navegador: si la fase terminó mientras
  // estaba cerrado, avanza una vez sin notificar.
  if (running) {
    const left = Math.ceil((endTime - Date.now()) / 1000);
    if (left > 0) {
      remaining = left;
    } else {
      advancePhase(false);
      running = settings.autoStart;
      if (running) startTimer();
    }
  } else if (phase === "study") {
    remaining = Math.min(remaining, settings.studyMinutes * 60);
  }
  updateUI();
  persist();
}

// ---------------------------------------------------------------- tema de Zen

// Mapea los colores del tema activo a los 4 que usa la extensión:
// fondo, superficie (card), texto y acento. Si el tema no expone lo
// necesario (p. ej. el tema por defecto), queda disponible: false y se
// cae al estilo Fluent fijo.
function refreshTheme() {
  return browser.theme.getCurrent().then((theme) => {
    const c = (theme && theme.colors) || {};
    const bg = c.toolbar || c.frame || null;
    const card = c.toolbar_field || null;
    const text = c.toolbar_text || c.bookmark_text || null;
    const accent = c.icons_attention || c.icons || null;
    themeColors = bg && text && accent
      ? { available: true, bg, card: card || bg, text, accent }
      : { available: false };
  }).catch(() => {
    themeColors = { available: false };
  });
}

// Zen avisa cuando el usuario cambia de tema.
browser.theme.onUpdated.addListener(() => {
  refreshTheme().then(updateUI);
});

// ---------------------------------------------------------------- timer

function startTimer() {
  if (running) return;
  endTime = Date.now() + remaining * 1000;
  running = true;
  updateUI();
  persist();
}

function startPause() {
  if (running) {
    remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    running = false;
  } else {
    endTime = Date.now() + remaining * 1000;
    running = true;
  }
  updateUI();
  persist();
}

function resetTimer() {
  running = false;
  phase = "study";
  remaining = settings.studyMinutes * 60;
  completed = 0;
  updateUI();
  persist();
}

function skipPhase() {
  running = false;
  advancePhase(true);
  updateUI();
  persist();
}

// Pasa a la siguiente fase (sin tocar notificaciones ni arranque automático).
function advancePhase(announce) {
  if (phase === "study") {
    phase = "break";
    remaining = settings.breakMinutes * 60;
    if (announce) notify("Pomodoro terminado", `Descanso de ${settings.breakMinutes} min`);
  } else {
    phase = "study";
    remaining = settings.studyMinutes * 60;
    if (announce) notify("Descanso terminado", `De vuelta al estudio: ${settings.studyMinutes} min`);
  }
}

function completePhase() {
  running = false;
  if (phase === "study") completed++;
  advancePhase(true);
  if (settings.autoStart) startTimer();
  updateUI();
  persist();
}

setInterval(() => {
  if (!running) return;
  remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  if (remaining <= 0) completePhase();
  else updateUI();
}, 250);

// ---------------------------------------------------------------- colores

function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return (m < 10 ? "0" + m : "" + m) + ":" + (s < 10 ? "0" + s : "" + s);
}

// Mezcla dos colores "#rrggbb" (t = 0 devuelve a, t = 1 devuelve b).
function mix(a, b, t) {
  const pa = a.match(/[0-9a-f]{2}/gi) || [];
  const pb = b.match(/[0-9a-f]{2}/gi) || [];
  if (pa.length < 3 || pb.length < 3) return a;
  const ch = (i) => Math.round(parseInt(pa[i], 16) + (parseInt(pb[i], 16) - parseInt(pa[i], 16)) * t);
  return "#" + [0, 1, 2].map((i) => ch(i).toString(16).padStart(2, "0")).join("");
}

// Color del ícono/badge según la fase y la preferencia de tema.
function badgeColor() {
  if (settings.themeColors && themeColors.available) {
    if (!running) return mix(themeColors.text, themeColors.bg, 0.55);
    return themeColors.accent;
  }
  if (!running) return FIXED.paused;
  return phase === "study" ? FIXED.study : FIXED.break;
}

// Con tema activo: estudio = reloj lleno, descanso = reloj hueco (anillo).
// Sin tema: siempre lleno, y la fase se distingue por color.
function iconKind() {
  if (settings.themeColors && themeColors.available && running && phase === "break") return "ring";
  return "filled";
}

// Dibuja el reloj en canvas y lo usa como ícono del botón.
const iconCache = {};
function iconImageData(kind, color) {
  const key = kind + color;
  if (iconCache[key]) return iconCache[key];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const g = canvas.getContext("2d");
  g.lineCap = "round";

  if (kind === "ring") {
    g.beginPath();
    g.arc(16, 16, 11, 0, Math.PI * 2);
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.stroke();
    g.strokeStyle = color;
    g.lineWidth = 2.5;
  } else {
    g.beginPath();
    g.arc(16, 16, 13, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
    g.strokeStyle = "#ffffff";
    g.lineWidth = 2.5;
  }

  g.beginPath();
  g.moveTo(16, 16);
  g.lineTo(16, 9);
  g.moveTo(16, 16);
  g.lineTo(20.5, 18.5);
  g.stroke();

  iconCache[key] = g.getImageData(0, 0, 32, 32);
  return iconCache[key];
}

function updateUI() {
  const title = running
    ? `Pomodoro — ${PHASE_NAMES[phase]} ${fmt(remaining)}`
    : `Pomodoro — pausado (${fmt(remaining)})`;

  const color = badgeColor();
  browser.browserAction.setTitle({ title });
  browser.browserAction.setIcon({ imageData: iconImageData(iconKind(), color) });

  // Badge: minutos restantes; bajo 1 min muestra segundos ("0:59").
  const badge = remaining >= 60
    ? String(Math.floor(remaining / 60))
    : "0:" + String(remaining % 60).padStart(2, "0");
  browser.browserAction.setBadgeText({ text: badge });
  browser.browserAction.setBadgeBackgroundColor({ color });
}

function notify(title, message) {
  browser.notifications.create({
    type: "basic",
    iconUrl: browser.runtime.getURL("icons/timer.svg"),
    title,
    message
  });
  if (settings.sound) {
    try {
      chime.currentTime = 0;
      chime.play().catch(() => {});
    } catch (e) {
      // Sin sonido disponible (p. ej. al reanudar); la notificación queda.
    }
  }
}

// Campana de fin de fase (ding-dong sintetizado, 1.5 s).
const chime = new Audio(browser.runtime.getURL("sounds/chime.wav"));

// ---------------------------------------------------------------- mensajes

function snapshot() {
  return { settings, phase, running, remaining, endTime, completed, themeColors };
}

browser.runtime.onMessage.addListener((msg) => {
  switch (msg && msg.type) {
    case "getState":
      return snapshot();
    case "startPause":
      startPause();
      return snapshot();
    case "reset":
      resetTimer();
      return snapshot();
    case "skip":
      skipPhase();
      return snapshot();
    case "setStudy": {
      settings.studyMinutes = Math.max(1, parseInt(msg.value, 10) || 25);
      if (!running && phase === "study") remaining = settings.studyMinutes * 60;
      updateUI();
      persist();
      return snapshot();
    }
    case "setBreak": {
      settings.breakMinutes = Math.max(1, parseInt(msg.value, 10) || 5);
      if (!running && phase === "break") remaining = settings.breakMinutes * 60;
      updateUI();
      persist();
      return snapshot();
    }
    case "toggleAuto":
      settings.autoStart = !settings.autoStart;
      persist();
      return snapshot();
    case "toggleThemeColors":
      settings.themeColors = !settings.themeColors;
      updateUI();
      persist();
      return snapshot();
    case "toggleSound":
      settings.sound = !settings.sound;
      persist();
      return snapshot();
  }
  return undefined;
});

browser.commands.onCommand.addListener((command) => {
  if (command === "toggle-timer") {
    startPause();
  }
});

load();
