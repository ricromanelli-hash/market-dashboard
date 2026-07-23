const express = require('express');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const app = express();
const PORT = process.env.PORT || 3000;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MarketDashboard/1.0';

// Cotações de índices, moedas, commodities e ações (fonte: Yahoo Finance, API não oficial).
const GROUPS = [
  { title: 'Estados Unidos', items: [
    { symbol: '^GSPC', label: 'S&P 500' },
    { symbol: '^IXIC', label: 'NASDAQ' },
    { symbol: '^DJI', label: 'Dow Jones' },
    { symbol: '^RUT', label: 'Russell 2000' },
    { symbol: 'DX-Y.NYB', label: 'DXY' },
    { symbol: '^VIX', label: 'VIX' },
    { symbol: '^TNX', label: 'US 10-Year' },
    { symbol: '^TYX', label: 'US 30-Year' },
  ]},
  { title: 'Brasil', items: [
    { symbol: '^BVSP', label: 'Ibovespa' },
    { symbol: 'BRL=X', label: 'Dólar', displaySymbol: 'USDBRL=X' },
    { symbol: 'EWZ', label: 'EWZ (MSCI Brazil)' },
  ]},
  { title: 'Commodities', items: [
    { symbol: 'SB=F', label: 'Açúcar NY nº11' },
    { symbol: 'SI=F', label: 'Prata' },
    { symbol: 'GC=F', label: 'Ouro' },
    { symbol: 'CL=F', label: 'Petróleo WTI' },
    { symbol: 'BZ=F', label: 'Petróleo Brent' },
    // Índice TSI (não é futuro negociado): o campo de cotação do Yahoo está congelado
    // em 2021, então `fromSeries` faz ler o preço do último fechamento da série.
    { symbol: 'TIO=F', label: 'Minério de Ferro', fromSeries: true },
    { symbol: 'HRC=F', label: 'Aço Laminado', fromSeries: true },
  ]},
  { title: 'Bancos', items: [
    { symbol: 'ITUB3.SA', label: 'Itaú' },
    { symbol: 'ITUB4.SA', label: 'Itaú' },
    { symbol: 'ITSA4.SA', label: 'Itaúsa' },
    { symbol: 'BPAC11.SA', label: 'BTG' },
    { symbol: 'BBDC3.SA', label: 'Bradesco' },
    { symbol: 'BBDC4.SA', label: 'Bradesco' },
    { symbol: 'SANB11.SA', label: 'Santander' },
    { symbol: 'BBAS3.SA', label: 'Banco do Brasil' },
  ]},
  { title: 'Seguros', items: [
    { symbol: 'BBSE3.SA', label: 'BB' },
    { symbol: 'CXSE3.SA', label: 'Caixa' },
    { symbol: 'PSSA3.SA', label: 'Porto' },
    { symbol: 'IRBR3.SA', label: 'IRB' },
  ]},
  { title: 'Energia', items: [
    { symbol: 'TAEE11.SA', label: 'Taesa' },
    { symbol: 'ISAE4.SA', label: 'Isa Energia' },
    { symbol: 'EGIE3.SA', label: 'Engie' },
    { symbol: 'CMIG4.SA', label: 'CMIG' },
    { symbol: 'AXIA3.SA', label: 'AXIA' },
    { symbol: 'CPFE3.SA', label: 'CPFL' },
  ]},
  { title: 'Saneamento', items: [
    { symbol: 'SAPR11.SA', label: 'Sanepar' },
    { symbol: 'CSMG3.SA', label: 'Copasa' },
    { symbol: 'SBSP3.SA', label: 'Sabesp' },
  ]},
  { title: 'Telecom', items: [
    { symbol: 'VIVT3.SA', label: 'Vivo' },
    { symbol: 'TIMS3.SA', label: 'TIM' },
  ]},
  { title: 'Mineração', items: [
    { symbol: 'VALE3.SA', label: 'VALE' },
    { symbol: 'BRAP4.SA', label: 'Bradespar' },
    { symbol: 'CMIN3.SA', label: 'CSN Mineração' },
  ]},
  { title: 'Petróleo & Gás', items: [
    { symbol: 'PETR4.SA', label: 'Petrobras' },
    { symbol: 'PRIO3.SA', label: 'Prio' },
    { symbol: 'RECV3.SA', label: 'Recôncavo' },
    { symbol: 'PASS3.SA', label: 'Compass' },
    { symbol: 'CGAS5.SA', label: 'Compass Gás' },
  ]},
  { title: 'Papel & Celulose', items: [
    { symbol: 'KLBN4.SA', label: 'Klabin' },
    { symbol: 'SUZB3.SA', label: 'Suzano' },
    { symbol: 'RANI3.SA', label: 'Irani' },
  ]},
  { title: 'Metalurgia & Siderurgia', items: [
    { symbol: 'USIM5.SA', label: 'Usiminas' },
    { symbol: 'CSNA3.SA', label: 'CSN' },
    { symbol: 'GGBR4.SA', label: 'Gerdau Metal.' },
    { symbol: 'GOAU4.SA', label: 'Gerdau Hold.' },
  ]},
  { title: 'Químicos & Petroquímicos', items: [
    { symbol: 'UNIP6.SA', label: 'Unipar' },
    { symbol: 'BRKM3.SA', label: 'Braskem' },
  ]},
  { title: 'Outros', items: [
    { symbol: 'WEGE3.SA', label: 'WEG' },
    { symbol: 'LEVE3.SA', label: 'Metal Leve' },
    { symbol: 'MYPK3.SA', label: 'Iochpe Maxion' },
    { symbol: 'ROMI3.SA', label: 'Romi' },
    { symbol: 'TUPY3.SA', label: 'Tupy' },
    { symbol: 'RADL3.SA', label: 'Raia Drogasil' },
    { symbol: 'FESA4.SA', label: 'Ferbasa' },
    { symbol: 'SLCE3.SA', label: 'SLC' },
    { symbol: 'ABEV3.SA', label: 'Ambev' },
    { symbol: 'TOTS3.SA', label: 'Totvs' },
    { symbol: 'VBBR3.SA', label: 'Vibra' },
    { symbol: 'UGPA3.SA', label: 'Ultrapar' },
    { symbol: 'SAUD3.SA', label: 'BRSAUDE' },
  ]},
  // "Magnificent 7" do S&P 500. `icon` habilita o logo (o serviço da brapi só tem
  // algumas destas; as demais ficam com o espaço reservado em branco).
  { title: 'MAG7 (S&P 500)', items: [
    { symbol: 'GOOGL', label: 'Alphabet', icon: 'GOOGL' },
    { symbol: 'AMZN', label: 'Amazon', icon: 'AMZN' },
    { symbol: 'AAPL', label: 'Apple', icon: 'AAPL' },
    { symbol: 'META', label: 'Meta', icon: 'META' },
    { symbol: 'MSFT', label: 'Microsoft', icon: 'MSFT' },
    { symbol: 'NVDA', label: 'Nvidia', icon: 'NVDA' },
    { symbol: 'TSLA', label: 'Tesla', icon: 'TSLA' },
    { symbol: 'SAP', label: 'SAP', icon: 'SAP' },
    { symbol: 'ORCL', label: 'Oracle', icon: 'ORCL' },
  ]},
];

