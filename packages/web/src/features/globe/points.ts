import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three'

import { orbitPosition, type GlobeLayout, type GlobePoint } from './layout'

export interface GlobeColors {
  folder: string
  file: string
  critical: string
  warning: string
  info: string
  dim: string
}

/** At the default camera distance a disc of size 5 is about 8 CSS px: small marks, not glowing blobs. */
const POINT_SCALE = 6

const VERTEX = `
attribute float size;
attribute vec3 tint;
attribute float pulse;
uniform float uTime;
uniform vec3 uCameraDir;
uniform float uScale;
varying vec3 vTint;
varying float vAlpha;
void main() {
  vTint = tint;
  vec4 world = modelMatrix * vec4(position, 1.0);
  float facing = dot(normalize(world.xyz), uCameraDir);
  vAlpha = mix(0.12, 1.0, smoothstep(-0.5, 0.35, facing));
  float beat = 1.0 + pulse * 0.35 * (0.5 + 0.5 * sin(uTime * 4.0));
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * beat * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`

const FRAGMENT = `
varying vec3 vTint;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  // Crisp disc with a thin soft halo: readable markers, no blobs.
  float core = 1.0 - smoothstep(0.4, 0.5, d);
  float halo = (1.0 - smoothstep(0.5, 1.0, d)) * 0.3;
  gl_FragColor = vec4(vTint, (core + halo) * vAlpha);
}`

/**
 * All folders and files in one Points object with per-point size, tint and
 * pulse: one draw call for thousands of nodes. Files orbit their folder, so
 * positions are rewritten each frame.
 */
export class GlobePoints {
  readonly mesh: Points
  private readonly geometry = new BufferGeometry()
  private readonly material: ShaderMaterial
  private readonly positions: Float32Array
  private readonly sizes: Float32Array
  private readonly tints: Float32Array
  private readonly pulses: Float32Array
  private readonly orbitSpeed: Float32Array
  private readonly uniforms = {
    uTime: { value: 0 },
    uCameraDir: { value: new Vector3(0, 0, 1) },
    uScale: { value: POINT_SCALE },
  }

  constructor(
    readonly layout: GlobeLayout,
    private colors: GlobeColors,
  ) {
    const n = layout.points.length
    this.positions = new Float32Array(n * 3)
    this.sizes = new Float32Array(n)
    this.tints = new Float32Array(n * 3)
    this.pulses = new Float32Array(n)
    this.orbitSpeed = new Float32Array(n)
    layout.points.forEach((p, i) => {
      this.positions.set(p.position, i * 3)
      // Slightly different speeds so orbits do not move in lockstep.
      this.orbitSpeed[i] = 0.05 + ((i * 7919) % 13) * 0.004
    })
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('size', new BufferAttribute(this.sizes, 1))
    this.geometry.setAttribute('tint', new BufferAttribute(this.tints, 3))
    this.geometry.setAttribute('pulse', new BufferAttribute(this.pulses, 1))
    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: this.uniforms,
    })
    this.mesh = new Points(this.geometry, this.material)
    this.mesh.frustumCulled = true
    this.restyle(new Set(), undefined)
  }

  setColors(colors: GlobeColors): void {
    this.colors = colors
  }

  /** Recolours every point for the active chip filter and selection. Points outside the filter fade. */
  restyle(highlighted: Set<string>, selectedId: string | undefined, filtering = false): void {
    const c = this.colors
    const tint = new Color()
    this.layout.points.forEach((p, i) => {
      const inFilter = !filtering || highlighted.has(p.id)
      const hasProblem = Boolean(p.severity) && inFilter
      const colour = hasProblem
        ? severityColour(c, p.severity)
        : filtering
          ? c.dim
          : p.kind === 'folder'
            ? c.folder
            : c.file
      tint.set(colour)
      this.tints.set([tint.r, tint.g, tint.b], i * 3)
      const base = p.kind === 'folder' ? 8 : 5
      const problemBoost = hasProblem ? (p.severity === 'critical' ? 9 : 6) : 0
      this.sizes[i] =
        (p.id === selectedId ? 22 : base + problemBoost) * (filtering && !inFilter ? 0.6 : 1)
      this.pulses[i] = p.severity === 'critical' && inFilter ? 1 : p.id === selectedId ? 0.5 : 0
    })
    this.geometry.getAttribute('size').needsUpdate = true
    this.geometry.getAttribute('tint').needsUpdate = true
    this.geometry.getAttribute('pulse').needsUpdate = true
  }

  /** Advances orbits; with reduced motion `dt` is 0 and positions stay put. */
  tick(time: number, dt: number, cameraDir: Vector3, pixelRatio: number): void {
    this.uniforms.uTime.value = time
    this.uniforms.uCameraDir.value.copy(cameraDir)
    this.uniforms.uScale.value = POINT_SCALE * pixelRatio
    if (dt === 0) return
    const points = this.layout.points
    for (const [i, p] of points.entries()) {
      if (!p.orbit) continue
      p.orbit.angle += dt * (this.orbitSpeed[i] ?? 0.05)
      const center = points[p.folder]?.position ?? p.position
      this.positions.set(
        orbitPosition(center, p.orbit.u, p.orbit.v, p.orbit.radius, p.orbit.angle),
        i * 3,
      )
    }
    this.geometry.getAttribute('position').needsUpdate = true
  }

  positionOf(index: number): Vector3 {
    return new Vector3(
      this.positions[index * 3],
      this.positions[index * 3 + 1],
      this.positions[index * 3 + 2],
    )
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}

function severityColour(c: GlobeColors, severity: GlobePoint['severity']): string {
  if (severity === 'critical') return c.critical
  if (severity === 'warning') return c.warning
  return c.info
}
