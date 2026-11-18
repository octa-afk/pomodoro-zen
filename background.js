// Pomodoro — background timer (Firefox / Zen).
// La página de fondo es persistente (MV2), así que el timer corre de forma
// continua mientras el navegador esté abierto. El estado (fase, fin exacto,
// ajustes) se persiste en storage.local para sobrevivir reinicios.

const DEFAULTS = { studyMinutes: 25, breakMinutes: 5, themeColors: true, sound: true, pageCat: true };

// Escalas fijas de minutos: los botones − / + saltan al valor anterior o
// siguiente de la lista (si el valor actual no está en la lista, al más cercano
// en esa dirección).
const SCALES = {
  study: [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 75, 90],
  break: [1, 2, 3, 4, 5, 10, 15, 20, 25, 30]
};

function stepScale(scale, value, dir) {
  if (dir > 0) return scale.find((v) => v > value) ?? scale[scale.length - 1];
  return [...scale].reverse().find((v) => v < value) ?? scale[0];
}

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
// Fin de estudio: el descanso queda listo pero no corre hasta que el usuario
// confirme que dejó las tareas (el gato «espera»).
let waiting = false;

// Colores del tema activo de Zen (leídos vía browser.theme).
let themeColors = { available: false };

// ---------------------------------------------------------------- storage

function persist() {
  browser.storage.local.set({
    settings,
    timer: { phase, running, remaining, endTime, completed, waiting }
  });
}

async function load() {
  const data = await browser.storage.local.get(["settings", "timer"]);
  // Los paneles del gato arrancan cerrados al iniciar el navegador.
  browser.storage.local.remove("ui");
  settings = { ...DEFAULTS, ...(data.settings || {}) };
  const t = Object.assign(
    { phase: "study", running: false, remaining: settings.studyMinutes * 60, endTime: 0, completed: 0, waiting: false },
    data.timer || {}
  );
  phase = t.phase === "break" ? "break" : "study";
  running = t.running;
  remaining = t.remaining;
  endTime = t.endTime;
  completed = t.completed || 0;
  waiting = !!t.waiting && !running;

  await refreshTheme();

  // Recuperación tras reiniciar el navegador: si la fase terminó mientras
  // estaba cerrado, avanza una vez sin notificar.
  if (running) {
    const left = Math.ceil((endTime - Date.now()) / 1000);
    if (left > 0) {
      remaining = left;
    } else {
      advancePhase(false);
      running = false;
      waiting = true;
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
  if (waiting) waiting = false;
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
  waiting = false;
  phase = "study";
  remaining = settings.studyMinutes * 60;
  completed = 0;
  updateUI();
  persist();
}

function skipPhase() {
  running = false;
  waiting = false;
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
  const wasStudy = phase === "study";
  if (wasStudy) completed++;
  advancePhase(true);
  // Al terminar cualquier fase, la siguiente espera confirmación («¿Ya
  // terminamos?» / «¿Ya estamos listos?»). Se cierran el menú y el reloj del
  // gato en todas las pestañas para que el globo quede al frente.
  waiting = true;
  browser.storage.local.set({ ui: { menu: false, bubble: false, at: Date.now() } });
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

// Sprites del gato para el ícono de la barra (mismos PNG que usa el popup).
const CAT_FILES = ["estudiando_1", "esperando_1", "jugando_1", "jugando_2", "jugando_3", "jugando_4"];
const catImgs = {};
CAT_FILES.forEach((n) => {
  const img = new Image();
  img.onload = () => updateUI();
  img.src = browser.runtime.getURL("popup/cat/gato_" + n + ".png");
  catImgs[n] = img;
});

function catSprite() {
  if (waiting) return "esperando_1";
  if (phase === "study") return "estudiando_1";
  return "jugando_" + (running ? (Math.floor(Date.now() / 260) % 4) + 1 : 1);
}

// Dibuja el sprite centrado y ajustado al lado mayor en un canvas de 64 px.
const catIconCache = {};
function catImageData(name) {
  const img = catImgs[name];
  if (!img || !img.complete || !img.naturalWidth) return null;
  if (catIconCache[name]) return catIconCache[name];
  const S = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const g = canvas.getContext("2d");
  const k = Math.min(S / img.naturalWidth, S / img.naturalHeight);
  const w = img.naturalWidth * k, h = img.naturalHeight * k;
  g.drawImage(img, (S - w) / 2, S - h, w, h);
  catIconCache[name] = g.getImageData(0, 0, S, S);
  return catIconCache[name];
}

function updateUI() {
  const title = running
    ? `Pomodoro — ${PHASE_NAMES[phase]} ${fmt(remaining)}`
    : waiting
      ? `Pomodoro — esperando para ${phase === "break" ? "descansar" : "estudiar"} (${fmt(remaining)})`
      : `Pomodoro — pausado (${fmt(remaining)})`;

  const color = badgeColor();
  browser.browserAction.setTitle({ title });
  browser.browserAction.setIcon({ imageData: catImageData(catSprite()) || iconImageData(iconKind(), color) });

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
    iconUrl: browser.runtime.getURL("icons/huella.png"),
    title,
    message
  });
  if (settings.sound) {
    try {
      alarm.currentTime = 0;
      alarm.play().catch(() => {});
    } catch (e) {
      // Sin sonido disponible (p. ej. al reanudar); la notificación queda.
    }
  }
}

// Aviso de fin de fase: despertador de 8 bits y un maullidito (2.6 s).
const alarm = new Audio(browser.runtime.getURL("sounds/alarma.wav"));

// ---------------------------------------------------------------- mensajes

function snapshot() {
  return { settings, phase, running, remaining, endTime, completed, waiting, themeColors };
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
    case "resetPhase":
      // Solo reinicia la cuenta de la fase actual (sin cambiar de fase ni
      // tocar el contador de pomodoros). Queda detenido.
      running = false;
      remaining = (phase === "study" ? settings.studyMinutes : settings.breakMinutes) * 60;
      updateUI();
      persist();
      return snapshot();
    case "skipStart":
      // «Ir a descanso/estudio» desde el menú del gato: cambia de fase y arranca.
      skipPhase();
      startTimer();
      return snapshot();
    case "skip":
      skipPhase();
      return snapshot();
    case "stepStudy":
      settings.studyMinutes = stepScale(SCALES.study, settings.studyMinutes, msg.dir);
      if (!running && phase === "study") remaining = settings.studyMinutes * 60;
      updateUI();
      persist();
      return snapshot();
    case "stepBreak":
      settings.breakMinutes = stepScale(SCALES.break, settings.breakMinutes, msg.dir);
      if (!running && phase === "break") remaining = settings.breakMinutes * 60;
      updateUI();
      persist();
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
    case "toggleThemeColors":
      settings.themeColors = !settings.themeColors;
      updateUI();
      persist();
      return snapshot();
    case "toggleCat":
      settings.pageCat = !settings.pageCat;
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
