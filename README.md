# Pomodoro para Zen Browser (Firefox)

Extensión Pomodoro con tiempos configurables de estudio y descanso, con UI
estilo Windows 11 (Fluent) y tema claro/oscuro automático.

## Qué hace

- **Badge en la barra de herramientas** con los minutos restantes; el ícono es el gato del estado actual (si no carga, un reloj que
  cambia de color según la fase: rojo = estudio, verde = descanso, gris = pausado).
- **Popup de configuración** (clic en el ícono):
  - Tiempo de estudio (1, 5, 10 … 60, 75, 90 min) y de descanso (1–5, 10, 15 … 30 min), con escalas fijas
  - Iniciar / Pausar, Saltar fase, Reiniciar
  - Modo **Continuo**: encadena estudio → descanso → estudio…
  - **Usar colores del tema de Zen**: cuando está activado, el popup y el
    ícono toman los colores (fondo, texto, acento) del tema activo de
    Zen/Firefox y se actualizan solos si cambiás de tema. El descanso se
    distingue con un ícono de reloj hueco. Si se desactiva, se usan los
    colores Fluent fijos (rojo estudio / verde descanso).
  - Contador de pomodoros completados
  - **Sonido de campana** al terminar cada fase (ding-dong sintetizado,
    se puede desactivar)
- **Gato pixel-art** en el popup con tres estados:
  - *Estudiando*: echado leyendo con anteojos; mueve la cola mientras lee.
  - *Esperando*: terminó el estudio. El descanso queda listo pero **no corre**
    hasta que toques **Comenzar descanso** (o `Alt+Shift+P`), para que cierres
    lo que estabas haciendo. El modo Continuo solo aplica al terminar el descanso.
  - *Descansando*: juega con un ovillo de lana (el ovillo rueda, el hilo ondula, mueve la cola y parpadea).
- **Gato paseando por la página**: un script inyectado dibuja al gato en el
  borde inferior de cada pestaña (no captura clics). Estudiando y esperando se
  queda en la esquina con una animación mínima (mueve la cola y parpadea); al descansar juega con el ovillo, lo tira lejos,
  lo mira en acecho, corre tras él, se estira para atraparlo y lo trae de vuelta. Se puede arrastrar con el mouse (mantené el clic sobre él) para sacarlo del medio; doble clic lo devuelve a su lugar. Al terminar el estudio, el gato muestra un globo «¿Ya terminamos?» con una palomita para confirmar y comenzar el descanso. El temporizador y el menú se ocultan solos a los 15 s y su estado abierto/cerrado se comparte entre pestañas. Clic izquierdo sobre el gato muestra el temporizador (mm:ss); clic derecho abre un menú para cambiar los minutos de estudio y descanso e iniciar, pausar, reiniciar la cuenta de la fase actual o pasar a la otra fase (descanso o estudio), que arranca sola. Se desactiva desde el popup. No aparece en páginas internas
  (`about:*`, nueva pestaña, addons.mozilla.org, visor de PDF).
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
├── content.js         # Gato que pasea por el borde de la página
├── background.js      # Timer persistente + lógica de fases y notificaciones
├── icons/
│   └── timer.svg      # Ícono estático (temporizador)
├── assets/            # Imágenes originales del gato (fuente)
└── popup/
    ├── cat/           # Sprites pixel-art (x4, fondo transparente)
    ├── popup.html     # UI del popup
    ├── popup.css      # Estilo Windows 11 (Fluent), claro/oscuro
    └── popup.js       # Polling del estado + comandos
```
