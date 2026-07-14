# Asaas Mock Server

Um **Asaas local**, em Docker. Simula o sandbox do Asaas com fidelidade de
contrato e de comportamento — e, ao contrário do sandbox real, **entrega webhooks
em `localhost`**.

```bash
docker run -p 45445:45445 mpiresdev/asaas-mock-server
```

## Usar em outro projeto

Não clone este repositório. Cole isto no `docker-compose.yml` da sua aplicação:

```yaml
services:
  asaas:
    image: mpiresdev/asaas-mock-server:latest
    ports:
      - '45445:45445'
    environment:
      # Fixe a chave, senão ela muda a cada `docker compose down -v` e o .env da
      # sua aplicação para de bater.
      #
      # O `$$` NÃO é erro de digitação: o compose interpola `$`, então um
      # `$aact_...` viraria uma variável vazia e o container subiria com outra
      # chave — sem erro nenhum, e você perderia a tarde. `$$` produz um `$`.
      ASAAS_API_KEY: '$$aact_hmlg_local'

      # A LINHA QUE FAZ ISTO FUNCIONAR. Dentro do container, "localhost" é o
      # PRÓPRIO container: um webhook para http://localhost:3000 bateria nele
      # mesmo. Aqui o host é reescrito e o evento chega na sua máquina.
      WEBHOOK_LOCALHOST_REWRITE: host.docker.internal

      # O tempo anda normal, mas você pode pular (POST /_admin/clock/advance).
      # Sem isto, esperar o D+32 de um cartão leva 32 dias de verdade.
      CLOCK_MODE: VIRTUAL_FLOWING
    extra_hosts:
      - 'host.docker.internal:host-gateway' # necessário no Linux
```

E na sua aplicação, trocar de ambiente é trocar a URL base:

```diff
- ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
+ ASAAS_BASE_URL=http://localhost:45445/v3
+ ASAAS_API_KEY=$aact_hmlg_local
```

Se a *sua* aplicação também roda em Docker, na mesma rede do compose, o host dela
para chegar aqui é o nome do serviço — `http://asaas:45445/v3`, não `localhost`.

**Em CI**, tire o `WEBHOOK_LOCALHOST_REWRITE` e o `extra_hosts` (os dois serviços
já se enxergam pela rede do compose) e use `CLOCK_MODE=VIRTUAL_FROZEN`, que só
anda quando você mandar — é o que torna o teste determinístico.

## Desenvolver o próprio simulador

```bash
git clone … && cd asaas-mock-server
docker compose up      # compila o código local, não puxa do registry
```

## ⚠️ Leia isto antes de qualquer coisa

Dentro do container, **`localhost` é o próprio container**. Um webhook apontado
para `http://localhost:3000` bateria no simulador, não na sua aplicação.

Por isso, o `docker-compose.yml` já vem com:

```yaml
environment:
  WEBHOOK_LOCALHOST_REWRITE: host.docker.internal
extra_hosts:
  - 'host.docker.internal:host-gateway'   # faz funcionar no Linux também
```

O host de qualquer URL de webhook apontada para `localhost`/`127.0.0.1` é
reescrito, e o evento chega na sua máquina. É a razão de este projeto existir.
Se você desligar, saiba por quê.

## Por que não usar o sandbox do Asaas

O sandbox não entrega webhook em `localhost`. Isso obriga a ngrok, a subir um
staging só pra testar, ou a forjar payload à mão — e nada disso testa o que
importa: o prazo de crédito, o juro do atraso, o split, a retentativa do webhook.

Além disso, aqui o tempo é seu:

```bash
# cria uma cobrança no cartão → ela fica CONFIRMED
# o dinheiro só cai em D+32. No sandbox real, você espera 32 dias.
curl -X POST localhost:45445/_admin/clock/advance \
     -H 'content-type: application/json' -d '{"days": 32}'
# → PAYMENT_RECEIVED chega no seu endpoint. Levou 40ms.
```

## O que ele simula de verdade

Não é um mock de respostas estáticas.

- **Máquina de estados por meio de pagamento.** Pix vai direto a `RECEIVED`
  (pula `CONFIRMED`); boleto credita em D+1 útil; cartão de crédito em **D+32**;
  débito em D+3. Vencido passa por `OVERDUE` antes.
