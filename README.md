# OpenUI x F1

A Formula 1 demo built on OpenUI: a "team radio" chat that answers with live charts, tables and F1 visuals, alongside Home, Standings, Drivers and Teams dashboards. All data comes from [OpenF1](https://openf1.org).

It grew out of the [conversational analytics cookbook](https://github.com/thesysdev/openui/tree/main/examples/cookbooks/conversational-analytics) in the OpenUI repo. The cookbook stays small and matches its [walkthrough](https://www.openui.com/cookbooks/conversational-analytics); this repo is the full demo that gets deployed.

## Run it

Needs Node 22.13 or later.

```bash
npm install
echo "THESYS_API_KEY=sk-th-..." > .env.local
npm run snapshot:f1   # optional: cache finished 2026 sessions so the tools work offline
npm run dev
```

Open http://127.0.0.1:3000.

| Variable            | Default            | Purpose                                                    |
| ------------------- | ------------------ | ---------------------------------------------------------- |
| `THESYS_API_KEY`    | (required)         | OpenUI Gateway key, used only on the server                |
| `OPENUI_MODEL`      | `openai/gpt-5.5`   | Model for the chat                                         |
| `OPENF1_PER_MINUTE` | `28`               | OpenF1 request budget per minute                           |

## Pages

| URL                               | What it shows                                    |
| --------------------------------- | ------------------------------------------------ |
| `/`, `/standings`, `/drivers`, `/teams` | Dashboards; picking anything starts a chat |
| `/new`                            | A new chat, with three questions suggested from your earlier ones (`/api/starters`) |
| `/[threadId]`                     | An earlier chat, from this browser's local storage |

Each URL is its own page under `src/app/(radio)/`. The layout holds what stays mounted between them: the chat store, the sidebar, the input, and the thread once a conversation has messages. That is what lets the URL move from `/new` (or a dashboard) to the new thread mid-answer without cutting it off.

## How a question is answered

1. The browser sends the whole thread to `/api/chat`. The route keeps only the questions and answers and drops any tool calls or results the browser sent, so every value the model sees comes from a query this server ran.
2. Gateway's Chat Completions API picks F1 tools (`get_results`, `get_lap_times`, `get_standings`, …). The route runs them between completions (`src/lib/tool-loop.ts`) and streams AG-UI events, so each tool call shows its result live.
3. The answer streams back as OpenUI Lang and renders as it arrives, with the F1 component library (`src/library.ts`). The F1 charts take only a session and drivers and fetch their own rows from `/api/f1/[tool]`, so their numbers never pass through the model; tables carry the values the model copies from tool results.
4. The browser saves the thread in local storage as it streams, so it's there after a reload.

## Data

The tools (`src/lib/f1/tools`) call OpenF1 through one rate-limited client with a disk cache under `data/openf1`. Finished sessions are cached forever, and a stale copy is served if OpenF1 is down. `npm run snapshot:f1` fills that cache ahead of time; `npm run snapshot:f1 -- --year 2025 --light` adds last season's races (results, standings and stints only).

Driver, team colour and circuit data for the visuals is committed under `src/assets/f1`. Refresh it for a new season with `npx tsx scripts/snapshot-f1-assets.ts`.

## Deploying

`next.config.ts` bundles `data/**` into the API routes, so run `npm run snapshot:f1` before building. Hosts with a read-only filesystem keep new OpenF1 responses in memory only.

Nothing is stored on a server: each visitor's threads stay in their own browser's local storage, so a thread link only opens in the browser that created it. The app has no sign-in, and the API routes accept only same-origin requests. Add rate limits before exposing it widely, since every question spends Gateway credit on your key.
