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

export type Lines = string[] | ((state: State) => string[])

/** How a held item looks in the inventory strip. */
export interface Item {
  color: string
}

export interface Tile {
  color: string
  solid?: boolean
}

export interface Thing {
  /** Unique within the level; `pickup`/`door` also use it as a flag name, so keep those unique across levels. */
  id: string
  at: Vec
  /** Defaults to 1x1. */
  size?: Vec
  color: string
  /** Blocks movement. Defaults to true. */
  solid?: boolean
  /** Hidden things neither render, collide, nor interact. Defaults to always shown. */
  shown?: Cond
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
