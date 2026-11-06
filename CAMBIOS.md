# Vivanti · Historial de versiones

Prototipo escolar. Todas las empresas y ofertas son de **ejemplo** (inventadas para probar).
La versión que estás viendo aparece abajo en la pantalla de inicio de sesión («Versión …»).

| Versión | Fecha | Qué cambió | Archivos que cambiaron |
|---|---|---|---|
| 7 | 06/11/2026 | Número de versión e historial de cambios dentro de la app. Este archivo. | index.html, estilos.css, app.js, CAMBIOS.md |
| 6 | 06/11/2026 | Ícono de la app en PNG para la pestaña y el celular (antes salía gris). | index.html, manifest.json, icono-32/180/192/512.png |
| 5 | 06/11/2026 | Arreglo: ya funcionan Ver detalle, favoritos y postularse (faltaba el número «id» de cada oferta). Instructivo paso a paso que ilumina los botones. | index.html, estilos.css, app.js, datos.json |
| 4 | 05/11/2026 | Inicio de sesión con Supabase. 4 cuentas de jurado y panel del administrador. | index.html, estilos.css, app.js, config.js (+ supabase.sql en Supabase) |
| 3 | 05/11/2026 | Las 6 pantallas del boceto. 20 ofertas de ejemplo en 12 ciudades. Filtro de Requisitos, favoritos, postulación, menú y animaciones. | index.html, estilos.css, app.js, datos.json |
| 2 | 05/11/2026 | Filtros de Ciudad y Área. | index.html, estilos.css, app.js |
| 1 | 05/11/2026 | Bienvenida e Inicio con tarjetas. App publicada en GitHub Pages. | index.html, estilos.css, app.js, datos.json, logo.svg |

## Cómo publicar una versión nueva
1. Cambia `VERSION_APP` en `app.js` (súmale 1) y agrega una línea en `HISTORIAL`.
2. Cambia el texto «Versión …» en `index.html` (3 lugares).
3. Agrega una fila a esta tabla.
4. En GitHub, al subir, escribe en el mensaje del «commit»: `Versión 8: lo que cambió`.
