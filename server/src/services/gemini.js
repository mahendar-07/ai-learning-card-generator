import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../utils/logger.js";

const apiKey = process.env.GEMINI_API_KEY;
export const isGeminiConfigured = Boolean(apiKey);

const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let genAI = null;
let geminiModel = null;

if (isGeminiConfigured) {
  genAI = new GoogleGenerativeAI(apiKey);
  geminiModel = genAI.getGenerativeModel({ model: modelName });
  logger.info(`Gemini configured with model: ${modelName}`);
}

const SYSTEM_PROMPT = `You are a concise educational content generator.
Given a topic and a card number (1, 2, or 3), produce exactly ONE learning card
about a distinct angle of the topic so that across 3 calls the cards don't repeat
each other (e.g. card 1 = core definition/overview, card 2 = how it works /
key mechanism, card 3 = real-world relevance or example).

Respond with ONLY a JSON object, no markdown fences, no commentary, in this
exact shape:
{
  "title": "Short card title (max 6 words)",
  "concept": "2-3 sentence explanation, plain language",
  "funFact": "One short, genuinely interesting fun fact related to the topic",
  "difficulty": "Beginner" | "Intermediate" | "Advanced",
  "category": "One short subject tag, e.g. Biology, Physics, Computer Science"
}`;

/**
 * Custom error class for API rate limit / quota exhausted errors.
 * Thrown when Gemini returns a 429 or RESOURCE_EXHAUSTED status.
 */
export class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Inspects an error thrown by the Gemini SDK and returns true if it
 * represents a quota-exhausted / rate-limit condition (HTTP 429 or
 * Google's RESOURCE_EXHAUSTED gRPC status).
 */
function isRateLimitError(err) {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  const status = err.status || err.statusCode || err.code || 0;
  return (
    status === 429 ||
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("resource_exhausted") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  );
}

/**
 * Calls Google Gemini to generate a single learning card.
 * Throws RateLimitError on quota exhaustion, or a generic Error on other
 * failures, so the caller can surface the right message to the client.
 */
export async function requestCardFromGemini(topic, cardNumber) {
  if (!geminiModel) {
    throw new Error("Gemini is not configured — set GEMINI_API_KEY in server/.env");
  }

  const prompt = `${SYSTEM_PROMPT}\n\nTopic: ${topic}\nCard number: ${cardNumber}`;

  let result;
  try {
    result = await geminiModel.generateContent(prompt);
  } catch (err) {
    logger.error(`Gemini API call failed for card ${cardNumber}:`, err.message);
    if (isRateLimitError(err)) {
      throw new RateLimitError(
        "You have exceeded your Gemini API quota for today. Please wait 24 hours and try again."
      );
    }
    throw new Error(`Gemini API error: ${err.message}`);
  }

  let raw;
  try {
    raw = result.response.text().trim();
  } catch (err) {
    // Gemini sometimes throws here when the response was blocked
    const blockReason = result.response?.promptFeedback?.blockReason;
    throw new Error(
      blockReason
        ? `Gemini blocked the request: ${blockReason}`
        : "Gemini returned an unreadable response"
    );
  }

  if (!raw) {
    throw new Error("Empty response from Gemini");
  }

  // Strip markdown fences defensively — Gemini occasionally wraps JSON
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    logger.error("Failed to parse Gemini response as JSON:", raw);
    throw new Error("Gemini returned malformed JSON");
  }

  if (!parsed.title || !parsed.concept || !parsed.funFact) {
    throw new Error("Gemini response is missing required fields (title / concept / funFact)");
  }

  if (!["Beginner", "Intermediate", "Advanced"].includes(parsed.difficulty)) {
    parsed.difficulty = "Intermediate";
  }
  if (!parsed.category || typeof parsed.category !== "string") {
    parsed.category = "General";
  }

  return parsed;
}
