import { useEffect, useState } from "react";

/**
 * Reveals `text` character by character to simulate the AI "typing" the
 * card content live, rather than it just appearing all at once. Purely a
 * presentation effect — the data has already fully arrived over the socket.
 */
export function useTypewriter(text, speedMs = 12) {
  const [displayed, setDisplayed] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (!text) {
      setDisplayed("");
      setIsTyping(false);
      return;
    }

    setDisplayed("");
    setIsTyping(true);
    let i = 0;

    const interval = setInterval(() => {
      i += 1;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, speedMs);

    return () => clearInterval(interval);
  }, [text, speedMs]);

  return { displayed, isTyping };
}
