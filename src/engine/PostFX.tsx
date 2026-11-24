import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import {
  Color,
  HalfFloatType,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three'
import { resolve } from './level'
import { flickerScale, lightingGlsl, MAX_LIGHTS, occupancy, thingLights, type PlacedLight } from './lighting'
import type { Level, State, Thing } from './types'
import type { Player } from './World'

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

const fragmentShader = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uCamera; // tile coordinates at the screen center, y down
uniform vec2 uView; // visible area in tiles
uniform float uTime;
uniform float uVignette;
uniform float uGrain;
uniform float uScanlines;
uniform float uAberration;
uniform float uWobble;
varying vec2 vUv;

${lightingGlsl}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  uv.x += sin(uv.y * 18.0 + uTime * 2.1) * 0.006 * uWobble;
  uv.y += sin(uv.x * 13.0 + uTime * 1.3) * 0.004 * uWobble;

  vec2 split = (uv - 0.5) * 0.012 * uAberration;
  vec3 albedo = vec3(texture2D(tScene, uv + split).r, texture2D(tScene, uv).g, texture2D(tScene, uv - split).b);
  vec2 tile = uCamera + vec2(uv.x - 0.5, 0.5 - uv.y) * uView;
  // The scene target holds linear color; encode first so the effects below act on what is seen.
  vec3 c = linearToOutputTexel(vec4(albedo * lightAt(tile), 1.0)).rgb;

  c *= 1.0 - uScanlines * 0.5 * (0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159));
  c += (hash(gl_FragCoord.xy + fract(uTime) * 97.0) - 0.5) * 0.25 * uGrain;
  c *= 1.0 - uVignette * smoothstep(0.25, 0.75, distance(vUv, vec2(0.5)));
  gl_FragColor = vec4(c, 1.0);
}`

const drawingBuffer = new Vector2()
const scratchColor = new Color()

type Pass = {
  target: WebGLRenderTarget
  material: ShaderMaterial
  quad: Mesh<PlaneGeometry, ShaderMaterial>
  scene: Scene
  camera: OrthographicCamera
}

function createPass(): Pass {
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType })
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      tScene: { value: target.texture },
      tMap: { value: null },
      uMapSize: { value: new Vector2() },
      uCamera: { value: new Vector2() },
      uView: { value: new Vector2() },
      uAmbient: { value: new Color() },
      uLightCount: { value: 0 },
      uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new Vector3()) },
      uLightColor: { value: Array.from({ length: MAX_LIGHTS }, () => new Vector3()) },
      uTime: { value: 0 },
      uVignette: { value: 0 },
      uGrain: { value: 0 },
      uScanlines: { value: 0 },
      uAberration: { value: 0 },
      uWobble: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  })
  const quad = new Mesh(new PlaneGeometry(2, 2), material)
  return { target, material, quad, scene: new Scene().add(quad), camera: new OrthographicCamera() }
}

type Props = {
  level: Level
  /** Shown things; they block light and may emit it. */
  things: Thing[]
  state: State
  playerRef: RefObject<Player>
}

/**
 * Takes over rendering: draws the unlit scene into a texture, then to screen through one shader that
 * applies shadowed lighting and the level's effects.
 */
export function PostFX({ level, things, state, playerRef }: Props) {
  const passRef = useRef<Pass | null>(null)
  const lighting = level.lighting ? resolve(level.lighting, state) : {}
  const effects = level.effects ? resolve(level.effects, state) : {}
  const placed = thingLights(things, state)
  const map = useMemo(() => occupancy(level, things, state), [level, things, state])
  useEffect(() => () => map.dispose(), [map])

  useEffect(() => {
    const pass = createPass()
    passRef.current = pass
    return () => {
      passRef.current = null
      pass.target.dispose()
      pass.material.dispose()
      pass.quad.geometry.dispose()
    }
  }, [])

  // Priority 1 disables R3F's own render, so this is the only draw each frame.
  useFrame(({ gl, scene, camera, clock, size }) => {
    const pass = passRef.current
    if (!pass) return
    gl.getDrawingBufferSize(drawingBuffer)
    if (pass.target.width !== drawingBuffer.x || pass.target.height !== drawingBuffer.y)
      pass.target.setSize(drawingBuffer.x, drawingBuffer.y)
    gl.setRenderTarget(pass.target)
    gl.render(scene, camera)
    gl.setRenderTarget(null)

    const u = pass.material.uniforms
    u.tMap.value = map
    u.uMapSize.value.set(map.image.width, map.image.height)
    u.uCamera.value.set(camera.position.x, -camera.position.y)
    u.uView.value.set(size.width / camera.zoom, size.height / camera.zoom)
    u.uAmbient.value.set(lighting.ambientColor ?? '#ffffff').multiplyScalar(lighting.ambient ?? 1)

    const lights: PlacedLight[] = lighting.player ? [{ at: playerRef.current.pos, light: lighting.player }, ...placed] : placed
    const count = Math.min(lights.length, MAX_LIGHTS)
    for (let i = 0; i < count; i++) {
      const { at, light } = lights[i]
      const strength = (light.intensity ?? 1) * flickerScale(light.flicker ?? 0)
      scratchColor.set(light.color ?? '#ffffff').multiplyScalar(strength)
      u.uLightPos.value[i].set(at.x, at.y, light.radius ?? 4)
      u.uLightColor.value[i].set(scratchColor.r, scratchColor.g, scratchColor.b)
    }
    u.uLightCount.value = count

    u.uTime.value = clock.elapsedTime
    u.uVignette.value = effects.vignette ?? 0
    u.uGrain.value = effects.grain ?? 0
    u.uScanlines.value = effects.scanlines ?? 0
    u.uAberration.value = effects.aberration ?? 0
    u.uWobble.value = effects.wobble ?? 0
    gl.render(pass.scene, pass.camera)
  }, 1)

  return null
}
