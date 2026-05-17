import { appendFile, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { resolve } from 'node:path'
import type { ReportIndex, ReportDetail, ReportType, ReportAssetClass } from './types.js'

const REPORTS_DIR = resolve('data/reports')
const INDEX_FILE = join(REPORTS_DIR, 'index.jsonl')

export class ReportStore {
  private index: ReportIndex[] = []

  async init(): Promise<void> {
    await mkdir(REPORTS_DIR, { recursive: true })
    try {
      const content = await readFile(INDEX_FILE, 'utf-8')
      this.index = content.split('\n').filter(Boolean).map((l) => JSON.parse(l) as ReportIndex)
    } catch {
      this.index = []
    }
  }

  async append(entry: ReportIndex): Promise<void> {
    this.index.push(entry)
    await mkdir(REPORTS_DIR, { recursive: true })
    await appendFile(INDEX_FILE, JSON.stringify(entry) + '\n')
  }

  async updateIndex(id: string, patch: Partial<ReportIndex>): Promise<void> {
    const idx = this.index.findIndex((r) => r.id === id)
    if (idx < 0) return
    this.index[idx] = { ...this.index[idx], ...patch }
    const lines = this.index.map((r) => JSON.stringify(r)).join('\n') + '\n'
    await writeFile(INDEX_FILE, lines)
  }

  async saveDetail(detail: ReportDetail): Promise<void> {
    await writeFile(join(REPORTS_DIR, `${detail.id}.json`), JSON.stringify(detail, null, 2))
  }

  async getDetail(id: string): Promise<ReportDetail | null> {
    try {
      return JSON.parse(await readFile(join(REPORTS_DIR, `${id}.json`), 'utf-8')) as ReportDetail
    } catch {
      return null
    }
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.index.findIndex((r) => r.id === id)
    if (idx < 0) return false
    this.index.splice(idx, 1)
    const lines = this.index.length > 0 ? this.index.map((r) => JSON.stringify(r)).join('\n') + '\n' : ''
    await writeFile(INDEX_FILE, lines)
    await rm(join(REPORTS_DIR, `${id}.json`)).catch(() => {})
    return true
  }

  list(params?: { symbol?: string; type?: ReportType; assetClass?: ReportAssetClass; limit?: number }): ReportIndex[] {
    let results = [...this.index].reverse()
    if (params?.symbol) results = results.filter((r) => r.symbol === params.symbol)
    if (params?.type) results = results.filter((r) => r.type === params.type)
    if (params?.assetClass) results = results.filter((r) => r.assetClass === params.assetClass)
    return params?.limit ? results.slice(0, params.limit) : results
  }

  get(id: string): ReportIndex | null {
    return this.index.find((r) => r.id === id) ?? null
  }
}
