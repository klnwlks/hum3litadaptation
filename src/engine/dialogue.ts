import type { Choice, Ctx, Line, State } from './types'

/** Typewriter speed: milliseconds per revealed character. */
export const CHAR_MS = 30

export type Dialogue = {
  lines: Line[]
  index: number
  /** `performance.now()` when the current line began typing; `-Infinity` once skipped. */
  startedAt: number
  /** Callbacks run in order when the conversation ends. */
  after: ((ctx: Ctx) => void)[]
  /** Highlighted choice, an index into `choicesOf(current line)`. */
  choice: number
}

/** Choices on `line` whose `requires` holds. */
export const choicesOf = (line: Line, state: State): Choice[] =>
  typeof line === 'string' ? [] : (line.choices?.filter((c) => c.requires?.(state) ?? true) ?? [])

export const lineText = (line: Line): string => (typeof line === 'string' ? line : line.text)

/** How many characters of the current line are visible at `now`. */
export function revealed(d: Dialogue, now: number): number {
  const length = lineText(d.lines[d.index]).length
  return Math.min(length, Math.max(0, Math.floor((now - d.startedAt) / CHAR_MS)))
}

export const fullyRevealed = (d: Dialogue, now: number): boolean =>
  revealed(d, now) >= lineText(d.lines[d.index]).length
