// PerfAgent's own performance budgets (build rules, section 7). Exit 1 when any budget is broken.
//   1. CLI cold start:  node packages/cli/dist/bin.js --help, median of 5 runs, budget 300 ms
//   2. Dashboard initial JS: gzip size of the entry chunk + its static imports (packages/web/dist), budget 250 KB
//   3. Optional (PERFAGENT_BUDGET_SERVER=1): dashboard ready time on a temp project, budget 1500 ms
// A missing web build is skipped with a warning because the dashboard may not be built yet.
import { execFile } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { gzipSync } from 'node:zlib'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUDGETS = { cliStartMs: 300, dashboardJsKb: 250, dashboardReadyMs: 1500 }
const rows = []
let failed = false

function record(name, value, budget, unit, note = '') {
  const ok = value === undefined || value <= budget
  if (!ok) failed = true
  rows.push({
    check: name,
    value: value === undefined ? 'skipped' : `${Math.round(value)} ${unit}`,
    budget: `${budget} ${unit}`,
    status: value === undefined ? 'skip' : ok ? 'pass' : 'FAIL',
    note,
  })
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// 1. CLI cold start
const bin = path.join(root, 'packages/cli/dist/bin.js')
if (!existsSync(bin)) {
  record(
    'CLI cold start (--help)',
    undefined,
    BUDGETS.cliStartMs,
    'ms',
    'packages/cli/dist missing: run pnpm build',
  )
  failed = true
} else {
  const run = promisify(execFile)
  const times = []
  for (let i = 0; i < 5; i++) {
    const started = performance.now()
    const { stdout } = await run(process.execPath, [bin, '--help'], { cwd: root })
    times.push(performance.now() - started)
    if (!stdout.includes('perfagent')) {
      failed = true
      rows.push({
        check: 'CLI --help output',
        value: 'unexpected',
        budget: 'contains "perfagent"',
        status: 'FAIL',
        note: '',
      })
    }
  }
  record(
    'CLI cold start (--help, median of 5)',
    median(times),
    BUDGETS.cliStartMs,
    'ms',
    `runs: ${times.map((t) => Math.round(t)).join(', ')}`,
  )
}

// 2. Dashboard initial JS (gzip)
const webDist = path.join(root, 'packages/web/dist')
if (!existsSync(webDist)) {
  record(
    'Dashboard initial JS (gzip)',
    undefined,
    BUDGETS.dashboardJsKb,
    'KB',
    'packages/web/dist missing: skipped (web package not built yet)',
  )
} else {
  const gzipKb = (file) => gzipSync(readFileSync(file)).length / 1024
  const chunks = []
  const manifestPath = path.join(webDist, '.vite/manifest.json')
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const entries = Object.values(manifest).filter((m) => m.isEntry)
    const seen = new Set()
    const visit = (entry) => {
      if (!entry || seen.has(entry.file)) return
      seen.add(entry.file)
      chunks.push(entry.file)
      for (const imp of entry.imports ?? []) visit(manifest[imp])
    }
    for (const e of entries) visit(e)
  } else {
    // No manifest: take the largest JS file in assets as the entry.
    const assets = path.join(webDist, 'assets')
    const js = (existsSync(assets) ? readdirSync(assets) : [])
      .filter((f) => f.endsWith('.js'))
      .map((f) => path.join('assets', f))
    js.sort((a, b) => statSync(path.join(webDist, b)).size - statSync(path.join(webDist, a)).size)
    if (js[0]) chunks.push(js[0])
  }
  let total = 0
  for (const file of chunks) {
    const kb = gzipKb(path.join(webDist, file))
    total += kb
    rows.push({
      check: `  chunk ${file}`,
      value: `${kb.toFixed(1)} KB`,
      budget: '',
      status: '',
      note: '',
    })
  }
  record(
    'Dashboard initial JS (gzip, entry + static imports)',
    chunks.length ? total : undefined,
    BUDGETS.dashboardJsKb,
    'KB',
    chunks.length ? `${chunks.length} chunk(s)` : 'no JS chunks found',
  )
}

// 3. Dashboard ready time (optional, needs a built server + browser)
if (process.env.PERFAGENT_BUDGET_SERVER === '1' && existsSync(bin)) {
  const project = mkdtempSync(path.join(tmpdir(), 'perfagent-budget-'))
  // The CLI reads every PERFAGENT_* variable as a config option, so our own flag must not reach it.
  const { PERFAGENT_BUDGET_SERVER: _flag, ...env } = process.env
  const child = execFile(
    process.execPath,
    [bin, '--root', project, '--port', '4599', '--no-open'],
    { cwd: root, env },
  )
  let stderr = ''
  child.stderr.on('data', (d) => {
    stderr += String(d)
  })
  try {
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('server did not print a URL in 10 s')),
        10_000,
      )
      child.stdout.on('data', (d) => {
        const m = /(http:\/\/127\.0\.0\.1:\d+\/\?token=\S+)/.exec(String(d))
        if (m) {
          clearTimeout(timer)
          resolve(m[1])
        }
      })
      child.on('exit', (code) =>
        reject(new Error(`server exited with ${code}: ${stderr.trim() || 'no output'}`)),
      )
    })
    const { launchBrowser } = await import('@perfagent/collectors')
    const browser = await launchBrowser('chromium')
    const page = await browser.newPage()
    const started = performance.now()
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15_000 })
    // Ready = the dashboard root (or the placeholder when not built) has rendered.
    await page.waitForSelector('#root > *, body > p', { timeout: 15_000 })
    record(
      'Dashboard ready after server start',
      performance.now() - started,
      BUDGETS.dashboardReadyMs,
      'ms',
      existsSync(webDist) ? '' : 'placeholder page (web not built)',
    )
    await browser.close()
  } catch (error) {
    failed = true
    rows.push({
      check: 'Dashboard ready after server start',
      value: 'error',
      budget: `${BUDGETS.dashboardReadyMs} ms`,
      status: 'FAIL',
      note: error.message,
    })
  } finally {
    child.kill('SIGTERM')
    rmSync(project, { recursive: true, force: true })
  }
} else {
  record(
    'Dashboard ready after server start',
    undefined,
    BUDGETS.dashboardReadyMs,
    'ms',
    'set PERFAGENT_BUDGET_SERVER=1 to run',
  )
}

// Table
const cols = ['check', 'value', 'budget', 'status', 'note']
const width = Object.fromEntries(
  cols.map((c) => [c, Math.max(c.length, ...rows.map((r) => String(r[c]).length))]),
)
const line = (r) => cols.map((c) => String(r[c]).padEnd(width[c])).join('  ')
console.log(line(Object.fromEntries(cols.map((c) => [c, c.toUpperCase()]))))
console.log(cols.map((c) => '-'.repeat(width[c])).join('  '))
for (const r of rows) console.log(line(r))
console.log(failed ? '\nperf-budget: FAILED' : '\nperf-budget: all budgets within limits')
process.exit(failed ? 1 : 0)
