/**
 * KRX Symbol Catalog — static enumeration of major Korean listed securities.
 *
 * Korean equities use 6-digit codes. yfinance expects:
 *   - KOSPI stocks: <code>.KS  (e.g. 005930.KS for Samsung Electronics)
 *   - KOSDAQ stocks: <code>.KQ (e.g. 035720.KQ for Kakao)
 *
 * This catalog covers the top ~80 blue-chip and widely-traded names across
 * KOSPI and KOSDAQ. The intent is to make Korean stocks discoverable via
 * the aggregate search (marketSearchForResearch) and the market UI search box.
 * Price data is fetched via the existing yfinance backend using the .KS/.KQ
 * suffixed symbols — no separate KRX API client is required.
 *
 * To extend: add entries to KOSPI_STOCKS or KOSDAQ_STOCKS below.
 * Source: KRX official listings + market-cap ranking (as of 2026).
 */

export interface KrxSymbolEntry {
  /** yfinance ticker (6-digit code + .KS or .KQ) */
  symbol: string
  /** Korean company name */
  name: string
  /** Korean name romanization or English brand name */
  nameEn: string
  /** KOSPI or KOSDAQ */
  exchange: 'KOSPI' | 'KOSDAQ'
  /** Sector label */
  sector: string
}

// ==================== KOSPI (시가총액 상위 종목) ====================

const KOSPI_STOCKS: Omit<KrxSymbolEntry, 'exchange'>[] = [
  { symbol: '005930.KS', name: '삼성전자',           nameEn: 'Samsung Electronics',       sector: 'Technology' },
  { symbol: '000660.KS', name: 'SK하이닉스',          nameEn: 'SK Hynix',                  sector: 'Technology' },
  { symbol: '005380.KS', name: '현대차',              nameEn: 'Hyundai Motor',             sector: 'Automotive' },
  { symbol: '000270.KS', name: '기아',               nameEn: 'Kia Corp',                  sector: 'Automotive' },
  { symbol: '051910.KS', name: 'LG화학',             nameEn: 'LG Chem',                   sector: 'Chemicals' },
  { symbol: '035420.KS', name: 'NAVER',              nameEn: 'Naver Corp',                sector: 'Technology' },
  { symbol: '005490.KS', name: 'POSCO홀딩스',         nameEn: 'POSCO Holdings',            sector: 'Steel' },
  { symbol: '055550.KS', name: '신한지주',            nameEn: 'Shinhan Financial Group',   sector: 'Finance' },
  { symbol: '105560.KS', name: 'KB금융',             nameEn: 'KB Financial Group',         sector: 'Finance' },
  { symbol: '003550.KS', name: 'LG',                nameEn: 'LG Corp',                   sector: 'Conglomerate' },
  { symbol: '012330.KS', name: '현대모비스',           nameEn: 'Hyundai Mobis',             sector: 'Automotive' },
  { symbol: '066570.KS', name: 'LG전자',             nameEn: 'LG Electronics',            sector: 'Technology' },
  { symbol: '096770.KS', name: 'SK이노베이션',         nameEn: 'SK Innovation',             sector: 'Energy' },
  { symbol: '017670.KS', name: 'SK텔레콤',            nameEn: 'SK Telecom',                sector: 'Telecom' },
  { symbol: '030200.KS', name: 'KT',                nameEn: 'KT Corp',                   sector: 'Telecom' },
  { symbol: '032830.KS', name: '삼성생명',            nameEn: 'Samsung Life Insurance',    sector: 'Finance' },
  { symbol: '086790.KS', name: '하나금융지주',          nameEn: 'Hana Financial Group',      sector: 'Finance' },
  { symbol: '000810.KS', name: '삼성화재',            nameEn: 'Samsung Fire & Marine',     sector: 'Finance' },
  { symbol: '011170.KS', name: '롯데케미칼',           nameEn: 'Lotte Chemical',            sector: 'Chemicals' },
  { symbol: '010950.KS', name: 'S-Oil',             nameEn: 'S-Oil Corp',                sector: 'Energy' },
  { symbol: '003670.KS', name: '포스코퓨처엠',          nameEn: 'POSCO Future M',            sector: 'Batteries' },
  { symbol: '028260.KS', name: '삼성물산',            nameEn: 'Samsung C&T',               sector: 'Conglomerate' },
  { symbol: '036460.KS', name: '한국가스공사',          nameEn: 'Korea Gas Corp',            sector: 'Utilities' },
  { symbol: '015760.KS', name: '한국전력',            nameEn: 'Korea Electric Power',      sector: 'Utilities' },
  { symbol: '009150.KS', name: '삼성전기',            nameEn: 'Samsung Electro-Mechanics', sector: 'Technology' },
  { symbol: '018260.KS', name: '삼성에스디에스',         nameEn: 'Samsung SDS',              sector: 'Technology' },
  { symbol: '034730.KS', name: 'SK',                nameEn: 'SK Holdings',               sector: 'Conglomerate' },
  { symbol: '000720.KS', name: '현대건설',            nameEn: 'Hyundai Engineering & Construction', sector: 'Construction' },
  { symbol: '011210.KS', name: '현대위아',            nameEn: 'Hyundai Wia',               sector: 'Automotive' },
  { symbol: '139480.KS', name: '이마트',             nameEn: 'E-Mart',                    sector: 'Retail' },
  { symbol: '271560.KS', name: '오리온',             nameEn: 'Orion Corp',                sector: 'Food' },
  { symbol: '207940.KS', name: '삼성바이오로직스',        nameEn: 'Samsung Biologics',         sector: 'Biotech' },
  { symbol: '068270.KS', name: '셀트리온',            nameEn: 'Celltrion',                 sector: 'Biotech' },
  { symbol: '051900.KS', name: 'LG생활건강',          nameEn: 'LG H&H',                    sector: 'Consumer' },
  { symbol: '090430.KS', name: '아모레퍼시픽',          nameEn: 'Amorepacific',              sector: 'Consumer' },
  { symbol: '047050.KS', name: '포스코인터내셔널',        nameEn: 'POSCO International',       sector: 'Trading' },
  { symbol: '032640.KS', name: 'LG유플러스',           nameEn: 'LG Uplus',                  sector: 'Telecom' },
  { symbol: '004020.KS', name: '현대제철',            nameEn: 'Hyundai Steel',             sector: 'Steel' },
  { symbol: '011780.KS', name: '금호석유',            nameEn: 'Kumho Petrochemical',       sector: 'Chemicals' },
  { symbol: '023530.KS', name: '롯데쇼핑',            nameEn: 'Lotte Shopping',            sector: 'Retail' },
  { symbol: '006400.KS', name: '삼성SDI',            nameEn: 'Samsung SDI',               sector: 'Batteries' },
  { symbol: '373220.KS', name: 'LG에너지솔루션',        nameEn: 'LG Energy Solution',        sector: 'Batteries' },
  { symbol: '247540.KS', name: '에코프로비엠',          nameEn: 'EcoPro BM',                sector: 'Batteries' },
  { symbol: '086280.KS', name: '현대글로비스',          nameEn: 'Hyundai Glovis',            sector: 'Logistics' },
  { symbol: '000100.KS', name: '유한양행',            nameEn: 'Yuhan Corp',                sector: 'Pharma' },
  { symbol: '033780.KS', name: 'KT&G',              nameEn: 'KT&G Corp',                 sector: 'Consumer' },
  { symbol: '010140.KS', name: '삼성중공업',           nameEn: 'Samsung Heavy Industries',  sector: 'Shipbuilding' },
  { symbol: '009540.KS', name: 'HD현대중공업',          nameEn: 'HD Hyundai Heavy Industries', sector: 'Shipbuilding' },
  { symbol: '042700.KS', name: '한미반도체',           nameEn: 'Hanmi Semiconductor',       sector: 'Technology' },
  { symbol: '005830.KS', name: 'DB손해보험',          nameEn: 'DB Insurance',              sector: 'Finance' },
]

