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
    { symbol: 'EWZ', label: 'EWZ (MSCI Brazil)', prePost: true },
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
// `tz`/`abre`/`fecha`: fuso e pregão regular de cada praça, para o relógio e o
// indicador de aberto/fechado exibidos na própria tabela.
  { region: 'Américas', items: [
    { symbol: '^DJI', label: 'Dow Jones', flag: 'us', tz: 'America/New_York', abre: '09:30', fecha: '16:00' },
    { symbol: '^GSPC', label: 'S&P 500', flag: 'us', tz: 'America/New_York', abre: '09:30', fecha: '16:00' },
    { symbol: '^IXIC', label: 'Nasdaq', flag: 'us', tz: 'America/New_York', abre: '09:30', fecha: '16:00' },
    { symbol: '^GSPTSE', label: 'S&P/TSX Comp', flag: 'ca', tz: 'America/Toronto', abre: '09:30', fecha: '16:00' },
    { symbol: '^MXX', label: 'S&P/BMV IPC', flag: 'mx', tz: 'America/Mexico_City', abre: '08:30', fecha: '15:00' },
    { symbol: '^BVSP', label: 'Ibovespa', flag: 'br', tz: 'America/Sao_Paulo', abre: '10:00', fecha: '17:00' },
    { symbol: '^IPSA', label: 'Chile IPSA', flag: 'cl', tz: 'America/Santiago', abre: '09:30', fecha: '17:00' },
    { symbol: '^MERV', label: 'ARG MERVAL', flag: 'ar', tz: 'America/Argentina/Buenos_Aires', abre: '11:00', fecha: '17:00' },
    { symbol: '^SPBLPGPT', label: 'Peru S&P/BVL', flag: 'pe', tz: 'America/Lima', abre: '09:00', fecha: '15:00' },
  ]},
  { region: 'EMEA', items: [
    { symbol: '^STOXX50E', label: 'Euro Stoxx 50', flag: 'eu', tz: 'Europe/Berlin', abre: '09:00', fecha: '17:30' },
    { symbol: '^FTSE', label: 'FTSE 100', flag: 'gb', tz: 'Europe/London', abre: '08:00', fecha: '16:30' },
    { symbol: '^FCHI', label: 'CAC 40', flag: 'fr', tz: 'Europe/Paris', abre: '09:00', fecha: '17:30' },
    { symbol: '^GDAXI', label: 'DAX', flag: 'de', tz: 'Europe/Berlin', abre: '09:00', fecha: '17:30' },
  ]},
  { region: 'Ásia/Pacífico', items: [
    { symbol: '^N225', label: 'Nikkei', flag: 'jp', tz: 'Asia/Tokyo', abre: '09:00', fecha: '15:00' },
    { symbol: '^HSI', label: 'Hang Seng', flag: 'hk', tz: 'Asia/Hong_Kong', abre: '09:30', fecha: '16:00' },
    { symbol: '000300.SS', label: 'CSI 300', flag: 'cn', tz: 'Asia/Shanghai', abre: '09:30', fecha: '15:00' },
    { symbol: '^AXJO', label: 'S&P/ASX 200', flag: 'au', tz: 'Australia/Sydney', abre: '10:00', fecha: '16:00' },
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
  fearGreed: null,
  sentimentoBr: null,
  agendaEmpresas: { de: null, ate: null, eventos: [] },
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
  return {
    spark: downsample(closes, 40).map((n) => +n.toFixed(2)),
    base: closes[0],
    closes, // série completa: alimenta o termômetro de sentimento
  };
}

// Posição do último valor dentro da faixa de 12 meses, em 0..100.
// 0 = na mínima do ano, 100 = na máxima.
function posicaoNaFaixa(closes) {
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  if (!(max > min)) return null;
  return ((closes[closes.length - 1] - min) / (max - min)) * 100;
}

const media = (a) => a.reduce((s, x) => s + x, 0) / a.length;

// Desvio-padrão dos retornos (volatilidade realizada) de uma série de fechamentos.
function volatilidade(closes) {
  const r = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) r.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  if (r.length < 2) return null;
  const m = media(r);
  return Math.sqrt(media(r.map((x) => (x - m) ** 2)));
}

