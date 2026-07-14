# Asaas Mock Server — Simulador local fiel do sandbox Asaas

## Contexto

O sandbox do Asaas **não entrega webhooks em `localhost`**, o que torna impossível testar de ponta a
ponta um fluxo de pagamento na máquina do dev: você cria a cobrança, ela é paga, e o evento nunca
chega. Hoje isso obriga a gambiarras (ngrok, deploy de staging só pra testar, mock manual de
payload) que não reproduzem o comportamento real — prazos de crédito, juros, split, retentativa de
webhook.

Vamos construir um **Asaas local em Docker**: um servidor que expõe a API v3 do Asaas com fidelidade
de contrato e **simula de verdade** as máquinas de estado, os cálculos financeiros e os agendamentos
da plataforma — e entrega webhooks em `localhost`. Não é um mock de respostas estáticas: uma cobrança
de cartão criada nele fica `CONFIRMED`, credita em D+32, debita a taxa, movimenta o split entre
contas e gera lançamento no extrato — tudo observável.

O diferencial sobre o sandbox real: um **relógio virtual controlável**. Você avança 32 dias em
milissegundos e vê o `PAYMENT_RECEIVED` chegar. Nenhuma suíte de testes contra o Asaas real consegue
fazer isso.

**Fonte de verdade:** a spec OpenAPI 3.0.1 oficial (`https://www.asaas.com/openApi/document?version=3&languageCode=en-US`
retorna o JSON cru) — 159 paths, **213 operações**, 486 schemas, auth via header `access_token`.
Já baixada e analisada. As regras de negócio (taxas, juros, prazos, 111 eventos de webhook, backoff)
foram pesquisadas na doc oficial e estão consolidadas abaixo.

## Decisões (confirmadas com o usuário)

| | |
|---|---|
| **Stack** | Bun + Elysia + Drizzle + SQLite (`bun:sqlite`) + Docker |
| **Cobertura** | Superfície total (213 rotas registradas, com auth/validação/erro Asaas) + core com motor de negócio real |
| **Tempo** | Relógio virtual controlável via `/_admin/clock` + scheduler por tick; modo default segue relógio real |
| **Multi-conta** | Cada API key = uma conta com `walletId` e saldo próprios; split move dinheiro de verdade entre contas |

---

## Arquitetura

### 1. Pipeline OpenAPI → código

**Codegen próprio emitindo TypeBox** (não Kubb — é gerador de *client*; não Zod — Elysia é
TypeBox-native e valida request **e response**). `openapi-typescript` entra só como oráculo de tipos
em teste, para detectar drift.

O ponto central: o codegen emite um **manifesto** das 213 operações. As rotas são registradas
iterando o manifesto, e todo `operationId` sem handler recebe automaticamente um `notImplemented`.
Assim *"as 213 rotas existem"* vira **invariante de build**, não checklist.

```
spec/openapi.json          # vendorizado, byte-a-byte do upstream, nunca editado à mão
spec/overlays/*.json       # JSON Patch p/ defeitos da spec (ex: status AUTHORIZED não existe no enum)
src/generated/operations.ts # o manifesto: {operationId, tag, method, path, params, query, body, responses}
src/generated/schemas/*.ts  # TypeBox, um arquivo por tag (486 schemas num arquivo só mata o tsc)
```

Dois defeitos conhecidos da spec, já tratados:
- **Enums desnormalizados** — 173 schemas de enum, 9 variações de "PaymentStatus" que colapsam em 2
  conjuntos de valores. O codegen deduplica por hash do conjunto de valores.
- **Valores faltando** — `AUTHORIZED` (pré-autorização) não aparece em nenhum enum de status. Overlay
  adiciona. `src/domain/enums.ts` é escrito à mão e **autoritativo**; um teste garante
  `enum_da_spec ⊆ enum_do_domínio`, então o CI quebra quando o Asaas adicionar um status novo.

Build é **hermético e offline** (o endpoint da spec dá 429 se você bater repetido). `bun run spec:diff`
roda num job semanal separado e abre issue quando o Asaas muda a API.

### 2. Estrutura

```
src/
├── domain/      # PURO. Não importa db, http, nem clock. Toda fn recebe `now: Date`.
│                # money, fees, interest, discount, installments, split, settlement,
│                # cpf-cnpj, calendar (dias úteis BR), payment-machine
├── db/schema/   # Drizzle, um arquivo por área
├── core/        # clock, rng (semeado), context, ledger, events, errors, pagination
├── http/        # app, register (manifesto→rotas), auth, error-mapper
├── modules/     # uma pasta por tag, handlers indexados por operationId
├── scheduler/   # tick() + jobs
├── webhooks/    # fila, dispatcher, backoff, payload, rewrite localhost
└── admin/       # FORA de /v3: clock, reset, state, deliveries, fees, coverage
```

