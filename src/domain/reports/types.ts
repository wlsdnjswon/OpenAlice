export type ReportType = 'short' | 'long'
export type ReportStatus = 'generating' | 'done' | 'error'
export type ReportAssetClass = 'equity' | 'crypto' | 'currency' | 'commodity'

export interface ReportIndex {
  id: string
  symbol: string
  assetClass: ReportAssetClass
  type: ReportType
  status: ReportStatus
  createdAt: string
  completedAt?: string
  language: 'ko' | 'en'
  title: string
  errorMessage?: string
}

export interface ReportDetail extends ReportIndex {
  dataSnapshot: object
  content: string
  generationMs: number
}
