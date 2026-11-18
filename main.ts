// Solmar Bay — Streets of the Sun: the hand-in program for this gta6-01
// entry (Node 22, standard library only). The game itself is the game/
// folder beside this file: plain static files (index.html and its ES
// modules) that a desktop browser loads offline, with no build step and no
// network request. This program copies game/ and screenshots/ to /output
// and writes /output/dossier.json, the summary the judge reads, using the
// vendored make.fun library in vendor/makefun-game.ts.
//
// Serve the game locally with `node serve.ts`, then open
// http://localhost:8080. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The output folder mirrors the repository's two payload folders.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The dossier is built with the scorer's own caps, so a hand-in this
// program writes is one the gate accepts: at most 4 screenshots of at most
// 256 KiB, at most 993 files and 48 MiB under game/, no game/ path over
// 1000 bytes, and the source text capped at 160 KiB.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// A one-line receipt on stdout, so a human running this by hand can see the
// hand-in happened and how large the dossier the judge reads came out.
console.log(`Solmar Bay handed in: dossier.json (${dossier.length} bytes) written to ${out}`);
