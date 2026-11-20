import { Group, PerspectiveCamera, Raycaster, Scene, Vector2, Vector3, WebGLRenderer } from 'three'

import { GlobeDecor } from './decor'
import type { GlobeLayout } from './layout'
import { GlobePoints, type GlobeColors } from './points'

export interface SceneOptions {
  canvas: HTMLCanvasElement
  layout: GlobeLayout
  colors: GlobeColors & { accent: string; star: string }
  reducedMotion: boolean
  onSelect: (id: string | undefined) => void
  onHover: (id: string | undefined, x: number, y: number) => void
}

/**
 * Owns the renderer and the animation loop. Rendering stops while the tab is
 * hidden; auto-rotation pauses on hover/drag and is off with reduced motion.
 */
export class GlobeScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(45, 1, 0.1, 100)
  private readonly globe = new Group()
  private readonly points: GlobePoints
  private readonly decor: GlobeDecor
  private readonly raycaster = new Raycaster()
  private frame = 0
  private last = 0
  private hidden = document.hidden
  private hovering = false
  private dragging = false
  private pointerStart = { x: 0, y: 0, rx: 0, ry: 0 }
  private target = { rx: 0.25, ry: 0, distance: 3.4 }
  private flying = false
  private cycleIndex = -1
  paused = false

  constructor(private readonly options: SceneOptions) {
    this.renderer = new WebGLRenderer({ canvas: options.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    this.points = new GlobePoints(options.layout, options.colors)
    this.decor = new GlobeDecor(options.colors.accent, options.colors.star)
    this.globe.add(this.points.mesh, this.decor.group)
    this.scene.add(this.globe, this.decor.stars)
    this.globe.rotation.x = this.target.rx
    this.camera.position.z = this.target.distance
    this.raycaster.params.Points = { threshold: 0.07 }
    this.bind()
    this.resize()
    this.last = performance.now()
    this.loop(this.last)
  }

  setColors(colors: SceneOptions['colors']): void {
    this.points.setColors(colors)
    this.decor.setAccent(colors.accent, colors.star)
  }

  restyle(highlighted: Set<string>, selectedId: string | undefined, filtering: boolean): void {
    this.points.restyle(highlighted, selectedId, filtering)
    const index = selectedId ? this.options.layout.points.findIndex((p) => p.id === selectedId) : -1
    const point = index >= 0 ? this.options.layout.points[index] : undefined
    const colour = point?.severity === 'critical' ? this.options.colors.critical : point?.severity === 'warning' ? this.options.colors.warning : this.options.colors.accent
    this.decor.linkTo(index >= 0 ? this.points.positionOf(index) : undefined, colour)
  }

  /** Rotates the globe so the point faces the camera and zooms in a little. */
  flyTo(id: string): void {
    const index = this.options.layout.points.findIndex((p) => p.id === id)
    if (index < 0) return
    const p = this.points.positionOf(index).normalize()
    this.target = { ry: Math.atan2(-p.x, p.z), rx: Math.asin(p.y), distance: 2.6 }
    this.flying = true
    if (this.options.reducedMotion) this.snap()
  }

  rotate(dx: number, dy: number): void {
    this.target.ry += dx
    this.target.rx = clamp(this.target.rx + dy, -1.4, 1.4)
    this.flying = true
  }

  zoom(delta: number): void {
    this.target.distance = clamp(this.target.distance + delta, 1.8, 6)
    this.flying = true
  }

  reset(): void {
    this.target = { rx: 0.25, ry: 0, distance: 3.4 }
    this.flying = true
  }

  /** Enter on the focused canvas walks through the problem points. */
  cycleProblem(direction: 1 | -1): string | undefined {
    const problems = this.options.layout.points.filter((p) => p.severity)
    if (problems.length === 0) return undefined
    this.cycleIndex = (this.cycleIndex + direction + problems.length) % problems.length
    const id = problems[this.cycleIndex]?.id
    if (id) this.flyTo(id)
    return id
  }

  /** Screen position (CSS px) of a point or the core, for HTML overlays. */
  project(id: string): { x: number; y: number; visible: boolean } | undefined {
    const index = id === 'core' ? -1 : this.options.layout.points.findIndex((p) => p.id === id)
    if (id !== 'core' && index < 0) return undefined
    const local = index < 0 ? new Vector3(0, 0, 0) : this.points.positionOf(index)
    const world = local.applyMatrix4(this.globe.matrixWorld)
    const facing = world.clone().normalize().dot(this.camera.position.clone().normalize())
    const ndc = world.project(this.camera)
    const rect = this.options.canvas.getBoundingClientRect()
    return { x: ((ndc.x + 1) / 2) * rect.width, y: ((1 - ndc.y) / 2) * rect.height, visible: index < 0 || facing > -0.1 }
  }

  resize(): void {
    const { clientWidth, clientHeight } = this.options.canvas
    if (!clientWidth || !clientHeight) return
    this.renderer.setSize(clientWidth, clientHeight, false)
    this.camera.aspect = clientWidth / clientHeight
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    cancelAnimationFrame(this.frame)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.points.dispose()
    this.decor.dispose()
    this.renderer.dispose()
  }

  private snap(): void {
    this.globe.rotation.x = this.target.rx
    this.globe.rotation.y = this.target.ry
    this.camera.position.z = this.target.distance
    this.flying = false
  }

  private readonly onVisibility = (): void => {
    this.hidden = document.hidden
    if (!this.hidden) {
      this.last = performance.now()
      this.loop(this.last)
    }
  }

  private loop = (now: number): void => {
    if (this.hidden) return
    this.frame = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    const motion = this.options.reducedMotion ? 0 : dt
    if (!this.paused && !this.hovering && !this.dragging && !this.flying && motion) this.target.ry += motion * 0.08
    if (this.flying) {
      const k = this.options.reducedMotion ? 1 : 1 - Math.exp(-dt * 6)
      this.globe.rotation.x += (this.target.rx - this.globe.rotation.x) * k
      this.globe.rotation.y += (this.target.ry - this.globe.rotation.y) * k
      this.camera.position.z += (this.target.distance - this.camera.position.z) * k
      if (Math.abs(this.target.ry - this.globe.rotation.y) < 0.002 && Math.abs(this.target.distance - this.camera.position.z) < 0.002) this.snap()
    } else {
      this.globe.rotation.y = this.target.ry
    }
    this.globe.updateMatrixWorld()
    const cameraDir = this.camera.position.clone().normalize().applyQuaternion(this.globe.quaternion.clone().invert())
    this.points.tick(now / 1000, motion, cameraDir, this.renderer.getPixelRatio())
    this.decor.tick(now / 1000, motion)
    this.renderer.render(this.scene, this.camera)
  }

  private pick(event: PointerEvent): string | undefined {
    const rect = this.options.canvas.getBoundingClientRect()
    const ndc = new Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1))
    this.raycaster.setFromCamera(ndc, this.camera)
    const hits = this.raycaster.intersectObject(this.points.mesh)
    // Prefer problem points when several overlap; otherwise the nearest.
    const sorted = hits.sort((a, b) => (a.distanceToRay ?? 0) - (b.distanceToRay ?? 0))
    const hit = sorted.find((h) => this.options.layout.points[h.index ?? -1]?.severity) ?? sorted[0]
    return hit?.index === undefined ? undefined : this.options.layout.points[hit.index]?.id
  }

  private bind(): void {
    const canvas = this.options.canvas
    document.addEventListener('visibilitychange', this.onVisibility)
    canvas.addEventListener('pointerenter', () => {
      this.hovering = true
    })
    canvas.addEventListener('pointerleave', () => {
      this.hovering = false
      this.options.onHover(undefined, 0, 0)
    })
    canvas.addEventListener('pointerdown', (event) => {
      this.dragging = true
      this.pointerStart = { x: event.clientX, y: event.clientY, rx: this.target.rx, ry: this.target.ry }
      canvas.setPointerCapture(event.pointerId)
    })
    canvas.addEventListener('pointermove', (event) => {
      if (this.dragging) {
        this.target.ry = this.pointerStart.ry + (event.clientX - this.pointerStart.x) * 0.006
        this.target.rx = clamp(this.pointerStart.rx + (event.clientY - this.pointerStart.y) * 0.006, -1.4, 1.4)
        this.globe.rotation.x = this.target.rx
        return
      }
      const id = this.pick(event)
      canvas.style.cursor = id ? 'pointer' : 'grab'
      this.options.onHover(id, event.clientX, event.clientY)
    })
    canvas.addEventListener('pointerup', (event) => {
      this.dragging = false
      const moved = Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y)
      if (moved < 4) this.options.onSelect(this.pick(event))
    })
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault()
      this.zoom(event.deltaY * 0.002)
    }, { passive: false })
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
