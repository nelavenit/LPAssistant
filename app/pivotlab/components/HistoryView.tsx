import type { NumberDisplay } from '../math/rational';
import type { ProblemHistoryRecord } from '../model/problemHistory';
import type { HistoryEntry } from '../model/tableau';
import { FolderIcon, HistoryIcon, TrashIcon } from './Icons';
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

interface ProblemHistoryViewProps {
  problems: ProblemHistoryRecord[];
  onOpen: (record: ProblemHistoryRecord) => void;
  onDelete: (id: string) => void;
}

export function ProblemHistoryView({ problems, onOpen, onDelete }: ProblemHistoryViewProps) {
  return (
    <section className="problem-history-view">
      <div className="history-intro">
        <div className="history-icon"><HistoryIcon /></div>
        <div>
          <span className="eyebrow">Saved locally</span>
          <h2>Previous problems</h2>
          <p>Starting or opening another problem archives the current one here so you can resume it later.</p>
        </div>
      </div>
      {problems.length === 0 ? (
        <div className="problem-history-empty">
          <HistoryIcon />
          <h3>No previous problems yet</h3>
          <p>Your current problem will appear here when you create or open another one.</p>
        </div>
      ) : (
        <div className="problem-history-list">
          {problems.map((problem) => (
            <article className="problem-history-card" key={problem.id}>
              <div className="problem-history-symbol"><FolderIcon /></div>
              <div className="problem-history-details">
                <h3>{problem.title}</h3>
                <p>{problem.constraintCount} {problem.constraintCount === 1 ? 'constraint' : 'constraints'} · {problem.variableCount} {problem.variableCount === 1 ? 'variable' : 'variables'} · {problem.stepCount} {problem.stepCount === 1 ? 'tableau' : 'tableaux'}</p>
                <time dateTime={problem.savedAt}>{formatSavedAt(problem.savedAt)}</time>
              </div>
              <button className="secondary-button" type="button" onClick={() => onOpen(problem)}>Resume</button>
              <button className="icon-button danger-quiet" type="button" aria-label={`Delete ${problem.title} from history`} title="Delete from history" onClick={() => onDelete(problem.id)}><TrashIcon /></button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatSavedAt(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
