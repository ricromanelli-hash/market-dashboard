const grid = document.getElementById('grid');
const updatedAtEl = document.getElementById('updatedAt');
const refreshBtn = document.getElementById('refreshBtn');

let lastData = null;          // último payload recebido (para re-render sem refetch)
let newsFilter = 'all';       // 'all' = todas as notícias | 'company' = só minhas empresas

const numberFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function formatPrice(value, currency) {
  if (typeof value !== 'number') return '—';
  const formatted = numberFmt.format(value);
  if (currency === 'BRL') return formatted;
  return formatted;
}

function changeIcon(pct) {
  if (typeof pct !== 'number' || Number.isNaN(pct)) return { cls: 'flat', icon: '—' };
  if (pct > 0) return { cls: 'up', icon: '↗' };
  if (pct < 0) return { cls: 'down', icon: '↘' };
  return { cls: 'flat', icon: '—' };
}

// Logo da empresa via brapi (só ações da B3: PETR4.SA -> icons.brapi.dev/icons/PETR4.svg).
// Alguns tickers não têm ícone (ex.: AXIA3, PASS3); nesse caso escondemos a imagem
// mantendo o espaço, para os nomes continuarem alinhados na coluna.
function logoImg(symbol, icon) {
  // B3: deriva do ticker (PETR4.SA -> PETR4). Outras ações: usa `icon` do backend.
  const ticker = icon || (symbol && symbol.endsWith('.SA') ? symbol.slice(0, -3) : null);
  if (!ticker) return '';
  return `<img class="row-logo" src="https://icons.brapi.dev/icons/${ticker}.svg" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
}

function renderQuoteRow(item) {
  const logo = logoImg(item.symbol, item.icon);
  if (item.error) {
    return `
      <div class="row">
        ${logo}
        <div class="row-label">
          <span class="row-name">${item.label}</span>
          <span class="row-symbol">${item.displaySymbol || item.symbol}</span>
        </div>
        <div class="row-unavailable">indisponível</div>
      </div>`;
  }
  const { cls, icon } = changeIcon(item.changePct);
  // uma casa decimal: encurta a coluna do dia e sobra largura para o mini-gráfico
  const pctText = typeof item.changePct === 'number' ? `${item.changePct >= 0 ? '+' : ''}${item.changePct.toFixed(1)}%` : '—';
  // tendência de 12 meses: verde/vermelho conforme o saldo do período
  const trend = item.spark && item.spark.length > 1
    ? `<span class="row-spark" title="tendência de 12 meses">${sparkline(item.spark, item.spark[item.spark.length - 1] >= item.spark[0])}</span>`
    : '';
  const nome = `<div class="row-label">
        <span class="row-name">${item.label}${item.refDate ? `<span class="row-note" title="não é preço intradiário: último fechamento disponível">fech. ${item.refDate}</span>` : ''}</span>
        <span class="row-symbol">${item.displaySymbol || item.symbol}</span>
      </div>`;
  const preco = `<span class="row-price">${formatPrice(item.price, item.currency)}</span>`;
  const variacao = `<span class="row-change ${cls}">${icon} ${pctText}</span>`;

  // Ações da B3 usam grid de colunas fixas (logo · nome · gráfico · 12m · preço · dia),
  // para os valores ficarem alinhados entre as linhas como numa tabela.
  if (logo) {
    const v12 = typeof item.chg12m === 'number'
      ? `<span class="row-12m ${item.chg12m >= 0 ? 'up' : 'down'}" title="variação em 12 meses">${item.chg12m >= 0 ? '+' : ''}${item.chg12m.toFixed(1)}%</span>`
      : '<span class="row-12m"></span>';
    return `
      <div class="row row-stock">
        ${logo}
        ${nome}
        ${trend || '<span class="row-spark"></span>'}
        ${v12}
        ${preco}
        ${variacao}
      </div>`;
  }

  // pré-abertura / after-market, quando disponível (ex.: EWZ)
  const pre = typeof item.prePrice === 'number'
    ? `<div class="row row-pre">
         <span class="pre-tag">pré-abertura ${item.preHora || ''}</span>
         <span class="row-values">
           <span class="row-price">${formatPrice(item.prePrice, item.currency)}</span>
           <span class="row-change ${item.prePct >= 0 ? 'up' : 'down'}">${item.prePct >= 0 ? '↗ +' : '↘ '}${item.prePct.toFixed(2)}%</span>
         </span>
       </div>`
    : '';

  return `
    <div class="row">
      ${nome}
      <div class="row-values">
        ${preco}
        ${variacao}
      </div>
    </div>${pre}`;
}

function renderRateRow(rate) {
  if (!rate) {
    return `<div class="row"><div class="row-label"><span class="row-name">—</span></div><div class="row-unavailable">carregando…</div></div>`;
  }
  if (rate.unavailable) {
    return `
      <div class="row">
        <div class="row-label"><span class="row-name">${rate.label}</span></div>
        <div class="row-unavailable" title="${rate.reason || ''}">indisponível</div>
      </div>`;
  }
  const { cls, icon } = changeIcon(rate.changePP);
  const ppText = typeof rate.changePP === 'number' ? `${rate.changePP >= 0 ? '+' : ''}${rate.changePP.toFixed(2)} p.p.` : '—';
  const sub = rate.refDate ? `<span class="row-symbol">ref. ${rate.refDate}</span>` : '';
  return `
    <div class="row rate-row">
      <div class="row-label">
        <span class="row-name">${rate.label}</span>
        ${sub}
      </div>
      <div class="row-values">
        <span class="row-price">${rate.value.toFixed(rate.decimals ?? 2)}%</span>
        <span class="row-change ${cls}">${icon} ${ppText}</span>
      </div>
    </div>`;
}

// Mini-gráfico ("2 dias") em SVG, no estilo da tabela de índices mundiais.
function sparkline(values, up) {
  if (!Array.isArray(values) || values.length < 2) return '<span class="spark-empty"></span>';
  const w = 44;
  const h = 15;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = (max - min) || 1;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(' ');
  const stroke = up ? 'var(--green-up)' : 'var(--red-down)';
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="1.3" stroke-linejoin="round"/>
  </svg>`;
}

const idxFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function renderWorldIndicesCard(regions) {
  if (!regions || regions.length === 0) {
    return `<section class="card"><div class="card-header">Índices Mundiais</div>
      <div class="card-body"><p class="row-unavailable" style="padding:12px">carregando…</p></div></section>`;
  }
  const body = regions.map((r) => {
    const rows = (r.items || []).map((it) => {
      const flag = flagImg(it.flag);
      if (it.error || typeof it.price !== 'number') {
        return `<div class="row idx-row">${flag}<span class="idx-name">${it.label}</span>
          <div class="row-unavailable">indisponível</div></div>`;
      }
      const up = (it.changePct ?? 0) >= 0;
      const { cls } = changeIcon(it.changePct);
      const pct = typeof it.changePct === 'number' ? `${it.changePct >= 0 ? '+' : ''}${it.changePct.toFixed(2)}%` : '';
      return `
        <div class="row idx-row">
          ${flag}
          <span class="idx-name">${it.label}</span>
          ${relogioIndice(it)}
          ${sparkline(it.spark, up)}
          <span class="idx-values">
            <span class="idx-price">${idxFmt.format(it.price)}</span>
            <span class="idx-pct ${cls}">${pct}</span>
          </span>
        </div>`;
    }).join('');
    return `<div class="idx-region">${r.region}</div>${rows}`;
  }).join('');
  return `
    <section class="card">
      <div class="card-header">Índices Mundiais</div>
      <div class="card-body">${body}</div>
    </section>`;
}

