// Página de indicadores de uma empresa da B3, aberta ao clicar no ticker do painel.
// Os dados vêm de /api/empresa/:ticker, que lê a re_kpi no Supabase.

const params = new URLSearchParams(location.search);
const TICKER = (params.get('ticker') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const tituloEl = document.getElementById('empTitulo');
const subEl = document.getElementById('empSub');
const conteudoEl = document.getElementById('empConteudo');

const fmtMi = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

// Cada coluna sabe se dá para colorir por sinal e como se formata. `grupo` só pinta o
// cabeçalho, para separar resultado, balanço e caixa de relance.
const COLUNAS = [
  { chave: 'periodo', rotulo: 'Ano', tipo: 'texto', grupo: 'ano' },
  { chave: 'receita', rotulo: 'Receita Líq', tipo: 'mi', grupo: 'resultado' },
  { chave: 'ebitda', rotulo: 'EBITDA', tipo: 'mi', grupo: 'resultado' },
  { chave: 'margemEbitda', rotulo: 'Mrg EBITDA', tipo: 'pct0', grupo: 'resultado' },
  { chave: 'da', rotulo: 'D&A', tipo: 'mi', grupo: 'custo' },
  { chave: 'ebit', rotulo: 'EBIT', tipo: 'mi', grupo: 'resultado' },
  { chave: 'resFin', rotulo: 'Res Fin', tipo: 'mi', grupo: 'custo' },
  { chave: 'impostos', rotulo: 'Impostos', tipo: 'mi', grupo: 'custo' },
  { chave: 'opDesc', rotulo: 'Op Desc', tipo: 'mi', grupo: 'custo' },
  { chave: 'lucro', rotulo: 'Lucro Líq', tipo: 'mi', grupo: 'resultado' },
  { chave: 'margemLiquida', rotulo: 'Mrg Líq', tipo: 'pct0', grupo: 'resultado' },
  { chave: 'patrimonio', rotulo: 'Patrimônio', tipo: 'mi', grupo: 'balanco' },
  { chave: 'roe', rotulo: 'ROE', tipo: 'pct0', grupo: 'balanco' },
  { chave: 'caixa', rotulo: 'Caixa&Inv', tipo: 'mi', grupo: 'balanco' },
  { chave: 'divida', rotulo: 'Dívida', tipo: 'mi', grupo: 'divida' },
  { chave: 'dlEbitda', rotulo: 'DL/EBITDA', tipo: 'x', grupo: 'divida' },
  // `fcf_contabil` é o fluxo de FINANCIAMENTO, não free cash flow: ao lado de Capex e
  // FCL o rótulo "FCF" seria lido como fluxo livre, que é justamente a coluna seguinte.
  { chave: 'fco', rotulo: 'FC Oper', tipo: 'mi', grupo: 'caixa' },
  { chave: 'capex', rotulo: 'Capex', tipo: 'mi', grupo: 'caixa' },
  { chave: 'fci', rotulo: 'FC Invest', tipo: 'mi', grupo: 'caixa' },
  { chave: 'fcf', rotulo: 'FC Financ', tipo: 'mi', grupo: 'caixa' },
  { chave: 'fcl', rotulo: 'FC Livre', tipo: 'mi', grupo: 'caixa' },
  { chave: 'fclYield', rotulo: 'FCL Yield', tipo: 'pct1', grupo: 'caixa' },
  { chave: 'proventos', rotulo: 'Proventos', tipo: 'mi', grupo: 'provento' },
  { chave: 'payout', rotulo: 'Payout', tipo: 'pct0', grupo: 'provento' },
  { chave: 'dy', rotulo: 'DY', tipo: 'pct1', grupo: 'provento' },
];

function formata(valor, tipo) {
  if (tipo === 'texto') return esc(valor);
  if (valor === null || valor === undefined) return '—';
  if (tipo === 'mi') return fmtMi.format(valor);
  if (tipo === 'pct0') return `${Math.round(valor)}%`;
  if (tipo === 'pct1') return `${fmt1.format(valor)}%`;
  if (tipo === 'x') return fmt1.format(valor);
  return esc(valor);
}

// "12/2025" nos exercícios; no TTM, "03/26 TTM" — mês e ano da última ITR.
function periodo(linha) {
  const [ano, mes] = String(linha.data || '').split('-');
  if (!ano) return String(linha.ano || '');
  return linha.ttm ? `${mes}/${ano.slice(2)} TTM` : `${mes}/${ano}`;
}

function renderTabela(dados) {
  const cabecalho = COLUNAS
    .map((c) => `<th class="g-${c.grupo}">${esc(c.rotulo)}</th>`)
    .join('');
  const corpo = dados.linhas.map((linha) => {
    const celulas = COLUNAS.map((c) => {
      const valor = c.chave === 'periodo' ? periodo(linha) : linha[c.chave];
      const negativo = typeof valor === 'number' && valor < 0;
      const classes = [c.chave === 'periodo' ? 'emp-periodo' : 'emp-num', negativo ? 'neg' : ''].join(' ');
      return `<td class="${classes}">${formata(valor, c.tipo)}</td>`;
    }).join('');
    return `<tr class="${linha.ttm ? 'emp-ttm' : ''}">${celulas}</tr>`;
  }).join('');
  return `<div class="emp-tabela-wrap">
    <table class="emp-tabela">
      <thead><tr>${cabecalho}</tr></thead>
      <tbody>${corpo}</tbody>
    </table>
  </div>`;
}

function aviso(texto, detalhe = '') {
  return `<div class="emp-aviso">
    <p>${esc(texto)}</p>
    ${detalhe ? `<p class="emp-aviso-detalhe">${esc(detalhe)}</p>` : ''}
  </div>`;
}

async function carrega() {
  if (!TICKER) {
    tituloEl.textContent = 'Indicadores';
    conteudoEl.innerHTML = aviso('Nenhum ticker informado.', 'Use empresa.html?ticker=PETR4');
    return;
  }
  tituloEl.textContent = TICKER;
  try {
    const res = await fetch(`/api/empresa/${TICKER}`, { cache: 'no-store' });
    const dados = await res.json();
    if (!res.ok) throw new Error(dados.error || `HTTP ${res.status}`);
    tituloEl.textContent = `${TICKER} · ${dados.empresa || ''}`.trim();
    if (dados.vazio || !dados.linhas.length) {
      subEl.textContent = '';
      conteudoEl.innerHTML = aviso(
        'Sem indicadores para esta empresa.',
        'A consulta voltou vazia — a empresa pode não ter histórico na re_kpi, ou a tabela ainda não libera leitura para a chave anon do painel.',
      );
      return;
    }
    subEl.textContent = `${dados.unidade} · exercícios encerrados e últimos 12 meses (TTM) · fonte: re_kpi`;
    conteudoEl.innerHTML = renderTabela(dados);
  } catch (err) {
    subEl.textContent = '';
    conteudoEl.innerHTML = aviso('Não foi possível carregar os indicadores.', err.message);
  }
}

carrega();
