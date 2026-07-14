# Asaas Mock Server

A **local Asaas**, in Docker. It simulates the Asaas sandbox with contract *and* behavioral fidelity — and, unlike the real sandbox, it **delivers webhooks to `localhost`**.

```bash
docker run -p 45445:45445 mpiresdev/asaas-mock-server
```

Then open **http://localhost:45445** — the simulator ships with a dashboard.

---

## ⚠️ Read this before anything else

Inside the container, **`localhost` is the container itself**. A webhook pointed at `http://localhost:3000` would hit the simulator, not your application — and you'd spend the afternoon hunting for an event that never left.

That's what `WEBHOOK_LOCALHOST_REWRITE` is for. It rewrites the host of any webhook URL pointing at `localhost`/`127.0.0.1`, so the event reaches your machine. **This is the reason the project exists.** If you turn it off, know why.

---

## Use it in another project

Don't clone the repository. Paste this into your application's `docker-compose.yml`:

```yaml
services:
  asaas:
    image: mpiresdev/asaas-mock-server:latest
    ports:
      - '45445:45445'
    environment:
      # Pin the key, otherwise it changes on every `docker compose down -v` and
      # your application's .env stops matching.
      #
      # The `$$` is NOT a typo: compose interpolates `$`, so a `$aact_...` would
      # become an empty variable and the container would boot with a different
      # key — with no error anywhere. `$$` yields a literal `$`.
      ASAAS_API_KEY: '$$aact_hmlg_local'

      # THE LINE THAT MAKES THIS WORK (see the warning above).
      WEBHOOK_LOCALHOST_REWRITE: host.docker.internal

      # Time flows normally, but you can skip ahead (POST /_admin/clock/advance).
      # Without this, waiting for a card's D+32 takes 32 real days.
      CLOCK_MODE: VIRTUAL_FLOWING
    extra_hosts:
      - 'host.docker.internal:host-gateway' # required on Linux
```

And in your application, switching environments is switching the base URL:

```diff
- ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
+ ASAAS_BASE_URL=http://localhost:45445/v3
```

If *your* application also runs in Docker on the same compose network, its host for reaching this one is the service name — `http://asaas:45445/v3`, not `localhost`.

**In CI**, drop `WEBHOOK_LOCALHOST_REWRITE` and `extra_hosts` (both services already see each other over the compose network) and use `CLOCK_MODE=VIRTUAL_FROZEN`, which only moves when you tell it to — that's what makes the test deterministic.

---

## Why not just use the Asaas sandbox

The sandbox doesn't deliver webhooks to `localhost`. That forces you into ngrok, into deploying a staging environment just to test, or into hand-forging payloads — and none of that tests what matters: the credit delay, the overdue interest, the split, the webhook retry.

Also, here **time is yours**:

```bash
# A credit card payment sits at CONFIRMED. The money only lands at D+32.
# On the real sandbox, you wait 32 days.
curl -X POST localhost:45445/_admin/clock/advance \
     -H 'content-type: application/json' -d '{"days": 32}'
# → PAYMENT_RECEIVED arrives at your endpoint. It took 40ms.
```

---

## What it actually simulates

This is not a mock of static responses.

