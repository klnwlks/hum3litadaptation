/**
 * Map units are tiles: 1 unit = 1 tile, origin at the map's top-left, y grows downward (south).
 * In 3D the map lies on the floor: tile (x, y) is world (x, height, y).
 */
export type Vec = { x: number; y: number }

/** Top-down overview, or first-person 3D. */
export type View = 'top' | '3d'

export type FlagValue = boolean | number | string
export type Flags = Readonly<Record<string, FlagValue>>

/** Story state shared across levels. */
export interface State {
  flags: Flags
  /** Held item ids, in pickup order. */
  items: ReadonlySet<string>
  /** Current view; flips halfway through the camera tilt. */
  view: View
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
 * Drawn as `image` (a URL, e.g. a file in public/) when given, else as a flat `color`. `color` also
 * shows while the image loads. Things stretch the image over their footprint; tiles repeat it once
 * per tile on every side, so tall walls tile it vertically.
 */
export interface Look {
  color: string
  image?: string
}

/** How a held item looks in the inventory strip. */
export type Item = Look

export type Side = 'n' | 'e' | 's' | 'w'

export interface Tile extends Look {
  solid?: boolean
  /** Solid tiles only: per-side looks seen in 3D (`n` faces up the map). Unset sides use the tile's look. */
  faces?: Partial<Record<Side, Look>>
  /** Non-solid tiles only: overrides the level's ceiling look above this tile (3D only). */
  ceiling?: Look
}

/**
 * A point light. Lights only show against darkness: lower the level's `ambient` below 1.
 * Solid tiles and solid things cast shadows, except things that emit a light themselves.
 */
export interface Light {
  /** Default white. */
  color?: string
  /** Brightness at the center, fading to 0 at `radius`; 1 shows full color. Default 1. */
  intensity?: number
  /** Reach in tiles, at most 30 (shadow rays stop after 64 cells). Default 4. */
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

/** Full-screen post effects, each 0 (off) to 1 (strong). All default 0. */
export interface Effects {
  /** Darkens toward the screen edges. */
  vignette?: number
  /** Animated film noise. */
  grain?: number
  /** Horizontal CRT lines. */
  scanlines?: number
  /** Splits red and blue channels away from the center. */
  aberration?: number
  /** Wavy screen distortion. */
  wobble?: number
}

export interface Thing extends Look {
  /** Unique within the level; `pickup`/`door` also use it as a flag name, so keep those unique across levels. */
  id: string
  at: Vec
  /** Footprint in tiles. Defaults to 1x1. */
  size?: Vec
  /** Height in 3D, in tiles. Defaults to 1. Images become upright sprites facing the camera in 3D. */
  height?: number
  /** Distance from floor to the thing's bottom in 3D, e.g. to hang it from the ceiling. Defaults to 0. */
  elevation?: number
  /** Blocks movement. Defaults to true. */
  solid?: boolean
  /**
   * Hidden things neither render, collide, nor interact. Defaults to always shown.
   * Use `state.view` for things that exist in only one view; make those `solid: false` unless walls
   * that only exist in one view are the point.
   */
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
  effects?: Dyn<Effects>
  /** Seen only in 3D; `height` is the wall and ceiling height in tiles. Defaults to near-black, 1.5. */
  ceiling?: Look & { height?: number }
}
