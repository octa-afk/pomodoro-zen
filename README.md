# Pomodoro para Zen Browser (Firefox)

Extensión Pomodoro con tiempos configurables de estudio y descanso, con UI
estilo Windows 11 (Fluent) y tema claro/oscuro automático.

## Qué hace

- **Badge en la barra de herramientas** con los minutos restantes; el ícono
  cambia de color según la fase (rojo = estudio, verde = descanso, gris = pausado).
- **Popup de configuración** (clic en el ícono):
  - Tiempo de estudio (±5 min) y de descanso (±1 min)
  - Iniciar / Pausar, Saltar fase, Reiniciar
  - Modo **Continuo**: encadena estudio → descanso → estudio…
  - **Usar colores del tema de Zen**: cuando está activado, el popup y el
    ícono toman los colores (fondo, texto, acento) del tema activo de
    Zen/Firefox y se actualizan solos si cambiás de tema. El descanso se
    distingue con un ícono de reloj hueco. Si se desactiva, se usan los
    colores Fluent fijos (rojo estudio / verde descanso).
  - Contador de pomodoros completados
- **Notificaciones nativas** al terminar cada fase.
- **Atajo de teclado**: `Alt+Shift+P` inicia/pausa (configurable en
  `about:addons` → engranaje → Administrar atajos de extensión).
- Los ajustes y el estado del timer se guardan: si reiniciás el navegador,
  el temporizador retoma donde estaba.

## Instalación en Zen

### Opción temporal (para probar)

1. Abrí `about:debugging#/runtime/this-firefox`
2. Clic en **Cargar complemento temporal…**
3. Elegí el archivo `manifest.json` de esta carpeta

Nota: con esta opción la extensión se descarga al cerrar el navegador.

### Opción permanente

Zen permite cargar extensiones sin firmar de forma permanente desde la
consola de depuración (`about:debugging`) solo mientras dure la sesión. Para
instalarla en firme, empaquetá la carpeta como zip (incluido en este repo
como `pomodoro-zen.zip`), renombralo a `.xpi` si tu versión de Zen lo pide, e
instalalo desde `about:addons` → engranaje → **Instalar complemento desde
archivo…** (requiere que Zen permita complementos sin firmar; en Zen suele
estar habilitado, en Firefox normal hay que usar Developer Edition o desactivar
`xpinstall.signatures.required`).

## Estructura

```
pomodoro-zen/
├── manifest.json      # Manifest V2 (Firefox/Zen)
├── background.js      # Timer persistente + lógica de fases y notificaciones
├── icons/
│   └── timer.svg      # Ícono estático (temporizador)
└── popup/
    ├── popup.html     # UI del popup
    ├── popup.css      # Estilo Windows 11 (Fluent), claro/oscuro
    └── popup.js       # Polling del estado + comandos
```
