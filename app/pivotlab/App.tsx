'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSettings, shortcutFromEvent, type AppSettings, type ShortcutAction } from './app/settings';
import type { NumberDisplay } from './math/rational';
import {
  addConstraint,
  addVariable,
  createBlankTableau,
  createTextbookExample,
  detectBasis,
  finishPhaseOne,
  makeId,
  pivotTableau,
  removeConstraint,
  removeVariable,
  startPhaseOne,
  type Algorithm,
  type AppMode,
  type HistoryEntry,
  type PivotSelection,
  type Tableau,
} from './model/tableau';
import { deserializeProject, serializeProject } from './model/project';
import { groupTableauStages } from './model/stages';
import { safeFileName } from './export/naming';
import {
  createProblemHistoryRecord,
  loadProblemHistory,
  MAX_SAVED_PROBLEMS,
  openProblemHistoryRecord,
  saveProblemHistory,
  type ProblemHistoryRecord,
} from './model/problemHistory';
import { ProblemHistoryView, SolutionHistoryView } from './components/HistoryView';
import {
  ExportIcon,
  FolderIcon,
  GridIcon,
  HistoryIcon,
  InfoIcon,
  PlusIcon,
  RedoIcon,
  SaveIcon,
  SettingsIcon,
  UndoIcon,
} from './components/Icons';
import { EditInspector, PivotInspector } from './components/Inspector';
import { downloadText, ExportModal, NewProjectModal, PhaseOneModal, SettingsModal } from './components/Modals';
import { TableauGrid } from './components/TableauGrid';

type View = 'workspace' | 'history';
type ModalName = 'new' | 'phase1' | 'settings' | 'export' | null;
const DEFAULT_EXAMPLE_VERSION = '7.4.1';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function initialSession(): { history: HistoryEntry[]; currentIndex: number } {
  try {
    const stored = localStorage.getItem('pivotlab-autosave');
    if (stored) {
      const loaded = deserializeProject(stored);
      const defaultVersion = localStorage.getItem('pivotlab-default-example-version');
      localStorage.setItem('pivotlab-default-example-version', DEFAULT_EXAMPLE_VERSION);
      if (defaultVersion === DEFAULT_EXAMPLE_VERSION || !isLegacyTextbookSession(loaded)) return loaded;
    }
  } catch {
    // A clean example is safer than blocking startup on a damaged autosave.
  }
  const tableau = createTextbookExample();
  return {
    history: [{ id: makeId('history'), label: 'Initial tableau', tableau }],
    currentIndex: 0,
  };
}

function isLegacyTextbookSession(session: { history: HistoryEntry[] }): boolean {
  const tableau = session.history[0]?.tableau;
  if (!tableau || tableau.title !== 'Example 3.6.1' || tableau.rows.length !== 2 || tableau.variables.length !== 5) return false;
  return tableau.rows[0]?.values.map((value) => value.toFraction()).join(',') === '3,7,3,1,0,10'
    && tableau.rows[1]?.values.map((value) => value.toFraction()).join(',') === '2,2,6,0,1,4'
    && tableau.objective.map((value) => value.toFraction()).join(',') === '-60,-84,-72,0,0,0';
}

function initialDisplay(): NumberDisplay {
  try {
    const stored = JSON.parse(localStorage.getItem('pivotlab-display') ?? '{}') as Partial<NumberDisplay>;
    if (stored.mode === 'decimal') return { mode: 'decimal', precision: Math.max(0, Math.min(8, Number(stored.precision ?? 3))) };
  } catch {
    // Use exact fractions.
  }
  return { mode: 'fraction' };
}

