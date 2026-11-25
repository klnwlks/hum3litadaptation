import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { playOnce, unlockAudio } from './audio'
import { choicesOf, fullyRevealed, type Dialogue } from './dialogue'
import { DialogueBox } from './DialogueBox'
import { Flipbook } from './Flipbook'
import { CHOICE_KEYS, INTERACT_KEYS, VIEW_KEYS } from './input'
import { Inventory } from './Inventory'
import { facingOf, resolve, shownThings, thingAhead, tileCenter, type Player } from './level'
import { PostFX } from './PostFX'
import type { Ctx, Frames, Item, Level, Line, Look, State, View } from './types'
import { World } from './World'

const RENDER_LINES = 240
const FLASH_MS = 90

const EMPTY: State = { flags: {}, items: new Set(), view: 'top' }
const DEFAULT_PLAYER: Look = { color: '#ffffff' }

function useLowResDpr(): number {
  const [dpr, setDpr] = useState(() => RENDER_LINES / window.innerHeight)
  useEffect(() => {
    const onResize = () => setDpr(RENDER_LINES / window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return dpr
}

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
  player?: Look
}

export function Game({ levels, items, start, player = DEFAULT_PLAYER }: Props) {
  const [level, setLevel] = useState(() => levelById(levels, start))
  const [state, setState] = useState(EMPTY)
  const [dialogue, setDialogue] = useState(() => opening(level, EMPTY))
  const [viewTarget, setViewTarget] = useState<View>('top')
  const [backdrop, setBackdrop] = useState<Frames>()
  const playerRef = useRef<Player>({ pos: tileCenter(level.spawn), yaw: Math.PI })
  const dpr = useLowResDpr()
  const things = shownThings(level, state)
  // Latest ctx, for timers and triggers that fire outside key handling.
  const ctxRef = useRef<Ctx | null>(null)
  const timers = useRef(new Set<number>())
  const [flash, setFlash] = useState<string>()
  const later = (ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, ms)
    timers.current.add(id)
  }
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])
  // Set synchronously wherever dialogue opens or closes, so a queued timer that opens one stops the drain.
  const dialogueOpen = useRef(dialogue !== null)
  const queued = useRef<((ctx: Ctx) => void)[]>([])
  const drain = () => {
    while (!dialogueOpen.current && ctxRef.current && queued.current.length > 0) queued.current.shift()!(ctxRef.current)
  }

  // Keyed on line position so skipping the typewriter doesn't replay it.
  const lines = dialogue?.lines
  const index = dialogue?.index
  const line = lines?.[index ?? 0]
  const lineSound = typeof line === 'object' ? line.sound : undefined
  useEffect(() => {
    if (lineSound) playOnce(lineSound)
  }, [lines, index, lineSound])

  useEffect(() => {
    // Lets set-then-goto in one callback see the new state.
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
        const opened = opening(next, current)
        dialogueOpen.current = opened !== null
        setDialogue(opened)
      },
      play: playOnce,
      view: setViewTarget,
      image(frames, seconds) {
        setBackdrop(frames)
        if (!frames || seconds === undefined) return
        later(seconds * 1000, () => setBackdrop((now) => (now === frames ? undefined : now)))
      },
      flash(color = '#ffffff', times = 1) {
        for (let i = 0; i < times * 2; i++) later(i * FLASH_MS, () => setFlash(i % 2 === 0 ? color : undefined))
      },
      say: (ls) => start(resolve(ls, current), []),
      wait(seconds, fn) {
        const id = window.setTimeout(() => {
          timers.current.delete(id)
          queued.current.push(fn)
          drain()
        }, seconds * 1000)
        timers.current.add(id)
      },
    }
    ctxRef.current = ctx

    const start = (ls: Line[], after: Dialogue['after']) => {
      dialogueOpen.current = ls.length > 0
      if (ls.length > 0) return setDialogue({ lines: ls, index: 0, startedAt: performance.now(), after, choice: 0 })
      setDialogue(null)
      for (const fn of after) fn(ctx)
    }

    const onKey = (e: KeyboardEvent) => {
      const now = performance.now()
      unlockAudio()
      if (VIEW_KEYS[e.code] && !dialogue && !e.repeat) {
        e.preventDefault()
        return setViewTarget((v) => (v === '3d' ? 'top' : '3d'))
      }
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
        // Close first so a goto's enter dialogue isn't overwritten.
        return start([], dialogue.after)
      }
      const p = playerRef.current
      const thing = thingAhead(shownThings(level, current), p.pos, facingOf(p.yaw))
      if (thing) start(resolve(thing.lines, current), thing.after ? [thing.after] : [])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialogue, items, level, levels, state])

  // After the effect above, so drained timers get the fresh ctx.
  useEffect(() => {
    if (!dialogue) drain()
  })

  return (
    <div className="relative h-screen w-screen bg-black">
      <Canvas
        flat
        dpr={dpr}
        gl={{ antialias: false }}
        camera={{ fov: 10, near: 0.05, far: 300 }}
        className="[image-rendering:pixelated]"
      >
        <World
          level={level}
          things={things}
          state={state}
          playerRef={playerRef}
          playerLook={player}
          paused={dialogue !== null}
          viewTarget={viewTarget}
          onView={(view) => setState((s) => ({ ...s, view }))}
          onTrigger={(trigger) => ctxRef.current && trigger.enter(ctxRef.current)}
        />
        <PostFX effects={level.effects ? resolve(level.effects, state) : {}} />
      </Canvas>
      {backdrop && (
        <Flipbook frames={backdrop} className="pointer-events-none absolute inset-0 h-full w-full object-contain [image-rendering:pixelated]" />
      )}
      {flash && <div className="pointer-events-none absolute inset-0" style={{ background: flash }} />}
      <Inventory held={state.items} items={items} />
      {dialogue && <DialogueBox dialogue={dialogue} choices={choicesOf(dialogue.lines[dialogue.index], state)} />}
    </div>
  )
}
