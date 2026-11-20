import type { TreeNode } from '@perfagent/core'

/** Deterministic synthetic project tree with roughly `fileCount` files for performance tests. */
export function generateTree(fileCount: number, filesPerDir = 20): TreeNode {
  let counter = 0
  const node = (
    kind: TreeNode['kind'],
    name: string,
    path: string,
    children: TreeNode[] = [],
  ): TreeNode => ({
    id: `n${counter++}`,
    name,
    kind,
    path,
    tag: kind === 'dir' ? 'DIR' : kind === 'file' ? 'TSX' : kind === 'component' ? '<>' : 'ROOT',
    issueIds: [],
    counts: { critical: 0, warning: 0, info: 0 },
    children,
  })
  const dirs: TreeNode[] = []
  const dirCount = Math.ceil(fileCount / filesPerDir)
  for (let d = 0; d < dirCount; d++) {
    const files: TreeNode[] = []
    for (let f = 0; f < filesPerDir && d * filesPerDir + f < fileCount; f++) {
      const path = `src/dir${d}/File${f}.tsx`
      const file = node('file', `File${f}.tsx`, path, [node('component', `File${f}`, path)])
      if (f === 0) {
        file.counts = { critical: d % 2 === 0 ? 1 : 0, warning: d % 2 === 1 ? 1 : 0, info: 0 }
        file.issueIds = [`issue-${d}`]
      }
      files.push(file)
    }
    const dir = node('dir', `dir${d}`, `src/dir${d}`, files)
    dir.counts = files.reduce(
      (acc, f) => ({
        critical: acc.critical + f.counts.critical,
        warning: acc.warning + f.counts.warning,
        info: 0,
      }),
      { critical: 0, warning: 0, info: 0 },
    )
    dirs.push(dir)
  }
  const src = node('dir', 'src', 'src', dirs)
  return node('root', 'project', '', [src])
}
