import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  QuadraticBezierCurve3,
  RingGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'

/** Core sphere + glow, two orbit rings, a starfield and the flowing link to the selected point. */
export class GlobeDecor {
  readonly group = new Group()
  readonly stars: Points
  private readonly core: Mesh
  private readonly glow: Sprite
  private readonly rings: Mesh[]
  private link?: Line
  private readonly disposables: { dispose: () => void }[] = []

  constructor(private accent: string, starColour: string) {
    this.core = new Mesh(new SphereGeometry(0.16, 32, 32), new MeshBasicMaterial({ color: accent }))
    this.glow = new Sprite(new SpriteMaterial({ map: glowTexture(accent), transparent: true, blending: AdditiveBlending, depthWrite: false }))
    this.glow.scale.set(1.1, 1.1, 1)
    this.rings = [this.ring(1.35, 0.42, 0.1), this.ring(1.55, -0.35, 0.5)]
    this.group.add(this.core, this.glow, ...this.rings)
    this.stars = starfield(starColour)
    this.disposables.push(this.core.geometry, this.core.material as MeshBasicMaterial, this.glow.material, this.stars.geometry, this.stars.material as PointsMaterial)
  }

  private ring(radius: number, tiltX: number, tiltZ: number): Mesh {
    const mesh = new Mesh(new RingGeometry(radius, radius + 0.006, 128), new MeshBasicMaterial({ color: this.accent, transparent: true, opacity: 0.35, side: 2 }))
    mesh.rotation.set(Math.PI / 2 + tiltX, 0, tiltZ)
    this.disposables.push(mesh.geometry, mesh.material as MeshBasicMaterial)
    return mesh
  }

  setAccent(accent: string, starColour: string): void {
    this.accent = accent
    ;(this.core.material as MeshBasicMaterial).color.set(accent)
    this.glow.material.map?.dispose()
    this.glow.material.map = glowTexture(accent)
    for (const r of this.rings) (r.material as MeshBasicMaterial).color.set(accent)
    ;(this.stars.material as PointsMaterial).color.set(starColour)
    this.link?.material && ((this.link.material as LineDashedMaterial).color = new Color(accent))
  }

  /** Curved, dashed line from the core to a point; the dash offset animates in `tick`. */
  linkTo(target: Vector3 | undefined, colour: string): void {
    if (this.link) {
      this.group.remove(this.link)
      this.link.geometry.dispose()
      ;(this.link.material as LineDashedMaterial).dispose()
      this.link = undefined
    }
    if (!target) return
    const mid = target.clone().multiplyScalar(0.75).add(new Vector3(0, 0.25, 0))
    const curve = new QuadraticBezierCurve3(new Vector3(0, 0, 0), mid, target)
    const geometry = new BufferGeometry().setFromPoints(curve.getPoints(40))
    const line = new Line(geometry, new LineDashedMaterial({ color: colour, dashSize: 0.05, gapSize: 0.04, transparent: true, opacity: 0.9 }))
    line.computeLineDistances()
    this.linkDistances = Float32Array.from(line.geometry.getAttribute('lineDistance').array)
    this.link = line
    this.group.add(line)
  }

  private linkDistances?: Float32Array

  tick(time: number, dt: number): void {
    const pulse = 1 + 0.04 * Math.sin(time * 1.5)
    this.core.scale.setScalar(dt === 0 ? 1 : pulse)
    // Shifting the dash distances makes the dashes flow from the core to the point.
    if (this.link && this.linkDistances && dt !== 0) {
      const attr = this.link.geometry.getAttribute('lineDistance')
      for (let i = 0; i < this.linkDistances.length; i++) attr.setX(i, (this.linkDistances[i] ?? 0) + time * 0.3)
      attr.needsUpdate = true
    }
    this.rings[0]!.rotation.z += dt * 0.05
    this.rings[1]!.rotation.z -= dt * 0.03
  }

  dispose(): void {
    this.linkTo(undefined, this.accent)
    for (const d of this.disposables) d.dispose()
  }
}

function glowTexture(colour: string): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const c = new Color(colour)
    const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, `rgba(${rgb},0.9)`)
    gradient.addColorStop(0.35, `rgba(${rgb},0.35)`)
    gradient.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  return new CanvasTexture(canvas)
}

function starfield(colour: string): Points {
  const count = 1200
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const r = 8 + Math.random() * 12
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions.set([r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)], i * 3)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  return new Points(geometry, new PointsMaterial({ color: colour, size: 0.035, transparent: true, opacity: 0.6, sizeAttenuation: true }))
}
