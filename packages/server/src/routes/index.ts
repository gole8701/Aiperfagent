import type { AppContext } from '../app.js'
import type { Router } from '../router.js'

import { aiRoutes } from './ai.js'
import { compareRoutes } from './compare.js'
import { fixRoutes } from './fix.js'
import { guideRoutes } from './guides.js'
import { importExportRoutes } from './import-export.js'
import { issueRoutes } from './issues.js'
import { liveRoutes } from './live.js'
import { localRoutes } from './local.js'
import { scanRoutes } from './scans.js'
import { settingsRoutes } from './settings.js'
import { statusRoutes } from './status.js'

/**
 * Read routes are always registered. Write routes (editor, fix) are only
 * registered in local mode, so a deployed build has no code path that writes.
 */
export function registerRoutes(router: Router, ctx: AppContext): void {
  statusRoutes(router, ctx)
  scanRoutes(router, ctx)
  issueRoutes(router, ctx)
  compareRoutes(router, ctx)
  importExportRoutes(router, ctx)
  settingsRoutes(router, ctx)
  guideRoutes(router, ctx)
  aiRoutes(router, ctx)
  liveRoutes(router, ctx)
  if (ctx.mode.mode === 'local' && !ctx.staticBuild) {
    localRoutes(router, ctx)
    fixRoutes(router, ctx)
  }
}
