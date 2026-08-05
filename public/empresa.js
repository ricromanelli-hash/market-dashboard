// Página de indicadores de uma empresa da B3, aberta ao clicar no ticker do painel.
// Os dados vêm de /api/empresa/:ticker, que lê a re_kpi no Supabase.

const params = new URLSearchParams(location.search);
const TICKER = (params.get('ticker') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const tituloEl = document.getElementById('empTitulo');
const subEl = document.getElementById('empSub');
const controlesEl = document.getElementById('empControles');
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

const MS_ANO = 365.25 * 24 * 60 * 60 * 1000;

let DADOS = null; // guardado para recalcular a variação sem refazer o fetch

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

// ---- Variação entre dois períodos escolhidos ----

// Pelas datas de fechamento, não pela diferença de `ano`: assim o TTM pode ser uma das
// pontas e o expoente do CAGR sai fracionário (12/2017 → 03/26 dá 8,25 anos).
function anosEntre(ini, fim) {
  const t1 = Date.parse(ini.data);
  const t2 = Date.parse(fim.data);
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return null;
  return (t2 - t1) / MS_ANO;
}

// Razão só descreve crescimento quando as duas pontas têm o mesmo sinal e nenhuma é zero.
// Lucro que sai de -13 bi para +110 bi não tem variação percentual com significado, e
// elevar um número negativo a 1/n devolveria NaN de qualquer jeito.
const razaoValida = (a, b) => a !== 0 && b !== 0 && Math.sign(a) === Math.sign(b);

const comSinal = (v, sufixo) => `${v >= 0 ? '+' : ''}${fmt1.format(v)}${sufixo}`;

function celulaVariacao(coluna, ini, fim, anos, modo) {
  const a = ini[coluna.chave];
  const b = fim[coluna.chave];
  if (typeof a !== 'number' || typeof b !== 'number') return { texto: '—' };

  // Margem, ROE, DY, payout e DL/EBITDA já são razões: crescer de 2% para 4% não é
  // "dobrar de tamanho". Nesses vai a diferença absoluta, e CAGR não se aplica.
  if (coluna.tipo !== 'mi') {
    if (modo === 'cagr') return { texto: '—', dica: 'CAGR não se aplica a um indicador que já é razão' };
    const d = b - a;
    return { texto: comSinal(d, coluna.tipo === 'x' ? 'x' : 'pp'), valor: d };
  }

  if (!razaoValida(a, b)) {
    return { texto: 'n/d', dica: 'variação sem sentido: o valor troca de sinal ou parte de zero' };
  }
  const razao = b / a;
  const v = (modo === 'cagr' ? Math.pow(razao, 1 / anos) - 1 : razao - 1) * 100;
  return { texto: comSinal(v, '%'), valor: v };
}

function linhaVariacao(rotulo, modo, ini, fim, anos) {
  const celulas = COLUNAS.map((coluna, i) => {
    if (i === 0) return `<td class="emp-periodo">${esc(rotulo)}</td>`;
    const r = celulaVariacao(coluna, ini, fim, anos, modo);
    const classes = ['emp-num', typeof r.valor === 'number' && r.valor < 0 ? 'neg' : ''].join(' ');
    const dica = r.dica ? ` title="${esc(r.dica)}"` : '';
    return `<td class="${classes}"${dica}>${r.texto}</td>`;
  }).join('');
  return `<tr class="emp-var emp-var-${modo}">${celulas}</tr>`;
}

function atualizaVariacao() {
  const linhas = DADOS.linhas;
  const iIni = Number(document.getElementById('empDe').value);
  const iFim = Number(document.getElementById('empAte').value);
  const rodape = document.getElementById('empRodape');
  const intervalo = document.getElementById('empIntervalo');

  linhas.forEach((_, i) => {
    const tr = conteudoEl.querySelector(`tr[data-i="${i}"]`);
    if (tr) tr.classList.toggle('emp-marcado', i === iIni || i === iFim);
  });

  const ini = linhas[iIni];
  const fim = linhas[iFim];
  const anos = ini && fim ? anosEntre(ini, fim) : null;
  if (!anos || anos <= 0) {
    intervalo.textContent = 'o período final precisa ser posterior ao inicial';
    intervalo.classList.add('emp-intervalo-erro');
    rodape.innerHTML = '';
    return;
  }
  // "8 anos" quando fecha redondo; "8,3 anos" quando uma das pontas é o TTM
  const arredondado = Math.round(anos);
  const txtAnos = Math.abs(anos - arredondado) < 0.05 ? String(arredondado) : fmt1.format(anos);
  intervalo.textContent = `${periodo(ini)} → ${periodo(fim)} (${txtAnos} ano${txtAnos === '1' ? '' : 's'})`;
  intervalo.classList.remove('emp-intervalo-erro');

  rodape.innerHTML = linhaVariacao('Var. total', 'total', ini, fim, anos)
    + linhaVariacao('CAGR a.a.', 'cagr', ini, fim, anos);
}

function opcoes(linhas, selecionado) {
  return linhas
    .map((l, i) => `<option value="${i}"${i === selecionado ? ' selected' : ''}>${esc(periodo(l))}</option>`)
    .join('');
}

function renderControles(linhas) {
  // Fecha no último exercício, não no TTM: o padrão fica em anos redondos, e o TTM
  // continua à mão na lista para quem quiser trazer a variação até hoje.
  const ultimoExercicio = linhas.reduce((achado, l, i) => (l.ttm ? achado : i), linhas.length - 1);
  controlesEl.innerHTML = `
    <label class="emp-ctrl">De <select id="empDe">${opcoes(linhas, 0)}</select></label>
    <label class="emp-ctrl">Até <select id="empAte">${opcoes(linhas, ultimoExercicio)}</select></label>
    <span id="empIntervalo" class="emp-intervalo"></span>`;
  document.getElementById('empDe').addEventListener('change', atualizaVariacao);
  document.getElementById('empAte').addEventListener('change', atualizaVariacao);
  controlesEl.hidden = false;
}

function renderTabela(dados) {
  const cabecalho = COLUNAS
    .map((c) => `<th class="g-${c.grupo}">${esc(c.rotulo)}</th>`)
    .join('');
  const corpo = dados.linhas.map((linha, i) => {
    const celulas = COLUNAS.map((c) => {
      const valor = c.chave === 'periodo' ? periodo(linha) : linha[c.chave];
      const negativo = typeof valor === 'number' && valor < 0;
      const classes = [c.chave === 'periodo' ? 'emp-periodo' : 'emp-num', negativo ? 'neg' : ''].join(' ');
      return `<td class="${classes}">${formata(valor, c.tipo)}</td>`;
    }).join('');
    return `<tr data-i="${i}" class="${linha.ttm ? 'emp-ttm' : ''}">${celulas}</tr>`;
  }).join('');
  return `<div class="emp-tabela-wrap">
    <table class="emp-tabela">
      <thead><tr>${cabecalho}</tr></thead>
      <tbody>${corpo}</tbody>
      <tfoot id="empRodape"></tfoot>
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
    DADOS = dados;
    subEl.textContent = `${dados.unidade} · exercícios encerrados e últimos 12 meses (TTM) · fonte: re_kpi`;
    conteudoEl.innerHTML = renderTabela(dados);
    if (dados.linhas.length > 1) {
      renderControles(dados.linhas);
      atualizaVariacao();
    }
  } catch (err) {
    subEl.textContent = '';
    conteudoEl.innerHTML = aviso('Não foi possível carregar os indicadores.', err.message);
  }
}

carrega();
