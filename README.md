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
