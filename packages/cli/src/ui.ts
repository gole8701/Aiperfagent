/** Terminal output helpers. Colours only when stdout is a TTY. */
const tty = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code: number) => (text: string): string => (tty ? `\u001b[${code}m${text}\u001b[0m` : text)

export const color = {
  bold: paint(1),
  dim: paint(2),
  green: paint(32),
  yellow: paint(33),
  red: paint(31),
  cyan: paint(36),
  magenta: paint(35),
}

export function print(line = ''): void {
  process.stdout.write(`${line}\n`)
}

export function printError(message: string, hint?: string): void {
  process.stderr.write(`${color.red('✖')} ${message}\n`)
  if (hint) process.stderr.write(`  ${color.dim(hint)}\n`)
}

export function banner(version: string): void {
  print(`${color.bold(color.magenta('PerfAgent'))} ${color.dim(`v${version}`)}  ${color.dim('finds, explains and fixes performance problems')}`)
}

/** Single-line progress that overwrites itself on a TTY. */
export function progressLine(message: string, fraction: number): void {
  const width = 24
  const filled = Math.round(fraction * width)
  const bar = `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`
  const line = `  ${color.cyan(bar)} ${Math.round(fraction * 100).toString().padStart(3)}%  ${message}`
  if (tty) process.stdout.write(`\r\u001b[2K${line}`)
  else process.stdout.write(`${line}\n`)
}

export function endProgress(): void {
  if (tty) process.stdout.write('\n')
}