// Índices mundiais por região, com mini-gráfico de 2 dias (formato "world indices").
// O COLCAP (Colômbia) não existe no Yahoo Finance, por isso ficou de fora.
// `flag`: código ISO usado nas bandeiras do flagcdn.com
const WORLD_INDICES = [
  { region: 'Américas', items: [
    { symbol: '^DJI', label: 'Dow Jones', flag: 'us' },
    { symbol: '^GSPC', label: 'S&P 500', flag: 'us' },
    { symbol: '^IXIC', label: 'Nasdaq', flag: 'us' },
    { symbol: '^GSPTSE', label: 'S&P/TSX Comp', flag: 'ca' },
    { symbol: '^MXX', label: 'S&P/BMV IPC', flag: 'mx' },
    { symbol: '^BVSP', label: 'Ibovespa', flag: 'br' },
    { symbol: '^IPSA', label: 'Chile IPSA', flag: 'cl' },
    { symbol: '^MERV', label: 'ARG MERVAL', flag: 'ar' },
    { symbol: '^SPBLPGPT', label: 'Peru S&P/BVL', flag: 'pe' },
  ]},
  { region: 'EMEA', items: [
    { symbol: '^STOXX50E', label: 'Euro Stoxx 50', flag: 'eu' },
    { symbol: '^FTSE', label: 'FTSE 100', flag: 'gb' },
    { symbol: '^FCHI', label: 'CAC 40', flag: 'fr' },
    { symbol: '^GDAXI', label: 'DAX', flag: 'de' },
  ]},
  { region: 'Ásia/Pacífico', items: [
    { symbol: '^N225', label: 'Nikkei', flag: 'jp' },
    { symbol: '^HSI', label: 'Hang Seng', flag: 'hk' },
    { symbol: '000300.SS', label: 'CSI 300', flag: 'cn' },
    { symbol: '^AXJO', label: 'S&P/ASX 200', flag: 'au' },
  ]},
];

// ---- Juros reais por país ----
// Taxa básica: BIS (WS_CBPOL, taxas de política monetária dos bancos centrais).
// Inflação: OCDE (CPI, variação em 12 meses) — validada contra o IPCA/BCB e o CPI/BLS.
// A Alemanha usa a taxa do BCE (código XM), por não ter política monetária própria.
// `y30`: título de 30 anos. Só os EUA têm série pública gratuita (Yahoo ^TYX) —
// a OCDE cobre apenas curto prazo, 3 meses e longo prazo (10 anos, medida IRLT).
const REAL_RATE_COUNTRIES = [
  { label: 'Brasil', bis: 'BR', oecd: 'BRA', flag: 'br' },
  { label: 'Colômbia', bis: 'CO', oecd: 'COL', flag: 'co' },
  { label: 'R. Unido', bis: 'GB', oecd: 'GBR', flag: 'gb' },
  { label: 'Austrália', bis: 'AU', oecd: 'AUS', flag: 'au' },
  { label: 'EUA', bis: 'US', oecd: 'USA', y30: '^TYX', flag: 'us' },
  { label: 'Alemanha', bis: 'XM', oecd: 'DEU', flag: 'de' },
  { label: 'Canadá', bis: 'CA', oecd: 'CAN', flag: 'ca' },
  { label: 'Z. Euro', bis: 'XM', oecd: 'EA20', wb: 'EMU', flag: 'eu' },
];
// PIB anual via World Bank Data360 (a API clássica do World Bank estava falhando em
// 6 de 8 países; a Data360 devolve todos numa chamada, em ~1,5s).
const WB_GDP_URL = 'https://data360api.worldbank.org/data360/data'
  + '?DATABASE_ID=WB_WDI&INDICATOR=WB_WDI_NY_GDP_MKTP_KD_ZG&REF_AREA='
  + REAL_RATE_COUNTRIES.map((c) => c.wb || c.oecd).join(',');
