import { useEffect, useRef } from 'react'
import type { Vec } from './types'

const DIRS: Record<string, Vec> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyW: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
}

export const INTERACT_KEYS: Record<string, true> = { KeyE: true, Space: true, Enter: true }

/** Moves the highlighted dialogue choice. */
export const CHOICE_KEYS: Record<string, -1 | 1> = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1 }

/** Toggles between top-down and 3D. */
export const VIEW_KEYS: Record<string, true> = { KeyQ: true }

/** Held movement keys, read every frame without re-rendering. */
export function useHeldKeys() {
  const held = useRef(new Set<string>())
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!(e.code in DIRS)) return
      held.current.add(e.code)
      e.preventDefault()
    }
    const up = (e: KeyboardEvent) => held.current.delete(e.code)
    const clear = () => held.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])
  return held
}

/**
 * Held direction keys as -1/0/1 per axis (y: -1 = up/forward). Opposing keys cancel; W and ArrowUp
 * together still give 1, not 2.
 */
export function axes(held: ReadonlySet<string>): Vec {
  let x = 0
  let y = 0
  for (const code of held) {
    x += DIRS[code].x
    y += DIRS[code].y
  }
  return { x: Math.sign(x), y: Math.sign(y) }
}
