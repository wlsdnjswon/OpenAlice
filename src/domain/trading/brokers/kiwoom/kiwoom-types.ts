/**
 * Kiwoom REST API — TypeScript shapes for request/response bodies.
 *
 * All monetary values from Kiwoom are zero-padded strings (e.g. "000000017534").
 * Signed amounts use a leading sign: "+60700" or "-60150".
 */

// ==================== Config ====================

export interface KiwoomBrokerConfig {
  paper: boolean
  appkey: string
  secretkey: string
}

// ==================== Auth (au10001 / au10002) ====================

export interface KiwoomTokenRequest {
  grant_type: 'client_credentials'
  appkey: string
  secretkey: string
}

export interface KiwoomTokenResponse {
  token: string
  token_type: string
  expires_dt: string   // "20241107083713" (YYYYMMDDHHmmss)
  return_code: number
  return_msg: string
}

export interface KiwoomRevokeRequest {
  appkey: string
  secretkey: string
  token: string
}

// ==================== Common ====================

export interface KiwoomBaseResponse {
  return_code: number
  return_msg: string
}

/** Standard request headers sent on every API call */
export interface KiwoomRequestHeaders {
  'api-id': string
  'authorization': string
  'content-type': 'application/json;charset=UTF-8'
  'cont-yn'?: string
  'next-key'?: string
}

// ==================== Account (ka00001) ====================

export interface KiwoomAccountNumberResponse extends KiwoomBaseResponse {
  acctNo: string
}

// ==================== Account balance / overview (kt00001) ====================

export interface KiwoomAccountBalanceRequest {
  qry_tp: '3' | '2'  // 3=전체, 2=일반
}

export interface KiwoomAccountBalanceResponse extends KiwoomBaseResponse {
  entr: string            // 예수금
  ord_alow_amt: string    // 주문가능금액
  repl_amt: string        // 대체금액
  profa_ch: string        // 주식증거금합계
  pymn_alow_amt: string   // 출금가능금액
  d2_entra?: string       // D+2 예수금
}

// ==================== Account overview + positions (kt00004) ====================

export interface KiwoomAccountOverviewRequest {
  qry_tp: '0' | '1'       // 0=전체, 1=일반계좌만
  dmst_stex_tp: 'KRX' | 'NXT'
}

export interface KiwoomStockPosition {
  stk_cd: string           // 종목코드 (may have "A" prefix)
  stk_nm: string           // 종목명
  rmnd_qty: string         // 잔여수량
  avg_prc: string          // 평균단가
  cur_prc: string          // 현재가 (may have sign prefix)
  evlt_amt: string         // 평가금액
  pl_amt: string           // 손익금액
  pl_rt: string            // 손익률
  pur_amt: string          // 매입금액
  setl_remn: string        // 결제잔량
  loan_dt: string
}

export interface KiwoomAccountOverviewResponse extends KiwoomBaseResponse {
  acnt_nm: string          // 계좌명
  brch_nm: string          // 지점명
  entr: string             // 예수금
  d2_entra: string         // D+2 예수금
  tot_est_amt: string      // 총추정자산
  aset_evlt_amt: string    // 자산평가금액
  tot_pur_amt: string      // 총매입금액
  prsm_dpst_aset_amt: string // 추정예탁자산
  lspft_amt: string        // 손익금액
  lspft_rt: string         // 손익률
  stk_acnt_evlt_prst: KiwoomStockPosition[]
}

// ==================== Settled balance (kt00005) ====================

export interface KiwoomSettledBalanceRequest {
  dmst_stex_tp: 'KRX' | 'NXT'
}

export interface KiwoomSettledPosition {
  crd_tp: string
  stk_cd: string
  stk_nm: string
  setl_remn: string        // 결제잔량
  cur_qty: string          // 현재수량
  cur_prc: string          // 현재가
  buy_uv: string           // 매입단가
  pur_amt: string          // 매입금액
  evlt_amt: string         // 평가금액
  evltv_prft: string       // 평가손익
  pl_rt: string            // 손익률
  loan_dt: string
}

