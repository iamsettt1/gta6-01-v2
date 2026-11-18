# Solmar Bay — Streets of the Sun
[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/iamsettt1/gta6-01-v2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/iamsettt1/gta6-01-v2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 2D top-down open-world crime game that runs entirely in the browser from
static files. No build step, no network requests: every script, sound and
image is a file under `game/` or synthesised live with WebAudio.

Built for the make.fun GTA 6 bounty — [play and compete on make.fun](https://make.fun/?ref=9j3w1sg2).

## The game

You washed up in **Solmar Bay** with a duffel bag and a debt. The bay is a
sun-soaked coastal city of seven districts — the container harbour of
**Puerto Alba**, the glass towers of **Centro Dorado**, the market stalls of
**Mercado Viejo**, the garden houses of **Las Lomas**, the depots of
**Barrio Norte**, the **Marina Azul** strip and the **Playa Serena**
beachfront, with the animated sea along the south edge.

- **Explore on foot and by car** — walk the sidewalks and promenade, steal
  parked and moving cars (sedans, coupes, sports cars, hatchbacks, taxis,
  vans, pickups), and drive a road grid crossed by the diagonal Avenida del
  Faro. Traffic brakes, turns and yields; pedestrians stroll, cross, and
  flee from trouble, dropping what they carry.
- **Wanted system** — crimes raise your stars from 1 to 5. Foot officers
  chase and arrest; patrol cars with flashing light bars pursue, ram and,
  at four stars, set roadblocks. Break line of sight and the heat decays.
  Get caught and you are **BUSTED** (fined, released at Estación Solmar);
  hit zero health and you are **WASTED**.
- **Combat** — a pistol and a scattergun (Q or 1/2 to switch), aimed with
  the mouse: muzzle flash, tracers, hit sparks, camera kick, damageable
  cars, and glowing health/ammo/cash pickups. Casa Solmar, your safehouse,
  restores health.
- **An eight-mission story** — work for Tía Carmen of Café Brisa, the fixer
  El Faro and the driver Paloma against the rival crew Los Escorpiones del
  Norte: a coffee run, a stolen coupe, an on-foot tail with a detection
  meter, a timed delivery, a prized car theft, a street race, a harbour
  shootout, and a final marina heist under four stars.
- **Activities & progression** — three repeatable checkpoint races against
  AI drivers, twelve hidden sun discs, cash, respect levels and full stats.
  Everything saves to `localStorage`. A day cycle warms the light from
  midday to golden hour and dusk while you play.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Walk and drive |
| Shift | Run |
| Space | Handbrake |
| E (or F) | Enter / exit a car |
| Mouse + click | Aim and fire |
| Q or 1 / 2 | Switch weapon |
| R | Start a race when at a race marker, in a car |
| J | Missions board |
| P / Esc | Pause |
| M | Mute |

## Run it

```sh
node serve.ts
```

then open http://localhost:8080 in a desktop browser. Node 22 or later, no
dependencies.

## Hand-in

`main.ts` is the entry program: it copies `game/` and `screenshots/` to
`/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes `dossier.json` with the
vendored library in `vendor/makefun-game.ts`.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The screenshots in `screenshots/` are real renders of this build, staged
deterministically with `?shot=chase|onfoot|combat|progress&seed=7` (see
`shots.json` and `game/src/shots.js`).

## Layout

- `game/index.html` — the canvas page.
- `game/src/` — ES modules, one job each: `config`, `random`, `city`,
  `vehicles`, `traffic`, `pedestrians`, `police`, `combat`, `missions`,
  `activities`, `effects`, `audio`, `input`, `minimap`, `menus`, `render`,
  `world`, `shots`, `main`.
- `serve.ts` — a tiny static server for local play.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