- **Dinheiro de verdade.** `netValue = value − taxa`. A taxa é debitada no
  ledger. O extrato fecha com o saldo — há um invariante testado para isso.
- **Juros e multa.** Multa uma vez no 1º dia de atraso; juros pro-rata die sobre
  mês comercial de 30 dias.
- **Split entre contas.** Cada API key é uma conta com `walletId` e saldo
  próprios. O split move dinheiro e lança nos **dois** extratos.
- **Webhooks como o Asaas faz.** Header `asaas-access-token`, **só HTTP 200 é
  sucesso** (201 e 204 são falha — é a regra real), backoff de 15 tentativas,
  `SEQUENTIALLY` com head-of-line blocking de verdade, `interrupted` no fim.
- **Cartão de verdade.** Tokenização (o PAN nunca é gravado), cartões de teste,
  pré-autorização e captura, chargeback. Parcelamento no cartão cobra o cartão.
- **Recorrência.** A assinatura já gera a **primeira cobrança na criação** (e avança
  o ciclo); as seguintes nascem 40 dias antes do vencimento. Parcelamento: a sobra
  do arredondamento vai na **última** parcela, e no cartão cada parcela credita em
  **D+32×n** — escalonada, não todas juntas. *(As três regras foram capturadas do
  sandbox real; as três contrariam o que a documentação sugere.)*
- **Pix que se paga.** `GET /v3/payments/{id}/pixQrCode` devolve um **BR Code EMV de
  verdade** — com CRC16 — e o PNG do QR. Aponte a câmera: o celular lê. (O teste
  decodifica a imagem de volta; um QR que só *parece* um QR não passa.)
- **Onboarding de subconta.** Criar a subconta, listar os documentos pendentes do
  KYC, enviar o arquivo (multipart), e aprovar — sem esperar análise humana.
- **Cobertura da API inteira.** As 213 operações da spec oficial existem, com
  autenticação, validação e formato de erro. **119 têm motor de negócio**; as
  demais respondem `501` dizendo qual operação falta — nunca um dado falso.

## Painel

Abra **`http://localhost:45445`**. Não é o painel do Asaas — é um painel do
*simulador*, e mostra o que o Asaas não te deixa ver:

- **Todas as contas com saldo**, a principal e as subcontas, lado a lado. Cada uma
  com o seu `walletId` e a sua **chave de API** (copiável) — algo que a API real
  jamais devolveria, e que aqui é o ponto: é assim que você entra numa subconta.
- **Criar subconta** num formulário. Ela nasce com carteira e chave próprias.
- **Cobranças e extrato por conta.** Clique numa subconta e veja que ela é de fato
  isolada: não enxerga as cobranças da conta-mãe, mas o crédito do split está lá.
- **Viagem no tempo**: `+1 dia`, `+7`, `+32`. Confirme uma cobrança no cartão,
  clique em `+32`, e veja o saldo entrar e o split cair na subconta — em
  milissegundos. É a coisa que nenhuma suíte contra o Asaas real consegue fazer.

O painel depende de `ADMIN_ENABLED` (ele lê as chaves de API de todas as contas).
Os botões de tempo exigem um relógio virtual — o `docker-compose.yml` já sobe com
`CLOCK_MODE=VIRTUAL_FLOWING` (o tempo anda normal, mas você pode pular). Em modo
`REAL` eles aparecem desabilitados, dizendo por quê.

## Prove você mesmo

```bash
bun run e2e
```

Sobe o servidor, cria uma cobrança Pix por HTTP, confirma, e espera o
`PAYMENT_RECEIVED` chegar num listener local. É a promessa inteira do projeto num
comando. Rode também contra o container, que é onde a armadilha do `localhost`
mora de verdade:

```bash
docker compose up -d
bun run e2e -- http://localhost:45445 "$(docker compose logs | grep 'API key' | sed 's/.*API key *//')"
```

## Uso

A API é a do Asaas. Trocar de ambiente é trocar a URL base:

```
https://api-sandbox.asaas.com/v3   →   http://localhost:45445/v3
```

A chave de API vem do `.env` (`ASAAS_API_KEY`). Se você não definir uma, o
servidor gera e **imprime no boot**.

```bash
curl localhost:45445/v3/customers \
  -H "access_token: $ASAAS_API_KEY" \
  -H 'content-type: application/json' \
  -d '{"name":"Fulano","cpfCnpj":"24971563792"}'
```

