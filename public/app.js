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
function logoImg(symbol) {
  if (!symbol || !symbol.endsWith('.SA')) return '';
  const ticker = symbol.slice(0, -3);
  return `<img class="row-logo" src="https://icons.brapi.dev/icons/${ticker}.svg" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
}

function renderQuoteRow(item) {
  const logo = logoImg(item.symbol);
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
  const pctText = typeof item.changePct === 'number' ? `${item.changePct >= 0 ? '+' : ''}${item.changePct.toFixed(2)}%` : '—';
  return `
    <div class="row">
      ${logo}
      <div class="row-label">
        <span class="row-name">${item.label}</span>
        <span class="row-symbol">${item.displaySymbol || item.symbol}</span>
      </div>
      <div class="row-values">
        <span class="row-price">${formatPrice(item.price, item.currency)}</span>
        <span class="row-change ${cls}">${icon} ${pctText}</span>
      </div>
    </div>`;
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
    <div class="row">
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

function renderCpiRow(cpi) {
  return `
    <div class="row">
      <div class="row-label">
        <span class="row-name">CPI</span>
        <span class="row-symbol">CPI</span>
      </div>
      <div class="row-unavailable" title="${cpi?.reason || ''}">—</div>
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

// Widget de taxas de juros do Investing.com (108x146 nativo). Mesmo esquema do
// calendário: montado uma vez fora do #grid e sobreposto ao slot correspondente.
const INVESTING_RATES_SRC = 'https://sslirates.investing.com/index.php?rows=1&bg1=FFFFFF&bg2=F1F5F8&text_color=333333&enable_border=show&border_color=0452A1&header_bg=0452A1&header_text=FFFFFF&force_lang=12';
const RATES_IFRAME_W = 108;
const RATES_IFRAME_H = 146;
const RATES_MAX_SCALE = 1.2; // esticar até a coluna (2,4x) deixaria o card alto demais

function ensureRatesWidget() {
  const host = document.getElementById('ratesWidget');
  if (!host || host.dataset.mounted) return;
  host.dataset.mounted = '1';
  host.innerHTML = `
    <section class="card rates-widget-card">
      <div class="card-header">Taxas de Juros</div>
      <div class="rates-widget-wrap">
        <iframe title="Taxas de Juros — Investing.com" src="${INVESTING_RATES_SRC}"
          width="${RATES_IFRAME_W}" height="${RATES_IFRAME_H}" frameborder="0"
          scrolling="no" allowtransparency="true" marginwidth="0" marginheight="0"></iframe>
      </div>
      <div class="cal-footer">
        Taxas fornecidas por
        <a href="https://br.investing.com/" rel="nofollow" target="_blank">Investing.com Brasil</a>.
      </div>
    </section>`;
}

// Sobrepõe um widget persistente ao seu slot no grid, escalando-o para a largura da
// coluna. `maxScale` evita que widgets estreitos e altos (como o de taxas) fiquem
// altos demais ao esticar; nesse caso o iframe é centralizado na coluna.
function positionWidget(hostId, slotId, nativeW, nativeH, maxScale = Infinity) {
  const host = document.getElementById(hostId);
  const slot = document.getElementById(slotId);
  if (!host || !slot) return;
  const iframe = host.querySelector('iframe');
  const wrap = host.querySelector('.cal-widget-wrap, .rates-widget-wrap');
  if (!iframe || !wrap) return;
  const colW = slot.offsetWidth || host.offsetWidth;
  const scale = Math.min(colW / nativeW, maxScale);
  const offsetX = Math.max(0, (colW - nativeW * scale) / 2); // centraliza se sobrar espaço
  iframe.style.transform = `translateX(${offsetX}px) scale(${scale})`;
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

function render(data) {
  lastData = data;
  const groupTitles = Object.keys(data.groups || {});
  const cards = [];

  const usIdx = groupTitles.indexOf('Estados Unidos');
  if (usIdx !== -1) cards.push(renderGroupCard('Estados Unidos', data.groups['Estados Unidos'], renderCpiRow(data.cpi)));

  const brIdx = groupTitles.indexOf('Brasil');
  if (brIdx !== -1) cards.push(renderGroupCard('Brasil', data.groups['Brasil'], renderBrasilRatesRows(data.brasilRates)));

  for (const title of groupTitles) {
    if (title === 'Estados Unidos' || title === 'Brasil') continue;
    if (title === 'Commodities') continue;
    // Commodities and calendar are placed right after Brasil-related cards, matching original layout
  }

  // Commodities + slot das taxas de juros ficam juntos (o widget é sobreposto ao slot)
  if (groupTitles.includes('Commodities')) {
    cards.push(`<div class="rates-group">${renderGroupCard('Commodities', data.groups['Commodities'])}<div id="ratesSlot" class="rates-slot"></div></div>`);
  }

  // No modo TV, Agenda IBGE e calendário vão para o painel lateral (650px), onde o
  // widget do Investing cabe em tamanho nativo. O slot apenas reserva o espaço — o
  // iframe real é sobreposto por positionCalWidget, sem nunca ser recriado.
  const side = document.getElementById('tvSide');
  if (TV_MODE) {
    if (side) side.innerHTML = renderCalendarCard(data.calendar, TV_AGENDA_LIMIT) + '<div id="calSlot" class="cal-slot"></div>';
  } else {
    if (side) side.innerHTML = '';
    cards.push(renderCalendarCard(data.calendar));
  }

  const newsLimit = TV_MODE ? TV_NEWS_LIMIT : undefined;
  cards.push(renderNewsCard(data.macroNews, 'Notícias — Indicadores Macro', newsLimit));
  cards.push(renderMainNewsCard(data, newsLimit));

  for (const title of groupTitles) {
    if (['Estados Unidos', 'Brasil', 'Commodities'].includes(title)) continue;
    cards.push(renderGroupCard(title, data.groups[title]));
  }

  if (data.errors && data.errors.length) {
    cards.push(`<div class="errors-bar">Algumas fontes falharam: ${data.errors.join(' · ')}</div>`);
  }

  grid.innerHTML = cards.join('');

  // o grid foi reconstruído: realinha os widgets persistentes sobre os novos slots
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
const TV_NEWS_LIMIT = 5;        // menos manchetes na TV, porém com o título inteiro
const TV_AGENDA_LIMIT = 8;      // eventos da Agenda IBGE que cabem acima do calendário
                                // (8 deixa margem para nomes longos quebrarem linha)
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
  positionWidget('ratesWidget', 'ratesSlot', RATES_IFRAME_W, RATES_IFRAME_H, RATES_MAX_SCALE);
}

if (TV_MODE) {
  document.body.classList.add('tv-mode');
  fitStage();
  window.addEventListener('resize', fitStage);
}

ensureCalendarWidget(); // os iframes são montados uma vez nos dois modos
ensureRatesWidget();
loadData();
setInterval(loadData, 30_000);
