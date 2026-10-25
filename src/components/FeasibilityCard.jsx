import OutputCard from './OutputCard.jsx';

export default function FeasibilityCard({ feasibility, onToast }) {
  if (!feasibility) return null;
  return (
    <OutputCard index={3} title="Feasibility Assessment" agent="feasibility" copyable={feasibility.text} onToast={onToast}>
      <div className="feas-meter">
        <div className="feas-score">
          <span className="feas-score-num">{feasibility.score}</span>
          <span className="feas-score-max">/100</span>
        </div>
        <div className="feas-track" aria-hidden="true">
          <div className="feas-fill" style={{ width: `${Math.max(0, Math.min(100, feasibility.score))}%` }} />
        </div>
        <div className={`feas-verdict feas-verdict--${feasibility.verdictClass || 'good'}`}>
          {feasibility.verdict}
        </div>
      </div>
      <pre>{feasibility.text}</pre>
    </OutputCard>
  );
}
