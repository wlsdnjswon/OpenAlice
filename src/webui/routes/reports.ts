import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { EngineContext } from '../../core/types.js'
import type { ReportType, ReportAssetClass } from '../../domain/reports/types.js'

const VALID_TYPES = new Set<ReportType>(['short', 'long'])
const VALID_ASSET_CLASSES = new Set<ReportAssetClass>(['equity', 'crypto', 'currency', 'commodity'])
const VALID_LANGUAGES = new Set(['ko', 'en'])

export function createReportsRoutes(ctx: EngineContext): Hono {
  const app = new Hono()

  /** POST /api/reports/generate — streams SSE progress, then done/error event */
  app.post('/generate', async (c) => {
    if (!ctx.reportService) {
      return c.json({ error: 'Report service not initialized' }, 503)
    }

    const body = await c.req.json() as {
      symbol?: string
      assetClass?: string
      type?: string
      language?: string
    }

    const symbol = body.symbol?.trim().toUpperCase()
    if (!symbol) return c.json({ error: 'symbol is required' }, 400)

    const assetClass = body.assetClass as ReportAssetClass
    if (!VALID_ASSET_CLASSES.has(assetClass)) {
      return c.json({ error: `Invalid assetClass. Valid: ${[...VALID_ASSET_CLASSES].join(', ')}` }, 400)
    }

    const type = body.type as ReportType
    if (!VALID_TYPES.has(type)) {
      return c.json({ error: `Invalid type. Valid: ${[...VALID_TYPES].join(', ')}` }, 400)
    }

    const language = VALID_LANGUAGES.has(body.language ?? '') ? body.language as 'ko' | 'en' : 'en'

    const service = ctx.reportService

    return streamSSE(c, async (stream) => {
      try {
        const report = await service.generate(symbol, assetClass, type, language, async (step, message) => {
          await stream.writeSSE({ data: JSON.stringify({ type: 'progress', step, message }) })
        })
        await stream.writeSSE({ data: JSON.stringify({ type: 'done', report: service.store.get(report.id) }) })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await stream.writeSSE({ data: JSON.stringify({ type: 'error', message }) })
      }
    })
  })

  /** GET /api/reports — list reports (query: symbol, type, assetClass, limit) */
  app.get('/', (c) => {
    if (!ctx.reportService) return c.json({ error: 'Report service not initialized' }, 503)
    const symbol = c.req.query('symbol') || undefined
    const type = c.req.query('type') as ReportType | undefined
    const assetClass = c.req.query('assetClass') as ReportAssetClass | undefined
    const limit = Number(c.req.query('limit')) || 50
    const reports = ctx.reportService.store.list({ symbol, type, assetClass, limit })
    return c.json({ reports, count: reports.length })
  })

  /** GET /api/reports/:id — full report detail */
  app.get('/:id', async (c) => {
    if (!ctx.reportService) return c.json({ error: 'Report service not initialized' }, 503)
    const { id } = c.req.param()
    const detail = await ctx.reportService.store.getDetail(id)
    if (!detail) return c.json({ error: 'Report not found' }, 404)
    return c.json(detail)
  })

  /** DELETE /api/reports/:id */
  app.delete('/:id', async (c) => {
    if (!ctx.reportService) return c.json({ error: 'Report service not initialized' }, 503)
    const { id } = c.req.param()
    const deleted = await ctx.reportService.store.delete(id)
    if (!deleted) return c.json({ error: 'Report not found' }, 404)
    return c.json({ success: true })
  })

  /**
   * POST /api/reports/generate-krx — KRX-enhanced analysis.
   * Injects Kiwoom institutional/foreign flow + theme data into the prompt.
   * Falls back to standard equity analysis when Kiwoom is not configured.
   */
  app.post('/generate-krx', async (c) => {
    if (!ctx.reportService) {
      return c.json({ error: 'Report service not initialized' }, 503)
    }

    const body = await c.req.json() as { symbol?: string; type?: string; language?: string }
    const symbol = body.symbol?.trim().toUpperCase()
    if (!symbol) return c.json({ error: 'symbol is required' }, 400)

    const type = body.type as 'short' | 'long'
    if (!VALID_TYPES.has(type)) {
      return c.json({ error: `Invalid type. Valid: ${[...VALID_TYPES].join(', ')}` }, 400)
    }

    const language = VALID_LANGUAGES.has(body.language ?? '') ? body.language as 'ko' | 'en' : 'ko'
    const service = ctx.reportService

    return streamSSE(c, async (stream) => {
      try {
        const report = await service.generateKrx(symbol, type, language, async (step, message) => {
          await stream.writeSSE({ data: JSON.stringify({ type: 'progress', step, message }) })
        })
        await stream.writeSSE({ data: JSON.stringify({ type: 'done', report: service.store.get(report.id) }) })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await stream.writeSSE({ data: JSON.stringify({ type: 'error', message }) })
      }
    })
  })

  return app
}
