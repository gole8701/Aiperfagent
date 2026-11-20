# Screenshots

The README references these images. They are not committed until captured from the real dashboard; do not draw or fabricate them.

| File              | Screen                               | Route                                    | State                                      |
| ----------------- | ------------------------------------ | ---------------------------------------- | ------------------------------------------ |
| `globe.png`       | 3D globe with chips and corner cards | `/`                                      | demo-shop scan loaded, `LCP` chip selected |
| `deep-dive.png`   | Deep dive panel                      | `/issues/<id of general/lcp-image-lazy>` | chain, before/after fix and gain visible   |
| `flow.png`        | File flow diagram                    | `/flow/src/components`                   | Problems only on                           |
| `charts.png`      | Charts view, Overview tab            | `/charts/overview`                       | "In simple words" card at the top          |
| `compare.png`     | Compare                              | `/compare/<before>/<after>`              | verdict and metric bars                    |
| `guide.png`       | Guide with walkthrough               | `/guide/connect-mcp`                     | walkthrough playing, step 2                |
| `settings-ai.png` | AI connections                       | `/settings/ai`                           | Ollama configured, MCP config panel open   |

## How to capture

1. Build and start: `pnpm build && pnpm --filter @perfagent/web build`, then `pnpm demo` in one terminal and `node packages/cli/dist/bin.js --root fixtures/demo-shop --no-open` in another. Note the printed URL with its token.
2. Run a scan once from the dashboard (or `node packages/cli/dist/bin.js scan --root fixtures/demo-shop http://localhost:3000`).
3. Capture with Playwright at 1440×900, dark theme, reduced motion off:

```js
// docs/images/capture.mjs (not committed; adapt the token and ids)
import { chromium } from 'playwright-core'
const base = 'http://127.0.0.1:4545'
const token = process.env.PERFAGENT_TOKEN
const shots = [
  ['globe', '/?chip=metric:lcp'],
  ['charts', '/charts/overview'],
  ['flow', '/flow/src/components'],
  ['guide', '/guide/connect-mcp'],
  ['settings-ai', '/settings/ai'],
]
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
await page.goto(`${base}/?token=${token}`)
for (const [name, route] of shots) {
  await page.goto(`${base}${route}`)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `docs/images/${name}.png` })
}
await browser.close()
```

4. Optimise: `npx @squoosh/cli --oxipng auto docs/images/*.png` or any PNG optimiser; keep each file under 400 KB.
5. Check that no token is visible in the address bar of a screenshot (use the in-app routes after the first authenticated load; the token lives in the cookie).
