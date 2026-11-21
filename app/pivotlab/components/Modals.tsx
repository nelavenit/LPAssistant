import { useLanguage } from '../app/languageContext';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { errorText, safeFilename, tableauTitle } from '../app/i18n';
import type { AppSettings, ShortcutAction } from '../app/settings';
import { defaultSettings, shortcutFromEvent, shortcutLabels } from '../app/settings';
import type { NumberDisplay } from '../math/rational';
import { phaseOneSuggestedRows, type Tableau } from '../model/tableau';
import {
  exportCsvProject,
  exportLatexProject,
  exportMarkdownProject,
  serializeProject,
} from '../model/project';
import type { HistoryEntry } from '../model/tableau';
import { CheckIcon, CopyIcon, GridIcon, KeyboardIcon, SaveIcon, SparkIcon, XIcon } from './Icons';
import { VariableName } from './VariableName';

interface ModalProps {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  notice?: string | null;
}

export function Modal({ title, eyebrow, onClose, children, wide = false, notice }: ModalProps) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} className="modal-backdrop" aria-label={title} onCancel={(event) => {
      event.preventDefault();
      onClose();
    }} onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`modal-card${wide ? ' modal-wide' : ''}`}>
        <header className="modal-header">
          <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t('Close')}><XIcon /></button>
        </header>
        {children}
        {notice && <p className="modal-feedback" role="status">{notice}</p>}
      </section>
    </dialog>
  );
}

interface NewProjectModalProps {
  onClose: () => void;
  onCreate: (rows: number, variables: number, title: string) => void;
  onLoadExample: () => void;
}

export function NewProjectModal({ onClose, onCreate, onLoadExample }: NewProjectModalProps) {
  const { t } = useLanguage();
  const [rows, setRows] = useState(3);
  const [variables, setVariables] = useState(5);
  const [title, setTitle] = useState('');
  return (
    <Modal title={t('New tableau')} onClose={onClose}>
      <div className="modal-body">
        <button className="example-card" type="button" onClick={onLoadExample}>
          <div className="example-icon"><GridIcon /></div>
          <div><strong>{t('Load textbook example')}</strong><span>{t('Example 7.4.1 · 3 constraints · 7 variables')}</span></div>
        </button>
        <div className="or-divider"><span>{t('or create a blank tableau')}</span></div>
        <label className="field-label">{t('Title')}<input value={title} placeholder={t('Untitled tableau')} onChange={(event) => setTitle(event.target.value)} /></label>
        <div className="two-column-fields">
          <label className="field-label">{t('Constraints')}<input type="number" min="1" max="200" value={rows} onChange={(event) => setRows(Number(event.target.value))} /></label>
          <label className="field-label">{t('Variables')}<input type="number" min="1" max="200" value={variables} onChange={(event) => setVariables(Number(event.target.value))} /></label>
        </div>
      </div>
      <footer className="modal-footer">
        <button className="secondary-button" type="button" onClick={onClose}>{t('Cancel')}</button>
        <button className="primary-button" type="button" onClick={() => onCreate(
          Math.max(1, Math.min(200, Math.trunc(rows || 1))),
          Math.max(1, Math.min(200, Math.trunc(variables || 1))),
          title.trim() || 'Untitled tableau',
        )}>{t('Create tableau')}</button>
      </footer>
    </Modal>
  );
}

interface PhaseOneModalProps {
  tableau: Tableau;
  autoSolve: boolean;
  onClose: () => void;
  onStart: (rowIds: string[]) => void;
  notice: string | null;
}