Regra que sustenta tudo: **`src/domain/` não importa nada de infra.** É o que permite paralelizar
agentes sem conflito e o que torna o relógio virtual um não-problema para os cálculos.

### 3. Dinheiro: inteiros em centavos

SQLite `REAL` é IEEE-754 — o saldo corrente acumula erro ao longo de milhares de lançamentos. Pior:
as regras do Asaas são **regras de resto exato** ("a sobra vai na última parcela"), que só se
expressam em aritmética inteira. `value_cents: integer`. Percentuais de split têm 4 casas → escala
1e4. Taxas em basis points.

Datas em **TEXT** no formato de fio do Asaas (`YYYY-MM-DD` / `YYYY-MM-DD HH:mm:ss`) —
lexicograficamente ordenável, sem surpresa de timezone. Fuso `America/Sao_Paulo`.
**Nenhum `CURRENT_TIMESTAMP` como default de coluna** — todo timestamp vem de `clock.now()`, senão o
relógio virtual vaza.

Saldo é materializado em `accounts.balance_cents` **na mesma transação** do lançamento no ledger, e um
invariante roda no `afterEach` dos testes: `balance_cents === SUM(financial_transactions.value_cents)`.

### 4. Máquina de estados de payment

Tabela de transições declarativa + descritores de efeito. `plan()` é **função pura** que devolve
*dados*; `apply()` executa numa transação.

```ts
// src/domain/payment-machine.ts — PURO
plan(payment, trigger, now, fees) → { to: Status, patch, effects: Effect[] } | AsaasError

type Effect =
  | { t:'LEDGER';  entries }   // PAYMENT_RECEIVED + PAYMENT_FEE
  | { t:'WEBHOOK'; event }
  | { t:'SPLIT';   to }
  | { t:'SET_CREDIT_DATE'; date }
```

`applyTransition()` é o **único lugar** onde o status de uma cobrança muda — sandbox action,
scheduler, captura, `receiveInCash`, refund, todos passam por ele. Webhook e lançamento financeiro
são *efeitos da transição*, não algo que o handler precisa lembrar de fazer. Não podem divergir.
`UPDATE ... WHERE id=? AND status=?` (compare-and-swap) torna a máquina segura contra tick duplo.

A divergência por meio de pagamento vive num único lugar (`settlementDate()`):

| billingType | Fluxo | Crédito |
|---|---|---|
| `PIX` | → `RECEIVED` **direto** (pula CONFIRMED) | imediato |
| `BOLETO` | → `CONFIRMED` → `RECEIVED` | D+1 útil |
| `CREDIT_CARD` | → `CONFIRMED` → `RECEIVED` | **D+32** |
| `DEBIT_CARD` | → `CONFIRMED` → `RECEIVED` | D+3 |

Vencido entra em `OVERDUE` antes, em qualquer um.

### 5. Relógio virtual + scheduler

`Clock` injetado via `AppContext`. Três modos: `REAL` (default), `VIRTUAL_FLOWING`, `VIRTUAL_FROZEN`
(CI). **`Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()` são proibidos** fora de
`core/clock.ts` e `core/rng.ts` — regra ESLint + teste que faz grep no fonte.

`advance({days: 40})` **não é um tick só em T+40** — isso geraria uma cobrança de assinatura em vez de
várias e carimbaria `OVERDUE` com data errada. É um `tick()` completo **por dia simulado**.

Ordem fixa dos jobs por tick (a ordem faz parte da semântica):
`subscription-generation` → `overdue` → `credit-settlement` → `split-release` →
`split-divergence-expiry` → `anticipation-settlement` → `webhook-dispatch` → `retention-purge`

Idempotência em 3 camadas: mutex in-process (um processo Bun + SQLite = serial trivial), tabela
`job_runs(jobName, tickKey)` UNIQUE, e CAS em toda mutação — a última é a que realmente salva.

`POST /_admin/clock/advance` devolve um `TickReport` com as transições, o que faz os testes lerem como
especificação:
```ts
const [r] = await h.advance({ days: 32 })
expect(r.transitions).toContainEqual({ paymentId, from:'CONFIRMED', to:'RECEIVED', job:'credit-settlement' })
```

### 6. Motor de webhooks

Um `webhook_events` por evento de domínio → N `webhook_deliveries` (uma por config inscrita).
**O payload é congelado no momento do emit** — uma retentativa 3h depois não pode enviar o estado
atual do recurso; o evento descreve um instante.

Fidelidade ao Asaas real:
- Header `asaas-access-token` = `authToken` do webhook. **Só HTTP 200 é sucesso** (201/204 = falha —
  é a regra real e é onde as pessoas se queimam). Timeout 10s.
