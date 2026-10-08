import { defineConfig } from 'vite';

/**
 * GitHub Pages liefert eine Projekt-Seite unter `/packliste/`, nicht an der
 * Wurzel. Ohne `base` zeigen danach alle Asset-Pfade ins Leere und die Seite
 * bleibt weiß — der häufigste Grund, warum ein Pages-Deploy „nichts tut".
 *
 * Nur beim Bauen. Im Entwicklungsserver bleibt es bei `/`: der Rauchtest und
 * die Fixture-Pfade sind absolut (`/src/main.js`, `/tests/fixtures/…`) und
 * lägen sonst unter `/packliste/`.
 */
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/packliste/' : '/',
}));
