export type ErrorCode =
  | 'CONFIG_INVALID'
  | 'PATH_OUTSIDE_ROOT'
  | 'ORIGIN_REJECTED'
  | 'UNAUTHORIZED'
  | 'NOT_LOCAL_MODE'
  | 'IMPORT_INVALID'
  | 'IMPORT_TOO_LARGE'
  | 'SCAN_FAILED'
  | 'BROWSER_MISSING'
  | 'AI_NOT_CONFIGURED'
  | 'AI_BUDGET_EXCEEDED'
  | 'AI_REQUEST_FAILED'
  | 'GIT_DIRTY'
  | 'GIT_FAILED'
  | 'FIX_REJECTED'
  | 'NOT_FOUND'

export class PerfAgentError extends Error {
  readonly code: ErrorCode
  /** Plain-language next step shown to the user. */
  readonly hint?: string

  constructor(code: ErrorCode, message: string, hint?: string) {
    super(message)
    this.name = 'PerfAgentError'
    this.code = code
    this.hint = hint
  }
}

export function isPerfAgentError(error: unknown): error is PerfAgentError {
  return error instanceof PerfAgentError
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : 'Unknown error'
}
