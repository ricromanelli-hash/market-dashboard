// Página de indicadores de uma empresa da B3, aberta ao clicar no ticker do painel.
// Os dados vêm de /api/empresa/:ticker, que lê a re_kpi no Supabase.

const params = new URLSearchParams(location.search);
const TICKER = (params.get('ticker') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const tituloEl = document.getElementById('empTitulo');
const subEl = document.getElementById('empSub');
const abasEl = document.getElementById('empAbas');
const favsEl = document.getElementById('empFavs');
const modalEl = document.getElementById('empModal');
const dicaEl = document.getElementById('empDica');
const controlesEl = document.getElementById('empControles');
const balaoEl = document.getElementById('empBalao');
const conteudoEl = document.getElementById('empConteudo');

const fmtMi = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

// Cada coluna sabe se dá para colorir por sinal e como se formata. `grupo` só pinta o
// cabeçalho, para separar resultado, balanço e caixa de relance.
const COLUNAS_KPI = [
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

// Aba de EVA: mesma ordem da tabela do app em Flutter, sem as colunas que lá apareciam
// repetidas (Despesas Juros, WACC, Margem EBIT/EBT/Líquida saíam duas vezes).
const COLUNAS_EVA = [
  { chave: 'periodo', rotulo: 'Ano', tipo: 'texto', grupo: 'ano' },
  { chave: 'receita', rotulo: 'Receita Líq', tipo: 'mi', grupo: 'resultado' },
  { chave: 'cpv', rotulo: 'CPV', tipo: 'mi', grupo: 'custo' },
  { chave: 'lucroBruto', rotulo: 'Lucro Bruto', tipo: 'mi', grupo: 'resultado' },
  { chave: 'margemBruta', rotulo: 'Mrg Bruta', tipo: 'pct1', grupo: 'resultado' },
  { chave: 'dvga', rotulo: 'DVGA', tipo: 'mi', grupo: 'custo' },
  { chave: 'ebitda', rotulo: 'EBITDA', tipo: 'mi', grupo: 'resultado' },
  { chave: 'da', rotulo: 'D&A', tipo: 'mi', grupo: 'custo' },
  { chave: 'margemEbitda', rotulo: 'Mrg EBITDA', tipo: 'pct1', grupo: 'resultado' },
  { chave: 'ebit', rotulo: 'EBIT', tipo: 'mi', grupo: 'resultado' },
  { chave: 'margemEbit', rotulo: 'Mrg EBIT', tipo: 'pct1', grupo: 'resultado' },
  { chave: 'resFin', rotulo: 'Res Fin', tipo: 'mi', grupo: 'custo' },
  { chave: 'varCambial', rotulo: 'Var Cambial', tipo: 'mi', grupo: 'custo' },
  { chave: 'despJuros', rotulo: 'Desp Juros', tipo: 'mi', grupo: 'custo' },
  { chave: 'despJurosPct', rotulo: 'Desp Juros %', tipo: 'pct1', grupo: 'custo' },
  { chave: 'ebt', rotulo: 'EBT', tipo: 'mi', grupo: 'resultado' },
  { chave: 'margemEbt', rotulo: 'Mrg EBT', tipo: 'pct1', grupo: 'resultado' },
  { chave: 'impostos', rotulo: 'Impostos', tipo: 'mi', grupo: 'custo' },
  { chave: 'impostosPct', rotulo: 'Impostos %', tipo: 'pct1', grupo: 'custo' },
  { chave: 'lucro', rotulo: 'Lucro Líq', tipo: 'mi', grupo: 'resultado' },
  { chave: 'margemLiquida', rotulo: 'Mrg Líq', tipo: 'pct1', grupo: 'resultado' },
  { chave: 'capInvestido', rotulo: 'Cap Investido', tipo: 'mi', grupo: 'eva' },
  { chave: 'nopat', rotulo: 'NOPAT', tipo: 'mi', grupo: 'eva' },
  { chave: 'encargos', rotulo: 'Encargos', tipo: 'mi', grupo: 'eva' },
  { chave: 'eva', rotulo: 'EVA', tipo: 'mi', grupo: 'eva' },
  { chave: 'roic', rotulo: 'ROIC', tipo: 'pct1', grupo: 'eva' },
  { chave: 'wacc', rotulo: 'WACC', tipo: 'pct1', grupo: 'eva' },
  { chave: 'spread', rotulo: 'R x W', tipo: 'pct1', grupo: 'eva' },
  { chave: 'margemNopat', rotulo: 'Mrg Operac', tipo: 'pct1', grupo: 'eva' },
  { chave: 'evaFco', rotulo: 'FCO', tipo: 'mi', grupo: 'caixa' },
  { chave: 'evaFcf', rotulo: 'FCF', tipo: 'mi', grupo: 'caixa' },
  { chave: 'invCapInv', rotulo: 'Inv Cap Inv', tipo: 'mi', grupo: 'caixa' },
  { chave: 'capGiro', rotulo: 'Cap Giro', tipo: 'mi', grupo: 'caixa' },
  { chave: 'anc', rotulo: 'ANC', tipo: 'mi', grupo: 'caixa' },
  { chave: 'mva', rotulo: 'MVA', tipo: 'mi', grupo: 'eva' },
  { chave: 'evaPorAcao', rotulo: 'EVA/Ação', tipo: 'dec', grupo: 'eva' },
  { chave: 'divida', rotulo: 'Dívida Bruta', tipo: 'mi', grupo: 'divida' },
  { chave: 'dividaCp', rotulo: 'Curto Prazo %', tipo: 'pct1', grupo: 'divida' },
  { chave: 'dividaLp', rotulo: 'Longo Prazo %', tipo: 'pct1', grupo: 'divida' },
  { chave: 'caixaEquiv', rotulo: 'Caixa', tipo: 'mi', grupo: 'divida' },
  { chave: 'dividaLiquida', rotulo: 'Dívida Líq', tipo: 'mi', grupo: 'divida' },
  { chave: 'dlEbit', rotulo: 'DL/EBIT', tipo: 'x', grupo: 'divida' },
  { chave: 'dlEbitda', rotulo: 'DL/EBITDA', tipo: 'x', grupo: 'divida' },
  { chave: 'percCp', rotulo: 'Cap Próprio %', tipo: 'pct1', grupo: 'divida' },
  { chave: 'percCt', rotulo: 'Cap Terceiro %', tipo: 'pct1', grupo: 'divida' },
  { chave: 'divEquity', rotulo: 'D/E', tipo: 'pct1', grupo: 'divida' },
  { chave: 'taxaLivreRisco', rotulo: 'Rf', tipo: 'pct1', grupo: 'divida' },
  { chave: 'erp', rotulo: 'ERP', tipo: 'pct1', grupo: 'divida' },
  { chave: 'riscoPais', rotulo: 'Risco País', tipo: 'pct1', grupo: 'divida' },
  { chave: 'difInflacao', rotulo: 'Dif Inflação', tipo: 'pct1', grupo: 'divida' },
  // soma das quatro parcelas acima (CAPM sem beta); a coluna Ke ao lado aplica o beta
  { chave: 'keCapm', rotulo: 'Ke CAPM', tipo: 'pct1', grupo: 'divida' },
  { chave: 'custoKe', rotulo: 'Ke', tipo: 'pct1', grupo: 'divida' },
  { chave: 'custoCp', rotulo: 'Custo CP 10a', tipo: 'pct1', grupo: 'divida' },
  { chave: 'custoCt', rotulo: 'Custo CT', tipo: 'pct1', grupo: 'divida' },
  { chave: 'beta', rotulo: 'Beta', tipo: 'dec', grupo: 'divida' },
  { chave: 'roe', rotulo: 'ROE', tipo: 'pct1', grupo: 'balanco' },
  { chave: 'roeAjustado', rotulo: 'ROE Ajust', tipo: 'pct1', grupo: 'balanco' },
  { chave: 'patrimonio', rotulo: 'Patrimônio', tipo: 'mi', grupo: 'balanco' },
  { chave: 'txCrescPl', rotulo: 'Cresc PL', tipo: 'pct1', grupo: 'balanco' },
  { chave: 'txCrescRl', rotulo: 'Cresc RL', tipo: 'pct1', grupo: 'balanco' },
  { chave: 'capexSobreLl', rotulo: 'Capex/LL', tipo: 'pct1', grupo: 'balanco' },
  { chave: 'lucro10y', rotulo: 'LL 10a Médio', tipo: 'mi', grupo: 'balanco' },
  { chave: 'cpvSobreLb', rotulo: 'CPV/LB', tipo: 'pct1', grupo: 'balanco' },
  { chave: 'dvgaSobreLb', rotulo: 'DVGA/LB', tipo: 'pct1', grupo: 'balanco' },
  { chave: 'jurosSobreEbit', rotulo: 'Juros/EBIT', tipo: 'pct1', grupo: 'balanco' },
  { chave: 'margemBruta10y', rotulo: 'Mrg Bruta 10a', tipo: 'pct1', grupo: 'balanco' },
  { chave: 'valorMercado', rotulo: 'Valor Mercado', tipo: 'mi', grupo: 'mercado' },
  { chave: 'valorFirma', rotulo: 'Valor Firma', tipo: 'mi', grupo: 'mercado' },
  { chave: 'papeis', rotulo: 'Papéis (mi)', tipo: 'mi', grupo: 'mercado' },
  { chave: 'cotacaoOn', rotulo: 'Cotação ON', tipo: 'dec', grupo: 'mercado' },
  { chave: 'cotacaoPn', rotulo: 'Cotação PN', tipo: 'dec', grupo: 'mercado' },
];

// Aba fundamentalista: os anos viram colunas e os indicadores viram linhas, então aqui
// `grupo` é o título da seção, escrito por extenso, e não uma cor de cabeçalho.
const COLUNAS_FUND = [
  { chave: 'dy', rotulo: 'DY %', tipo: 'pct1', grupo: 'Valuation' },
  { chave: 'lpa', rotulo: 'LPA', tipo: 'dec', grupo: 'Valuation' },
  { chave: 'ppa', rotulo: 'PPA', tipo: 'dec', grupo: 'Valuation' },
  { chave: 'precoLucro', rotulo: 'P/L', tipo: 'dec', grupo: 'Valuation' },
  { chave: 'vpa', rotulo: 'VPA', tipo: 'dec', grupo: 'Valuation' },
  { chave: 'pvpa', rotulo: 'P/VPA', tipo: 'dec', grupo: 'Valuation' },
  { chave: 'evEbitda', rotulo: 'EV/EBITDA', tipo: 'dec', grupo: 'Valuation' },
  { chave: 'evEbit', rotulo: 'EV/EBIT', tipo: 'dec', grupo: 'Valuation' },

  { chave: 'dlEbitda', rotulo: 'DL/EBITDA', tipo: 'x', grupo: 'Endividamento' },
  { chave: 'dlEbit', rotulo: 'DL/EBIT', tipo: 'x', grupo: 'Endividamento' },
  { chave: 'divida', rotulo: 'Dívida Bruta', tipo: 'mi', grupo: 'Endividamento' },
  { chave: 'caixaEquiv', rotulo: 'Caixa', tipo: 'mi', grupo: 'Endividamento' },
  { chave: 'dividaLiquida', rotulo: 'Dívida Líquida', tipo: 'mi', grupo: 'Endividamento' },

  { chave: 'margemBruta', rotulo: 'Bruta', tipo: 'pct1', grupo: 'Eficiência · Margens %' },
  { chave: 'margemEbitda', rotulo: 'EBITDA', tipo: 'pct1', grupo: 'Eficiência · Margens %' },
  { chave: 'margemEbit', rotulo: 'EBIT', tipo: 'pct1', grupo: 'Eficiência · Margens %' },
  { chave: 'margemLiquida', rotulo: 'Líquida', tipo: 'pct1', grupo: 'Eficiência · Margens %' },

  { chave: 'roe', rotulo: 'ROE', tipo: 'pct1', grupo: 'Rentabilidade %' },
  { chave: 'roa', rotulo: 'ROA', tipo: 'pct1', grupo: 'Rentabilidade %' },
  { chave: 'roic', rotulo: 'ROIC', tipo: 'pct1', grupo: 'Rentabilidade %' },

  { chave: 'cagrReceitas', rotulo: 'Receitas', tipo: 'pct1', grupo: 'Crescimento · CAGR 5 anos %' },
  { chave: 'cagrLucros', rotulo: 'Lucros', tipo: 'pct1', grupo: 'Crescimento · CAGR 5 anos %' },
  { chave: 'cagrDividendos', rotulo: 'Dividendos', tipo: 'pct1', grupo: 'Crescimento · CAGR 5 anos %' },

  { chave: 'rta1a', rotulo: '12 meses', tipo: 'pct1', grupo: 'Retorno Total Acionista (RTA) %' },
  { chave: 'rta3a', rotulo: '3 anos', tipo: 'pct1', grupo: 'Retorno Total Acionista (RTA) %' },
  { chave: 'rta5a', rotulo: '5 anos', tipo: 'pct1', grupo: 'Retorno Total Acionista (RTA) %' },

  { chave: 'patrimonio', rotulo: 'Patrimônio Líquido', tipo: 'mi', grupo: 'Informações adicionais' },
  { chave: 'valorMercado', rotulo: 'Valor Mercado', tipo: 'mi', grupo: 'Informações adicionais' },
  { chave: 'valorFirma', rotulo: 'Valor Firma', tipo: 'mi', grupo: 'Informações adicionais' },
  { chave: 'papeis', rotulo: 'Papéis (mi)', tipo: 'mi', grupo: 'Informações adicionais' },
];

// DRE na ordem da demonstração, com `nivel` para o recuo e `forte` nos subtotais. As
// margens de cada subtotal viram linha própria: no card de um período só elas cabem
// entre parênteses no rótulo, mas aqui cada ano tem a sua.
// `grupo` só aparece na primeira linha de cada bloco — a faixa é desenhada quando o
// valor muda, e as linhas seguintes seguem no bloco aberto até a próxima declaração.
const COLUNAS_DRE = [
  { chave: 'receita', rotulo: 'Receita Líquida', tipo: 'mi', nivel: 0, forte: true, grupo: 'Receita e custos' },
  { chave: 'cpv', rotulo: 'Custo produto/serviço vendido (−)', tipo: 'mi', nivel: 1 },
  // sob o próprio CPV, como DVGA / Lucro Bruto fica sob a DVGA. O card do Apolo chama
  // de "CPV/Lucro Bruto", mas wb_custo_cpv_perc bate exatamente com CPV/receita — é o
  // complemento da margem bruta, não uma razão sobre o lucro bruto.
  { chave: 'cpvSobreLb', rotulo: 'CPV / Receita', tipo: 'pct1', nivel: 1 },
  { chave: 'lucroBruto', rotulo: 'Lucro Bruto', tipo: 'mi', nivel: 0, forte: true },
  { chave: 'margemBruta', rotulo: 'Margem bruta', tipo: 'pct1', nivel: 1 },
  { chave: 'margemBruta10y', rotulo: 'Margem bruta · média 10 anos', tipo: 'pct1', nivel: 1 },
  {
    chave: 'dvga',
    rotulo: 'D. Vendas/Gerais/Administrativas',
    tipo: 'mi',
    nivel: 1,
    grupo: 'Despesas operacionais',
    // A faixa mostra o total do bloco e abre o gráfico dele. `despesasOper` vem somado
    // do servidor: a soma das três parcelas aqui daria o mesmo número na tabela, mas o
    // gráfico precisa de uma série própria para plotar.
    grupoTotal: { chaves: ['despesasOper'], tipo: 'mi', grafico: 'despesasOper' },
  },
  { chave: 'dvgaSobreLb', rotulo: 'DVGA / Lucro Bruto', tipo: 'pct1', nivel: 1 },
  { chave: 'eqPatr', rotulo: 'Equivalência Patrimonial', tipo: 'mi', nivel: 1 },
  { chave: 'outrasRd', rotulo: 'Outras Despesas / Receitas', tipo: 'mi', nivel: 1 },
  {
    chave: 'ebitda',
    rotulo: 'EBITDA',
    tipo: 'mi',
    nivel: 0,
    forte: true,
    grupo: 'Resultado operacional/EBIT',
    // uma parcela só: a faixa carrega o próprio EBIT, que é onde o bloco desemboca
    grupoTotal: { chaves: ['ebit'], tipo: 'mi', grafico: 'ebit' },
  },
  { chave: 'margemEbitda', rotulo: 'Margem EBITDA', tipo: 'pct1', nivel: 1 },
  { chave: 'da', rotulo: 'Depreciação / Amortização', tipo: 'mi', nivel: 1 },
  { chave: 'ebit', rotulo: 'EBIT', tipo: 'mi', nivel: 0, forte: true },
  { chave: 'margemEbit', rotulo: 'Margem EBIT', tipo: 'pct1', nivel: 1 },
  { chave: 'resFin', rotulo: 'Resultado Financeiro', tipo: 'mi', nivel: 1, grupo: 'Resultado financeiro' },
  { chave: 'varCambial', rotulo: 'Variação Cambial', tipo: 'mi', nivel: 2 },
  { chave: 'despJuros', rotulo: 'Despesas com juros', tipo: 'mi', nivel: 2 },
  { chave: 'despJurosPct', rotulo: 'Despesas com juros %', tipo: 'pct1', nivel: 2 },
  // wb_perc_despesas_juros divide pelo ebit_ajustado, não pelo EBIT da linha acima
  { chave: 'jurosSobreEbit', rotulo: 'Juros / EBIT ajustado', tipo: 'pct1', nivel: 2 },
  { chave: 'ebt', rotulo: 'EBT', tipo: 'mi', nivel: 0, forte: true, grupo: 'Impostos e lucro líquido' },
  { chave: 'margemEbt', rotulo: 'Margem EBT', tipo: 'pct1', nivel: 1 },
  { chave: 'impostos', rotulo: 'Impostos', tipo: 'mi', nivel: 1 },
  { chave: 'impostosPct', rotulo: 'Impostos %', tipo: 'pct1', nivel: 1 },
  { chave: 'lucro', rotulo: 'Lucro Líquido', tipo: 'mi', nivel: 0, forte: true },
  { chave: 'margemLiquida', rotulo: 'Margem líquida', tipo: 'pct1', nivel: 1 },
  { chave: 'lucro10y', rotulo: 'Lucro líquido · média 10 anos', tipo: 'mi', nivel: 1 },
  // Não vira linha da tabela (o número já aparece na faixa da seção), mas existe como
  // coluna para o gráfico da faixa e para a lista de "comparar com".
  { chave: 'despesasOper', rotulo: 'Despesas operacionais (total)', tipo: 'mi', oculta: true },
];

const ABAS = [
  { id: 'kpi', rotulo: 'Indicadores', colunas: COLUNAS_KPI },
  { id: 'eva', rotulo: 'EVA', colunas: COLUNAS_EVA },
  { id: 'fund', rotulo: 'Fundamentalistas', colunas: COLUNAS_FUND, layout: 'transposta' },
  { id: 'dre', rotulo: 'DRE Resumida', colunas: COLUNAS_DRE, layout: 'transposta' },
];

const MS_ANO = 365.25 * 24 * 60 * 60 * 1000;

let DADOS = null; // guardado para recalcular a variação sem refazer o fetch
let ABA = ABAS[0];

const COLUNAS = () => ABA.colunas;

function formata(valor, tipo) {
  if (tipo === 'texto') return esc(valor);
  if (valor === null || valor === undefined) return '—';
  if (tipo === 'mi') return fmtMi.format(valor);
  if (tipo === 'pct0') return `${Math.round(valor)}%`;
  if (tipo === 'pct1') return `${fmt1.format(valor)}%`;
  if (tipo === 'x') return fmt1.format(valor);
  if (tipo === 'dec') return fmt2.format(valor);
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
  // Beta, cotação e EVA/ação (`dec`) são níveis como os valores em milhões, e compõem.
  if (coluna.tipo === 'pct0' || coluna.tipo === 'pct1' || coluna.tipo === 'x') {
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
  const celulas = COLUNAS().map((coluna, i) => {
    if (i === 0) return `<td class="emp-periodo">${esc(rotulo)}</td>`;
    const r = celulaVariacao(coluna, ini, fim, anos, modo);
    const classes = ['emp-num', typeof r.valor === 'number' && r.valor < 0 ? 'neg' : ''].join(' ');
    const dica = r.dica ? ` title="${esc(r.dica)}"` : '';
    return `<td class="${classes}"${dica}>${r.texto}</td>`;
  }).join('');
  return `<tr class="emp-var emp-var-${modo}">${celulas}</tr>`;
}

function atualizaVariacao() {
  const seletorDe = document.getElementById('empDe');
  const rodape = document.getElementById('empRodape');
  // sem seletor: empresa com um único período. Sem rodapé: tabela transposta, onde o
  // período é coluna e estas duas linhas de variação não existem.
  if (!DADOS || !seletorDe || !rodape) return;
  const linhas = DADOS.linhas;
  const iIni = Number(seletorDe.value);
  const iFim = Number(document.getElementById('empAte').value);
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
  const c = COLUNAS()[coluna];
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

  // Abre o histórico: pelo cabeçalho da coluna nas abas normais, pela linha na
  // fundamentalista, onde o indicador é a linha e não a coluna.
  conteudoEl.addEventListener('click', (ev) => {
    const linha = ev.target.closest('tr[data-ind]');
    if (linha) return abreGrafico(Number(linha.dataset.ind));
    // só o cabeçalho: na tabela transposta o rótulo da linha também é um <th>
    const th = ev.target.closest('thead th');
    if (!th || !conteudoEl.contains(th)) return;
    return abreGrafico([...th.parentElement.children].indexOf(th));
  });

  modalEl.addEventListener('click', (ev) => {
    if (ev.target.closest('.emp-modal-x') || ev.target.classList.contains('emp-modal-fundo')) {
      fechaGrafico();
      return;
    }
    if (ev.target.closest('#empFav')) {
      alternaFavorito();
      return;
    }
    const tirar = ev.target.closest('[data-remover]');
    if (tirar) {
      const i = Number(tirar.dataset.remover);
      grafico.series = grafico.series.filter((s) => s !== i);
      renderModal();
      return;
    }
    const botao = ev.target.closest('.emp-seg button');
    if (!botao) return;
    if (botao.dataset.tipo) grafico.tipo = botao.dataset.tipo;
    if (botao.dataset.anos) grafico.anos = botao.dataset.anos === 'tudo' ? 'tudo' : Number(botao.dataset.anos);
    renderModal();
  });

  modalEl.addEventListener('mousemove', (ev) => {
    if (ev.target.closest('.emp-grafico')) moveDica(ev);
    else escondeDica();
  });
  modalEl.addEventListener('mouseleave', escondeDica);

  modalEl.addEventListener('change', (ev) => {
    if (ev.target.id === 'empAnom') grafico.ignorar = ev.target.checked;
    else if (ev.target.id === 'empComp') {
      if (ev.target.value === '') return;
      grafico.series = [...grafico.series, Number(ev.target.value)];
    } else return;
    renderModal();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    fechaBalao();
    fechaGrafico();
  });
}

// ---- Histórico do indicador: clique no cabeçalho da coluna ----

// `ignorar` começa desligado: o gráfico abre mostrando a série inteira, e esconder
// período é decisão de quem olha. O filtro continua a um clique, para quando um
// exercício atípico esticar a escala e achatar todo o resto.
const grafico = { coluna: null, series: [], tipo: 'barra', ignorar: false, anos: 'tudo' };

const JANELAS = [5, 10, 15];

// Geometria do último gráfico desenhado, para o hover achar o período sob o mouse sem
// precisar de um elemento por barra.
let GEO = null;

// A janela conta exercícios encerrados e sempre mantém o TTM: "5 anos" é meia década
// fechada mais onde a empresa está hoje, que é a leitura que a barra "Atual" pede.
function janela(linhas) {
  if (grafico.anos === 'tudo') return linhas;
  const mantidos = new Set(linhas.filter((l) => !l.ttm).slice(-grafico.anos));
  return linhas.filter((l) => l.ttm || mantidos.has(l));
}

const rotuloCurto = (l) => (l.ttm ? 'TTM' : String(l.ano ?? periodo(l)));

function quantil(ordenados, q) {
  if (!ordenados.length) return null;
  const pos = (ordenados.length - 1) * q;
  const base = Math.floor(pos);
  const seguinte = ordenados[base + 1];
  if (seguinte === undefined) return ordenados[base];
  return ordenados[base] + (pos - base) * (seguinte - ordenados[base]);
}

const media = (vs) => (vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null);

// Tukey: fora de [Q1 − 1,5·IQR, Q3 + 1,5·IQR]. Com menos de 5 pontos o intervalo é
// instável demais — um valor legítimo viraria "anomalia" e sumiria do gráfico.
function limitesAnomalia(valores) {
  if (valores.length < 5) return null;
  const ord = [...valores].sort((a, b) => a - b);
  const q1 = quantil(ord, 0.25);
  const q3 = quantil(ord, 0.75);
  const iqr = q3 - q1;
  if (!(iqr > 0)) return null;
  return { min: q1 - 1.5 * iqr, max: q3 + 1.5 * iqr };
}

function pontosDoIndicador(indice) {
  const coluna = COLUNAS()[indice];
  const ponto = (l) => ({ rotulo: rotuloCurto(l), valor: l[coluna.chave] });
  const numerico = (p) => typeof p.valor === 'number';
  const serieCheia = DADOS.linhas.map(ponto).filter(numerico);
  const todos = janela(DADOS.linhas).map(ponto).filter(numerico);
  // Os limites saem da série inteira, mesmo com a janela apertada: calculados só sobre
  // 5 anos os quartis ficam tão estreitos que um bom ano vira "anomalia" — o EBITDA de
  // 2022 da PETR4 era cortado ao escolher 5 anos e voltava ao escolher 10.
  const limites = grafico.ignorar ? limitesAnomalia(serieCheia.map((p) => p.valor)) : null;
  const mostrados = limites
    ? todos.filter((p) => p.valor >= limites.min && p.valor <= limites.max)
    : todos;
  return { coluna, todos, mostrados, ocultos: todos.length - mostrados.length, serieCheia };
}

// `dir` é folgado porque o rótulo da mediana mora na margem direita: em cima da área do
// gráfico ele batia nas barras dos últimos anos, justamente onde a linha costuma passar.
const G = { w: 960, h: 380, esq: 68, dir: 92, topo: 26, base: 38 };

// Escala com marcas em 1, 2 ou 5 vezes uma potência de 10: sem isto o eixo sai com
// rótulos como 137.428, que não ajudam a ler nada.
function passoBonito(bruto) {
  const expoente = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / expoente;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * expoente;
}

// Fecha a escala em exatamente `faixas` divisões: com dois indicadores os dois eixos
// precisam do mesmo número de marcas, senão a grade da esquerda não bate com a da direita.
const FAIXAS = 5;

function escalaY(valores, faixas = FAIXAS) {
  const min = Math.min(0, ...valores); // barra sempre nasce do zero
  const max = Math.max(0, ...valores);
  let passo = passoBonito(((max - min) || Math.abs(max) || 1) / faixas);
  for (let i = 0; i < 8; i += 1) {
    const base = Math.floor(min / passo) * passo;
    if (base + passo * faixas >= max - 1e-9) return { min: base, max: base + passo * faixas, passo };
    passo = passoBonito(passo * 1.5); // não coube nas faixas: sobe para o próximo passo redondo
  }
  return { min, max, passo: (max - min) / faixas };
}

// Segundo indicador nos mesmos períodos do primeiro: o eixo x é compartilhado, então
// quem manda no recorte (janela + anomalias) é sempre a série que foi clicada.
function serieAlinhada(indice, mostrados) {
  const coluna = COLUNAS()[indice];
  const porRotulo = new Map(DADOS.linhas.map((l) => [rotuloCurto(l), l]));
  const valores = mostrados.map((p) => {
    const linha = porRotulo.get(p.rotulo);
    const v = linha ? linha[coluna.chave] : null;
    return typeof v === 'number' ? v : null;
  });
  return { coluna, valores, presentes: valores.filter((v) => v !== null) };
}

const CORES = 6; // --c0 a --c5 no CSS; a partir da sexta série a paleta repete
const numero = (v) => typeof v === 'number';

// pct0 e pct1 são a mesma unidade, só mudam as casas decimais
const unidade = (tipo) => (tipo === 'pct0' || tipo === 'pct1' ? 'pct' : tipo);
const mesmaUnidade = (a, b) => unidade(a) === unidade(b);

// A primeira série é sempre a coluna clicada; as demais vêm do seletor, na ordem em
// que foram adicionadas (que é a ordem em que empilham, de baixo para cima).
function seriesDoGrafico(dados) {
  return [grafico.coluna, ...grafico.series].map((indice, ordem) => ({
    coluna: COLUNAS()[indice],
    valores: ordem === 0
      ? dados.mostrados.map((p) => p.valor)
      : serieAlinhada(indice, dados.mostrados).valores,
    cor: ordem % CORES,
  }));
}

function desenhaLinha(serie, y, cx) {
  const validos = serie.valores.map((v, i) => ({ v, i })).filter((p) => numero(p.v));
  if (!validos.length) return '';
  const pts = validos.map((p) => `${cx(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return `<polyline class="g-linha g-s${serie.cor}" points="${pts}"/>
    ${validos.map((p) => `<circle class="g-ponto g-s${serie.cor}" cx="${cx(p.i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.5"/>`).join('')}`;
}

// `fatias` maior que 1 reparte a banda entre as séries, lado a lado
function desenhaBarras(serie, y, cx, banda, fatias, posicao) {
  const largura = Math.min(46, banda * 0.62) / fatias;
  const desloc = (posicao - (fatias - 1) / 2) * largura;
  const y0 = y(0);
  return serie.valores.map((v, i) => {
    if (!numero(v)) return '';
    const yv = y(v);
    return `<rect class="g-barra g-s${serie.cor}${fatias === 1 && v < 0 ? ' neg' : ''}" x="${(cx(i) + desloc - largura / 2).toFixed(1)}"
      y="${Math.min(yv, y0).toFixed(1)}" width="${largura.toFixed(1)}"
      height="${Math.max(Math.abs(yv - y0), 1).toFixed(1)}" rx="2"/>`;
  }).join('');
}

// Positivos sobem a partir do zero, negativos descem: uma pilha com sinais trocados
// que empilhasse tudo na mesma direção mostraria um total que não existe.
function desenhaPilha(series, y, cx, banda, i) {
  const largura = Math.min(46, banda * 0.62);
  let cima = 0;
  let baixo = 0;
  return series.map((s) => {
    const v = s.valores[i];
    if (!numero(v) || v === 0) return '';
    const de = v >= 0 ? cima : baixo;
    const ate = de + v;
    if (v >= 0) cima = ate; else baixo = ate;
    const topo = y(Math.max(de, ate));
    const base = y(Math.min(de, ate));
    return `<rect class="g-barra g-s${s.cor}" x="${(cx(i) - largura / 2).toFixed(1)}"
      y="${topo.toFixed(1)}" width="${largura.toFixed(1)}" height="${Math.max(base - topo, 1).toFixed(1)}"/>`;
  }).join('');
}

function desenhaGrafico(dados) {
  const { mostrados } = dados;
  if (!mostrados.length) return '<p class="emp-grafico-vazio">Sem valores para este indicador.</p>';

  const series = seriesDoGrafico(dados);
  const empilhada = grafico.tipo === 'empilhada';
  // Dois eixos só cabem com duas séries. Com três ou mais não há margem para outro eixo,
  // e empilhar exige escala única de qualquer jeito — a soma precisa ter significado.
  const duplo = series.length === 2 && !empilhada;
  const principal = series[0];

  const pw = G.w - G.esq - G.dir;
  const ph = G.h - G.topo - G.base;
  const banda = pw / mostrados.length;
  const cx = (i) => G.esq + banda * (i + 0.5);
  const mediana = quantil([...principal.valores].sort((a, b) => a - b), 0.5);

  const pilhas = empilhada ? mostrados.map((_, i) => {
    let pos = 0;
    let neg = 0;
    series.forEach((s) => {
      const v = s.valores[i];
      if (numero(v)) { if (v >= 0) pos += v; else neg += v; }
    });
    return { pos, neg, total: pos + neg };
  }) : null;

  let escala;
  if (empilhada) escala = escalaY(pilhas.flatMap((p) => [p.pos, p.neg]));
  else if (duplo) escala = escalaY([...principal.valores, mediana]);
  else escala = escalaY([...series.flatMap((s) => s.valores).filter(numero), mediana]);

  const escala2 = duplo && series[1].valores.some(numero)
    ? escalaY(series[1].valores.filter(numero))
    : null;

  const y = (v) => G.topo + ph - ((v - escala.min) / (escala.max - escala.min)) * ph;
  const y2 = (v) => G.topo + ph - ((v - escala2.min) / (escala2.max - escala2.min)) * ph;
  const rotulo = (v) => formata(+v.toFixed(6), principal.coluna.tipo);

  let grade = '';
  for (let k = 0; k <= FAIXAS; k += 1) {
    const v = escala.min + k * escala.passo;
    const classe = Math.abs(v) < escala.passo / 1000 ? 'g-zero' : 'g-grade';
    grade += `<line class="${classe}" x1="${G.esq}" y1="${y(v)}" x2="${G.esq + pw}" y2="${y(v)}"/>
      <text class="g-eixo" x="${G.esq - 8}" y="${y(v) + 3.5}">${rotulo(v)}</text>`;
    if (escala2) {
      const v2 = escala2.min + k * escala2.passo;
      grade += `<text class="g-eixo2" x="${G.esq + pw + 8}" y="${y(v) + 3.5}">${formata(+v2.toFixed(6), series[1].coluna.tipo)}</text>`;
    }
  }

  let desenho;
  if (empilhada) {
    desenho = mostrados.map((_, i) => desenhaPilha(series, y, cx, banda, i)).join('');
  } else if (duplo) {
    // eixo duplo pede barra + linha: duas barras com escalas diferentes lado a lado
    // convidam a comparar alturas que não são comparáveis
    desenho = grafico.tipo === 'linha'
      ? desenhaBarras(series[1], y2, cx, banda, 1, 0) + desenhaLinha(principal, y, cx)
      : desenhaBarras(principal, y, cx, banda, 1, 0) + desenhaLinha(series[1], y2, cx);
  } else if (grafico.tipo === 'linha') {
    desenho = series.map((s) => desenhaLinha(s, y, cx)).join('');
  } else {
    desenho = series.map((s, k) => desenhaBarras(s, y, cx, banda, series.length, k)).join('');
  }

  // Um indicador: valor em cada ponto. Empilhada: o total da pilha, que é o que a
  // soma quer dizer. Nos outros casos o rótulo por série vira ruído.
  let rotulosValor = '';
  if (series.length === 1) {
    rotulosValor = mostrados.map((p, i) => {
      const dy = p.valor >= 0 ? -7 : 13; // por fora da barra: por dentro some nas curtas
      return `<text class="g-valor" x="${cx(i).toFixed(1)}" y="${(y(p.valor) + dy).toFixed(1)}">${rotulo(p.valor)}</text>`;
    }).join('');
  } else if (empilhada) {
    rotulosValor = pilhas.map((p, i) => {
      const topo = p.pos !== 0 || p.neg === 0 ? p.pos : p.neg;
      const dy = topo >= 0 ? -7 : 13;
      return `<text class="g-valor" x="${cx(i).toFixed(1)}" y="${(y(topo) + dy).toFixed(1)}">${rotulo(p.total)}</text>`;
    }).join('');
  }

  const periodos = mostrados
    .map((p, i) => `<text class="g-periodo" x="${cx(i).toFixed(1)}" y="${G.topo + ph + 18}">${esc(p.rotulo)}</text>`)
    .join('');

  // Na empilhada a mediana é de uma série só contra uma escala de somas: não diz nada.
  // Sem eixo à direita, a margem sobra para o rótulo dela.
  let marcaMediana = '';
  if (!empilhada) {
    marcaMediana = escala2
      ? `<line class="g-mediana" x1="${G.esq}" y1="${y(mediana).toFixed(1)}" x2="${G.esq + pw}" y2="${y(mediana).toFixed(1)}"/>`
      : `<line class="g-mediana" x1="${G.esq}" y1="${y(mediana).toFixed(1)}" x2="${G.esq + pw + 6}" y2="${y(mediana).toFixed(1)}"/>
         <text class="g-mediana-rot" x="${G.esq + pw + 10}" y="${(y(mediana) - 2).toFixed(1)}">mediana</text>
         <text class="g-mediana-val" x="${G.esq + pw + 10}" y="${(y(mediana) + 11).toFixed(1)}">${rotulo(mediana)}</text>`;
  }

  const titulos = escala2
    ? `<text class="g-titulo-eixo" x="${G.esq - 8}" y="14">${esc(principal.coluna.rotulo)}</text>
       <text class="g-titulo-eixo2" x="${G.esq + pw + 8}" y="14">${esc(series[1].coluna.rotulo)}</text>`
    : '';

  GEO = {
    banda,
    topo: G.topo,
    alturaPlot: ph,
    rotulos: mostrados.map((p) => p.rotulo),
    series: series.map((s) => ({ nome: s.coluna.rotulo, tipo: s.coluna.tipo, valores: s.valores, cor: s.cor })),
    totais: pilhas ? pilhas.map((p) => p.total) : null,
    tipoTotal: principal.coluna.tipo,
  };

  return `<svg viewBox="0 0 ${G.w} ${G.h}" class="emp-svg" role="img"
      aria-label="histórico de ${esc(series.map((s) => s.coluna.rotulo).join(', '))}">
    ${grade}
    <rect id="empFaixa" class="g-faixa oculto" y="${G.topo}" height="${ph}" width="${banda.toFixed(1)}" x="0"/>
    ${titulos}
    ${marcaMediana}
    ${desenho}
    ${rotulosValor}
    ${periodos}
  </svg>`;
}

function tile(nome, valor, tipo) {
  const texto = valor === null || valor === undefined ? '—' : formata(valor, tipo);
  return `<div class="emp-tile"><span>${esc(nome)}</span><strong>${texto}</strong></div>`;
}

function renderModal() {
  const dados = pontosDoIndicador(grafico.coluna);
  const { coluna } = dados;
  const valores = dados.mostrados.map((p) => p.valor);
  const ordenados = [...valores].sort((a, b) => a - b);
  const atual = dados.todos.length ? dados.todos[dados.todos.length - 1].valor : null;
  let nota;
  if (dados.ocultos) {
    nota = `${dados.ocultos} período${dados.ocultos > 1 ? 's' : ''} fora do intervalo de Tukey (Q1−1,5·IQR a Q3+1,5·IQR) — desmarque acima para ver.`;
  } else if (!grafico.ignorar) {
    // sem o filtro ligado nada foi avaliado: dizer que não há anomalia seria mentira
    nota = 'Série completa. Marque "Ignorar anomalias" para esconder períodos fora do intervalo de Tukey.';
  } else if (dados.serieCheia.length < 5) {
    nota = 'Períodos de menos para avaliar anomalias — o filtro precisa de pelo menos 5.';
  } else {
    nota = 'Nenhum período fora do intervalo esperado.';
  }

  // Séries que dividem o mesmo eixo precisam da mesma unidade: somar (ou comparar altura
  // de) um percentual com um valor em milhões não diz nada — empilhar Mrg Bruta com
  // Impostos dava um "total" de −3.541%. Com duas séries o eixo duplo resolve; a partir
  // da terceira, e sempre na empilhada, a unidade tem que bater com a do indicador clicado.
  const divideEixo = grafico.tipo === 'empilhada' || grafico.series.length >= 2;
  let expulsas = 0;
  if (divideEixo) {
    const antes = grafico.series.length;
    grafico.series = grafico.series.filter((i) => mesmaUnidade(COLUNAS()[i].tipo, coluna.tipo));
    expulsas = antes - grafico.series.length;
  }

  let notaSeries = '';
  if (expulsas) {
    notaSeries = ` ${expulsas} indicador${expulsas > 1 ? 'es saíram' : ' saiu'} do gráfico: aqui as séries dividem o mesmo eixo, e só entram as da mesma unidade do indicador clicado.`;
  } else if (grafico.series.length) {
    if (grafico.tipo === 'empilhada') {
      notaSeries = ' Empilhada: todos dividem a mesma escala e o rótulo em cima é a soma do período.';
    } else if (grafico.series.length === 1) {
      notaSeries = ' Os tiles e a mediana são do indicador clicado; o segundo tem eixo próprio à direita.';
    } else {
      notaSeries = ' Com três ou mais indicadores todos dividem a escala da esquerda; os tiles e a mediana são do clicado.';
    }
  }

  // exercícios disponíveis: não adianta oferecer 15 anos para quem só tem 8 na base
  const exercicios = DADOS.linhas.filter((l) => !l.ttm).length;
  const opcoesJanela = [...JANELAS.filter((n) => n < exercicios), 'tudo']
    .map((n) => `<button type="button" data-anos="${n}"${String(grafico.anos) === String(n) ? ' class="ativo"' : ''}>${n === 'tudo' ? 'Tudo' : `${n} anos`}</button>`)
    .join('');

  const favorito = ehFavorito();
  const modelo = ehModelo(); // combinação que já vem no código: não há o que salvar
  const usadas = [grafico.coluna, ...grafico.series];
  // a próxima a entrar já divide eixo se for a terceira, ou se o gráfico for empilhado
  const proximaDivideEixo = grafico.tipo === 'empilhada' || grafico.series.length >= 1;
  const opcoesComp = COLUNAS()
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => c.tipo !== 'texto' && !usadas.includes(i)
      && (!proximaDivideEixo || mesmaUnidade(c.tipo, coluna.tipo)))
    .map(({ c, i }) => `<option value="${i}">${esc(c.rotulo)}</option>`)
    .join('');
  // o indicador clicado abre a lista e não sai por aqui: para trocá-lo, clica-se noutra coluna
  const fichas = usadas.map((i, ordem) => {
    const c = COLUNAS()[i];
    const cor = `var(--c${ordem % CORES})`;
    const x = ordem === 0 ? '' : `<button type="button" class="emp-ficha-x" data-remover="${i}" aria-label="tirar ${esc(c.rotulo)}">×</button>`;
    return `<span class="emp-ficha"><i class="emp-ficha-cor" style="background:${cor}"></i>${esc(c.rotulo)}${x}</span>`;
  }).join('');

  modalEl.innerHTML = `
    <div class="emp-modal-fundo"></div>
    <div class="emp-modal-caixa" role="dialog" aria-modal="true">
      <header class="emp-modal-topo">
        <h2>Histórico de Indicadores · ${esc(TICKER)}</h2>
        <button type="button" class="emp-modal-x" aria-label="fechar">×</button>
      </header>
      <div class="emp-modal-ctrl">
        <span class="emp-modal-ind">
          <span class="emp-modal-ind-rot">Indicador</span>
          <strong>${esc(coluna.rotulo)}</strong>
        </span>
        <div class="emp-seg emp-modal-anos">${opcoesJanela}</div>
        <label class="emp-modal-anom">
          <input type="checkbox" id="empAnom"${grafico.ignorar ? ' checked' : ''}> Ignorar anomalias
        </label>
        <div class="emp-seg emp-modal-tipo">
          <button type="button" data-tipo="linha"${grafico.tipo === 'linha' ? ' class="ativo"' : ''}>Linhas</button>
          <button type="button" data-tipo="barra"${grafico.tipo === 'barra' ? ' class="ativo"' : ''}>Barra</button>
          <button type="button" data-tipo="empilhada"${grafico.tipo === 'empilhada' ? ' class="ativo"' : ''}>Empilhada</button>
        </div>
      </div>
      <div class="emp-tiles">
        ${tile('Valor atual', atual, coluna.tipo)}
        ${tile('Mediana', quantil(ordenados, 0.5), coluna.tipo)}
        ${tile('Média', media(valores), coluna.tipo)}
      </div>
      <div class="emp-modal-comp">
        <div class="emp-fichas">${fichas}</div>
        ${opcoesComp ? `<select id="empComp" aria-label="adicionar indicador">
          <option value="">+ indicador…</option>
          ${opcoesComp}
        </select>` : ''}
        ${modelo
    ? '<span class="emp-fav-btn modelo">Modelo da galeria</span>'
    : `<button type="button" id="empFav" class="emp-fav-btn${favorito ? ' ativo' : ''}">
          ${favorito ? '★ Salvo' : '☆ Salvar'}
        </button>`}
      </div>
      <div class="emp-grafico">${desenhaGrafico(dados)}</div>
      <p class="emp-modal-nota">${esc(nota)}${esc(notaSeries)}</p>
    </div>`;
  modalEl.hidden = false;
}

function escondeDica() {
  dicaEl.hidden = true;
  const faixa = modalEl.querySelector('#empFaixa');
  if (faixa) faixa.classList.add('oculto');
}

// O SVG é responsivo (viewBox de 960 esticado até a largura da caixa), então a posição
// do mouse vem em pixels de tela e volta para o sistema do desenho pela razão das larguras.
function moveDica(ev) {
  const svg = modalEl.querySelector('.emp-svg');
  if (!svg || !GEO) return escondeDica();
  const caixa = svg.getBoundingClientRect();
  const escalaTela = caixa.width / G.w;
  const x = (ev.clientX - caixa.left) / escalaTela;
  const yDesenho = (ev.clientY - caixa.top) / escalaTela;
  const i = Math.floor((x - G.esq) / GEO.banda);
  const dentro = i >= 0 && i < GEO.rotulos.length
    && yDesenho >= GEO.topo && yDesenho <= GEO.topo + GEO.alturaPlot;
  if (!dentro) return escondeDica();

  const faixa = svg.querySelector('#empFaixa');
  if (faixa) {
    faixa.setAttribute('x', (G.esq + GEO.banda * i).toFixed(1));
    faixa.classList.remove('oculto');
  }

  const linhas = GEO.series.map((serie) => {
    const v = serie.valores[i];
    return `<div class="emp-dica-linha">
      <i class="emp-dica-cor" style="background:var(--c${serie.cor})"></i>
      <span class="emp-dica-nome">${esc(serie.nome)}</span>
      <span class="emp-dica-val">${typeof v === 'number' ? formata(v, serie.tipo) : '—'}</span>
    </div>`;
  }).join('');
  const total = GEO.totais
    ? `<div class="emp-dica-linha emp-dica-total">
        <span class="emp-dica-nome">Total</span>
        <span class="emp-dica-val">${formata(GEO.totais[i], GEO.tipoTotal)}</span>
      </div>`
    : '';
  dicaEl.innerHTML = `<p class="emp-dica-per">${esc(GEO.rotulos[i])}</p>${linhas}${total}`;

  dicaEl.hidden = false;
  const larg = dicaEl.offsetWidth;
  const alt = dicaEl.offsetHeight;
  dicaEl.style.left = `${Math.max(8, Math.min(ev.clientX + 16, innerWidth - larg - 8))}px`;
  dicaEl.style.top = `${Math.max(8, Math.min(ev.clientY + 16, innerHeight - alt - 8))}px`;
  return undefined;
}

function abreGrafico(i) {
  const c = COLUNAS()[i];
  if (!c || c.tipo === 'texto') return undefined;
  grafico.coluna = i;
  grafico.series = grafico.series.filter((s) => s !== i); // não se compara consigo mesmo
  renderModal();
  return undefined;
}

function fechaGrafico() {
  modalEl.hidden = true;
  modalEl.innerHTML = '';
  GEO = null;
  escondeDica();
}

// ---- Abas ----
// As duas abas leem as mesmas linhas, só mudam as colunas: trocar de aba não refaz o
// fetch nem perde o período escolhido, é só redesenhar a tabela com o outro conjunto.
function renderAbas() {
  abasEl.innerHTML = ABAS
    .map((a) => `<button type="button" class="emp-aba${a.id === ABA.id ? ' ativa' : ''}" data-aba="${a.id}">${esc(a.rotulo)}</button>`)
    .join('');
  abasEl.hidden = false;
  abasEl.addEventListener('click', (ev) => {
    const botao = ev.target.closest('.emp-aba');
    if (!botao) return;
    const nova = ABAS.find((a) => a.id === botao.dataset.aba);
    if (!nova || nova.id === ABA.id) return;
    fechaGrafico(); // o índice da coluna aberta era o da outra aba
    grafico.series = [];
    trocaAba(nova);
  });
}

// Só a tabela: quem chama decide o que fazer com o gráfico aberto — trocar de aba pelo
// botão fecha, mas abrir um favorito de outra aba precisa manter.
function trocaAba(nova) {
  ABA = nova;
  abasEl.querySelectorAll('.emp-aba').forEach((b) => {
    b.classList.toggle('ativa', b.dataset.aba === ABA.id);
  });
  fechaBalao();
  conteudoEl.innerHTML = renderTabela(DADOS);
  atualizaVariacao();
  renderGaleria(); // a barra é filtrada pela aba
  // De/Até e o rodapé de variação pressupõem períodos em linhas: na tabela transposta
  // o período é a coluna, e arrastar ou marcar duas pontas não teria o mesmo sentido
  controlesEl.hidden = Boolean(ABA.layout);
}

// ---- Galeria de gráficos ----
// Os modelos vêm no código, então aparecem para qualquer um que abrir a página, em
// qualquer máquina. Os favoritos pessoais (localStorage) entram depois deles na barra.
// Tudo aqui guarda a chave da coluna, nunca o índice: índice muda de aba para aba e
// mudaria de novo se a tabela ganhasse colunas, e o gráfico abriria o indicador errado.
const MODELOS = [
  // --- aba de indicadores ---
  { aba: 'kpi', nome: 'Receita × Lucro', chaves: ['receita', 'lucro'], tipo: 'barra' },
  { aba: 'kpi', nome: 'Margens', chaves: ['margemEbitda', 'margemLiquida'], tipo: 'linha' },
  { aba: 'kpi', nome: 'Geração de Caixa', chaves: ['fco', 'capex', 'fcl'], tipo: 'barra' },
  { aba: 'kpi', nome: 'FCL × FCL Yield', chaves: ['fcl', 'fclYield'], tipo: 'barra' },
  { aba: 'kpi', nome: 'Proventos × DY', chaves: ['proventos', 'dy'], tipo: 'barra' },
  { aba: 'kpi', nome: 'Endividamento', chaves: ['divida', 'dlEbitda'], tipo: 'barra' },
  { aba: 'kpi', nome: 'ROE', chaves: ['roe'], tipo: 'barra' },
  // --- aba de EVA ---
  { aba: 'eva', nome: 'EVA · Spread', chaves: ['roic', 'wacc', 'spread'], tipo: 'linha' },
  { aba: 'eva', nome: 'NOPAT × Capital Investido', chaves: ['nopat', 'capInvestido'], tipo: 'barra' },
  { aba: 'eva', nome: 'Margem Operacional', chaves: ['margemNopat'], tipo: 'barra' },
  { aba: 'eva', nome: 'Representatividade do Capital', chaves: ['patrimonio', 'divida'], tipo: 'empilhada' },
  { aba: 'eva', nome: 'Estrutura de Capital', chaves: ['percCp', 'percCt'], tipo: 'empilhada' },
  { aba: 'eva', nome: 'Índice D/E', chaves: ['divEquity'], tipo: 'barra' },
  { aba: 'eva', nome: 'Custo de Capital', chaves: ['custoCp', 'custoCt', 'wacc'], tipo: 'linha' },
  { aba: 'eva', nome: 'WACC', chaves: ['wacc'], tipo: 'barra' },
  // as parcelas do CAPM sem multiplicar o ERP pelo beta: o total da pilha é o custo de
  // capital próprio de mercado, igual para todas as empresas. O Ke da tabela, esse sim,
  // aplica o beta da empresa e por isso não bate com a soma.
  {
    aba: 'eva',
    nome: 'Custo de Capital Próprio (s/ beta)',
    chaves: ['taxaLivreRisco', 'erp', 'riscoPais', 'difInflacao'],
    tipo: 'empilhada',
  },
  { aba: 'eva', nome: 'Valor de Mercado × Spread', chaves: ['valorMercado', 'spread'], tipo: 'linha' },
  { aba: 'eva', nome: 'EVA', chaves: ['eva'], tipo: 'barra' },
].map((m) => ({ anos: 'tudo', ignorar: false, ...m })); // janela e filtro padrão, se o modelo não disser outra coisa

const FAVS_CHAVE = 'market-dashboard:graficos-favoritos';

function leFavoritos() {
  try {
    const cru = JSON.parse(localStorage.getItem(FAVS_CHAVE));
    return Array.isArray(cru) ? cru : [];
  } catch (err) {
    return []; // json estragado ou storage bloqueado: começa vazio
  }
}

let FAVORITOS = leFavoritos();

function gravaFavoritos() {
  try {
    localStorage.setItem(FAVS_CHAVE, JSON.stringify(FAVORITOS));
  } catch (err) {
    // navegação privada ou storage cheio: o favorito ainda vale nesta sessão
  }
}

const configAtual = () => ({
  aba: ABA.id,
  chaves: [grafico.coluna, ...grafico.series].map((i) => COLUNAS()[i].chave),
  tipo: grafico.tipo,
  anos: grafico.anos,
  ignorar: grafico.ignorar,
});

const assinatura = (f) => `${f.aba}|${f.chaves.join(',')}|${f.tipo}`;

// Modelo tem nome próprio, escrito no código. Favorito pessoal não guarda nome: sai dos
// rótulos atuais, para renomear uma coluna não deixar um apelido morto na barra.
function nomeConfig(f) {
  if (f.nome) return f.nome;
  const aba = ABAS.find((a) => a.id === f.aba);
  if (!aba) return '';
  const rotulos = f.chaves
    .map((ch) => (aba.colunas.find((c) => c.chave === ch) || {}).rotulo)
    .filter(Boolean);
  return rotulos.length === f.chaves.length ? rotulos.join(' × ') : '';
}

// A barra mostra só o que serve para a aba aberta — um modelo de EVA não abre na tabela
// de indicadores, porque as colunas não existem lá.
function galeriaDaAba() {
  const daAba = (f) => f.aba === ABA.id && f.chaves.every((ch) => COLUNAS().some((c) => c.chave === ch));
  // favorito que repete um modelo não vira ficha própria: apareceria duas vezes na barra
  const jaNaGaleria = (cfg) => MODELOS.some((m) => assinatura(m) === assinatura(cfg));
  return [
    ...MODELOS.filter(daAba).map((cfg, i) => ({ cfg, id: `m:${i}`, pessoal: false })),
    ...FAVORITOS
      .map((cfg, i) => ({ cfg, id: `f:${i}`, pessoal: true }))
      .filter((x) => daAba(x.cfg) && !jaNaGaleria(x.cfg)),
  ];
}

const ehModelo = () => MODELOS.some((m) => assinatura(m) === assinatura(configAtual()));
const ehFavorito = () => FAVORITOS.some((f) => assinatura(f) === assinatura(configAtual()));

function alternaFavorito() {
  const atual = configAtual();
  const chave = assinatura(atual);
  FAVORITOS = FAVORITOS.some((f) => assinatura(f) === chave)
    ? FAVORITOS.filter((f) => assinatura(f) !== chave)
    : [...FAVORITOS, atual];
  gravaFavoritos();
  renderGaleria();
  renderModal();
}

function aplicaConfig(id) {
  const item = galeriaDaAba().find((x) => x.id === id);
  if (!item) return;
  const f = item.cfg;
  const aba = ABAS.find((a) => a.id === f.aba);
  if (aba && aba.id !== ABA.id) trocaAba(aba);
  const indices = f.chaves.map((ch) => COLUNAS().findIndex((c) => c.chave === ch));
  if (indices.some((i) => i < 0)) return;
  grafico.coluna = indices[0];
  grafico.series = indices.slice(1);
  grafico.tipo = f.tipo;
  grafico.anos = f.anos;
  grafico.ignorar = f.ignorar;
  renderModal();
}

function renderGaleria() {
  const fichas = galeriaDaAba().map(({ cfg, id, pessoal }) => {
    const nome = nomeConfig(cfg);
    if (!nome) return '';
    const x = pessoal
      ? `<button type="button" class="emp-fav-x" data-favx="${id.slice(2)}" aria-label="tirar ${esc(nome)}">×</button>`
      : '';
    return `<span class="emp-fav${pessoal ? ' pessoal' : ''}">
      <button type="button" class="emp-fav-abrir" data-abrir="${id}" title="${esc(cfg.tipo)}${pessoal ? ' · salvo por você' : ''}">${pessoal ? '★ ' : ''}${esc(nome)}</button>
      ${x}
    </span>`;
  }).join('');
  favsEl.innerHTML = fichas ? `<span class="emp-favs-rot">Gráficos</span>${fichas}` : '';
  favsEl.hidden = !fichas;
}

function ligaGaleria() {
  favsEl.addEventListener('click', (ev) => {
    const tirar = ev.target.closest('[data-favx]');
    if (tirar) {
      FAVORITOS = FAVORITOS.filter((_, i) => i !== Number(tirar.dataset.favx));
      gravaFavoritos();
      renderGaleria();
      if (!modalEl.hidden) renderModal(); // a estrela do gráfico aberto pode ter mudado
      return;
    }
    const abrir = ev.target.closest('[data-abrir]');
    if (abrir) aplicaConfig(abrir.dataset.abrir);
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

// Aba fundamentalista: anos em colunas, do mais recente para o mais antigo, e um
// indicador por linha. Clicar na linha abre o mesmo gráfico das outras abas.
function renderTabelaTransposta(dados) {
  const periodos = [...dados.linhas].reverse();
  const cabecalho = periodos.map((l) => `<th class="g-ano">${esc(rotuloCurto(l))}</th>`).join('');
  let grupo = null;
  const corpo = COLUNAS().map((c, i) => {
    let titulo = '';
    if (c.grupo && c.grupo !== grupo) {
      grupo = c.grupo;
      if (c.grupoTotal) {
        // faixa com o total da seção: título fixo à esquerda e uma célula por período
        const somas = periodos.map((l) => {
          const parcelas = c.grupoTotal.chaves.map((ch) => l[ch]).filter((v) => typeof v === 'number');
          if (!parcelas.length) return '<td class="emp-num">—</td>';
          const soma = parcelas.reduce((s, v) => s + v, 0);
          return `<td class="emp-num${soma < 0 ? ' neg' : ''}">${formata(soma, c.grupoTotal.tipo)}</td>`;
        }).join('');
        // a faixa abre o gráfico da própria série que ela resume
        const alvo = COLUNAS().findIndex((x) => x.chave === c.grupoTotal.grafico);
        const clique = alvo >= 0
          ? ` data-ind="${alvo}" class="emp-grupo emp-grupo-clicavel" title="ver histórico de ${esc(COLUNAS()[alvo].rotulo)}"`
          : ' class="emp-grupo"';
        titulo = `<tr${clique}><th scope="row" class="emp-grupo-rot">${esc(c.grupo)}</th>${somas}</tr>`;
      } else {
        // o span fixo mantém o título da seção à vista mesmo com a tabela rolada
        titulo = `<tr class="emp-grupo"><td colspan="${periodos.length + 1}"><span>${esc(c.grupo)}</span></td></tr>`;
      }
    }
    // coluna oculta existe só para o gráfico da faixa: não vira linha da tabela
    if (c.oculta) return titulo;
    const celulas = periodos.map((l) => {
      const valor = l[c.chave];
      const negativo = typeof valor === 'number' && valor < 0;
      return `<td class="emp-num${negativo ? ' neg' : ''}">${formata(valor, c.tipo)}</td>`;
    }).join('');
    const classes = ['emp-ind', 'emp-th-hist', `emp-n${c.nivel || 0}`, c.forte ? 'forte' : ''].join(' ');
    return `${titulo}<tr data-ind="${i}"${c.forte ? ' class="emp-linha-forte"' : ''}>
      <th scope="row" class="${classes}" title="ver histórico de ${esc(c.rotulo)}">${esc(c.rotulo)}</th>
      ${celulas}
    </tr>`;
  }).join('');
  return `<div class="emp-tabela-wrap">
    <table class="emp-tabela emp-tabela-fund">
      <thead><tr><th class="g-ano emp-ind-cabeca">Indicador</th>${cabecalho}</tr></thead>
      <tbody>${corpo}</tbody>
    </table>
  </div>`;
}

function renderTabela(dados) {
  if (ABA.layout === 'transposta') return renderTabelaTransposta(dados);
  const cabecalho = COLUNAS()
    .map((c) => {
      const clicavel = c.tipo !== 'texto';
      const dica = clicavel ? ` title="ver histórico de ${esc(c.rotulo)}"` : '';
      return `<th class="g-${c.grupo}${clicavel ? ' emp-th-hist' : ''}"${dica}>${esc(c.rotulo)}</th>`;
    })
    .join('');
  const corpo = dados.linhas.map((linha, i) => {
    const celulas = COLUNAS().map((c) => {
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
    renderAbas();
    renderGaleria();
    ligaGaleria();
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
