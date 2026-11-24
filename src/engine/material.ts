import {
  BoxGeometry,
  Color,
  DoubleSide,
  FrontSide,
  NearestFilter,
  PlaneGeometry,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
} from 'three'
import { lightingGlsl, lightingUniforms } from './lighting'
import type { Look } from './types'

// stretch: once over the mesh, over the color. grid: once per tile, over the color.
// sprite: once, cut out on alpha, lit as if flat.
export type Mapping = 'stretch' | 'grid' | 'sprite'

const vertexShader = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * world;
}`

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform sampler2D uImage;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;

${lightingGlsl}

void main() {
  vec3 n = normalize(vNormal);
  vec4 base = vec4(uColor, 1.0);
#ifdef USE_IMAGE
#ifdef GRID_UV
  // Floors: u east, v north; ceilings flip v to read upright from below. Walls: u to the viewer's right, v up.
  vec2 uv = abs(n.y) > 0.5 ? vec2(vWorld.x, -vWorld.z * n.y) : vec2(dot(vWorld.xz, vec2(n.z, -n.x)), vWorld.y);
#else
  vec2 uv = vUv;
#endif
  vec4 image = texture2D(uImage, uv);
#ifdef SPRITE
  if (image.a < 0.5) discard;
  base = image;
#else
  base.rgb = mix(uColor, image.rgb, image.a);
#endif
#endif
#ifdef SPRITE
  n = vec3(0.0, 1.0, 0.0);
#endif
  // Nudge inward so wall faces sample their own (blocked) cell.
  vec2 tile = vWorld.xz - n.xz * 0.01;
  gl_FragColor = vec4(base.rgb * lightAt(tile, n), 1.0);
}`

const loader = new TextureLoader()
const materials = new Map<string, ShaderMaterial>()

// Cached forever: looks are few.
export function litMaterial(look: Look, mapping: Mapping): ShaderMaterial {
  const key = `${look.color}|${look.image ?? ''}|${mapping}`
  const cached = materials.get(key)
  if (cached) return cached
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { ...lightingUniforms, uColor: { value: new Color(look.color) }, uImage: { value: null } },
    defines: mapping === 'grid' ? { GRID_UV: '' } : mapping === 'sprite' ? { SPRITE: '' } : {},
    side: mapping === 'sprite' ? DoubleSide : FrontSide,
  })
  if (look.image) {
    const url = look.image
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = SRGBColorSpace
        texture.magFilter = NearestFilter
        texture.wrapS = texture.wrapT = RepeatWrapping
        material.uniforms.uImage.value = texture
        material.defines.USE_IMAGE = ''
        material.needsUpdate = true
      },
      undefined,
      () => console.warn(`image '${url}' failed to load; drawing its color instead`),
    )
  }
  materials.set(key, material)
  return material
}

const boxes = new Map<string, BoxGeometry>()
const planes = new Map<string, PlaneGeometry>()

export function box(x: number, y: number, z: number): BoxGeometry {
  const key = `${x},${y},${z}`
  let geometry = boxes.get(key)
  if (!geometry) boxes.set(key, (geometry = new BoxGeometry(x, y, z)))
  return geometry
}

export function plane(x: number, y: number): PlaneGeometry {
  const key = `${x},${y}`
  let geometry = planes.get(key)
  if (!geometry) planes.set(key, (geometry = new PlaneGeometry(x, y)))
  return geometry
}