// Bandeira do país (flagcdn). Emoji de bandeira não renderiza no Windows nem em
// muitos navegadores de TV — apareceria só a sigla ("BR"), por isso usamos imagem.
function flagImg(code, cls = 'idx-flag') {
  if (!code) return `<span class="${cls}"></span>`;
  return `<img class="${cls}" src="https://flagcdn.com/w40/${code}.png" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
}

// Medidor (velocímetro) do Fear & Greed Index, no estilo do gráfico da CNN.
const FNG_FAIXAS = [
  { ate: 25, cor: '#c62828', nome: 'MEDO EXTREMO' },
  { ate: 45, cor: '#ef6c00', nome: 'MEDO' },
  { ate: 55, cor: '#9e9e9e', nome: 'NEUTRO' },
  { ate: 75, cor: '#7cb342', nome: 'GANÂNCIA' },
  { ate: 100, cor: '#1a7f37', nome: 'GANÂNCIA EXTREMA' },
];

// converte um valor 0..100 num ponto do semicírculo (180° = 0, 0° = 100)
function fngPonto(v, raio, cx, cy) {
  const ang = Math.PI * (1 - v / 100);
  return [cx + raio * Math.cos(ang), cy - raio * Math.sin(ang)];
}

function fngArco(de, ate, rInt, rExt, cx, cy) {
  const [x1, y1] = fngPonto(de, rExt, cx, cy);
  const [x2, y2] = fngPonto(ate, rExt, cx, cy);
  const [x3, y3] = fngPonto(ate, rInt, cx, cy);
  const [x4, y4] = fngPonto(de, rInt, cx, cy);
  return `M ${x1} ${y1} A ${rExt} ${rExt} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${rInt} ${rInt} 0 0 0 ${x4} ${y4} Z`;
}

// Um medidor. `titulo` identifica o mercado; `nota` vai no rodapé.
function renderGauge(score, titulo, nota) {
  if (typeof score !== 'number') {
    return `<div class="fng-item"><div class="fng-titulo">${titulo}</div>
      <p class="row-unavailable" style="padding:10px 0">carregando…</p></div>`;
  }
  const cx = 100, cy = 92, rInt = 46, rExt = 82;
  const faixa = FNG_FAIXAS.find((f) => score <= f.ate) || FNG_FAIXAS[FNG_FAIXAS.length - 1];
  let de = 0;
  const arcos = FNG_FAIXAS.map((f) => {
    const d = fngArco(de, f.ate, rInt, rExt, cx, cy);
    const atual = f === faixa;
    de = f.ate;
    return `<path d="${d}" fill="${f.cor}" opacity="${atual ? 1 : 0.28}"/>`;
  }).join('');
  const [px, py] = fngPonto(score, rExt - 6, cx, cy);
  const marcas = [0, 50, 100].map((v) => {
    const [tx, ty] = fngPonto(v, rExt + 11, cx, cy);
    return `<text x="${tx}" y="${ty}" class="fng-tick">${v}</text>`;
  }).join('');
  return `
    <div class="fng-item">
      <div class="fng-titulo">${titulo}</div>
      <svg viewBox="0 0 200 116" class="fng-svg" role="img" aria-label="${titulo} ${score}">
        ${arcos}
        ${marcas}
        <line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" class="fng-agulha"/>
        <circle cx="${cx}" cy="${cy}" r="7" class="fng-centro"/>
        <text x="${cx}" y="${cy + 26}" class="fng-valor" fill="${faixa.cor}">${Math.round(score)}</text>
      </svg>
      <div class="fng-rotulo" style="color:${faixa.cor}">${faixa.nome}</div>
      <div class="fng-hist">${nota}</div>
    </div>`;
}

// Card com os dois termômetros lado a lado (EUA e Brasil).
function renderSentimentoCard(fg, br) {
  const notaEua = fg ? `ontem ${fg.prevClose ?? '—'} · 1 mês ${fg.month ?? '—'}` : '';
  const notaBr = br
    ? `momento ${br.componentes.momento} · amplitude ${br.componentes.amplitude}`
    : '';
  return `
    <section class="card fng-card">
      <div class="card-header">Termômetro do Mercado</div>
      <div class="card-body fng-body">
        ${renderGauge(fg?.score, 'EUA · Fear &amp; Greed', notaEua)}
        ${renderGauge(br?.score, 'Brasil · B3', notaBr)}
      </div>
    </section>`;
}

// ---- Relógio das principais bolsas ----
// Horários de pregão regular, em hora local de cada praça. Os fusos (e o horário de
// verão) são resolvidos pelo próprio navegador via Intl — sem API externa.
const minutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// Hora local e dia da semana naquele fuso, na hora atual.
function agoraEm(tz) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(new Date());
  const get = (t) => p.find((x) => x.type === t)?.value;
  const h = Number(get('hour')) % 24; // 24 significa meia-noite em alguns ambientes
  const m = Number(get('minute'));
  return { hhmm: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
           min: h * 60 + m, semana: get('weekday') };
}

// Minutos antes do fechamento em que a cor muda para "fechando".
const AVISO_FECHAMENTO = 30;

// Não considera feriados locais nem intervalo de almoço (Tóquio/HK) — é uma
// indicação de horário de pregão, não um status oficial da bolsa.
// Estados: 'aberta' | 'fechando' (perto do fim) | 'fechada'
function estadoBolsa(b) {
  const { hhmm, min, semana } = agoraEm(b.tz);
  const util = !['Sat', 'Sun'].includes(semana);
  const fecha = minutos(b.fecha);
  const aberta = util && min >= minutos(b.abre) && min < fecha;
  let estado = 'fechada';
  if (aberta) estado = (fecha - min) <= AVISO_FECHAMENTO ? 'fechando' : 'aberta';
  return { hhmm, aberta, estado };
}

// Relógio + estado do pregão, exibido na própria linha do índice.
function relogioIndice(it) {
  if (!it.tz) return '';
  const { hhmm, estado } = estadoBolsa(it);
  return `<span class="idx-hora ${estado}" data-tz="${it.tz}" data-abre="${it.abre}" data-fecha="${it.fecha}" title="pregão ${it.abre}–${it.fecha} (hora local)">${hhmm}</span>`;
}

// Atualiza só os relógios, sem refazer o painel inteiro.
function atualizarRelogios() {
  document.querySelectorAll('.idx-hora[data-tz]').forEach((el) => {
    const { hhmm, estado } = estadoBolsa({
      tz: el.dataset.tz, abre: el.dataset.abre, fecha: el.dataset.fecha,
    });
    el.textContent = hhmm;
    el.classList.remove('aberta', 'fechando', 'fechada');
    el.classList.add(estado);
  });
}

// Card de destaques: poucos números em fonte grande, para leitura à distância na TV.
const ptsFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const brlFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const HIGHLIGHTS = [
  { group: 'Brasil', symbol: 'BRL=X', label: 'Dólar', fmt: (v) => `R$ ${brlFmt.format(v)}` },
  { group: 'Estados Unidos', symbol: '^GSPC', label: 'S&P 500', fmt: (v) => `${ptsFmt.format(v)} pts` },
  { group: 'Brasil', symbol: '^BVSP', label: 'Ibovespa', fmt: (v) => `${ptsFmt.format(v)} pts` },
];

function renderHighlightsCard(data) {
  const g = data.groups || {};
  const itens = HIGHLIGHTS.map((h) => {
    const it = (g[h.group] || []).find((x) => x.symbol === h.symbol);
    if (!it || typeof it.price !== 'number') {
      return `<div class="hl-item"><span class="hl-label">${h.label}</span>
        <div class="hl-value hl-na">—</div></div>`;
    }
    const up = (it.changePct ?? 0) >= 0;
    const seta = up ? '▲' : '▼';
    const pct = typeof it.changePct === 'number'
      ? `${seta} ${Math.abs(it.changePct).toFixed(2).replace('.', ',')}%` : '';
    return `
      <div class="hl-item">
        <div class="hl-top">
          <span class="hl-label">${h.label}</span>
          <span class="hl-pct ${up ? 'up' : 'down'}">${pct}</span>
        </div>
        <div class="hl-value ${up ? 'up' : 'down'}">${h.fmt(it.price)}</div>
      </div>`;
  }).join('');
  return `
    <section class="card hl-card">
      <div class="card-header">Destaques</div>
      <div class="card-body">${itens}</div>
    </section>`;
}

// Juros reais por país: taxa básica (BIS) x inflação 12m (OCDE), fórmula de Fisher.
function renderRealRatesCard(rows) {
  if (!rows || rows.length === 0) {
    return `<section class="card"><div class="card-header">Juros Reais</div>
      <div class="card-body"><p class="row-unavailable" style="padding:12px">carregando…</p></div></section>`;
  }
  const head = `<div class="rr-row rr-head"><span class="rr-flag"></span><span class="rr-pais">País</span><span title="crescimento do PIB no último ano fechado">PIB</span><span title="taxa de desemprego (por ora só EUA)">Des.</span><span title="taxa básica de juros do banco central (Selic, Fed Funds, BCE...)">Básica</span><span>Infl.</span><span title="título de 10 anos">10a</span><span>Real</span></div>`;
  const num = (v) => (typeof v === 'number' ? v.toFixed(2) : '—');
  const body = rows.map((r) => {
    if (r.unavailable) {
      return `<div class="rr-row">${flagImg(r.flag, 'rr-flag')}<span class="rr-pais">${r.label}</span><span class="rr-na">indisponível</span></div>`;
    }
    const cls = r.real > 0 ? 'up' : (r.real < 0 ? 'down' : 'flat');
    return `
      <div class="rr-row">
        ${flagImg(r.flag, 'rr-flag')}
        <span class="rr-pais" title="inflação de ${r.period}">${r.label}</span>
        <span class="rr-num" title="${r.gdpYear ? 'PIB de ' + r.gdpYear : ''}">${num(r.gdp)}</span>
        <span class="rr-num" title="${r.unempDate ? 'desemprego em ' + r.unempDate : ''}">${num(r.unemp)}</span>
        <span class="rr-num">${r.policy.toFixed(2)}</span>
        <span class="rr-num">${r.inflation.toFixed(2)}</span>
        <span class="rr-num">${num(r.y10)}</span>
        <span class="rr-num rr-real ${cls}">${r.real >= 0 ? '+' : ''}${r.real.toFixed(2)}</span>
      </div>`;
  }).join('');
  return `
    <section class="card rr-card">
      <div class="card-header">Juros Reais (% a.a.)</div>
      <div class="card-body">${head}${body}</div>
    </section>`;
}

function renderGroupCard(title, items, extraRows = '') {
  const rows = (items || []).map(renderQuoteRow).join('');
  const body = (rows || '<p class="row-unavailable" style="padding:12px">carregando…</p>') + extraRows;
  return `
    <section class="card">
      <div class="card-header">${title}</div>
      <div class="card-body">${body}</div>
    </section>`;
}

function renderBrasilRatesRows(brasilRates) {
  if (!brasilRates) return '';
  return [
    renderRateRow(brasilRates.ipca),
    renderRateRow(brasilRates.tesouroIpca2032),
    ...(brasilRates.diCurve || []).map(renderRateRow),
  ].join('');
}

// CPI dos EUA: variação em 12 meses (fonte BLS), no mesmo formato do IPCA.
function renderCpiRow(cpi) {
  if (!cpi || typeof cpi.value !== 'number') {
    return `
      <div class="row">
        <div class="row-label">
          <span class="row-name">CPI</span>
          <span class="row-symbol">CPI</span>
        </div>
        <div class="row-unavailable" title="${cpi?.reason || ''}">—</div>
      </div>`;
  }
  const { cls, icon } = changeIcon(cpi.changePP);
  const ppText = typeof cpi.changePP === 'number' ? `${cpi.changePP >= 0 ? '+' : ''}${cpi.changePP.toFixed(2)} p.p.` : '—';
  return `
    <div class="row rate-row">
      <div class="row-label">
        <span class="row-name">CPI</span>
        <span class="row-symbol">${cpi.refDate || 'CPI'}</span>
      </div>
      <div class="row-values">
        <span class="row-price">${cpi.value.toFixed(2)}%</span>
        <span class="row-change ${cls}">${icon} ${ppText}</span>
      </div>
    </div>`;
}

function renderNewsItems(news, emptyMsg = 'carregando…') {
  return (news || []).map((n) => `
    <div class="news-item">
      <a href="${n.link}" target="_blank" rel="noopener noreferrer">${n.title}</a>
      <span class="news-date">${n.source ? n.source + ' · ' : ''}${n.ticker ? '<strong>' + n.ticker + '</strong> · ' : ''}${n.pubDate ? new Date(n.pubDate).toLocaleString('pt-BR') : ''}</span>
    </div>`).join('') || `<p class="row-unavailable" style="padding:12px">${emptyMsg}</p>`;
}

function renderNewsCard(news, title = 'Notícias', limit) {
  const list = limit ? (news || []).slice(0, limit) : news;
  return `
    <section class="card">
      <div class="card-header">${title}</div>
      <div class="card-body">${renderNewsItems(list)}</div>
    </section>`;
}

// Card de notícias com filtro "Todas / Minhas empresas".
function renderMainNewsCard(data, limit) {
  const showCompany = newsFilter === 'company';
  let list = showCompany ? data.companyNews : data.news;
  if (limit) list = (list || []).slice(0, limit);
  const emptyMsg = showCompany
    ? 'Nenhuma notícia recente sobre as empresas que você acompanha.'
    : 'carregando…';
  return `
    <section class="card">
      <div class="card-header news-header">
        <span>Notícias</span>
        <span class="news-toggle">
          <button data-newsfilter="all" class="${showCompany ? '' : 'active'}">Todas</button>
          <button data-newsfilter="company" class="${showCompany ? 'active' : ''}">Minhas empresas</button>
        </span>
      </div>
      <div class="card-body">${renderNewsItems(list, emptyMsg)}</div>
    </section>`;
}

const dayFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' });

function renderCalendarCard(calendar, limit) {
  const list = limit ? (calendar || []).slice(0, limit) : calendar;
  const rows = (list || []).map((ev) => {
    const [d, m, y] = ev.date.split('/').map(Number);
    const dt = new Date(y, m - 1, d);
    return `
      <div class="row">
        <div class="row-label">
          <span class="row-name">${ev.label}</span>
          <span class="row-symbol">${ev.tag || ''}</span>
        </div>
        <div class="cal-date">${dayFmt.format(dt)}</div>
      </div>`;
  }).join('');
  const body = rows || '<p class="row-unavailable" style="padding:12px">carregando…</p>';
  return `
    <section class="card">
      <div class="card-header">Agenda IBGE (Brasil)</div>
      <div class="card-body">${body}</div>
    </section>`;
}

// Widget oficial do Investing.com (calendário econômico global). Montado UMA ÚNICA vez
// num contêiner fora do #grid, que não é reconstruído a cada refresh de 30s — assim o
// iframe não recarrega nem perde a data navegada pelo usuário.
const INVESTING_CAL_SRC = 'https://sslecal2.investing.com?columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&importance=2,3&features=datepicker,timezone&countries=32,5,35,72&calType=day&timeZone=12&lang=12';

function ensureCalendarWidget() {
  const host = document.getElementById('calWidget');
  if (!host || host.dataset.mounted) return; // monta só na primeira vez
  host.dataset.mounted = '1';
  host.innerHTML = `
    <section class="card cal-widget-card">
      <div class="card-header">Calendário Econômico</div>
      <div class="cal-widget-wrap">
        <iframe title="Calendário Econômico — Investing.com" src="${INVESTING_CAL_SRC}"
          width="650" height="467" frameborder="0" allowtransparency="true"
          marginwidth="0" marginheight="0" loading="lazy"></iframe>
      </div>
      <div class="cal-footer">
        Calendário fornecido por
        <a href="https://br.investing.com/" rel="nofollow" target="_blank">Investing.com Brasil</a>.
      </div>
    </section>`;
}

// Sobrepõe um widget persistente ao seu slot no grid, escalando-o para a largura da coluna.
function positionWidget(hostId, slotId, nativeW, nativeH) {
  const host = document.getElementById(hostId);
  const slot = document.getElementById(slotId);
  if (!host || !slot) return;
  const iframe = host.querySelector('iframe');
  const wrap = host.querySelector('.cal-widget-wrap');
  if (!iframe || !wrap) return;
  const colW = slot.offsetWidth || host.offsetWidth;
  const scale = colW / nativeW;
  iframe.style.transform = `scale(${scale})`;
  wrap.style.height = `${Math.round(nativeH * scale)}px`;
  host.style.width = `${colW}px`;
  slot.style.height = `${host.offsetHeight}px`;
  host.style.top = `${slot.offsetTop}px`;
  host.style.left = `${slot.offsetLeft}px`;
}

async function loadData() {
  try {
    const res = await fetch('/api/data', { cache: 'no-store' });
    const data = await res.json();
    render(data);
  } catch (err) {
    grid.innerHTML = `<p class="loading">Erro ao carregar dados: ${err.message}</p>`;
  }
}

// Construtores de card por chave. Os slots (Calendário/Taxas) só reservam espaço —
// os iframes vivem fora do #grid e são sobrepostos por positionCalWidget.
function cardBuilders(data) {
  const g = data.groups || {};
  const newsLimit = TV_MODE ? TV_NEWS_LIMIT : undefined;
  const builders = {
    'Destaques': () => renderHighlightsCard(data),
    'FearGreed': () => renderSentimentoCard(data.fearGreed, data.sentimentoBr),
    'Estados Unidos': () => renderGroupCard('Estados Unidos', g['Estados Unidos'], renderCpiRow(data.cpi)),
    'Brasil': () => renderGroupCard('Brasil', g['Brasil'], renderBrasilRatesRows(data.brasilRates)),
    'IndicesMundiais': () => renderWorldIndicesCard(data.worldIndices),
    'JurosReais': () => renderRealRatesCard(data.realRates),
    'AgendaIBGE': () => renderCalendarCard(data.calendar, TV_MODE ? TV_AGENDA_LIMIT : undefined),
    'CalendarioEconomico': () => '<div id="calSlot" class="cal-slot"></div>',
    'NoticiasMacro': () => renderNewsCard(data.macroNews, 'Notícias — Indicadores Macro', newsLimit),
    'NoticiasEmpresas': () => renderMainNewsCard(data, TV_MODE ? TV_MAIN_NEWS_LIMIT : undefined),
  };
  // demais setores vêm direto do backend
  for (const title of Object.keys(g)) {
    if (!builders[title]) builders[title] = () => renderGroupCard(title, g[title]);
  }
  return builders;
}

// Layout fixo do modo TV: cada array é uma coluna, na ordem definida pelo usuário.
// A última coluna é mais larga para acomodar o calendário do Investing.
const TV_LAYOUT = [
  // "Destaques" entra no fim da coluna 1, que tinha ~460px livres — nada acima se move
  ['Estados Unidos', 'Brasil', 'Destaques', 'FearGreed'],
  ['Commodities', 'IndicesMundiais', 'JurosReais'],
  ['Bancos', 'Energia', 'Seguros', 'Saneamento', 'Telecom', 'Petróleo & Gás'],
  ['Mineração', 'Papel & Celulose', 'Metalurgia & Siderurgia', 'Químicos & Petroquímicos', 'Outros', 'MAG7 (S&P 500)'],
  ['AgendaIBGE', 'CalendarioEconomico', 'NoticiasMacro', 'NoticiasEmpresas'],
];

function render(data) {
  lastData = data;
  const builders = cardBuilders(data);
  const side = document.getElementById('tvSide');
  if (side) side.innerHTML = '';

  if (TV_MODE) {
    const cols = TV_LAYOUT.map((keys, i) => {
      const inner = keys.map((k) => (builders[k] ? builders[k]() : '')).join('');
      const wide = i === TV_LAYOUT.length - 1 ? ' tv-col-wide' : '';
      return `<div class="tv-col${wide}">${inner}</div>`;
    }).join('');
    grid.innerHTML = `<div class="tv-cols">${cols}</div>`;
  } else {
    // modo normal: fluxo único, na mesma ordem lógica das colunas
    const order = TV_LAYOUT.flat();
    const seen = new Set(order);
    const extras = Object.keys(builders).filter((k) => !seen.has(k));
    grid.innerHTML = [...order, ...extras].map((k) => (builders[k] ? builders[k]() : '')).join('');
  }

  if (data.errors && data.errors.length) {
    grid.insertAdjacentHTML('beforeend', `<div class="errors-bar">Algumas fontes falharam: ${data.errors.join(' · ')}</div>`);
  }

  // alinha os iframes persistentes sobre seus slots recém-criados
  positionCalWidget();

  if (data.updatedAt) {
    updatedAtEl.textContent = `Atualizado às ${timeFmt.format(new Date(data.updatedAt))}`;
  }
}

refreshBtn.addEventListener('click', loadData);

// alterna o filtro de notícias sem refazer a busca (delegação: grid não é recriado)
grid.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-newsfilter]');
  if (!btn) return;
  newsFilter = btn.dataset.newsfilter;
  if (lastData) render(lastData);
});

// ---- Modo TV (?tv=1): palco fixo 1920x1080 escalado para caber na tela ----
const TV_MODE = new URLSearchParams(location.search).get('tv') === '1';
const STAGE_W = 1920;
const STAGE_H = 1080;
const TV_NEWS_LIMIT = 3;        // menos manchetes na TV, porém com o título inteiro
const TV_MAIN_NEWS_LIMIT = 4;   // o card de empresas cabe uma manchete a mais
const TV_AGENDA_LIMIT = 5;      // eventos da Agenda IBGE que cabem acima do calendário
const CAL_IFRAME_W = 650;       // dimensões nativas do widget do Investing
const CAL_IFRAME_H = 467;

function fitStage() {
  const stage = document.getElementById('stage');
  if (!stage) return;
  const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  // centraliza o palco escalado
  const left = (window.innerWidth - STAGE_W * scale) / 2;
  const top = (window.innerHeight - STAGE_H * scale) / 2;
  stage.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
  if (TV_MODE) positionCalWidget();
}

// Sobrepõe o calendário do Investing exatamente sobre o slot reservado no grid.
// Mover o iframe no DOM o recarregaria; por isso ele fica fixo em #calWidget (filho
// de #stage) e apenas reposicionamos via top/left — o iframe nunca é recriado.
function positionCalWidget() {
  positionWidget('calWidget', 'calSlot', CAL_IFRAME_W, CAL_IFRAME_H);
}

if (TV_MODE) {
  document.body.classList.add('tv-mode');
  fitStage();
  window.addEventListener('resize', fitStage);
}

ensureCalendarWidget(); // o iframe é montado uma vez, nos dois modos
loadData();
setInterval(loadData, 30_000);
// os relógios andam sozinhos, sem esperar o refresh de 30s dos dados
setInterval(atualizarRelogios, 10_000);
