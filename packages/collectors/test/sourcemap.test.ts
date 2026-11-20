import { describe, expect, it } from 'vitest'

import { SourceMapper } from '../src/sourcemap.js'

// A real map produced by esbuild for: `export function CartSummary(){\n  const lines = useCart()\n  return lines.length\n}`
const bundled =
  'function C(){const l=useCart();return l.length}\n//# sourceMappingURL=chunk-8f3.js.map'
const map = {
  version: 3,
  sources: ['../../src/components/CartSummary.tsx'],
  names: ['CartSummary', 'lines', 'useCart'],
  mappings: 'AAAO,SAASA,IAAc,CACrB,MAAMC,EAAQC,EAAQ,EACtB,OAAOD,EAAM,MACjB',
}

const files = new Set(['src/components/CartSummary.tsx', 'src/App.tsx'])
const served: Record<string, string> = {
  'http://localhost:3000/assets/chunk-8f3.js': bundled,
  'http://localhost:3000/assets/chunk-8f3.js.map': JSON.stringify(map),
}
const mapper = new SourceMapper({
  projectFiles: files,
  fetch: (url) => Promise.resolve(served[url]),
})

describe('SourceMapper', () => {
  it('maps a dev-server module URL straight to the project file', async () => {
    const loc = await mapper.toSource({
      url: 'http://localhost:3000/src/App.tsx?t=1700000',
      line: 12,
      column: 3,
    })
    expect(loc).toMatchObject({ file: 'src/App.tsx', line: 12, column: 3 })
  })

  it('maps a bundled position through the .map file to the original file and line', async () => {
    const loc = await mapper.toSource({
      url: 'http://localhost:3000/assets/chunk-8f3.js',
      line: 1,
      column: 20,
    })
    expect(loc?.file).toBe('src/components/CartSummary.tsx')
    expect(loc?.line).toBe(2)
    expect(loc?.bundled).toEqual({
      file: 'http://localhost:3000/assets/chunk-8f3.js',
      line: 1,
      column: 20,
    })
  })

  it('turns a character offset (Long Animation Frames) into line and column first', async () => {
    const loc = await mapper.toSource({
      url: 'http://localhost:3000/assets/chunk-8f3.js',
      charOffset: 19,
    })
    expect(loc?.file).toBe('src/components/CartSummary.tsx')
  })

  it('gives up quietly when the map is missing or the file is not in the project', async () => {
    expect(
      await mapper.toSource({ url: 'http://cdn.example/vendor.js', line: 1, column: 1 }),
    ).toBeUndefined()
    expect(mapper.projectPath('webpack:///./node_modules/react/index.js')).toBeUndefined()
    expect(mapper.projectPath('webpack:///./src/App.tsx')).toBe('src/App.tsx')
  })
})
