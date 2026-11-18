// Gato que pasea por el borde inferior de la página. El estado (fase, si
// corre, si espera) y el ajuste «pageCat» llegan por storage.local, que el
// background actualiza en cada cambio, así no hay polling desde cada pestaña.
// Se puede arrastrar con el mouse para sacarlo del medio; doble clic lo
// devuelve a su lugar. Clic izquierdo: muestra el temporizador (mm:ss).
// Clic derecho: abre un menú para configurar los minutos de estudio y descanso.
(() => {
  if (window.top !== window || document.getElementById("pomodoro-zen-cat")) return;

  const SCALE = 0.5;            // los PNG vienen a x4; se muestran a x2
  const HOP_MS = 380;           // duración de cada saltito
  const HOP_DIST = 34;          // px que avanza por saltito
  const HOP_HEIGHT = 16;        // altura del salto
  const BALL = 18;              // ancho del ovillo suelto (px)
  const BALL_H = 16;            // alto del ovillo suelto (px)
  const BALL_SLOT = { 1: 48, "-1": 8 };   // dónde está el ovillo en el sprite (px desde la izquierda)
  const BALL_LIFT = 4;          // alto del ovillo sobre la base del sprite (px)
  const RUN_SPEED = 170;        // px/s al correr tras el ovillo
  const GRAVITY = 1400;         // px/s²
  const BASE = browser.runtime.getURL("popup/cat/gato_");

  const host = document.createElement("div");
  host.id = "pomodoro-zen-cat";
  // El contenedor no captura clics; solo el gato (img) lo hace.
  host.style.cssText =
    "all:initial;position:fixed;left:0;bottom:0;width:100%;height:0;" +
    "z-index:2147483647;pointer-events:none;";
  const root = host.attachShadow({ mode: "closed" });
  const img = document.createElement("img");
  img.style.cssText =
    "position:absolute;left:0;bottom:0;image-rendering:pixelated;" +
    "pointer-events:auto;cursor:grab;user-select:none;touch-action:none;" +
    "will-change:transform;";
  img.alt = "";
  img.draggable = false;
  root.appendChild(img);

  // Ovillo suelto: aparece cuando el gato lo tira y lo persigue.
  const ball = document.createElement("img");
  ball.style.cssText =
    "position:absolute;left:0;bottom:0;display:none;image-rendering:pixelated;" +
    `pointer-events:none;width:${BALL}px;height:${BALL_H}px;will-change:transform;`;
  ball.alt = "";
  ball.src = BASE.replace("gato_", "ovillo_") + "1.png";
  root.appendChild(ball);

  // Menú de configuración (se abre al hacer clic en el gato).
  const style = document.createElement("style");
  style.textContent = `
    /* Pixel art: esquinas escalonadas con box-shadow, sin bordes redondeados. */
    .menu { all: initial; position: absolute; display: none; pointer-events: auto;
      box-sizing: border-box; width: 214px; padding: 12px 14px; margin: 4px;
      font: 700 13px/1.3 ui-monospace,"DejaVu Sans Mono","Cascadia Mono",Consolas,monospace;
      letter-spacing: .02em; -webkit-font-smoothing: none; font-smooth: never;
      color: #2a2140; background: #efeafa; user-select: none;
      box-shadow: 0 -4px 0 0 #2a2140, 0 4px 0 0 #2a2140, -4px 0 0 0 #2a2140, 4px 0 0 0 #2a2140,
                  8px 8px 0 0 rgba(42,33,64,.28); }
    .menu.open { display: block; }
    /* Globo de diálogo «¿Ya terminamos?» con colita escalonada. */
    .menu.ask { width: auto; padding: 10px 14px; text-align: center; white-space: nowrap; }
    .menu.ask .q { font-size: 14px; }
    .menu.ask::after { content: ""; position: absolute; left: calc(50% - 8px); bottom: -4px;
      width: 16px; height: 4px; background: #efeafa;
      box-shadow: -4px 0 0 0 #2a2140, 4px 0 0 0 #2a2140; }
    .menu.ask::before { content: ""; position: absolute; left: calc(50% - 4px); bottom: -8px;
      width: 8px; height: 4px; background: #efeafa;
      box-shadow: -4px 0 0 0 #2a2140, 4px 0 0 0 #2a2140, 0 4px 0 0 #2a2140; }
    .menu.ask.below::before, .menu.ask.below::after { display: none; }
    .ok { width: 22px; height: 18px; padding: 0; margin: 6px 2px 2px; background: #b9a6e8; line-height: 0; }
    .ok:hover { background: #aa95e2; }
    .ok:active { background: #9a84da; }
    /* Palomita en pixel art (celdas de 2 px). */
    .tick { display: inline-block; position: relative; width: 14px; height: 10px; }
    .tick::after { content: ""; position: absolute; left: 0; top: 4px; width: 2px; height: 2px;
      background: #2a2140;
      box-shadow: 2px 2px 0 #2a2140, 4px 4px 0 #2a2140, 6px 2px 0 #2a2140,
                  8px 0 0 #2a2140, 10px -2px 0 #2a2140, 12px -4px 0 #2a2140; }
    .menu.timer { width: auto; min-width: 120px; padding: 8px 14px; text-align: center; }
    .menu.timer .phase { font-size: 11px; opacity: .75; text-transform: uppercase; }
    .menu.timer .clock { font-size: 28px; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .menu * { box-sizing: border-box; font: inherit; color: inherit; }
    .row { display: flex; align-items: center; justify-content: space-between; margin: 8px 0; }
    .label { opacity: .75; }
    .stepper { display: flex; align-items: center; gap: 6px; }
    .val { min-width: 52px; text-align: center; font-variant-numeric: tabular-nums; }
    button { cursor: pointer; border: 0; border-radius: 0; background: #d9cff5; margin: 2px;
      box-shadow: 0 -2px 0 0 #2a2140, 0 2px 0 0 #2a2140, -2px 0 0 0 #2a2140, 2px 0 0 0 #2a2140; }
    button:hover { background: #cbbdf0; }
    button:active { background: #b9a6e8; transform: translateY(2px); }
    .step { width: 18px; height: 18px; line-height: 1; font-size: 12px; padding: 0; }
    .go { display: block; width: calc(100% - 4px); height: 30px; margin: 12px 2px 2px;
      background: #b9a6e8; }
    .go:hover { background: #aa95e2; }
    .go:active { background: #9a84da; }
    .acts { display: flex; gap: 8px; margin: 8px 2px 2px; }
    .act { flex: 1; height: 26px; margin: 2px; font-size: 12px; padding: 0 4px; white-space: nowrap; }`;
  root.appendChild(style);

  const menu = document.createElement("div");
  menu.className = "menu";
  menu.innerHTML = `
    <div class="row"><span class="label">Estudio</span>
      <span class="stepper"><button class="step" data-k="study" data-d="-1">−</button>
        <span class="val" id="studyVal"></span>
        <button class="step" data-k="study" data-d="1">+</button></span></div>
    <div class="row"><span class="label">Descanso</span>
      <span class="stepper"><button class="step" data-k="break" data-d="-1">−</button>
        <span class="val" id="breakVal"></span>
        <button class="step" data-k="break" data-d="1">+</button></span></div>
    <button class="go" id="go"></button>
    <div class="acts"><button class="act" id="reset">Reiniciar</button>
      <button class="act" id="skip"></button></div>`;
  root.appendChild(menu);
  const $m = (id) => menu.querySelector("#" + id);

  // Burbuja con el temporizador (clic izquierdo).
  const bubble = document.createElement("div");
  bubble.className = "menu timer";
  bubble.innerHTML = `<div class="phase" id="tPhase"></div><div class="clock" id="tClock"></div>`;
  root.appendChild(bubble);
  bubble.addEventListener("pointerdown", (e) => e.stopPropagation());
  let bubbleOpen = false;

  // Globo «¿Ya terminamos?»: aparece solo mientras el gato espera.
  const ask = document.createElement("div");
  ask.className = "menu ask";
  ask.innerHTML = `<div class="q">¿Ya terminamos?</div>
    <button class="ok" id="ok" title="Comenzar descanso" aria-label="Comenzar descanso"><span class="tick"></span></button>`;
  root.appendChild(ask);
  ask.addEventListener("pointerdown", (e) => e.stopPropagation());
  ask.querySelector("#ok").addEventListener("click", () => {
    timer = Object.assign({}, timer, { waiting: false });   // se oculta ya, sin esperar al storage
    browser.runtime.sendMessage({ type: "startPause" });
  });

  function remainingSec() {
    if (timer.running) return Math.max(0, Math.ceil((timer.endTime - Date.now()) / 1000));
    return Math.max(0, timer.remaining || 0);
  }
  function fmt(sec) {
    const m = Math.floor(sec / 60), r = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
  }
  function renderBubble() {
    bubble.querySelector("#tPhase").textContent =
      timer.waiting ? "Esperando" : timer.phase === "study" ? "Estudio" : "Descanso";
    bubble.querySelector("#tClock").textContent = fmt(remainingSec());
  }

  let mins = { study: 25, break: 5 };
  let menuOpen = false;

  function renderMenu() {
    $m("studyVal").textContent = mins.study + " min";
    $m("breakVal").textContent = mins.break + " min";
    $m("go").textContent = timer.running ? "Pausar" : timer.waiting ? "Comenzar descanso" : "Iniciar";
    // «Pasar a descanso» (o a estudio si ya estás descansando). En espera el
    // botón principal ya inicia el descanso, así que se oculta.
    const skip = $m("skip");
    skip.style.display = timer.waiting ? "none" : "";
    skip.textContent = timer.phase === "study" ? "Ir a descanso" : "Ir a estudio";
  }

  menu.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    touch();
    if (b.id === "go") { browser.runtime.sendMessage({ type: "startPause" }); return; }
    if (b.id === "reset") { browser.runtime.sendMessage({ type: "resetPhase" }); return; }
    if (b.id === "skip") { browser.runtime.sendMessage({ type: "skipStart" }); return; }
    touch();
    const k = b.dataset.k;
    // El background aplica la escala fija y devuelve el valor nuevo.
    browser.runtime.sendMessage({ type: k === "study" ? "stepStudy" : "stepBreak", dir: parseInt(b.dataset.d, 10) })
      .then((st) => { if (st && st.settings) { mins = { study: st.settings.studyMinutes, break: st.settings.breakMinutes }; renderMenu(); } })
      .catch(() => {});
  });
  // El menú no debe iniciar un arrastre ni dejar pasar clics a la página.
  menu.addEventListener("pointerdown", (e) => e.stopPropagation());

  // El estado abierto/cerrado de los dos paneles se comparte entre todas las
  // pestañas y ventanas vía storage.local (clave «ui»): si abrís el menú en
  // una, se abre en todas, y al cerrarlo se cierra en todas. Nunca están
  // abiertos los dos a la vez.
  function setUI(m, b, sync = true) {
    if (m && b) b = false;
    if (m === menuOpen && b === bubbleOpen) return;
    menuOpen = m;
    bubbleOpen = b;
    menu.classList.toggle("open", m);
    bubble.classList.toggle("open", b);
    if (m) renderMenu();
    if (b) renderBubble();
    uiAt = Date.now();
    if (sync) {
      try { browser.storage.local.set({ ui: { menu: m, bubble: b, at: uiAt } }); } catch (_) { /* sin storage */ }
    }
  }
  // Se ocultan solos a los 15 s sin uso (el instante de apertura viaja en
  // «ui.at», así todas las pestañas cuentan desde el mismo momento).
  const AUTO_HIDE_MS = 15000;
  let uiAt = 0;
  function touch() {
    if (!menuOpen && !bubbleOpen) return;
    uiAt = Date.now();
    try { browser.storage.local.set({ ui: { menu: menuOpen, bubble: bubbleOpen, at: uiAt } }); } catch (_) { /* sin storage */ }
  }
  const setMenu = (open, sync) => setUI(open, false, sync);
  const setBubble = (open, sync) => setUI(false, open, sync);

  // Clic fuera del gato y del menú lo cierra (el target se reasigna al host).
  window.addEventListener("pointerdown", (e) => {
    if (e.target !== host) { if (menuOpen) setMenu(false); if (bubbleOpen) setBubble(false); }
  }, true);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (menuOpen) setMenu(false); if (bubbleOpen) setBubble(false); }
  }, true);

  let timer = { phase: "study", running: false, waiting: false };
  let enabled = true;
  let attached = false;

  // Posición: x desde la izquierda, y = distancia al borde inferior.
  let x = 16, y = 0, dir = 1;
  let placed = false;           // el usuario lo movió: no volver a la esquina
  // Descanso: juega con el ovillo, lo tira lejos, lo persigue y lo trae de vuelta.
  //   play   → ovillo entre las patas (4 cuadros de juego)
  //   throw  → pata arriba: acaba de lanzarlo
  //   watch  → lo mira volar, en acecho
  //   chase  → corre (camina/salto) y al acercarse se estira hacia él
  //   caught → lo atrapó: un instante parado antes de volver a jugar
  let rest = { state: "play", until: 0, next: 0 };
  let hopY = 0;
  let b = { x: 0, y: 0, vx: 0, vy: 0, floor: 0, run: 0 };   // ovillo suelto
  let last = 0;

  // Arrastre
  let drag = null;              // { dx, dy, sx, sy, moved }

  function width() { return (img.naturalWidth || 0) * SCALE; }
  function height() { return (img.naturalHeight || 0) * SCALE; }
  function maxX() { return Math.max(0, window.innerWidth - width() - 8); }
  function maxY() { return Math.max(0, window.innerHeight - height()); }
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  img.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    drag = { dx: e.clientX - x, dy: (window.innerHeight - e.clientY) - y,
             sx: e.clientX, sy: e.clientY, moved: false };
    img.setPointerCapture(e.pointerId);
    img.style.cursor = "grabbing";
  });

  img.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) return;
    drag.moved = true;
    x = clamp(e.clientX - drag.dx, 0, maxX());
    y = clamp(window.innerHeight - e.clientY - drag.dy, 0, maxY());
    placed = true;
  });

  function endDrag(e) {
    if (!drag) return;
    const wasClick = !drag.moved && e.type === "pointerup";
    drag = null;
    if (wasClick) setBubble(!bubbleOpen);
    img.style.cursor = "grab";
    try { img.releasePointerCapture(e.pointerId); } catch (_) { /* ya liberado */ }
  }
  img.addEventListener("pointerup", endDrag);
  img.addEventListener("pointercancel", endDrag);

  // Clic derecho: menú de configuración (se anula el menú del navegador).
  img.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu(!menuOpen);
  });

  // Doble clic: vuelve a su lugar habitual.
  img.addEventListener("dblclick", (e) => {
    e.preventDefault();
    setMenu(false);
    setBubble(false);
    placed = false;
    y = 0;
  });

  function setSprite(name) {
    const src = BASE + name + ".png";
    if (img.getAttribute("src") !== src) img.setAttribute("src", src);
  }

  // Animación mínima: la cola se mueve cada ~0,8 s y parpadea cada ~4 s.
  function idleSprite(base, now) {
    if (now % 4200 < 160) return base + "_blink";
    return base + "_" + ((Math.floor(now / 800) % 2) + 1);
  }

  // Jugando con el ovillo: 4 cuadros (el ovillo rueda, el hilo ondula, la cola
  // se mueve) y un parpadeo cada ~5 s. En el aire usa el cuadro de la cola alzada.
  function playSprite(now) {
    if (now % 5000 < 160) return "jugando_blink";
    return "jugando_" + ((Math.floor(now / 260) % 4) + 1);
  }

  // Poses de la hoja assets/gato_descansando.jpg.
  function chaseSprite(now) {
    if (rest.state === "throw") return "sin_2";
    if (rest.state === "watch") return "acecho";
    if (rest.state === "caught") return "parado";
    if (rest.near) return "estira";
    return Math.floor(now / 140) % 2 ? "salto" : "camina";
  }

  // Estudiando: 3 cuadros de assets/gato_estudiando_nuevo.jpg, ida y vuelta.
  const STUDY_SEQ = [1, 3, 2, 3];
  function studySprite(now) {
    return "estudiando_" + STUDY_SEQ[Math.floor(now / 700) % STUDY_SEQ.length];
  }

  function pickSprite(now) {
    if (timer.waiting) return idleSprite("esperando", Date.now());
    if (timer.phase === "study") return studySprite(Date.now());
    return rest.state === "play" ? playSprite(Date.now()) : chaseSprite(Date.now());
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!enabled || !attached) return;
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;

    const resting = timer.phase === "break" && !timer.waiting && timer.running;
    hopY = 0;

    if (!drag) {
      if (resting && !menuOpen && !bubbleOpen) {
        const t = Date.now();
        const slot = () => x + BALL_SLOT[dir];                 // borde izquierdo del ovillo en el sprite
        if (rest.state === "play") {
          if (!rest.until) rest.until = t + 3000 + Math.random() * 3000;
          if (t >= rest.until) {
            // Tira el ovillo hacia donde haya más lugar.
            const roomR = window.innerWidth - x, roomL = x;
            if ((dir === 1 && roomR < 220 && roomL > roomR) || (dir === -1 && roomL < 220 && roomR > roomL)) dir = -dir;
            b = { x: slot(), y: y + BALL_LIFT, floor: y + BALL_LIFT, run: 0,
                  vx: dir * (260 + Math.random() * 160), vy: 420 + Math.random() * 120 };
            rest.state = "throw";
            rest.next = t + 250;
          }
        } else {
          if (rest.state === "throw" && t >= rest.next) { rest.state = "watch"; rest.next = t + 450; }
          else if (rest.state === "watch" && t >= rest.next) rest.state = "chase";
          else if (rest.state === "caught" && t >= rest.next) {
            // Vuelve a la pose de juego con el ovillo entre las patas.
            x = clamp(b.x - BALL_SLOT[dir], 0, maxX());
            rest.state = "play";
            rest.until = t + 3500 + Math.random() * 3500;
          }
          if (rest.state === "chase") {
            // Corre hacia el ovillo, mirando hacia él.
            const target = b.x + BALL / 2;
            const center = x + width() / 2;
            if (Math.abs(target - center) > 6) dir = target >= center ? 1 : -1;
            x = clamp(x + dir * RUN_SPEED * dt, 0, maxX());
            const nose = dir === 1 ? x + width() - 4 : x + 4;
            const gap = Math.abs(target - nose);
            rest.near = gap < 50;
            // Alcanzado con la nariz y casi quieto: lo atrapa.
            if (gap < 12 && Math.abs(b.vx) < 80 && b.y - b.floor < 8) {
              rest.state = "caught"; rest.near = false; rest.next = t + 450;
              b.vx = 0; b.vy = 0; b.y = b.floor;
            }
          }
          // Física del ovillo suelto: parábola, rebotes, rozamiento y paredes.
          b.vy -= GRAVITY * dt;
          b.y += b.vy * dt;
          if (b.y <= b.floor) {
            b.y = b.floor;
            b.vy = Math.abs(b.vy) > 140 ? -b.vy * 0.45 : 0;
            if (b.vy === 0) { b.vx *= Math.max(0, 1 - 2.2 * dt); if (Math.abs(b.vx) < 6) b.vx = 0; }
          }
          const nx = b.x + b.vx * dt;
          const lim = window.innerWidth - 40;   // alcanzable por el gato en el borde derecho
          if (nx < 0 || nx > lim) { b.vx = -b.vx * 0.6; b.x = clamp(nx, 0, lim); }
          else b.x = nx;
          b.run += Math.abs(b.vx * dt);
        }
      } else if (!resting && !placed) {
        // Estudiando / esperando / pausado: quieto en la esquina derecha.
        x = maxX(); dir = 1;
      }
      // Mantenerlo dentro de la ventana si cambió de tamaño.
      x = clamp(x, 0, maxX());
      y = clamp(y, 0, maxY());
    }

    if (!resting) { rest.state = "play"; rest.until = 0; rest.near = false; }
    const ballOut = resting && rest.state !== "play";
    setSprite(pickSprite(now));
    if (ballOut) {
      ball.style.display = "block";
      ball.style.transform = `translate(${Math.round(b.x)}px, ${-Math.round(b.y)}px)`;
      const ballSrc = BASE.replace("gato_", "ovillo_") + ((Math.floor(b.run / 8) % 2) + 1) + ".png";
      if (ball.getAttribute("src") !== ballSrc) ball.setAttribute("src", ballSrc);
    } else if (ball.style.display !== "none") ball.style.display = "none";
    if (img.naturalWidth) img.style.width = width() + "px";
    img.style.transform = `translate(${Math.round(x)}px, ${-Math.round(y + hopY)}px) scaleX(${dir})`;
    img.style.transformOrigin = "center bottom";

    // Encima del gato si hay lugar; si no, debajo. Centrado y dentro de la ventana.
    const place = (el) => {
      el.classList.remove("below");
      const mw = el.offsetWidth, mh = el.offsetHeight;
      el.style.left = clamp(x + width() / 2 - mw / 2, 4, Math.max(4, window.innerWidth - mw - 4)) + "px";
      const above = y + height() + 8;
      if (above + mh <= window.innerHeight) el.style.bottom = above + "px";
      else { el.style.bottom = Math.max(4, y - mh - 8) + "px"; el.classList.add("below"); }
    };
    if ((menuOpen || bubbleOpen) && !drag && Date.now() - uiAt >= AUTO_HIDE_MS) setUI(false, false);
    const askOpen = timer.waiting && !menuOpen && !bubbleOpen;
    ask.classList.toggle("open", askOpen);
    if (askOpen) place(ask);
    if (menuOpen) place(menu);
    if (bubbleOpen) { renderBubble(); place(bubble); }
  }

  function apply() {
    if (enabled && !attached) { document.documentElement.appendChild(host); attached = true; }
    else if (!enabled && attached) { host.remove(); attached = false; }
  }

  function read(data) {
    if (data.timer) timer = data.timer;
    if (data.settings) {
      enabled = data.settings.pageCat !== false;
      mins = { study: data.settings.studyMinutes || 25, break: data.settings.breakMinutes || 5 };
    }
    apply();
    if (data.ui) {
      setUI(!!data.ui.menu, !!data.ui.bubble, false);
      if (data.ui.at) uiAt = data.ui.at;
    }
    if (!enabled) { setUI(false, false, false); ask.classList.remove("open"); }
    if (menuOpen) renderMenu();
  }

  browser.storage.local.get(["timer", "settings", "ui"]).then((d) => { read(d); requestAnimationFrame(frame); });
  browser.storage.onChanged.addListener((ch) => {
    read({
      timer: ch.timer && ch.timer.newValue,
      settings: ch.settings && ch.settings.newValue,
      ui: ch.ui && ch.ui.newValue
    });
  });
})();
