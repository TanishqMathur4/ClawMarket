# ClawMarket — Fiverr for AI Agents (with referees)

> Project codename. Pick a real name in Phase 0.

## One-line pitch

A marketplace where AI agents autonomously hire other AI agents to do work, then hire a **referee agent** to validate that the work isn't hallucinated before paying. Every step uses ERC-8004 identity + reputation + validation, settles via x402, and lives on GOAT Network.

## Why a judge will care

1. **It's the most visceral demo of the agent economy.** Watch one agent hire another, watch a third agent grade the work, watch the payment go through on chain — or fail and retry — all in 30 seconds, no humans.
2. **It uses every piece of the stack as intended.** OpenClaw runs the agents, ERC-8004 gives them identity + reputation + validation history (all three registries), x402 handles payment, GOAT Network is the settlement layer secured by Bitcoin.
3. **It addresses the elephant in the room — LLMs hallucinate.** The referee is the answer. A marketplace without verification pays for slop. We caught that and built around it.
4. **It generalizes.** Today: writer / translator / image-gen / fact-checker + 2 referees. Tomorrow: any service any agent could perform, with any agent able to grade any other. Real startup wedge.

## Stack

- **OpenClaw** (`npm install -g openclaw@latest`) — agent runtime + LLM glue
- **ERC-8004** reference contracts — Identity + Reputation + **Validation** registries
- **x402** (`@x402/express`, `@x402/fetch`) — HTTP payment middleware
- **GOAT Network** (testnet3 RPC: `https://rpc.testnet3.goat.network`) — EVM L2, settlement
- **goat-sdk/goat** — agentic wallet/payments toolkit
- **LLMs** — Claude Sonnet 4.6 by default; Haiku 4.5 for the cheap sellers and judges
- **Languages** — TypeScript + Node 22+, Solidity for contracts
- **Demo UI** — single-page HTML/JS, no build step

## Team and ownership

Four people, 12 hours. Each of us has a scoped CLAUDE.md in our own subfolder (`/tanishq/`, `/matteo/`, `/kevin/`, `/t4/`) — open that in Cursor or Claude Code and vibe-code against it. This top-level file is the shared context. Architecture lives in `ARCHITECTURE.md`.

The split is built around one principle: **the broker is a thin orchestrator** that calls Kevin's toolkit, which is the only code that touches the chain or the wire. Tanishq writes the brain; Kevin writes the hands; Matteo builds the workers; T4 builds the judges and the audience-facing dashboard.

### Tanishq — Broker brain + contracts (tech lead)

Owns: `/agents/broker`, `/contracts`, `/scripts/*`.

Deploys all three ERC-8004 registries to GOAT (or Base Sepolia fallback), mints identities for all 7 agents, pre-funds wallets with both test USDC and native gas. Then builds the broker: a two-phase pipeline that hires a seller, hires a referee to grade the seller's output, and either pays + posts feedback or retries with the next-best seller. Drives the demo on stage.

### Matteo — Seller agents (heads-down)

Owns: `/agents/_template`, `/agents/writer`, `/agents/translator`, `/agents/imagegen`, `/agents/factchecker`.

One Express + `@x402/express` template, four forks with different system prompts and prices. Each hosts `/agent.json` and a paid `POST /work` endpoint that calls an LLM. Each manages its own wallet. Heads-down work — one clean spec, no coordination overhead after Phase 1.

Important demo job: tune ONE of the sample task prompts so the cheapest seller reliably hallucinates. That's the moment the referee catches on stage, and the broker silently retries with the next-best seller. Coordinate with T4 in Phase 4 to calibrate.

### Kevin — Broker toolkit + pitch (vibe-coder)

Owns: `/shared/tools/`, project branding, pitch deck, sample task library, demo script, talk-track during judging.

Two jobs. First, write the five toolkit functions everyone else depends on — `discoverAgents`, `getReputation`, `postFeedback`, `payAndCall`, `writeValidation`. Clean async TS, each one self-contained, all using viem. Tanishq's broker imports four of them; T4's referees import `writeValidation`; T4's dashboard imports the read-side ones. **You're the only person who touches the chain or the wire. Be the most robust code in the repo.**

Second, own the demo narrative. 10 sample tasks per agent type. 5-slide pitch deck. Tight 60-second demo script. During judging: you narrate, Tanishq drives.

### T4 — Referees + dashboard (frontend + agentic)

Owns: `/agents/_referee-template`, `/agents/general-referee`, `/agents/vision-referee`, `/dashboard/`.

Two parts. First, build the two referee agents. Same Express + x402 pattern as Matteo's sellers, but the LLM acts as a judge: given `(task, sellerOutput)`, return `{ passed, confidence, reasoning }`. After deciding, the referee calls Kevin's `writeValidation` to record the verdict on chain. **The validator prompt is the hard part** — strict enough to catch real hallucinations but not flaky on borderline cases.

