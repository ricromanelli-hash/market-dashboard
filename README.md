# Market Dashboard

Dashboard local que reproduz o layout enviado: índices dos EUA, Brasil, commodities e
ações por setor (bancos, seguros, energia, saneamento, mineração, petróleo & gás,
papel & celulose, metalurgia & siderurgia), além de IPCA, Tesouro IPCA+ 2032 e notícias.
A página consulta o backend a cada 30s.

## Como rodar

Requer [Node.js](https://nodejs.org/) 18 ou superior (usa `fetch` nativo).

```powershell
cd market-dashboard
npm install
npm start
```

Depois abra http://localhost:3000 no navegador.

### Variáveis de ambiente (opcionais)

**Nunca coloque chaves no código**: o repositório é público. Configure-as assim:

- Local: `$env:NOME = "valor"` antes de `npm start`
- Render: *Dashboard → seu serviço → Environment → Add Environment Variable*

`ALPHAVANTAGE_KEY` — chave do [Alpha Vantage](https://www.alphavantage.co/), usada só
para a taxa de desemprego dos EUA na tabela de Juros Reais. Sem ela, a coluna fica
vazia. O plano gratuito permite 25 requisições/dia, por isso o valor é cacheado por
12 horas.

`SUPABASE_URL` e `SUPABASE_ANON_KEY` — projeto Supabase que alimenta o card
**Agenda das Empresas**. Sem elas o card só avisa que falta configurar; o resto do
painel não é afetado.

> A chave `anon` só funciona se as **três** tabelas lidas — `ac_empresa_eventos`,
> `ac_empresa` e `ac_ticker` — tiverem uma policy de `SELECT` para o role `anon`. Por
> padrão a RLS delas libera apenas `authenticated`, via `private.is_userapp_or_admin()`.
> Se preferir não expor as tabelas inteiras, aceita também uma `service_role` em
> `SUPABASE_SERVICE_KEY` (nesse caso nenhuma policy é necessária).

## Publicar na nuvem (Render — grátis)

O app já está pronto para deploy (usa `process.env.PORT`, sem banco e sem build).
Passo a passo:

1. **Suba o código para o GitHub** (uma vez):
   ```powershell
   cd market-dashboard
   git init
   git add .
   git commit -m "Market dashboard"
   git branch -M main
   # crie um repositório vazio em https://github.com/new (ex.: market-dashboard) e cole a URL:
   git remote add origin https://github.com/SEU_USUARIO/market-dashboard.git
   git push -u origin main
   ```

2. **Crie o serviço no Render:**
   - Acesse https://render.com e faça login com o GitHub.
   - **New +** → **Blueprint** → escolha este repositório (o Render lê o `render.yaml`).
     *(ou **New +** → **Web Service**, e preencha: Build `npm install`, Start `npm start`, Plan `Free`.)*
   - Clique em **Apply/Create**. Em ~2 min ele dá uma URL pública `https://market-dashboard-xxxx.onrender.com`.

3. Sempre que você fizer `git push`, o Render re-publica sozinho (`autoDeploy`).

### Observações do plano grátis
- **Dorme após ~15 min sem acesso** e acorda na próxima visita (a primeira carga leva alguns segundos enquanto rebusca os dados). Para manter sempre ligado, use um plano pago ou o Fly.io.
- **IP de datacenter:** Yahoo Finance e InfoMoney podem, esporadicamente, limitar requisições vindas de servidores de nuvem (funcionam melhor de uma rede residencial). Se cotações/DI falharem às vezes, é isso — o restante continua funcionando.
- O widget do **Calendário (Investing.com)** roda no seu navegador, então não é afetado pelo host.

## Fontes de dados

| Dado | Fonte | Observação |
|---|---|---|
| Índices, moedas, commodities, ações B3 | Yahoo Finance (`query1.finance.yahoo.com/v8/finance/chart`) | API não oficial e sem chave; pode mudar de comportamento sem aviso |
| IPCA (acumulado 12m) | Banco Central do Brasil — SGS série 13522 | API pública oficial (com retentativa por instabilidade) |
| Tesouro IPCA+ 2032 | Tesouro Transparente (CSV oficial de preços e taxas) | Arquivo completo (~14MB), baixado a cada 30 min |
| DI futuro (Jan/27…Jan/31) | Ferramenta de Juros Futuros do InfoMoney (`admin-ajax.php`) | Contratos `DI1F<ano>`; usa o nonce da página, renovado se expirar |
| Notícias (geral, macro e por empresa) | RSS do InfoMoney e do Money Times | Feed geral + editorias de economia/inflação/Copom; filtro por empresa via ticker/nome |
| Calendário Econômico | Widget oficial do Investing.com (iframe, roda no navegador) + Agenda IBGE (API pública) | O IBGE dá as datas de divulgação (IPCA, PIB, PNAD, PMC, PMS, etc.) |
| Agenda das Empresas | Supabase — `ac_empresa_eventos`, com nome e papel de `ac_empresa` e `ac_ticker` | Exige `SUPABASE_URL` + `SUPABASE_ANON_KEY` (ver acima) |

### Agenda das Empresas

Card abaixo de *Petróleo & Gás*: divulgação de resultado, conferência de resultado e dia
do investidor dos **próximos 7 dias contando o de hoje**, com a data mais próxima no topo.

Três detalhes da leitura (`refreshAgendaEmpresas` em [server.js](server.js)):

- **Sem join no PostgREST.** Não existe foreign key ligando `ac_empresa_eventos` a
  `ac_empresa`/`ac_ticker`, então são três consultas e o cruzamento é feito em JS.
- **Um papel por empresa.** Companhias com ON/PN/UNIT aparecem com o papel que o painel
  já acompanha nos cards de setor; na falta dele, a ordem é ON, UNIT, PN. Papéis com
  `ativo = 'N'` (ODPV3, CPLE5/6…) são descartados.
- **Caixa do `tipo_evento` normalizada.** A tabela tem "Divulgação resultado" e
  "Divulgação Resultado" como valores distintos — resquício de uma carga de 17/07/2025.
  O rótulo é unificado na exibição; o banco não é alterado.

### Termômetro do Mercado

Dois medidores lado a lado:

- **EUA** — o *Fear & Greed Index* oficial da CNN (API interna do site; exige
  cabeçalhos `Referer`/`Origin` de navegador).
- **Brasil** — **índice próprio**, calculado neste projeto. Não é o "Índice de Pânico e
  Otimismo" da R² Quant nem o S&P/B3 Ibovespa VIX (nenhum dos dois tem API pública);
  os valores **não são comparáveis** com os deles.

Metodologia do índice brasileiro (`calcSentimentoBr` em [server.js](server.js)) —
quatro componentes normalizados em 0–100 (0 = pânico, 100 = otimismo), média simples:

| Componente | O que mede |
|---|---|
| Momento | posição do Ibovespa dentro da sua faixa de 12 meses |
| Força | posição média das ações da B3 nas faixas de 12 meses delas |
| Amplitude | % de ações acima da própria média de 12 meses |
| Calmaria | volatilidade recente (~2 meses) vs. a do ano — menos volatilidade eleva o índice |

Tudo derivado das séries do Yahoo que o painel já busca para os mini-gráficos — sem
requisição extra. Se menos de 3 componentes puderem ser calculados, o índice não é
publicado (o card mostra "carregando…").

### O que **não** foi implementado (sem fonte gratuita confiável)

- **CPI (EUA)**: o BLS (Bureau of Labor Statistics) tem API pública, mas exige
  cadastro de chave e o dado só muda uma vez por mês — por isso ficou como
  placeholder ("—"), igual ao painel original. Se quiser, dá para plugar a
  série `CUUR0000SA0` da API do BLS em `refreshSlowData()`.

## Estrutura

```
server.js        servidor Express + coleta/cache dos dados
public/index.html  layout da página
public/style.css   estilo (cards, cores de alta/baixa)
public/app.js       busca /api/data a cada 30s e renderiza os cards
```

## Ajustando os ativos

Para adicionar/remover ações ou índices, edite o array `GROUPS` em
[server.js](server.js) — cada item é `{ symbol: 'TICKER.SA', label: 'Nome' }`
usando o formato de ticker do Yahoo Finance (sufixo `.SA` para B3).
