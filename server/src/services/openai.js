import OpenAI from "openai";
import { logger } from "../utils/logger.js";

// Supports OpenAI directly, OR any OpenAI-compatible provider (e.g. Groq)
// via the same SDK + a different baseURL. If GROQ_API_KEY is set, it's used
// automatically with Groq's endpoint and a Groq-hosted model — no extra
// config needed. OPENAI_BASE_URL / OPENAI_MODEL can override either.
const openaiKey = process.env.OPENAI_API_KEY;
const groqKey = process.env.GROQ_API_KEY;
const apiKey = openaiKey || groqKey;

const provider = openaiKey ? "openai" : groqKey ? "groq" : null;

const baseURL =
  process.env.OPENAI_BASE_URL || (provider === "groq" ? "https://api.groq.com/openai/v1" : undefined);

const model =
  process.env.OPENAI_MODEL || (provider === "groq" ? "openai/gpt-oss-20b" : "gpt-4o-mini");

export const isOpenAIConfigured = Boolean(apiKey);

const client = isOpenAIConfigured ? new OpenAI({ apiKey, baseURL }) : null;

if (isOpenAIConfigured) {
  logger.info(`AI provider configured: ${provider} (model: ${model})`);
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
 * Calls the configured provider (OpenAI or an OpenAI-compatible provider
 * like Groq) to generate a single learning card. Throws on any failure
 * (auth, network, malformed response) so the caller can convert that into
 * a card_error WebSocket message rather than crashing the process.
 */
export async function requestCardFromOpenAI(topic, cardNumber) {
  if (!client) {
    throw new Error("AI provider not configured");
  }

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.7,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Topic: ${topic}\nCard number: ${cardNumber}` },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error(`Empty response from ${provider}`);
  }

  // Some models wrap JSON in markdown fences despite instructions — strip
  // those defensively before parsing rather than failing the whole card.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    logger.error(`Failed to parse ${provider} response as JSON:`, raw);
    throw new Error(`${provider} returned malformed JSON`);
  }

  if (!parsed.title || !parsed.concept || !parsed.funFact) {
    throw new Error(`${provider} response missing required fields`);
  }

  // difficulty/category are nice-to-have metadata; fall back rather than
  // failing the whole card if a model occasionally omits them.
  if (!["Beginner", "Intermediate", "Advanced"].includes(parsed.difficulty)) {
    parsed.difficulty = "Intermediate";
  }
  if (!parsed.category || typeof parsed.category !== "string") {
    parsed.category = "General";
  }

  return parsed;
}