export function PhaseOneModal({ tableau, autoSolve, onClose, onStart, notice }: PhaseOneModalProps) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(phaseOneSuggestedRows(tableau)));
  const hasArtificialVariables = tableau.variables.some((variable) => variable.kind === 'artificial');
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
    <Modal title={t('Set up Phase I')} eyebrow={t('Artificial variables method')} onClose={onClose} notice={notice}>
      <div className="modal-body">
        <p className="modal-copy">{t('Select each constraint row that needs an artificial basic variable. Existing slack-variable basis rows can remain unselected.')}</p>
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
                <span><strong>{t('Constraint {row}', { row: index + 1 })}</strong><small>{t('Current basis:')} {basis ? <VariableName name={basis.name} /> : t('none')}</small></span>
                <span className="artificial-preview">{artificialNames.has(row.id)
                  ? <>{t('Add {variable}', { variable: artificialNames.get(row.id)! })} <small>{t('artificial variable')}</small></>
                  : <small>{t('No artificial variable')}</small>}</span>
              </label>
            );
          })}
        </div>
        <div className="info-callout"><SparkIcon /><span>{t(autoSolve
          ? 'Auto-solve builds the Phase I tableau from these rows and runs both phases when feasible.'
          : 'Simplex Assistant adds identity columns, makes the new artificial variables basic, and constructs a canonical −w row. Every subsequent pivot is still manual.')} {t('Rows with negative free terms are multiplied by −1 before adding artificial variables.')}</span></div>
      </div>
      <footer className="modal-footer">
        <button className="secondary-button" type="button" onClick={onClose}>{t('Cancel')}</button>
        <button className="primary-button" type="button" disabled={selected.size === 0 && !hasArtificialVariables} onClick={() => onStart([...selected])}>{t(autoSolve ? 'Start Phase I and solve' : 'Start Phase I')}</button>
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
  const { t } = useLanguage();
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const shortcutEntries = Object.entries(shortcutLabels) as Array<[ShortcutAction, string]>;
  const conflicts = useMemo(() => {
    const count = new Map<string, number>();
    Object.values(settings.shortcuts).forEach((shortcut) => count.set(shortcut, (count.get(shortcut) ?? 0) + 1));
    return new Set([...count].filter(([, value]) => value > 1).map(([key]) => key));
  }, [settings.shortcuts]);

  return (
    <Modal title={t('Settings')} onClose={onClose} wide>
      <div className="modal-body settings-grid">
        <section className="settings-section">
          <h3>{t('Appearance')}</h3>
          <label className="field-label">{t('Language')}
            <select value={settings.language} onChange={(event) => onChange({ ...settings, language: event.target.value as AppSettings['language'] })}>
              <option value="system">{t('Use browser language')}</option>
              <option value="ru" lang="ru">Русский</option>
              <option value="en" lang="en">English</option>
            </select>
          </label>
          <label className="field-label">{t('Theme')}
            <select value={settings.theme} onChange={(event) => onChange({ ...settings, theme: event.target.value as AppSettings['theme'] })}>
              <option value="system">{t('Use system setting')}</option>
              <option value="light">{t('Light')}</option>
              <option value="dark">{t('Dark')}</option>
            </select>
          </label>
          <label className="slider-label">
            <span>{t('Table font size')} <strong>{settings.tableFontSize}px</strong></span>
            <input type="range" min="12" max="30" step="1" value={settings.tableFontSize} onChange={(event) => onChange({ ...settings, tableFontSize: Number(event.target.value) })} />
          </label>
          <label className="slider-label">
            <span>{t('Interface scale')} <strong>{settings.uiScale}%</strong></span>
            <input type="range" min="75" max="150" step="5" value={settings.uiScale} onChange={(event) => onChange({ ...settings, uiScale: Number(event.target.value) })} />
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={settings.showPivotHints} onChange={(event) => onChange({ ...settings, showPivotHints: event.target.checked })} />
            <span className="custom-checkbox"><CheckIcon /></span>
            <span><strong>{t('Show pivot guidance')}</strong><small>{t('Display ratio popovers, minimum markers, and eligibility messages. Primal and dual mode explanations always remain visible.')}</small></span>
          </label>
          <button className="text-button settings-reset" type="button" onClick={() => onChange({
            ...defaultSettings,
            language: settings.language,
            shortcuts: settings.shortcuts,
          })}>{t('Restore appearance defaults')}</button>
          <section className="about-simplex-assistant">
            <span className="eyebrow">{t('About')}</span>
            <h3>Simplex Assistant 0.10.0</h3>
            <p>{t('Choose each pivot in Pivot mode or solve a prepared tableau in Auto-solve mode.')}</p>
            <p>{t('All calculations use arbitrary-precision rational arithmetic.')}</p>
          </section>
        </section>
        <section className="settings-section shortcut-settings">
          <div className="section-title-row"><div><h3>{t('Keyboard shortcuts')}</h3><p>{t('Choose a command, then press the new key combination.')}</p></div><KeyboardIcon /></div>
          <div className="shortcut-list">
            {shortcutEntries.map(([action, label]) => {
              const shortcut = settings.shortcuts[action];
              return (
                <div key={action} className="shortcut-row">
                  <span>{t(label)}</span>
                  <button
                    type="button"
                    className={`shortcut-recorder${recording === action ? ' recording' : ''}${conflicts.has(shortcut) ? ' conflict' : ''}`}
                    title={t(conflicts.has(shortcut) ? 'This shortcut is assigned more than once' : 'Click to reassign')}
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
                  >{recording === action ? t('Press keys…') : shortcut}</button>
                </div>
              );
            })}
          </div>
          {conflicts.size > 0 && <p className="settings-warning">{t('Duplicate shortcuts are highlighted. Only the first matching command will run.')}</p>}
          <button className="text-button settings-reset" type="button" onClick={() => onChange({
            ...settings,
            shortcuts: { ...defaultSettings.shortcuts },
          })}>{t('Restore shortcut defaults')}</button>
        </section>
      </div>
      <footer className="modal-footer"><button className="primary-button" type="button" onClick={onClose}>{t('Done')}</button></footer>
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
  includeSolution: boolean;
  onIncludeSolutionChange: (include: boolean) => void;
  onClose: () => void;
  onNotice: (message: string) => void;
  notice: string | null;
  onPrintHistory: (includeResult: boolean, includeSolution: boolean) => void;
}

