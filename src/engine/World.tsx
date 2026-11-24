import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import type { Group, Mesh, PerspectiveCamera } from 'three'
import { playOnce, useSoundscape } from './audio'
import { axes, useHeldKeys } from './input'
import { facingOf, move, PLAYER_SIZE, type Player } from './level'
import { useLighting } from './lighting'
import { animateMaterials, box, litMaterial, plane } from './material'
import type { Level, Look, Side, State, Thing, Trigger, View } from './types'

const SPEED = 4 // tiles/s
const TURN_SPEED = 2.6 // rad/s
const TILT_SECONDS = 0.9
// Narrow FOV from far above reads as a flat map.
const TOP_FOV = 10
const TOP_HEIGHT = 8 / Math.tan(((TOP_FOV / 2) * Math.PI) / 180) // ~16 tiles tall
const EYE_FOV = 70
const EYE_HEIGHT = 0.5
const PLAYER_HEIGHT = 0.6
const DEFAULT_CEILING: Look = { color: '#0a0a0a' }
const DEFAULT_CEILING_HEIGHT = 1.5
const STEP_LENGTH = 0.6 // tiles per footstep
const BOB = 0.035

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

type Props = {
  level: Level
  things: Thing[]
  state: State
  playerRef: RefObject<Player>
  playerLook: Look
  paused: boolean
  viewTarget: View
  onView: (view: View) => void
  onTrigger: (trigger: Trigger) => void
}

export function World({ level, things, state, playerRef, playerLook, paused, viewTarget, onView, onTrigger }: Props) {
  const held = useHeldKeys()
  const body = useRef<Group>(null)
  const tilt = useRef(state.view === '3d' ? 1 : 0)
  const walked = useRef(0)
  const inside = useRef(new Set<Trigger>())
  const ceilingHeight = level.ceiling?.height ?? DEFAULT_CEILING_HEIGHT
  useLighting(level, things, state, playerRef)
  useSoundscape(level, things, state, playerRef)

  useFrame((three, dt) => {
    animateMaterials(three.clock.elapsedTime)
    // Clamp so a stalled frame can't tunnel through walls.
    const step = Math.min(dt, 0.1)
    const before = tilt.current
    const t = viewTarget === '3d' ? Math.min(1, before + step / TILT_SECONDS) : Math.max(0, before - step / TILT_SECONDS)
    tilt.current = t
    if (before < 0.5 !== t < 0.5) onView(t < 0.5 ? 'top' : '3d')

    const a = axes(held.current)
    const player = playerRef.current
    if (!paused && t === 0 && (a.x !== 0 || a.y !== 0)) {
      const dist = (SPEED * step) / Math.hypot(a.x, a.y)
      const pos = move(level, things, player.pos, { x: a.x * dist, y: a.y * dist })
      playerRef.current = { pos, yaw: Math.atan2(a.x, -a.y) }
    } else if (!paused && t === 1 && (a.x !== 0 || a.y !== 0)) {
      const yaw = player.yaw + a.x * TURN_SPEED * step
      const forward = facingOf(yaw)
      const dist = -a.y * SPEED * step
      playerRef.current = { pos: move(level, things, player.pos, { x: forward.x * dist, y: forward.y * dist }), yaw }
    }

    const { pos, yaw } = playerRef.current
    const moved = Math.hypot(pos.x - player.pos.x, pos.y - player.pos.y)
    if (Math.floor((walked.current + moved) / STEP_LENGTH) > Math.floor(walked.current / STEP_LENGTH)) {
      const sound = level.tiles[level.map[Math.floor(pos.y)][Math.floor(pos.x)]].step
      if (sound) playOnce(sound, 0.5)
    }
    walked.current += moved

    for (const trigger of level.triggers ?? []) {
      const size = trigger.size ?? { x: 1, y: 1 }
      const isIn = pos.x >= trigger.at.x && pos.x < trigger.at.x + size.x && pos.y >= trigger.at.y && pos.y < trigger.at.y + size.y
      if (isIn && !inside.current.has(trigger) && (trigger.when?.(state) ?? true)) onTrigger(trigger)
      if (isIn) inside.current.add(trigger)
      else inside.current.delete(trigger)
    }

    if (body.current) {
      body.current.position.set(pos.x, 0, pos.y)
      body.current.visible = t < 0.5
    }
    const eased = t * t * (3 - 2 * t)
    const camera = three.camera as PerspectiveCamera
    camera.fov = lerp(TOP_FOV, EYE_FOV, eased)
    camera.updateProjectionMatrix()
    // Bob dips to 0 on each footfall; a slow sway keeps the view alive when standing still.
    const bob = Math.abs(Math.sin((walked.current * Math.PI) / STEP_LENGTH)) * BOB + Math.sin(three.clock.elapsedTime * 1.3) * 0.006
    camera.position.set(pos.x, Math.exp(lerp(Math.log(TOP_HEIGHT), Math.log(EYE_HEIGHT), eased)) + bob * eased, pos.y)
    // Wrapped yaw so the tilt turns the short way.
    camera.rotation.set(lerp(-Math.PI / 2, 0, eased), -Math.atan2(Math.sin(yaw), Math.cos(yaw)) * eased, 0, 'YXZ')
  })

  const ceiling = level.ceiling ?? DEFAULT_CEILING
  return (
    <>
      {level.map.flatMap((row, y) =>
        [...row].map((ch, x) => (
          <TileMesh key={`${x},${y}`} x={x} y={y} tile={level.tiles[ch]} ceiling={ceiling} height={ceilingHeight} />
        )),
      )}
      {things.map((t) => (
        <ThingMesh key={t.id} thing={t} view={state.view} />
      ))}
      <group ref={body}>
        {playerLook.image ? (
          <mesh
            position-y={PLAYER_HEIGHT}
            rotation-x={-Math.PI / 2}
            geometry={plane(PLAYER_SIZE, PLAYER_SIZE)}
            material={litMaterial(playerLook, 'sprite')}
          />
        ) : (
          <mesh position-y={PLAYER_HEIGHT / 2} geometry={box(PLAYER_SIZE, PLAYER_HEIGHT, PLAYER_SIZE)} material={litMaterial(playerLook, 'stretch')} />
        )}
      </group>
    </>
  )
}

