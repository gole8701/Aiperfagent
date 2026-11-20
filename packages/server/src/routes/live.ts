import { launchBrowser, startLiveSession } from '@perfagent/collectors'
import { PerfAgentError, shortId } from '@perfagent/core'
import { assertUrlAllowed } from '@perfagent/security'

import type { AppContext } from '../app.js'
import type { Router } from '../router.js'

/** Live mode B: a browser we control streams CDP data over the WebSocket hub. */
export function liveRoutes(router: Router, ctx: AppContext): void {
  router.post('/api/live/start', async ({ json }) => {
    if (ctx.staticBuild)
      throw new PerfAgentError('NOT_LOCAL_MODE', 'Live mode needs the installed tool')
    const { url } = await json<{ url: string }>()
    await assertUrlAllowed(url, { allowLoopback: ctx.mode.mode === 'local' })
    if (ctx.live.session) await ctx.live.session.stop().catch(() => undefined)
    const browser = await launchBrowser(ctx.config.browser)
    const session = await startLiveSession(browser, url, {
      windowSeconds: ctx.config.live.windowSeconds,
      peakThresholdP95Ms: ctx.config.live.peakThresholdP95Ms,
      onTick: (tick) => ctx.hub.broadcast({ type: 'live:tick', tick }),
    })
    ctx.live = {
      session: {
        stop: async () => {
          const stats = await session.stop()
          await browser.close().catch(() => undefined)
          return stats
        },
      },
      url,
    }
    return { started: true, url }
  })

  router.post('/api/live/stop', async () => {
    const session = ctx.live.session
    if (!session) return { stopped: false }
    const stats = await session.stop()
    ctx.live = {}
    // Save the recording as a report so it can be compared later.
    const latest = await ctx.store.latest()
    const report = {
      ...(latest ?? emptyLiveReport()),
      id: shortId('live'),
      createdAt: new Date().toISOString(),
      label: `Live session ${new Date().toLocaleTimeString()}`,
      live: stats,
    }
    await ctx.store.save(report)
    ctx.hub.broadcast({ type: 'live:stopped', reportId: report.id })
    return { stopped: true, reportId: report.id, stats }
  })

  router.get('/api/live/status', () => ({ running: Boolean(ctx.live.session), url: ctx.live.url }))
}

function emptyLiveReport(): import('@perfagent/core').Report {
  return {
    schemaVersion: 1,
    tool: { name: 'perfagent', version: 'live' },
    id: '',
    createdAt: '',
    environment: { name: 'live', device: 'desktop', browser: 'chromium', mode: 'local' },
    pages: [],
    issues: [],
  }
}
