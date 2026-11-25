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
  // Forces the camera to tilt to `view`, even if the player is mid-tilt.
  view(view: View): void
  // Covers the whole screen (under any dialogue) until cleared; with `seconds`, clears itself. No args clears.
  image(frames?: Frames, seconds?: number): void
  // Replaces any open dialogue.
  say(lines: Lines): void
  // Waits for open dialogue to close; `fn` gets the ctx current when it runs.
  wait(seconds: number, fn: (ctx: Ctx) => void): void
}

// Picking a choice replaces the rest of the conversation; its `after` runs before the thing's.
export interface Choice {
  text: string
  requires?: Cond
  lines?: Lines
  after?: (ctx: Ctx) => void
}

// A list of images loops at 8 fps.
export type Frames = string | string[]

// `full` stretches `image` over the whole screen instead of 60% of its height.
export type Line =
  | string
  | { speaker?: string; portrait?: Frames; image?: Frames; full?: boolean; sound?: string; text: string; choices?: Choice[] }
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
  image?: Frames
  // Default 8.
  fps?: number
}

export type Item = Look

export type Side = 'n' | 'e' | 's' | 'w'

export interface Tile extends Look {
  solid?: boolean
  faces?: Partial<Record<Side, Look>>
  ceiling?: Look
  // Footstep sound while walking on this tile.
  step?: string
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

// Fades to `color` (default black) by `distance` tiles from the player.
export interface Fog {
  color?: string
  distance: number
}

// Each 0 to 1.
export interface Effects {
  vignette?: number
  grain?: number
  scanlines?: number
  aberration?: number
  wobble?: number
  dither?: number
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

// Fires `enter` each time the player walks into the area while `when` holds.
export interface Trigger {
  at: Vec
  size?: Vec
  when?: Cond
  enter: (ctx: Ctx) => void
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
  fog?: Dyn<Fog | undefined>
  triggers?: Trigger[]
}
