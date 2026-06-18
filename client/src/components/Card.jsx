import { useTypewriter } from "../hooks/useTypewriter.js";

const DIFFICULTY_CLASS = {
  Beginner: "card__badge--beginner",
  Intermediate: "card__badge--intermediate",
  Advanced: "card__badge--advanced",
};

function formatGeneratedAt(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function Card({ index, data }) {
  const { displayed: concept, isTyping } = useTypewriter(data.concept, 10);
  const badgeClass = DIFFICULTY_CLASS[data.difficulty] || DIFFICULTY_CLASS.Intermediate;

  return (
    <div className="card card--ready">
      <span className="card__tab">No. 0{index}</span>

      <div className="card__meta-row">
        {data.difficulty && (
          <span className={`card__badge ${badgeClass}`}>{data.difficulty}</span>
        )}
        {data.category && <span className="card__category">{data.category}</span>}
      </div>

      <h3 className="card__title">{data.title}</h3>
      <p className="card__concept">
        {concept}
        {isTyping && <span className="card__cursor" aria-hidden="true" />}
      </p>

      {!isTyping && (
        <div className="card__fun-fact card__fun-fact--enter">
          <span className="card__fun-fact-label">Fun fact</span>
          <p>{data.funFact}</p>
        </div>
      )}

      <div className="card__footer">
        {typeof data.readTimeSeconds === "number" && (
          <span>{data.readTimeSeconds}s read</span>
        )}
        {data.retryCount > 0 && (
          <span className="card__footer-retry">
            regenerated{data.retryCount > 1 ? ` ×${data.retryCount}` : ""}
          </span>
        )}
        {data.generatedAt && <span>{formatGeneratedAt(data.generatedAt)}</span>}
      </div>
    </div>
  );
}
