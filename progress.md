# progress.md

Registro de progresso dos agentes. Leia `AGENTS.md` antes de pegar um track.

> **O número de cobertura não se mantém à mão.** Rode `bun run coverage:ops` — ele
> lê o manifesto ∩ handler map. Cole o resultado aqui ao fechar um track.

```
implemented: 119/208 (57%)
stubbed:     89  (respondem 501)
variants:    5  (dividem rota com a operação canônica)
total spec:  213
```

**411 testes · 0 falhas · `tsc --noEmit` limpo · paridade 7/7 contra o sandbox real ·
26/26 chamadas do cliente real (PartiuRole) atendidas no formato do Asaas.**

*(208 = 213 operações da spec − 5 variantes que dividem rota com a canônica.)*

As 94 operações restantes são cauda longa (Pix estático, notas fiscais, contas a
pagar, recargas, dunning, documentos) — todas respondem **501 no formato de erro do
Asaas**, nunca 404.

---

## Fase 0 — Tronco ✅

Bloqueante, não paralelizável. **Concluída.**

| | |
|---|---|
| Spec vendorizada | 159 paths · 213 operações · 486 schemas · sha256 no lock |
| Codegen | 173 enums → 74 canônicos · TypeBox por tag · manifesto |
| Schema Drizzle | 35 tabelas · dinheiro em centavos · datas TEXT |
| Core | clock (3 modos) · rng semeado · errors · money · ids · ledger |
| HTTP | 213 rotas montadas · auth `access_token` · erro no formato Asaas |
| Scheduler | `tick()` · mutex · idempotência por dia simulado · 8 jobs (esqueleto) |
| Admin | `/_admin/clock` · `/tick` · `/coverage` · `/webhooks/deliveries` · `/fees` |
| Testes | 26 passando · guard de determinismo · teste de superfície das 213 |
| Docker | multi-stage · `WEBHOOK_LOCALHOST_REWRITE` · healthcheck |

Dois defeitos da spec do Asaas descobertos e tratados no codegen:

1. **Status `AUTHORIZED` não existe em nenhum enum** da spec, mas é real
   (pré-autorização de cartão). → `spec/overlays/001-*.json`.
2. **13 paths com barra final espúria**; em 5 deles isso cria uma operação
   "gêmea" (`POST /v3/payments` vs `POST /v3/payments/`). No Asaas real é o
   **mesmo endpoint** — o body decide se é com ou sem cartão. Pior: o segmento
   vazio corrompia a árvore de rotas e derrubava o `GET` vizinho.
   → normalizado no codegen, variantes marcadas com `variantOf`.

---

## Tracks

Cada track tem pasta própria em `src/modules/` e arquivo próprio em
`src/db/schema/` — dois agentes em paralelo não conflitam.

| Track | Escopo | Status |
|-------|--------|--------|
| **C — Money** | taxas, juros, multa, desconto, divisão de parcelas, split math, dias úteis BR | ✅ `src/domain/*` 100% puro · 38 golden tests |
| **B — Webhooks** | fila, dispatcher, backoff de 15 tentativas, SEQ/NON_SEQ, retenção | ✅ 6 ops · `src/webhooks/{rewrite,backoff,dispatcher}.ts` · 18 testes |
| **A — Payments core** | customers, payments, máquina de estados, sandbox actions | ✅ 21 ops · `applyTransition` · 12 testes de ciclo de vida |
| **G1 — Conta e cauda longa** | account info, payment links, notificações, checkout, Serasa | ✅ 27 ops |
| **D — Finance** | ledger, extrato, saldo, transferências, antecipação | ✅ 16 ops (4 Finance/Extrato + 4 Transfer + 8 Anticipation) · `src/modules/{finance,transfers,anticipations}` · jobs em `src/scheduler/jobs/{transfer,anticipation}-jobs.ts` · 35 testes |
| **E — Recorrência** | installments, subscriptions, geração D-40 | ✅ 22 ops (9 Installment + 13 Subscription) · job 1 `subscription-generation` em `src/scheduler/jobs/subscription-jobs.ts` · `src/modules/{installments,subscriptions}` · 39 testes |
| **F — Split multiconta** | engine de split, subcontas, movimento entre contas | ✅ 13 ops (4 Payment Split + 9 Subaccount) · jobs 4 e 5 em `src/scheduler/jobs/split-jobs.ts` · 28 testes |
| **H — Cartão** | tokenização, cartões de teste, pré-autorização/captura, chargeback | ✅ 9 ops (6 Credit Card/Payment + 3 Chargeback) · `src/domain/credit-card.ts` (Luhn + bandeira, puro) · `src/modules/{credit-cards,chargebacks}` · 68 testes (43 unitários + 25 de integração) |

**Os 8 tracks estão costurados** em `src/modules/index.ts` e
`src/scheduler/jobs/index.ts`, e o andaime que cada agente usou para testar antes
da costura (`extraHandlers`/`extraJobs` no harness) **foi removido de propósito**:
um teste que registra os próprios handlers passa mesmo que a costura nunca tenha
acontecido — ele se auto-serve, e a suíte deixa de provar que o servidor real
responde aquela rota. Hoje os 328 testes batem no `HANDLERS`/`JOBS` de verdade.

### Verificado de ponta a ponta

