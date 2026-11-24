import { DataTexture, NearestFilter, RGBAFormat } from 'three'
import { resolve } from './level'
import type { Level, Light, State, Thing, Vec } from './types'

/** Lights past this many (player light first, then things in level order) are ignored. */
export const MAX_LIGHTS = 16

export type PlacedLight = { at: Vec; light: Light }

/**
 * One texel per tile, red = 255 where light is blocked: solid tiles, and solid things that do not
 * emit light themselves (so a lamp never shadows its own glow).
 */
export function occupancy(level: Level, things: Thing[], state: State): DataTexture {
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

/** Lights emitted by shown things, placed at each thing's center. */
export function thingLights(things: Thing[], state: State): PlacedLight[] {
  const placed: PlacedLight[] = []
  for (const t of things) {
    const light = t.light && resolve(t.light, state)
    if (!light) continue
    const size = t.size ?? { x: 1, y: 1 }
    placed.push({ at: { x: t.at.x + size.x / 2, y: t.at.y + size.y / 2 }, light })
  }
  return placed
}

/** Random dips in brightness; 1 when steady. Called once per light per frame. */
export const flickerScale = (flicker: number): number =>
  flicker > 0 && Math.random() < flicker * 0.2 ? 1 - flicker * Math.random() : 1

/**
 * GLSL for `vec3 lightAt(vec2 tile)`: ambient plus every light that has a clear line to `tile`.
 * Tile coordinates, y down. Rays walk the occupancy grid cell by cell (DDA) and skip their starting
 * cell. A blocked cell is tested from its point nearest the light, so a wall face turned toward a
 * light is lit evenly instead of in slivers.
 */
export const lightingGlsl = /* glsl */ `
#define MAX_LIGHTS ${MAX_LIGHTS}
uniform sampler2D tMap;
uniform ivec2 uMapSize;
uniform vec3 uAmbient;
uniform int uLightCount;
uniform vec3 uLightPos[MAX_LIGHTS]; // xy: tile position, z: radius
uniform vec3 uLightColor[MAX_LIGHTS]; // linear color * intensity

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

vec3 lightAt(vec2 tile) {
  vec3 sum = uAmbient;
  ivec2 own = ivec2(floor(tile));
  bool inWall = blocked(own);
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;
    vec2 light = uLightPos[i].xy;
    float dist = distance(tile, light);
    if (dist >= uLightPos[i].z) continue;
    float falloff = 1.0 - dist / uLightPos[i].z;
    vec2 from = inWall ? clamp(light, vec2(own) + 0.001, vec2(own) + 0.999) : tile;
    sum += uLightColor[i] * falloff * falloff * visible(from, light);
  }
  return sum;
}
`
