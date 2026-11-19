import { z } from 'zod'

import { configSchema } from './schema.js'

export interface OptionDoc {
  path: string
  type: string
  default: unknown
  description: string
  choices?: string[]
}

/** Flattens the schema into rows for the Settings UI and the docs page. */
export function describeConfig(): OptionDoc[] {
  const rows: OptionDoc[] = []
  walk(configSchema, '', rows)
  return rows
}

function unwrap(schema: z.ZodTypeAny): { inner: z.ZodTypeAny; defaultValue: unknown; description?: string } {
  let inner = schema
  let defaultValue: unknown
  let description = schema.description
  for (;;) {
    description ??= inner.description
    if (inner instanceof z.ZodDefault) {
      defaultValue = (inner._def as { defaultValue: () => unknown }).defaultValue()
      inner = (inner._def as { innerType: z.ZodTypeAny }).innerType
    } else if (inner instanceof z.ZodOptional) {
      inner = (inner._def as { innerType: z.ZodTypeAny }).innerType
    } else break
  }
  return { inner, defaultValue, description }
}

function walk(schema: z.ZodTypeAny, prefix: string, rows: OptionDoc[]): void {
  const { inner, defaultValue, description } = unwrap(schema)
  if (inner instanceof z.ZodObject) {
    const shape = inner.shape as Record<string, z.ZodTypeAny>
    for (const [key, child] of Object.entries(shape)) walk(child, prefix ? `${prefix}.${key}` : key, rows)
    return
  }
  const row: OptionDoc = { path: prefix, type: typeName(inner), default: defaultValue, description: description ?? '' }
  if (inner instanceof z.ZodEnum) row.choices = inner.options as string[]
  rows.push(row)
}

function typeName(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodString) return 'string'
  if (schema instanceof z.ZodNumber) return 'number'
  if (schema instanceof z.ZodBoolean) return 'boolean'
  if (schema instanceof z.ZodArray) return 'list'
  if (schema instanceof z.ZodEnum) return 'choice'
  if (schema instanceof z.ZodRecord) return 'map'
  if (schema instanceof z.ZodUnion) return 'choice or list'
  return 'value'
}
