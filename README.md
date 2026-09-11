# Wisi Fensterdienst.ch — web

Maqueta de la nueva web de **Wisi Fensterdienst GmbH** (Albegg 2, 8840 Einsiedeln).

- Toda la web está en un único archivo: `index.html` (textos, estilos, código y fotos incluidas).
- Idiomas: alemán suizo (por defecto), inglés y español. Se cambian desde el panel **Debug** (abajo a la derecha). El panel está oculto: aparece o desaparece con **clic derecho en el logo**; el navegador lo recuerda.
- Modo edición: desde el panel Debug. En modo edición se pueden reordenar las secciones de la portada arrastrando el asa azul; el orden se guarda en el navegador y "↺ Orden original" lo deshace.
- Todas las páginas salvo la portada y la 404 piden el PIN `0000`, cada vez que se entra. Es solo una cortina visual: el contenido está en el archivo y cualquiera puede verlo.
- Ratgeber (`#/ratgeber`): los 8 artículos de fensterdienst.pages.dev/ratgeber, en alemán (original), inglés y español. Sustituye a la antigua página de proyectos.
- Retiradas: Blog y sus artículos, FAQ y Licencia de la plantilla, y las fichas de proyectos.
- Textos: nunca "Presupuesto / Quote / Offerte"; los botones invitan a escribir y a contar "tu problema".

## Ver la web

Abrir `index.html` en el navegador, o la dirección de GitHub Pages del repositorio (Settings → Pages).

## Publicar (deploy)

GitHub Pages sirve la rama `main` desde la raíz. Cada `git push` a `main` actualiza la web en uno o dos minutos.

## Créditos

- Fotos: todas son de Wisi Fensterdienst GmbH. No hay fotos de plantilla ni de terceros.
- Códigos postales: Amtliches Ortschaftenverzeichnis, © swisstopo (datos abiertos).
- Base de la maqueta: plantilla Webflow "Repairly". Comprobad que la licencia de la plantilla cubre este uso antes de publicarla como web definitiva.
