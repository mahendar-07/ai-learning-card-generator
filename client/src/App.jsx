import { useEffect, useState } from "react";
import { useCardSocket } from "./hooks/useCardSocket.js";
import { TopicInput } from "./components/TopicInput.jsx";
import { FailureScenarioSelector } from "./components/FailureScenarioSelector.jsx";
import { CardSlot } from "./components/CardSlot.jsx";
import { ThemeToggle } from "./components/ThemeToggle.jsx";

const THEME_STORAGE_KEY = "learning-cards-theme";

function getInitialTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default function App() {
  const [topic, setTopic] = useState("");
  const [failureScenario, setFailureScenario] = useState("none");
  const [theme, setTheme] = useState(getInitialTheme);

  const {
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
  } = useCardSocket();

  const isDisconnected = connectionState === "closed";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const handleGenerate = () => generate(topic.trim(), failureScenario);

  return (
    <div className="page">
      <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />

      <header className="header">
        <span className="header__eyebrow">Card Catalog · AI Learning Cards</span>
        <h1 className="header__title">Learning Card Generator</h1>
        <p className="header__subtitle">
          Enter a topic and pull three cards from the catalog — title, key concept, and a fun
          fact, dealt one at a time. Test different failure scenarios to see error recovery in action.
        </p>
      </header>

      {isDisconnected && (
        <div className="connection-banner">
          Connection lost. Refresh the page to start a new session.
        </div>
      )}

      <section className="controls">
        <TopicInput
          topic={topic}
          onTopicChange={setTopic}
          onGenerate={handleGenerate}
          onStop={stop}
          isGenerating={isGenerating}
          disabled={isDisconnected}
        />
        <FailureScenarioSelector
          scenario={failureScenario}
          onChange={setFailureScenario}
          disabled={isGenerating}
        />
      </section>

      {/* Rate limit banner — shown when Gemini quota is exhausted */}
      {rateLimitError && (
        <div className="rate-limit-banner" role="alert">
          <span className="rate-limit-banner__icon" aria-hidden="true">⏳</span>
          <div>
            <strong>Daily quota reached</strong>
            <p>{rateLimitError}</p>
          </div>
        </div>
      )}

      {/* Stopped banner — shown when user manually stopped generation */}
      {wasStopped && !isGenerating && (
        <div className="stopped-banner" role="status">
          <span aria-hidden="true">⏹</span> Generation stopped. Cards received so far are shown
          below. Enter a new topic and click Generate to start fresh.
        </div>
      )}

      <section className="card-row">
        {cards.map((card) => (
          <CardSlot
            key={card.index}
            card={card}
            onRetry={retry}
            isRetrying={retryingIndex === card.index}
          />
        ))}
      </section>

      {isComplete && (
        <p className="completion-banner completion-banner--enter">
          All 3 cards generated successfully.
        </p>
      )}
    </div>
  );
}