const clamp100 = (v) => Math.max(0, Math.min(100, v));

// ---- Termômetro de sentimento da B3 (metodologia própria) ----
// Quatro componentes, cada um normalizado em 0..100 (0 = pânico, 100 = otimismo):
//   Momento     posição do Ibovespa na sua faixa de 12 meses
//   Força       posição média das ações na faixa de 12 meses delas
//   Amplitude   % de ações acima da própria média de 12 meses
//   Calmaria    volatilidade recente vs. a do ano (menos volatilidade = mais confiança)
// Tudo derivado das séries do Yahoo que já buscamos — sem fonte nova.
function calcSentimentoBr(historicoAcoes, ibovCloses) {
  const comp = {};

  if (ibovCloses && ibovCloses.length > 10) {
    comp.momento = posicaoNaFaixa(ibovCloses);
    const recente = ibovCloses.slice(-9);           // ~2 meses (semanal)
    const volRec = volatilidade(recente);
    const volAno = volatilidade(ibovCloses);
    if (volRec !== null && volAno > 0) {
      // razão 0,5 (bem calmo) -> 100 ; 1,5 (bem agitado) -> 0
      comp.calmaria = clamp100(((1.5 - volRec / volAno) / 1.0) * 100);
    }
  }

  const posicoes = [];
  let acimaDaMedia = 0;
  let total = 0;
  for (const closes of historicoAcoes) {
    if (!closes || closes.length < 10) continue;
    const p = posicaoNaFaixa(closes);
    if (p !== null) posicoes.push(p);
    total += 1;
    if (closes[closes.length - 1] > media(closes)) acimaDaMedia += 1;
  }
  if (posicoes.length) comp.forca = media(posicoes);
  if (total) comp.amplitude = (acimaDaMedia / total) * 100;

  const valores = Object.values(comp).filter((v) => Number.isFinite(v));
  if (valores.length < 3) return null; // sem componentes suficientes, não publica
  return {
    score: +media(valores).toFixed(1),
    componentes: Object.fromEntries(Object.entries(comp).map(([k, v]) => [k, +v.toFixed(0)])),
    base: total,
  };
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
  const seriesB3 = [];
  await mapWithConcurrency(symbols, 5, async (symbol) => {
    try {
      const { spark, base, closes } = await fetchYearSpark(symbol);
      historySpark.set(symbol, spark);
      historyBase.set(symbol, base);
      if (symbol.endsWith('.SA')) seriesB3.push(closes); // termômetro usa só a B3
    } catch {
      falhas += 1; // mantém o histórico anterior, se houver
    }
  });
  if (falhas === symbols.length) throw new Error('Histórico 12m: todas as ações falharam');

  // termômetro da B3: precisa também da série do Ibovespa
  let ibov = null;
  try {
    ibov = (await fetchYearSpark('^BVSP')).closes;
  } catch { /* sem o Ibovespa o índice usa só os componentes de ações */ }
  cache.sentimentoBr = calcSentimentoBr(seriesB3, ibov);
}

