# Marble Fighter

A small mobile-web 1v1 marble-shooting duel. Inspired by the toy mechanic, with an original name, shooters and characters.

**Current phase: Now, prove the duel.** One shooter, one AI, touch controls, primitive shapes, impact feel.
Exit test: *does it feel good to play five matches in a row?*

## Run

```bash
npm install
npm run dev        # http://localhost:5173, also on your LAN for phone testing
npm run build      # static build in dist/ (relative paths, host anywhere)
```

To test on a phone, run `npm run dev` and open the `Network:` URL it prints, on the same Wi-Fi.

URL options:

| Param          | Effect                                                  |
| -------------- | ------------------------------------------------------- |
| `?ai=easy`     | Practice Bot (also `normal` (default) and `hard`)       |
| `?debug`       | FPS / marble counter, and a `__mf` console hook for balance runs |

Balance run from the console with `?debug`:

```js
__mf.start(); __mf.sim(90, __mf.bot('hard')); // bot vs bot, returns HP and winner
```

## Controls

| Touch (Gestures layout, default)        | Desktop                       |
| --------------------------------------- | ----------------------------- |
| Left 40%: drag sideways to move         | A / D or ← / →: move          |
| Right 60%: hold to fire, drag to aim    | Mouse aims, hold click to fire |
|                                         | Space fires, Q / E nudge aim, P / Esc pause |

**Settings** (Settings button on the title screen, or ⚙ next to pause during a match; saved on the device):

| Setting       | Options                                                            |
| ------------- | ------------------------------------------------------------------ |
| Controls      | **Gestures** or **Buttons**: ◀ ▶ bottom-left, FIRE bottom-right    |
| Left / Right  | **Move** slides the robot; **Aim** turns its aim instead (◀ ▶ become ↶ ↷, A / D too) |
| Mouse aim     | **On** / **Off**. Off ignores the mouse so keys or buttons aim     |

## How it fits together

| File            | Job                                                                 |
| --------------- | ------------------------------------------------------------------- |
| `src/config.ts` | Arena size, match rules, base shooter stats, AI profiles            |
| `src/parts.ts`  | Data-driven parts (barrel / core / magazine) → flattened stats      |
| `src/game.ts`   | Rapier 2D world: walls, pushable bumps, pooled CCD marbles, damage  |
| `src/ai.ts`     | Opponent: lead aim, bank shots, bump shots, reaction-delayed dodge  |
| `src/input.ts`  | Two-thumb touch zones, mouse and keyboard                           |
| `src/view.ts`   | three.js scene, instanced marbles, sparks, aim dots, chase camera   |
| `src/robot.ts`  | SD robot models (placeholder 'angel' and 'dragon' styles)           |
| `src/audio.ts`  | Synthesised SFX, unlocked on first tap                              |
| `src/storage.ts`| localStorage save with an in-memory fallback                        |
| `src/app.ts`    | Screens, HUD, fixed-step loop, pause on hidden tab                  |

Physics is **2D** (Rapier `rapier2d`) and rendered in 3D: the duel happens on a flat table, so 2D gives the same bank shots and clashes for less CPU on mid-range Android.

> The robots are placeholder art inspired by existing mecha designs. Replace them with original
> designs before any public release (see "Later: package and release" in the plan).

## Phase checklist

- [x] One shooter, one AI, touch controls, primitive shapes
- [x] Impact feel: hit flash, hit-stop, camera shake, sparks, HP chip bar, sound
- [x] Marble pooling + active cap, continuous collision detection
- [x] Portrait on phones, 9:16 letterbox on desktop; pause when tab hidden
- [ ] Playable on a phone from a shared link (needs hosting)
- [ ] Five-matches-in-a-row playtest
