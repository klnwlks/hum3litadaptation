/** World units are tiles: 1 unit = 1 tile, origin at the map's top-left, y grows downward. */
export type Vec = { x: number; y: number }

export type FlagValue = boolean | number | string
export type Flags = Readonly<Record<string, FlagValue>>

/** What an interaction can do once its dialogue has been read through. */
export interface Ctx {
  flags: Flags
  set(flag: string, value: FlagValue): void
  /** Load `level` and place the player at `at` (defaults to the level's spawn). */
  goto(level: string, at?: Vec): void
}

export type Lines = string[] | ((flags: Flags) => string[])

export interface Tile {
  color: string
  solid?: boolean
}

export interface Thing {
  id: string
  at: Vec
  /** Defaults to 1x1. */
  size?: Vec
  color: string
  /** Blocks movement. Defaults to true. */
  solid?: boolean
  /** Hidden things neither render, collide, nor interact. Defaults to always shown. */
  shown?: (flags: Flags) => boolean
  /** Dialogue shown on interaction. An empty list skips straight to `after`. */
  lines: Lines
  /** Runs after the last line is dismissed. */
  after?: (ctx: Ctx) => void
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
}
