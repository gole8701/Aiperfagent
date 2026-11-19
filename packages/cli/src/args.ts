/** Tiny argument parser: `--key value`, `--key=value`, `--flag`, `--no-flag`, positionals. No dependency, fast cold start. */
export interface ParsedArgs {
  command: string
  positionals: string[]
  flags: Record<string, string | boolean>
}

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {}
  const positionals: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? ''
    if (!arg.startsWith('-')) {
      positionals.push(arg)
      continue
    }
    const eq = arg.indexOf('=')
    const name = (eq >= 0 ? arg.slice(0, eq) : arg).replace(/^-+/, '')
    if (eq >= 0) flags[name] = arg.slice(eq + 1)
    else if (name.startsWith('no-')) flags[name.slice(3)] = false
    else {
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('-')) {
        flags[name] = next
        i++
      } else flags[name] = true
    }
  }
  const [command = 'start', ...rest] = positionals
  return { command, positionals: rest, flags }
}

export function flagString(flags: ParsedArgs['flags'], name: string): string | undefined {
  const value = flags[name]
  return typeof value === 'string' ? value : undefined
}

export function flagNumber(flags: ParsedArgs['flags'], name: string): number | undefined {
  const value = flagString(flags, name)
  return value === undefined || Number.isNaN(Number(value)) ? undefined : Number(value)
}

export function flagList(flags: ParsedArgs['flags'], name: string): string[] | undefined {
  const value = flagString(flags, name)
  return value ? value.split(',').map((s) => s.trim()).filter(Boolean) : undefined
}
