# AI Learning Card Generator

A full-stack web app that generates three streaming learning cards on any topic using **Google Gemini** over a live **WebSocket** connection.

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- A free [Google Gemini API key](https://aistudio.google.com/app/apikey)

### 1 — Backend

```bash
cd server
npm install
cp .env.example .env        # then paste your GEMINI_API_KEY in .env
npm run dev                  # starts on http://localhost:4000
```

### 2 — Frontend

```bash
cd client
npm install
npm run dev                  # starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

> **No API key?** Leave `GEMINI_API_KEY` blank — the server automatically falls back to a built-in mock generator so you can still demo the full UI and WebSocket flow without any cost.

---

## Environment Variables

### `server/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes (for real cards) | — | Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-1.5-flash` | Override the Gemini model |
| `PORT` | No | `4000` | HTTP/WS server port |
| `CLIENT_ORIGIN` | No | `http://localhost:5173` | CORS allowed origin |

### `client/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_WS_URL` | No | `ws://localhost:4000` | WebSocket server URL |

---

## WebSocket Flow

```
Browser                            Server
  │                                  │
  │── generate {topic, scenario} ──► │  validates input
  │                                  │  loops cards 1→3
  │◄── card_loading {index: 1} ──── │
  │◄── card_ready   {index: 1} ──── │  (or card_error if it failed)
  │◄── card_loading {index: 2} ──── │
  │◄── card_ready   {index: 2} ──── │
  │◄── card_loading {index: 3} ──── │
  │◄── card_ready   {index: 3} ──── │
  │◄── complete ─────────────────── │
```

### Stop flow
```
  │── stop ────────────────────────► │  sets abort flag
  │◄── stopped ──────────────────── │  generation cancelled; delivered cards stay
```

### Retry flow
```
  │── retry {cardIndex: 3} ────────► │
  │◄── card_loading {index: 3} ──── │
  │◄── card_ready   {index: 3} ──── │
  │◄── complete ─────────────────── │  (if all failed cards now recovered)
```

### Rate limit flow
```
  │── generate … ──────────────────► │
  │◄── rate_limit_error {message} ── │  quota exhausted — no further cards
```

### Message types

| Direction | Type | Payload |
|---|---|---|
| Client→Server | `generate` | `{ topic, failureScenario }` |
| Client→Server | `retry` | `{ cardIndex }` |
| Client→Server | `stop` | — |
| Server→Client | `card_loading` | `{ index }` |
| Server→Client | `card_ready` | `{ index, data }` |
| Server→Client | `card_error` | `{ index, message }` |
| Server→Client | `rate_limit_error` | `{ message }` |
| Server→Client | `stopped` | — |
| Server→Client | `complete` | — |
| Server→Client | `validation_error` | `{ message }` |

---

## Failure & Retry Scenario

Use the **Mode** switch below the input to test error recovery. It matches the two modes the task asks for — **Success Mode** and **Failure Mode** — and picking **Failure Mode** reveals three nested cases so the retry flow can be exercised under different conditions:

| Mode | Case | Behaviour |
|---|---|---|
| **Success Mode** (default) | — | All 3 cards generate normally |
| **Failure Mode** | Case 1 | All 3 cards fail |
| **Failure Mode** | Case 2 | One random card fails |
| **Failure Mode** | Case 3 | Two random cards fail |

Failed cards show an error state with a **Retry** button. Clicking Retry sends `{ type: "retry", cardIndex }` over the same WebSocket connection. The server re-generates only that card (without a simulated failure) and sends it back. When all failed cards recover, a `complete` message is sent and a success banner appears.

---

## Stop / Cancel Feature

While cards are being generated, a **Stop** button replaces the Generate button. Clicking it:

1. Sends `{ type: "stop" }` to the server over the existing WebSocket.
2. The server sets an `aborted` flag checked between each card's async call.
3. The server replies with `{ type: "stopped" }` once it has exited cleanly.
4. Cards already delivered remain visible on screen.
5. A status banner informs the user they can enter a new topic to generate fresh.

---

## Rate Limit Handling

When the Gemini API returns a **429 / RESOURCE_EXHAUSTED** error, the server:

- Stops generation immediately (no further cards are attempted).
- Sends `{ type: "rate_limit_error", message: "…" }` to the client.
- The client displays a dedicated amber banner: *"Daily quota reached — please wait 24 hours."*

This is distinct from a card-level failure: no Retry button is shown because retrying immediately would just hit the same quota wall.

---

## Project Structure

```
ai-learning-cards/
├── client/                    React + Vite frontend
│   └── src/
│       ├── App.jsx            Root component, layout, banners
│       ├── App.css            All styles (CSS variables, dark/light)
│       ├── hooks/
│       │   ├── useCardSocket.js   WS connection, all message handling
│       │   └── useTypewriter.js   Animated text reveal
│       └── components/
│           ├── TopicInput.jsx        Input + Generate/Stop button
│           ├── CardSlot.jsx          Routes idle/loading/ready/error states
│           ├── Card.jsx              Rendered card content
│           ├── CardSkeleton.jsx      Loading placeholder
│           ├── CardIdle.jsx          Empty slot placeholder
│           ├── ErrorCard.jsx         Error state + Retry button
│           ├── FailureScenarioSelector.jsx
│           └── ThemeToggle.jsx
│
└── server/                    Node.js + Express + ws backend
    └── src/
        ├── index.js           HTTP server, WebSocket server setup
        ├── services/
        │   ├── gemini.js      Google Gemini API wrapper + RateLimitError
        │   └── cardGenerator.js  Card generation logic, mock fallback
        ├── ws/
        │   └── handler.js     WebSocket message router (generate/retry/stop)
        └── utils/
            └── logger.js      Simple timestamped logger
```

---

## Assumptions & Extra Features

- **Google Gemini** is used as the AI backend (via `@google/generative-ai`). The model defaults to `gemini-1.5-flash` but is configurable via `GEMINI_MODEL`.
- **Mock fallback**: if no API key is set, mock cards are generated so the WebSocket flow, loading states, failure scenarios, and stop/retry can all be demoed.
- **Stop mid-generation**: any in-progress generation can be cancelled; already-delivered cards remain visible.
- **Rate limit UX**: quota errors get a dedicated 24-hour wait banner rather than a misleading retry button.
- **Dark/light theme** with system-preference detection and localStorage persistence.
- **Typewriter animation** on card text for a polished reveal effect.
- **Per-card read-time estimate** included in card metadata.
- **Difficulty & category tags** generated alongside each card.

---

## What I'd Improve With More Time

- Persistent card history (IndexedDB) so refreshing doesn't lose generated cards.
- Server-sent retry back-off with exponential delay for rate limit recovery.
- Streaming token-by-token via Gemini's streaming API for a true typewriter feel from the server.
- Unit tests for the WebSocket handler and Gemini service.
- Docker Compose setup for one-command startup.