export interface KiwoomSettledBalanceResponse extends KiwoomBaseResponse {
  entr: string
  ord_alowa: string        // 주문가능금액
  evlt_amt_tot: string     // 평가금액합계
  tot_pl_tot: string       // 총손익합계
  tot_pl_rt: string        // 총손익률
  stk_cntr_remn: KiwoomSettledPosition[]
}

// ==================== Orders: buy (kt10000) / sell (kt10001) ====================

export type KiwoomExchangeType = 'KRX' | 'NXT' | 'SOR'

/**
 * trde_tp codes:
 * 00=지정가, 03=시장가, 05=조건부지정가, 06=최유리지정가, 07=최우선지정가,
 * 10=지정가(IOC), 13=시장가(IOC), 16=최유리(IOC), 20=지정가(FOK),
 * 23=시장가(FOK), 26=최유리(FOK), 61=장전시간외종가, 62=시간외단일가,
 * 81=장전시간외, 28=장전주문, 29=추가매수, 30=추가매수(IOC), 31=추가매수(FOK)
 */
export type KiwoomTradeType =
  | '00' | '03' | '05' | '06' | '07'
  | '10' | '13' | '16' | '20' | '23' | '26'
  | '61' | '62' | '81' | '28' | '29' | '30' | '31'

export interface KiwoomOrderRequest {
  dmst_stex_tp: KiwoomExchangeType
  stk_cd: string
  ord_qty: string
  ord_uv: string           // 주문단가 (지정가 시 가격, 시장가 시 "")
  trde_tp: KiwoomTradeType
  cond_uv?: string         // 조건단가
}

export interface KiwoomOrderResponse extends KiwoomBaseResponse {
  ord_no: string           // 주문번호 (7자리)
  dmst_stex_tp?: string
}

// ==================== Order modify (kt10002) ====================

export interface KiwoomModifyOrderRequest {
  dmst_stex_tp: KiwoomExchangeType
  orig_ord_no: string      // 원주문번호
  stk_cd: string
  mdfy_qty: string         // 정정수량
  mdfy_uv: string          // 정정단가
  mdfy_cond_uv?: string
}

export interface KiwoomModifyOrderResponse extends KiwoomBaseResponse {
  ord_no: string
  base_orig_ord_no: string
  mdfy_qty: string
  dmst_stex_tp: string
}

// ==================== Order cancel (kt10003) ====================

export interface KiwoomCancelOrderRequest {
  dmst_stex_tp: KiwoomExchangeType
  orig_ord_no: string
  stk_cd: string
  cncl_qty: string         // 취소수량 ('0' = 전체 취소)
}

export interface KiwoomCancelOrderResponse extends KiwoomBaseResponse {
  ord_no: string
  base_orig_ord_no: string
  cncl_qty: string
}

// ==================== Unfilled orders (ka10075) ====================

export interface KiwoomUnfilledOrdersRequest {
  all_stk_tp: '0' | '1'   // 0=전체, 1=주식
  trde_tp: '0' | '1' | '2' // 0=전체, 1=매도, 2=매수
  stk_cd?: string
  stex_tp: '0' | '1' | '2' // 0=전체, 1=KRX, 2=NXT
}

export interface KiwoomUnfilledOrder {
  acnt_no: string
  ord_no: string           // 주문번호
  stk_cd: string           // 종목코드
  stk_nm: string           // 종목명
  ord_stt: string          // 주문상태
  ord_qty: string          // 주문수량
  ord_pric: string         // 주문가격
  oso_qty: string          // 미체결수량
  trde_tp: string          // 거래유형
  io_tp_nm: string         // 주문구분
  tm: string               // 시간
  cntr_no: string          // 체결번호
  cntr_pric: string        // 체결가
  cntr_qty: string         // 체결수량
  cur_prc: string          // 현재가
  orig_ord_no: string      // 원주문번호
}

export interface KiwoomUnfilledOrdersResponse extends KiwoomBaseResponse {
  oso: KiwoomUnfilledOrder[]
}

// ==================== Order history (kt00007) ====================

export interface KiwoomOrderHistoryRequest {
  ord_dt?: string          // YYYYMMDD (빈 값 = 당일)
  qry_tp: '1' | '2' | '3' | '4' // 1=주문순, 2=역순, 3=미체결만, 4=체결내역
  stk_bond_tp: '0' | '1' | '2'  // 0=전체, 1=주식, 2=채권
  sell_tp: '0' | '1' | '2'      // 0=전체, 1=매도, 2=매수
  stk_cd?: string
  fr_ord_no?: string
  dmst_stex_tp: '%' | 'KRX' | 'NXT' | 'SOR'
}

