import { useFrame, useLoader } from '@react-three/fiber'
import { Suspense, useRef, type RefObject } from 'react'
import { NearestFilter, TextureLoader, type Mesh, type PointLight } from 'three'
import { heading, useHeldKeys } from './input'
import { move, PLAYER_SIZE, resolve } from './level'
import type { Level, Light, Look, State, Thing, Vec } from './types'

/** Tiles per second. */
const SPEED = 4
const PLAYER_COLOR = '#ffffff'
/** Layers are only for draw order; keep them near 0 so lights hit every layer alike. */
const TILE_Z = 0
const THING_Z = 0.01
const PLAYER_Z = 0.02
/** Height of point lights above the floor, in tiles. */
const LIGHT_HEIGHT = 1.5

export type Player = { pos: Vec; facing: Vec }

type Props = {
  level: Level
  /** Things currently shown; hidden ones are already filtered out. */
  things: Thing[]
  state: State
  playerRef: RefObject<Player>
  paused: boolean
}

/** Renders the level and drives player movement. World y grows downward, so it is negated for three.js. */
export function World({ level, things, state, playerRef, paused }: Props) {
  const held = useHeldKeys()
  const body = useRef<Mesh>(null)
  const lighting = level.lighting ? resolve(level.lighting, state) : {}

  useFrame(({ camera }, dt) => {
    if (!paused) {
      const dir = heading(held.current)
      if (dir.x !== 0 || dir.y !== 0) {
        // Clamp so a stalled frame (tab switch) cannot tunnel through walls.
        const dist = SPEED * Math.min(dt, 0.1)
        const pos = move(level, things, playerRef.current.pos, { x: dir.x * dist, y: dir.y * dist })
        playerRef.current = { pos, facing: dir }
      }
    }
    const { pos } = playerRef.current
    body.current?.position.set(pos.x, -pos.y, PLAYER_Z)
    camera.position.set(pos.x, -pos.y, 10)
  })

  return (
    <>
      <ambientLight color={lighting.ambientColor ?? '#ffffff'} intensity={(lighting.ambient ?? 1) * Math.PI} />
      {level.map.flatMap((row, y) =>
        [...row].map((ch, x) => <Rect key={`${x},${y}`} at={{ x, y }} look={level.tiles[ch]} z={TILE_Z} />),
      )}
      {things.map((t) => {
        const light = t.light && resolve(t.light, state)
        const size = t.size ?? { x: 1, y: 1 }
        return (
          <group key={t.id}>
            <Rect at={t.at} size={size} look={t} z={THING_Z} />
            {light && <Lamp light={light} x={t.at.x + size.x / 2} y={-(t.at.y + size.y / 2)} z={LIGHT_HEIGHT} />}
          </group>
        )
      })}
      <mesh ref={body}>
        <planeGeometry args={[PLAYER_SIZE, PLAYER_SIZE]} />
        <meshLambertMaterial color={PLAYER_COLOR} />
        {lighting.player && <Lamp light={lighting.player} x={0} y={0} z={LIGHT_HEIGHT - PLAYER_Z} />}
      </mesh>
    </>
  )
}

/** Point light; `x`/`y`/`z` are relative to the parent. */
function Lamp({ light, x, y, z }: { light: Light; x: number; y: number; z: number }) {
  const ref = useRef<PointLight>(null)
  // Lambert shading with decay 1 divides by π·distance; this scale makes intensity 1 full color right below.
  const base = (light.intensity ?? 1) * Math.PI * LIGHT_HEIGHT
  const flicker = light.flicker ?? 0
  useFrame(() => {
    if (!ref.current || flicker === 0) return
    ref.current.intensity = Math.random() < flicker * 0.2 ? base * (1 - flicker * Math.random()) : base
  })
  return (
    <pointLight
      ref={ref}
      position={[x, y, z]}
      color={light.color ?? '#ffffff'}
      intensity={base}
      distance={light.radius ?? 4}
      decay={1}
    />
  )
}

function Rect({ at, size = { x: 1, y: 1 }, look, z }: { at: Vec; size?: Vec; look: Look; z: number }) {
  const plain = <meshLambertMaterial color={look.color} />
  return (
    <mesh position={[at.x + size.x / 2, -(at.y + size.y / 2), z]}>
      <planeGeometry args={[size.x, size.y]} />
      {look.image ? (
        <Suspense fallback={plain}>
          <ImageMaterial url={look.image} />
        </Suspense>
      ) : (
        plain
      )}
    </mesh>
  )
}

/** Nearest-neighbour sampling keeps pixel art crisp when scaled up. */
function ImageMaterial({ url }: { url: string }) {
  const texture = useLoader(TextureLoader, url)
  return <meshLambertMaterial map={texture} map-magFilter={NearestFilter} transparent />
}
