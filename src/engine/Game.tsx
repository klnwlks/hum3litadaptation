import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { DialogueBox } from './DialogueBox'
import { INTERACT_KEYS } from './input'
import { lines, shownThings, thingAhead, tileCenter } from './level'
import type { Ctx, Flags, Level, Thing } from './types'
import { World, type Player } from './World'

/** Screen pixels per tile. */
const ZOOM = 48

type Dialogue = { lines: string[]; index: number; after?: Thing['after'] }

function opening(level: Level, flags: Flags): Dialogue | null {
  const ls = level.enter ? lines(level.enter, flags) : []
  return ls.length > 0 ? { lines: ls, index: 0 } : null
}

function levelById(levels: Record<string, Level>, id: string): Level {
  const level = levels[id]
  if (!level) throw new Error(`unknown level '${id}'`)
  return level
}

/** Owns game state: current level, story flags, open dialogue, and the player. */
export function Game({ levels, start }: { levels: Record<string, Level>; start: string }) {
  const [level, setLevel] = useState(() => levelById(levels, start))
  const [flags, setFlags] = useState<Flags>({})
  const [dialogue, setDialogue] = useState(() => opening(level, {}))
  const playerRef = useRef<Player>({ pos: tileCenter(level.spawn), facing: { x: 0, y: 1 } })
  const things = shownThings(level, flags)

  useEffect(() => {
    // Local copy so an `after` callback sees its own `set` immediately (e.g. set then goto).
    let current = flags
    const ctx: Ctx = {
      get flags() {
        return current
      },
      set(flag, value) {
        current = { ...current, [flag]: value }
        setFlags(current)
      },
      goto(id, at) {
        const next = levelById(levels, id)
        playerRef.current = { ...playerRef.current, pos: tileCenter(at ?? next.spawn) }
        setLevel(next)
        setDialogue(opening(next, current))
      },
    }

    const onKey = (e: KeyboardEvent) => {
      if (!INTERACT_KEYS[e.code] || e.repeat) return
      e.preventDefault()
      if (dialogue) {
        if (dialogue.index + 1 < dialogue.lines.length) return setDialogue({ ...dialogue, index: dialogue.index + 1 })
        // Close first so a `goto` inside `after` can open the next level's dialogue.
        setDialogue(null)
        return dialogue.after?.(ctx)
      }
      const p = playerRef.current
      const thing = thingAhead(shownThings(level, current), p.pos, p.facing)
      if (!thing) return
      const ls = lines(thing.lines, current)
      if (ls.length > 0) setDialogue({ lines: ls, index: 0, after: thing.after })
      else thing.after?.(ctx)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialogue, flags, level, levels])

  return (
    <div className="relative h-screen w-screen bg-black">
      <Canvas orthographic flat gl={{ antialias: false }} camera={{ zoom: ZOOM, position: [0, 0, 10] }}>
        <World level={level} things={things} playerRef={playerRef} paused={dialogue !== null} />
      </Canvas>
      {dialogue && <DialogueBox text={dialogue.lines[dialogue.index]} />}
    </div>
  )
}