`bun run e2e` sobe o servidor, cria uma cobrança Pix por HTTP, confirma, e espera
o `PAYMENT_RECEIVED` chegar num listener local. **Roda também contra o container**
(`bun run e2e -- http://localhost:8080 '$aact_...'`) — e passa: o webhook
atravessa a fronteira do Docker via `WEBHOOK_LOCALHOST_REWRITE`. É a promessa
inteira do projeto, num comando.

---

## Paridade com o Asaas real — **EXECUTADA** ✅

```
7 roteiros · 7 passando · 0 divergências
```

A captura rodou contra o **sandbox real do Asaas** (`bun run capture`) e a suíte de
paridade replica os mesmos roteiros contra o simulador, comparando campo a campo.
**Este projeto deixou de ser "a nossa melhor leitura da documentação" e passou a
ser um comportamento provado.**

```bash
ASAAS_SANDBOX_API_KEY='$aact_hmlg_…' bun run capture   # → tests/golden/*.json
bun run test:parity
```

| Roteiro | O que provou |
|---|---|
| `pix-recebido` | taxa do Pix é **fixa** de R$ 1,99 (não percentual) ✅ nossa leitura estava certa |
| `cartao-a-vista` | taxa R$ 0,49 + 2,99% → netValue 96,52 ✅ certo |
| `parcelamento-350-em-12x` | **11 × R$ 29,16 + R$ 29,24 na ÚLTIMA** ✅ certo |
| `parcelamento-no-cartao` | crédito **escalonado** em D+32×n ❌ estávamos errados |
| `assinatura-mensal` | a 1ª cobrança nasce **na criação** ❌ estávamos MUITO errados |
| `boleto-com-juros-e-multa` | formato de discount/fine/interest ❌ campo com nome errado |
| `erros-de-validacao` | código `invalid_object`, não `invalid_cpfCnpj` ❌ errados |

### O que a captura DERRUBOU (bugs reais, todos corrigidos)

Estas são as regras que tínhamos como certas — algumas afirmadas em comentários
enfáticos no código, uma delas com um aviso para "não consertar". Todas erradas.

