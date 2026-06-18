function isSimulatedFailure(message) {
  return message && message.toLowerCase().includes("simulated");
}

export function ErrorCard({ index, message, onRetry, isRetrying }) {
  const simulated = isSimulatedFailure(message);

  return (
    <div className="card card--error" role="alert">
      <span className="card__tab card__tab--error">No. 0{index}</span>

      <div className="card__error-icon" aria-hidden="true">
        !
      </div>
      <p className="card__error-heading">Card failed to generate</p>
      <p className="card__error-message">{message}</p>

      {simulated && (
        <p className="card__error-hint">
          This is an intentional test failure from the selected scenario, not a real API error.
        </p>
      )}

      <button
        type="button"
        className="card__retry-button"
        onClick={() => onRetry(index)}
        disabled={isRetrying}
      >
        {isRetrying ? (
          <>
            <span className="card__retry-spinner" aria-hidden="true" />
            Retrying…
          </>
        ) : (
          "Retry"
        )}
      </button>
    </div>
  );
}
