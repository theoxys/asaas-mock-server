# AGENTS.md — como trabalhar neste projeto

## O que é

Um **Asaas local**: um servidor que expõe a API v3 do Asaas e roda em Docker na
máquina do dev.

## Por que existe

**O sandbox do Asaas não entrega webhooks em `localhost`.** É isso. É o problema
inteiro. Você cria a cobrança, ela é paga, e o evento nunca chega na sua máquina.
Todo mundo contorna com ngrok, ou sobe um staging só pra testar, ou escreve um
payload falso à mão — e nenhuma dessas coisas testa o que de fato importa: o
prazo de crédito, o juro do atraso, o split, a retentativa do webhook.

Este servidor entrega webhook em localhost. E, porque tem um **relógio virtual**,
você avança 32 dias em milissegundos e vê o `PAYMENT_RECEIVED` do cartão chegar.
Nenhuma suíte rodando contra o Asaas real consegue fazer isso.

## O que ele NÃO é

**Não é um mock de respostas estáticas.** Uma cobrança de cartão criada aqui fica
`CONFIRMED`, credita em D+32, debita a taxa de R$ 0,49 + 2,99%, movimenta o split
entre contas e gera lançamento nos dois extratos. Se você está prestes a
devolver um JSON fixo, pare: é a única coisa que o projeto não pode fazer.

Um mock sutilmente errado é **pior que nenhum mock**, porque produz falsa
confiança. Quando não souber a regra real, não invente: marque com `TODO(regra)`,
deixe configurável, e registre em `progress.md`.

---

## Stack

Bun · Elysia · Drizzle · SQLite (`bun:sqlite`) · TypeBox · Docker

## Fonte de verdade

`spec/openapi.json` — a spec OpenAPI 3.0.1 oficial do Asaas, vendorizada
byte-a-byte. **Nunca edite esse arquivo.** Correções vão em `spec/overlays/*.json`
como JSON Patch, com um `_why` explicando (já há uma: a spec omite o status
`AUTHORIZED` de todos os 7 enums de status).

`bun run codegen` transforma a spec em `src/generated/` — schemas TypeBox, os 74
enums canônicos, e o **manifesto** das 213 operações.

### Mas a spec prova a FORMA. Só a API real prova o CONTEÚDO.

`bun run test:parity` compara as nossas respostas com respostas **capturadas do
sandbox real do Asaas** (`tests/golden/*.json`). Essa suíte é a autoridade máxima
deste projeto — acima da documentação, acima da spec, e acima de qualquer comentário
no código.

Leia isto antes de confiar na documentação do Asaas: **quando rodamos a captura pela
primeira vez, ela derrubou 15 regras que tínhamos deduzido da doc.** Entre elas:

- A assinatura **cria a primeira cobrança na hora** — nós tínhamos escrito, num
  comentário em letras garrafais, que ela *não* criava, com um aviso para ninguém
  "consertar". Nosso recurso de assinatura simplesmente não cobrava nada, e três
  testes "provavam" que estava certo.
- O campo do desconto chama `limitDate`; escrevíamos `limitedDate`. **A spec não
  declara nenhum dos dois** — a validação de contrato jamais pegaria. Só a API real
  pegou.

A lição, que vale para você: **um comentário confiante e errado é pior que comentário
nenhum, porque impede a próxima pessoa de duvidar.** Se você vai afirmar uma regra de
negócio, prove-a com um roteiro de paridade (`tests/golden/scenarios.ts`) ou diga
explicitamente que não está provada.

Toda divergência que a paridade apontar é bug **nosso**. O Asaas é a verdade; não
"conserte" o golden.

---

## Os invariantes. Não negocie com eles.

### 1. `src/domain/` é PURO

Não importa `db`, `http`, `core/clock` nem `AppContext`. Toda função recebe
`now: Date` e os valores de que precisa como **argumento**.

É o que permite testar os cálculos sem subir nada, e é o que deixa dois agentes
trabalharem em paralelo sem colidir.

### 2. Nada de tempo ou aleatoriedade ambiente

`Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()` e
`CURRENT_TIMESTAMP` são **proibidos** fora de `src/core/clock.ts` e
`src/core/rng.ts`. Use `ctx.clock` e `ctx.rng`.

Um único vazamento e a viagem no tempo passa a gravar a data real: o determinismo
morre em silêncio e o bug volta como teste intermitente daqui a três meses.
`tests/unit/no-ambient-time.test.ts` faz grep no fonte e quebra o build.

### 3. Dinheiro é inteiro em centavos

Sempre. Sufixo `Cents`. `R$ 1,99` → `199`.