- Backoff de 15 tentativas: `0, 30s, 1min, 3.5min, 5min, 15min, 25min, 1h×5, 2h×2, 3h` → depois
  `interrupted = true`. `POST /v3/webhooks/{id}/removeBackoff` reseta.
- `SEQUENTIALLY` faz head-of-line blocking de verdade (é o contrato do Asaas, e é justamente o que o
  usuário precisa poder testar). `NON_SEQUENTIALLY` roda com concorrência limitada.
- Entrega at-least-once; `evt_` id estável entre retentativas (vive no *evento*, não na *entrega*).
- Retenção 14 dias (simulados).

O backoff é comparado contra `clock.nowMs()` — então `advance({hours:1})` dispara a retentativa na
hora. Dá pra exercitar as 15 tentativas e chegar em `interrupted` em ~20ms.

### 7. Regras de negócio (pesquisadas na doc oficial)

**Taxas** (configuráveis por env / `PUT /_admin/fees`): boleto liquidado R$ 1,99 · Pix recebido R$ 1,99
fixo · cartão à vista R$ 0,49 + 2,99% · 2-6x +3,49% · 7-12x +3,99% · 13-21x +4,29% · débito
R$ 0,35 + 1,89% · TED R$ 5,00.

**`netValue = value − taxa`.** O split incide sobre o **`netValue`**, não sobre o bruto.

**Juros/multa:** multa aplicada **uma vez** no 1º dia de atraso (FIXED|PERCENTAGE). Juros pro-rata
die sobre mês comercial de 30 dias: `juros = value × (interest.value/100) / 30 × diasAtraso`.
`interest` só tem `value` (percentual mensal) — **não tem `type`**. `interestValue = multa + juros`.

**Parcelamento:** as N cobranças nascem imediatamente, mensais. Sobra de arredondamento vai na
**última** parcela — `R$ 350 / 12 → 11 × R$ 29,16 + R$ 29,24` (linha 1 do golden test).

**Assinatura:** cobrança gerada **40 dias antes** do `nextDueDate` (configurável p/ 14 ou 7) —
**não** na criação.

**Split:** `PENDING → AWAITING_CREDIT → DONE`. Soma > `netValue` → `BLOCKED_BY_VALUE_DIVERGENCE` com
2 dias úteis pra ajustar.

**Erros:** `{"errors":[{"code":"invalid_<campo>","description":"..."}]}`. Criação retorna **200**, nunca 201.
**Paginação:** `{object:"list", hasMore, totalCount, limit, offset, data:[]}`, limit máx 100.
**IDs:** `pay_<12díg>`, `cus_<12díg>`, `sub_<alfanum>`, `evt_<hex32>&<n>`; installment/transfer/split/
webhook/walletId = **UUID puro**. API key sandbox: `$aact_hmlg_…`.
**Cartões de teste:** `4444444444444444` aprova; `5184019740373151` e `4916561358240741` recusam.

### 8. Docker — a pegadinha nº 1

A promessa do produto é *webhook em localhost*, e o Docker quebra isso: dentro do container,
`http://localhost:3000` é o próprio container.

```yaml
environment:
  WEBHOOK_LOCALHOST_REWRITE: host.docker.internal   # reescreve a URL do webhook
extra_hosts:
  - "host.docker.internal:host-gateway"            # faz funcionar no Linux também
```
Reescrita ligada por padrão, logada em voz alta na primeira vez. **Isso vai nas 20 primeiras linhas do
README.**

---

## Documentos pedidos

- **`AGENTS.md`** — o que é o projeto, por que existe, a stack, os invariantes inegociáveis (domain
  puro, proibição de `Date.now()`, dinheiro em centavos, toda transição via `applyTransition`), e
  como um agente deve trabalhar aqui.
- **`MASTER_PLAN.md`** — este plano, versionado no repo.
- **`progress.md`** — tabela de tracks/agentes/status + a linha **gerada por máquina**
  (`bun run coverage:ops` lê o manifesto ∩ handler map e imprime `implemented: 41/213`). Nunca manter
  contagem à mão que um agente sabe computar.

---

## Fases

### Fase 0 — Tronco (bloqueante, um agente, não paralelizável)
Esqueleto, spec vendorizada + overlays, **codegen**, `src/generated/*`, **schema Drizzle completo**
(todas as tabelas de uma vez — é a única superfície real de conflito de merge), `src/core/*`,
`src/http/*`, **as 213 rotas montadas como stub**, harness de teste + webhook sink, Docker,
`AGENTS.md` / `MASTER_PLAN.md` / `progress.md`.

*Entregável:* container sobe, `bun test` verde, as 213 ops respondem (501 no formato Asaas),
validação de contrato ativa, `GET /_admin/coverage` → `0/213`.

### Fan-out (tracks paralelos — cada um tem pasta própria em `modules/` e arquivo próprio em `db/schema/`)

