// Measures one URL with the collectors package and prints the result. Dev helper, not shipped.
import { launchBrowser, measurePage } from '@perfagent/collectors'

const url = process.argv[2] ?? 'http://localhost:3000/'
const browser = await launchBrowser('chromium')
const started = Date.now()
const page = await measurePage(browser, { url, runs: 1, coverage: true, onProgress: (r, t) => console.error(`run ${r}/${t}`) })
await browser.close()
console.log(JSON.stringify({ took: Date.now() - started, metrics: page.metrics, phases: page.phases, lcpElement: page.lcpElement, requests: page.requests.length, longTasks: page.longTasks.length, shifts: page.layoutShifts.length, frames: page.filmstrip.length, features: page.features, coverage: page.coverage?.slice(0, 4) }, null, 2))