export default function App() {
  const session = useMemo(() => initialSession(), []);
  const [history, setHistory] = useState<HistoryEntry[]>(session.history);
  const [currentIndex, setCurrentIndex] = useState(session.currentIndex);
  const [editHistory, setEditHistory] = useState<Tableau[]>([session.history[0].tableau]);
  const [editIndex, setEditIndex] = useState(0);
  const [problemHistory, setProblemHistory] = useState<ProblemHistoryRecord[]>(loadProblemHistory);
  const [mode, setMode] = useState<AppMode>('pivot');
  const [algorithm, setAlgorithm] = useState<Algorithm>('primal');
  const [view, setView] = useState<View>('workspace');
  const [display, setDisplay] = useState<NumberDisplay>(initialDisplay);
  const [selection, setSelection] = useState<PivotSelection | null>(null);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [modal, setModal] = useState<ModalName>(null);
  const [includePrintResult, setIncludePrintResult] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [includeExportResult, setIncludeExportResult] = useState(true);
  const [includeExportSolution, setIncludeExportSolution] = useState(true);
  const [printCompleteSolution, setPrintCompleteSolution] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<number | null>(null);
  const current = history[currentIndex].tableau;
  const canEdit = currentIndex === 0;

  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4200);
  };

  useEffect(() => {
    try { localStorage.setItem('pivotlab-autosave', serializeProject(history, currentIndex)); } catch { /* Quota errors are nonfatal. */ }
  }, [history, currentIndex]);

  useEffect(() => {
    try { saveProblemHistory(problemHistory); } catch { /* Quota errors are nonfatal. */ }
  }, [problemHistory]);

  useEffect(() => {
    localStorage.setItem('pivotlab-display', JSON.stringify(display));
  }, [display]);

  useEffect(() => {
    localStorage.setItem('pivotlab-settings', JSON.stringify(settings));
    const root = document.documentElement;
    const interfaceScale = settings.uiScale / 100;
    root.dataset.theme = settings.theme;
    root.style.setProperty('--table-font-size', `${settings.tableFontSize}px`);
    root.style.setProperty('--ui-scale', String(interfaceScale));
    root.style.setProperty('--ui-viewport-height', `${100 / interfaceScale}vh`);
  }, [settings]);

  useEffect(() => {
    const listener = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', listener);
    return () => window.removeEventListener('beforeinstallprompt', listener);
  }, []);

  const replaceCurrent = (tableau: Tableau) => {
    // Edits and pivots intentionally use separate timelines. Editing step zero
    // invalidates later pivots, while its own redo snapshots remain available.
    setEditHistory((previous) => [...previous.slice(0, editIndex + 1), tableau]);
    setEditIndex((index) => index + 1);
    setHistory((previous) => {
      const next = previous.slice(0, currentIndex + 1);
      next[currentIndex] = { ...next[currentIndex], tableau };
      return next;
    });
    setSelection(null);
  };

  const commit = (tableau: Tableau, label: string, pivot?: HistoryEntry['pivot']) => {
    const next = [
      ...history.slice(0, currentIndex + 1),
      { id: makeId('history'), label, tableau, pivot },
    ];
    setHistory(next);
    setCurrentIndex(next.length - 1);
    setSelection(null);
  };

  const archiveCurrentProblem = (excludingId?: string) => {
    const archived = createProblemHistoryRecord(history, currentIndex);
    setProblemHistory((previous) => [
      archived,
      ...previous.filter((record) => record.id !== excludingId),
    ].slice(0, MAX_SAVED_PROBLEMS));
  };

  const reset = (tableau: Tableau) => {
    archiveCurrentProblem();
    setHistory([{ id: makeId('history'), label: 'Initial tableau', tableau }]);
    setCurrentIndex(0);
    setEditHistory([tableau]);
    setEditIndex(0);
    setSelection(null);
    setView('workspace');
    setMode('edit');
  };

  const renameProblem = (title: string) => {
    // The title is project metadata, not tableau algebra. Renaming therefore
    // propagates through every pivot and edit snapshot without discarding work.
    setHistory((previous) => previous.map((entry) => ({
      ...entry,
      tableau: { ...entry.tableau, title },
    })));
    setEditHistory((previous) => previous.map((tableau) => ({ ...tableau, title })));
  };

  const safely = (operation: () => void) => {
    try { operation(); } catch (caught) { showNotice(caught instanceof Error ? caught.message : 'The operation could not be completed.'); }
  };

  const applyPivot = (requestedPivot: PivotSelection | null = selection) => safely(() => {
    if (!requestedPivot) throw new Error('Hover over a nonzero pivot element first.');
    const rowIndex = current.rows.findIndex((row) => row.id === requestedPivot.rowId);
    const columnIndex = current.variables.findIndex((variable) => variable.id === requestedPivot.variableId);
    if (rowIndex < 0 || columnIndex < 0) throw new Error('The selected pivot is no longer present.');
    const result = pivotTableau(current, rowIndex, columnIndex);
    const stepNumber = currentIndex + 1;
    commit(result.tableau, `Pivot ${stepNumber}: ${result.record.enteringName} enters`, result.record);
    showNotice(`Pivot applied exactly at ${result.record.pivotValue}.`);
  });

  const previousStep = () => {
    if (mode === 'edit' && canEdit) {
      if (editIndex <= 0) return;
      const nextIndex = editIndex - 1;
      const tableau = editHistory[nextIndex];
      setEditIndex(nextIndex);
      setHistory((previous) => [{ ...previous[0], tableau }]);
      setSelection(null);
      return;
    }
    if (currentIndex <= 0) return;
    setCurrentIndex((index) => index - 1);
    setSelection(null);
  };
  const nextStep = () => {
    if (mode === 'edit' && canEdit) {
      if (editIndex >= editHistory.length - 1) return;
      const nextIndex = editIndex + 1;
      const tableau = editHistory[nextIndex];
      setEditIndex(nextIndex);
      setHistory((previous) => [{ ...previous[0], tableau }]);
      setSelection(null);
      return;
    }
    if (currentIndex >= history.length - 1) return;
    setMode('pivot');
    setCurrentIndex((index) => index + 1);
    setSelection(null);
  };

  const enterEditMode = () => {
    if (!canEdit) {
      showNotice('Edit mode is available only for the initial tableau.');
      return;
    }
    setMode('edit');
    setView('workspace');
    setSelection(null);
  };

  const saveProject = () => {
    downloadText(`${safeFileName(current.title)}.simplex-assistant.json`, serializeProject(history, currentIndex));
    showNotice('Project saved.');
  };

  const shortcutHandlers: Record<ShortcutAction, () => void> = {
    toggleMode: () => {
      if (mode === 'edit') {
        setMode('pivot');
        setView('workspace');
        setSelection(null);
      } else {
        enterEditMode();
      }
    },
    applyPivot: () => applyPivot(),
    undo: previousStep,
    redo: nextStep,
    newProject: () => setModal('new'),
    openProject: () => fileInput.current?.click(),
    saveProject,
    addConstraint: () => {
      if (!canEdit) {
        showNotice('Constraints can be added only to the initial tableau.');
        return;
      }
      enterEditMode();
      replaceCurrent(addConstraint(current));
    },
    addVariable: () => {
      if (!canEdit) {
        showNotice('Variables can be added only to the initial tableau.');
        return;
      }
      enterEditMode();
      replaceCurrent(addVariable(current));
    },
    increaseFont: () => setSettings((value) => ({ ...value, tableFontSize: Math.min(30, value.tableFontSize + 1) })),
    decreaseFont: () => setSettings((value) => ({ ...value, tableFontSize: Math.max(12, value.tableFontSize - 1) })),
    openSettings: () => setModal((value) => value === 'settings' ? null : 'settings'),
    toggleExport: () => setModal((value) => value === 'export' ? null : 'export'),
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = shortcutFromEvent(event);
      if (!shortcut) return;
      const action = (Object.keys(settings.shortcuts) as ShortcutAction[])
        .find((candidate) => settings.shortcuts[candidate] === shortcut);
      if (!action) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('.shortcut-recorder.recording')) return;
      if (modal) {
        const closesCurrentMenu = (modal === 'settings' && action === 'openSettings')
          || (modal === 'export' && action === 'toggleExport');
        if (!closesCurrentMenu) return;
        event.preventDefault();
        event.stopPropagation();
        setModal(null);
        return;
      }
      const isEditing = target?.matches('input, textarea, select, [contenteditable="true"]');
      const editTimelineAction = mode === 'edit' && (action === 'undo' || action === 'redo');
      if (isEditing && action !== 'addConstraint' && action !== 'addVariable' && !editTimelineAction) return;
      event.preventDefault();
      event.stopPropagation();
      if (isEditing) target?.blur();
      shortcutHandlers[action]();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  });

  const openProject = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json')) {
      showNotice('Choose a Simplex Assistant .json project file.');
      return;
    }
    try {
      const loaded = deserializeProject(await file.text());
      archiveCurrentProblem();
      setHistory(loaded.history);
      setCurrentIndex(loaded.currentIndex);
      setEditHistory([loaded.history[0].tableau]);
      setEditIndex(0);
      setSelection(null);
      setView('workspace');
      setMode(loaded.currentIndex > 0 ? 'pivot' : 'edit');
      showNotice('Project opened.');
    } catch (caught) {
      showNotice(caught instanceof Error ? caught.message : 'The project could not be opened.');
    }
  };

  const resumeProblem = (record: ProblemHistoryRecord) => safely(() => {
    const loaded = openProblemHistoryRecord(record);
    archiveCurrentProblem(record.id);
    setHistory(loaded.history);
    setCurrentIndex(loaded.currentIndex);
    setEditHistory([loaded.history[0].tableau]);
    setEditIndex(0);
    setSelection(null);
    setView('workspace');
    setMode(loaded.currentIndex > 0 ? 'pivot' : 'edit');
    showNotice(`${record.title} restored from local history.`);
  });

  const numberMode = display.mode;
  const tableauStages = groupTableauStages(history, currentIndex);

  return (
    <div className={`app-shell${view === 'workspace' ? ' workspace-open' : ''}`}>
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark"><GridIcon /></div>
          <div><strong>Simplex Assistant</strong><span>Manual pivot practice</span></div>
        </div>
        <div className="document-title">
          <input
            value={current.title}
            aria-label="Problem name"
            onChange={(event) => renameProblem(event.target.value)}
          />
          <span>saved locally</span>
        </div>
        <div className="topbar-actions">
          {installPrompt && <button className="secondary-button install-button" type="button" onClick={async () => {
            await installPrompt.prompt();
            await installPrompt.userChoice;
            setInstallPrompt(null);
          }}>Install app</button>}
          <button className="icon-button labeled" type="button" onClick={() => setModal('new')} title={`New · ${settings.shortcuts.newProject}`}><PlusIcon /><span>New</span></button>
          <button className="icon-button labeled" type="button" onClick={() => fileInput.current?.click()} title={`Open · ${settings.shortcuts.openProject}`}><FolderIcon /><span>Open</span></button>
          <button className="icon-button labeled" type="button" onClick={saveProject} title={`Save · ${settings.shortcuts.saveProject}`}><SaveIcon /><span>Save</span></button>
          <button className="icon-button" type="button" onClick={() => setModal((value) => value === 'export' ? null : 'export')} title={`Export · ${settings.shortcuts.toggleExport}`}><ExportIcon /></button>
          <button className="icon-button" type="button" onClick={() => setModal((value) => value === 'settings' ? null : 'settings')} title={`Settings · ${settings.shortcuts.openSettings}`}><SettingsIcon /></button>
        </div>
      </header>

      <nav className="commandbar" aria-label="Tableau controls">
        <div className="segmented-control mode-control" aria-label="Mode">
          <span
            className={`disabled-edit-tip${canEdit ? '' : ' visible'}`}
          >
            <button
              type="button"
              className={mode === 'edit' ? 'active' : ''}
              disabled={!canEdit}
              aria-describedby={canEdit ? undefined : 'edit-disabled-tooltip'}
              onClick={enterEditMode}
            >Edit</button>
            {!canEdit && <span id="edit-disabled-tooltip" className="control-tooltip" role="tooltip">Edit is available only before the first pivot. Return to the initial tableau to change the problem.</span>}
          </span>
          <button type="button" className={mode === 'pivot' ? 'active' : ''} onClick={() => { setMode('pivot'); setView('workspace'); }}>Pivot</button>
        </div>
        <div className="command-divider" />
        <div className="segmented-control view-control" aria-label="View">
          <button type="button" className={view === 'workspace' ? 'active' : ''} onClick={() => setView('workspace')}><GridIcon /> Tableau</button>
          <button type="button" className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}><HistoryIcon /> History <span className="count-pill">{problemHistory.length}</span></button>
        </div>
        <div className="command-divider" />
        <div className="segmented-control compact-control" aria-label="Algorithm">
          <button type="button" className={algorithm === 'primal' ? 'active' : ''} onClick={() => { setAlgorithm('primal'); setSelection(null); }}>Primal</button>
          <button type="button" className={algorithm === 'dual' ? 'active' : ''} title="Uses c[j] / a[i,j] ratio guidance; the pivot row operation is unchanged" onClick={() => { setAlgorithm('dual'); setSelection(null); }}>Dual</button>
        </div>
        <div className="command-spacer" />
        <div className="display-control">
          <span>Display</span>
          <div className="segmented-control compact-control">
            <button type="button" className={numberMode === 'fraction' ? 'active' : ''} onClick={() => setDisplay({ mode: 'fraction' })}>
              <span className="display-fraction-sample" aria-label="Fractions">
                <span>1</span><span className="display-fraction-slash" aria-hidden="true">/</span><span>2</span>
              </span>
            </button>
            <button type="button" className={numberMode === 'decimal' ? 'active' : ''} onClick={() => setDisplay({ mode: 'decimal', precision: display.mode === 'decimal' ? display.precision : 3 })}>0.50</button>
          </div>
          <span className={`decimal-places-slot${display.mode === 'decimal' ? ' visible' : ''}`} aria-hidden={display.mode !== 'decimal'}>
            <select aria-label="Decimal places" disabled={display.mode !== 'decimal'} tabIndex={display.mode === 'decimal' ? 0 : -1} value={display.mode === 'decimal' ? display.precision : 3} onChange={(event) => setDisplay({ mode: 'decimal', precision: Number(event.target.value) })}>
              {Array.from({ length: 9 }, (_, index) => <option key={index} value={index}>{index} decimals</option>)}
            </select>
          </span>
        </div>
        <div className="undo-controls">
          <button className="icon-button" type="button" disabled={mode === 'edit' ? editIndex === 0 : currentIndex === 0} onClick={previousStep} title={`${mode === 'edit' ? 'Undo edit' : 'Previous tableau'} · ${settings.shortcuts.undo}`}><UndoIcon /></button>
          <span>{mode === 'edit' ? `${editIndex + 1} / ${editHistory.length}` : `${currentIndex + 1} / ${history.length}`}</span>
          <button className="icon-button" type="button" disabled={mode === 'edit' ? editIndex === editHistory.length - 1 : currentIndex === history.length - 1} onClick={nextStep} title={`${mode === 'edit' ? 'Redo edit' : 'Next tableau'} · ${settings.shortcuts.redo}`}><RedoIcon /></button>
        </div>
      </nav>

      {view === 'workspace' ? (
        <main className="workspace-layout">
          {mode === 'edit' && canEdit ? (
            <EditInspector
              tableau={current}
              onAddConstraint={() => replaceCurrent(addConstraint(current))}
              onAddVariable={() => replaceCurrent(addVariable(current))}
              onDetectBasis={() => { replaceCurrent(detectBasis(current)); showNotice('Identity columns assigned to the basis.'); }}
              onOpenPhaseOne={() => setModal('phase1')}
              addConstraintShortcut={settings.shortcuts.addConstraint}
              addVariableShortcut={settings.shortcuts.addVariable}
              onFinishPhaseOne={() => safely(() => {
                const next = finishPhaseOne(current);
                commit(next, 'Original objective restored');
                setMode('pivot');
                showNotice('Phase I complete. The original objective row is canonical in the current basis.');
              })}
            />
          ) : (
            <PivotInspector
              tableau={current}
              algorithm={algorithm}
              display={display}
              selection={selection}
              showPivotHints={settings.showPivotHints}
              onFinishPhaseOne={() => safely(() => {
                const next = finishPhaseOne(current);
                commit(next, 'Original objective restored');
                showNotice('Phase I complete. The original objective row is canonical in the current basis.');
              })}
            />
          )}
          <section className="tableau-card">
            <header className="tableau-card-header">
              <div>
                <span className="eyebrow">Simplex method tableau</span>
                <h1>{current.title}</h1>
              </div>
              <div className="tableau-meta">
                <span>{current.rows.length} {current.rows.length === 1 ? 'constraint' : 'constraints'}, {current.variables.length} {current.variables.length === 1 ? 'variable' : 'variables'}</span>
                {current.phase === 'phase1' && <span className="status-badge amber">Phase I · −w</span>}
              </div>
            </header>
            <div className="tableau-sequence">
              {tableauStages.map((stage) => (
                <section className="tableau-stage" key={stage.id} aria-label={stage.label ?? 'Simplex tableau'}>
                  {stage.label && <header className="tableau-stage-heading"><strong>{stage.label}</strong></header>}
                  <div className="tableau-stage-steps">
                    {stage.entries.map(({ entry, index }, stageIndex) => {
                      const isCurrent = index === currentIndex;
                      const stepDescription = entry.pivot
                        ? `${entry.label}. ${entry.pivot.enteringName} entered, ${entry.pivot.leavingName} left; pivot ${entry.pivot.pivotValue}.`
                        : entry.label;
                      return (
                        <article
                          key={entry.id}
                          className={`tableau-step${isCurrent ? ' current' : ''}`}
                          aria-label={`Step ${index}. ${stepDescription}`}
                        >
                          <TableauGrid
                            tableau={entry.tableau}
                            mode={isCurrent && index === 0 ? mode : 'pivot'}
                            algorithm={algorithm}
                            display={display}
                            showPivotHints={settings.showPivotHints}
                            tableFontSize={settings.tableFontSize}
                            selection={isCurrent ? selection : null}
                            compact={!isCurrent}
                            showHeader={stageIndex === 0}
                            pivotMark={index < currentIndex ? history[index + 1]?.pivot : undefined}
                            onPivot={isCurrent && mode === 'pivot' ? applyPivot : undefined}
                            onHoverPivot={isCurrent && mode === 'pivot' ? setSelection : undefined}
                            onChange={isCurrent && index === 0 ? replaceCurrent : undefined}
                            onRemoveVariable={isCurrent && index === 0 ? (id) => safely(() => replaceCurrent(removeVariable(current, id))) : undefined}
                            onRemoveConstraint={isCurrent && index === 0 ? (id) => safely(() => replaceCurrent(removeConstraint(current, id))) : undefined}
                          />
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            {mode === 'edit' && canEdit && (
              <footer className="tableau-card-footer">
                <div><InfoIcon /><span>Press Enter to commit a cell. Use the arrow keys to move between cells.</span></div>
              </footer>
            )}
          </section>
        </main>
      ) : (
        <main className="history-main">
          <ProblemHistoryView
            problems={problemHistory}
            onOpen={resumeProblem}
            onDelete={(id) => setProblemHistory((previous) => previous.filter((record) => record.id !== id))}
          />
        </main>
      )}

      <input ref={fileInput} className="visually-hidden" type="file" accept=".json,.pivotlab.json,.simplex-assistant.json,application/json" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void openProject(file);
        event.currentTarget.value = '';
      }} />

      {modal === 'new' && <NewProjectModal
        onClose={() => setModal(null)}
        onCreate={(rows, variables, title) => { reset(createBlankTableau(rows, variables, title)); setModal(null); }}
        onLoadExample={() => { reset(createTextbookExample()); setModal(null); }}
      />}
      {modal === 'phase1' && <PhaseOneModal tableau={current} onClose={() => setModal(null)} onStart={(rowIds) => safely(() => {
        const next = startPhaseOne(current, rowIds);
        commit(next, 'Phase I setup');
        setMode('pivot');
        setModal(null);
        showNotice('Phase I tableau created. Choose pivots manually.');
      })} />}
      {modal === 'settings' && <SettingsModal settings={settings} onChange={setSettings} onClose={() => setModal(null)} />}
      {modal === 'export' && <ExportModal
        tableau={current}
        history={history}
        currentIndex={currentIndex}
        display={display}
        includeResult={includeExportResult}
        onIncludeResultChange={setIncludeExportResult}
        includeSolution={includeExportSolution}
        onIncludeSolutionChange={setIncludeExportSolution}
        onClose={() => setModal(null)}
        onNotice={showNotice}
        onPrintHistory={(includeResult, includeSolution, fileStem) => {
          setIncludePrintResult(includeResult);
          setPrintCompleteSolution(includeSolution);
          setIsPrinting(true);
          window.setTimeout(() => {
            // Browsers derive the proposed PDF filename from document.title.
            // Restore the application title as soon as the print dialog closes.
            const applicationTitle = document.title;
            document.title = fileStem;
            window.addEventListener('afterprint', () => {
              document.title = applicationTitle;
              setIncludePrintResult(false);
              setIsPrinting(false);
            }, { once: true });
            window.print();
          }, 120);
        }}
      />}
      {isPrinting && (
        <div className="print-solution-record" aria-hidden="true">
          <SolutionHistoryView
            history={printCompleteSolution ? history : history.slice(0, 1)}
            currentIndex={printCompleteSolution ? currentIndex : 0}
            display={display}
            tableFontSize={settings.tableFontSize}
            includeResult={includePrintResult}
            resultTableau={current}
            onRestore={() => undefined}
          />
        </div>
      )}
      {notice && <div className="toast" role="status"><InfoIcon /><span>{notice}</span></div>}
    </div>
  );
}
