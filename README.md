# Wisi Fensterdienst.ch — web

Maqueta de la nueva web de **Wisi Fensterdienst GmbH** (Albegg 2, 8840 Einsiedeln).

- Toda la web está en un único archivo: `index.html` (textos, estilos, código y fotos incluidas).
- Idiomas: alemán suizo (por defecto), inglés y español. Se cambian desde el panel **Debug** (abajo a la derecha). El panel está oculto: aparece o desaparece con **clic derecho en el logo**; el navegador lo recuerda.
- Modo edición: desde el panel Debug. En modo edición se pueden reordenar las secciones de la portada arrastrando el asa azul; el orden se guarda en el navegador y "↺ Orden original" lo deshace.
- Sin PIN: todas las páginas se ven directamente (el bloqueo se quitó el 23-09-2026).
- Ratgeber (`#/ratgeber`): los 8 artículos de fensterdienst.pages.dev/ratgeber, en alemán (original), inglés y español. Sustituye a la antigua página de proyectos.
- Retiradas: Blog y sus artículos, FAQ, Licencia, Styleguide, Changelog y las páginas legales de la plantilla, y las fichas de proyectos.
- Páginas interiores (23-09-2026): 6 servicios, Über uns, Kontakt, Für Verwaltungen (`#/verwaltungen`), Impressum (`#/impressum`) y Datenschutz (`#/datenschutz`), con el contenido de fensterdienst.pages.dev en DE/EN/ES. Las 6 de servicio, Über uns y Kontakt usan el diseño original de la plantilla y se rellenan con `herramientas/pages_data.py` (`patchDP.py`); Verwaltungen, Impressum y Datenschutz usan el diseño propio (`patchDO.py`, `pages_data2.py`). Los formularios envían por WhatsApp (no hay servidor). En Impressum faltan UID, MWST y seguro (el cliente los confirma).
- Textos: nunca "Presupuesto / Quote / Offerte"; los botones invitan a escribir y a contar "tu problema".

## Ver la web

Abrir `index.html` en el navegador, o https://dreamlikew.github.io/wisi-fensterdienst/.

## Publicar (deploy)

GitHub Pages sirve la rama `main` desde la raíz. Cada `git push` a `main` actualiza la web en uno o dos minutos.

## Clonar y publicar por tu cuenta (para Sofía)

La web es un único `index.html` estático: no hay que instalar nada ni compilar.

1. Clonar:
   ```
   git clone https://github.com/dreamlikew/wisi-fensterdienst.git
   cd wisi-fensterdienst
   ```
2. Llevarlo a tu propio repositorio (opcional):
   ```
   git remote set-url origin https://github.com/BALIFlow/wisi-fensterdienst.git
   git push -u origin main
   ```
3. Publicar en Cloudflare Pages, de una de estas dos formas:
   - Desde el panel: Workers & Pages → Create → Pages → conectar el repositorio. Sin comando de build; directorio de salida `/`.
   - Desde la terminal: `npx wrangler pages deploy . --project-name wisi-fensterdienst`

## Créditos

- Fotos: todas son de Wisi Fensterdienst GmbH. No hay fotos de plantilla ni de terceros.
- Códigos postales: Amtliches Ortschaftenverzeichnis, © swisstopo (datos abiertos).
- Base de la maqueta: plantilla Webflow "Repairly". Comprobad que la licencia de la plantilla cubre este uso antes de publicarla como web definitiva.
