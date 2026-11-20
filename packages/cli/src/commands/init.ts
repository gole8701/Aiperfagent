import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { CONFIG_TEMPLATE, findConfigFile } from '@perfagent/config'

import { flagString, type ParsedArgs } from '../args.js'
import { color, print } from '../ui.js'

/** `perfagent init`: writes perfagent.config.ts and git-ignores the local data folder. */
export async function init(args: ParsedArgs): Promise<void> {
  const cwd = flagString(args.flags, 'root') ?? process.cwd()
  const existing = await findConfigFile(cwd)
  if (existing && args.flags.force !== true) {
    print(
      `  ${color.yellow('Config already exists:')} ${existing}  ${color.dim('(use --force to overwrite)')}`,
    )
  } else {
    // Node 23+ loads .ts config natively; older versions get the same file as ESM JavaScript.
    const nativeTs = Number(process.versions.node.split('.')[0]) >= 23
    const file = path.join(cwd, nativeTs ? 'perfagent.config.ts' : 'perfagent.config.mjs')
    await writeFile(file, CONFIG_TEMPLATE, 'utf8')
    print(`  ${color.green('✔')} Created ${file}`)
  }
  const ignore = path.join(cwd, '.gitignore')
  const current = await readFile(ignore, 'utf8').catch(() => '')
  if (!current.split('\n').some((l) => l.trim() === '.perfagent/' || l.trim() === '.perfagent')) {
    await writeFile(
      ignore,
      `${current.endsWith('\n') || current === '' ? current : `${current}\n`}# PerfAgent local data (scans, settings)\n.perfagent/\n`,
      'utf8',
    )
    print(`  ${color.green('✔')} Added .perfagent/ to .gitignore`)
  }
  const hasGit = await access(path.join(cwd, '.git'))
    .then(() => true)
    .catch(() => false)
  if (!hasGit)
    print(
      `  ${color.yellow('!')} This folder is not a git repository. AI fixes need git (they go to a new branch). Run "git init" first.`,
    )
  if (args.command !== 'init') return
  print()
  print(
    `  Next: ${color.cyan('npx perfagent')} to open the dashboard, or ${color.cyan('npx perfagent scan http://localhost:3000')}.`,
  )
}
