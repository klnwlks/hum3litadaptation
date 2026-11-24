import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, type RefObject } from 'react'
import { Color, DataTexture, NearestFilter, RGBAFormat, Vector2, Vector3 } from 'three'
import { resolve, type Player } from './level'
import type { Level, Light, State, Thing, Vec } from './types'

export const MAX_LIGHTS = 16

type PlacedLight = { at: Vec; light: Light }

// One texel per tile, red where light is blocked. Emitters are left out so lamps don't shadow themselves.
function occupancy(level: Level, things: Thing[], state: State): DataTexture {
  const width = level.map[0].length
  const height = level.map.length
  const data = new Uint8Array(width * height * 4)
  const block = (x: number, y: number) => {
    if (x >= 0 && x < width && y >= 0 && y < height) data[(y * width + x) * 4] = 255
  }
  level.map.forEach((row, y) => {
    for (let x = 0; x < width; x++) if (level.tiles[row[x]].solid) block(x, y)
  })
  for (const t of things) {
    if (!(t.solid ?? true) || (t.light && resolve(t.light, state))) continue
    const size = t.size ?? { x: 1, y: 1 }
    for (let y = Math.floor(t.at.y); y < Math.ceil(t.at.y + size.y); y++)
      for (let x = Math.floor(t.at.x); x < Math.ceil(t.at.x + size.x); x++) block(x, y)
  }
  const texture = new DataTexture(data, width, height, RGBAFormat)
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.needsUpdate = true
  return texture
}

function thingLights(things: Thing[], state: State): PlacedLight[] {
  const placed: PlacedLight[] = []
  for (const t of things) {
    const light = t.light && resolve(t.light, state)
    if (!light) continue
    const size = t.size ?? { x: 1, y: 1 }
    placed.push({ at: { x: t.at.x + size.x / 2, y: t.at.y + size.y / 2 }, light })
  }
  return placed
}

const flickerScale = (flicker: number): number =>
  flicker > 0 && Math.random() < flicker * 0.2 ? 1 - flicker * Math.random() : 1

// Shared by reference with every lit material.
export const lightingUniforms = {
  tMap: { value: null as DataTexture | null },
  uMapSize: { value: new Vector2() },
  uAmbient: { value: new Color() },
  uLightCount: { value: 0 },
  uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new Vector3()) },
  uLightColor: { value: Array.from({ length: MAX_LIGHTS }, () => new Vector3()) },
  uEye: { value: new Vector2() },
  uFogColor: { value: new Color() },
  uFogDistance: { value: 0 },
}

const scratchColor = new Color()

export function useLighting(level: Level, things: Thing[], state: State, playerRef: RefObject<Player>) {
  const lighting = level.lighting ? resolve(level.lighting, state) : {}
  const fog = level.fog ? resolve(level.fog, state) : undefined
  const placed = thingLights(things, state)
  const map = useMemo(() => occupancy(level, things, state), [level, things, state])
  useEffect(() => () => map.dispose(), [map])

  useFrame(() => {
    const u = lightingUniforms
    u.tMap.value = map
    u.uMapSize.value.set(map.image.width, map.image.height)
    u.uAmbient.value.set(lighting.ambientColor ?? '#ffffff').multiplyScalar(lighting.ambient ?? 1)
    const lights = lighting.player ? [{ at: playerRef.current.pos, light: lighting.player }, ...placed] : placed
    const count = Math.min(lights.length, MAX_LIGHTS)
    for (let i = 0; i < count; i++) {
      const { at, light } = lights[i]
      scratchColor.set(light.color ?? '#ffffff').multiplyScalar((light.intensity ?? 1) * flickerScale(light.flicker ?? 0))
      u.uLightPos.value[i].set(at.x, at.y, light.radius ?? 4)
      u.uLightColor.value[i].set(scratchColor.r, scratchColor.g, scratchColor.b)
    }
    u.uLightCount.value = count
    const { pos } = playerRef.current
    u.uEye.value.set(pos.x, pos.y)
    u.uFogColor.value.set(fog?.color ?? '#000000')
    u.uFogDistance.value = fog?.distance ?? 0
  })
}

// Flat lighting (height ignored). Rays walk the grid (DDA), skipping their start cell; a blocked cell
// is tested from its point nearest the light so wall faces light evenly.
export const lightingGlsl = /* glsl */ `
#define MAX_LIGHTS ${MAX_LIGHTS}
uniform sampler2D tMap;
uniform ivec2 uMapSize;
uniform vec3 uAmbient;
uniform int uLightCount;
uniform vec3 uLightPos[MAX_LIGHTS]; // xy: tile position, z: radius
uniform vec3 uLightColor[MAX_LIGHTS]; // linear color * intensity
uniform vec2 uEye;
uniform vec3 uFogColor;
uniform float uFogDistance; // 0 = off

vec3 fogged(vec3 color, vec2 tile) {
  if (uFogDistance <= 0.0) return color;
  return mix(color, uFogColor, smoothstep(0.0, uFogDistance, distance(tile, uEye)));
}

bool blocked(ivec2 cell) {
  if (any(lessThan(cell, ivec2(0))) || any(greaterThanEqual(cell, uMapSize))) return true;
  return texelFetch(tMap, cell, 0).r > 0.5;
}

float visible(vec2 from, vec2 to) {
  vec2 d = to - from;
  ivec2 cell = ivec2(floor(from));
  ivec2 end = ivec2(floor(to));
  ivec2 stepDir = ivec2(sign(d));
  vec2 tDelta = 1.0 / max(abs(d), vec2(1e-5));
  vec2 frac = from - floor(from);
  vec2 tMax = vec2(d.x > 0.0 ? 1.0 - frac.x : frac.x, d.y > 0.0 ? 1.0 - frac.y : frac.y) * tDelta;
  for (int i = 0; i < 64; i++) {
    if (cell == end) return 1.0;
    if (tMax.x < tMax.y) {
      tMax.x += tDelta.x;
      cell.x += stepDir.x;
    } else {
      tMax.y += tDelta.y;
      cell.y += stepDir.y;
    }
    if (cell == end) return 1.0;
    if (blocked(cell)) return 0.0;
  }
  return 1.0;
}

vec3 lightAt(vec2 tile, vec3 normal) {
  vec3 sum = uAmbient;
  ivec2 own = ivec2(floor(tile));
  bool inWall = blocked(own);
  bool upright = abs(normal.y) < 0.5;
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;
    vec2 light = uLightPos[i].xy;
    float dist = distance(tile, light);
    if (dist >= uLightPos[i].z) continue;
    float facing = upright ? max(dot(normal.xz, (light - tile) / max(dist, 1e-4)), 0.0) : 1.0;
    if (facing <= 0.0) continue;
    float falloff = 1.0 - dist / uLightPos[i].z;
    vec2 from = inWall ? clamp(light, vec2(own) + 0.001, vec2(own) + 0.999) : tile;
    sum += uLightColor[i] * falloff * falloff * facing * visible(from, light);
  }
  return sum;
}
`