function TileMesh({ x, y, tile, ceiling, height }: { x: number; y: number; tile: Level['tiles'][string]; ceiling: Look; height: number }) {
  if (tile.solid) {
    const side = (s: Side) => litMaterial(tile.faces?.[s] ?? tile, 'grid')
    const top = litMaterial(tile, 'grid')
    // BoxGeometry face order: east, west, top, bottom, south, north.
    return (
      <mesh
        position={[x + 0.5, height / 2, y + 0.5]}
        geometry={box(1, height, 1)}
        material={[side('e'), side('w'), top, top, side('s'), side('n')]}
      />
    )
  }
  return (
    <>
      <mesh position={[x + 0.5, 0, y + 0.5]} rotation-x={-Math.PI / 2} geometry={plane(1, 1)} material={litMaterial(tile, 'grid')} />
      {/* Faces down: back-face culling hides it from above. */}
      <mesh
        position={[x + 0.5, height, y + 0.5]}
        rotation-x={Math.PI / 2}
        geometry={plane(1, 1)}
        material={litMaterial(tile.ceiling ?? ceiling, 'grid')}
      />
    </>
  )
}

function ThingMesh({ thing, view }: { thing: Thing; view: View }) {
  const size = thing.size ?? { x: 1, y: 1 }
  const height = thing.height ?? 1
  const bottom = thing.elevation ?? 0
  const x = thing.at.x + size.x / 2
  const z = thing.at.y + size.y / 2
  if (!thing.image)
    return <mesh position={[x, bottom + height / 2, z]} geometry={box(size.x, height, size.y)} material={litMaterial(thing, 'stretch')} />
  if (view === 'top')
    return (
      <mesh position={[x, bottom + height, z]} rotation-x={-Math.PI / 2} geometry={plane(size.x, size.y)} material={litMaterial(thing, 'sprite')} />
    )
  return <Sprite x={x} z={z} bottom={bottom} width={size.x} height={height} look={thing} />
}

function Sprite({ x, z, bottom, width, height, look }: { x: number; z: number; bottom: number; width: number; height: number; look: Look }) {
  const ref = useRef<Mesh>(null)
  useFrame(({ camera }) => {
    if (ref.current) ref.current.rotation.y = camera.rotation.y
  })
  return <mesh ref={ref} position={[x, bottom + height / 2, z]} geometry={plane(width, height)} material={litMaterial(look, 'sprite')} />
}
