import { resolve } from './level'
import type { Cond, Lines, Thing } from './types'

export const has =
  (item: string): Cond =>
  (s) =>
    s.items.has(item)

export const flag =
  (name: string): Cond =>
  (s) =>
    s.flags[name] !== undefined && s.flags[name] !== false

/** A thing that gives `item` and disappears once its lines are read. */
export function pickup({ item, ...thing }: Thing & { item: string }): Thing {
  const taken = `picked:${thing.id}`
  return {
    ...thing,
    shown: (s) => !s.flags[taken] && (thing.shown?.(s) ?? true),
    after: (ctx) => {
      ctx.set(taken, true)
      ctx.give(item)
      thing.after?.(ctx)
    },
  }
}

/**
 * Solid until interacted with while holding `key`, then gone for good.
 * `lines` play while locked, `opened` (default none) when unlocking. `consume` takes the key.
 */
export function door({
  key,
  consume = false,
  opened = [],
  ...thing
}: Thing & { key: string; consume?: boolean; opened?: Lines }): Thing {
  const open = `opened:${thing.id}`
  return {
    ...thing,
    shown: (s) => !s.flags[open] && (thing.shown?.(s) ?? true),
    lines: (s) => (s.items.has(key) ? resolve(opened, s) : resolve(thing.lines, s)),
    after: (ctx) => {
      if (ctx.state.items.has(key)) {
        ctx.set(open, true)
        if (consume) ctx.take(key)
      }
      thing.after?.(ctx)
    },
  }
}