Second, build the demo dashboard. Single HTML file, plain CSS or Tailwind from CDN, viem from CDN. Five sections: task input, agent grid (7 cards with live balances + reputation), activity feed, **validation panel** (this is the showstopper — display the referee's reasoning verbatim when it catches a hallucination), on-chain receipts strip.

Pair with Kevin in Phase 3 for chain event subscriptions.

## Repo layout

```
/contracts            ERC-8004: Identity + Reputation + Validation (Tanishq)
/agents
  /_template          seller base — Express + x402 + LLM (Matteo)
  /_referee-template  referee base — Express + x402 + LLM-as-judge (T4)
  /writer             seller, port 3001 (Matteo)
  /translator         seller, port 3002 (Matteo)
  /imagegen           seller, port 3003 (Matteo)
  /factchecker        seller, port 3004 (Matteo)
  /general-referee    referee, port 3005 (T4)
  /vision-referee     referee, port 3006 (T4)
  /broker             port 3000 — the buyer agent (Tanishq)
/shared
  /abi                ABIs for all three registries
  /clients            viem clients, contract addresses, token IDs
  /tools              broker toolkit — 5 functions (Kevin)
  /types              AgentCard, Task, ValidationResponse, etc.
  /llm                shared LLM wrapper used by sellers + referees
/dashboard            single-page HTML demo UI (T4)
/scripts              deploy-contracts, register-agents, fund-wallets, smoke-test (Tanishq)
/.env.example
README.md
CLAUDE.md
ARCHITECTURE.md
```

## Code conventions

- TypeScript strict, no `any` in shared code
- **viem**, not ethers (Kevin's toolkit is viem-based; everyone else follows)
- USDC amounts in 6-decimal raw units as `bigint` (e.g. `50_000n` = $0.05); display as floats only in the UI
- Contract addresses + token IDs from `/shared/clients/index.ts`; never hardcode
- All `.env` keys documented in `.env.example`; commit `.env.example`, never `.env`
- Logging: `console.log(JSON.stringify({ agent: "translator", event: "received_task", taskId }))` — one structured JSON object per line; T4's dashboard tails these
- Testnet only. No real funds. Anywhere.

## Phased timeline (12 hours)

### Phase 0 — Kickoff (h0 → h0:30) — all hands

Sit together with the organizers' starter materials. Confirm:

1. Where we deploy — GOAT testnet3 or Base Sepolia (x402's hosted facilitator doesn't speak GOAT yet)?
2. Pre-deployed ERC-8004, or do we deploy our own (all three registries)?
3. Faucet URL, RPC, chain ID.
4. Everyone has Node 22+, an Anthropic/OpenAI API key, and a wallet on the right network.

Pick the project name. Settle on the chain.

### Phase 1 — Foundations (h0:30 → h3) — parallel, no dependencies

- **Tanishq**: scaffold monorepo, deploy 3 registries, write `register-agents.ts` (mints 7 identities) and `fund-wallets.ts` (USDC + native gas).
- **Matteo**: build `/agents/_template`. Goal: writer agent end-to-end — curl `/work`, see 402, pay with `@x402/fetch`, get back an LLM response.
- **Kevin**: stub the five toolkit functions with full signatures + JSDoc, draft pitch deck outline, start the 40-task sample library.
- **T4**: build `/agents/_referee-template`. Goal: general-referee end-to-end — curl `/validate`, see 402, pay, get back `{ passed, reasoning, validationTxHash }`. Also sketch dashboard HTML layout.

### Phase 2 — Fill out the cast (h3 → h6)

- **Tanishq**: broker skeleton — task endpoint, agent discovery, ranking function (sellers + referees separately). Print "Found N sellers, N referees" but don't hire yet.
- **Matteo**: fork `_template` into 3 more — translator, imagegen, factchecker. Different prompts, prices, ports.
- **Kevin**: implement the five toolkit functions for real, populate `/shared/clients/index.ts` with Tanishq's deployed addresses. Smoke-test each function in isolation.
- **T4**: fork `_referee-template` into vision-referee (multimodal LLM). Build static dashboard with mocked data so the layout is locked.

### Phase 3 — Integration (h6 → h9) — talk to each other a lot

- **Tanishq**: full two-phase pipeline. Broker hires seller → calls `payAndCall` → hires referee → calls `payAndCall` → reads verdict → either `postFeedback(5)` and returns, or `postFeedback(1)` and retries. End-to-end smoke test against one seller + one referee.
- **Matteo**: stand by for bug-fixes; tune one sample prompt to reliably hallucinate.
- **Kevin**: stabilize toolkit as issues surface; help T4 with chain event subscription.
- **T4**: wire dashboard to live data — broker's SSE stream, `viem.watchContractEvent` on USDC Transfer + Reputation + Validation. Validation panel renders the referee's reasoning.

### Phase 4 — Polish and demo prep (h9 → h11)

- **Tanishq**: rehearse the full happy path AND the fail+retry path 3 times each. Re-fund wallets. Record a screen capture as backup.
- **Matteo**: stabilize. Stop new features at h10:30.
- **Kevin**: pitch deck final, sample tasks final, demo script printed, talk-track rehearsed 3 times out loud.
- **T4**: dashboard CSS polish, event copy ("Broker chose Translator — $0.05" not "evt: hired"). Stop new features at h10:30.

### Phase 5 — Final hour (h11 → h12)

- 11:00 — Stop coding. Last commit. Tag it.
- 11:15 — Dry run #1, all four present, simulate judging.
- 11:30 — Dry run #2 with backup video ready.
- 11:45 — README polish, devpost/dorahacks submission, GitHub link.
- 12:00 — Submit. Eat something.

## Risk register and fallbacks

1. **x402 facilitator doesn't support GOAT yet.** Most likely outcome. Fallback: deploy on Base Sepolia, pitch GOAT compatibility as roadmap. *Decide in Phase 0.*
2. **ERC-8004 reference contracts won't deploy / are flaky.** Fallback: deploy a minimal mock with three functions: `register(uri)`, `postFeedback(id, score)`, `submitValidation(sellerId, refereeId, hash, passed)`. Loses the "uses the real standard" talking point but keeps the demo working.
3. **Referee's validator prompt is inconsistent.** Test it against 20 known-good and 20 known-bad sample outputs in Phase 4. If it's flaky, simplify the rubric (binary pass/fail with one-line reason).
4. **Broker's ranking looks dumb on stage.** Pre-bias the test set: make sure when judges submit a writing task, the writer agent is actually the best by `score² / price`.
5. **One service agent crashes mid-demo.** Broker has try/catch that retries with the next-best seller. This is *more* impressive than a happy path.
6. **Live x402 payment hangs.** Backup video. Always have a backup video.
7. **Wallets run out of testnet USDC or GOAT native.** Pre-fund with 10× expected burn. Faucets are rate-limited at peak.

## Demo script (60 seconds — Kevin owns)

Kevin narrates, Tanishq drives, T4 watches the dashboard for the validation moment, Matteo stays at the keyboard ready to restart any crashed seller.

> "Meet ClawMarket. Fiverr, but the workers are AI agents, the marketplace operator doesn't exist, and there's a *referee* agent that verifies the work before anyone gets paid."
>
> *(types into dashboard)* "Translate this paragraph to Mandarin."
>
> *(activity feed)* "Broker pulls the four sellers from ERC-8004 on GOAT. It picks Translator — 4.5 stars, five cents. Pays via x402, settles in two seconds."
>
> *(validation panel highlights)* "But wait — the broker doesn't trust the result blindly. It hires the General Referee to grade the translation. The referee runs a separate model as a judge, posts its verdict on chain to the Validation Registry, and reports back: *passed*. Now the broker pays, posts a 5-star review, and returns the result."
>
> *(if the demo shows a fail-and-retry)* "Watch this one — the Writer hallucinated. The referee caught it. The broker isn't paying that seller; it's going back to the registry and trying the next-best one. Zero humans, hallucination caught, refund avoided."
>
> "Total cost: seven cents. Total humans involved: zero. Bitcoin-secured via GOAT Network. That's the agent economy with a quality bar, working."

## Glossary

- **ERC-8004** — Ethereum standard for AI agent identity + reputation + validation. Lives on chain.
- **Validation Registry** — the third ERC-8004 registry. Referees write verdicts here.
- **x402** — HTTP-native payments protocol. 402 status code + signed stablecoin payment + facilitator settles.
- **Facilitator** — off-chain service that verifies and settles x402 payments. Coinbase hosts one for major EVMs.
- **GOAT Network** — Bitcoin L2 (BitVM2 zkRollup). EVM-compatible, settles to Bitcoin.
- **OpenClaw** — self-hosted agent framework. LLM + tools + memory + channels.
- **Agent card** — the off-chain JSON each agent hosts at `/agent.json`. Includes role (seller/referee), capabilities, price, endpoint.
- **Referee** — an agent whose job is to grade another agent's output and write the verdict on chain.

## Notes on working with Claude / Cursor

- Open this file as `CLAUDE.md` in Claude Code or Cursor — the assistants auto-pick it up as project context.
- Each person also has a scoped CLAUDE.md in their own subfolder with their specific spec.
- For each major task, draft the spec in plain English first, paste it to the assistant, iterate. Don't let the assistant invent architecture — refer back to ARCHITECTURE.md.
- If the AI tries to mock x402, ERC-8004, or the Validation Registry because "real integration is complex" — push back. The whole point is the real thing.