// Pré-abertura / after-market. O `meta` do Yahoo não traz o preço estendido pronto,
// mas com includePrePost a série passa a conter os candles fora do pregão: o último
// ponto posterior ao fechamento regular é a cotação estendida.
async function fetchPrePost(symbol, precoRegular) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
      + '?interval=1m&range=1d&includePrePost=true';
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return {};
    const result = (await res.json())?.chart?.result?.[0];
    const meta = result?.meta;
    // Referência é o instante do último negócio regular — não o fim do pregão de hoje,
    // que na pré-abertura ainda está no futuro (e filtraria todos os candles).
    const fimRegular = meta?.regularMarketTime;
    const stamps = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    if (!fimRegular || stamps.length === 0) return {};

    // último candle depois do encerramento do pregão regular
    let preco = null;
    let quando = null;
    for (let i = stamps.length - 1; i >= 0; i--) {
      if (stamps[i] > fimRegular && typeof closes[i] === 'number') {
        preco = closes[i];
        quando = stamps[i];
        break;
      }
    }
    const base = typeof precoRegular === 'number' ? precoRegular : meta.regularMarketPrice;
    if (preco === null || !base) return {};
    const d = new Date(quando * 1000);
    const hora = new Intl.DateTimeFormat('pt-BR', {
      timeZone: meta.exchangeTimezoneName || 'America/New_York',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d);
    return {
      prePrice: +preco.toFixed(2),
      prePct: +(((preco - base) / base) * 100).toFixed(2),
      preHora: hora,
    };
  } catch {
    return {}; // sem pré-abertura o card segue normal
  }
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
      if (item.prePost) Object.assign(quote, await fetchPrePost(item.symbol, quote.price));
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

// Desemprego dos EUA (BLS, mensal). Série LNS14000000 = taxa de desemprego, com ajuste sazonal. Mesma API pública
// do CPI, sem chave: a v1 limita ~25 requisições/dia por IP e o dado é mensal, daí o
// cache de 12h (junto com o CPI, dá menos de 10 chamadas por dia).
const BLS_UNEMP_URL = 'https://api.bls.gov/publicAPI/v1/timeseries/data/LNS14000000';
const UNEMP_MIN_INTERVAL_MS = 12 * 60 * 60 * 1000;
let lastUnempFetch = 0;
let usUnemployment = null; // { value, date }

async function refreshUnemployment() {
  if (usUnemployment && Date.now() - lastUnempFetch < UNEMP_MIN_INTERVAL_MS) return;
  const data = await fetchJsonWithRetry(BLS_UNEMP_URL, 'BLS desemprego', 2, 45000);
  const series = data?.Results?.series?.[0]?.data;
  if (!Array.isArray(series) || series.length === 0) throw new Error('BLS desemprego: sem dados');
  // o BLS usa "-" nos meses sem apuração, então pega o mais recente que seja numérico
  const ultimo = series.find((p) => Number.isFinite(parseFloat(p.value)));
  if (!ultimo) throw new Error('BLS desemprego: sem valor numérico');
  usUnemployment = {
    value: +parseFloat(ultimo.value).toFixed(1),
    date: `${ultimo.year}-${String(ultimo.period).replace(/^M/, '')}`, // "M06" -> "2026-06"
  };
  lastUnempFetch = Date.now();
}

// Fear & Greed Index (CNN). É a API interna do site: exige cabeçalhos de navegador
// (Referer/Origin), senão devolve erro. Atualiza poucas vezes ao dia.
const CNN_FNG_URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';

async function refreshFearGreed() {
  const res = await fetch(CNN_FNG_URL, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://edition.cnn.com/',
      Origin: 'https://edition.cnn.com',
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`CNN Fear & Greed: HTTP ${res.status}`);
  const json = await res.json();
  const fg = json?.fear_and_greed;
  const score = Number(fg?.score);
  if (!Number.isFinite(score)) throw new Error('CNN Fear & Greed: sem score');
  const num = (v) => (Number.isFinite(Number(v)) ? +Number(v).toFixed(1) : null);
  cache.fearGreed = {
    score: +score.toFixed(1),
    rating: String(fg.rating || ''),
    prevClose: num(fg.previous_close),
    week: num(fg.previous_1_week),
    month: num(fg.previous_1_month),
  };
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

// ---- Agenda de eventos das empresas (Supabase) ----
// Lê ac_empresa_eventos e completa nome e papel com ac_empresa e ac_ticker. Não dá para
// pedir o join ao PostgREST porque não existe foreign key entre elas — daí as três
// consultas separadas. Basta a chave anon, desde que as três tabelas tenham uma policy
// de SELECT para o role `anon` (por padrão a RLS delas só libera `authenticated`).
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY
  || process.env.SUPABASE_KEY
  || process.env.SUPABASE_SERVICE_KEY
  || '';
const AGENDA_DIAS = 7; // janela: hoje mais os 6 dias seguintes

async function supabaseSelect(tabela, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${query}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    // O PostgREST explica no corpo o que faltou (grant ausente, policy, coluna
    // inexistente...). Sem isso o erro vira um "HTTP 401" sem pista nenhuma.
    const detalhe = await res.text().then(
      (t) => { try { return JSON.parse(t).message || t; } catch { return t; } },
      () => '',
    );
    throw new Error(`Supabase ${tabela}: HTTP ${res.status}${detalhe ? ` — ${detalhe}` : ''}`);
  }
  return res.json();
}

