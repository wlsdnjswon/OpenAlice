import { describe, it, expect, beforeEach } from 'vitest'
import { KrxCatalog, normalizeKrxTicker } from '../equity/krx-catalog.js'

describe('KrxCatalog', () => {
  let catalog: KrxCatalog

  beforeEach(() => {
    catalog = new KrxCatalog()
    catalog.load()
  })

  it('loads KOSPI and KOSDAQ entries', () => {
    expect(catalog.size).toBeGreaterThan(50)
  })

  it('finds Samsung by Korean name', () => {
    const results = catalog.search('삼성전자')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].symbol).toBe('005930.KS')
    expect(results[0].exchange).toBe('KOSPI')
  })

  it('finds Samsung by English name', () => {
    const results = catalog.search('Samsung Electronics')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].symbol).toBe('005930.KS')
  })

  it('finds Kakao in KOSDAQ', () => {
    const results = catalog.search('카카오')
    const kakao = results.find((r) => r.symbol === '035720.KQ')
    expect(kakao).toBeDefined()
    expect(kakao!.exchange).toBe('KOSDAQ')
  })

  it('finds by 6-digit code prefix', () => {
    const results = catalog.search('005930')
    expect(results.some((r) => r.symbol === '005930.KS')).toBe(true)
  })

  it('finds by sector', () => {
    const results = catalog.search('Batteries', 50)
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.sector === 'Batteries')).toBe(true)
  })

  it('resolves exact ticker', () => {
    const entry = catalog.resolve('005930.KS')
    expect(entry).toBeDefined()
    expect(entry!.name).toBe('삼성전자')
  })

  it('resolve returns undefined for unknown ticker', () => {
    expect(catalog.resolve('999999.KS')).toBeUndefined()
  })

  it('respects limit', () => {
    const results = catalog.search('a', 5)
    expect(results.length).toBeLessThanOrEqual(5)
  })
})

describe('normalizeKrxTicker', () => {
  it('passes through already-normalized KOSPI ticker', () => {
    expect(normalizeKrxTicker('005930.KS')).toBe('005930.KS')
  })

  it('passes through already-normalized KOSDAQ ticker', () => {
    expect(normalizeKrxTicker('035720.KQ')).toBe('035720.KQ')
  })

  it('appends .KS to bare 6-digit code', () => {
    expect(normalizeKrxTicker('005930')).toBe('005930.KS')
  })

  it('normalizes lowercase suffix', () => {
    expect(normalizeKrxTicker('005930.ks')).toBe('005930.KS')
  })

  it('returns undefined for Korean name input', () => {
    expect(normalizeKrxTicker('삼성전자')).toBeUndefined()
  })

  it('returns undefined for non-KRX ticker', () => {
    expect(normalizeKrxTicker('AAPL')).toBeUndefined()
  })
})
