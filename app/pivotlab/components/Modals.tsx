import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppSettings, ShortcutAction } from '../app/settings';
import { defaultSettings, shortcutFromEvent, shortcutLabels } from '../app/settings';
import { createTableauHistoryGraphic, tableauGraphicToPng } from '../export/tableauGraphic';
import type { NumberDisplay } from '../math/rational';
import type { Tableau } from '../model/tableau';
import { exportCsv, exportLatex, exportMarkdown, serializeProject } from '../model/project';
import type { HistoryEntry } from '../model/tableau';
import { CheckIcon, CopyIcon, GridIcon, KeyboardIcon, SaveIcon, SparkIcon, XIcon } from './Icons';
import { VariableName } from './VariableName';

interface ModalProps {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ title, eyebrow, onClose, children, wide = false }: ModalProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`modal-card${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close"><XIcon /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

interface NewProjectModalProps {
  onClose: () => void;
  onCreate: (rows: number, variables: number, title: string) => void;
  onLoadExample: () => void;
}

export function NewProjectModal({ onClose, onCreate, onLoadExample }: NewProjectModalProps) {
  const [rows, setRows] = useState(3);
  const [variables, setVariables] = useState(5);
  const [title, setTitle] = useState('Untitled tableau');
  return (
    <Modal title="New tableau" eyebrow="Start fresh" onClose={onClose}>
      <div className="modal-body">
        <button className="example-card" type="button" onClick={onLoadExample}>
          <div className="example-icon"><GridIcon /></div>
          <div><strong>Load textbook example</strong><span>Example 7.4.1 · 3 constraints · 7 variables</span></div>
          <span className="example-arrow">→</span>
        </button>
        <div className="or-divider"><span>or create a blank tableau</span></div>
        <label className="field-label">Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <div className="two-column-fields">
          <label className="field-label">Constraints<input type="number" min="1" max="200" value={rows} onChange={(event) => setRows(Number(event.target.value))} /></label>
          <label className="field-label">Variables<input type="number" min="1" max="200" value={variables} onChange={(event) => setVariables(Number(event.target.value))} /></label>
        </div>
      </div>
      <footer className="modal-footer">
        <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-button" type="button" onClick={() => onCreate(
          Math.max(1, Math.min(200, Math.trunc(rows || 1))),
          Math.max(1, Math.min(200, Math.trunc(variables || 1))),
          title.trim() || 'Untitled tableau',
        )}>Create tableau</button>
      </footer>
    </Modal>
  );
}

interface PhaseOneModalProps {
  tableau: Tableau;
  onClose: () => void;
  onStart: (rowIds: string[]) => void;
}

export function PhaseOneModal({ tableau, onClose, onStart }: PhaseOneModalProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(
    tableau.rows.filter((row) => !row.basisId).map((row) => row.id),
  ));
  const artificialNames = new Map<string, string>();
  const usedNames = new Set(tableau.variables.map((variable) => variable.name));
  let artificialCounter = 1;
  tableau.rows.forEach((row) => {
    if (!selected.has(row.id)) return;
    while (usedNames.has(`z${artificialCounter}`)) artificialCounter += 1;
    const name = `z${artificialCounter}`;
    artificialNames.set(row.id, name);
    usedNames.add(name);
    artificialCounter += 1;
  });
  return (
    <Modal title="Set up Phase I" eyebrow="Artificial variables method" onClose={onClose}>
      <div className="modal-body">
        <p className="modal-copy">Select each constraint row that needs an artificial basic variable. Existing slack-variable basis rows can remain unselected.</p>
        <div className="row-picker">
          {tableau.rows.map((row, index) => {
            const basis = tableau.variables.find((variable) => variable.id === row.basisId);
            return (
              <label key={row.id} className={`row-picker-item${selected.has(row.id) ? ' selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected.has(row.id)}
                  onChange={() => setSelected((previous) => {
                    const next = new Set(previous);
                    if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
                    return next;
                  })}
                />
                <span className="custom-checkbox"><CheckIcon /></span>
                <span><strong>Constraint {index + 1}</strong><small>Current basis: {basis ? <VariableName name={basis.name} /> : 'none'}</small></span>
                <span className="artificial-preview">{artificialNames.has(row.id)
                  ? <>Add <VariableName name={artificialNames.get(row.id)!} /> <small>artificial variable</small></>
                  : <small>No artificial variable</small>}</span>
              </label>
            );
          })}
        </div>
        <div className="info-callout"><SparkIcon /><span>Simplex Assistant adds identity columns, makes the new artificial variables basic, and constructs a canonical <strong>−w</strong> row. Every subsequent pivot is still manual.</span></div>
      </div>
      <footer className="modal-footer">
        <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-button" type="button" disabled={selected.size === 0} onClick={() => onStart([...selected])}>Start Phase I</button>
      </footer>
    </Modal>
  );
}

