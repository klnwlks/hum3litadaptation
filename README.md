# hum3

Top-down exploration framework: walk around, interact with things, read dialogue.

```sh
npm run dev
```

Move: arrows / WASD. Interact, skip typing, advance: E / Space / Enter. Pick a choice: Up/Down or W/S, then interact.

## Making a level

1. Create `src/levels/<name>.ts` and export `defineLevel({...})`. See `src/levels/sample.ts`.
2. Register it in `src/levels/index.ts`.
3. Register any items it gives in `src/items.ts`.

**State** is `{ flags, items }`, shared across levels. Any field typed `Dyn<T>` takes either a value or `(state) => value`, re-read on every render, so lines, lights, lighting, and effects can all change with the story.

A level is:

| Field      | Meaning |
| ---------- | ------- |
| `id`       | Key used by `goto`. |
| `map`      | One string per row, one character per tile. All rows equal width. |
| `tiles`    | Character → `{ color, image?, solid? }`. |
| `spawn`    | Tile where the player starts. |
| `things`   | Interactables (below). |
| `enter`    | `Dyn<Line[]>` played every time the level loads. |
| `lighting` | `Dyn<{ ambient?, ambientColor?, player? }>`. `ambient` 0 (black) to 1 (unshaded, the default); `player` is a light carried by the player. |
| `effects`  | `Dyn<{ vignette?, grain?, scanlines?, aberration?, wobble? }>`, each 0 to 1. |

A thing is:

| Field    | Meaning |
| -------- | ------- |
| `id`     | Unique within the level. |
| `at`     | Top-left tile. `size` defaults to `{ x: 1, y: 1 }`. |
| `color`  | Fill color; also shown while `image` loads. |
| `image`  | Optional URL (e.g. a file in `public/`) drawn over the footprint instead of the color square. |
| `solid`  | Blocks movement; default `true`. Non-solid things trigger when stood on. |
| `shown`  | `(state) => boolean`; hidden things don't render, collide, light, or interact. |
| `lines`  | `Dyn<Line[]>`. |
| `after`  | `(ctx) => void`, runs when the conversation ends. |
| `light`  | `Dyn<Light \| undefined>`: `{ color?, intensity?, radius?, flicker? }`. |

A `Line` is a string or `{ speaker?, text, choices? }`. A choice is `{ text, requires?, lines?, after? }`: `requires: (state) => boolean` hides it when false; picking it replaces the rest of the conversation with its `lines`, and its `after` runs before the thing's.

`ctx` has `state`, `set(flag, value)`, `give(item)`, `take(item)`, and `goto(levelId, tile?)` (tile defaults to that level's `spawn`).

Helpers in `src/engine/helpers.ts`:

- `pickup({ ...thing, item })`: gives `item` and disappears after its lines.
- `door({ ...thing, key, opened?, consume? })`: solid with `lines` while locked; with `key` held it plays `opened` and is gone for good.
- `has(item)`, `flag(name)`: conditions for `shown` / `requires`.

`pickup` and `door` store their state in a flag named after the thing `id`, so keep those ids unique across levels.

`defineLevel` throws on ragged rows, unknown tile characters, and duplicate thing ids. `give` throws on items missing from the registry.

Lights have no shadows: they shine through walls.

## Layout

- `src/engine/types.ts`: every authoring type.
- `src/engine/level.ts`: validation, collision, interaction lookup, `resolve`.
- `src/engine/helpers.ts`: `pickup`, `door`, `has`, `flag`.
- `src/engine/dialogue.ts`: dialogue model, typewriter timing, choice filtering.
- `src/engine/World.tsx`: tiles, things, images, lights, movement.
- `src/engine/PostFX.tsx`: full-screen shader pass.
- `src/engine/Game.tsx`: level, state, and dialogue flow.
- `src/engine/DialogueBox.tsx`, `src/engine/Inventory.tsx`: DOM overlays.
