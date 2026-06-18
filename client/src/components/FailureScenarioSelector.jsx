export function FailureScenarioSelector({ scenario, onChange, disabled }) {
  const scenarios = [
    { id: "none", label: "None (Success)", description: "All cards succeed" },
    {
      id: "case-1",
      label: "Case 1",
      description: "All 3 cards fail",
    },
    {
      id: "case-2",
      label: "Case 2",
      description: "1 card fails (random)",
    },
    {
      id: "case-3",
      label: "Case 3",
      description: "2 cards fail (random)",
    },
  ];

  return (
    <div className="failure-scenario">
      <label className="failure-scenario__label">Failure Scenario</label>
      <div className="failure-scenario__buttons">
        {scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`failure-scenario__button ${scenario === s.id ? "is-active" : ""}`}
            onClick={() => onChange(s.id)}
            disabled={disabled}
            title={s.description}
          >
            <span className="failure-scenario__button-label">{s.label}</span>
            <span className="failure-scenario__button-desc">{s.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
