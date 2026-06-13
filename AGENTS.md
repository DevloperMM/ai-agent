# Movie RAG, Poster & Reviews Agent — AGENTS.md

## What This Repo Does

- Runs a CLI chat agent (OpenAI-compatible model, e.g. GPT-4o-mini via Azure)
  that answers movie questions using a vector store built with OpenAI
  embeddings and LangChain, seeded from an IMDb CSV dataset.
- Supports a hybrid movie RAG workflow (CSV ingest -> vector search ->
  filtered/sorted results) via LangChain retrieval primitives.
- Can generate a poster image for a specific movie based on its title,
  genre, and description.
- Can look up real ratings and reviews for a movie from the web (e.g.
  IMDb/Rotten Tomatoes/Metacritic-style scores plus a few written reviews),
  with a graceful fallback when little or nothing is found.
- Includes an eval framework for tool-selection quality.
- Includes a React dashboard to visualize eval score trends from `results.json`.

## Architecture

```
User → index.ts → agent.ts (message loop)
                    ├── llm.ts → chat model (chat + tool definitions)
                    ├── memory.ts → local JSON conversation history (db.json)
                    ├── tools/movieSearch.ts → rag/query.ts → LangChain vector store (OpenAI embeddings)
                    ├── tools/generatePoster.ts → image generation API (poster prompt built from movie title/genre/description)
                    └── tools/movieRatingsReviews.ts → ratings/reviews data source(s)
```

## End-to-End Flow

1. User prompt is passed to `index.ts`.
2. `src/agent.ts` runs the main loop:
   - call model (`src/llm.ts`)
   - if a tool call comes back, dispatch it via `src/toolRunner.ts` and feed
     the result back in
   - save conversation/tool outputs via `src/memory.ts`
3. Evals (`evals/run.ts`) run experiments — one per tool, plus a combined
   routing experiment across all three — and append results to `results.json`.
4. Dashboard (`dashboard/src/App.tsx`) reads `results.json` and plots score
   history over time.

## The Three Tools

| Tool | Role |
|---|---|
| Movie search (RAG) | Existing tool — semantic + metadata search over the IMDb dataset via a LangChain-backed vector store (OpenAI embeddings), with sorting/ranking for things like "highest grossing" or "best rated". Foundation everything else builds on. |
| Poster generation | Given a movie's title/genre/description (usually from a prior movie search result), generates a poster image for that film and saves it locally, the same way images are already generated and stored. |
| Ratings & reviews | Given a movie title, returns real-world ratings (e.g. IMDb/Rotten Tomatoes/Metacritic/TMDB-style scores) and a handful of written review excerpts when available — consistent ratings+reviews shape every time, with an honest "nothing found" fallback instead of guessing. |

For both poster generation and ratings/reviews, the agent should resolve the
exact movie title (via movie search) first if the user referred to it by
name, so the follow-up tool is acting on the right film.

## Directory Map (Keep Handy)

- `src/` - core runtime, model wrapper, UI logs, memory, tool runner.
- `src/tools/` - tool definitions + implementations (movie search, poster
  generation, ratings & reviews).
- `src/rag/` - movie ingest/query logic using LangChain + OpenAI embeddings.
- `evals/` - eval engine and scoring.
- `evals/experiments/` - per-experiment prompt sets (one per tool, plus a
  combined routing experiment).
- `dashboard/` - Vite + React score visualization app.

## File Map (Reference First)

| File | Role |
|---|---|
| `package.json` | Root scripts and dependency surface |
| `index.ts` | Entry point. Reads CLI arg, calls `runAgent` |
| `src/agent.ts` | Main agent loop — calls the model, dispatches tool calls, persists conversation |
| `src/llm.ts` | Model wrapper, tool schema registration, conversation summarization |
| `src/memory.ts` | Local JSON file (`db.json`) for message history. Auto-summarizes after the history grows past a threshold |
| `src/ui.ts` | CLI spinner (ora), colored log output |
| `src/ai.ts` | Model client initialization |
| `src/systemPrompt.ts` | System prompt defining the three tools and tool-usage rules |
| `src/toolRunner.ts` | Switch-case dispatcher mapping tool names to implementations |
| `src/tools/index.ts` | Exports all tool definitions |
| `src/tools/movieSearch.ts` | Zod parameter schema + tool implementation. Calls `queryMovies()` — richest existing tool schema/arg contract, good reference for the others |
| `src/tools/generatePoster.ts` | Builds a poster prompt from movie title/genre/description and calls the image generation API |
| `src/tools/movieRatingsReviews.ts` | Resolves a movie title to ratings + review excerpts from one or more data sources |
| `src/rag/ingest.ts` | CSV → LangChain document loader → OpenAI embeddings → local/persisted vector store. Run via `npm run ingest` |
| `src/rag/query.ts` | Hybrid search: fetch pool via LangChain retriever, filter, score, rank (known quality hotspot — keep iterating here) |
| `src/rag/imdb_movie_dataset.csv` | IMDb movie dataset (~1000 movies, columns: Rank, Title, Genre, Description, Director, Actors, Year, Runtime, Rating, Votes, Revenue (Millions), Metascore) |
| `evals/evalTools.ts` | Eval execution + score persistence |
| `evals/scorers.ts` | Scoring definitions |
| `evals/run.ts` | Run one/all experiment files |
| `dashboard/src/App.tsx` | Results loading + experiment selection |
| `dashboard/src/components/ExperimentGraph.tsx` | Chart rendering |
| `types.ts` | Shared TypeScript types (AIMessage, ToolFn, eval types) — shared between runtime/evals/dashboard |

## Setup Checklist

- Install root deps: `npm install`
- Install dashboard deps: `cd dashboard && npm install`
- Ensure env vars are set:
  - `AI_API_KEY`
  - `AI_BASE_URL` (optional, has default in code)
  - `OPENAI_API_KEY` (for embeddings, if separate from `AI_API_KEY`)
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_API_TOKEN`
  - credentials for whatever ratings/reviews data source(s) get chosen

## Runbook Commands

### Root

- `npm run start -- "your prompt"` - run agent once.
- `npm run ingest` - embed and load the movie dataset into the vector store.
- `npm run eval` - run all eval experiments.
- `npm run eval -- <experiment-name>` - run one experiment by name.

### Dashboard

- `cd dashboard && npm run dev`
- `cd dashboard && npm run build`
- `cd dashboard && npm run lint`
- `cd dashboard && npm run preview`

## Data and Artifacts to Track

- `db.json` - conversation and tool-call history.
- `results.json` - eval outputs consumed by dashboard.
- `images/` - generated poster artifacts.
- Vector store - movie embeddings + metadata (LangChain-managed).