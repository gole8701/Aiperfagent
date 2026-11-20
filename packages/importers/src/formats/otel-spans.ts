/** Reads OTLP/JSON `resourceSpans` and the JS SDK ConsoleSpanExporter array into one span shape. */
export interface Span {
  name: string
  kind: 'server' | 'client' | 'internal' | 'producer' | 'consumer'
  startMs: number
  durationMs: number
  attrs: Record<string, string | number | boolean>
  events: { name: string; timeMs: number }[]
  error?: string
}

type Attr = string | number | boolean

interface OtlpValue {
  stringValue?: string
  intValue?: string | number
  doubleValue?: number
  boolValue?: boolean
}
interface OtlpKeyValue {
  key?: string
  value?: OtlpValue
}
interface OtlpSpan {
  name?: string
  kind?: number | string
  startTimeUnixNano?: string | number
  endTimeUnixNano?: string | number
  attributes?: OtlpKeyValue[]
  events?: { name?: string; timeUnixNano?: string | number }[]
  status?: { code?: number | string; message?: string }
}
interface ConsoleSpan {
  name?: string
  kind?: number | string
  timestamp?: number
  duration?: number | [number, number]
  startTime?: [number, number]
  attributes?: Record<string, unknown>
  events?: { name?: string; time?: [number, number] }[]
  status?: { code?: number | string; message?: string }
}

const KINDS: Record<string, Span['kind']> = {
  0: 'internal',
  1: 'internal',
  2: 'server',
  3: 'client',
  4: 'producer',
  5: 'consumer',
  SPAN_KIND_SERVER: 'server',
  SPAN_KIND_CLIENT: 'client',
  SPAN_KIND_INTERNAL: 'internal',
  SPAN_KIND_PRODUCER: 'producer',
  SPAN_KIND_CONSUMER: 'consumer',
}

/** OTLP attribute lists are `[{key, value: {stringValue}}]`; the console exporter uses plain objects. */
export function readAttributes(raw: unknown): Record<string, Attr> {
  const out: Record<string, Attr> = {}
  if (Array.isArray(raw)) {
    for (const kv of raw as OtlpKeyValue[]) {
      if (!kv.key) continue
      const v = kv.value ?? {}
      const value =
        v.stringValue ??
        v.doubleValue ??
        v.boolValue ??
        (v.intValue !== undefined ? Number(v.intValue) : undefined)
      if (value !== undefined) out[kv.key] = value
    }
  } else if (typeof raw === 'object' && raw !== null) {
    for (const [k, v] of Object.entries(raw))
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v
  }
  return out
}

const nanoToMs = (nano: string | number | undefined): number => Number(nano ?? 0) / 1e6
const hrToMs = (hr: [number, number] | undefined): number => (hr ? hr[0] * 1000 + hr[1] / 1e6 : 0)

function errorOf(
  status: { code?: number | string; message?: string } | undefined,
): string | undefined {
  if (!status) return undefined
  return status.code === 2 || status.code === 'STATUS_CODE_ERROR' || status.code === 'ERROR'
    ? status.message?.trim()
      ? status.message
      : 'error'
    : undefined
}

function fromOtlp(s: OtlpSpan): Span {
  const startMs = nanoToMs(s.startTimeUnixNano)
  return {
    name: s.name ?? '',
    kind: KINDS[String(s.kind ?? 0)] ?? 'internal',
    startMs,
    durationMs: Math.max(0, nanoToMs(s.endTimeUnixNano) - startMs),
    attrs: readAttributes(s.attributes),
    events: (s.events ?? []).map((e) => ({ name: e.name ?? '', timeMs: nanoToMs(e.timeUnixNano) })),
    error: errorOf(s.status),
  }
}

function fromConsole(s: ConsoleSpan): Span {
  const startMs = s.timestamp !== undefined ? s.timestamp / 1000 : hrToMs(s.startTime)
  const durationMs = Array.isArray(s.duration) ? hrToMs(s.duration) : (s.duration ?? 0) / 1000
  return {
    name: s.name ?? '',
    kind: KINDS[String(s.kind ?? 0)] ?? 'internal',
    startMs,
    durationMs: Math.max(0, durationMs),
    attrs: readAttributes(s.attributes),
    events: (s.events ?? []).map((e) => ({ name: e.name ?? '', timeMs: hrToMs(e.time) })),
    error: errorOf(s.status),
  }
}

export function normaliseSpans(json: unknown): Span[] {
  if (Array.isArray(json))
    return (json as ConsoleSpan[]).filter((s) => typeof s === 'object').map(fromConsole)
  const resourceSpans = (
    json as { resourceSpans?: { scopeSpans?: { spans?: OtlpSpan[] }[] }[] } | null
  )?.resourceSpans
  if (!Array.isArray(resourceSpans)) return []
  return resourceSpans.flatMap((r) =>
    (r.scopeSpans ?? []).flatMap((sc) => (sc.spans ?? []).map(fromOtlp)),
  )
}
