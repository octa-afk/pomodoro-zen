# Pomodoro para Firefox ₍^. .^₎⟆

<p align="center">
  <img src="popup/cat/gato_estudiando_1.png" alt="Gato estudiando" height="90">
  <img src="popup/cat/gato_esperando_1.png" alt="Gato esperando" height="90">
  <img src="popup/cat/gato_jugando_1.png" alt="Gato jugando" height="90">
</p>

Un temporizador Pomodoro para **Zen** y **Firefox**, con un gatito pixel-art
que te acompaña mientras estudiás. 🐾

## Cómo funciona

El gato vive en la parte de abajo de tus pestañas y cambia según el momento:

- 📖 **Estudiando**: lee tranquilo mientras corre el tiempo de estudio.
- ⏳ **Esperando**: se terminó el tiempo. Suena un despertador de 8 bits y un
  maullidito, y el gato te pregunta *«¿Ya terminamos?»*. Tocá la palomita ✓
  cuando estés listo y empieza la siguiente fase.
- 🧶 **Descansando**: juega con su ovillo, lo tira y sale corriendo a buscarlo.

## Usar el gato

| Acción | Qué pasa |
| --- | --- |
| Clic izquierdo | Muestra cuánto tiempo queda |
| Clic derecho | Abre el menú: minutos, iniciar/pausar, reiniciar, saltar |
| Arrastrar | Lo movés si te tapa algo |
| Doble clic | Vuelve a su lugar |

También podés controlar todo desde el ícono de la extensión en la barra, o
con el atajo `Alt+Shift+P` para iniciar y pausar.

## Instalar

**Rápido (para probar):**

1. Descargá [`pomodoro-zen.zip`](https://github.com/octa-afk/pomodoro-zen/releases/latest/download/pomodoro-zen.zip).
2. En Zen o Firefox, abrí `about:debugging#/runtime/this-firefox`.
3. Tocá **«Cargar complemento temporal…»** y elegí el `.zip`.

Se borra al cerrar el navegador. Pronto va a estar disponible en la tienda de
complementos de Firefox para instalarlo de forma permanente.

## Para desarrolladores

Es una extensión Manifest V2 sin dependencias: `background.js` lleva el
temporizador, `content.js` dibuja al gato en las páginas y `popup/` es la
ventanita del ícono. Para probar cambios, cargá `manifest.json` desde
`about:debugging`.