// Juros de 10 anos (medida IRLT). Essa base rejeita consultas com chave específica,
// então baixamos o dataset inteiro (~80KB) e filtramos aqui.
const OECD_IRLT_URL = 'https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_FINMARK,4.0/'
  + '?lastNObservations=1&format=csv&dimensionAtObservation=AllDimensions';
const BIS_CBPOL_URL = 'https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/D.'
  + [...new Set(REAL_RATE_COUNTRIES.map((c) => c.bis))].join('+')
  + '?lastNObservations=1&format=csv';
const OECD_CPI_URL = 'https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL,1.0/'
  + REAL_RATE_COUNTRIES.map((c) => c.oecd).join('+')
  + '.M.N.CPI.PA._T.N.GY?lastNObservations=1&format=csv';

const IPCA_SGS_SERIES = 13522; // IPCA - variação acumulada em 12 meses (BCB SGS, série oficial)

// Calendário de divulgações do IBGE (API pública oficial). Mapeamos os principais
// indicadores para nomes curtos; eventos fora desta lista são ignorados no card.
const IBGE_CALENDAR_URL = 'https://servicodados.ibge.gov.br/api/v3/calendario/';
// as chaves `match` são comparadas contra o título já normalizado (minúsculo, sem acento)
const CALENDAR_LABELS = [
  { match: 'consumidor amplo 15', label: 'IPCA-15', tag: 'Inflação' },
  { match: 'consumidor amplo', label: 'IPCA', tag: 'Inflação' },
  { match: 'precos ao consumidor', label: 'INPC', tag: 'Inflação' },
  { match: 'precos ao produtor', label: 'IPP', tag: 'Inflação' },
  { match: 'contas nacionais trimestrais', label: 'PIB (trimestral)', tag: 'Atividade' },
  { match: 'domicilios continua mensal', label: 'Desemprego (PNAD mensal)', tag: 'Emprego' },
  { match: 'domicilios continua trimestral', label: 'Desemprego (PNAD trimestral)', tag: 'Emprego' },
  { match: 'industrial mensal', label: 'Produção Industrial', tag: 'Atividade' },
  { match: 'mensal de comercio', label: 'Varejo (PMC)', tag: 'Atividade' },
  { match: 'mensal de servicos', label: 'Serviços (PMS)', tag: 'Atividade' },
  { match: 'construcao civil', label: 'Custos Construção (SINAPI)', tag: 'Inflação' },
];
const NEWS_FEEDS = [
  { source: 'InfoMoney', url: 'https://www.infomoney.com.br/feed/' },
  { source: 'Money Times', url: 'https://www.moneytimes.com.br/feed/' },
];

// Feeds das editorias macro (indicadores econômicos) do InfoMoney e Money Times.
const MACRO_NEWS_FEEDS = [
  { source: 'Money Times', url: 'https://www.moneytimes.com.br/economia/feed/' },
  { source: 'InfoMoney', url: 'https://www.infomoney.com.br/tudo-sobre/inflacao/feed/' },
  { source: 'InfoMoney', url: 'https://www.infomoney.com.br/tudo-sobre/copom/feed/' },
];

// Feeds mais amplos (incluindo mercados/ações) para casar com as empresas acompanhadas.
const COMPANY_NEWS_FEEDS = [
  { source: 'InfoMoney', url: 'https://www.infomoney.com.br/feed/' },
  { source: 'Money Times', url: 'https://www.moneytimes.com.br/feed/' },
  { source: 'Money Times', url: 'https://www.moneytimes.com.br/mercados/feed/' },
];

// Palavras-chave para manter apenas notícias de indicadores macroeconômicos.
const MACRO_KEYWORDS = [
  'ipca', 'inflaç', 'selic', 'copom', 'juros', 'pib', 'focus', 'câmbio', 'cambio',
  'dólar', 'dolar', 'desemprego', 'emprego', 'caged', 'igp-m', 'igpm', 'ibge',
  'balança comercial', 'atividade econômica', 'ibc-br', 'fiscal', 'déficit', 'deficit',
  'superávit', 'superavit', 'banco central', 'bc ', 'taxa de juros', 'varejo',
];
const TESOURO_CSV_URL = 'https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv';
const TESOURO_IPCA_2032_VENCIMENTO = '15/08/2032';

// Próximos 5 vencimentos de janeiro do DI futuro. O contrato de janeiro é o código
// "F" (F=jan) da B3 → DI1F27, DI1F28, ... (fonte: ferramenta de Juros Futuros do InfoMoney)
function nextJanuaryDiContracts() {
  const year = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => {
    const yy = String(year + 1 + i).slice(-2);
    return { label: `DI Jan/${yy}`, code: `DI1F${yy}` };
  });
}

const cache = {
  updatedAt: null,
  quotesUpdatedAt: null,
  slowUpdatedAt: null,
  groups: {},
  brasilRates: {
    ipca: null,
    tesouroIpca2032: null,
    diCurve: nextJanuaryDiContracts().map(({ label }) => ({
      label,
      unavailable: true,
      reason: 'Aguardando cotação do DI futuro (InfoMoney)',
    })),
  },
  cpi: {
    unavailable: true,
    reason: 'BLS CPI requer chave de API e é publicado mensalmente — não implementado',
  },
  news: [],
  macroNews: [],
  companyNews: [],
  calendar: [],
  worldIndices: [],
  realRates: [],
  errors: [],
};

