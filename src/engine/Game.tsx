import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { choicesOf, fullyRevealed, type Dialogue } from './dialogue'
import { DialogueBox } from './DialogueBox'
import { CHOICE_KEYS, INTERACT_KEYS } from './input'
import { Inventory } from './Inventory'
import { resolve, shownThings, thingAhead, tileCenter } from './level'
import type { Ctx, Item, Level, Line, State } from './types'
import { World, type Player } from './World'

/** Screen pixels per tile. */
const ZOOM = 48

const EMPTY: State = { flags: {}, items: new Set() }

function opening(level: Level, state: State): Dialogue | null {
  const ls = level.enter ? resolve(level.enter, state) : []
  return ls.length > 0 ? { lines: ls, index: 0, startedAt: performance.now(), after: [], choice: 0 } : null
}

function levelById(levels: Record<string, Level>, id: string): Level {
  const level = levels[id]
  if (!level) throw new Error(`unknown level '${id}'`)
  return level
}

type Props = {
  levels: Record<string, Level>
  items: Record<string, Item>
  start: string
}

/** Owns game state: current level, story state, open dialogue, and the player. */
export function Game({ levels, items, start }: Props) {
  const [level, setLevel] = useState(() => levelById(levels, start))
  const [state, setState] = useState(EMPTY)
  const [dialogue, setDialogue] = useState(() => opening(level, EMPTY))
  const playerRef = useRef<Player>({ pos: tileCenter(level.spawn), facing: { x: 0, y: 1 } })
  const things = shownThings(level, state)

  useEffect(() => {
    // Local copy so an `after` callback sees its own changes immediately (e.g. set then goto).
    let current = state
    const update = (next: State) => {
      current = next
      setState(next)
    }
    const ctx: Ctx = {
      get state() {
        return current
      },
      set: (flag, value) => update({ ...current, flags: { ...current.flags, [flag]: value } }),
      give(item) {
        if (!(item in items)) throw new Error(`unknown item '${item}'`)
        update({ ...current, items: new Set(current.items).add(item) })
      },
      take(item) {
        const held = new Set(current.items)
        held.delete(item)
        update({ ...current, items: held })
      },
      goto(id, at) {
        const next = levelById(levels, id)
        playerRef.current = { ...playerRef.current, pos: tileCenter(at ?? next.spawn) }
        setLevel(next)
        setDialogue(opening(next, current))
      },
    }

    /** Opens `ls`, or runs `after` straight away when there is nothing to read. */
    const start = (ls: Line[], after: Dialogue['after']) => {
      if (ls.length > 0) return setDialogue({ lines: ls, index: 0, startedAt: performance.now(), after, choice: 0 })
      setDialogue(null)
      for (const fn of after) fn(ctx)
    }

    const onKey = (e: KeyboardEvent) => {
      const now = performance.now()
      const choices = dialogue ? choicesOf(dialogue.lines[dialogue.index], current) : []
      const step = CHOICE_KEYS[e.code]
      if (dialogue && step && choices.length > 0 && fullyRevealed(dialogue, now)) {
        e.preventDefault()
        return setDialogue({ ...dialogue, choice: (dialogue.choice + step + choices.length) % choices.length })
      }
      if (!INTERACT_KEYS[e.code] || e.repeat) return
      e.preventDefault()
      if (dialogue) {
        if (!fullyRevealed(dialogue, now)) return setDialogue({ ...dialogue, startedAt: -Infinity })
        const picked = choices[dialogue.choice]
        if (picked)
          return start(resolve(picked.lines ?? [], current), picked.after ? [picked.after, ...dialogue.after] : dialogue.after)
        if (dialogue.index + 1 < dialogue.lines.length)
          return setDialogue({ ...dialogue, index: dialogue.index + 1, startedAt: now, choice: 0 })
        // Close before `after` so a `goto` inside it can open the next level's dialogue.
        return start([], dialogue.after)
      }
      const p = playerRef.current
      const thing = thingAhead(shownThings(level, current), p.pos, p.facing)
      if (thing) start(resolve(thing.lines, current), thing.after ? [thing.after] : [])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialogue, items, level, levels, state])

  return (
    <div className="relative h-screen w-screen bg-black">
      <Canvas orthographic flat gl={{ antialias: false }} camera={{ zoom: ZOOM, position: [0, 0, 10] }}>
        <World level={level} things={things} state={state} playerRef={playerRef} paused={dialogue !== null} />
      </Canvas>
      <Inventory held={state.items} items={items} />
      {dialogue && <DialogueBox dialogue={dialogue} choices={choicesOf(dialogue.lines[dialogue.index], state)} />}
    </div>
  )
}
