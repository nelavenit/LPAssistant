import { useLanguage } from '../app/languageContext';
import type { NumberDisplay } from '../math/rational';
import { analysisMessages, getSolutionResult } from '../model/result';
import { analyzeTableau, type Tableau, type TableauAnalysis } from '../model/tableau';
import { NumberValue } from './NumberValue';
import { VariableName } from './VariableName';

interface SolutionResultProps {
  tableau: Tableau;
  display: NumberDisplay;
  analysis?: TableauAnalysis;
}

export function SolutionResult({ tableau, display, analysis = analyzeTableau(tableau) }: SolutionResultProps) {
  const { t } = useLanguage();
  const result = analysis === 'optimal' || analysis === 'feasible' ? getSolutionResult(tableau) : null;
  return (
    <section className="solution-result">
      <h3 className="solution-result-label">{t(analysis === 'optimal' ? 'Optimal result' : 'Current result')}</h3>
      <p>{t(analysisMessages[analysis])}</p>
      {result && <div className="solution-result-equation">
        <strong className="solution-objective-symbol">
          <span>{result.objectiveName}</span>
          {analysis === 'optimal' && <sub className="solution-min-index">min</sub>}
        </strong>
        <span>=</span>
        <strong><NumberValue value={result.objectiveValue} display={display} /></strong>
        {result.values.length > 0 && <ul className="solution-result-point">
          {result.values.map(({ variable, value }) => (
            <li key={variable.id} className="solution-result-coordinate">
              <VariableName name={variable.name} /> = <NumberValue value={value} display={display} />
            </li>
          ))}
        </ul>}
      </div>}
    </section>
  );
}
