---
title: Open in editor
group: Explore
summary: One click opens the exact file and line in VS Code, Cursor, Windsurf, Zed, Sublime, JetBrains, Vim, Neovim, Emacs or Notepad++.
order: 8
tryIt: /settings/display
---

## What it is

**Open in editor** jumps from a problem in the dashboard to the same line in the editor you already use.

It works from the deep dive, from every step of the root cause chain, and from every node in the flow diagram. The editor is chosen in `perfagent.config.ts` (`editor`) or in Settings; `auto` uses the system default or the `EDITOR` environment variable.

## Why it matters

Searching for a file by name, then scrolling to a line, breaks concentration. With the editor link the fix starts where the evidence ends.

## Use case

- Fixing a problem by hand.
- Reading the component around a suspicious line.
- Checking what an AI fix changed, in context.

## How it helps your app

Shorter time from "I see the problem" to "I am editing the cause". On the demo shop, `HeroBanner.tsx:5`, `CartSummary.tsx:7`, `socket.ts:11` and `rag.ts:28` each open in one click.

## How to do it in PerfAgent, step by step

1. **Settings:** open **Settings → Display** and pick your editor, or leave **Auto-detect**.
2. **Globe:** open a problem and press **Open in editor** next to the file:line.
3. **Editor:** the editor opens at that line and column.
4. **Globe:** if the command is not on your PATH, the dashboard shows a fallback link (`vscode://file/…`, `cursor://…`, `zed://…`, `jetbrains://…`) you can click instead, with a hint to install the editor's command-line tool.
5. **Flow:** the same button exists on every node of the flow diagram.

## Commands & config

```ts
export default defineConfig({
  editor: 'vscode', // 'auto' | 'vscode' | 'cursor' | 'windsurf' | 'zed' | 'sublime' | 'jetbrains' | 'vim' | 'neovim' | 'emacs' | 'notepad++'
})
```

```bash
# Auto mode uses the EDITOR variable when set
EDITOR=code npx perfagent
```

Install the command-line tool for your editor if the button says it was not found: VS Code _Shell Command: Install 'code' command in PATH_; Cursor _Install 'cursor' command_; JetBrains _Tools → Create Command-line Launcher_; Zed `zed`; Sublime `subl`.

## Expert detail

- Route: `POST /api/editor/open` with `{ file, line, column, editor }`. It exists only in local mode; a deployed or static build has no such route.
- Every path goes through `guardPath` (`packages/security/src/path-guard.ts`): the real path (symlinks resolved) must stay inside the project root, and `.env*`, key files, `.npmrc`, `.netrc`, `credentials.json`, `.git`, `node_modules` and `.perfagent` are refused with `403 PATH_OUTSIDE_ROOT`.
- Commands are run with `execFile` and a fixed argument array per editor (`packages/server/src/editor.ts`), never through a shell string, so a file name cannot inject a command. Examples: `code --goto file:line:col`, `zed file:line:col`, `webstorm --line N file`, `vim +N file`, `emacsclient +N:C file`, `notepad++ -nN -cC file`.
- `jetbrains` tries `webstorm`, `idea`, `phpstorm`, `pycharm` in that order; `emacs` tries `emacsclient` then `emacs`.
- `GET /api/editor/link?file=&line=` returns only the URL scheme, for the fallback link.

## Walkthrough

```walkthrough
[
  { "screen": "settings", "area": "editor-select", "title": "Choose your editor", "text": "Settings → Display → Editor. Auto-detect works for most setups." },
  { "screen": "globe", "area": "deep-dive", "title": "Open in editor", "text": "Press the button next to src/components/HeroBanner.tsx:5." },
  { "screen": "editor", "area": "editor-line", "title": "Exact line", "text": "The editor opens the file with the cursor on line 5." },
  { "screen": "globe", "area": "fallback-link", "title": "If the command is missing", "text": "A vscode:// or cursor:// link is offered, with a hint to install the CLI tool." }
]
```

## Learn more

- [VS Code: Command line interface](https://code.visualstudio.com/docs/editor/command-line)
- [JetBrains: Command-line interface](https://www.jetbrains.com/help/webstorm/working-with-the-ide-features-from-command-line.html)
- [Zed: Command line](https://zed.dev/docs/getting-started#command-line)
