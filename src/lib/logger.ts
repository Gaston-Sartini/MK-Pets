/**
 * Structured logger — outputs JSON in production (Netlify log drain),
 * pretty-prints in development.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level:     Level
  msg:       string
  service:   string
  timestamp: string
  [key: string]: unknown
}

const IS_PROD = process.env.NODE_ENV === 'production'

function log(level: Level, msg: string, ctx: Record<string, unknown> = {}) {
  const entry: LogEntry = {
    level,
    msg,
    service:   'mkpets',
    timestamp: new Date().toISOString(),
    ...ctx,
  }

  if (IS_PROD) {
    // JSON for log drains (Netlify → Datadog, Logtail, etc.)
    const fn = level === 'error' ? console.error : console.log
    fn(JSON.stringify(entry))
  } else {
    const colors: Record<Level, string> = {
      debug: '\x1b[37m',
      info:  '\x1b[36m',
      warn:  '\x1b[33m',
      error: '\x1b[31m',
    }
    const reset = '\x1b[0m'
    const prefix = `${colors[level]}[${level.toUpperCase()}]${reset}`
    console.log(`${prefix} ${msg}`, Object.keys(ctx).length ? ctx : '')
  }
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
  info:  (msg: string, ctx?: Record<string, unknown>) => log('info',  msg, ctx),
  warn:  (msg: string, ctx?: Record<string, unknown>) => log('warn',  msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
}
