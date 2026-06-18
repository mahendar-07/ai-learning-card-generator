import { generateCard, RateLimitError } from "../services/cardGenerator.js";
import { logger } from "../utils/logger.js";

const TOTAL_CARDS = 3;
const MAX_TOPIC_LENGTH = 100;
const WORDS_PER_MINUTE = 200;

function enrichCardMetadata(data, retryCount) {
  const wordCount = `${data.concept} ${data.funFact}`.trim().split(/\s+/).length;
  const readTimeSeconds = Math.max(5, Math.round((wordCount / WORDS_PER_MINUTE) * 60));
  return { ...data, readTimeSeconds, generatedAt: new Date().toISOString(), retryCount };
}

/**
 * Per-connection session state. Each browser tab / reconnect gets its own
 * isolated session so nothing bleeds between sessions.
 */
function createSession() {
  return {
    topic: null,
    failureScenario: "none",
    failedCardIndices: new Set(),
    retryCounts: {},    // { [cardIndex]: number }
    generating: false,
    aborted: false,     // Set to true by the "stop" message to cancel in-flight generation
  };
}

function send(ws, message) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

async function handleGenerate(ws, session, payload) {
  const topic = (payload.topic || "").trim();
  const failureScenario = payload.failureScenario || "none";

  if (!topic) {
    send(ws, { type: "validation_error", message: "Topic cannot be empty" });
    return;
  }
  if (topic.length > MAX_TOPIC_LENGTH) {
    send(ws, { type: "validation_error", message: `Topic must be under ${MAX_TOPIC_LENGTH} characters` });
    return;
  }
  if (session.generating) {
    logger.warn("Ignoring generate request: already generating on this connection");
    return;
  }

  // Reset all session state for this new generation run
  session.topic = topic;
  session.failureScenario = failureScenario;
  session.failedCardIndices = new Set();
  session.retryCounts = {};
  session.generating = true;
  session.aborted = false;

  logger.info(`Generating cards for topic="${topic}" scenario=${failureScenario}`);

  // Determine which cards should fail based on the selected failure scenario
  const cardsToFail = new Set();
  if (failureScenario === "case-1") {
    cardsToFail.add(1); cardsToFail.add(2); cardsToFail.add(3);
  } else if (failureScenario === "case-2") {
    cardsToFail.add(Math.floor(Math.random() * TOTAL_CARDS) + 1);
  } else if (failureScenario === "case-3") {
    const picks = [];
    while (picks.length < 2) {
      const idx = Math.floor(Math.random() * TOTAL_CARDS) + 1;
      if (!picks.includes(idx)) picks.push(idx);
    }
    picks.forEach((idx) => cardsToFail.add(idx));
  }

  for (let cardNumber = 1; cardNumber <= TOTAL_CARDS; cardNumber++) {
    // Check abort flag before starting each card
    if (session.aborted) {
      logger.info(`Generation aborted by client before card ${cardNumber}`);
      break;
    }

    send(ws, { type: "card_loading", index: cardNumber });

    try {
      const data = await generateCard(topic, cardNumber, cardsToFail.has(cardNumber));

      // Check again after the async call — user may have stopped mid-card
      if (session.aborted) {
        logger.info(`Generation aborted by client after card ${cardNumber} completed`);
        break;
      }

      send(ws, { type: "card_ready", index: cardNumber, data: enrichCardMetadata(data, 0) });
    } catch (err) {
      if (session.aborted) break;

      // Rate limit errors get their own message type so the client can show
      // a dedicated "wait 24 hours" UI instead of a generic retry button.
      if (err instanceof RateLimitError) {
        logger.warn("Gemini rate limit hit:", err.message);
        send(ws, { type: "rate_limit_error", message: err.message });
        session.generating = false;
        return;
      }

      session.failedCardIndices.add(cardNumber);
      send(ws, { type: "card_error", index: cardNumber, message: err.message });

      if (failureScenario === "none") {
        session.generating = false;
        return; // Stop at first unexpected error in success mode
      }
    }
  }

  session.generating = false;

  if (!session.aborted) {
    send(ws, { type: "complete" });
  }
}

async function handleRetry(ws, session, payload) {
  const cardIndex = Number(payload.cardIndex);

  if (session.generating) {
    logger.warn("Ignoring retry: a generation is already in progress");
    return;
  }
  if (!session.topic || !session.failedCardIndices?.has(cardIndex)) {
    send(ws, { type: "validation_error", message: "Nothing to retry for that card" });
    return;
  }

  session.generating = true;
  session.aborted = false;
  session.retryCounts[cardIndex] = (session.retryCounts[cardIndex] || 0) + 1;

  logger.info(`Retrying card ${cardIndex} for topic="${session.topic}" (attempt ${session.retryCounts[cardIndex]})`);
  send(ws, { type: "card_loading", index: cardIndex });

  try {
    // Retry always forces a real (non-simulated) generation
    const data = await generateCard(session.topic, cardIndex, false);
    send(ws, {
      type: "card_ready",
      index: cardIndex,
      data: enrichCardMetadata(data, session.retryCounts[cardIndex]),
    });
    session.failedCardIndices.delete(cardIndex);

    if (session.failedCardIndices.size === 0) {
      send(ws, { type: "complete" });
    }
  } catch (err) {
    if (err instanceof RateLimitError) {
      logger.warn("Gemini rate limit hit during retry:", err.message);
      send(ws, { type: "rate_limit_error", message: err.message });
    } else {
      send(ws, { type: "card_error", index: cardIndex, message: err.message });
    }
  } finally {
    session.generating = false;
  }
}

/**
 * Cancels any in-progress generation for this connection.
 * Sets the abort flag so the running handleGenerate loop stops after the
 * current async call completes (JavaScript is single-threaded; we can't
 * interrupt mid-await, but we can prevent the next iteration).
 */
function handleStop(ws, session) {
  if (!session.generating) {
    logger.info("Stop received but nothing is generating — no-op");
    send(ws, { type: "stopped" });
    return;
  }

  logger.info(`Stop requested for topic="${session.topic}" — aborting generation`);
  session.aborted = true;
  session.generating = false;
  send(ws, { type: "stopped" });
}

export function registerConnectionHandlers(ws) {
  const session = createSession();
  logger.info("Client connected");

  ws.on("message", (raw) => {
    let payload;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: "validation_error", message: "Malformed message (not valid JSON)" });
      return;
    }

    switch (payload.type) {
      case "generate":
        handleGenerate(ws, session, payload).catch((err) => {
          logger.error("Unexpected error in handleGenerate:", err);
          send(ws, { type: "validation_error", message: "Unexpected server error" });
          session.generating = false;
        });
        break;

      case "retry":
        handleRetry(ws, session, payload).catch((err) => {
          logger.error("Unexpected error in handleRetry:", err);
          send(ws, { type: "validation_error", message: "Unexpected server error" });
          session.generating = false;
        });
        break;

      case "stop":
        handleStop(ws, session);
        break;

      default:
        send(ws, { type: "validation_error", message: `Unknown message type: ${payload.type}` });
    }
  });

  ws.on("close", () => logger.info("Client disconnected"));
  ws.on("error", (err) => logger.error("WebSocket error:", err.message));
}
