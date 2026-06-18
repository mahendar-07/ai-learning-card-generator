import { useCallback, useEffect, useRef, useState } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:4000";

const STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
};

function emptyCard(index) {
  return { index, status: STATUS.IDLE, data: null, error: null };
}

export function useCardSocket() {
  const [cards, setCards] = useState([emptyCard(1), emptyCard(2), emptyCard(3)]);
  const [isComplete, setIsComplete] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [connectionState, setConnectionState] = useState("connecting"); // connecting | open | closed
  const [retryingIndex, setRetryingIndex] = useState(null);
  const [rateLimitError, setRateLimitError] = useState(null); // null | string message
  const [wasStopped, setWasStopped] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => setConnectionState("open");
    ws.onclose = () => setConnectionState("closed");
    ws.onerror = () => setConnectionState("closed");

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "card_loading":
          setCards((prev) =>
            prev.map((c) =>
              c.index === msg.index ? { ...c, status: STATUS.LOADING, error: null } : c
            )
          );
          break;

        case "card_ready":
          setCards((prev) =>
            prev.map((c) =>
              c.index === msg.index ? { ...c, status: STATUS.READY, data: msg.data } : c
            )
          );
          setRetryingIndex((prev) => (prev === msg.index ? null : prev));
          break;

        case "card_error":
          setCards((prev) =>
            prev.map((c) =>
              c.index === msg.index ? { ...c, status: STATUS.ERROR, error: msg.message } : c
            )
          );
          setIsGenerating(false);
          setRetryingIndex((prev) => (prev === msg.index ? null : prev));
          break;

        case "rate_limit_error":
          // Quota exhausted — show a dedicated message, stop generating
          setRateLimitError(msg.message);
          setIsGenerating(false);
          break;

        case "complete":
          setIsComplete(true);
          setIsGenerating(false);
          break;

        case "stopped":
          // Server confirmed the stop — generation has been cancelled
          setIsGenerating(false);
          setWasStopped(true);
          break;

        case "validation_error":
          console.warn("Server validation error:", msg.message);
          setIsGenerating(false);
          break;

        default:
          console.warn("Unknown message type from server:", msg.type);
      }
    };

    return () => ws.close();
  }, []);

  const generate = useCallback((topic, failureScenario) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    setCards([emptyCard(1), emptyCard(2), emptyCard(3)]);
    setIsComplete(false);
    setIsGenerating(true);
    setRateLimitError(null);
    setWasStopped(false);
    ws.send(JSON.stringify({ type: "generate", topic, failureScenario }));
  }, []);

  const retry = useCallback((cardIndex) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    setRetryingIndex(cardIndex);
    setRateLimitError(null);
    ws.send(JSON.stringify({ type: "retry", cardIndex }));
  }, []);

  /**
   * Sends a stop signal to the server. The server sets its abort flag and
   * replies with a "stopped" message once it has cleanly exited the loop.
   * Cards already delivered remain visible.
   */
  const stop = useCallback(() => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({ type: "stop" }));
  }, []);

  return {
    cards,
    isComplete,
    isGenerating,
    connectionState,
    retryingIndex,
    rateLimitError,
    wasStopped,
    generate,
    retry,
    stop,
  };
}
