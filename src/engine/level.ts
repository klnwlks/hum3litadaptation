import type { Dyn, Level, State, Thing, Vec } from './types'

// Hitbox edge, in tiles.
export const PLAYER_SIZE = 0.7

export type Player = {
  pos: Vec
  // Radians clockwise from north.
  yaw: number
}

export const facingOf = (yaw: number): Vec => ({ x: Math.sin(yaw), y: -Math.cos(yaw) })

type Box = { x: number; y: number; w: number; h: number }

export function defineLevel(level: Level): Level {
  const width = level.map[0]?.length ?? 0
  level.map.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${level.id}: row ${y} is ${row.length} wide, expected ${width}`)
    for (const ch of row) if (!(ch in level.tiles)) throw new Error(`${level.id}: no tile for '${ch}' in row ${y}`)
  })
  const ids = new Set<string>()
  for (const t of level.things) {
    if (ids.has(t.id)) throw new Error(`${level.id}: duplicate thing id '${t.id}'`)
    ids.add(t.id)
  }
  return level
}

// Alternates on/off every `every` seconds; always on without it.
export const blinkOn = (seconds: number, every?: number): boolean => !every || Math.floor(seconds / every) % 2 === 0

export const tileCenter = (v: Vec): Vec => ({ x: v.x + 0.5, y: v.y + 0.5 })

// `T` must not itself be a function.
export const resolve = <T>(value: Dyn<T>, state: State): T =>
  typeof value === 'function' ? (value as (state: State) => T)(state) : value

export const shownThings = (level: Level, state: State): Thing[] =>
  level.things.filter((t) => t.shown?.(state) ?? true)

const boxOf = (t: Thing): Box => ({ x: t.at.x, y: t.at.y, w: t.size?.x ?? 1, h: t.size?.y ?? 1 })

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

const playerBox = (center: Vec): Box => ({ x: center.x - PLAYER_SIZE / 2, y: center.y - PLAYER_SIZE / 2, w: PLAYER_SIZE, h: PLAYER_SIZE })

export const patrolAt = (t: Thing, step: number): Vec => (t.patrol ? [t.at, ...t.patrol.to][step % (t.patrol.to.length + 1)] : t.at)

// `steps` counts each patrolling thing's jumps, by id.
export const placed = (things: Thing[], steps: Readonly<Record<string, number>>): Thing[] =>
  things.map((t) => (t.patrol ? { ...t, at: patrolAt(t, steps[t.id] ?? 0) } : t))

export const crushes = (t: Thing, at: Vec, player: Vec): boolean =>
  (t.solid ?? true) && overlaps(boxOf({ ...t, at }), playerBox(player))

const contains = (b: Box, p: Vec) => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h

// Outside the map counts as solid.
function solidTile(level: Level, tx: number, ty: number): boolean {
  const ch = level.map[ty]?.[tx]
  return ch === undefined || level.tiles[ch].solid === true
}

function blocked(level: Level, things: Thing[], center: Vec): boolean {
  const box = playerBox(center)
  for (let ty = Math.floor(box.y); ty < Math.ceil(box.y + box.h); ty++)
    for (let tx = Math.floor(box.x); tx < Math.ceil(box.x + box.w); tx++) if (solidTile(level, tx, ty)) return true
  return things.some((t) => (t.solid ?? true) && overlaps(box, boxOf(t)))
}

// Per-axis so the player slides along walls.
export function move(level: Level, things: Thing[], pos: Vec, delta: Vec): Vec {
  const alongX = { x: pos.x + delta.x, y: pos.y }
  const afterX = blocked(level, things, alongX) ? pos : alongX
  const alongY = { x: afterX.x, y: afterX.y + delta.y }
  return blocked(level, things, alongY) ? afterX : alongY
}

export function thingAhead(things: Thing[], center: Vec, facing: Vec): Thing | undefined {
  const reach = PLAYER_SIZE / 2 + 0.3
  const probe = { x: center.x + facing.x * reach, y: center.y + facing.y * reach }
  return things.find((t) => contains(boxOf(t), probe)) ?? things.find((t) => contains(boxOf(t), center))
}
