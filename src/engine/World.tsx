import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import type { Group, Mesh, PerspectiveCamera } from 'three'
import { axes, useHeldKeys } from './input'
import { facingOf, move, PLAYER_SIZE, type Player } from './level'
import { useLighting } from './lighting'
import { box, litMaterial, plane } from './material'
import type { Level, Look, Side, State, Thing, View } from './types'

/** Tiles per second. */
const SPEED = 4
/** Radians per second, 3D only. */
const TURN_SPEED = 2.6
const TILT_SECONDS = 0.9
/** A narrow field of view from far above reads as a flat top-down map. */
const TOP_FOV = 10
/** Shows about 16 tiles vertically at TOP_FOV. */
const TOP_HEIGHT = 8 / Math.tan(((TOP_FOV / 2) * Math.PI) / 180)
const EYE_FOV = 70
const EYE_HEIGHT = 0.5
const PLAYER_HEIGHT = 0.6
const DEFAULT_CEILING: Look = { color: '#0a0a0a' }
const DEFAULT_CEILING_HEIGHT = 1.5

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

type Props = {
  level: Level
  /** Things currently shown; hidden ones are already filtered out. */
  things: Thing[]
  state: State
  playerRef: RefObject<Player>
  /** Seen in top-down only; an image lies flat on top of the player. */
  playerLook: Look
  paused: boolean
  /** The view being tilted toward. */
  viewTarget: View
  /** Called when the tilt crosses its midpoint. */
  onView: (view: View) => void
}

/**
 * Renders the level in 3D (the top-down view is the same scene from high above), drives the camera
 * tilt between views, and moves the player: 8-way in top-down, turn-and-walk in 3D.
 */
export function World({ level, things, state, playerRef, playerLook, paused, viewTarget, onView }: Props) {
  const held = useHeldKeys()
  const body = useRef<Group>(null)
  const tilt = useRef(state.view === '3d' ? 1 : 0)
  const ceilingHeight = level.ceiling?.height ?? DEFAULT_CEILING_HEIGHT
  useLighting(level, things, state, playerRef)

  useFrame((three, dt) => {
    // Clamp so a stalled frame (tab switch) cannot tunnel through walls.
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
    if (body.current) {
      body.current.position.set(pos.x, 0, pos.y)
      body.current.visible = t < 0.5
    }
    const eased = t * t * (3 - 2 * t)
    const camera = three.camera as PerspectiveCamera
    camera.fov = lerp(TOP_FOV, EYE_FOV, eased)
    camera.updateProjectionMatrix()
    camera.position.set(pos.x, Math.exp(lerp(Math.log(TOP_HEIGHT), Math.log(EYE_HEIGHT), eased)), pos.y)
    // Top-down keeps north up; 3D looks along the player's yaw (wrapped so the tilt turns the short way).
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

/** Solid tiles are wall blocks up to the ceiling; others are a floor plus a downward-facing ceiling. */
function TileMesh({ x, y, tile, ceiling, height }: { x: number; y: number; tile: Level['tiles'][string]; ceiling: Look; height: number }) {
  if (tile.solid) {
    const side = (s: Side) => litMaterial(tile.faces?.[s] ?? tile, 'grid')
    const top = litMaterial(tile, 'grid')
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z = east, west, top, bottom, south, north.
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
      {/* Faces down, so back-face culling hides it from the top-down camera. */}
      <mesh
        position={[x + 0.5, height, y + 0.5]}
        rotation-x={Math.PI / 2}
        geometry={plane(1, 1)}
        material={litMaterial(tile.ceiling ?? ceiling, 'grid')}
      />
    </>
  )
}

/** Plain things are boxes. Image things lie flat on their top in top-down and stand as sprites in 3D. */
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

/** Upright plane that turns to face the camera around the vertical axis, like Doom's sprites. */
function Sprite({ x, z, bottom, width, height, look }: { x: number; z: number; bottom: number; width: number; height: number; look: Look }) {
  const ref = useRef<Mesh>(null)
  useFrame(({ camera }) => {
    if (ref.current) ref.current.rotation.y = camera.rotation.y
  })
  return <mesh ref={ref} position={[x, bottom + height / 2, z]} geometry={plane(width, height)} material={litMaterial(look, 'sprite')} />
}
