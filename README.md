# hum3

Exploration framework with two views of the same level: a top-down map and a Doom-style first-person 3D view. Walk around, interact with things, read dialogue.

```sh
npm run dev
```

| Key | Top-down | 3D |
| --- | --- | --- |
| Arrows / WASD | Move in 8 directions | Up/Down walk, Left/Right turn |
| Q | Tilt down into 3D | Tilt back up to top-down |
| E / Space / Enter | Interact, skip typing, advance | same |
| Up/Down or W/S (in dialogue) | Highlight a choice | same |

Everything renders at 240 lines and is scaled up with crisp pixels.

## Making a level

1. Create `src/levels/<name>.ts` and export `defineLevel({...})`. See `src/levels/sample.ts`.
2. Register it in `src/levels/index.ts`.
3. Register any items it gives in `src/items.ts`.

**State** is `{ flags, items, view }`, shared across levels. `view` is `'top'` or `'3d'` and flips halfway through the camera tilt. Any field typed `Dyn<T>` takes either a value or `(state) => value`, re-read on every render, so lines, lights, sounds, lighting, and effects can all change with the story or the view.

**Looks.** Anything drawn takes `{ color, image? }`. `image` is a URL (e.g. a file in `public/`); `color` shows while it loads or if it fails. Tiles repeat the image once per tile on every side (tall walls tile it vertically) over the color. Image things, image players, and items are cut out where the image is transparent.

A level is:

| Field      | Meaning |
| ---------- | ------- |
| `id`       | Key used by `goto`. |
| `map`      | One string per row, one character per tile. All rows equal width. |
| `tiles`    | Character → `{ color, image?, solid?, faces?, ceiling? }`. Solid tiles are walls. `faces: { n?, e?, s?, w? }` gives a wall side its own look; `ceiling` overrides the ceiling above a floor tile. |
| `spawn`    | Tile where the player starts. |
| `things`   | Interactables (below). |
| `enter`    | `Dyn<Line[]>` played every time the level loads. |
| `ceiling`  | `{ color, image?, height? }`. Seen only in 3D; `height` (default 1.5) is also the wall height. |
| `lighting` | `Dyn<{ ambient?, ambientColor?, player? }>`. `ambient` 0 (black) to 1 (unshaded, the default); `player` is a light carried by the player. |
| `effects`  | `Dyn<{ vignette?, grain?, scanlines?, aberration?, wobble? }>`, each 0 to 1. |
| `ambience` | `Dyn<{ src, volume? } \| undefined>`: looping background sound. |

A thing is:

| Field       | Meaning |
| ----------- | ------- |
| `id`        | Unique within the level. |
| `at`        | Top-left tile. `size` (footprint) defaults to `{ x: 1, y: 1 }`. |
| `color`, `image` | Its look. Plain things are boxes. Image things lie flat in top-down and stand as camera-facing sprites in 3D. |
| `height`    | Height in 3D, default 1. From above, a tall thing is just a square. |
| `elevation` | Height of its bottom in 3D, default 0. Use it to hang things from the ceiling. |
| `solid`     | Blocks movement; default `true`. Non-solid things trigger when stood on. |
| `shown`     | `(state) => boolean`; hidden things don't render, collide, light, sound, or interact. Use `state.view` for things that exist in only one view; make those `solid: false` unless a wall that exists in only one view is the point. |
| `lines`     | `Dyn<Line[]>`. |
| `after`     | `(ctx) => void`, runs when the conversation ends. |
| `light`     | `Dyn<Light \| undefined>`: `{ color?, intensity?, radius?, flicker? }`. |
| `sound`     | `Dyn<{ src, volume?, radius? } \| undefined>`: looping sound that fades to silence at `radius` (default 6) and pans left/right by where it is relative to you. |

A `Line` is a string or `{ speaker?, portrait?, sound?, text, choices? }`. `portrait` is an image shown beside the text; `sound` plays once when the line appears. A choice is `{ text, requires?, lines?, after? }`: `requires: (state) => boolean` hides it when false; picking it replaces the rest of the conversation with its `lines`, and its `after` runs before the thing's.

`ctx` has `state`, `set(flag, value)`, `give(item)`, `take(item)`, `goto(levelId, tile?)` (tile defaults to that level's `spawn`), and `play(src, volume?)`.

The player's top-down look is the `player` prop of `<Game>` (default a white box); the player is invisible in 3D.

Helpers in `src/engine/helpers.ts`:

- `pickup({ ...thing, item })`: gives `item` and disappears after its lines.
- `door({ ...thing, key, opened?, consume? })`: solid with `lines` while locked; with `key` held it plays `opened` and is gone for good.
- `has(item)`, `flag(name)`: conditions for `shown` / `requires`.

`pickup` and `door` store their state in a flag named after the thing `id`, so keep those ids unique across levels.

`defineLevel` throws on ragged rows, unknown tile characters, and duplicate thing ids. `give` throws on items missing from the registry.

**Lighting** is flat, like Doom's: it ignores height. Solid tiles and solid things cast hard, tile-exact shadows. Things that emit a light don't cast shadows, so a lamp never darkens its own glow. Up to 16 lights per level (player light first); `radius` at most 30.

**Sound** files are not shipped. The sample references `public/sounds/lorem-*.ogg`; missing files log one warning each and stay silent. Browsers only allow audio after a user gesture, so sound starts on the first keypress.

## Layout

- `src/engine/types.ts`: every authoring type.
- `src/engine/level.ts`: validation, collision, interaction lookup, `resolve`, `Player`.
- `src/engine/helpers.ts`: `pickup`, `door`, `has`, `flag`.
- `src/engine/dialogue.ts`: dialogue model, typewriter timing, choice filtering.
- `src/engine/World.tsx`: 3D scene (walls, floors, ceilings, things, sprites, player), camera tilt, movement.
- `src/engine/material.ts`: the one lit material (images, grid-aligned tiling, sprites) and geometry caches.
- `src/engine/lighting.ts`: occupancy grid, light uniforms, shadow-casting GLSL.
- `src/engine/audio.ts`: sound loading, one-shots, ambience, positional loops.
- `src/engine/PostFX.tsx`: full-screen effects pass.
- `src/engine/Game.tsx`: level, state, view, and dialogue flow; low-res canvas.
- `src/engine/DialogueBox.tsx`, `src/engine/Inventory.tsx`: DOM overlays.
