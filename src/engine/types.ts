/** World units are tiles: 1 unit = 1 tile, origin at the map's top-left, y grows downward. */
export type Vec = { x: number; y: number }

export type FlagValue = boolean | number | string
export type Flags = Readonly<Record<string, FlagValue>>

/** Story state shared across levels. */
export interface State {
  flags: Flags
  /** Held item ids, in pickup order. */
  items: ReadonlySet<string>
}

export type Cond = (state: State) => boolean

/** A fixed value, or one derived from story state each time it is read. */
export type Dyn<T> = T | ((state: State) => T)

/** What an interaction can do once its dialogue has been read through. */
export interface Ctx {
  /** Reflects `set`/`give`/`take` made earlier in the same callback. */
  state: State
  set(flag: string, value: FlagValue): void
  /** `item` must be a key of the game's item registry. */
  give(item: string): void
  take(item: string): void
  /** Load `level` and place the player at `at` (defaults to the level's spawn). */
  goto(level: string, at?: Vec): void
}

/**
 * An option offered after a line. Unmet `requires` hides it. Picking it replaces the rest of the
 * conversation with its `lines`; its `after` runs before the interaction's own `after`.
 */
export interface Choice {
  text: string
  requires?: Cond
  lines?: Lines
  after?: (ctx: Ctx) => void
}

/** A plain string, or a line attributed to a speaker and/or ending in choices. */
export type Line = string | { speaker?: string; text: string; choices?: Choice[] }
export type Lines = Dyn<Line[]>

/**
 * Drawn as `image` (a URL, e.g. a file in public/) stretched over the footprint when given,
 * else as a `color` square. `color` also shows while the image loads.
 */
export interface Look {
  color: string
  image?: string
}

/** How a held item looks in the inventory strip. */
export type Item = Look

export interface Tile extends Look {
  solid?: boolean
}

/** A point light. Lights only show against darkness: lower the level's `ambient` below 1. */
export interface Light {
  /** Default white. */
  color?: string
  /** 1 lights the tile right under it at full color. Default 1. */
  intensity?: number
  /** Reach in tiles. Default 4. */
  radius?: number
  /** 0 (steady) to 1 (stutters often and deeply). Default 0. */
  flicker?: number
}

export interface Lighting {
  /** Light everywhere, 0 (black) to 1 (unshaded colors). Default 1. */
  ambient?: number
  /** Default white. */
  ambientColor?: string
  /** Light carried by the player. */
  player?: Light
}

export interface Thing extends Look {
  /** Unique within the level; `pickup`/`door` also use it as a flag name, so keep those unique across levels. */
  id: string
  at: Vec
  /** Defaults to 1x1. */
  size?: Vec
  /** Blocks movement. Defaults to true. */
  solid?: boolean
  /** Hidden things neither render, collide, nor interact. Defaults to always shown. */
  shown?: Cond
  /** Dialogue shown on interaction. An empty list skips straight to `after`. */
  lines: Lines
  /** Runs after the last line is dismissed. */
  after?: (ctx: Ctx) => void
  /** Light emitted from the thing's center. */
  light?: Dyn<Light | undefined>
}

export interface Level {
  id: string
  /** One string per row, one character per tile; characters are keys of `tiles`. */
  map: string[]
  tiles: Record<string, Tile>
  spawn: Vec
  things: Thing[]
  /** Dialogue played every time the level loads. */
  enter?: Lines
  lighting?: Dyn<Lighting>
}
