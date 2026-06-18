import { isGeminiConfigured, requestCardFromGemini, RateLimitError } from "./gemini.js";
import { logger } from "../utils/logger.js";

const CARD_ANGLES = [
  null, // index 0 unused — cards are 1-indexed
  { label: "Overview",     hint: "a core definition / what it fundamentally is", difficulty: "Beginner"     },
  { label: "How It Works", hint: "the key mechanism or process behind it",        difficulty: "Intermediate" },
  { label: "Why It Matters", hint: "a real-world example or relevance",           difficulty: "Advanced"     },
];

function mockCard(topic, cardNumber) {
  const angle = CARD_ANGLES[cardNumber] ?? CARD_ANGLES[1];
  return {
    title: `${topic}: ${angle.label}`,
    concept: `This is a mock card standing in for a Gemini-generated explanation of ${angle.hint} for "${topic}". Set GEMINI_API_KEY in server/.env to generate real content.`,
    funFact: `Mock fun fact placeholder for "${topic}" (card ${cardNumber}/3) — no API key was detected.`,
    difficulty: angle.difficulty,
    category: "Demo",
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates a single card. Throws:
 *   - RateLimitError  → caller sends a rate_limit_error WS message
 *   - Error           → caller sends a card_error WS message
 *
 * @param {string}  topic
 * @param {number}  cardNumber   1 | 2 | 3
 * @param {boolean} forceFail    When true, throws a simulated error (Failure Mode)
 */
export async function generateCard(topic, cardNumber, forceFail = false) {
  // Simulate generation latency so loading states are visibly meaningful
  await delay(600 + Math.random() * 500);

  if (forceFail) {
    logger.warn(`Simulated failure triggered for card ${cardNumber} (Failure Mode)`);
    throw new Error(
      `Card ${cardNumber} failed to generate (simulated failure — Failure Mode is on)`
    );
  }

  if (!isGeminiConfigured) {
    return mockCard(topic, cardNumber);
  }

  try {
    return await requestCardFromGemini(topic, cardNumber);
  } catch (err) {
    // Re-throw RateLimitError unchanged so the handler can identify it
    if (err instanceof RateLimitError) throw err;

    logger.error(`Gemini generation failed for card ${cardNumber}:`, err.message);
    throw new Error(`Card ${cardNumber} failed to generate: ${err.message}`);
  }
}

// Re-export so the WS handler can instanceof-check without importing gemini.js directly
export { RateLimitError };
