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

Deploy (Cloudflare Workers static assets, configured in `wrangler.json`):

```bash
npm run deploy     # build + wrangler deploy
```

Pushing to `main` on the `bdafighter` GitHub repo also deploys if Cloudflare Workers Builds is connected
(build command `npm run build`, deploy command `npx wrangler deploy`).

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

**Settings** (Settings on the title, pause or result screen, or ⚙ during a match; saved on the device), in four tabs:

| Tab       | Setting         | Options                                                                  |
| --------- | --------------- | ------------------------------------------------------------------------ |
| Fighter   | Your unit       | 14 units (placeholder designs), each with its own marble colour: 8 SD mechs, plus Unit Violet, Kabuto Bee, Tyrant King (fires from a rex-head blaster), Rex Saur, Fang Liger and Ember Lizard (all three fire from the mouth) |
|           | Opponent unit   | Auto (different from yours) or any of the 14                             |
|           | Your pack       | Solo / 2 / 3: CPU pack-mates share your rail in their own lanes (you take the middle of three), drawn see-through during play so they never block the view. Packs scale armour and damage like the opponent's. A team is out when all its robots are down |
| Arena     | Stage           | Orbital Deck, Beach, Lava Forge, Snowfield, Neo City, Rainy Forest, River Dusk, Cyberpunk, Soccer Field (pucks and props match the theme) |
|           | Pucks           | Off / 1–5, each count has its own symmetric layout (applies next match)  |
|           | Walls           | Off / 1 / 2 / 3 cover walls per side; each takes 5 hits, then breaks     |
|           | Pins            | Off / 2 / 4 / 6 / 8 pinball pins that deflect marbles                    |
|           | Magazine        | 3–10 marbles per load, same for both robots (default 10)                 |
|           | Fire rate       | 1–5 balls per trigger pull, fired in a quick string, both robots         |
|           | Round time      | 60 s / 90 s / ∞ (untimed rounds end only on a knockout)                  |
|           | Air drops       | On / Off                                                                 |
|           | Power gates     | Show / Hide                                                              |
| Opponent  | Pack            | 1 / 2 / 3 opponents sharing the far rail, each in its own lane; extra units are random. Bigger packs get less armour and punch each (2: 60% / 50%, 3: 40% / 38%). Round ends when the whole pack is down |
|           | Armor           | 50% / 75% / 100% / 150% / 200% health                                    |
|           | Speed           | 1–5: movement speed                                                      |
|           | Agility         | 1–5: how often and how quickly it dodges                                 |
|           | Ball power      | 1–5: marble damage, weight and a little muzzle speed                     |
|           | Aim             | **Flexible** (aims, leads, banks) or **Straight** (fires straight, walks to line up) |
| Controls  | Special effects | On / Off: ThorVG overlay, sparks, smoke, afterimages (performance test)  |
|           | Realism         | On / Off: marble hops/spin/shadows, stage particles, full pixel density  |
|           | FPS meter       | Show / Hide                                                              |
|           | Camera          | Far / Mid / Near / Cockpit (first person)                                |
|           | Layout          | **Gestures** or **Buttons**: ◀ ▶ bottom-left; ▼ shield above fire, bottom-right |
|           | Move with       | **◀ ▶ Buttons** or **Slider**: drag along the slider and the robot slides to that spot in its lane |
|           | Fire buttons    | **Single** FIRE, or **Triple**: front-left / front / front-right         |
|           | Left / Right    | **Move** slides the robot; **Aim** turns its aim (◀ ▶ become ↶ ↷, A / D too) |
|           | Mouse aim       | **On** / **Off**. Off ignores the mouse so keys or buttons aim           |
|           | Shooting line   | Show / hide the dotted aim guide                                         |
|           | Vibrate on hits | On / Off (Android browsers; iPhone browsers don't support vibration)     |

## Unit Lab (`editor.html`)

A second page for editing units, linked from Settings → Fighter → **UNIT LAB**. Changes save to the device
and the game picks them up on its next load.

- **Profile**: name, and four traits on a 1–5 scale (3 = standard): **Speed** (rail speed), **Fire rate**
  (shots per second while held), **Health** (armour), **Agility** (shield recharge, plus dodging when the CPU
  drives the unit). Traits apply whether the unit is yours or the CPU's.
- **Colours**: palette swatches (body, trim, accent, joints, eyes/glow, marble). Blocks painted with a palette
  colour follow the swatch.
- **Blocks**: every unit, built-ins included, opens as a tree of blocks (box, ball, tube, spike, ring, group).
  Click a block on the model or in the list, then edit size, position, rotation, scale, colour and finish
  (matte / glow / glossy). Add, duplicate, mirror to the other side, delete; arrows / PgUp / PgDn nudge.
  **Moves as** tags the animated parts: *Aims* (turns with the aim), *Leg* (walk cycle), *Barrel* (recoils,
  marble exit), *Jaw*, *Flame*, *Trigger*.
- **+ NEW** copies the selected unit into a custom one; **Reset to original** drops edits to a built-in;
  undo / redo cover every change. **PLAY AS UNIT** selects it and opens the game.

## Air drops

A crate parachutes onto one rail every 11–15 s (sides alternate, first at 8 s). Walk under it to grab it;
the ITEM slot (bottom right) then holds it until you tap it, press **F** / Shift, or right-click. A marker
points at crates on your rail, even off-screen. The AI grabs and uses items too.

| Item         | Effect                                                              |
| ------------ | ------------------------------------------------------------------- |
| Multi Shot   | 6 seconds of 6-marble fans per shot                                 |
| Slow-Mo      | 5 s of bullet time: the world and every other robot run at 0.2x (movement, firing, reload, AI reactions, marbles); you move, fire and reload at 1.25x, leaving afterimages and light streaks |
| Wiper        | 6 s of a brick shield sweeping in front of you; enemy balls it touches bounce back as yours |
| Repair Kit   | Restores 25% of max armor                                           |
| Dragon Shot  | Three heavy glowing balls that weave in a zig-zag braid             |
| Homing Missile | Chases the opponent (limited turn rate, so a sharp sidestep can slip it); hits up to 3 times, then explodes |

The opponent can **shoot a crate down** once it's low enough to hit; it's lost for that side. The AI will
sometimes snipe your crate, and you can snipe its crate.

## Power gates

Every 13–17 s a holographic gate appears mid-table and slides side to side for 5 s. Balls from either side
that pass through it are transformed; each gate has limited charges, then shatters.

| Gate | Charges | Effect                                                            |
| ---- | ------- | ----------------------------------------------------------------- |
| 5×   | 3       | Multiplies the ball's damage by 5 (a basic ball also grows, gold)  |
| POW  | 3       | Turns a basic ball into a power ball (super-shot size and damage)  |
| DRG  | 1       | Splits the ball into a three-ball dragon-shot braid                |
| HOM  | 1       | Turns the ball into a homing missile for whoever fired it          |
| WALL | 5 hits  | A solid wall that blocks both sides until shot 5 times (power balls count 3) |

## Match flow (Tekken style)

1. **VS intro**: the camera orbits each fighter while their name card slides in, then VS slams in (tap to skip).
2. **Best of 3 rounds** (60 s each): first to 2 round wins. ROUND n / FINAL ROUND, READY, FIGHT! banners; round markers
   next to the names; K.O. / TIME UP / PERFECT calls. A drawn round counts for both sides (a deciding round
   is played if that leaves both on two; capped at 5 rounds).
3. **Quick replay** after every KO: the last ~2.5 s in slow motion (quarter speed right at the KO) from a
   sweeping side camera, letterboxed, tap to skip. Between rounds the loser slumps, sparking.
4. **Finale**: after the deciding replay the loser explodes (pops, boom, clattering debris), then the result.

## Knockout

After the final round the loser sputters through three explosions, then blows apart: every part flies off, tumbles, bounces and
smokes in slow motion while the camera swings in on the wreck.

## Portraits

The HUD is laid out like a fighting game: both armor bars across the top (player left, opponent right,
draining toward the centre) with the timer between them and portraits underneath. Each unit's face is drawn
live with ThorVG: it glances around, flinches red when hit, grins when
it lands hits or has an item running, glows gold with a super ready, cracks/smokes/sparks as armor drops
(crest snaps off below 25%), cheers on a win and shows X eyes on a KO.

## Shield

Hold **▼ SHIELD** (buttons), **S / ↓** (keyboard), or drag the move thumb downward (gestures) to raise an
energy wall that blocks marbles and missiles. You can't fire while shielding and you move at half speed.
The shield bar under each armor bar drains while raised and per point blocked, regenerates after a short
pause, and when it empties the shield breaks and is locked out for 2.5 s. The AI shields against power
balls, missiles and dense streams.

## Marble feel

Physics stays in Rapier (rolling resistance, energy loss on impacts). On top of that, marbles hop on hard
clacks and wall/puck hits and cast contact shadows, and ThorVG draws motion streaks on fast marbles and
small impact rings where they clack.

## Super shot

Every 3 hits charges a super (pips by the SUPER label, and next to the opponent's name). The next marble fired
is a super: 2.2x size, glowing, dead straight, heavy enough to bulldoze pucks and marble streams, 4x damage,
with a long hit-stop, heavy shake, knock-back, shockwave and flash. The AI charges and fires supers the same way.

## How it fits together

| File            | Job                                                                 |
| --------------- | ------------------------------------------------------------------- |
| `src/config.ts` | Arena size, match rules, base shooter stats, AI profiles            |
| `src/parts.ts`  | Data-driven parts (barrel / core / magazine) → flattened stats      |
| `src/game.ts`   | Rapier 2D world: walls, pushable bumps, pooled CCD marbles, damage  |
| `src/ai.ts`     | Opponent: lead aim, bank shots, bump shots, reaction-delayed dodge  |
| `src/input.ts`  | Two-thumb touch zones, mouse and keyboard                           |
| `src/view.ts`   | three.js scene, instanced marbles, sparks, aim dots, chase camera   |
| `src/robot.ts`  | Robot models (14 placeholder units), roster merge, block-design build and export |
| `src/roster.ts` | Device roster: name / trait / colour / design edits and custom units     |
| `src/lab.ts`    | Unit Lab editor page (`editor.html`)                                     |
| `src/fx2d.ts`   | ThorVG overlay: shockwaves, starbursts, glows/trails, speed lines, drop markers |
| `src/face.ts`   | ThorVG Doom-style live portraits                                    |
| `src/stage.ts`  | Nine themed stages: floor, sky, lights, scenery, moving props, particles (snow, embers, rain, fireflies, neon, confetti), pucks |
| `src/items.ts`  | Air-drop item data and tuning                                       |
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
