export function CardSkeleton({ index }) {
  return (
    <div className="card card--loading" aria-busy="true">
      <span className="card__tab">No. 0{index}</span>
      <div className="card__skeleton-line card__skeleton-line--title" />
      <div className="card__skeleton-line" />
      <div className="card__skeleton-line" />
      <div className="card__skeleton-line card__skeleton-line--short" />

      <div className="card__typing-indicator">
        <span className="card__typing-text">Generating</span>
        <span className="card__typing-dot" />
        <span className="card__typing-dot" />
        <span className="card__typing-dot" />
      </div>
    </div>
  );
}