export interface KiwoomOrderHistory {
  ord_no: string
  stk_cd: string
  stk_nm: string
  trde_tp: string
  io_tp_nm: string
  ord_qty: string
  ord_uv: string
  cnfm_qty: string         // 확인수량
  acpt_tp: string
  ord_tm: string
  ori_ord: string
  cntr_qty: string         // 체결수량
  cntr_uv: string          // 체결단가
  ord_remnq: string        // 주문잔량
  mdfy_cncl: string
  dmst_stex_tp: string
}

export interface KiwoomOrderHistoryResponse extends KiwoomBaseResponse {
  acnt_ord_cntr_prps_dtl: KiwoomOrderHistory[]
}

// ==================== Stock basic info (ka10001) ====================

export interface KiwoomStockInfoRequest {
  stk_cd: string
}

export interface KiwoomStockInfoResponse extends KiwoomBaseResponse {
  stk_cd: string
  stk_nm: string
  cur_prc: string          // 현재가 (may have sign prefix)
  pred_pre: string         // 전일대비
  flu_rt: string           // 등락률
  open_pric: string        // 시가
  high_pric: string        // 고가
  low_pric: string         // 저가
  upl_pric: string         // 상한가
  lst_pric: string         // 하한가
  base_pric: string        // 기준가
  trde_qty: string         // 거래량
  trde_pre: string         // 거래대금
  fav: string              // 액면가
  per: string              // PER
  eps: string              // EPS
  pbr: string              // PBR
  bps: string              // BPS
  cap: string              // 자본금
  '250hgst': string        // 52주 최고
  '250lwst': string        // 52주 최저
}

// ==================== WebSocket types ====================

export type KiwoomWsTrnm = 'REG' | 'REMOVE' | 'REAL'

export interface KiwoomWsSubscribeRequest {
  trnm: 'REG' | 'REMOVE'
  grp_no: string           // "1"~"4"
  refresh: '0' | '1'      // 1=기존구독 초기화
  data: Array<{
    item: string[]
    type: string[]
  }>
}

export interface KiwoomWsSubscribeResponse {
  trnm: 'REG' | 'REMOVE'
  return_code: number
  return_msg: string
}

/** Real-time push event (trnm='REAL') */
export interface KiwoomWsRealtimeEvent {
  trnm: 'REAL'
  data: Array<{
    type: string           // "00", "0B", etc.
    name: string
    item: string           // 종목코드 or 계좌번호
    values: Record<string, string>
  }>
}

/**
 * WebSocket type "00" — 주문체결 이벤트
 * Triggered per order fill for the authenticated account.
 */
export interface KiwoomWsOrderFillValues {
  '9201': string   // 계좌번호
  '9203': string   // 주문번호
  '9001': string   // 종목코드
  '302': string    // 종목명
  '913': string    // 주문상태 (접수, 체결, 확인, 거부, 취소)
  '900': string    // 주문수량
  '901': string    // 주문단가
  '902': string    // 미체결수량
  '903': string    // 체결누계금액
  '904': string    // 원주문번호
  '905': string    // 주문구분 ("+매수", "-매도" 등)
  '906': string    // 거래유형 (지정가, 시장가 등)
  '907': string    // 매도수구분 (1=매도, 2=매수)
  '908': string    // 주문/체결시간
  '910': string    // 체결가
  '911': string    // 체결량
  '10': string     // 현재가
  '27': string     // (최우선)매도호가
  '28': string     // (최우선)매수호가
}

/**
 * WebSocket type "0B" — 주식체결 이벤트
 * Real-time tick data per stock code subscription.
 */
export interface KiwoomWsTickValues {
  '10': string     // 현재가
  '11': string     // 전일대비
  '12': string     // 등락률
  '27': string     // (최우선)매도호가
  '28': string     // (최우선)매수호가
  '13': string     // 누적거래량
  '14': string     // 누적거래대금
  '16': string     // 시가
  '17': string     // 고가
  '18': string     // 저가
}
