# hum3

Top-down exploration framework: walk around, interact with things, read dialogue.

```sh
npm run dev
```

Move: arrows / WASD. Interact and advance dialogue: E / Space / Enter.

## Making a level

1. Create `src/levels/<name>.ts` and export `defineLevel({...})`. See `src/levels/sample.ts`.
2. Register it in `src/levels/index.ts`.

A level is:

| Field    | Meaning |
| -------- | ------- |
| `id`     | Key used by `goto`. |
| `map`    | One string per row, one character per tile. All rows equal width. |
| `tiles`  | Character → `{ color, solid? }`. |
| `spawn`  | Tile where the player starts. |
| `things` | Interactables (below). |
| `enter`  | Optional lines played every time the level loads. |

A thing is:

| Field    | Meaning |
| -------- | ------- |
| `id`     | Unique within the level. |
| `at`     | Top-left tile. `size` defaults to `{ x: 1, y: 1 }`. |
| `color`  | Fill color. |
| `solid`  | Blocks movement; default `true`. Non-solid things trigger when stood on. |
| `shown`  | `(flags) => boolean`; hidden things don't render, collide, or interact. |
| `lines`  | `string[]`, or `(flags) => string[]` to vary with story state. |
| `after`  | `({ flags, set, goto }) => void`, runs when the last line is dismissed. |

Flags are a flat `Record<string, boolean | number | string>` shared across levels. `goto(levelId, tile?)` switches level; the tile defaults to that level's `spawn`.

`defineLevel` throws on ragged rows, unknown tile characters, and duplicate thing ids.

## Layout

- `src/engine/types.ts`: level and thing types.
- `src/engine/level.ts`: validation, collision, interaction lookup.
- `src/engine/World.tsx`: rendering and movement.
- `src/engine/Game.tsx`: level, flags, and dialogue state.