interface SettingsModalProps {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onChange, onClose }: SettingsModalProps) {
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const shortcutEntries = Object.entries(shortcutLabels) as Array<[ShortcutAction, string]>;
  const conflicts = useMemo(() => {
    const count = new Map<string, number>();
    Object.values(settings.shortcuts).forEach((shortcut) => count.set(shortcut, (count.get(shortcut) ?? 0) + 1));
    return new Set([...count].filter(([, value]) => value > 1).map(([key]) => key));
  }, [settings.shortcuts]);

  return (
    <Modal title="Settings" onClose={onClose} wide>
      <div className="modal-body settings-grid">
        <section className="settings-section">
          <h3>Appearance</h3>
          <label className="field-label">Theme
            <select value={settings.theme} onChange={(event) => onChange({ ...settings, theme: event.target.value as AppSettings['theme'] })}>
              <option value="system">Use system setting</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="slider-label">
            <span>Table font size <strong>{settings.tableFontSize}px</strong></span>
            <input type="range" min="12" max="30" step="1" value={settings.tableFontSize} onChange={(event) => onChange({ ...settings, tableFontSize: Number(event.target.value) })} />
          </label>
          <label className="slider-label">
            <span>Interface scale <strong>{settings.uiScale}%</strong></span>
            <input type="range" min="75" max="150" step="5" value={settings.uiScale} onChange={(event) => onChange({ ...settings, uiScale: Number(event.target.value) })} />
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={settings.showPivotHints} onChange={(event) => onChange({ ...settings, showPivotHints: event.target.checked })} />
            <span className="custom-checkbox"><CheckIcon /></span>
            <span><strong>Show pivot guidance</strong><small>Display ratio popovers, minimum markers, and eligibility messages. Primal and dual mode explanations always remain visible.</small></span>
          </label>
          <section className="about-simplex-assistant">
            <span className="eyebrow">About</span>
            <h3>Simplex Assistant 0.7.1</h3>
            <p>This manual simplex-method practice tool keeps every pivot decision yours; only zero entries are forbidden.</p>
            <p>All calculations use arbitrary-precision rational arithmetic.</p>
          </section>
        </section>
        <section className="settings-section shortcut-settings">
          <div className="section-title-row"><div><h3>Keyboard shortcuts</h3><p>Choose a command, then press the new key combination.</p></div><KeyboardIcon /></div>
          <div className="shortcut-list">
            {shortcutEntries.map(([action, label]) => {
              const shortcut = settings.shortcuts[action];
              return (
                <div key={action} className="shortcut-row">
                  <span>{label}</span>
                  <button
                    type="button"
                    className={`shortcut-recorder${recording === action ? ' recording' : ''}${conflicts.has(shortcut) ? ' conflict' : ''}`}
                    title={conflicts.has(shortcut) ? 'This shortcut is assigned more than once' : 'Click to reassign'}
                    onClick={() => setRecording(action)}
                    onKeyDown={(event) => {
                      if (recording !== action) return;
                      event.preventDefault();
                      event.stopPropagation();
                      if (event.key === 'Escape') { setRecording(null); return; }
                      const next = shortcutFromEvent(event);
                      if (!next) return;
                      onChange({ ...settings, shortcuts: { ...settings.shortcuts, [action]: next } });
                      setRecording(null);
                    }}
                  >{recording === action ? 'Press keys…' : shortcut}</button>
                </div>
              );
            })}
          </div>
          {conflicts.size > 0 && <p className="settings-warning">Duplicate shortcuts are highlighted. Only the first matching command will run.</p>}
          <button className="text-button" type="button" onClick={() => onChange(defaultSettings)}>Restore defaults</button>
        </section>
      </div>
      <footer className="modal-footer"><button className="primary-button" type="button" onClick={onClose}>Done</button></footer>
    </Modal>
  );
}

type ExportFormat = 'latex' | 'markdown' | 'csv';

interface ExportModalProps {
  tableau: Tableau;
  history: HistoryEntry[];
  currentIndex: number;
  display: NumberDisplay;
  includeResult: boolean;
  onIncludeResultChange: (include: boolean) => void;
  onClose: () => void;
  onNotice: (message: string) => void;
  onPrintHistory: (includeResult: boolean) => void;
}

