import { useState } from "react";

/**
 * Mode switch the assignment asks for: "Success Mode" vs "Failure Mode".
 *
 * Internally we still support three different failure flavors (all cards
 * fail / one random card fails / two random cards fail) so the richer
 * retry/error-recovery behavior built for this project stays testable —
 * they're just tucked under "Failure Mode" as nested cases instead of
 * being exposed as four flat, equally-weighted options.
 */
export function FailureScenarioSelector({ scenario, onChange, disabled }) {
  const cases = [
    { id: "case-1", label: "Case 1", description: "All 3 cards fail" },
    { id: "case-2", label: "Case 2", description: "1 card fails (random)" },
    { id: "case-3", label: "Case 3", description: "2 cards fail (random)" },
  ];

  const isFailureMode = scenario !== "none";

  // Remember the last-used case so switching back to Failure Mode restores
  // it instead of forcing the user to re-pick every time.
  const [lastCase, setLastCase] = useState(isFailureMode ? scenario : "case-1");
  const activeCase = isFailureMode ? scenario : lastCase;

  const selectMode = (mode) => {
    if (mode === "success") {
      onChange("none");
    } else {
      onChange(activeCase);
    }
  };

  const selectCase = (caseId) => {
    setLastCase(caseId);
    onChange(caseId);
  };

  return (
    <div className="failure-scenario">
      <label className="failure-scenario__label">Mode</label>
      <div className="failure-scenario__buttons">
        <button
          type="button"
          className={`failure-scenario__button ${!isFailureMode ? "is-active" : ""}`}
          onClick={() => selectMode("success")}
          disabled={disabled}
          title="All 3 cards stream successfully"
        >
          <span className="failure-scenario__button-label">Success Mode</span>
          <span className="failure-scenario__button-desc">All cards succeed</span>
        </button>
        <button
          type="button"
          className={`failure-scenario__button ${isFailureMode ? "is-active" : ""}`}
          onClick={() => selectMode("failure")}
          disabled={disabled}
          title="A card fails intentionally so error handling + retry can be tested"
        >
          <span className="failure-scenario__button-label">Failure Mode</span>
          <span className="failure-scenario__button-desc">Trigger an error scenario</span>
        </button>
      </div>

      {isFailureMode && (
        <div className="failure-scenario__subgroup">
          {cases.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className={`failure-scenario__button failure-scenario__button--nested ${
                activeCase === c.id ? "is-active" : ""
              }`}
              onClick={() => selectCase(c.id)}
              disabled={disabled}
              title={c.description}
            >
              <span className="failure-scenario__tree-glyph" aria-hidden="true">
                {i === cases.length - 1 ? "└──" : "├──"}
              </span>
              <span className="failure-scenario__button-label">{c.label}</span>
              <span className="failure-scenario__button-desc">{c.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
