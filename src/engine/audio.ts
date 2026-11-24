import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, type RefObject } from 'react'
import { resolve, type Player } from './level'
import type { Emitter, Level, State, Thing, Vec } from './types'

let context: AudioContext | null = null
const buffers = new Map<string, Promise<AudioBuffer | null>>()

function audio(): AudioContext {
  context ??= new AudioContext()
  return context
}

/** Browsers keep audio suspended until a user gesture; call from input handlers. */
export function unlockAudio() {
  const c = audio()
  if (c.state === 'suspended') void c.resume()
}

/** Decoded once per URL; failures warn once and resolve to null (silence). */
function load(src: string): Promise<AudioBuffer | null> {
  let buffer = buffers.get(src)
  if (!buffer) {
    buffer = fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(response.statusText)
        return response.arrayBuffer()
      })
      .then((bytes) => audio().decodeAudioData(bytes))
      .catch(() => {
        console.warn(`sound '${src}' failed to load; staying silent`)
        return null
      })
    buffers.set(src, buffer)
  }
  return buffer
}

/** Plays `src` once at `volume` (0 to 1). */
export function playOnce(src: string, volume = 1) {
  void load(src).then((buffer) => {
    if (!buffer) return
    const c = audio()
    const gain = c.createGain()
    gain.gain.value = volume
    const source = c.createBufferSource()
    source.buffer = buffer
    source.connect(gain).connect(c.destination)
    source.start()
  })
}

/** A looping sound with smoothed volume and stereo pan. Starts once loaded; `stop` is safe any time. */
class Loop {
  private readonly gain: GainNode
  private readonly panner: StereoPannerNode
  private source: AudioBufferSourceNode | null = null
  private stopped = false

  constructor(src: string, volume: number) {
    const c = audio()
    this.gain = c.createGain()
    this.gain.gain.value = volume
    this.panner = c.createStereoPanner()
    this.gain.connect(this.panner).connect(c.destination)
    void load(src).then((buffer) => {
      if (!buffer || this.stopped) return
      const source = c.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(this.gain)
      source.start()
      this.source = source
    })
  }

  set(volume: number, pan: number) {
    const now = audio().currentTime
    this.gain.gain.setTargetAtTime(volume, now, 0.05)
    this.panner.pan.setTargetAtTime(pan, now, 0.05)
  }

  stop() {
    this.stopped = true
    this.source?.stop()
    this.gain.disconnect()
    this.panner.disconnect()
  }
}

type Placed = { key: string; at: Vec; sound: Emitter }

/**
 * Plays the level's ambience and every shown thing's looping sound. Thing sounds fade to silence at
 * their radius and pan left/right: by screen side in top-down, by direction relative to facing in 3D.
 */
export function useSoundscape(level: Level, things: Thing[], state: State, playerRef: RefObject<Player>) {
  const ambience = level.ambience ? resolve(level.ambience, state) : undefined
  const ambienceSrc = ambience?.src
  const ambienceVolume = ambience?.volume ?? 1
  useEffect(() => {
    if (!ambienceSrc) return
    const loop = new Loop(ambienceSrc, ambienceVolume)
    return () => loop.stop()
  }, [ambienceSrc, ambienceVolume])

  const placed: Placed[] = []
  for (const t of things) {
    const sound = t.sound && resolve(t.sound, state)
    if (!sound) continue
    const size = t.size ?? { x: 1, y: 1 }
    placed.push({ key: JSON.stringify([t.id, sound.src]), at: { x: t.at.x + size.x / 2, y: t.at.y + size.y / 2 }, sound })
  }

  const loops = useRef(new Map<string, Loop>())
  // Keys are `[thingId, src]` JSON, so the effect can rebuild what to play from the key list alone.
  const keys = JSON.stringify(placed.map((p) => p.key))
  useEffect(() => {
    const live: string[] = JSON.parse(keys)
    for (const [key, loop] of loops.current)
      if (!live.includes(key)) {
        loop.stop()
        loops.current.delete(key)
      }
    // Start silent; the frame loop sets distance-based volume right away.
    for (const key of live) if (!loops.current.has(key)) loops.current.set(key, new Loop(JSON.parse(key)[1], 0))
  }, [keys])
  useEffect(() => {
    const all = loops.current
    return () => {
      for (const loop of all.values()) loop.stop()
      all.clear()
    }
  }, [])

  useFrame(() => {
    const { pos, yaw } = playerRef.current
    for (const p of placed) {
      const loop = loops.current.get(p.key)
      if (!loop) continue
      const dx = p.at.x - pos.x
      const dy = p.at.y - pos.y
      const radius = p.sound.radius ?? 6
      const fade = Math.max(0, 1 - Math.hypot(dx, dy) / radius)
      const pan = state.view === '3d' ? Math.sin(Math.atan2(dx, -dy) - yaw) : Math.max(-1, Math.min(1, dx / radius))
      loop.set((p.sound.volume ?? 1) * fade * fade, pan)
    }
  })
}
