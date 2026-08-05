// Página de indicadores de uma empresa da B3, aberta ao clicar no ticker do painel.
// Os dados vêm de /api/empresa/:ticker, que lê a re_kpi no Supabase.

const params = new URLSearchParams(location.search);
const TICKER = (params.get('ticker') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const tituloEl = document.getElementById('empTitulo');
const subEl = document.getElementById('empSub');
const controlesEl = document.getElementById('empControles');
const balaoEl = document.getElementById('empBalao');
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

// "9 anos" quando fecha redondo; "4,2 anos" quando uma das pontas é o TTM
function textoAnos(anos) {
  const arredondado = Math.round(anos);
  const txt = Math.abs(anos - arredondado) < 0.05 ? String(arredondado) : fmt1.format(anos);
  return `${txt} ano${txt === '1' ? '' : 's'}`;
}

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
  intervalo.textContent = `${periodo(ini)} → ${periodo(fim)} (${textoAnos(anos)})`;
  intervalo.classList.remove('emp-intervalo-erro');

  rodape.innerHTML = linhaVariacao('Var. total', 'total', ini, fim, anos)
    + linhaVariacao('CAGR a.a.', 'cagr', ini, fim, anos);
}

function aplicaPeriodo(de, ate) {
  document.getElementById('empDe').value = String(de);
  document.getElementById('empAte').value = String(ate);
  atualizaVariacao();
}

// ---- Seleção por arrasto: segurar o botão numa célula e soltar noutra ----
// O arrasto anda só na coluna onde começou: CAGR compara o mesmo indicador em dois
// momentos, então cruzar colunas (receita de 2018 contra dívida de 2024) não teria conta.

let arrasto = null;

function celulaDoEvento(ev) {
  const td = ev.target.closest('td');
  if (!td || !conteudoEl.contains(td)) return null;
  const tr = td.parentElement;
  if (tr.dataset.i === undefined) return null; // rodapé e cabeçalho ficam de fora
  return { i: Number(tr.dataset.i), coluna: [...tr.children].indexOf(td) };
}

function pintaArrasto(coluna, a, b) {
  conteudoEl.querySelectorAll('td.emp-arrasto').forEach((td) => td.classList.remove('emp-arrasto'));
  if (coluna === null) return;
  for (let i = Math.min(a, b); i <= Math.max(a, b); i += 1) {
    const tr = conteudoEl.querySelector(`tbody tr[data-i="${i}"]`);
    const td = tr && tr.children[coluna];
    if (td) td.classList.add('emp-arrasto');
  }
}

function fechaBalao() {
  balaoEl.hidden = true;
  balaoEl.innerHTML = '';
}

function mostraBalao(coluna, de, ate, x, y) {
  const c = COLUNAS[coluna];
  const ini = DADOS.linhas[de];
  const fim = DADOS.linhas[ate];
  const anos = anosEntre(ini, fim);
  if (!c || !anos || anos <= 0) return fechaBalao();

  const cabecalho = `
    <button type="button" class="emp-balao-x" aria-label="fechar">×</button>
    <p class="emp-balao-tit">${esc(c.rotulo)}</p>
    <p class="emp-balao-per">${esc(periodo(ini))} → ${esc(periodo(fim))} · ${textoAnos(anos)}</p>`;

  if (c.tipo === 'texto') {
    // arrasto na coluna do ano: serve para marcar o período, mas não há o que calcular
    balaoEl.innerHTML = `${cabecalho}
      <p class="emp-balao-nota">Período marcado. Arraste numa coluna de valores para ver o CAGR.</p>`;
  } else {
    const total = celulaVariacao(c, ini, fim, anos, 'total');
    const cagr = celulaVariacao(c, ini, fim, anos, 'cagr');
    const unidade = c.tipo === 'mi' ? ` <span class="emp-balao-un">${esc(DADOS.unidade)}</span>` : '';
    const nota = cagr.dica || total.dica;
    balaoEl.innerHTML = `${cabecalho}
      <p class="emp-balao-val">${formata(ini[c.chave], c.tipo)} → ${formata(fim[c.chave], c.tipo)}${unidade}</p>
      <dl class="emp-balao-res">
        <dt>Var. total</dt><dd class="${typeof total.valor === 'number' && total.valor < 0 ? 'neg' : ''}">${total.texto}</dd>
        <dt>CAGR a.a.</dt><dd class="${typeof cagr.valor === 'number' && cagr.valor < 0 ? 'neg' : ''}">${cagr.texto}</dd>
      </dl>
      ${nota ? `<p class="emp-balao-nota">${esc(nota)}</p>` : ''}`;
  }

  // solto perto da borda, o balão sairia da tela: encosta na margem em vez de vazar
  balaoEl.hidden = false;
  const larg = balaoEl.offsetWidth;
  const alt = balaoEl.offsetHeight;
  balaoEl.style.left = `${Math.max(8, Math.min(x + 14, innerWidth - larg - 8))}px`;
  balaoEl.style.top = `${Math.max(8, Math.min(y + 14, innerHeight - alt - 8))}px`;
  return undefined;
}

function ligaArrasto() {
  conteudoEl.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    const c = celulaDoEvento(ev);
    if (!c) return;
    ev.preventDefault(); // sem isto o navegador começa a selecionar o texto da tabela
    fechaBalao();
    arrasto = { coluna: c.coluna, iInicio: c.i, iAtual: c.i };
    document.body.classList.add('emp-arrastando');
    pintaArrasto(c.coluna, c.i, c.i);
  });

  conteudoEl.addEventListener('mouseover', (ev) => {
    if (!arrasto) return;
    const c = celulaDoEvento(ev);
    if (!c) return;
    arrasto.iAtual = c.i; // a coluna é a do início; só a linha acompanha o mouse
    pintaArrasto(arrasto.coluna, arrasto.iInicio, c.i);
  });

  // no document: soltar o botão fora da tabela também encerra o arrasto
  document.addEventListener('mouseup', (ev) => {
    if (!arrasto) return;
    const { coluna, iInicio, iAtual } = arrasto;
    arrasto = null;
    document.body.classList.remove('emp-arrastando');
    pintaArrasto(null);
    if (iInicio === iAtual) return; // clique seco, sem arrastar: nada a comparar
    const de = Math.min(iInicio, iAtual);
    const ate = Math.max(iInicio, iAtual);
    aplicaPeriodo(de, ate);
    mostraBalao(coluna, de, ate, ev.clientX, ev.clientY);
  });

  balaoEl.addEventListener('click', (ev) => {
    if (ev.target.closest('.emp-balao-x')) fechaBalao();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') fechaBalao();
  });
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
    <span id="empIntervalo" class="emp-intervalo"></span>
    <span class="emp-dica">ou arraste o mouse dentro de uma coluna</span>`;
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
      ligaArrasto();
    }
  } catch (err) {
    subEl.textContent = '';
    conteudoEl.innerHTML = aviso('Não foi possível carregar os indicadores.', err.message);
  }
}

carrega();