// range das marcas de acento (U+0300–U+036F) que sobram após normalize('NFD')
const DIACRITICS = new RegExp('[' + '\\u0300-\\u036f' + ']', 'g');
function normalizeText(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(DIACRITICS, '');
}

// Monta os termos de busca (ticker + nome) de cada empresa da B3 acompanhada no dashboard.
const FOLLOWED_COMPANIES = (() => {
  const list = [];
  for (const group of GROUPS) {
    for (const item of group.items) {
      if (!item.symbol.endsWith('.SA')) continue; // só ações da B3
      const ticker = item.symbol.replace('.SA', '');
      const matchers = [normalizeText(ticker)]; // ticker é muito específico, quase sem falso positivo
      const name = normalizeText(item.label.replace(/\(.*?\)/g, '').trim());
      // só usa o nome como termo se for longo o bastante (evita "tim", "csn", "irb", "vale"...)
      if (name.length >= 6) matchers.push(name);
      list.push({ ticker, matchers: [...new Set(matchers)] });
    }
  }
  // regex com limite de palavra para cada termo
  return list.map((c) => ({
    ticker: c.ticker,
    regexes: c.matchers.map((m) => new RegExp(`\\b${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)),
  }));
})();

// `fromSeries`: usa o último fechamento da série em vez de meta.regularMarketPrice.
// Necessário para índices como o TIO=F (minério), cujo campo de cotação do Yahoo está
// parado em 2021 embora a série diária continue atualizada. Devolve também a data
// desse fechamento, para o painel deixar claro que não é preço intradiário.
async function fetchQuote(symbol, fromSeries = false) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=10d`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta) throw new Error(`Yahoo ${symbol}: sem dados retornados`);

  if (fromSeries) {
    const stamps = result?.timestamp || [];
    const raw = result?.indicators?.quote?.[0]?.close || [];
    const pts = [];
    for (let i = 0; i < raw.length; i++) {
      if (typeof raw[i] === 'number') pts.push({ close: raw[i], ts: stamps[i] });
    }
    if (pts.length === 0) throw new Error(`Yahoo ${symbol}: série vazia`);
    const last = pts[pts.length - 1];
    const prev = pts.length > 1 ? pts[pts.length - 2].close : null;
    const d = new Date(last.ts * 1000);
    const refDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return {
      price: last.close,
      changePct: prev ? ((last.close - prev) / prev) * 100 : 0,
      currency: meta.currency ?? null,
      refDate, // marca que o valor é de fechamento
    };
  }

  if (typeof meta.regularMarketPrice !== 'number') {
    throw new Error(`Yahoo ${symbol}: sem preço`);
  }
  const price = meta.regularMarketPrice;
  // meta.chartPreviousClose NÃO é o fechamento da sessão anterior — é o fechamento
  // anterior ao início da janela "range" pedida (aqui, 5 dias atrás), então fica
  // desatualizado e distorce o %. A penúltima barra da série diária é o fechamento
  // real da sessão anterior (a última barra é a sessão corrente/hoje).
  const closes = (result?.indicators?.quote?.[0]?.close || []).filter((c) => typeof c === 'number');
  const prevClose = closes.length >= 2 ? closes[closes.length - 2] : meta.previousClose;
  const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
  return { price, changePct, currency: meta.currency ?? null };
}

// Reduz a série a no máximo `max` pontos, para o sparkline não inflar o JSON.
function downsample(values, max) {
  if (values.length <= max) return values;
  const step = values.length / max;
  return Array.from({ length: max }, (_, i) => values[Math.floor(i * step)]);
}

// Índices mundiais: usa janela intradiária de 2 dias, que serve tanto para a cotação
// atual quanto para o mini-gráfico ("2 dias") do formato solicitado.
async function fetchIndexQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=30m&range=2d`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta || typeof meta.regularMarketPrice !== 'number') {
    throw new Error(`Yahoo ${symbol}: sem dados retornados`);
  }
  const price = meta.regularMarketPrice;
  // aqui previousClose é o fechamento do pregão anterior (janela de 2 dias)
  const prevClose = meta.previousClose ?? meta.chartPreviousClose;
  const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
  const closes = (result?.indicators?.quote?.[0]?.close || []).filter((c) => typeof c === 'number');
  const spark = downsample(closes, 40).map((n) => +n.toFixed(2));
  return { price, changePct, spark };
}

// Histórico de 12 meses (semanal) para o mini-gráfico de tendência ao lado de cada
// ação. Fica no ciclo lento: um gráfico anual não muda no intraday, e assim evitamos
// ~53 requisições extras a cada 30s.
const historySpark = new Map(); // symbol -> número[]
const historyBase = new Map();  // symbol -> fechamento de ~12 meses atrás

async function fetchYearSpark(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1wk&range=1y`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Yahoo hist ${symbol}: HTTP ${res.status}`);
  const json = await res.json();
  const closes = (json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [])
    .filter((c) => typeof c === 'number');
  if (closes.length < 2) throw new Error(`Yahoo hist ${symbol}: série curta`);
  // base = primeiro fechamento da janela de 1 ano, usado para a variação de 12 meses
  return { spark: downsample(closes, 40).map((n) => +n.toFixed(2)), base: closes[0] };
}

async function refreshHistory() {
  const symbols = [];
  for (const group of GROUPS) {
    for (const item of group.items) {
      // ações (B3 e as americanas da MAG7) — índices e commodities ficam de fora
      if (item.symbol.endsWith('.SA') || item.icon) symbols.push(item.symbol);
    }
  }
  let falhas = 0;
  await mapWithConcurrency(symbols, 5, async (symbol) => {
    try {
      const { spark, base } = await fetchYearSpark(symbol);
      historySpark.set(symbol, spark);
      historyBase.set(symbol, base);
    } catch {
      falhas += 1; // mantém o histórico anterior, se houver
    }
  });
  if (falhas === symbols.length) throw new Error('Histórico 12m: todas as ações falharam');
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const current = idx++;
      try {
        results[current] = await fn(items[current]);
      } catch (err) {
        results[current] = { ...items[current], error: err.message };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function refreshMarketData() {
  for (const group of GROUPS) {
    const results = await mapWithConcurrency(group.items, 6, async (item) => {
      const quote = await fetchQuote(item.symbol, item.fromSeries);
      // variação de 12 meses: preço atual contra o fechamento de ~1 ano atrás
      const base = historyBase.get(item.symbol);
      const chg12m = (base && typeof quote.price === 'number')
        ? +(((quote.price - base) / base) * 100).toFixed(1)
        : null;
      return { ...item, ...quote, spark: historySpark.get(item.symbol) || null, chg12m };
    });
    cache.groups[group.title] = results;
  }

  // índices mundiais (com mini-gráfico de 2 dias)
  const regions = [];
  for (const region of WORLD_INDICES) {
    const items = await mapWithConcurrency(region.items, 6, async (item) => {
      const quote = await fetchIndexQuote(item.symbol);
      return { ...item, ...quote };
    });
    regions.push({ region: region.region, items });
  }
  cache.worldIndices = regions;

  cache.quotesUpdatedAt = new Date().toISOString();
  cache.updatedAt = new Date().toISOString();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A API do BCB (SGS) oscila e às vezes devolve HTML/XML de erro no lugar do JSON.
// Tenta algumas vezes antes de desistir.
async function fetchJsonWithRetry(url, label, tries = 3, timeoutMs = 30000) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs), // evita ficar pendurado se a origem travar
      });
      if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
      const text = await res.text();
      const trimmed = text.trimStart();
      if (trimmed.startsWith('<')) throw new Error(`${label}: resposta não-JSON (serviço instável)`);
      return JSON.parse(text);
    } catch (err) {
      lastErr = err;
      if (i < tries - 1) await sleep(800 * (i + 1));
    }
  }
  throw lastErr;
}

async function refreshIpca() {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${IPCA_SGS_SERIES}/dados/ultimos/2?formato=json`;
  const data = await fetchJsonWithRetry(url, 'BCB IPCA');
  if (!Array.isArray(data) || data.length === 0) throw new Error('BCB IPCA: sem dados');
  const last = parseFloat(data[data.length - 1].valor.replace(',', '.'));
  const prev = data.length > 1 ? parseFloat(data[data.length - 2].valor.replace(',', '.')) : null;
  cache.brasilRates.ipca = {
    label: 'IPCA',
    value: last,
    changePP: prev !== null ? +(last - prev).toFixed(2) : null,
    refDate: data[data.length - 1].data,
  };
}

// CPI dos EUA via API pública v1 do BLS (não exige chave). Série CUUR0000SA0 =
// CPI-U, todos os itens, média das cidades dos EUA. A API devolve o ÍNDICE, então
// calculamos a variação em 12 meses (equivalente ao IPCA acumulado que exibimos).
// A v1 limita ~25 requisições/dia por IP e o dado é mensal — por isso o cache longo.
const BLS_CPI_URL = 'https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0';
const CPI_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastCpiFetch = 0;

async function refreshCpi() {
  const fresh = typeof cache.cpi?.value === 'number';
  if (fresh && Date.now() - lastCpiFetch < CPI_MIN_INTERVAL_MS) return; // respeita o limite diário
  const data = await fetchJsonWithRetry(BLS_CPI_URL, 'BLS CPI', 2, 45000);
  const series = data?.Results?.series?.[0]?.data;
  if (!Array.isArray(series) || series.length === 0) throw new Error('BLS CPI: sem dados');

  const byPeriod = new Map();
  const valid = [];
  for (const p of series) {
    const v = parseFloat(p.value);
    if (!Number.isFinite(v)) continue; // o BLS usa "-" quando o dado não existe
    byPeriod.set(`${p.year}-${p.period}`, v);
    valid.push(p);
  }
  const yoy = (p) => {
    const cur = byPeriod.get(`${p.year}-${p.period}`);
    const base = byPeriod.get(`${Number(p.year) - 1}-${p.period}`);
    if (!cur || !base) return null;
    return ((cur / base) - 1) * 100;
  };

  const last = valid[0];
  const lastYoY = last ? yoy(last) : null;
  if (lastYoY === null) throw new Error('BLS CPI: sem base de 12 meses');
  const prevYoY = valid[1] ? yoy(valid[1]) : null;

  cache.cpi = {
    label: 'CPI',
    value: +lastYoY.toFixed(2),
    changePP: prevYoY !== null ? +(lastYoY - prevYoY).toFixed(2) : null,
    refDate: `${last.periodName}/${last.year}`,
  };
  lastCpiFetch = Date.now();
}

// CSV simples com suporte a campos entre aspas (o BIS traz vírgulas dentro do título).
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const rows = lines.map((line) => {
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
        } else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return cells;
  });
  const header = rows.shift() || [];
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

async function fetchCsv(url, label) {
  const res = await fetch(url, {
    // a API da OCDE devolve 500 ("languageTag") sem Accept-Language
    headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return parseCsv(await res.text());
}

// Desemprego dos EUA (Alpha Vantage, mensal). A chave vem do ambiente — o repositório
// é público, então ela nunca entra no código. Sem chave, a coluna fica vazia.
// O plano gratuito permite 25 requisições/dia; como o dado é mensal, cacheamos 12h.
const ALPHA_KEY = process.env.ALPHAVANTAGE_KEY || '';
const UNEMP_MIN_INTERVAL_MS = 12 * 60 * 60 * 1000;
let lastUnempFetch = 0;
let usUnemployment = null; // { value, date }

async function refreshUnemployment() {
  // falha explícita: sem isso a coluna some sem explicação e é difícil diagnosticar
  if (!ALPHA_KEY) throw new Error('Desemprego EUA: falta a variável ALPHAVANTAGE_KEY (Render → Environment)');
  if (usUnemployment && Date.now() - lastUnempFetch < UNEMP_MIN_INTERVAL_MS) return;
  const url = `https://www.alphavantage.co/query?function=UNEMPLOYMENT&apikey=${ALPHA_KEY}`;
  const data = await fetchJsonWithRetry(url, 'Alpha Vantage desemprego', 2, 30000);
  if (data?.Note || data?.Information) {
    throw new Error('Alpha Vantage: limite de requisições atingido');
  }
  const first = data?.data?.[0];
  const v = parseFloat(first?.value);
  if (!Number.isFinite(v)) throw new Error('Alpha Vantage: sem dado de desemprego');
  usUnemployment = { value: +v.toFixed(1), date: String(first.date).slice(0, 7) };
  lastUnempFetch = Date.now();
}

// PIB anual (crescimento %) dos 8 países, via World Bank Data360
const gdpByCountry = new Map();

async function refreshGdp() {
  const data = await fetchJsonWithRetry(WB_GDP_URL, 'World Bank PIB', 2, 45000);
  const rows = data?.value || [];
  if (rows.length === 0) throw new Error('World Bank PIB: sem dados');
  const latest = new Map();
  for (const r of rows) {
    const v = parseFloat(r.OBS_VALUE);
    const year = String(r.TIME_PERIOD || '');
    if (!Number.isFinite(v) || !year) continue;
    const cur = latest.get(r.REF_AREA);
    if (!cur || year > cur.year) latest.set(r.REF_AREA, { value: v, year });
  }
  gdpByCountry.clear();
  for (const [area, info] of latest) {
    gdpByCountry.set(area, { value: +info.value.toFixed(2), year: info.year });
  }
}

// Juros reais pela fórmula de Fisher: (1+i)/(1+π) − 1
async function refreshRealRates() {
  const [bisRows, oecdRows, irltRows, y30Map] = await Promise.all([
    fetchCsv(BIS_CBPOL_URL, 'BIS taxas'),
    fetchCsv(OECD_CPI_URL, 'OCDE inflação'),
    fetchCsv(OECD_IRLT_URL, 'OCDE juros 10a'),
    // 30 anos só existe para os EUA (^TYX)
    (async () => {
      const out = new Map();
      await Promise.all(REAL_RATE_COUNTRIES.filter((c) => c.y30).map(async (c) => {
        try {
          const q = await fetchQuote(c.y30);
          out.set(c.oecd, q.price);
        } catch { /* mantém vazio se falhar */ }
      }));
      return out;
    })(),
  ]);

  // IRLT mensal (a base traz também séries trimestrais e anuais)
  const tenY = new Map();
  for (const r of irltRows) {
    if (r.MEASURE !== 'IRLT' || r.FREQ !== 'M') continue;
    const v = parseFloat(r.OBS_VALUE);
    if (Number.isFinite(v)) tenY.set(r.REF_AREA, v);
  }
  const policy = new Map();
  for (const r of bisRows) {
    const v = parseFloat(r.OBS_VALUE);
    if (Number.isFinite(v)) policy.set(r.REF_AREA, { value: v, date: r.TIME_PERIOD });
  }
  const inflation = new Map();
  for (const r of oecdRows) {
    const v = parseFloat(r.OBS_VALUE);
    if (Number.isFinite(v)) inflation.set(r.REF_AREA, { value: v, period: r.TIME_PERIOD });
  }

  cache.realRates = REAL_RATE_COUNTRIES.map((c) => {
    const p = policy.get(c.bis);
    const inf = inflation.get(c.oecd);
    if (!p || !inf) return { label: c.label, flag: c.flag, unavailable: true };
    const real = ((1 + p.value / 100) / (1 + inf.value / 100) - 1) * 100;
    // Brasil: prefixado do Tesouro (nominal). A série da OCDE não confere com a
    // curva local, então nunca caímos de volta nela para o Brasil.
    const y10 = c.oecd === 'BRA' ? brasil10yNominal?.value : tenY.get(c.oecd);
    const y30 = y30Map.get(c.oecd);
    const gdp = gdpByCountry.get(c.wb || c.oecd);
    const unemp = c.oecd === 'USA' ? usUnemployment : null; // só os EUA por enquanto
    return {
      label: c.label,
      flag: c.flag,
      gdp: gdp ? gdp.value : null,
      gdpYear: gdp ? gdp.year : null,
      unemp: unemp ? unemp.value : null,
      unempDate: unemp ? unemp.date : null,
      policy: +p.value.toFixed(2),
      inflation: +inf.value.toFixed(2),
      real: +real.toFixed(2),
      y10: Number.isFinite(y10) ? +y10.toFixed(2) : null,
      y30: Number.isFinite(y30) ? +y30.toFixed(2) : null,
      period: inf.period, // mês de referência da inflação (o mais defasado dos dois)
    };
  });
}

// 10 anos nominal do Brasil, extraído do mesmo CSV (título prefixado com vencimento
// mais próximo de hoje + 10 anos). A série "long-term" da OCDE para o Brasil não
// reconcilia com a curva local (dava 9,13% com a Selic a 14,25% e o DI Jan/31 a 14,6%),
// aparentemente por ser uma taxa real — por isso o Brasil usa esta fonte.
let brasil10yNominal = null;

const parseBrDate = (s) => {
  const [d, m, y] = s.split('/').map(Number);
  return new Date(y, m - 1, d);
};

async function refreshTesouroIpca2032() {
  const res = await fetch(TESOURO_CSV_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Tesouro Transparente: HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split('\n');
  const ipcaRows = [];
  const prefixados = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const isIpca = line.startsWith('Tesouro IPCA+;'); // exclui "com Juros Semestrais"
    const isPrefixado = line.startsWith('Tesouro Prefixado'); // LTN e NTN-F: nominais
    if (!isIpca && !isPrefixado) continue;
    const cols = line.split(';');
    const taxa = parseFloat((cols[3] || '').replace(',', '.'));
    if (!Number.isFinite(taxa)) continue;
    if (isIpca && cols[1] === TESOURO_IPCA_2032_VENCIMENTO) {
      ipcaRows.push({ base: cols[2], taxaCompra: taxa });
    } else if (isPrefixado) {
      prefixados.push({ venc: cols[1], base: cols[2], taxa });
    }
  }
  if (ipcaRows.length === 0) {
    throw new Error(`Tesouro IPCA+ ${TESOURO_IPCA_2032_VENCIMENTO}: não encontrado no CSV`);
  }
  ipcaRows.sort((a, b) => parseBrDate(b.base) - parseBrDate(a.base));
  const last = ipcaRows[0];
  const prev = ipcaRows[1];
  cache.brasilRates.tesouroIpca2032 = {
    label: 'Tesouro IPCA+ 2032',
    value: last.taxaCompra,
    changePP: prev ? +(last.taxaCompra - prev.taxaCompra).toFixed(2) : null,
    refDate: last.base,
  };

  // prefixado mais próximo de 10 anos, na data base mais recente
  const baseAtual = last.base;
  const alvo = new Date();
  alvo.setFullYear(alvo.getFullYear() + 10);
  let melhor = null;
  for (const p of prefixados) {
    if (p.base !== baseAtual) continue;
    const dist = Math.abs(parseBrDate(p.venc) - alvo);
    if (!melhor || dist < melhor.dist) melhor = { ...p, dist };
  }
  brasil10yNominal = melhor ? { value: melhor.taxa, venc: melhor.venc } : null;
}

// ---- DI futuro (curva de juros) via ferramenta de Juros Futuros do InfoMoney ----
const DI_TOOL_URL = 'https://www.infomoney.com.br/ferramentas/juros-futuros-di/';
const DI_AJAX_URL = 'https://www.infomoney.com.br/wp-admin/admin-ajax.php';
let diNonce = null; // nonce do WordPress; fica no HTML da ferramenta e é reaproveitado

async function fetchDiNonce() {
  const res = await fetch(DI_TOOL_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`DI nonce: HTTP ${res.status}`);
  const html = await res.text();
  const m = html.match(/"di_futuro_cotacoes_nonce":"([a-f0-9]+)"/);
  if (!m) throw new Error('DI: nonce não encontrado na página');
  return m[1];
}

async function fetchDiRows(nonce) {
  const body = new URLSearchParams({
    action: 'tool_contratos_di_futuro',
    di_futuro_cotacoes_nonce: nonce,
  });
  const res = await fetch(DI_AJAX_URL, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
  });
  if (!res.ok) throw new Error(`DI ajax: HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

function parseNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function refreshDiFutures() {
  if (!diNonce) diNonce = await fetchDiNonce();
  let rows = await fetchDiRows(diNonce);
  if (!rows.length) {
    // nonce pode ter expirado — renova e tenta de novo
    diNonce = await fetchDiNonce();
    rows = await fetchDiRows(diNonce);
  }
  if (!rows.length) throw new Error('DI futuros: sem dados');
  // linha: [código, vencimento, taxa, variação(p.p.), data/hora, volume]
  const byCode = new Map();
  for (const r of rows) {
    const code = String(r[0] || '').trim();
    if (code) byCode.set(code, { rate: parseNum(r[2]), change: parseNum(r[3]) });
  }
  cache.brasilRates.diCurve = nextJanuaryDiContracts().map(({ label, code }) => {
    const hit = byCode.get(code);
    if (!hit || hit.rate === null) {
      return { label, unavailable: true, reason: `Contrato ${code} sem cotação` };
    }
    return { label, value: hit.rate, changePP: hit.change, decimals: 3 };
  });
}

const xmlParser = new XMLParser({ ignoreAttributes: false });

function decodeEntities(str) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => (name in named ? named[name] : m));
}

function extractText(value) {
  let text;
  if (typeof value === 'string') text = value;
  else if (value && typeof value === 'object') text = value['#cdata-section'] ?? value['#text'] ?? '';
  else text = String(value ?? '');
  return decodeEntities(text).trim();
}

async function fetchFeed(feed) {
  const res = await fetch(feed.url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${feed.source}: HTTP ${res.status}`);
  const xml = await res.text();
  const parsed = xmlParser.parse(xml);
  const items = parsed?.rss?.channel?.item ?? [];
  const list = Array.isArray(items) ? items : [items];
  return list.map((item) => ({
    title: extractText(item.title),
    link: extractText(item.link),
    pubDate: extractText(item.pubDate),
    source: feed.source,
    // descrição (sem HTML) usada apenas para casar com as empresas acompanhadas
    desc: extractText(item.description).replace(/<[^>]+>/g, ' '),
  }));
}

// Busca vários feeds, junta até `perFeed` de cada, remove duplicatas por título e
// ordena pelos mais recentes.
async function collectFeeds(feeds, perFeed, label) {
  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const merged = [];
  const failures = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') merged.push(...r.value.slice(0, perFeed));
    else failures.push(feeds[i].source);
  });
  if (merged.length === 0) {
    throw new Error(`${label}: falha em ${failures.join(', ') || 'todos os feeds'}`);
  }
  const seen = new Set();
  const unique = merged.filter((n) => {
    const key = n.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => (new Date(b.pubDate).getTime() || 0) - (new Date(a.pubDate).getTime() || 0));
  return unique;
}

const stripDesc = ({ desc, ...rest }) => rest; // remove a descrição antes de enviar ao cliente

async function refreshNews() {
  cache.news = (await collectFeeds(NEWS_FEEDS, 6, 'Notícias')).slice(0, 10).map(stripDesc);
}

async function refreshMacroNews() {
  const all = await collectFeeds(MACRO_NEWS_FEEDS, 10, 'Notícias macro');
  const isMacro = (n) => {
    const t = n.title.toLowerCase();
    return MACRO_KEYWORDS.some((kw) => t.includes(kw));
  };
  const filtered = all.filter(isMacro);
  // se o filtro por palavra-chave deixar poucos itens, usa o feed macro completo
  cache.macroNews = (filtered.length >= 5 ? filtered : all).slice(0, 10).map(stripDesc);
}

function stripMatchFields(n) {
  return { title: n.title, link: n.link, pubDate: n.pubDate, source: n.source, ticker: n.ticker };
}

async function refreshCompanyNews() {
  const all = await collectFeeds(COMPANY_NEWS_FEEDS, 15, 'Notícias de empresas');
  const matched = [];
  for (const n of all) {
    const text = normalizeText(`${n.title} ${n.desc || ''}`);
    const hits = FOLLOWED_COMPANIES.filter((c) => c.regexes.some((re) => re.test(text)));
    if (hits.length > 0) {
      matched.push({ ...n, ticker: hits.map((h) => h.ticker).join(', ') });
    }
  }
  cache.companyNews = matched.slice(0, 12).map(stripMatchFields);
}

function toIsoDay(d) {
  return d.toISOString().slice(0, 10);
}

async function refreshCalendar() {
  const hoje = new Date();
  const ate = new Date(hoje.getTime() + 75 * 24 * 60 * 60 * 1000); // ~2,5 meses à frente
  const url = `${IBGE_CALENDAR_URL}?de=${toIsoDay(hoje)}&ate=${toIsoDay(ate)}&qtd=100`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Calendário IBGE: HTTP ${res.status}`);
  const data = await res.json();
  const items = data?.items ?? [];
  const events = [];
  for (const it of items) {
    const titulo = normalizeText(it.titulo);
    const map = CALENDAR_LABELS.find((c) => titulo.includes(c.match));
    if (!map) continue; // mantém só os principais indicadores
    const [dia] = String(it.data_divulgacao).split(' '); // "dd/MM/yyyy HH:mm:ss"
    events.push({ date: dia, label: map.label, tag: map.tag, fullTitle: it.titulo });
  }
  const parse = (s) => {
    const [d, m, y] = s.split('/').map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  events.sort((a, b) => parse(a.date) - parse(b.date));
  cache.calendar = events.slice(0, 12);
}

async function refreshSlowData() {
  // O CSV do Tesouro alimenta o IPCA+ 2032 e o 10 anos nominal do Brasil, que
  // refreshRealRates consome — por isso roda antes.
  const tesouro = await Promise.allSettled([refreshTesouroIpca2032()]);
  const jobs = await Promise.allSettled([
    refreshIpca(),
    refreshCpi(),
    // PIB e desemprego alimentam a tabela de juros reais, então vêm antes dela.
    // Falhas neles não impedem a tabela: as colunas só ficam vazias.
    (async () => {
      const erros = [];
      for (const job of [refreshGdp, refreshUnemployment]) {
        try { await job(); } catch (e) { erros.push(e.message); }
      }
      await refreshRealRates();
      if (erros.length) throw new Error(erros.join(' | '));
    })(),
    refreshDiFutures(),
    refreshHistory(),
    refreshNews(),
    refreshMacroNews(),
    refreshCompanyNews(),
    refreshCalendar(),
  ]);
  cache.errors = [...tesouro, ...jobs].filter((r) => r.status === 'rejected').map((r) => r.reason.message);
  cache.slowUpdatedAt = new Date().toISOString();
  cache.updatedAt = new Date().toISOString();
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/data', (req, res) => {
  res.json(cache);
});

app.listen(PORT, async () => {
  console.log(`Market dashboard rodando em http://localhost:${PORT}`);
  await Promise.allSettled([refreshMarketData(), refreshSlowData()]);
  setInterval(() => {
    refreshMarketData().catch((err) => console.error('Erro ao atualizar cotações:', err.message));
  }, 30_000);
  setInterval(() => {
    refreshSlowData().catch((err) => console.error('Erro ao atualizar dados lentos:', err.message));
  }, 30 * 60 * 1000);
});
