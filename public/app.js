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

function renderQuoteRow(item) {
  if (item.error) {
    return `
      <div class="row">
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

function renderNewsCard(news, title = 'Notícias') {
  return `
    <section class="card">
      <div class="card-header">${title}</div>
      <div class="card-body">${renderNewsItems(news)}</div>
    </section>`;
}

// Card de notícias com filtro "Todas / Minhas empresas".
function renderMainNewsCard(data) {
  const showCompany = newsFilter === 'company';
  const list = showCompany ? data.companyNews : data.news;
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

function renderCalendarCard(calendar) {
  const rows = (calendar || []).map((ev) => {
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

  if (groupTitles.includes('Commodities')) cards.push(renderGroupCard('Commodities', data.groups['Commodities']));
  cards.push(renderCalendarCard(data.calendar));
  cards.push(renderNewsCard(data.macroNews, 'Notícias — Indicadores Macro'));
  cards.push(renderMainNewsCard(data));

  for (const title of groupTitles) {
    if (['Estados Unidos', 'Brasil', 'Commodities'].includes(title)) continue;
    cards.push(renderGroupCard(title, data.groups[title]));
  }

  if (data.errors && data.errors.length) {
    cards.push(`<div class="errors-bar">Algumas fontes falharam: ${data.errors.join(' · ')}</div>`);
  }

  grid.innerHTML = cards.join('');

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

ensureCalendarWidget(); // monta o iframe do Investing uma vez, fora do ciclo de refresh
loadData();
setInterval(loadData, 30_000);