| Track | Escopo | Depende de |
|---|---|---|
| **C — Money** | fees, juros, multa, desconto, parcelas, split math, cpfCnpj, dias úteis + golden tests | Fase 0 (só `money.ts`) — **começa primeiro, 100% puro** |
| **B — Webhooks** | fila, dispatcher, backoff, SEQ/NON_SEQ, retenção, log admin | Fase 0 |
| **G — Long tail** | ~150 ops CRUD/stub (invoices, bills, dunning, pix, checkout, recharge…) | Fase 0 |
| **A — Payments core** | customers, payments, máquina de estados, sandbox actions | C |
| **D — Finance** | ledger, balance, financialTransactions, transfers | A |
| **H — Cartão** | tokenização, cartões de teste, pré-autorização/captura | A |
| **E — Recorrência** | installments, subscriptions, geração D-40 | A, C |
| **F — Split multiconta** | engine de split, subcontas, movimento entre contas | A, D |

Sequência: `0` → `{C, B, G}` → `A` → `{D, H}` → `{E, F}`

---

## Verificação

**Unit** (`src/domain/`, puro, table-driven + golden files): taxas, juros, desconto, divisão de
parcelas, split, cpfCnpj, dias úteis, matriz completa `status × trigger` (15×10) em snapshot.

**Integração** (SQLite em memória + `VirtualClock` congelado + RNG semeado + webhook sink real via
`Bun.serve`). Cenários que são o critério de aceite:
1. Boleto → `OVERDUE` em D+1 → juros acumulam por dia → `receiveInCash` → ledger + webhooks na ordem.
2. Pix → `RECEIVED` na hora, **sem webhook `PAYMENT_CONFIRMED`**, `netValue = value − 199`, ledger com
   `PAYMENT_RECEIVED` + `PAYMENT_FEE`.
3. Cartão 12× R$ 350 com 2 splits → 12 payments imediatas com valores `[29,16 ×11 , 29,24]`, cada uma
   credita em **D+32**, split move dinheiro pras duas contas, **os dois extratos fecham**.
4. Assinatura MONTHLY → cobrança gerada **exatamente 40 dias antes** do `nextDueDate`, e **não** no 41º.
5. Sink devolve 500 → exatamente 15 tentativas nos offsets exatos do backoff → `interrupted=true` →
   `removeBackoff` → entrega.

**Contract tests de graça:** um hook no `ApiClient` do harness valida **toda resposta que a suíte
inteira produzir** contra o schema TypeBox gerado da spec. Cobertura de contrato vira subproduto de
escrever teste de feature. Mais um teste de superfície que percorre os 213 operationIds e garante que
a rota resolve.

**Determinismo:** roda a suíte duas vezes com o mesmo `SEED` e faz diff de um dump canônico do banco.
Byte-idêntico ou o build quebra.

**Paridade com o Asaas real** (a mitigação do maior risco): `tools/capture.ts` roda um roteiro contra
o **sandbox real** com a chave do usuário, captura respostas HTTP e payloads de webhook, grava em
`tests/golden/`. Uma suíte de paridade replica o roteiro contra o mock e faz diff campo a campo. É o
que transforma fidelidade de esperança em teste.

**Manual, no fim:** `docker compose up`, criar cobrança Pix via curl, confirmar via
`/v3/sandbox/payment/{id}/confirm`, ver o `PAYMENT_RECEIVED` chegar num listener local.

---

## Riscos

1. **Fidelidade não verificável.** Toda regra aqui é *pesquisada*, não *provada* — arredondamento
   exato, composição do `netValue`, roll pra dia útil, conjunto exato de campos do payload. Um mock
   sutilmente errado é pior que nenhum mock, porque produz falsa confiança.
   → **`tools/capture.ts` + suíte de paridade é a prioridade nº 1 depois do tronco.** Secundário: toda
   taxa/regra atrás de config, pra que divergência seja mudança de config, não de código.

2. **Vazamento do relógio virtual.** Um único `Date.now()` fora do `core/` destrói o determinismo em
   silêncio, e o bug aparece como teste flaky três meses depois.
   → Lint + teste de grep no fonte + zero default de tempo no schema + suíte de determinismo.

3. **Viagem no tempo × fila de webhooks.** `advance({days:40})` pra testar assinatura vai, sem você
   pedir, fast-forwardar as 15 tentativas de backoff, marcar `interrupted` e — em `SEQUENTIALLY` —
   congelar a fila. Os testes seguintes veem zero webhooks.
   → `TickReport` expõe mudanças de estado de webhook; `advance()` do harness **drena a fila antes** de
   cada passo de dia; `POST /_admin/webhooks/pause` pra viagem no tempo pura; `webhook-dispatch` roda
   **por último** no tick.
