// Runs before `npm publish`: copies the built dashboard, the guides and the
// real-user agent script into the package so `npx perfagent` works alone.
import { cp, mkdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const pkg = path.resolve(here, '..')
const repo = path.resolve(pkg, '..', '..')

const copies = [
  { from: path.join(repo, 'packages', 'web', 'dist'), to: path.join(pkg, 'dashboard'), required: true },
  { from: path.join(repo, 'docs', 'guides'), to: path.join(pkg, 'guides'), required: true },
  { from: path.join(repo, 'packages', 'agent', 'dist', 'perfagent.js'), to: path.join(pkg, 'dashboard', 'perfagent.js'), required: false },
  { from: path.join(repo, 'README.md'), to: path.join(pkg, 'README.md'), required: false },
]

for (const { from, to, required } of copies) {
  const exists = await stat(from).then(() => true).catch(() => false)
  if (!exists) {
    if (required) {
      console.error(`prepack: missing ${from}. Build it first (pnpm build && pnpm --filter @perfagent/web build).`)
      process.exit(1)
    }
    continue
  }
  if ((await stat(from)).isDirectory()) await rm(to, { recursive: true, force: true })
  await mkdir(path.dirname(to), { recursive: true })
  await cp(from, to, { recursive: true })
}
