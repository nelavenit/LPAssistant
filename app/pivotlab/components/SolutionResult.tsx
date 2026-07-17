import type { NumberDisplay } from '../math/rational';
import { formatSolutionResult, getSolutionResult } from '../model/result';
import type { Tableau } from '../model/tableau';
import { NumberValue } from './NumberValue';

interface SolutionResultProps {
  tableau: Tableau;
  display: NumberDisplay;
}

export function SolutionResult({ tableau, display }: SolutionResultProps) {
  const result = getSolutionResult(tableau);
  return (
    <section className="solution-result" aria-label={formatSolutionResult(tableau, display)}>
      <span className="solution-result-label">Final result</span>
      <div className="solution-result-equation">
        <strong className="solution-objective-symbol">
          <span>{result.objectiveName}</span>
          <span className="solution-min-index">min</span>
        </strong>
        <span>=</span>
        <strong><NumberValue value={result.objectiveValue} display={display} /></strong>
        <span>at</span>
        <span className="solution-result-point">
          <span>(</span>
          {result.values.map(({ variable, value }, index) => (
            <span key={variable.id} className="solution-result-coordinate">
              {index > 0 && <span>,&nbsp;</span>}
              <NumberValue value={value} display={display} />
            </span>
          ))}
          <span>)</span>
        </span>
      </div>
    </section>
  );
}
