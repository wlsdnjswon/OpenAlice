/** Lightweight technical indicator calculations from raw close/volume arrays. */

export function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  const slice = closes.slice(-(period + 1))
  let gains = 0, losses = 0
  for (let i = 1; i < slice.length; i++) {
    const d = slice[i] - slice[i - 1]
    if (d > 0) gains += d; else losses -= d
  }
  if (losses === 0) return 100
  const rs = (gains / period) / (losses / period)
  return 100 - 100 / (1 + rs)
}

function ema(values: number[], period: number): number[] {
  if (values.length < period) return []
  const k = 2 / (period + 1)
  const result: number[] = []
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

export interface MACDResult { macdLine: number; signalLine: number; histogram: number }

export function calcMACD(closes: number[], fast = 12, slow = 26, signal = 9): MACDResult | null {
  if (closes.length < slow + signal) return null
  const emaFast = ema(closes, fast)
  const emaSlow = ema(closes, slow)
  const len = Math.min(emaFast.length, emaSlow.length)
  const macdLine = Array.from({ length: len }, (_, i) =>
    emaFast[emaFast.length - len + i] - emaSlow[emaSlow.length - len + i])
  const sigArr = ema(macdLine, signal)
  if (!sigArr.length) return null
  const last = macdLine[macdLine.length - 1]
  const lastSig = sigArr[sigArr.length - 1]
  return { macdLine: last, signalLine: lastSig, histogram: last - lastSig }
}

export interface BBResult { upper: number; middle: number; lower: number; bandwidth: number; percentB: number }

export function calcBB(closes: number[], period = 20, mult = 2): BBResult | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  const middle = slice.reduce((a, b) => a + b, 0) / period
  const std = Math.sqrt(slice.reduce((a, b) => a + (b - middle) ** 2, 0) / period)
  const upper = middle + mult * std
  const lower = middle - mult * std
  const last = closes[closes.length - 1]
  return { upper, middle, lower, bandwidth: (upper - lower) / middle, percentB: (last - lower) / (upper - lower) }
}

export function calcVolumeRatio(volumes: number[], period = 20): number | null {
  if (volumes.length < period + 1) return null
  const slice = volumes.slice(-(period + 1))
  const avg = slice.slice(0, period).reduce((a, b) => a + b, 0) / period
  if (avg === 0) return null
  return slice[slice.length - 1] / avg
}