// Data de hoje no fuso de São Paulo. O servidor no Render roda em UTC, e depois das 21h
// de Brasília a janela pularia um dia se usássemos a data local da máquina.
// 'sv-SE' é o truque de sempre: já formata como YYYY-MM-DD.
function hojeSaoPaulo() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

function somaDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00Z`); // meio-dia evita virar o dia no fuso
  d.setUTCDate(d.getUTCDate() + dias);
  return toIsoDay(d);
}

// A tabela guarda o mesmo evento em duas caixas ("Divulgação resultado" e "Divulgação
// Resultado"), herdadas de cargas diferentes. Unifica o rótulo na exibição.
// `curto` é o que cabe na linha do card; o rótulo inteiro vai no title= da linha.
// As duas últimas entraram numa carga de 24/07/2026 e trazem o horário da divulgação —
// são "divulgação de resultado" com a informação extra de antes/depois do pregão.
const EVENTOS = [
  { prefixo: 'divulgacao resultado', label: 'Divulgação de resultado', curto: 'Divulg.' },
  { prefixo: 'conferencia resultado', label: 'Conferência de resultado', curto: 'Call' },
  { prefixo: 'dia do investidor', label: 'Dia do investidor', curto: 'Inv. Day' },
  { prefixo: 'resultado - apos o fechamento', label: 'Resultado — após o fechamento', curto: 'Após fech.' },
  { prefixo: 'resultado - antes da abertura', label: 'Resultado — antes da abertura', curto: 'Antes abert.' },
];

function rotuloEvento(tipo) {
  const bruto = String(tipo || '').trim();
  const chave = normalizeText(bruto);
  const achado = EVENTOS.find((e) => chave.startsWith(e.prefixo));
  return achado || { label: bruto, curto: bruto };
}

// Papel exibido: de preferência o que o painel já acompanha nos cards de setor, para o
// ticker bater com o resto da tela; senão ON, depois UNIT, depois PN.
const TICKERS_DO_PAINEL = new Set(FOLLOWED_COMPANIES.map((c) => c.ticker));
const ORDEM_TIPO = { ON: 0, UNIT: 1, PN: 2 };

function escolhePapel(papeis) {
  const ativos = papeis.filter((p) => p.ativo !== 'N'); // ODPV3, CPLE5/6... saíram da B3
  const lista = ativos.length ? ativos : papeis;
  return lista.slice().sort((a, b) => {
    const painel = Number(TICKERS_DO_PAINEL.has(b.ticker)) - Number(TICKERS_DO_PAINEL.has(a.ticker));
    if (painel) return painel;
    const tipo = (ORDEM_TIPO[a.tipo_ticker] ?? 9) - (ORDEM_TIPO[b.tipo_ticker] ?? 9);
    if (tipo) return tipo;
    return String(a.ticker).localeCompare(String(b.ticker));
  })[0];
}

// "TAESA UNT" -> "TAESA". Quando o nome é longo a B3 trunca e cola o tipo sem espaço
// ("SANTANDER BRUNT", "ENGIE BRASILON"), por isso o espaço é opcional — e o sufixo
// removido é só o que corresponde ao tipo daquele papel, para não comer as letras
// finais de um nome que por acaso termine em ON/PN. Sem nome_curto, cai no nome de
// mercado (bem mais longo).
const SUFIXO_POR_TIPO = { ON: 'ON', PN: 'PN[AB]?', UNIT: 'UNT' };

function nomeCurtoLimpo(papel, nomeMercado) {
  const bruto = String(papel?.nome_curto || '').trim();
  const sufixo = SUFIXO_POR_TIPO[papel?.tipo_ticker];
  const limpo = sufixo ? bruto.replace(new RegExp(`\\s*${sufixo}$`), '').trim() : bruto;
  return limpo || String(nomeMercado || '').trim();
}

async function refreshAgendaEmpresas() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    cache.agendaEmpresas = {
      unavailable: true,
      reason: 'Defina SUPABASE_URL e SUPABASE_ANON_KEY para carregar a agenda',
    };
    return;
  }
  try {
    await carregaAgendaEmpresas();
  } catch (err) {
    // Sem isto a agenda ficaria no valor inicial e o card diria "sem eventos", que é
    // indistinguível de uma semana realmente vazia. O erro também sobe para a barra.
    cache.agendaEmpresas = { unavailable: true, reason: err.message };
    throw err;
  }
}

async function carregaAgendaEmpresas() {
  const de = hojeSaoPaulo();
  const ate = somaDias(de, AGENDA_DIAS - 1);
  const eventos = await supabaseSelect(
    'ac_empresa_eventos',
    `select=cd_cvm,dt_evento,tipo_evento&dt_evento=gte.${de}&dt_evento=lte.${ate}`,
  );
  if (!eventos.length) {
    cache.agendaEmpresas = { de, ate, eventos: [] };
    return;
  }
  const ids = [...new Set(eventos.map((e) => e.cd_cvm))].join(',');
  const [empresas, papeis] = await Promise.all([
    supabaseSelect('ac_empresa', `select=cd_cvm,nome_mercado&cd_cvm=in.(${ids})`),
    supabaseSelect('ac_ticker', `select=cd_cvm,ticker,tipo_ticker,ativo,nome_curto&cd_cvm=in.(${ids})`),
  ]);
  const nomePorCvm = new Map(empresas.map((e) => [e.cd_cvm, e.nome_mercado]));
  const papeisPorCvm = new Map();
  for (const p of papeis) {
    if (!papeisPorCvm.has(p.cd_cvm)) papeisPorCvm.set(p.cd_cvm, []);
    papeisPorCvm.get(p.cd_cvm).push(p);
  }
  const lista = eventos.map((ev) => {
    const papel = escolhePapel(papeisPorCvm.get(ev.cd_cvm) || []);
    const rotulo = rotuloEvento(ev.tipo_evento);
    return {
      date: ev.dt_evento, // YYYY-MM-DD
      ticker: papel?.ticker || null,
      empresa: nomeCurtoLimpo(papel, nomePorCvm.get(ev.cd_cvm)),
      evento: rotulo.label,
      eventoCurto: rotulo.curto,
    };
  // Parte dos cd_cvm da tabela não existe em ac_empresa nem em ac_ticker (emissores de
  // dívida, companhias fechadas). Sem ticker e sem nome a linha não identifica ninguém
  // — viraria "CVM 19968" em branco —, então fica de fora.
  }).filter((ev) => ev.ticker || ev.empresa);
  // data mais próxima no topo; no mesmo dia, agrupa por evento e depois por ticker
  lista.sort((a, b) => a.date.localeCompare(b.date)
    || a.evento.localeCompare(b.evento)
    || a.ticker.localeCompare(b.ticker));
  cache.agendaEmpresas = { de, ate, eventos: lista };
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
    refreshFearGreed(),
    refreshHistory(),
    refreshNews(),
    refreshMacroNews(),
    refreshCompanyNews(),
    refreshCalendar(),
    refreshAgendaEmpresas(),
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
