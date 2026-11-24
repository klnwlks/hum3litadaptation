// Map units are tiles, y grows south. In 3D, tile (x, y) is world (x, height, y).
export type Vec = { x: number; y: number }

export type View = 'top' | '3d'

export type FlagValue = boolean | number | string
export type Flags = Readonly<Record<string, FlagValue>>

export interface State {
  flags: Flags
  items: ReadonlySet<string>
  // Flips at the midpoint of the camera tilt.
  view: View
}

export type Cond = (state: State) => boolean

export type Dyn<T> = T | ((state: State) => T)

export interface Ctx {
  // Includes changes made earlier in the same callback.
  state: State
  set(flag: string, value: FlagValue): void
  give(item: string): void
  take(item: string): void
  goto(level: string, at?: Vec): void
  play(src: string, volume?: number): void
}

// Picking a choice replaces the rest of the conversation; its `after` runs before the thing's.
export interface Choice {
  text: string
  requires?: Cond
  lines?: Lines
  after?: (ctx: Ctx) => void
}

export type Line = string | { speaker?: string; portrait?: string; sound?: string; text: string; choices?: Choice[] }
export type Lines = Dyn<Line[]>

export interface Sound {
  src: string
  volume?: number
}

export interface Emitter extends Sound {
  radius?: number
}

// Image draws over color on tiles and boxes, cut out on sprites; color shows until it loads.
export interface Look {
  color: string
  image?: string
}

export type Item = Look

export type Side = 'n' | 'e' | 's' | 'w'

export interface Tile extends Look {
  solid?: boolean
  faces?: Partial<Record<Side, Look>>
  ceiling?: Look
}

export interface Light {
  color?: string
  intensity?: number
  // Max 30: shadow rays stop after 64 cells.
  radius?: number
  flicker?: number
}

export interface Lighting {
  // 1 = unshaded.
  ambient?: number
  ambientColor?: string
  player?: Light
}

// Each 0 to 1.
export interface Effects {
  vignette?: number
  grain?: number
  scanlines?: number
  aberration?: number
  wobble?: number
}

export interface Thing extends Look {
  // `pickup`/`door` use it as a flag name: keep those unique across levels.
  id: string
  at: Vec
  size?: Vec
  height?: number
  elevation?: number
  solid?: boolean
  // Hidden things don't render, collide, light, sound, or interact.
  shown?: Cond
  lines: Lines
  after?: (ctx: Ctx) => void
  light?: Dyn<Light | undefined>
  sound?: Dyn<Emitter | undefined>
}

export interface Level {
  id: string
  map: string[]
  tiles: Record<string, Tile>
  spawn: Vec
  things: Thing[]
  enter?: Lines
  lighting?: Dyn<Lighting>
  effects?: Dyn<Effects>
  ceiling?: Look & { height?: number }
  ambience?: Dyn<Sound | undefined>
}