- **A state machine per billing type.** Pix goes straight to `RECEIVED` (skipping `CONFIRMED`); boleto credits at D+1 business day; credit card at **D+32**; debit at D+3. An unpaid one passes through `OVERDUE` first.
- **Real money.** `netValue = value − fee`. The fee is debited in the ledger. The statement reconciles with the balance — there's a tested invariant for that.
- **Interest and late fees.** The fine is applied once, on the first day overdue; interest is pro-rata die over a 30-day commercial month.
- **Split across accounts.** Every API key is an account with its own `walletId` and balance. A split moves money and posts entries to **both** statements.
- **Webhooks the way Asaas does them.** `asaas-access-token` header, **only HTTP 200 counts as success** (201 and 204 are failures — that's the real rule), 15-attempt backoff, `SEQUENTIALLY` with genuine head-of-line blocking, and `interrupted` at the end.
- **Real card handling.** Tokenization (the PAN is never stored), test cards, pre-authorization and capture, chargeback. **Tokenization authorizes** — a card that declines never becomes a token, exactly as in Asaas — and **a token is bound to the customer that created it**. Both were captured from the sandbox, and both are the kind of thing a "save card for later" feature only discovers in production.
- **Pix that actually pays.** `GET /v3/payments/{id}/pixQrCode` returns a **real EMV BR Code** — with CRC16 — and the QR PNG. Point your camera at it: the phone reads it.
- **Subaccount onboarding.** Create it, list the pending KYC documents, upload the file (multipart), and approve — no waiting for a human reviewer.
- **The whole API surface.** All **213 operations** from the official spec exist, with authentication, validation, and the Asaas error format. **119 have a business engine**; the rest return `501` naming the missing operation — never fake data.

---

## Dashboard

Open **http://localhost:45445**. It's not the Asaas dashboard — it's the *simulator's* dashboard, and it shows what Asaas won't let you see:

- **Every account with its balance**, the main one and the subaccounts, each with its `walletId` and its copyable **API key** — something the real API would never hand you, and which here is the whole point: it's how you step into a subaccount.
- **Create a subaccount** from a form. It's born with its own wallet and key.
- **Payments and statement per account**, proving the subaccount is genuinely isolated.
- **Time travel**: `+1 day`, `+7`, `+32`. Confirm a card payment, click `+32`, and watch the balance land and the split hit the subaccount — in milliseconds.

The dashboard depends on `ADMIN_ENABLED` (it reads every account's API key), and the time buttons need a virtual clock.

---

## Test cards

The dashboard lists them, with a copy button and the exact error each one produces.

We asked the sandbox instead of reading the docs, and the answer was uncomfortable: **Asaas has exactly one kind of decline, and it is opaque.** There is no "insufficient funds", no "stolen card", not even a reason field in the body — and the eight canonical industry decline numbers (`4000…0002` and friends) all *approve* there.

| number | result | fidelity |
|---|---|---|
| `5162306219378829` · `4444444444444444` | approves | real Asaas |
| `5184019740373151` · `4916561358240741` | issuer decline (`invalid_action`) | real Asaas |
| `4000000000000069` | expired card | simulation |
| `4000000000000101` | invalid number | simulation |
| `4000000000000341` | **tokenizes, then declines when charged** | simulation |

**Any well-formed number approves** — Asaas does not validate Luhn, and neither do we (`4111111111111112` approves there too).

The cards marked *simulation* do not exist in Asaas — there, those numbers would approve. The panel says so, because a test written against behavior that only exists here becomes a bug in production. But the error they deliver is the **real** one, byte for byte: what's ours is the trigger, never the payload.

`4000000000000341` is the one that fills a hole rather than reproducing one. Because tokenization authorizes, a saved card in Asaas *always* approves — so there is no way to test the scenario that actually breaks a saved-card feature: the customer's card, stored months ago, failing on renewal. This number does that.

---

## Environment variables

| | | |
|---|---|---|
| `PORT` | `45445` | HTTP port |
| `ASAAS_API_KEY` | *generated and printed at boot* | the main account's key |
| `WEBHOOK_LOCALHOST_REWRITE` | *(empty)* | host that replaces `localhost` in webhook URLs. **Use `host.docker.internal`.** |
| `CLOCK_MODE` | `REAL` | `REAL` · `VIRTUAL_FLOWING` (flows, but you can skip) · `VIRTUAL_FROZEN` (only moves when you say so — use in CI) |
| `ADMIN_ENABLED` | `true` | enables `/_admin/*` and the dashboard |
| `DATABASE_PATH` | `/data/asaas.db` | mount a volume at `/data` to persist |
| `TZ` | `America/Sao_Paulo` | |

---

## Admin endpoints

These don't exist in Asaas. They live outside `/v3` and take no `access_token`.

| | |
|---|---|
| `GET /_admin/clock` | where the clock is |
| `POST /_admin/clock/advance` | `{"days": 32}` — one full tick per simulated day |
| `POST /_admin/clock/set` | `{"date": "2026-08-01"}` |
| `POST /_admin/tick` | runs the jobs without moving the clock |
| `GET /_admin/webhooks/deliveries` | attempt log, with status and body |
| `POST /_admin/webhooks/pause` | freezes the dispatcher (for pure time travel) |
| `GET /_admin/coverage` | how many operations have a business engine |
| `GET /_admin/fees` | the fee table in effect |

---

## Fidelity — proven, not promised

The business rules were **captured from the real Asaas sandbox** and are verified field by field by a parity suite. The capture already caught things the documentation doesn't tell you: the installment card fee **truncates** its division (it doesn't round), a subscription generates its first payment **on creation**, and each card installment credits at **D+32×n** — staggered, not all at once.

---

## Tags and platforms

`latest` · `0.1.0` — `linux/amd64` and `linux/arm64`.

Pin a version in your tests: `mpiresdev/asaas-mock-server:0.1.0`. With `latest`, a future release changes the mock's behavior underneath your suite.

---

## Source, issues, and license

**https://github.com/theoxys/asaas-mock-server** — MIT.

An **independent** project, with no affiliation, sponsorship, or endorsement from Asaas. "Asaas" is a trademark of its respective owners. This simulator exists for local development and testing: **do not use it in production**, and never point a production key at it.
