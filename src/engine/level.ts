import type { Flags, Level, Thing, Vec } from './types'

/** Player hitbox edge, in tiles. */
export const PLAYER_SIZE = 0.7

type Box = { x: number; y: number; w: number; h: number }

/** Validates a level at load time so map typos fail loudly instead of rendering wrong. */
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

export const tileCenter = (v: Vec): Vec => ({ x: v.x + 0.5, y: v.y + 0.5 })

export const lines = (l: Thing['lines'], flags: Flags): string[] => (typeof l === 'function' ? l(flags) : l)

export const shownThings = (level: Level, flags: Flags): Thing[] =>
  level.things.filter((t) => t.shown?.(flags) ?? true)

const boxOf = (t: Thing): Box => ({ x: t.at.x, y: t.at.y, w: t.size?.x ?? 1, h: t.size?.y ?? 1 })

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

const contains = (b: Box, p: Vec) => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h

/** Outside the map counts as solid. */
function solidTile(level: Level, tx: number, ty: number): boolean {
  const ch = level.map[ty]?.[tx]
  return ch === undefined || level.tiles[ch].solid === true
}

function blocked(level: Level, things: Thing[], center: Vec): boolean {
  const half = PLAYER_SIZE / 2
  const box = { x: center.x - half, y: center.y - half, w: PLAYER_SIZE, h: PLAYER_SIZE }
  for (let ty = Math.floor(box.y); ty < Math.ceil(box.y + box.h); ty++)
    for (let tx = Math.floor(box.x); tx < Math.ceil(box.x + box.w); tx++) if (solidTile(level, tx, ty)) return true
  return things.some((t) => (t.solid ?? true) && overlaps(box, boxOf(t)))
}

/** Moves `pos` by `delta`, resolving each axis separately so the player slides along walls. */
export function move(level: Level, things: Thing[], pos: Vec, delta: Vec): Vec {
  const alongX = { x: pos.x + delta.x, y: pos.y }
  const afterX = blocked(level, things, alongX) ? pos : alongX
  const alongY = { x: afterX.x, y: afterX.y + delta.y }
  return blocked(level, things, alongY) ? afterX : alongY
}

/** The thing just in front of the player, else the one they stand on (non-solid things). */
export function thingAhead(things: Thing[], center: Vec, facing: Vec): Thing | undefined {
  const reach = PLAYER_SIZE / 2 + 0.3
  const probe = { x: center.x + facing.x * reach, y: center.y + facing.y * reach }
  return things.find((t) => contains(boxOf(t), probe)) ?? things.find((t) => contains(boxOf(t), center))
}
