import { useLanguage } from '../app/languageContext';
import { tableauTitle } from '../app/i18n';
import type { NumberDisplay } from '../math/rational';
import type { ProblemHistoryRecord } from '../model/problemHistory';
import { groupTableauStages } from '../model/stages';
import { describeHistoryEntry, type HistoryEntry } from '../model/tableau';
import type { Tableau } from '../model/tableau';
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
  resultTableau?: Tableau;
}

export function SolutionHistoryView({ history, currentIndex, display, tableFontSize = 18, onRestore, includeResult = false, resultTableau }: SolutionHistoryViewProps) {
  const { t } = useLanguage();
  const stages = groupTableauStages(history, currentIndex);
  return (
    <section className="history-view">
      <div className="history-intro">
        <div className="history-icon"><HistoryIcon /></div>
        <div>
          <span className="eyebrow">{t('Solution record')}</span>
          <h2>{t('Tableau history')}</h2>
          <p>{t('Every applied pivot extends the Simplex Method Tableau. Print or export the complete solution record.')}</p>
        </div>
      </div>
      <div className="history-list">
        {stages.map((stage) => (
          <section className="solution-stage" key={stage.id}>
            {stage.label && <h3 className="solution-stage-label">{t(stage.label)}</h3>}
            <div className="solution-stage-tableaux">
              {stage.entries.map(({ entry, index }, stageIndex) => (
                <article key={entry.id} className={`history-card${index === currentIndex ? ' current' : ''}`}>
                  <header>
                    <div className="step-number">{index}</div>
                    <div>
                      <h3>{describeHistoryEntry(t, entry, index)}</h3>
                      {entry.pivot && (
                        <p>{t('{entering} entered, {leaving} left · pivot {value}', {
                          entering: entry.pivot.enteringName, leaving: entry.pivot.leavingName, value: entry.pivot.pivotValue,
                        })}</p>
                      )}
                    </div>
                    {index === currentIndex
                      ? <span className="status-badge green">{t('Current')}</span>
                      : <button className="text-button restore-step" type="button" onClick={() => onRestore(index)}>{t('Open step')}</button>}
                  </header>
                  <TableauGrid
                    tableau={entry.tableau}
                    display={display}
                    tableFontSize={tableFontSize}
                    compact
                    showHeader={stageIndex === 0}
                    pivotMark={index < currentIndex ? history[index + 1]?.pivot : undefined}
                  />
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      {includeResult && <SolutionResult tableau={resultTableau ?? history[currentIndex].tableau} display={display} />}
    </section>
  );
}

interface ProblemHistoryViewProps {
  problems: ProblemHistoryRecord[];
  onOpen: (record: ProblemHistoryRecord) => void;
  onDelete: (id: string) => void;
}

export function ProblemHistoryView({ problems, onOpen, onDelete }: ProblemHistoryViewProps) {
  const { language, t } = useLanguage();
  const dateFormat = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <section className="problem-history-view">
      <div className="history-intro">
        <div className="history-icon"><HistoryIcon /></div>
        <div>
          <span className="eyebrow">{t('Saved locally')}</span>
          <h2>{t('Previous problems')}</h2>
          <p>{t('Starting or opening another problem archives the current one here so you can resume it later.')}</p>
        </div>
      </div>
      {problems.length === 0 ? (
        <div className="problem-history-empty">
          <HistoryIcon />
          <h3>{t('No previous problems yet')}</h3>
          <p>{t('Your current problem will appear here when you create or open another one.')}</p>
        </div>
      ) : (
        <div className="problem-history-list">
          {problems.map((problem) => (
            <article className="problem-history-card" key={problem.id}>
              <div className="problem-history-symbol"><FolderIcon /></div>
              <div className="problem-history-details">
                <h3>{tableauTitle(t, problem.title)}</h3>
                <p>{t('{dimensions} · Tableaux: {steps}', {
                  dimensions: t('Constraints: {rows} · Variables: {variables}', { rows: problem.constraintCount, variables: problem.variableCount }),
                  steps: problem.stepCount,
                })}</p>
                <time dateTime={problem.savedAt}>{dateFormat.format(new Date(problem.savedAt))}</time>
              </div>
              <button className="secondary-button" type="button" onClick={() => onOpen(problem)}>{t('Resume')}</button>
              <button className="icon-button danger-quiet" type="button" aria-label={t('Delete {title} from history', { title: tableauTitle(t, problem.title) })} title={t('Delete from history')} onClick={() => onDelete(problem.id)}><TrashIcon /></button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
