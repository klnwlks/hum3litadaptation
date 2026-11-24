import type { Choice, Ctx, Line, State } from './types'

export const CHAR_MS = 30

export type Dialogue = {
  lines: Line[]
  index: number
  // -Infinity once skipped.
  startedAt: number
  after: ((ctx: Ctx) => void)[]
  choice: number
}

export const choicesOf = (line: Line, state: State): Choice[] =>
  typeof line === 'string' ? [] : (line.choices?.filter((c) => c.requires?.(state) ?? true) ?? [])

export const lineText = (line: Line): string => (typeof line === 'string' ? line : line.text)

export function revealed(d: Dialogue, now: number): number {
  const length = lineText(d.lines[d.index]).length
  return Math.min(length, Math.max(0, Math.floor((now - d.startedAt) / CHAR_MS)))
}

export const fullyRevealed = (d: Dialogue, now: number): boolean =>
  revealed(d, now) >= lineText(d.lines[d.index]).length
