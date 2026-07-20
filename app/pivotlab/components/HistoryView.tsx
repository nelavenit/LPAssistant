import type { NumberDisplay } from '../math/rational';
import type { HistoryEntry } from '../model/tableau';
import { HistoryIcon } from './Icons';
import { SolutionResult } from './SolutionResult';
import { TableauGrid } from './TableauGrid';

interface SolutionHistoryViewProps {
  history: HistoryEntry[];
  currentIndex: number;
  display: NumberDisplay;
  tableFontSize?: number;
  onRestore: (index: number) => void;
  includeResult?: boolean;
}

export function SolutionHistoryView({ history, currentIndex, display, tableFontSize = 18, onRestore, includeResult = false }: SolutionHistoryViewProps) {
  return (
    <section className="history-view">
      <div className="history-intro">
        <div className="history-icon"><HistoryIcon /></div>
        <div>
          <span className="eyebrow">Solution record</span>
          <h2>Tableau history</h2>
          <p>Every applied pivot extends the Simplex Method Tableau. Print or export the complete solution record.</p>
        </div>
      </div>
      <div className="history-list">
        {history.map((entry, index) => (
          <article key={entry.id} className={`history-card${index === currentIndex ? ' current' : ''}`}>
            <header>
              <div className="step-number">{index}</div>
              <div>
                <h3>{entry.label}</h3>
                {entry.pivot && (
                  <p><strong>{entry.pivot.enteringName}</strong> entered, <strong>{entry.pivot.leavingName}</strong> left · pivot {entry.pivot.pivotValue}</p>
                )}
              </div>
              {index === currentIndex
                ? <span className="status-badge green">Current</span>
                : <button className="text-button restore-step" type="button" onClick={() => onRestore(index)}>Open step</button>}
            </header>
            <TableauGrid
              tableau={entry.tableau}
              display={display}
              tableFontSize={tableFontSize}
              compact
              showHeader={index === 0 || !entry.pivot}
              pivotMark={history[index + 1]?.pivot}
            />
          </article>
        ))}
      </div>
      {includeResult && <SolutionResult tableau={history[currentIndex].tableau} display={display} />}
    </section>
  );
}