// ==================== KOSDAQ (주요 종목) ====================

const KOSDAQ_STOCKS: Omit<KrxSymbolEntry, 'exchange'>[] = [
  { symbol: '035720.KQ', name: '카카오',             nameEn: 'Kakao Corp',                sector: 'Technology' },
  { symbol: '035900.KQ', name: 'JYP엔터테인먼트',      nameEn: 'JYP Entertainment',         sector: 'Entertainment' },
  { symbol: '041510.KQ', name: 'SM엔터테인먼트',       nameEn: 'SM Entertainment',          sector: 'Entertainment' },
  { symbol: '352820.KQ', name: '하이브',             nameEn: 'HYBE Co',                   sector: 'Entertainment' },
  { symbol: '112040.KQ', name: 'Wishket',           nameEn: 'Wishket',                   sector: 'Technology' },
  { symbol: '086900.KQ', name: '메디톡스',            nameEn: 'Medytox',                   sector: 'Biotech' },
  { symbol: '145020.KQ', name: '휴젤',              nameEn: 'Hugel',                     sector: 'Biotech' },
  { symbol: '214150.KQ', name: '클래시스',            nameEn: 'Classys',                   sector: 'Medical' },
  { symbol: '196170.KQ', name: '알테오젠',            nameEn: 'Alteogen',                  sector: 'Biotech' },
  { symbol: '323410.KQ', name: '카카오뱅크',           nameEn: 'Kakao Bank',                sector: 'Finance' },
  { symbol: '293490.KQ', name: '카카오게임즈',          nameEn: 'Kakao Games',               sector: 'Gaming' },
  { symbol: '263750.KQ', name: '펄어비스',            nameEn: 'Pearl Abyss',               sector: 'Gaming' },
  { symbol: '095660.KQ', name: '네오위즈',            nameEn: 'Neowiz',                    sector: 'Gaming' },
  { symbol: '064260.KQ', name: '다날',              nameEn: 'Danal',                     sector: 'Fintech' },
  { symbol: '060310.KQ', name: '3S',               nameEn: '3S Co',                     sector: 'Technology' },
  { symbol: '039200.KQ', name: '오스코텍',            nameEn: 'Oscotec',                   sector: 'Biotech' },
  { symbol: '122870.KQ', name: '와이지엔터테인먼트',      nameEn: 'YG Entertainment',          sector: 'Entertainment' },
  { symbol: '078340.KQ', name: '컴투스',             nameEn: 'Com2uS',                    sector: 'Gaming' },
  { symbol: '036570.KQ', name: '엔씨소프트',           nameEn: 'NCSoft',                    sector: 'Gaming' },
  { symbol: '251270.KQ', name: '넷마블',             nameEn: 'Netmarble',                 sector: 'Gaming' },
  { symbol: '058470.KQ', name: '리노공업',            nameEn: 'Lino Industrial',           sector: 'Technology' },
  { symbol: '357780.KQ', name: '솔브레인',            nameEn: 'Soulbrain',                 sector: 'Chemicals' },
  { symbol: '015760.KQ', name: '한국전력',            nameEn: 'KEPCO',                     sector: 'Utilities' },
  { symbol: '450080.KQ', name: '에코프로',            nameEn: 'EcoPro',                    sector: 'Batteries' },
  { symbol: '247540.KQ', name: '에코프로비엠',          nameEn: 'EcoPro BM',                sector: 'Batteries' },
  { symbol: '091990.KQ', name: '셀트리온헬스케어',        nameEn: 'Celltrion Healthcare',      sector: 'Biotech' },
  { symbol: '090410.KQ', name: '로보스타',            nameEn: 'Robostar',                  sector: 'Robotics' },
  { symbol: '140860.KQ', name: '파크시스템스',          nameEn: 'Park Systems',              sector: 'Technology' },
]