`REAL` no SQLite é IEEE-754 e o saldo corrente acumula erro. Pior: as regras do
Asaas são regras de **resto exato** ("a sobra vai na última parcela") e só se
expressam em aritmética inteira. Converta para reais **só na borda**, ao
serializar. Percentual de split tem 4 casas → escala `1e4` (`E4`). Taxa
percentual em basis points (`Bp`).

### 4. O status de uma cobrança só muda em UM lugar

`applyTransition()`. Sandbox action, scheduler, captura, `receiveInCash`,
refund — todos passam por lá.

Webhook e lançamento no ledger são **efeitos da transição**, não algo que o
handler lembra de fazer. É o que garante que eles não possam divergir. Se você
está escrevendo `UPDATE payments SET status = …` fora do `applyTransition`, está
introduzindo o bug que essa regra existe para prevenir.

### 5. Saldo só muda via `postEntries()`

Ele grava o lançamento e atualiza `accounts.balanceCents` na **mesma transação**.
O invariante `balance === SUM(ledger)` é checado nos testes.

### 6. Toda mutação de estado usa compare-and-swap

`UPDATE … WHERE id = ? AND status = <esperado>`. Uma execução duplicada de job
altera zero linhas. É a camada de idempotência que realmente salva.

---

## Como uma rota nasce

Você **não** mexe em roteamento. O registro é dirigido pelo manifesto: todo
`operationId` sem handler já responde `501` com o formato de erro do Asaas.

Para implementar uma operação:

1. Escreva o handler em `src/modules/<sua-área>/handlers.ts`.
2. Adicione ao spread em `src/modules/index.ts`.

Pronto. A rota, a autenticação, a validação de body e o formato de erro já
existiam. `bun run coverage:ops` recalcula a cobertura sozinho.

## Formato da API — detalhes que quebram integração

- Criação retorna **200**, nunca 201.
- Erro é **sempre** `{"errors":[{"code":"invalid_<campo>","description":"…"}]}` —
  array mesmo com um erro só, descrição em pt-BR.
- Listagem: `{object:"list", hasMore, totalCount, limit, offset, data:[]}`, `limit` ≤ 100.
- Webhook: **só HTTP 200 é sucesso**. 201 e 204 são falha. (É a regra real, e é
  onde as integrações se queimam — por isso reproduzimos.)
- IDs não são uniformes, e isso é de propósito: `pay_<12díg>`, `cus_<12díg>`,
  `sub_<alfanum>`, mas installment/transfer/split/webhook/walletId são **UUID
  puro**. Não "padronize".

## Testes

- `tests/unit/` — `src/domain/`, puro, table-driven. É onde moram 90% dos bugs
  reais (arredondamento, juros, divisão de parcelas).
- `tests/integration/` — usa `createHarness()`: servidor real, SQLite em memória,
  relógio congelado, RNG semeado, webhook sink HTTP de verdade.
- **Contrato é de graça**: o `ApiClient` do harness valida *toda* resposta da
  suíte contra o schema da spec. Você ganha isso escrevendo teste de feature.
- `h.assertLedgerBalances()` no fim de todo cenário financeiro.

Ao viajar no tempo: `h.advance({days: 32})` já drena a fila de webhooks a cada
dia. Se precisar de viagem "pura", `POST /_admin/webhooks/pause` — senão as 15
tentativas de backoff se esgotam sozinhas e o webhook vira `interrupted`.

## A pegadinha do Docker

Dentro do container, `localhost` é o container. `WEBHOOK_LOCALHOST_REWRITE`
(default `host.docker.internal`) reescreve o host para que o webhook chegue na
máquina do dev. É a razão de o projeto existir — não desligue sem saber por quê.

## Regras de negócio

Duas categorias, e a diferença importa:

**PROVADAS contra o sandbox real** (`bun run test:parity`, 7 roteiros, 0
divergências). Estão em `progress.md` → "Paridade com o Asaas real", com o que cada
roteiro provou. Exemplos: a taxa fixa de R$ 1,99 do Pix; a sobra do arredondamento na
última parcela; o crédito escalonado em D+32×n do cartão parcelado; a assinatura que
cobra na criação.

**Apenas PESQUISADAS na documentação** — tudo o mais. Estão em `MASTER_PLAN.md` §7 com
as fontes, e em `progress.md` → "Regras que a documentação não define". Trate-as como
hipóteses: já derrubamos 15 delas na primeira captura.

Todo número está em `src/core/config.ts`, atrás de variável de ambiente — para que uma
divergência de valor seja mudança de config, não de código.

**Ao descobrir uma divergência com o Asaas real:**
1. Corrija o simulador (o Asaas é a verdade — nunca "conserte" o golden).
2. Leve a regra provada para um golden test em `tests/unit/`.
3. Anote em `progress.md`.
4. E **corrija os comentários que afirmavam o contrário.** Um comentário errado que
   sobrevive à correção é uma armadilha para a próxima pessoa.