## Endpoints administrativos

Não existem no Asaas. Ficam fora de `/v3` e não pedem `access_token`.
Desligue com `ADMIN_ENABLED=false`.

| | |
|---|---|
| `GET /_admin/clock` | onde o relógio está |
| `POST /_admin/clock/advance` | `{"days": 32}` — um tick completo por dia simulado |
| `POST /_admin/clock/set` | `{"date": "2026-08-01"}` |
| `POST /_admin/tick` | roda os jobs sem mexer no relógio |
| `GET /_admin/webhooks/deliveries` | log de tentativas, com status e corpo |
| `POST /_admin/webhooks/pause` | congela o dispatcher (para viagem no tempo pura) |
| `GET /_admin/coverage` | quantas operações têm motor de negócio |
| `GET /_admin/fees` | tabela de taxas em vigor |

Para testar com tempo determinístico, suba com `CLOCK_MODE=VIRTUAL_FROZEN`: o
relógio só anda quando você mandar.

## Desenvolvimento

```bash
bun install
bun run codegen        # spec OpenAPI → TypeBox + manifesto das 213 operações
bun run db:generate    # migrações a partir do schema Drizzle
bun run dev

bun test
bun run coverage:ops --by-tag
bun run spec:diff      # o Asaas mudou a API?
```

Leia **`AGENTS.md`** antes de contribuir — há invariantes que não se negociam
(domínio puro, nada de `Date.now()`, dinheiro em centavos).
Estado do projeto e próximos passos: **`progress.md`**.

## Fidelidade — provada, não prometida

As regras de negócio deste simulador foram **capturadas do sandbox real do Asaas** e
são verificadas campo a campo por uma suíte de paridade:

```bash
bun run test:parity     # 7 roteiros · 0 divergências
```

`tools/capture.ts` roda os roteiros contra o Asaas de verdade e grava as respostas em
`tests/golden/`. A suíte replica os mesmos roteiros contra o simulador e compara tudo
o que não é legitimamente volátil: `value`, `netValue`, `status`, as datas (como
offsets), a estrutura de `discount`/`fine`/`interest`, e até **o conjunto exato de
chaves do objeto**.

Isso não é decoração. A captura **derrubou 20 regras** que tínhamos deduzido da
documentação — entre elas:

- criar uma assinatura **cria a primeira cobrança na hora** (a doc sugere que não, e
  nossa versão anterior não cobrava nada: o recurso estava quebrado);
- a taxa do cartão parcelado sai do **total**, não de cada parcela — e a divisão
  **trunca**: R$ 350 em 12x dá R$ 1,20 de taxa por parcela, não R$ 1,21. Nós
  arredondávamos, e errávamos **um centavo por parcela**;
- a parcela `n` credita em **D+32×n**, escalonada — não todas juntas;
- o campo do desconto chama `limitDate`, e nós escrevíamos `limitedDate` — **a
  validação de contrato nunca pegaria isso, porque a spec não declara o campo.**

### Validado contra um cliente real

As **26 chamadas** que uma aplicação real (PartiuRole) faz ao Asaas foram
exercitadas contra o simulador e comparadas, **chave a chave**, com a resposta do
sandbox. Isso encontrou seis buracos que a suíte de contrato não via — entre eles o
QR Code do Pix, o parcelamento por `POST /v3/payments`, e pagar com um cartão já
tokenizado (a spec exige o PAN; o Asaas real, não). Ver `progress.md`.

Para recapturar com a sua conta (precisa de uma chave de **sandbox**):

```bash
ASAAS_SANDBOX_API_KEY='$aact_hmlg_…' bun run capture
bun run test:parity
```

O script **recusa qualquer chave que não comece com `$aact_hmlg_`** — uma chave de
produção criaria cobranças de verdade.

Toda divergência que a paridade apontar é um bug **nosso**: o Asaas é a verdade.
Conserte o simulador, leve a regra provada para um golden test em `tests/unit/`, e
registre em `progress.md`.

**O que ainda não está provado** está listado em `progress.md` — com destaque para os
*payloads de webhook*, que exigiriam um túnel público para capturar (o sandbox não
entrega em localhost, que é o motivo de este projeto existir).