export class KrxCatalog {
  private entries: KrxSymbolEntry[] = []

  get size(): number { return this.entries.length }

  load(): void {
    this.entries = [
      ...KOSPI_STOCKS.map((s) => ({ ...s, exchange: 'KOSPI' as const })),
      ...KOSDAQ_STOCKS.map((s) => ({ ...s, exchange: 'KOSDAQ' as const })),
    ]
  }

  /**
   * Search by symbol, Korean name, English name, or sector.
   * Regex with fallback to substring — same pattern as SymbolIndex.
   */
  search(pattern: string, limit = 20): KrxSymbolEntry[] {
    let test: (s: string) => boolean
    try {
      const re = new RegExp(pattern, 'i')
      test = (s) => re.test(s)
    } catch {
      const lower = pattern.toLowerCase()
      test = (s) => s.toLowerCase().includes(lower)
    }

    const results: KrxSymbolEntry[] = []
    for (const entry of this.entries) {
      if (
        test(entry.symbol) ||
        test(entry.name) ||
        test(entry.nameEn) ||
        test(entry.sector)
      ) {
        results.push(entry)
        if (results.length >= limit) break
      }
    }
    return results
  }

  /** Exact lookup by ticker symbol (case-insensitive). */
  resolve(symbol: string): KrxSymbolEntry | undefined {
    const upper = symbol.toUpperCase()
    return this.entries.find((e) => e.symbol.toUpperCase() === upper)
  }

  list(): KrxSymbolEntry[] {
    return [...this.entries]
  }
}

/**
 * Normalize a raw Korean stock input to a yfinance-compatible ticker.
 * Accepts:
 *   "005930"      → "005930.KS"  (bare 6-digit KOSPI code, no exchange hint)
 *   "005930.KS"   → "005930.KS"  (already normalized)
 *   "035720.KQ"   → "035720.KQ"  (KOSDAQ, already normalized)
 *   "삼성전자"      → undefined    (name lookup — use catalog.search() instead)
 */
export function normalizeKrxTicker(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (/^\d{6}\.(KS|KQ)$/i.test(trimmed)) {
    return trimmed.toUpperCase()
  }
  if (/^\d{6}$/.test(trimmed)) {
    return `${trimmed}.KS`
  }
  return undefined
}