export function ExportModal({
  tableau,
  history,
  currentIndex,
  display,
  includeResult,
  onIncludeResultChange,
  onClose,
  onNotice,
  onPrintHistory,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('latex');
  const [imageExporting, setImageExporting] = useState<'png' | 'transparent-png' | 'svg' | null>(null);
  const content = format === 'latex'
    ? exportLatex(tableau)
    : format === 'markdown'
      ? exportMarkdown(tableau, display)
      : exportCsv(tableau, display);
  const extension = format === 'latex' ? 'tex' : format === 'markdown' ? 'md' : 'csv';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      onNotice('Copied to clipboard.');
    } catch {
      onNotice('Clipboard access was blocked. Select and copy the text manually.');
    }
  };
  const exportImage = async (kind: 'png' | 'transparent-png' | 'svg') => {
    setImageExporting(kind);
    try {
      const transparent = kind === 'transparent-png';
      const graphic = createTableauHistoryGraphic(history, currentIndex, display, { transparent, includeResult });
      if (kind === 'svg') {
        downloadBlob(`${safeName(tableau.title)}-solution-history.svg`, new Blob(
          [graphic.svg],
          { type: 'image/svg+xml;charset=utf-8' },
        ));
      } else {
        const png = await tableauGraphicToPng(graphic);
        downloadBlob(
          `${safeName(tableau.title)}-solution-history${transparent ? '-no-background' : ''}.png`,
          png,
        );
      }
      onNotice(`${kind === 'svg' ? 'SVG' : transparent ? 'No-background PNG' : 'PNG'} exported.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'The image could not be exported.');
    } finally {
      setImageExporting(null);
    }
  };
  return (
    <Modal title="Export solution" onClose={onClose} wide>
      <div className="modal-body export-layout">
        <div className="export-options">
          <div className="format-tabs" role="tablist">
            {(['latex', 'markdown', 'csv'] as const).map((candidate) => (
              <button key={candidate} type="button" className={format === candidate ? 'active' : ''} onClick={() => setFormat(candidate)}>{candidate === 'latex' ? 'LaTeX' : candidate === 'markdown' ? 'Markdown' : 'CSV'}</button>
            ))}
          </div>
          <textarea className="export-preview" readOnly value={content} aria-label="Export preview" onFocus={(event) => event.currentTarget.select()} />
          <div className="button-row">
            <button className="primary-button" type="button" onClick={copy}><CopyIcon /> Copy</button>
            <button className="secondary-button" type="button" onClick={() => downloadText(`${safeName(tableau.title)}.${extension}`, content)}><SaveIcon /> Download</button>
          </div>
        </div>
        <div className="export-actions-panel">
          <label className="export-result-toggle">
            <input type="checkbox" checked={includeResult} onChange={(event) => onIncludeResultChange(event.target.checked)} />
            <span className="custom-checkbox"><CheckIcon /></span>
            <span><strong>Include final result</strong><small>Append f<sub>min</sub> and the decision-variable point to PDF, PNG, and SVG.</small></span>
          </label>
          <div className="export-action-card"><strong>Complete solution PDF</strong><span>Print the complete Simplex Method Tableau with the current number display and marked pivots, or save it as PDF from your browser’s print dialog.</span><button className="secondary-button" type="button" onClick={() => onPrintHistory(includeResult)}>Print / PDF</button></div>
          <div className="export-action-card">
            <strong>Complete solution image</strong>
            <span>Export the complete Simplex Method Tableau with the current number display and marked pivots as PNG or SVG.</span>
            <div className="image-export-buttons">
              <button className="secondary-button" type="button" disabled={imageExporting !== null} onClick={() => void exportImage('png')}>{imageExporting === 'png' ? 'Creating…' : 'PNG'}</button>
              <button className="secondary-button" type="button" disabled={imageExporting !== null} onClick={() => void exportImage('transparent-png')}>{imageExporting === 'transparent-png' ? 'Creating…' : 'PNG · no background'}</button>
              <button className="secondary-button" type="button" disabled={imageExporting !== null} onClick={() => void exportImage('svg')}>{imageExporting === 'svg' ? 'Creating…' : 'SVG'}</button>
            </div>
          </div>
          <div className="export-action-card"><strong>Editable Simplex Assistant project</strong><span>Preserves exact fractions, Phase I state, and every tableau in the history.</span><button className="secondary-button" type="button" onClick={() => downloadText(`${safeName(tableau.title)}.simplex-assistant.json`, serializeProject(history, currentIndex))}>Save project</button></div>
        </div>
      </div>
    </Modal>
  );
}

export function downloadText(filename: string, content: string) {
  downloadBlob(filename, new Blob([content], { type: 'text/plain;charset=utf-8' }));
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function safeName(value: string): string {
  return value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-|-$/g, '') || 'tableau';
}
