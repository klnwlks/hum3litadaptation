import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import type { Mesh } from 'three'
import { heading, useHeldKeys } from './input'
import { move, PLAYER_SIZE } from './level'
import type { Level, Thing, Vec } from './types'

/** Tiles per second. */
const SPEED = 4
const PLAYER_COLOR = '#ffffff'

export type Player = { pos: Vec; facing: Vec }

type Props = {
  level: Level
  /** Things currently shown; hidden ones are already filtered out. */
  things: Thing[]
  player: RefObject<Player>
  paused: boolean
}

/** Renders the level and drives player movement. World y grows downward, so it is negated for three.js. */
export function World({ level, things, player, paused }: Props) {
  const held = useHeldKeys()
  const body = useRef<Mesh>(null)

  useFrame(({ camera }, dt) => {
    const p = player.current
    if (!paused) {
      const dir = heading(held.current)
      if (dir.x !== 0 || dir.y !== 0) {
        // Clamp so a stalled frame (tab switch) cannot tunnel through walls.
        const dist = SPEED * Math.min(dt, 0.1)
        p.facing = dir
        p.pos = move(level, things, p.pos, { x: dir.x * dist, y: dir.y * dist })
      }
    }
    body.current?.position.set(p.pos.x, -p.pos.y, 2)
    camera.position.set(p.pos.x, -p.pos.y, 10)
  })

  return (
    <>
      {level.map.flatMap((row, y) =>
        [...row].map((ch, x) => <Rect key={`${x},${y}`} at={{ x, y }} color={level.tiles[ch].color} z={0} />),
      )}
      {things.map((t) => (
        <Rect key={t.id} at={t.at} size={t.size} color={t.color} z={1} />
      ))}
      <mesh ref={body}>
        <planeGeometry args={[PLAYER_SIZE, PLAYER_SIZE]} />
        <meshBasicMaterial color={PLAYER_COLOR} />
      </mesh>
    </>
  )
}

function Rect({ at, size = { x: 1, y: 1 }, color, z }: { at: Vec; size?: Vec; color: string; z: number }) {
  return (
    <mesh position={[at.x + size.x / 2, -(at.y + size.y / 2), z]}>
      <planeGeometry args={[size.x, size.y]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}
