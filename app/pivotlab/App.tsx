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
import { HistoryView } from './components/HistoryView';
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
  const [mode, setMode] = useState<AppMode>('pivot');
  const [algorithm, setAlgorithm] = useState<Algorithm>('primal');
  const [view, setView] = useState<View>('workspace');
  const [display, setDisplay] = useState<NumberDisplay>(initialDisplay);
  const [selection, setSelection] = useState<PivotSelection | null>(null);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [modal, setModal] = useState<ModalName>(null);
  const [includePrintResult, setIncludePrintResult] = useState(false);
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

  const reset = (tableau: Tableau) => {
    setHistory([{ id: makeId('history'), label: 'Initial tableau', tableau }]);
    setCurrentIndex(0);
    setSelection(null);
    setView('workspace');
    setMode('edit');
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
    if (currentIndex <= 0) return;
    setCurrentIndex((index) => index - 1);
    setSelection(null);
  };
  const nextStep = () => {
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
    downloadText(`${safeName(current.title)}.simplex-assistant.json`, serializeProject(history, currentIndex));
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
      if (isEditing && action !== 'addConstraint' && action !== 'addVariable') return;
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
      setHistory(loaded.history);
      setCurrentIndex(loaded.currentIndex);
      setSelection(null);
      setView('workspace');
      if (loaded.currentIndex > 0) setMode('pivot');
      showNotice('Project opened.');
    } catch (caught) {
      showNotice(caught instanceof Error ? caught.message : 'The project could not be opened.');
    }
  };

  const numberMode = display.mode;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark"><GridIcon /></div>
          <div><strong>Simplex Assistant</strong><span>Manual pivot practice</span></div>
        </div>
        <div className="document-title">
          {mode === 'edit' ? (
            <input
              value={current.title}
              aria-label="Tableau title"
              onChange={(event) => {
                const next = { ...current, title: event.target.value };
                replaceCurrent(next);
              }}
            />
          ) : <strong>{current.title}</strong>}
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
          <button type="button" className={mode === 'edit' ? 'active' : ''} disabled={!canEdit} title={canEdit ? 'Edit the initial tableau' : 'Edit mode is available only for the initial tableau'} onClick={enterEditMode}>Edit</button>
          <button type="button" className={mode === 'pivot' ? 'active' : ''} onClick={() => { setMode('pivot'); setView('workspace'); }}>Pivot</button>
        </div>
        <div className="command-divider" />
        <div className="segmented-control view-control" aria-label="View">
          <button type="button" className={view === 'workspace' ? 'active' : ''} onClick={() => setView('workspace')}><GridIcon /> Tableau</button>
          <button type="button" className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}><HistoryIcon /> History <span className="count-pill">{history.length}</span></button>
        </div>
        <div className="command-divider" />
        <div className="segmented-control compact-control" aria-label="Algorithm">
          <button type="button" className={algorithm === 'primal' ? 'active' : ''} onClick={() => { setAlgorithm('primal'); setSelection(null); }}>Primal</button>
          <button type="button" className={algorithm === 'dual' ? 'active' : ''} title="Uses cⱼ / aᵢⱼ ratio guidance; the pivot row operation is unchanged" onClick={() => { setAlgorithm('dual'); setSelection(null); }}>Dual</button>
        </div>
        <div className="command-spacer" />
        <div className="display-control">
          <span>Display</span>
          <div className="segmented-control compact-control">
            <button type="button" className={numberMode === 'fraction' ? 'active' : ''} onClick={() => setDisplay({ mode: 'fraction' })}>1/2</button>
            <button type="button" className={numberMode === 'decimal' ? 'active' : ''} onClick={() => setDisplay({ mode: 'decimal', precision: display.mode === 'decimal' ? display.precision : 3 })}>0.50</button>
          </div>
          {display.mode === 'decimal' && (
            <select aria-label="Decimal places" value={display.precision} onChange={(event) => setDisplay({ mode: 'decimal', precision: Number(event.target.value) })}>
              {Array.from({ length: 9 }, (_, index) => <option key={index} value={index}>{index} decimals</option>)}
            </select>
          )}
        </div>
        <div className="undo-controls">
          <button className="icon-button" type="button" disabled={currentIndex === 0} onClick={previousStep} title={`Previous tableau · ${settings.shortcuts.undo}`}><UndoIcon /></button>
          <span>{currentIndex + 1} / {history.length}</span>
          <button className="icon-button" type="button" disabled={currentIndex === history.length - 1} onClick={nextStep} title={`Next tableau · ${settings.shortcuts.redo}`}><RedoIcon /></button>
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
                <span className="eyebrow">Tableau sequence</span>
                <h1>{current.title}</h1>
              </div>
              <div className="tableau-meta">
                <span>{current.rows.length} × {current.variables.length}</span>
                {current.phase === 'phase1' && <span className="status-badge amber">Phase I · −w</span>}
              </div>
            </header>
            <div className="tableau-sequence">
              {history.slice(0, currentIndex + 1).map((entry, index) => {
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
                      selection={isCurrent ? selection : null}
                      compact={!isCurrent}
                      showHeader={index === 0 || !entry.pivot}
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
            {mode === 'edit' && canEdit && (
              <footer className="tableau-card-footer">
                <div><InfoIcon /><span>Press Enter to commit a cell.</span></div>
                <span>{current.variables.length + 1} columns · {current.rows.length + 1} rows</span>
              </footer>
            )}
          </section>
        </main>
      ) : (
        <main className="history-main">
          <HistoryView
            history={history}
            currentIndex={currentIndex}
            display={display}
            includeResult={includePrintResult}
            onRestore={(index) => {
              setCurrentIndex(index);
              setSelection(null);
              if (index > 0) setMode('pivot');
            }}
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
        onClose={() => setModal(null)}
        onNotice={showNotice}
        onPrintHistory={(includeResult) => {
          const returnView = view;
          setIncludePrintResult(includeResult);
          setModal(null);
          setView('history');
          window.setTimeout(() => {
            window.addEventListener('afterprint', () => {
              setIncludePrintResult(false);
              setView(returnView);
            }, { once: true });
            window.print();
          }, 120);
        }}
      />}
      {notice && <div className="toast" role="status"><InfoIcon /><span>{notice}</span></div>}
    </div>
  );
}

function safeName(value: string): string {
  return value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-|-$/g, '') || 'tableau';
}
