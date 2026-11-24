import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import {
  HalfFloatType,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from 'three'
import type { Effects } from './types'

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

const fragmentShader = /* glsl */ `
uniform sampler2D tScene;
uniform float uTime;
uniform float uVignette;
uniform float uGrain;
uniform float uScanlines;
uniform float uAberration;
uniform float uWobble;
uniform float uDither;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i.y * 4 + i.x]) + 0.5) / 16.0;
}

void main() {
  vec2 uv = vUv;
  uv.x += sin(uv.y * 18.0 + uTime * 2.1) * 0.006 * uWobble;
  uv.y += sin(uv.x * 13.0 + uTime * 1.3) * 0.004 * uWobble;

  vec2 split = (uv - 0.5) * 0.012 * uAberration;
  vec3 c = vec3(texture2D(tScene, uv + split).r, texture2D(tScene, uv).g, texture2D(tScene, uv - split).b);
  // Target holds linear color; effects act on display values.
  c = linearToOutputTexel(vec4(c, 1.0)).rgb;

  c *= 1.0 - uScanlines * 0.5 * (0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159));
  c += (hash(gl_FragCoord.xy + fract(uTime) * 97.0) - 0.5) * 0.25 * uGrain;
  c *= 1.0 - uVignette * smoothstep(0.25, 0.75, distance(vUv, vec2(0.5)));
  // Ordered dither down to 32..2 levels per channel.
  if (uDither > 0.0) {
    float steps = mix(31.0, 1.0, uDither);
    c = floor(clamp(c, 0.0, 1.0) * steps + bayer4(gl_FragCoord.xy)) / steps;
  }
  gl_FragColor = vec4(c, 1.0);
}`

const drawingBuffer = new Vector2()

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
      uTime: { value: 0 },
      uVignette: { value: 0 },
      uGrain: { value: 0 },
      uScanlines: { value: 0 },
      uAberration: { value: 0 },
      uWobble: { value: 0 },
      uDither: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  })
  const quad = new Mesh(new PlaneGeometry(2, 2), material)
  return { target, material, quad, scene: new Scene().add(quad), camera: new OrthographicCamera() }
}

export function PostFX({ effects }: { effects: Effects }) {
  const passRef = useRef<Pass | null>(null)

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

  // Priority 1 replaces R3F's own render.
  useFrame(({ gl, scene, camera, clock }) => {
    const pass = passRef.current
    if (!pass) return
    gl.getDrawingBufferSize(drawingBuffer)
    if (pass.target.width !== drawingBuffer.x || pass.target.height !== drawingBuffer.y)
      pass.target.setSize(drawingBuffer.x, drawingBuffer.y)
    gl.setRenderTarget(pass.target)
    gl.render(scene, camera)
    gl.setRenderTarget(null)

    const u = pass.material.uniforms
    u.uTime.value = clock.elapsedTime
    u.uVignette.value = effects.vignette ?? 0
    u.uGrain.value = effects.grain ?? 0
    u.uScanlines.value = effects.scanlines ?? 0
    u.uAberration.value = effects.aberration ?? 0
    u.uWobble.value = effects.wobble ?? 0
    u.uDither.value = effects.dither ?? 0
    gl.render(pass.scene, pass.camera)
  }, 1)

  return null
}
