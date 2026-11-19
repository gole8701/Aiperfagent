import ts from 'typescript'

import type { ComponentInfo, ElementInfo, FunctionInfo, HookCall, ImportInfo, SourceFile } from './types.js'

const HOOK_RE = /^use[A-Z]/
const COMPONENT_RE = /^[A-Z][A-Za-z0-9]*$/

export function parseSource(relativePath: string, text: string): SourceFile {
  const kind = relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : relativePath.endsWith('.jsx') ? ts.ScriptKind.JSX : relativePath.endsWith('.js') || relativePath.endsWith('.mjs') ? ts.ScriptKind.JS : ts.ScriptKind.TS
  const sf = ts.createSourceFile(relativePath, text, ts.ScriptTarget.Latest, true, kind)
  const file: SourceFile = { path: relativePath, text, sizeBytes: Buffer.byteLength(text), imports: [], components: [], functions: [], hasJsx: false }
  const line = (node: ts.Node): number => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
  const endLine = (node: ts.Node): number => sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1

  const visitTop = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) file.imports.push(readImport(node, line(node)))
    else if (ts.isFunctionDeclaration(node) && node.name) readFunction(node, node.name.text, node.body)
    else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
        const init = unwrapMemo(decl.initializer)
        if (ts.isArrowFunction(init.fn) || ts.isFunctionExpression(init.fn)) readFunction(init.fn, decl.name.text, init.fn.body, init.memoized, decl)
      }
    } else if (ts.isExportAssignment(node) && (ts.isArrowFunction(node.expression) || ts.isFunctionExpression(node.expression))) {
      readFunction(node.expression, 'default', node.expression.body)
    }
    ts.forEachChild(node, (child) => {
      if (ts.isCallExpression(child) && isDynamicImport(child)) {
        const arg = child.arguments[0]
        if (arg && ts.isStringLiteral(arg)) file.imports.push({ source: arg.text, namespace: false, named: [], line: line(child), dynamic: true })
      }
    })
  }

  function readFunction(fn: ts.SignatureDeclaration, name: string, body: ts.Node | undefined, memoized = false, anchor: ts.Node = fn): void {
    if (!body) return
    const info: FunctionInfo = { name, line: line(anchor), endLine: endLine(fn), async: hasAsync(fn), awaits: [], calls: [] }
    const elements: ElementInfo[] = []
    const hooks: HookCall[] = []
    const conditional = new Set<string>()
    let depth = 0
    const walk = (node: ts.Node, inLoop: boolean, inConditional: boolean): void => {
      if (ts.isAwaitExpression(node) && ts.isCallExpression(node.expression)) info.awaits.push({ callee: calleeName(node.expression), line: line(node), inLoop })
      if (ts.isCallExpression(node)) {
        const callee = calleeName(node)
        info.calls.push({ callee, line: line(node), argsText: node.arguments.map((a) => a.getText(sf)).join(', ').slice(0, 300) })
        if (HOOK_RE.test(callee) && depth === 0) hooks.push(readHook(node, callee))
      }
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        file.hasJsx = true
        const tag = node.tagName.getText(sf)
        elements.push({ tag, line: line(node), attributes: readAttributes(node.attributes, sf) })
        if (inConditional && COMPONENT_RE.test(tag)) conditional.add(tag)
      }
      const loop = inLoop || ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node) || isArrayIterationCallback(node)
      const cond = inConditional || (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) || ts.isConditionalExpression(node)
      const nested = ts.isFunctionLike(node) && node !== fn
      if (nested) depth++
      ts.forEachChild(node, (child) => { walk(child, loop, cond) })
      if (nested) depth--
    }
    walk(body, false, false)
    file.functions.push(info)
    if (COMPONENT_RE.test(name) && (elements.length > 0 || hooks.length > 0)) {
      const component: ComponentInfo = { name, line: info.line, endLine: info.endLine, memoized, hooks, elements, conditionalChildren: [...conditional] }
      file.components.push(component)
    }
  }

  function readHook(node: ts.CallExpression, name: string): HookCall {
    const calls: string[] = []
    let hasCleanup = false
    const cb = node.arguments[0]
    if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) {
      const body = cb.body
      if (ts.isBlock(body)) hasCleanup = body.statements.some((s) => ts.isReturnStatement(s) && s.expression !== undefined)
      else hasCleanup = ts.isArrowFunction(body) || ts.isFunctionExpression(body)
      const walk = (n: ts.Node): void => {
        if (ts.isCallExpression(n)) calls.push(calleeName(n))
        if (ts.isNewExpression(n)) calls.push(`new ${n.expression.getText(sf)}`)
        ts.forEachChild(n, walk)
      }
      walk(body)
    }
    return { name, line: line(node), hasCleanup, calls }
  }

  ts.forEachChild(sf, visitTop)
  return file
}

function readImport(node: ts.ImportDeclaration, line: number): ImportInfo {
  const source = (node.moduleSpecifier as ts.StringLiteral).text
  const info: ImportInfo = { source, namespace: false, named: [], line, dynamic: false }
  const clause = node.importClause
  if (clause?.name) info.defaultImport = clause.name.text
  if (clause?.namedBindings) {
    if (ts.isNamespaceImport(clause.namedBindings)) info.namespace = true
    else info.named = clause.namedBindings.elements.map((e) => e.name.text)
  }
  return info
}

function readAttributes(attrs: ts.JsxAttributes, sf: ts.SourceFile): Record<string, string | true> {
  const out: Record<string, string | true> = {}
  for (const attr of attrs.properties) {
    if (!ts.isJsxAttribute(attr)) continue
    const name = attr.name.getText(sf)
    if (!attr.initializer) out[name] = true
    else if (ts.isStringLiteral(attr.initializer)) out[name] = attr.initializer.text
    else out[name] = attr.initializer.getText(sf).slice(0, 200)
  }
  return out
}

function unwrapMemo(expr: ts.Expression): { fn: ts.Expression; memoized: boolean } {
  if (ts.isCallExpression(expr)) {
    const callee = calleeName(expr)
    const first = expr.arguments[0]
    if ((callee === 'memo' || callee === 'React.memo' || callee === 'forwardRef') && first) return { fn: unwrapMemo(first).fn, memoized: callee !== 'forwardRef' }
  }
  return { fn: expr, memoized: false }
}

function calleeName(call: ts.CallExpression): string {
  const e = call.expression
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e)) return e.getText()
  return e.getText().slice(0, 60)
}

function hasAsync(fn: ts.SignatureDeclaration): boolean {
  return (ts.canHaveModifiers(fn) ? ts.getModifiers(fn) : undefined)?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false
}

function isDynamicImport(call: ts.CallExpression): boolean {
  return call.expression.kind === ts.SyntaxKind.ImportKeyword
}

function isArrayIterationCallback(node: ts.Node): boolean {
  return ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ['map', 'forEach', 'reduce', 'filter'].includes(node.expression.name.text)
}
