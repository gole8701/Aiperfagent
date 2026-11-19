import { describe, expect, it } from 'vitest'

import { detectFramework, parseSource } from '../src/index.js'

describe('parseSource', () => {
  it('reads imports, components, hooks, elements and conditional children', () => {
    const file = parseSource(
      'src/Header.tsx',
      `import { useState, useEffect } from 'react'
import * as dateFns from 'date-fns'
import { ChatWidget } from './ChatWidget'
import { useCart } from '../context/CartContext'

export function Header() {
  const { lines } = useCart()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setOpen((o) => !o), 1000)
  }, [])
  return (
    <header className="header">
      <button onClick={() => setOpen(true)}>Help</button>
      <img src="/logo.png" alt="logo" />
      {open && <ChatWidget onClose={() => setOpen(false)} />}
    </header>
  )
}

export const Memoed = memo(function Memoed() {
  return <div />
})
`,
    )
    expect(file.hasJsx).toBe(true)
    expect(file.imports.map((i) => i.source)).toEqual(['react', 'date-fns', './ChatWidget', '../context/CartContext'])
    expect(file.imports[1]?.namespace).toBe(true)
    const header = file.components.find((c) => c.name === 'Header')
    expect(header?.hooks.map((h) => h.name)).toEqual(['useCart', 'useState', 'useEffect'])
    expect(header?.hooks.find((h) => h.name === 'useEffect')).toMatchObject({ hasCleanup: false })
    expect(header?.hooks.find((h) => h.name === 'useEffect')?.calls).toContain('setInterval')
    expect(header?.elements.map((e) => e.tag)).toEqual(['header', 'button', 'img', 'ChatWidget'])
    expect(header?.elements[2]?.attributes).toMatchObject({ src: '/logo.png', alt: 'logo' })
    expect(header?.conditionalChildren).toEqual(['ChatWidget'])
    expect(file.components.find((c) => c.name === 'Memoed')?.memoized).toBe(true)
  })

  it('records sequential awaits and loops in async functions', () => {
    const file = parseSource(
      'src/rag.ts',
      `export async function answer(q: string) {
  const v = await embed(q)
  const chunks = await search(v)
  for (const c of chunks) {
    await embed(c)
  }
  return chunks
}`,
    )
    const fn = file.functions[0]
    expect(fn?.async).toBe(true)
    expect(fn?.awaits.map((a) => `${a.callee}:${a.inLoop ? 'loop' : 'seq'}`)).toEqual(['embed:seq', 'search:seq', 'embed:loop'])
  })

  it('detects dynamic imports', () => {
    const file = parseSource('src/a.ts', "const Heavy = lazy(() => import('./Heavy'))")
    expect(file.imports).toEqual([expect.objectContaining({ source: './Heavy', dynamic: true })])
  })

  it('does not crash on syntax errors', () => {
    expect(() => parseSource('src/bad.ts', 'export function (')).not.toThrow()
  })
})

describe('detectFramework', () => {
  it('prefers the most specific framework', () => {
    expect(detectFramework({ next: '15', react: '19' })).toBe('next')
    expect(detectFramework({ react: '19' })).toBe('react')
    expect(detectFramework({ vue: '3' })).toBe('vue')
    expect(detectFramework({})).toBe('plain')
  })
})
