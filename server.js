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
    { symbol: 'EWZ', label: 'EWZ - iShares MSCI Brazil ETF' },
  ]},
  { title: 'Commodities', items: [
    { symbol: 'SB=F', label: 'Açúcar NY nº11' },
    { symbol: 'SI=F', label: 'Prata' },
    { symbol: 'GC=F', label: 'Ouro' },
    { symbol: 'CL=F', label: 'Petróleo WTI' },
    { symbol: 'BZ=F', label: 'Petróleo Brent' },
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
    { symbol: 'BBSE3.SA', label: 'BB Seguridade' },
    { symbol: 'CXSE3.SA', label: 'Caixa Seguridade' },
    { symbol: 'PSSA3.SA', label: 'Porto Seguros' },
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
    { symbol: 'GGBR4.SA', label: 'Gerdau (Metalúrgica)' },
    { symbol: 'GOAU4.SA', label: 'Gerdau (Holding)' },
  ]},
  { title: 'Químicos & Petroquímicos', items: [
    { symbol: 'UNIP6.SA', label: 'Unipar' },
    { symbol: 'BRKM3.SA', label: 'Braskem' },
  ]},
];

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

async function fetchQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta || typeof meta.regularMarketPrice !== 'number') {
    throw new Error(`Yahoo ${symbol}: sem dados retornados`);
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
      const quote = await fetchQuote(item.symbol);
      return { ...item, ...quote };
    });
    cache.groups[group.title] = results;
  }
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

async function refreshTesouroIpca2032() {
  const res = await fetch(TESOURO_CSV_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Tesouro Transparente: HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split('\n');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // "Tesouro IPCA+" (título curto, sem cupom semestral) — exclui "Tesouro IPCA+ com Juros Semestrais"
    if (!line.startsWith('Tesouro IPCA+;')) continue;
    const cols = line.split(';');
    if (cols[1] !== TESOURO_IPCA_2032_VENCIMENTO) continue;
    rows.push({ base: cols[2], taxaCompra: parseFloat(cols[3].replace(',', '.')) });
  }
  if (rows.length === 0) {
    throw new Error(`Tesouro IPCA+ ${TESOURO_IPCA_2032_VENCIMENTO}: não encontrado no CSV`);
  }
  const parseDate = (s) => {
    const [d, m, y] = s.split('/').map(Number);
    return new Date(y, m - 1, d);
  };
  rows.sort((a, b) => parseDate(b.base) - parseDate(a.base));
  const last = rows[0];
  const prev = rows[1];
  cache.brasilRates.tesouroIpca2032 = {
    label: 'Tesouro IPCA+ 2032',
    value: last.taxaCompra,
    changePP: prev ? +(last.taxaCompra - prev.taxaCompra).toFixed(2) : null,
    refDate: last.base,
  };
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
  const jobs = await Promise.allSettled([
    refreshIpca(),
    refreshCpi(),
    refreshTesouroIpca2032(),
    refreshDiFutures(),
    refreshNews(),
    refreshMacroNews(),
    refreshCompanyNews(),
    refreshCalendar(),
  ]);
  cache.errors = jobs.filter((r) => r.status === 'rejected').map((r) => r.reason.message);
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