| # | Acreditávamos | A verdade (provada) | Impacto |
|---|---|---|---|
| 1 | Criar uma assinatura **não** cria cobrança; a 1ª nasce 40 dias antes do vencimento. | **A 1ª cobrança nasce na criação**, e o `nextDueDate` já avança um ciclo. A janela de 40 dias governa as SEGUINTES. | **Crítico.** Nossa assinatura não cobrava nada. O recurso estava simplesmente quebrado — e três testes "provavam" que estava certo. |
| 2 | A taxa do cartão parcelado é `0,49 + pct%` **de cada parcela**. | É `0,49 + pct% × TOTAL`, calculada **uma vez** e **dividida** entre as N parcelas, **truncando**. A sobra fica com o lojista. | **Dinheiro errado.** 12× de R$ 350 dava R$ 1,65 de taxa por parcela; o certo é **R$ 1,20** (ver #16 — a divisão trunca, e nós arredondávamos). |
| 3 | Cada parcela no cartão credita em D+32 da confirmação (todas juntas). | A parcela `n` credita em **D+32×n**, rolado para o próximo dia útil. | **Extrato errado por meses.** Confirmado em 9 datas reais (3x e 6x), todas na unha. |
| 4 | `estimatedCreditDate` é preenchida na criação, a partir do vencimento. | É **`null` enquanto PENDING**. O Asaas não promete data de crédito para dinheiro que não entrou. | Inventávamos uma data que a API real não dá. |
| 5 | `creditDate` só aparece quando o dinheiro cai. | É preenchida **já na confirmação**, apontando para o futuro. Quem distingue "vai cair" de "caiu" é o `status`. | O lojista não conseguia saber quando ia receber. |
| 6 | `paymentDate` e `clientPaymentDate` são a mesma data. | **Não são.** `clientPaymentDate` = quando o cliente pagou. `paymentDate` = quando o LOJISTA recebeu — e é `null` enquanto CONFIRMED. | Dois campos com significados diferentes que tratávamos como um. |
| 7 | O campo do desconto chama `limitedDate`. | Chama **`limitDate`**. | A spec não declara nenhum dos dois — **a validação de contrato jamais pegaria isso.** Só a API real pega. É a ilustração exata de por que a paridade existe. |
| 8 | CPF inválido → `invalid_cpfCnpj`. | → **`invalid_object`**, com a descrição "O CPF/CNPJ informado é inválido." | Parece errado. É o que o Asaas devolve. |
| 9 | Body vazio → lista de erros de schema. | **Um erro só**: `invalid_customer`. O Asaas valida semanticamente e curto-circuita. | Devolvíamos 17 erros do TypeBox **em inglês** ("Expected string"). Nenhum cliente do Asaas veria isso. → overlay 004 |
| 10 | O objeto `payment` tem um conjunto fixo de chaves. | Os relacionais nulos são **OMITIDOS**, não devolvidos como `null`. E há campos por meio de pagamento: só BOLETO tem `canBePaidAfterDueDate`; só CREDIT_CARD tem `confirmedDate` e `creditCard`. | `'installment' in payment` se comportava diferente do real. |
| 11 | `installment.paymentValue` é o valor de cada parcela. | É o valor da **ÚLTIMA** parcela — a que carrega a sobra (R$ 29,24, não R$ 29,16). | Contraintuitivo; não teríamos adivinhado. |
| 12 | Sem descrição, a parcela fica sem descrição. | O Asaas **gera** "Parcela 3 de 12.". | — |
| 13 | `GET /v3/payments` devolve na ordem de criação. | Devolve **da mais nova para a mais antiga**. | — |
| 14 | Celular é qualquer string. | O Asaas **recusa dígitos repetidos** (`47999999999` → `invalid_mobilePhone`), como faz com CPF `11111111111`. | — |
| 15 | `anticipable` é uma propriedade da cobrança. | Depende do **limite de antecipação da conta** (análise de crédito do Asaas) E de um horizonte de 90 dias. | Ver abaixo. |
| 16 | A taxa total do parcelado se divide pelas parcelas **arredondando**. | **TRUNCA.** R$ 350 em 12x: taxa total = 1446 centavos; 1446/12 = 120,5 → o Asaas cobra **120**, não 121. | **Um centavo por parcela.** E sobreviveu à captura anterior porque nos casos que tínhamos (300/3x, 600/6x) `round` e `trunc` coincidem. Só 350/12x separa os dois. Golden em `tests/unit/simulator.test.ts`. |
| 17 | O parcelamento por `POST /v3/payments` não existe (é só `/v3/installments`). | **Existe**, e é a porta que o cliente típico usa. Devolve a **primeira parcela** (um `payment` com `installment` preenchido), não o objeto do parcelamento. | Recusávamos com 400. O fluxo de compra parcelada simplesmente não existia. |
| 18 | `payWithCreditCard` exige `creditCard` + `creditCardHolderInfo` (a spec diz `required`). | Aceita **só `creditCardToken`** — que é o ponto inteiro da tokenização: o PAN não volta a trafegar. | Recusávamos com 400 **antes do handler**, com erros do TypeBox em inglês. → overlay 005 |
| 19 | `expirationDate` do QR Pix é a data de vencimento. | É o **vencimento + 1 ANO**, às 23:59:59. Provado em dois pontos. | — |
| 20 | `POST /v3/myAccount/notifications/settings` existe. | **Não existe** — responde 404 no Asaas real. | Não é bug nosso. O cliente (PartiuRole) chama e engole o erro num `try/catch`. Nosso 404 é fiel. |

### `anticipable` — a regra que existe mas não é reproduzível

Deduzida de 11 pontos de dados reais e implementada em `src/domain/anticipable.ts`
(com os 11 casos em `tests/unit/anticipable.test.ts`):

```
anticipable = meio antecipável (boleto ou cartão)
            E valor ≤ LIMITE DISPONÍVEL de antecipação da conta
            E vencimento ≤ hoje + 90 dias
```

O que nos enganou: um boleto AVULSO de R$ 350 vencendo em 10 dias vinha `false`,
enquanto a parcela de R$ 29,16 vencendo no mesmo prazo vinha `true`. Parecia que só
parcelamento era antecipável. **Não é** — a conta de teste tinha um limite de
antecipação de boleto de **R$ 66,66**, e os R$ 350 não cabiam.

Esse limite sai da análise de crédito do Asaas e é específico da conta
(`GET /v3/anticipations/limits`). Nenhum simulador pode adivinhá-lo. Por isso
`anticipable` fica **fora da comparação de paridade** — comparar o apetite de risco
do Asaas não é comparar o nosso código.

---

## Validação contra o cliente real (PartiuRole) ✅

O PartiuRole é o primeiro consumidor deste simulador. Extraímos as **26 chamadas**
que o cliente dele (`asaas-client.ts`) faz ao Asaas, exercitamos **todas** contra o
mock e comparamos, campo a campo, com a resposta capturada do sandbox real.

**Antes: 11/29 chamadas OK. Depois: 28/29** — e a que "falha" é fiel (ver #20).

Formato conferido chave a chave (nem campo faltando, nem campo a mais) em:
`POST /customers` · `POST /payments` (Pix, cartão, parcelado) · `GET /payments/{id}/pixQrCode` ·
`POST /payments/simulate` · `POST /creditCard/tokenizeCreditCard` ·
`POST /payments/{id}/payWithCreditCard` · `GET /myAccount/status` · `GET /myAccount/documents`.

O que a validação encontrou, e que **nenhum teste de contrato pegaria** — porque a
spec do Asaas não descreve nada disso:

| Buraco | Era |
|---|---|
| `GET /payments/{id}/pixQrCode` | **501.** Sem QR nem "copia e cola", uma compra por Pix não tem como ser paga. |
| `POST /payments` com `installmentCount` | **400.** O fluxo de compra parcelada não existia (#17). |
| `POST /payments/{id}/payWithCreditCard` só com token | **400** no schema, antes do handler (#18). |
| `POST /payments/simulate` | **501.** |
| KYC: `GET/POST /myAccount/documents`, `POST /sandbox/myAccount/approve` | **501.** Sem isso não há onboarding de subconta. |
| Taxa da parcela | Errada em **1 centavo por parcela** (#16). |

Reproduza com `tools/` + o roteiro em `tests/integration/partiurole-flows.test.ts`.

### O que ainda NÃO está provado

- **Payloads de webhook.** A captura cobre as respostas HTTP. Provar os payloads de
  webhook exigiria um túnel público — o sandbox não entrega em localhost, que é,
  afinal, o motivo de este projeto existir.
- **As mensagens de erro além da primeira.** O Asaas curto-circuita, então só a
  mensagem de `customer` foi capturada. As demais (`billingType`, `value`, `dueDate`)
  são nossas — um roteiro por campo resolveria.
- **O que acontece com a descrição da parcela quando ELA é informada** (substitui? concatena?).
- **A faixa de 13-21x do cartão** e o cronograma de crédito além de 6 parcelas.

---

## Divergências conhecidas com o Asaas real

Anote aqui toda vez que descobrir uma. Vire linha de golden test.

| Descoberto | Regra | O que fizemos |
|---|---|---|
| Track B | **Defeito da spec:** `events` do webhook é declarado com `type: array` E um `enum` no nível do array (o enum certo já está em `items.$ref`). O codegen checa `enum` antes de `type` e gerava `Type.Union([…literais])` — um evento só, em vez de uma lista. A validação de contrato rejeitaria a resposta legítima. | `spec/overlays/002-webhook-config.json` remove o `enum` espúrio dos 3 DTOs de webhook. **O mesmo defeito existe em 5 outros lugares** (`CheckoutSessionResponseDTO.billingTypes`/`chargeTypes`, `CheckoutSessionSaveRequestDTO.billingTypes`/`chargeTypes`, `AccountDocumentResponsibleResponseDTO.type`) — quem pegar o Track G deve corrigir de vez invertendo a ordem dos testes em `emit()` do codegen (`type: 'array'` antes de `enum`). |
| Track B | **Defeito da spec:** `WebhookConfigSaveRequestDTO` marca os 9 campos como `required`, inclusive `authToken`, `apiVersion`, `enabled` e `interrupted`. O Asaas real só exige `name`, `url`, `email`, `sendType` e `events`. Exigi-los tornaria o simulador MAIS estrito que a API real. | Mesmo overlay relaxa o `required`. Defaults: `apiVersion=3`, `enabled=true`, `interrupted=false`, `authToken=null` (sem token, o header `asaas-access-token` simplesmente não é enviado). |
| Track F | **Split para carteira EXTERNA** (um `walletId` que não é de nenhuma conta deste servidor). No Asaas real o dinheiro SAI da sua conta rumo à carteira de outro cliente do Asaas. | **Divergência deliberada:** marcamos o split `DONE` e **não movemos nenhum centavo** — nem na origem. Não há conta para creditar, e debitar a origem sem contrapartida faria o valor sumir do extrato sem que ninguém conseguisse conferir para onde foi. Para ver o dinheiro andar de verdade, crie uma subconta (`POST /v3/accounts`) e use o `walletId` dela. Coberto por teste (`split.test.ts` → "carteira externa"). |
| Track E | **Defeito da spec:** `InstallmentSaveRequestDTO` marca `value` como `required`. Na API real informa-se `value` (valor POR PARCELA) **ou** `totalValue` (total a dividir) — e o parcelamento canônico do projeto (R$ 350 em 12x) **só existe via `totalValue`**, porque 350/12 não é um valor de parcela representável. Como o Elysia REMOVE do body toda propriedade fora do schema, manter `value` obrigatório tornaria impossível criar, aqui, o parcelamento mais comum que existe. | `spec/overlays/003-recurrence.json` tira `value` do `required` (nos dois DTOs, com e sem cartão). A regra "informe value **ou** totalValue" passa a ser do handler — que é onde ela mora no Asaas. |
| Track E | **Defeito da spec:** `SubscriptionUpdateRequestDTO` **não tem a propriedade `value`**. É omissão: alterar o preço do plano é o motivo nº 1 para atualizar uma assinatura, e é exatamente o que `updatePendingPayments` existe para propagar. Sem o campo no schema, o Elysia o removeria do body e o simulador devolveria **200 sem mudar nada** — o pior defeito possível, porque é silencioso. | Mesmo overlay adiciona `value` ao DTO. |
| Track E | **Defeito da spec:** `GET /v3/installments/{id}/payments` e `GET /v3/subscriptions/{id}/payments` **não declaram `offset`/`limit`** — mas a resposta das duas é o envelope de listagem, *com* `limit`, `offset` e `hasMore` dentro. Um endpoint que reporta paginação e não aceita parâmetro de paginação é contraditório: com o default de 10, um parcelamento de 12x nunca listaria as 12 parcelas. | Mesmo overlay adiciona os dois parâmetros que todas as outras listagens da spec já declaram. |
| PartiuRole | **Defeito da spec:** `PaymentPayWithCreditCardRequestDTO` marca `creditCard` e `creditCardHolderInfo` como `required`. O Asaas real aceita **só `creditCardToken`** — que é o propósito da tokenização. Com o `required`, o Elysia recusava o body ANTES do handler, devolvendo erro do TypeBox em inglês. | `spec/overlays/005-pay-with-card-required.json` remove o `required`. O handler já sabia aceitar token OU cartão — era só o schema barrando a porta. |
| PartiuRole | **Defeito da spec:** `AccountDocumentResponsibleResponseDTO.type` é declarado `type: "array"`, mas o `example` da própria spec é o escalar `"ASSOCIATION"` e o `enum` está pendurado no array em vez dos `items`. O sandbox real devolve **string**. Sem overlay, devolvíamos a string CERTA e a nossa própria validação de contrato rejeitava a resposta. | `spec/overlays/006-document-responsible-type.json` troca o campo pelo `$ref` do enum. Era o 6º e último lugar com o bug de enum espúrio do gerador do Asaas que o Track B catalogou. |
| Track H | **As operações "gêmeas" da Fase 0 tinham um segundo efeito, e este era silencioso.** `create-new-payment-with-credit-card` divide a rota `POST /v3/payments` com `create-new-payment` — e a rota é registrada com o schema da CANÔNICA. Como o Elysia **remove do body toda propriedade fora do schema**, `creditCard`, `creditCardToken`, `remoteIp` e `authorizeOnly` chegavam ao handler já podados: a variante do cartão era **inalcançável**, e o body de cartão criava uma cobrança PENDING comum, sem erro nenhum. | `mergeVariantBodies()` em `src/http/register.ts`: o schema da rota passa a ser a união canônica + variantes, com os campos exclusivos da variante como **opcionais** (senão `remoteIp`, obrigatório no cartão, passaria a ser exigido de um boleto). Quem exige o quê volta a ser o handler — como no Asaas. Vale para as **5** variantes do manifesto, não só a do cartão. |
| Track H | **Não existe operação para CRIAR um chargeback.** A tag "Chargeback" tem 3 ops (listar, recuperar, abrir disputa) e nenhuma de abertura — coerente com o mundo real (quem abre é a bandeira), mas deixa o gatilho `CHARGEBACK` da máquina e as 3 ops sem porta de entrada: o dev não teria como testar o fluxo. | `POST /_admin/payments/{id}/chargeback` — **fora de /v3**, ao lado da viagem no tempo. É controle do simulador, não da API. |
| Track H | **Defeito da spec:** `PaymentSaveRequestDTO` (e a variante com cartão) marca `value` como `required` — mas numa cobrança PARCELADA via `POST /v3/payments` o valor vem em `totalValue`/`installmentValue`. É o mesmo defeito que o Track E corrigiu no `InstallmentSaveRequestDTO` (overlay 003), na outra ponta. | **Ainda não corrigido:** hoje é preciso mandar `value` junto. Quando o parcelamento por `POST /v3/payments` sair do `not_implemented`, tirar `value` do `required` nos 2 DTOs de payment, no mesmo overlay. |
| KYC | **Defeito da spec, PROVADO pelo sandbox:** `AccountDocumentResponsibleResponseDTO.type` é declarado `type: "array"` (com `items.$ref` para o enum) — mas a captura do sandbox devolve **uma string**: `"responsible": { "name": "Pr Soluções Sandbox", "type": "INDIVIDUAL_COMPANY" }`. O próprio `example` da spec é escalar (`"ASSOCIATION"`), não uma lista: é o mesmo artefato de gerador do defeito da linha 175. Devolvemos **string** (o golden ganha). | **Overlay AINDA NÃO ESCRITO** — `spec/overlays/` estava travado (outro agente). Consequência: a nossa resposta de `check-pending-documents` viola o schema gerado **nesse único ponto**, e por isso o teste chama a rota crua, sem o `ApiClient` do harness. `tests/integration/account-documents.test.ts` **pina** a divergência (prova que é a única) e quebra de propósito quando o overlay entrar. O patch é: `replace /components/schemas/AccountDocumentResponsibleResponseDTO/properties/type` → `{ "$ref": "#/components/schemas/AccountDocumentResponsibleResponseAccountDocumentResponsibleType" }`. Depois disso: apagar o teste-tripwire e trocar `getDocuments()` por `h.api.call('check-pending-documents')`. |
| Costura | **A mesma falha silenciosa do Track H tinha um segundo andar, e só apareceu quando os tracks foram costurados.** Com o `mergeVariantBodies()` no lugar, `creditCard` passou a CHEGAR aos handlers de `POST /v3/subscriptions` e `POST /v3/installments` — mas eles não o consumiam. A assinatura nascia `billingType: CREDIT_CARD` com `creditCardId: null` (a cobrança gerada 40 dias depois não teria cartão para cobrar), e o parcelamento criava as 12 parcelas `PENDING` sem nunca cobrar o cartão. Dois 200 OK, nenhum erro, resultado errado. | Corrigido: `resolveCreditCard()` em subscriptions (tokeniza na criação e reusa em `update-subscription-credit-card`, em vez de duplicar) e `create-installment` agora resolve/valida o cartão **antes de qualquer escrita** (recusado → 400 sem deixar parcelamento órfão) e confirma as N parcelas. Travado por teste nos dois casos. **A lição:** uma variante inalcançável falha em dois lugares — o body não chega, e o handler não a espera. Corrigir só o primeiro dá a aparência de conserto. |

## Regras que a documentação não define

Escolhemos um comportamento; pode estar errado.

| Regra | O que a doc diz | O que fizemos |
|---|---|---|
| Juros incidem sobre `value` ou sobre `value + multa`? | não documentado | sobre o valor original, sem compor com a multa |
| **Fórmula da taxa de antecipação** | não documentada (só as taxas comerciais: "a partir de X% a.m.") | **`fee = valorLíquido × (taxaMensalBp/10000) / 30 × diasAntecipados`** — pro-rata die sobre a taxa AO MÊS, mês comercial de 30 dias, juro simples, sem taxa mínima. A base NÃO é o bruto: é o **líquido** da cobrança (bruto − taxa do Asaas), como os próprios exemplos da spec mostram (`totalValue` 80 → `value` 76,01 → `fee` 2,33 → `netValue` 73,68). `src/domain/anticipation.ts`, números em `config.fees.anticipation` (`FEE_ANTICIPATION_*`) |
| Limite de antecipação (`GET /v3/anticipations/limits`) | é análise de crédito do Asaas — não há fórmula pública | teto fixo de R$ 50.000,00 por tipo de recebível (o número do exemplo da spec), menos o que já está antecipado e ainda não liquidou. `ANTICIPATION_LIMIT_CENTS` |
| `isDocumentationRequired` na simulação de antecipação | a spec só descreve o campo | `true` para boleto, `false` para cartão confirmado (a operadora já autorizou — é dinheiro certo) |
| Quando o saldo é debitado numa transferência **agendada** (`scheduleDate`)? | não documentado | **na criação**, não na data agendada. É a leitura conservadora (o saldo não pode ser gasto duas vezes) e a única que mantém `GET /v3/finance/balance` honesto |
| Franquia de transferências gratuitas (`fees.transfer.monthlyWithoutFee`, 30/mês) | a doc cita a franquia mas não define o que entra nela | **não aplicada**: a taxa de TED é sempre cobrada. Não sabemos se Pix e TED dividem a franquia, se ela é por conta ou por subconta, nem se o mês é o de competência ou os últimos 30 dias — e uma taxa que aparece e some sem regra conferível é pior que uma taxa sempre cobrada |
| Como forçar uma transferência a **FALHAR** no sandbox? | não documentado — e sem isso ninguém testa o estorno (`TRANSFER_REVERSAL`) | gatilho determinístico nosso: chave Pix `fail@asaas.com.br` **ou** `externalReference: "FAIL"` → a transferência vai a `FAILED` no scheduler e o dinheiro (valor + taxa) volta |
| Ordem default de `GET /v3/financialTransactions` | a spec tem o parâmetro `order`, sem valores nem default | `asc` (cronológico, por ordem de inserção). É a única ordem em que a coluna `balance` — o saldo APÓS cada lançamento — faz sentido de cima para baixo |
| `GET /v3/finance/split/statistics`: quais status de split entram na conta? | duas descrições de uma linha ("Amounts receivable" / "Values to be sent") | só splits ABERTOS (`PENDING`/`PROCESSING`/`AWAITING_CREDIT`). `income` = o que esta conta tem a receber; `value` = o que ela tem a pagar. Um split `DONE` já virou lançamento no extrato — contá-lo aqui seria contar o mesmo dinheiro duas vezes |
| `limit` default da paginação | não documentado | 10 |
| Cartão de teste que força `AWAITING_RISK_ANALYSIS` | não documentado | nenhum |
| **(H)** Como o Asaas detecta a BANDEIRA pelo número? | a doc só cita os prefixos óbvios | tabela de prefixos com match pelo **mais longo** (`BRAND_RULES` em `src/domain/credit-card.ts`): 34/37→AMEX · 30/36/38→DINERS · 35→JCB · 6011/65/644-649→DISCOVER · 6→ELO · 4→VISA · 5 e 2→MASTERCARD. As faixas reais de BIN são muito mais granulares (Elo tem ~40); é `TODO(regra)` e a correção é **só a tabela**, que é dado |
| **(H)** O que fazer com um número que não é cartão de teste? | a doc lista 3 cartões de sandbox e cala sobre o resto | passou no **Luhn** → APROVA. Falhou → 400 `invalid_creditCard`. Pegadinha: **`4444444444444444` NÃO passa no Luhn** e mesmo assim é o cartão que aprova — por isso a tabela de teste é consultada **antes** da validação |
| **(H)** Qual a mensagem de recusa do cartão? | a doc não publica o catálogo | 400 `invalid_creditCard` com texto **genérico** ("Transação não autorizada…"). Detalhar o motivo (sem limite / bloqueado / fraude) é vetor de enumeração de cartão roubado — o Asaas não detalha, e nós também não |
| **(H)** `daysToExpire` da pré-autorização: default e efeito | a spec só tem o campo (exemplo: 5) | default **5**, guardado em `settings` (namespaced por conta). **A pré-autorização ainda NÃO expira sozinha** — falta um job no scheduler; hoje uma cobrança `AUTHORIZED` fica `AUTHORIZED` até alguém capturar. `TODO(regra)` em `src/modules/credit-cards/handlers.ts` |
| **Cronograma de crédito de um PARCELAMENTO no cartão** | não documentado. A emissora autoriza o total de uma vez, mas a doc não diz quando cada parcela cai na conta do lojista | as N parcelas nascem **CONFIRMED** (a autorização é única) e cada uma credita pela regra normal do cartão, **D+32 a partir da confirmação**. A alternativa plausível — D+32 a partir do vencimento de CADA parcela, escalonando o crédito mês a mês — é igualmente defensável e daria números bem diferentes. **É um dos alvos da suíte de paridade.** `src/modules/installments/handlers.ts` |
| **KYC: como é uma conta NÃO aprovada em `GET /v3/myAccount/documents`?** | só temos captura de uma conta **aprovada** (grupo `APPROVED`, `onboardingUrl: null`, **sem** o array `documents` e **sem** `onboardingUrlExpirationDate`). O caso pendente veio da spec + do tipo que o cliente espera | **toda conta nasce com UM grupo `IDENTIFICATION`** (título e descrição são os do golden). Subconta: grupo `NOT_SENT` + 1 documento `NOT_SENT` + `onboardingUrl` (`{PUBLIC_BASE_URL}/onboarding/<hex32>`, que **não serve página nenhuma**) + `onboardingUrlExpirationDate` = hoje + 30 dias. Conta principal (seed): grupo `APPROVED`. **Adivinhado:** quantos e quais grupos o Asaas cria (ele varia por tipo de pessoa/empresa — contrato social, certificado MEI…); a validade de 30 dias do link; e que o grupo recém-aprovado passa a responder igual ao grupo aprovado do golden (some `documents`) |
| **KYC: `responsible.type` para cada tipo de conta** | a spec só lista o enum | derivado do cadastro: FISICA → `ASAAS_ACCOUNT_OWNER`; JURIDICA → `MEI`/`LIMITED_COMPANY`/`ASSOCIATION` conforme `companyType`, com `INDIVIDUAL_COMPANY` no default. **Só o `INDIVIDUAL_COMPANY` está provado** (é o da conta capturada); o resto é dedução do enum |
| **KYC: o `{id}` de `POST /v3/myAccount/documents/{id}`** | a spec não diz se é o do grupo ou o do documento | é o do **DOCUMENTO** (o que vem em `group.documents[]`) — é o que o cliente real faz. Um id de grupo devolve 404. Em sandbox **qualquer arquivo é aceito e auto-aprovado**: o documento vai a `APPROVED` e, se era o último pendente, o grupo também. O campo `type` do multipart é ignorado (o documento já existe; o grupo define o tipo) |
| **KYC: `documentation`/`general` em `GET /v3/myAccount/status`** | a spec só descreve os 4 campos | `documentation` sai dos **grupos de documento**, não do status do cadastro — senão `POST /v3/sandbox/myAccount/approve` não teria efeito observável nenhum. Uma subconta nova, portanto, transaciona (`commercialInfo: APPROVED`) com `documentation: PENDING` e `general: PENDING`. **Adivinhado:** que `commercialInfo` e `bankAccountInfo` nascem `APPROVED` numa subconta recém-criada |
| **(H)** O chargeback debita o saldo? | a doc não descreve o lançamento | **sim, o valor BRUTO, quando a cobrança já tinha creditado** (`RECEIVED`) — lançamento `CHARGEBACK` no extrato, e a conta pode ficar negativa, porque **a taxa não volta**. Numa `CONFIRMED` (que ainda não virou saldo) não há o que debitar e nenhum lançamento é gerado. É a mesma assimetria — e o mesmo desenho — do `REFUND` |
| **(H)** Prazo para enviar os documentos da disputa | a spec só tem o campo | 20 dias corridos a partir da abertura (`DISPUTE_DEADLINE_DAYS` em `src/modules/chargebacks/service.ts`). `TODO(regra)` |
| Cutoff de horário do "D+1 útil" do boleto | não documentado | sem cutoff; sempre próximo dia útil |
| `penalizedRequestsCount` do webhook — o que conta como "requisição penalizada"? | só existe como campo na spec, sem definição | devolvemos **0** fixo, com `TODO(regra)` em `src/modules/webhooks/handlers.ts`. Inventar uma fórmula (tentativas falhas? adiadas pelo backoff? throttling da conta?) num campo que ninguém consegue conferir seria falsa confiança |
| Retenção da fila de webhook: o Asaas apaga a entrega ou só para de tentar? | não documentado | `PENDING` além dos 14 dias simulados → `EXPIRED`; `DELIVERED` antigo é apagado; **`INTERRUPTED` nunca é purgado** (é o estado que o dev precisa ver para entender por que a fila travou) |
| `SEQUENTIALLY`: quantas entregas saem por "rodada"? | a doc só garante a ORDEM e o bloqueio da fila | o dispatcher drena a fila em ordem de `sequence` e **para na primeira falha** (head-of-line blocking de verdade). Três eventos com o endpoint no ar chegam os três no mesmo tick; basta o 1º falhar e os outros dois não saem |
| **(G1)** `minutesToExpire` do checkout: qual o default? | não documentado | 60 minutos, em `rules.checkoutMinutesToExpire` (env `CHECKOUT_MINUTES_TO_EXPIRE`) |
| **(G1)** O que acontece com a imagem principal de um link quando ela é REMOVIDA? | não documentado | a mais antiga que sobrou vira a principal. Um link com imagens sem capa não faz sentido |
| **(G1)** DELETE `/v3/myAccount` funciona em qualquer conta ou só em subconta white label? | o summary da spec diz "Delete White Label subaccount" | exigimos `parentAccountId != null` → 400 `invalid_account` na conta raiz. **A chave da subconta desabilitada continua autenticando** (o `authenticate` é do tronco): a desabilitação hoje é só um fato datado em `account_disablements` |
| **(G1)** A consulta ao Serasa debita a taxa do saldo? | a doc só publica o PREÇO (R$ 16,99) | **não debitamos.** A taxa é gravada em `credit_bureau_reports.fee_cents` a partir de `config.fees.creditBureauReport`, mas não há um `FinancialTransactionType` do Asaas que a gente CONHEÇA para ela — inventar um tipo no extrato seria falsa confiança. **Track D fecha isso** (`postEntries` + o tipo real) |
| **(G1)** `GET /v3/myAccount/commercialInfo` devolve um objeto `city` com IBGE, distrito etc., mas o request de atualização **não tem campo de cidade** | a doc não explica de onde a cidade vem | no Asaas ela é derivada do CEP. Sem uma base de CEPs, devolvemos `city: null` (ou só `{name, state}` se a conta tiver `city` gravado). Inventar código do IBGE seria mentira |
| **(G1)** Taxas de serviço (notificação, NF-e, negativação, antecipação) | a doc publica a tabela comercial, mas o motor ainda não cobra nenhuma delas | `GET /v3/myAccount/fees` devolve a tabela vinda de `config.fees` (env `FEE_*`). O que o motor NÃO cobra (taxa promocional, taxa percentual de Pix) vai como `null` — devolver número onde não há cobrança faria o cliente conciliar contra uma taxa fantasma |
| **(E)** `POST /v3/installments/{id}/refund` aceita um `value` ("Total amount to be refunded") — mas **como esse total se reparte entre as parcelas?** Pela ordem? Pro-rata? Só a última? | a doc só descreve o campo | **estorno parcial recusado explicitamente** (400 `invalid_value`), com `TODO(regra)` em `src/modules/installments/handlers.ts`. O estorno TOTAL funciona e estorna cada parcela paga integralmente. Rateio inventado produziria valores errados com cara de certos — num campo que o cliente concilia contra o extrato |
| **(E)** Ao mudar o `nextDueDate` de uma assinatura, o `dueDate` das cobranças PENDENTES já geradas é reescrito? | não documentado | **não é.** Com ciclos curtos há várias pendentes dentro da janela e qualquer escolha seria chute. O `nextDueDate` novo vale para as PRÓXIMAS gerações; `updatePendingPayments` propaga valor, meio de pagamento, descrição, multa, juros e desconto — não vencimento. `TODO(regra)` em `src/modules/subscriptions/handlers.ts` |
| **(E)** A assinatura emite `SUBSCRIPTION_*` quando **expira** (maxPayments/endDate esgotados)? | os enums têm `SUBSCRIPTION_CREATED/UPDATED/INACTIVATED/DELETED` — **não há evento de EXPIRED** | não emitimos nada na expiração. Emitir `SUBSCRIPTION_UPDATED` seria inventar semântica; o status vira `EXPIRED` e quem consulta vê. `SUBSCRIPTION_INACTIVATED` sai só no `status: INACTIVE` explícito via `PUT` |
| **(E)** `sort`/`order` do carnê (`paymentBook`): quais campos são aceitos? | os parâmetros existem, sem lista de valores | `dueDate` (default) e `value`; qualquer outro cai em `dueDate`. `TODO(regra)` em `src/modules/booklet.ts` |
| **(E)** O carnê (`GET .../paymentBook`) devolve JSON ou PDF? | a spec declara a resposta 200 **sem schema** | **PDF de verdade** (`application/pdf`), gerado em `src/modules/booklet.ts` — cabeçalho, xref com offsets corretos e trailer. Devolver `{"url": "..."}` quebraria um cliente que espera bytes; a resposta sem schema é justamente o sinal de que não é JSON |
| **(F)** Qual o `resourceType` do payload de um evento de split? | a spec declara os eventos (`PAYMENT_SPLIT_CANCELLED`, `…_DIVERGENCE_BLOCK`, `…_DIVERGENCE_BLOCK_FINISHED`) mas **nenhum** dos 111 eventos carrega um recurso `split` | mandamos a **cobrança** (`resourceType: 'payment'`), cujo campo `split[]` já traz cada split com status, valor e motivo do cancelamento. O cliente recebe tudo que precisa, num formato que ele já sabe ler |
| **(F)** O prazo de 2 dias úteis do bloqueio por divergência vence no fim do último dia ou no início dele? | a doc só diz "2 dias úteis para ajustar" | `blockedUntil` = `addBusinessDays(criação, 2)` é o **último dia em que ainda dá para ajustar**; o job cancela quando `blockedUntil < hoje`. Criado numa segunda → prazo até quarta → cancelado na quinta |
| **(F)** Ao expirar a divergência, o Asaas emite `PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED`, `PAYMENT_SPLIT_CANCELLED`, ou os dois? | a doc lista os dois eventos, mas não diz em que caminho cada um sai | emitimos **os dois**: o bloqueio terminou E o split foi cancelado. São dois fatos distintos |
| **(F)** Os valores do split são recalculados quando a cobrança é paga por um valor diferente do original (juros/multa de atraso)? | a doc só diz "os valores exibidos podem ser atualizados após a confirmação do pagamento" | o job `split-release` **refaz `computeSplits` sobre o `netValue` FINAL** no momento do crédito. Um boleto pago em atraso vale mais, logo o `netValue` é maior e o split percentual acompanha. Se a soma passar a exceder o netValue (cobrança editada para menos), o split é **bloqueado** em vez de creditado |
| **(F)** O estorno de uma cobrança devolve o dinheiro que o split já creditou no destino? | não documentado | **sim.** `applyTransition` lança `INTERNAL_TRANSFER_REVERSAL` nos dois extratos (−no destino, +na origem). Sem isso o destinatário LUCRARIA com o estorno: ficaria com o split de uma cobrança que deixou de existir |
| **(F)** `projectedExpirationDateByLackOfUse` de uma chave de API — qual a janela de inatividade? | só existe como campo na spec, sem definição | devolvemos **null**. Chutar uma janela (30 dias? 180?) num campo que ninguém consegue conferir seria falsa confiança |
| **(F)** `city` da subconta é um id numérico do cadastro do Asaas, mas o request de criação **não tem campo de cidade** | não documentado | `city: null`. Sem a tabela de cidades do Asaas, inventar um número seria mentira (mesma decisão do G1 em `commercialInfo`) |
