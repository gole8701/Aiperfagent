---
title: File flow diagram
group: Explore
summary: Your project from the root folder to any depth, left to right, with problem counts on every branch.
order: 7
tryIt: /flow
---

## What it is

The flow diagram draws your project as a tree from left to right: root → folders → files → components → functions → elements.

Each node shows a short type tag (DIR, TSX, TS, `<>` for a component, `fn` for a function, EL for an element) and a count of problems inside it. Paths that lead to a critical problem are drawn in red, warnings in amber. Nodes expand and collapse; a search box jumps to any name.

## Why it matters

The globe shows where problems cluster; the flow diagram shows the structure around them. You can follow `App.tsx` → `Header` → `ChatWidget` and see exactly which import pulls 81 KB into the first load.

## Use case

- Finding where a problem lives in a large codebase you do not know.
- Checking which files import a heavy library.
- Walking a teammate through the structure of a feature.

## How it helps your app

Every node is a link to the exact line. Clicking a component opens it in your editor; clicking a problem badge opens the deep dive. The **Problems only** toggle hides everything healthy, which turns a 10,000-node project into the dozen branches that matter.

## How to do it in PerfAgent, step by step

1. **Flow:** open **Flow diagram** from the menu, or `/flow`.
2. **Flow:** the root is on the left. Click a folder to expand it; the breadcrumb at the top shows where you are.
3. **Flow:** switch on **Problems only** to keep just the red and amber paths.
4. **Flow:** type a file or component name in the search box to jump to it.
5. **Editor:** click a file, component or function node to open that line in your editor; click a problem count to open the deep dive.

## Expert detail

- Data comes from `GET /api/tree`, the `TreeNode` tree in the report. `counts` on a node are the totals for the node and everything inside it, so a folder's badge is the sum of its children.
- Node kinds: `root`, `dir`, `file`, `component`, `function`, `element`. File nodes also carry `imports` (relative paths), which the diagram uses to draw dependency edges on request.
- Rendering uses React Flow with elkjs for the layered layout. The budget is 10,000 nodes interactive with expand under 100 ms, achieved by virtualising: only expanded, on-screen nodes are mounted.
- Deep link: `/flow/src/components/Header.tsx` opens with that node selected and its ancestors expanded.
- The tree is only present for local project scans (`report.tree`); a URL scan has none, and the screen says so with a link to **Scan your project**.
- Reduced motion disables the expand animation; the whole diagram is keyboard navigable (arrow keys move, Enter expands, `o` opens in editor).

## Learn more

- [React Flow](https://reactflow.dev/learn)
- [Eclipse Layout Kernel (elkjs)](https://github.com/kieler/elkjs)
- [MDN: Keyboard-navigable JavaScript widgets](https://developer.mozilla.org/docs/Web/Accessibility/Keyboard-navigable_JavaScript_widgets)
