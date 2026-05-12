/**
 * KiwoomWsClient — WebSocket client for Kiwoom real-time data.
 *
 * Single persistent connection to wss://api.kiwoom.com:10000.
 * Manages subscriptions and routes push events via EventEmitter.
 *
 * Two key subscription types:
 *   "00" — 주문체결: account-level order fill notifications (item=[""]).
 *   "0B" — 주식체결: per-stock tick data (item=["005930"]).
 */

import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import type {
  KiwoomWsSubscribeRequest,
  KiwoomWsSubscribeResponse,
  KiwoomWsRealtimeEvent,
  KiwoomWsOrderFillValues,
  KiwoomWsTickValues,
} from './kiwoom-types.js'

const WS_PATH = '/api/dostk/websocket'
const RECONNECT_DELAY_MS = 5_000
const PING_INTERVAL_MS   = 30_000

export interface KiwoomOrderFillEvent {
  accountNo: string
  orderId: string
  stockCode: string
  stockName: string
  status: string           // "접수" | "체결" | "확인" | "거부" | "취소"
  orderQty: number
  orderPrice: number
  filledQty: number
  fillPrice: number
  side: 'buy' | 'sell'    // 907: "1"=매도, "2"=매수
  tradeType: string
  time: string
}

export interface KiwoomTickEvent {
  stockCode: string
  price: number
  change: number
  changeRate: number
  bidPrice: number
  askPrice: number
  volume: number
}

export class KiwoomWsClient extends EventEmitter {
  private ws: WebSocket | null = null
  private pingTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private destroyed = false
  private token = ''
  private groupCounter = 1

  constructor(
    private readonly wsBaseUrl: string,
    private readonly getToken: () => Promise<string>,
  ) {
    super()
  }

  async connect(): Promise<void> {
    this.destroyed = false
    this.token = await this.getToken()
    this.openSocket()
  }

  private openSocket(): void {
    if (this.destroyed) return
    const url = `${this.wsBaseUrl}${WS_PATH}`
    this.ws = new WebSocket(url, {
      headers: {
        'authorization': `Bearer ${this.token}`,
        'api-id': '00',
        'content-type': 'application/json;charset=UTF-8',
      },
    })

    this.ws.on('open', () => {
      this.emit('connected')
      this.startPing()
      // Subscribe to account-level order fill events
      this.subscribe([''], ['00'], '1')
    })

    this.ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        this.handleMessage(msg)
      } catch {
        // ignore parse errors
      }
    })

    this.ws.on('close', () => {
      this.emit('disconnected')
      this.stopPing()
      this.scheduleReconnect()
    })

    this.ws.on('error', (err) => {
      this.emit('error', err)
    })
  }

  private handleMessage(msg: KiwoomWsSubscribeResponse | KiwoomWsRealtimeEvent | Record<string, unknown>): void {
    if ('trnm' in msg && msg.trnm === 'REAL') {
      const event = msg as KiwoomWsRealtimeEvent
      for (const d of event.data) {
        if (d.type === '00') {
          this.emit('orderFill', this.parseOrderFill(d.item, d.values as unknown as KiwoomWsOrderFillValues))
        } else if (d.type === '0B') {
          this.emit('tick', this.parseTick(d.item, d.values as unknown as KiwoomWsTickValues))
        }
      }
    }
  }

  private parseOrderFill(item: string, v: KiwoomWsOrderFillValues): KiwoomOrderFillEvent {
    return {
      accountNo: v['9201'] ?? '',
      orderId: (v['9203'] ?? '').replace(/^0+/, '') || '0',
      stockCode: normalizeCode(v['9001'] ?? item),
      stockName: v['302'] ?? '',
      status: v['913'] ?? '',
      orderQty: parseSignedInt(v['900'] ?? '0'),
      orderPrice: parseSignedInt(v['901'] ?? '0'),
      filledQty: parseSignedInt(v['902'] !== undefined ? String(parseSignedInt(v['900'] ?? '0') - parseSignedInt(v['902'] ?? '0')) : '0'),
      fillPrice: parseSignedInt(v['910'] ?? '0'),
      side: v['907'] === '1' ? 'sell' : 'buy',
      tradeType: v['906'] ?? '',
      time: v['908'] ?? '',
    }
  }

  private parseTick(item: string, v: KiwoomWsTickValues): KiwoomTickEvent {
    return {
      stockCode: normalizeCode(item),
      price: parseSignedInt(v['10'] ?? '0'),
      change: parseSignedInt(v['11'] ?? '0'),
      changeRate: parseFloat(v['12'] ?? '0'),
      bidPrice: parseSignedInt(v['28'] ?? '0'),
      askPrice: parseSignedInt(v['27'] ?? '0'),
      volume: parseSignedInt(v['13'] ?? '0'),
    }
  }

  /** Subscribe to real-time types for given stock codes. */
  subscribe(items: string[], types: string[], refresh: '0' | '1' = '1'): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const req: KiwoomWsSubscribeRequest = {
      trnm: 'REG',
      grp_no: String(this.groupCounter++),
      refresh,
      data: [{ item: items, type: types }],
    }
    this.ws.send(JSON.stringify(req))
  }

  /** Unsubscribe from real-time types. */
  unsubscribe(items: string[], types: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const req: KiwoomWsSubscribeRequest = {
      trnm: 'REMOVE',
      grp_no: String(this.groupCounter++),
      refresh: '0',
      data: [{ item: items, type: types }],
    }
    this.ws.send(JSON.stringify(req))
  }

  disconnect(): void {
    this.destroyed = true
    this.stopPing()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping()
      }
    }, PING_INTERVAL_MS)
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return
    this.reconnectTimer = setTimeout(async () => {
      if (this.destroyed) return
      try {
        this.token = await this.getToken()
        this.openSocket()
      } catch {
        this.scheduleReconnect()
      }
    }, RECONNECT_DELAY_MS)
  }
}

// ==================== Helpers ====================

/** Remove "A" prefix Kiwoom sometimes prepends: "A005930" → "005930" */
export function normalizeCode(code: string): string {
  return code.startsWith('A') ? code.slice(1) : code
}

/** Parse a zero-padded or sign-prefixed integer: "+60700" | "-60700" | "000060700" → number */
export function parseSignedInt(s: string): number {
  return parseInt(s.replace(/\s/g, ''), 10) || 0
}
