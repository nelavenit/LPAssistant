'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppError, errorText, resolveLanguage, safeFilename, tableauTitle, translate } from './app/i18n';
import { LanguageContext } from './app/languageContext';
import { loadSettings, shortcutFromEvent, type AppSettings, type ShortcutAction } from './app/settings';
import type { NumberDisplay } from './math/rational';
import { autoSolveState, autoSolveTableau } from './model/autoSolve';
import {
  addConstraint,
  addVariable,
  analyzeTableau,
  canonicalizeObjective,
  createBlankTableau,
  createTextbookExample,
  detectBasis,
  describeHistoryEntry,
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
import { SolutionResult } from './components/SolutionResult';

type View = 'workspace' | 'history';
type ModalName = 'new' | 'phase1' | 'settings' | 'export' | null;
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function initialSession(): { history: HistoryEntry[]; currentIndex: number } {
  try {
    const stored = localStorage.getItem('pivotlab-autosave');
    if (stored) return deserializeProject(stored);
  } catch {
    // A clean example is safer than blocking startup on a damaged autosave.
  }
  const tableau = createTextbookExample();
  return {
    history: [{ id: makeId('history'), label: 'Initial tableau', tableau }],
    currentIndex: 0,
  };
}

function initialDisplay(): NumberDisplay {
  try {
    const stored = JSON.parse(localStorage.getItem('pivotlab-display') ?? '{}') as Partial<NumberDisplay>;
    if (stored.mode === 'decimal') return { mode: 'decimal', precision: Number.isInteger(stored.precision) ? Math.max(0, Math.min(8, stored.precision!)) : 3 };
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
  const [hoverSelection, setHoverSelection] = useState<PivotSelection | null>(null);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [browserLanguages, setBrowserLanguages] = useState(() => typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]);
  const [compactLayout, setCompactLayout] = useState(false);
  const [modal, setModal] = useState<ModalName>(null);
  const [includePrintResult, setIncludePrintResult] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [includeExportResult, setIncludeExportResult] = useState(true);
  const [includeExportSolution, setIncludeExportSolution] = useState(true);
  const [printCompleteSolution, setPrintCompleteSolution] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSolving, setIsSolving] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<number | null>(null);
  const activeSolve = useRef<AbortController | null>(null);
  const current = history[currentIndex].tableau;
  const canEdit = currentIndex === 0;
  const language = resolveLanguage(settings.language, browserLanguages);
  const locale = useMemo(() => ({ language, t: translate.bind(null, language) }), [language]);
  const { t } = locale;
  const activeSelection = selection ?? hoverSelection;
  const analysis = useMemo(() => analyzeTableau(current), [current]);
  const solveState = useMemo(() => mode === 'auto' ? autoSolveState(current, analysis) : null, [mode, current, analysis]);
  const clearPivot = () => { setSelection(null); setHoverSelection(null); };

  useEffect(() => {
    const updateLanguage = () => setBrowserLanguages(navigator.languages ?? [navigator.language]);
    window.addEventListener('languagechange', updateLanguage);
    return () => window.removeEventListener('languagechange', updateLanguage);
  }, []);

  useLayoutEffect(() => { document.documentElement.lang = language; }, [language]);
  useLayoutEffect(() => () => activeSolve.current?.abort(), [history, currentIndex, mode, view]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px), (max-width: 960px) and (pointer: coarse)');
    const update = () => setCompactLayout(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => () => {
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
  }, []);

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
    try { localStorage.setItem('pivotlab-display', JSON.stringify(display)); } catch { /* Storage is optional. */ }
  }, [display]);

  useEffect(() => {
    try { localStorage.setItem('pivotlab-settings', JSON.stringify(settings)); } catch { /* Storage is optional. */ }
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
    clearPivot();
  };

  const appendHistory = (entries: HistoryEntry[]) => {
    const next = [...history.slice(0, currentIndex + 1), ...entries];
    setHistory(next);
    setCurrentIndex(next.length - 1);
    clearPivot();
  };
  const commit = (tableau: Tableau, label: string, pivot?: HistoryEntry['pivot']) => {
    appendHistory([{ id: makeId('history'), label, tableau, pivot }]);
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
    clearPivot();
    setView('workspace');
    setMode('edit');
  };

  const safely = (operation: () => void) => {
    try { operation(); } catch (caught) { showNotice(errorText(t, caught, 'The operation could not be completed.')); }
  };

  const applyPivot = (requestedPivot: PivotSelection | null = activeSelection) => safely(() => {
    if (!requestedPivot) throw new AppError('Select a nonzero pivot element first.');
    const rowIndex = current.rows.findIndex((row) => row.id === requestedPivot.rowId);
    const columnIndex = current.variables.findIndex((variable) => variable.id === requestedPivot.variableId);
    if (rowIndex < 0 || columnIndex < 0) throw new AppError('The selected pivot is no longer present.');
    const result = pivotTableau(current, rowIndex, columnIndex);
    const stepNumber = currentIndex + 1;
    commit(result.tableau, `Pivot ${stepNumber}: ${result.record.enteringName} enters`, result.record);
    showNotice(t('Pivot applied exactly at {value}.', { value: result.record.pivotValue }));
  });

  const runAutoSolve = async (phaseOneSetup?: Tableau) => {
    if (activeSolve.current) return;
    const run = new AbortController();
    activeSolve.current = run;
    setIsSolving(true);
    setNotice(null);
    const entries: HistoryEntry[] = phaseOneSetup
      ? [{ id: makeId('history'), label: 'Phase I setup', tableau: phaseOneSetup }]
      : [];
    try {
      const steps = autoSolveTableau(phaseOneSetup ?? current, currentIndex + entries.length);
      // Yield between batches so touch controls and cancellation stay responsive.
      let finished = false;
      while (!finished) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        if (run.signal.aborted) return;
        const deadline = performance.now() + 12;
        do {
          const next = steps.next();
          finished = Boolean(next.done);
          if (!next.done) entries.push({ id: makeId('history'), ...next.value });
        } while (!finished && performance.now() < deadline);
      }
      if (entries.length > 0) appendHistory(entries);
    } catch (caught) {
      showNotice(errorText(t, caught, 'The operation could not be completed.'));
    } finally {
      activeSolve.current = null;
      setIsSolving(false);
    }
  };

  const previousStep = () => {
    if (mode === 'edit' && canEdit) {
      if (editIndex <= 0) return;
      const nextIndex = editIndex - 1;
      const tableau = editHistory[nextIndex];
      setEditIndex(nextIndex);
      setHistory((previous) => [{ ...previous[0], tableau }]);
      clearPivot();
      return;
    }
    if (currentIndex <= 0) return;
    setCurrentIndex((index) => index - 1);
    clearPivot();
  };
  const nextStep = () => {
    if (mode === 'edit' && canEdit) {
      if (editIndex >= editHistory.length - 1) return;
      const nextIndex = editIndex + 1;
      const tableau = editHistory[nextIndex];
      setEditIndex(nextIndex);
      setHistory((previous) => [{ ...previous[0], tableau }]);
      clearPivot();
      return;
    }
    if (currentIndex >= history.length - 1) return;
    setCurrentIndex((index) => index + 1);
    clearPivot();
  };

  const enterEditMode = () => {
    if (!canEdit) {
      showNotice(t('Edit mode is available only for the initial tableau.'));
      return;
    }
    setMode('edit');
    setView('workspace');
    clearPivot();
  };

  const saveProject = () => {
    downloadText(`${safeFilename(tableauTitle(t, current.title))}.simplex-assistant.json`, serializeProject(history, currentIndex));
    showNotice(t('Project saved.'));
  };

  const shortcutHandlers: Record<ShortcutAction, () => void> = {
    toggleMode: () => {
      if (mode === 'edit') {
        setMode('pivot');
        setView('workspace');
        clearPivot();
      } else {
        enterEditMode();
      }
    },
    applyPivot: () => { if (mode !== 'auto') applyPivot(); },
    undo: previousStep,
    redo: nextStep,
    newProject: () => setModal('new'),
    openProject: () => fileInput.current?.click(),
    saveProject,
    addConstraint: () => {
      if (!canEdit) {
        showNotice(t('Constraints can be added only to the initial tableau.'));
        return;
      }
      enterEditMode();
      replaceCurrent(addConstraint(current));
    },
    addVariable: () => {
      if (!canEdit) {
        showNotice(t('Variables can be added only to the initial tableau.'));
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
      if (event.isComposing || target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      shortcutHandlers[action]();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  });

  const openProject = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json')) {
      showNotice(t('Choose a Simplex Assistant .json project file.'));
      return;
    }
    try {
      const loaded = deserializeProject(await file.text());
      archiveCurrentProblem();
      setHistory(loaded.history);
      setCurrentIndex(loaded.currentIndex);
      setEditHistory([loaded.history[0].tableau]);
      setEditIndex(0);
      clearPivot();
      setView('workspace');
      setMode(loaded.currentIndex > 0 ? 'pivot' : 'edit');
      showNotice(t('Project opened.'));
    } catch (caught) {
      showNotice(errorText(t, caught, 'The project could not be opened.'));
    }
  };

  const resumeProblem = (record: ProblemHistoryRecord) => safely(() => {
    const loaded = openProblemHistoryRecord(record);
    archiveCurrentProblem(record.id);
    setHistory(loaded.history);
    setCurrentIndex(loaded.currentIndex);
    setEditHistory([loaded.history[0].tableau]);
    setEditIndex(0);
    clearPivot();
    setView('workspace');
    setMode(loaded.currentIndex > 0 ? 'pivot' : 'edit');
    showNotice(t('{title} restored from local history.', { title: tableauTitle(t, record.title) }));
  });

  const numberMode = display.mode;
  const tableauStages = useMemo(() => groupTableauStages(history, currentIndex), [history, currentIndex]);
  const currentTableauOnly = compactLayout || mode === 'auto';
  const selectedRow = selection ? current.rows.findIndex((row) => row.id === selection.rowId) : -1;
  const selectedColumn = selection ? current.variables.findIndex((variable) => variable.id === selection.variableId) : -1;

  return (
    <LanguageContext.Provider value={locale}>
      <div className={`app-shell${view === 'workspace' ? ' workspace-open' : ''}${mode === 'edit' ? ' editing' : ''}`}>
        <header className="topbar">
          <div className="brand-block">
            <div className="brand-mark"><GridIcon /></div>
            <div><strong>Simplex Assistant</strong><span>{t('Simplex tableau practice')}</span></div>
          </div>
          <div className="document-title">
            {mode === 'edit' ? (
              <input
                value={tableauTitle(t, current.title)}
                aria-label={t('Tableau title')}
                onChange={(event) => {
                  const next = { ...current, title: event.target.value };
                  replaceCurrent(next);
                }}
              />
            ) : <strong>{tableauTitle(t, current.title)}</strong>}
            <span>{t('saved locally')}</span>
          </div>
          <div className="topbar-actions">
            {installPrompt && <button className="secondary-button install-button" type="button" onClick={async () => {
              await installPrompt.prompt();
              await installPrompt.userChoice;
              setInstallPrompt(null);
            }}>{t('Install app')}</button>}
            <button className="icon-button labeled" type="button" aria-label={t('New')} onClick={() => setModal('new')} title={`${t('New')} · ${settings.shortcuts.newProject}`}><PlusIcon /><span>{t('New')}</span></button>
            <button className="icon-button labeled" type="button" aria-label={t('Open')} onClick={() => fileInput.current?.click()} title={`${t('Open')} · ${settings.shortcuts.openProject}`}><FolderIcon /><span>{t('Open')}</span></button>
            <button className="icon-button labeled" type="button" aria-label={t('Save')} onClick={saveProject} title={`${t('Save')} · ${settings.shortcuts.saveProject}`}><SaveIcon /><span>{t('Save')}</span></button>
            <button className="icon-button" type="button" aria-label={t('Export')} onClick={() => setModal('export')} title={`${t('Export')} · ${settings.shortcuts.toggleExport}`}><ExportIcon /></button>
            <button className="icon-button" type="button" aria-label={t('Settings')} onClick={() => setModal('settings')} title={`${t('Settings')} · ${settings.shortcuts.openSettings}`}><SettingsIcon /></button>
          </div>
        </header>

        <nav className="commandbar" aria-label={t('Tableau controls')}>
          <div className="segmented-control mode-control" aria-label={t('Mode')}>
            <span
              className={`disabled-edit-tip${canEdit ? '' : ' visible'}`}
            >
              <button
                type="button"
                className={mode === 'edit' ? 'active' : ''}
                aria-pressed={mode === 'edit'}
                disabled={!canEdit}
                aria-describedby={canEdit ? undefined : 'edit-disabled-tooltip'}
                onClick={enterEditMode}
              >{t('Edit')}</button>
              {!canEdit && <span id="edit-disabled-tooltip" className="control-tooltip" role="tooltip">{t('Edit is available only before the first pivot. Return to the initial tableau to change the problem.')}</span>}
            </span>
            <button type="button" className={mode === 'pivot' ? 'active' : ''} aria-pressed={mode === 'pivot'} onClick={() => { setMode('pivot'); setView('workspace'); }}>{t('Pivot')}</button>
            <button type="button" className={mode === 'auto' ? 'active' : ''} aria-pressed={mode === 'auto'} onClick={() => { setMode('auto'); setView('workspace'); clearPivot(); }}>{t('Auto-solve')}</button>
          </div>
          <div className="command-divider" />
          <div className="segmented-control view-control" aria-label={t('View')}>
            <button type="button" className={view === 'workspace' ? 'active' : ''} onClick={() => setView('workspace')}><GridIcon /> {t('Tableau')}</button>
            <button type="button" className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}><HistoryIcon /> {t('History')} <span className="count-pill">{problemHistory.length}</span></button>
          </div>
          {mode !== 'auto' && <>
            <div className="command-divider" />
            <div className="segmented-control compact-control algorithm-control" aria-label={t('Algorithm')}>
              <button type="button" className={algorithm === 'primal' ? 'active' : ''} onClick={() => { setAlgorithm('primal'); clearPivot(); }}>{t('Primal')}</button>
              <button type="button" className={algorithm === 'dual' ? 'active' : ''} title={t('Uses c[j] / a[i,j] ratio guidance; the pivot row operation is unchanged')} onClick={() => { setAlgorithm('dual'); clearPivot(); }}>{t('Dual')}</button>
            </div>
          </>}
          <div className="command-spacer" />
          <div className="display-control">
            <span>{t('Display')}</span>
            <div className="segmented-control compact-control">
              <button type="button" className={numberMode === 'fraction' ? 'active' : ''} onClick={() => setDisplay({ mode: 'fraction' })}>
                <span className="display-fraction-sample" aria-label={t('Fractions')}>1/2</span>
              </button>
              <button type="button" className={numberMode === 'decimal' ? 'active' : ''} onClick={() => setDisplay({ mode: 'decimal', precision: display.mode === 'decimal' ? display.precision : 3 })} aria-label={t('Decimals')}>{language === 'ru' ? '0,50' : '0.50'}</button>
            </div>
            <span className={`decimal-places-slot${display.mode === 'decimal' ? ' visible' : ''}`} aria-hidden={display.mode !== 'decimal'}>
              <select aria-label={t('Decimal places')} disabled={display.mode !== 'decimal'} tabIndex={display.mode === 'decimal' ? 0 : -1} value={display.mode === 'decimal' ? display.precision : 3} onChange={(event) => setDisplay({ mode: 'decimal', precision: Number(event.target.value) })}>
                {Array.from({ length: 9 }, (_, index) => <option key={index} value={index}>{t('{count} decimals', { count: index })}</option>)}
              </select>
            </span>
          </div>
          <div className="undo-controls">
            <button className="icon-button" type="button" disabled={mode === 'edit' ? editIndex === 0 : currentIndex === 0} onClick={previousStep} title={`${t(mode === 'edit' ? 'Undo edit' : 'Previous tableau')} · ${settings.shortcuts.undo}`}><UndoIcon /></button>
            <span>{mode === 'edit' ? `${editIndex + 1} / ${editHistory.length}` : `${currentIndex + 1} / ${history.length}`}</span>
            <button className="icon-button" type="button" disabled={mode === 'edit' ? editIndex === editHistory.length - 1 : currentIndex === history.length - 1} onClick={nextStep} title={`${t(mode === 'edit' ? 'Redo edit' : 'Next tableau')} · ${settings.shortcuts.redo}`}><RedoIcon /></button>
          </div>
        </nav>

        {view === 'workspace' ? (
          <main className={`workspace-layout${mode === 'auto' ? ' auto-workspace' : ''}`}>
            {mode === 'auto' ? (
              <aside className="inspector-card auto-solve-panel" aria-labelledby="auto-solve-heading">
                <div className="inspector-heading">
                  <h2 id="auto-solve-heading">{t('Auto-solve')}</h2>
                  <div aria-live="polite" aria-atomic="true">
                    {isSolving ? <p>{t('Solving the tableau…')}</p> : solveState === 'complete'
                      ? <SolutionResult tableau={current} display={display} analysis={analysis} />
                      : <p>{t(solveState === 'needsPhaseOne'
                        ? 'Set up Phase I to obtain a feasible basis, or assign the basis in Edit if unit columns are already available.'
                        : solveState === 'needsCanonicalObjective'
                          ? 'Use Canonicalize objective in Edit before solving.'
                          : solveState === 'invalidPhaseOne'
                            ? 'Auto-solve needs a canonical Phase I tableau with nonnegative free terms. Check the Phase I setup.'
                            : 'Choose Solve tableau to run all remaining pivots.')}</p>}
                  </div>
                </div>
                {isSolving ? (
                  <button className="secondary-button" type="button" onClick={() => activeSolve.current?.abort()}>{t('Cancel')}</button>
                ) : solveState === 'needsPhaseOne' ? (
                  <button className="primary-button" type="button" onClick={() => setModal('phase1')}>{t('Set up Phase I')}</button>
                ) : solveState === 'ready' && (
                  <button className="primary-button" type="button" onClick={() => void runAutoSolve()}>{t('Solve tableau')}</button>
                )}
              </aside>
            ) : mode === 'edit' && canEdit ? (
              <EditInspector
                tableau={current}
                onAddConstraint={() => replaceCurrent(addConstraint(current))}
                onAddVariable={() => replaceCurrent(addVariable(current))}
                onDetectBasis={() => { replaceCurrent(detectBasis(current)); showNotice(t('Identity columns assigned to the basis.')); }}
                onCanonicalize={() => safely(() => {
                  replaceCurrent(canonicalizeObjective(current));
                  showNotice(t('Basic objective coefficients are now zero.'));
                })}
                onOpenPhaseOne={() => setModal('phase1')}
                addConstraintShortcut={settings.shortcuts.addConstraint}
                addVariableShortcut={settings.shortcuts.addVariable}
                onFinishPhaseOne={() => safely(() => {
                  const next = finishPhaseOne(current);
                  commit(next, 'Original objective restored');
                  setMode('pivot');
                  showNotice(t('Phase I complete. The original objective row is canonical in the current basis.'));
                })}
              />
            ) : (
              <PivotInspector
                tableau={current}
                algorithm={algorithm}
                display={display}
                selection={activeSelection}
                showPivotHints={settings.showPivotHints}
                result={<SolutionResult tableau={current} display={display} analysis={analysis} />}
                onFinishPhaseOne={() => safely(() => {
                  const next = finishPhaseOne(current);
                  commit(next, 'Original objective restored');
                  showNotice(t('Phase I complete. The original objective row is canonical in the current basis.'));
                })}
              />
            )}
            <section className="tableau-card">
              <header className="tableau-card-header">
                <div>
                  <span className="eyebrow">{t('Simplex method tableau')}</span>
                  <h1>{tableauTitle(t, current.title)}</h1>
                </div>
                <div className="tableau-meta">
                  <span>{t('Constraints: {rows} · Variables: {variables}', { rows: current.rows.length, variables: current.variables.length })}</span>
                  {current.phase === 'phase1' && <span className="status-badge amber">{t('Phase I · −w')}</span>}
                </div>
              </header>
              <div className="mobile-tableau-tools">
                <p>{t('Swipe the table horizontally to see more columns.')}</p>
                {mode === 'edit' && <a href="#tableau-setup">{t('Tableau setup')}</a>}
                {mode === 'pivot' && <a href="#pivot-result">{t('See the current result')}</a>}
                {mode === 'pivot' && current.phase === 'phase1' && <a href="#phase-one-controls">{t('Phase I controls')}</a>}
              </div>
              {mode === 'pivot' && selectedRow >= 0 && selectedColumn >= 0 && (
                <div className="pivot-confirmation">
                  <span role="status">{t('{value} at row {row}, column {variable}', {
                    value: current.rows[selectedRow].values[selectedColumn].toFraction(),
                    row: selectedRow + 1,
                    variable: current.variables[selectedColumn].name,
                  })}</span>
                  <button type="button" className="primary-button" onClick={() => applyPivot(selection)}>{t('Apply pivot')}</button>
                  <button type="button" className="text-button" onClick={clearPivot}>{t('Clear selection')}</button>
                </div>
              )}
              <div className="tableau-sequence">
                {tableauStages.map((stage) => (!currentTableauOnly || stage.entries.some(({ index }) => index === currentIndex)) && (
                  <section className="tableau-stage" key={stage.id} aria-label={t(stage.label ?? 'Simplex tableau')}>
                    {stage.label && <header className="tableau-stage-heading"><strong>{t(stage.label)}</strong></header>}
                    <div className="tableau-stage-steps">
                      {stage.entries.map(({ entry, index }, stageIndex) => {
                        const isCurrent = index === currentIndex;
                        if (currentTableauOnly && !isCurrent) return null;
                        const stepDescription = describeHistoryEntry(t, entry, index);
                        return (
                          <article
                            key={entry.id}
                            className={`tableau-step${isCurrent ? ' current' : ''}`}
                            aria-label={t('Step {index}. {label}', { index, label: stepDescription })}
                          >
                            <TableauGrid
                              tableau={entry.tableau}
                              mode={isCurrent && index === 0 ? mode : 'pivot'}
                              algorithm={algorithm}
                              display={display}
                              showPivotHints={settings.showPivotHints}
                              tableFontSize={settings.tableFontSize}
                              selection={isCurrent ? activeSelection : null}
                              compact={!isCurrent}
                              showHeader={mode === 'auto' || stageIndex === 0}
                              pivotMark={index < currentIndex ? history[index + 1]?.pivot : undefined}
                              onPivot={isCurrent && mode === 'pivot' ? applyPivot : undefined}
                              onHoverPivot={isCurrent && mode === 'pivot' ? setHoverSelection : undefined}
                              onSelectPivot={isCurrent && mode === 'pivot' ? setSelection : undefined}
                              onInvalid={showNotice}
                              repeatHeader={isCurrent}
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
                  <div><InfoIcon /><span>{t('Press Enter to commit a cell. Use the arrow keys to move between cells.')}</span></div>
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

        <input ref={fileInput} className="visually-hidden" type="file" tabIndex={-1} aria-hidden="true" accept=".json,.pivotlab.json,.simplex-assistant.json,application/json" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void openProject(file);
          event.currentTarget.value = '';
        }} />

        {modal === 'new' && <NewProjectModal
          onClose={() => setModal(null)}
          onCreate={(rows, variables, title) => { reset(createBlankTableau(rows, variables, title)); setModal(null); }}
          onLoadExample={() => { reset(createTextbookExample()); setModal(null); }}
        />}
        {modal === 'phase1' && <PhaseOneModal tableau={current} autoSolve={mode === 'auto'} notice={notice} onClose={() => setModal(null)} onStart={(rowIds) => safely(() => {
          const next = startPhaseOne(current, rowIds);
          if (mode === 'auto') {
            if (autoSolveState(next) === 'invalidPhaseOne') {
              throw new AppError('Select every row that lacks a unit-column basis or has a negative free term.');
            }
            setModal(null);
            void runAutoSolve(next);
            return;
          }
          commit(next, 'Phase I setup');
          setMode('pivot');
          setModal(null);
          showNotice(t('Phase I tableau created. Choose pivots manually.'));
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
          notice={notice}
          onPrintHistory={(includeResult, includeSolution) => {
            setIncludePrintResult(includeResult);
            setPrintCompleteSolution(includeSolution);
            setIsPrinting(true);
            window.setTimeout(() => {
              window.addEventListener('afterprint', () => {
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
        {notice && !modal && <div className="toast" role="status"><InfoIcon /><span>{notice}</span></div>}
      </div>
    </LanguageContext.Provider>
  );
}