export function ExportModal({
  tableau,
  history,
  currentIndex,
  display,
  includeResult,
  onIncludeResultChange,
  includeSolution,
  onIncludeSolutionChange,
  onClose,
  onNotice,
  notice,
  onPrintHistory,
}: ExportModalProps) {
  const { language, t } = useLanguage();
  const [format, setFormat] = useState<ExportFormat>('latex');
  const [imageExporting, setImageExporting] = useState<'png' | 'transparent-png' | 'svg' | null>(null);
  const exportOptions = { completeSolution: includeSolution, includeResult, language };
  const filename = safeFilename(tableauTitle(t, tableau.title));
  const content = format === 'latex'
    ? exportLatexProject(history, currentIndex, display, exportOptions)
    : format === 'markdown'
      ? exportMarkdownProject(history, currentIndex, display, exportOptions)
      : exportCsvProject(history, currentIndex, display, exportOptions);
  const extension = format === 'latex' ? 'tex' : format === 'markdown' ? 'md' : 'csv';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      onNotice(t('Copied to clipboard.'));
    } catch {
      onNotice(t('Clipboard access was blocked. Select and copy the text manually.'));
    }
  };
  const exportImage = async (kind: 'png' | 'transparent-png' | 'svg') => {
    setImageExporting(kind);
    try {
      const { createTableauHistoryGraphic, tableauGraphicToPng } = await import('../export/tableauGraphic');
      const transparent = kind === 'transparent-png';
      const graphic = createTableauHistoryGraphic(history, currentIndex, display, {
        transparent,
        includeResult,
        completeSolution: includeSolution,
        resultTableau: tableau,
        language,
      });
      const scopeName = includeSolution ? 'complete-solution' : 'initial-problem';
      if (kind === 'svg') {
        downloadBlob(`${filename}-${scopeName}.svg`, new Blob(
          [graphic.svg],
          { type: 'image/svg+xml;charset=utf-8' },
        ));
      } else {
        const png = await tableauGraphicToPng(graphic);
        downloadBlob(
          `${filename}-${scopeName}${transparent ? '-no-background' : ''}.png`,
          png,
        );
      }
      onNotice(t('{format} exported.', { format: kind === 'svg' ? 'SVG' : transparent ? t('PNG · no background') : 'PNG' }));
    } catch (error) {
      onNotice(errorText(t, error, 'The image could not be exported.'));
    } finally {
      setImageExporting(null);
    }
  };
  return (
    <Modal title={t('Export')} onClose={onClose} wide notice={notice}>
      <div className="modal-body export-layout">
        <div className="export-options">
          <div className="format-tabs">
            {(['latex', 'markdown', 'csv'] as const).map((candidate) => (
              <button key={candidate} type="button" aria-pressed={format === candidate} className={format === candidate ? 'active' : ''} onClick={() => setFormat(candidate)}>{candidate === 'latex' ? 'LaTeX' : candidate === 'markdown' ? 'Markdown' : 'CSV'}</button>
            ))}
          </div>
          <textarea className="export-preview" readOnly value={content} aria-label={t('Export preview')} onFocus={(event) => event.currentTarget.select()} />
          <div className="button-row">
            <button className="primary-button" type="button" onClick={copy}><CopyIcon /> {t('Copy')}</button>
            <button className="secondary-button" type="button" onClick={() => downloadText(`${filename}.${extension}`, content)}><SaveIcon /> {t('Download')}</button>
          </div>
        </div>
        <div className="export-actions-panel">
          <label className="export-result-toggle">
            <input type="checkbox" checked={includeSolution} onChange={(event) => onIncludeSolutionChange(event.target.checked)} />
            <span className="custom-checkbox"><CheckIcon /></span>
            <span><strong>{t('Export complete solution')}</strong><small>{t('Include every tableau through the current step. Turn this off to export only the initial problem.')}</small></span>
          </label>
          <label className="export-result-toggle">
            <input type="checkbox" checked={includeResult} onChange={(event) => onIncludeResultChange(event.target.checked)} />
            <span className="custom-checkbox"><CheckIcon /></span>
            <span><strong>{t('Include current result')}</strong><small>{t('Include the current objective value and decision-variable values when the tableau gives a feasible basis.')}</small></span>
          </label>
          <div className="export-action-card"><strong>{t(includeSolution ? 'Complete solution PDF' : 'Initial problem PDF')}</strong><span>{t('Use your browser’s print dialog to print the selected tableaux or save them as a PDF.')}</span><button className="secondary-button" type="button" onClick={() => onPrintHistory(includeResult, includeSolution)}>{t('Print / PDF')}</button></div>
          <div className="export-action-card">
            <strong>{t(includeSolution ? 'Complete solution image' : 'Initial problem image')}</strong>
            <span>{t('Export the selected tableaux in the current number format.')}</span>
            <div className="image-export-buttons">
              <button className="secondary-button" type="button" disabled={imageExporting !== null} onClick={() => void exportImage('png')}>{imageExporting === 'png' ? t('Creating…') : 'PNG'}</button>
              <button className="secondary-button" type="button" disabled={imageExporting !== null} onClick={() => void exportImage('transparent-png')}>{imageExporting === 'transparent-png' ? t('Creating…') : t('PNG · no background')}</button>
              <button className="secondary-button" type="button" disabled={imageExporting !== null} onClick={() => void exportImage('svg')}>{imageExporting === 'svg' ? t('Creating…') : 'SVG'}</button>
            </div>
          </div>
          <div className="export-action-card"><strong>{t('Editable Simplex Assistant project')}</strong><span>{t(includeSolution ? 'Preserves the complete solution, exact values, and Phase I state.' : 'Saves only the editable initial problem with exact values.')}</span><button className="secondary-button" type="button" onClick={() => downloadText(`${filename}.simplex-assistant.json`, includeSolution ? serializeProject(history, currentIndex) : serializeProject(history.slice(0, 1), 0))}>{t('Save project')}</button></div>
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
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
