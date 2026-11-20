/**
 * Script injected before any page code runs. It records the signals the
 * browser exposes through PerformanceObserver and leaves them on
 * `window.__perfagent` for the collector to read after load.
 * Plain JS in a string so it works in every engine and needs no build step.
 */
export const INJECTED_SCRIPT = `(() => {
  const state = { lcp: 0, lcpElement: '', cls: 0, shifts: [], fcp: 0, longTasks: [], loaf: [], interactions: [], marks: [], softNav: 0 }
  window.__perfagent = state
  const describe = (el) => {
    if (!el || !el.tagName) return ''
    const id = el.id ? '#' + el.id : ''
    const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''
    return el.tagName.toLowerCase() + id + cls
  }
  const observe = (type, cb, extra) => {
    try { new PerformanceObserver((list) => list.getEntries().forEach(cb)).observe(Object.assign({ type, buffered: true }, extra || {})) } catch {}
  }
  observe('largest-contentful-paint', (e) => { state.lcp = e.startTime; state.lcpElement = describe(e.element) })
  observe('layout-shift', (e) => {
    if (e.hadRecentInput) return
    state.cls += e.value
    const src = e.sources && e.sources[0] && e.sources[0].node
    state.shifts.push({ value: e.value, timeMs: e.startTime, element: describe(src) })
  })
  observe('paint', (e) => { if (e.name === 'first-contentful-paint') state.fcp = e.startTime })
  observe('longtask', (e) => {
    const attr = e.attribution && e.attribution[0]
    state.longTasks.push({ startMs: e.startTime, durationMs: e.duration, script: attr ? (attr.containerSrc || attr.containerName || attr.name) : undefined })
  })
  observe('long-animation-frame', (e) => {
    const worst = (e.scripts || []).sort((a, b) => b.duration - a.duration)[0]
    state.loaf.push({ startMs: e.startTime, durationMs: e.duration, blockingMs: e.blockingDuration, script: worst ? worst.sourceURL : undefined, fn: worst ? worst.sourceFunctionName : undefined, line: worst ? worst.sourceCharPosition : undefined })
  })
  observe('event', (e) => { if (e.interactionId) state.interactions.push({ name: e.name, durationMs: e.duration, target: describe(e.target), at: e.startTime }) }, { durationThreshold: 16 })
  observe('mark', (e) => state.marks.push({ name: e.name, at: e.startTime }))
  observe('soft-navigation', () => { state.softNav++ })
  state.features = {
    loaf: 'PerformanceLongAnimationFrameTiming' in window,
    softNavigations: PerformanceObserver.supportedEntryTypes.includes('soft-navigation'),
    schedulerYield: !!(window.scheduler && window.scheduler.yield),
    speculationRules: HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules'),
    viewTransitions: 'startViewTransition' in document,
    computePressure: 'PressureObserver' in window,
    webGPU: 'gpu' in navigator,
    builtInAI: 'LanguageModel' in window || (!!window.ai),
    serviceWorker: 'serviceWorker' in navigator,
    bfcacheEligible: !window.opener,
  }
})()`

export interface InjectedState {
  lcp: number
  lcpElement: string
  cls: number
  shifts: { value: number; timeMs: number; element?: string }[]
  fcp: number
  longTasks: { startMs: number; durationMs: number; script?: string }[]
  loaf: {
    startMs: number
    durationMs: number
    blockingMs: number
    script?: string
    fn?: string
    line?: number
  }[]
  interactions: { name: string; durationMs: number; target: string; at: number }[]
  marks: { name: string; at: number }[]
  softNav: number
  features: Record<string, boolean>
}
