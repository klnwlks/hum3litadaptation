import { useFrame, useLoader } from '@react-three/fiber'
import { Suspense, useRef, type RefObject } from 'react'
import { NearestFilter, TextureLoader, type Mesh } from 'three'
import { heading, useHeldKeys } from './input'
import { move, PLAYER_SIZE } from './level'
import type { Level, Look, Thing, Vec } from './types'

/** Tiles per second. */
const SPEED = 4
const PLAYER_COLOR = '#ffffff'
const TILE_Z = 0
const THING_Z = 1
const PLAYER_Z = 2

export type Player = { pos: Vec; facing: Vec }

type Props = {
  level: Level
  /** Things currently shown; hidden ones are already filtered out. */
  things: Thing[]
  playerRef: RefObject<Player>
  paused: boolean
}

/**
 * Renders the unlit level (PostFX lights it) and drives player movement.
 * World y grows downward, so it is negated for three.js.
 */
export function World({ level, things, playerRef, paused }: Props) {
  const held = useHeldKeys()
  const body = useRef<Mesh>(null)

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
      {level.map.flatMap((row, y) =>
        [...row].map((ch, x) => <Rect key={`${x},${y}`} at={{ x, y }} look={level.tiles[ch]} z={TILE_Z} />),
      )}
      {things.map((t) => (
        <Rect key={t.id} at={t.at} size={t.size} look={t} z={THING_Z} />
      ))}
      <mesh ref={body}>
        <planeGeometry args={[PLAYER_SIZE, PLAYER_SIZE]} />
        <meshBasicMaterial color={PLAYER_COLOR} />
      </mesh>
    </>
  )
}

function Rect({ at, size = { x: 1, y: 1 }, look, z }: { at: Vec; size?: Vec; look: Look; z: number }) {
  const plain = <meshBasicMaterial color={look.color} />
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
  return <meshBasicMaterial map={texture} map-magFilter={NearestFilter} transparent />
}
