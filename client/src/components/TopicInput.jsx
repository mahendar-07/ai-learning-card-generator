export function TopicInput({ topic, onTopicChange, onGenerate, onStop, isGenerating, disabled }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!disabled && !isGenerating && topic.trim()) onGenerate();
  };

  return (
    <form className="topic-input" onSubmit={handleSubmit}>
      <label className="topic-input__label" htmlFor="topic">
        Subject card
      </label>
      <div className="topic-input__row">
        <input
          id="topic"
          type="text"
          placeholder="e.g. Photosynthesis, Newton's Laws, Artificial Intelligence"
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          disabled={disabled || isGenerating}
          maxLength={100}
          autoComplete="off"
        />

        {isGenerating ? (
          /* Stop button — visible only while generation is in progress */
          <button
            type="button"
            className="btn-stop"
            onClick={onStop}
            title="Stop generating and keep cards received so far"
          >
            <span className="btn-stop__icon" aria-hidden="true">⏹</span>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={disabled || !topic.trim()}>
            Generate
          </button>
        )}
      </div>
    </form>
  );
}
