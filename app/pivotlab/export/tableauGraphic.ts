import type { NumberDisplay } from '../math/rational';
import { formatRational, type Rational } from '../math/rational';
import { getSolutionResult, type SolutionResult } from '../model/result';
import { groupTableauStages } from '../model/stages';
import type { HistoryEntry, PivotRecord, Tableau } from '../model/tableau';

const BASIS_WIDTH = 112;
const VALUE_WIDTH = 132;
const RHS_WIDTH = 112;
const HEADER_HEIGHT = 52;
const ROW_HEIGHT = 68;
const STEP_SEPARATOR = 2;
const STAGE_LABEL_HEIGHT = 40;
const STAGE_GAP = 22;
const RESULT_HEIGHT = 72;
const INK = '#111111';
const GRID = '#64756d';

export interface TableauGraphic {
  svg: string;
  width: number;
  height: number;
}

interface GraphicOptions {
  transparent?: boolean;
  includeResult?: boolean;
  completeSolution?: boolean;
  resultTableau?: Tableau;
}

interface GraphicStep {
  tableau: Tableau;
  showHeader: boolean;
  pivotMark?: PivotRecord;
}

interface GraphicStage {
  label: string | null;
  steps: GraphicStep[];
}

export function createTableauGraphic(
  tableau: Tableau,
  display: NumberDisplay,
  options: GraphicOptions = {},
): TableauGraphic {
  return createGraphic(
    [{ label: null, steps: [{ tableau, showHeader: true }] }],
    display,
    options,
    `${tableau.title}: tableau`,
  );
}

export function createTableauHistoryGraphic(
  history: HistoryEntry[],
  currentIndex: number,
  display: NumberDisplay,
  options: GraphicOptions = {},
): TableauGraphic {
  const completeSolution = options.completeSolution ?? true;
  const entries = completeSolution
    ? history.slice(0, Math.max(0, currentIndex) + 1)
    : history.slice(0, 1);
  if (entries.length === 0) throw new Error('There are no tableaux to export.');
  const stages = groupTableauStages(entries, entries.length - 1).map((stage): GraphicStage => ({
    label: stage.label,
    steps: stage.entries.map(({ entry, index }, stageIndex): GraphicStep => ({
      tableau: entry.tableau,
      showHeader: stageIndex === 0,
      pivotMark: entries[index + 1]?.pivot,
    })),
  }));
  return createGraphic(
    stages,
    display,
    options,
    `${entries[0].tableau.title}: ${completeSolution ? 'complete solution' : 'initial problem'}`,
  );
}

function createGraphic(
  stages: GraphicStage[],
  display: NumberDisplay,
  options: GraphicOptions,
  title: string,
): TableauGraphic {
  const layouts = stages.map((stage) => {
    const steps = stage.steps.map((step) => ({
      ...step,
      width: tableWidth(step.tableau),
      height: tableHeight(step.tableau, step.showHeader),
    }));
    return {
      ...stage,
      steps,
      width: Math.max(...steps.map((step) => step.width)),
      height: (stage.label ? STAGE_LABEL_HEIGHT : 0)
        + steps.reduce((sum, step) => sum + step.height, 0)
        + Math.max(0, steps.length - 1) * STEP_SEPARATOR,
    };
  });
  const transparent = options.transparent ?? false;
  const finalLayout = layouts[layouts.length - 1];
  const finalTableau = options.resultTableau ?? finalLayout.steps[finalLayout.steps.length - 1].tableau;
  const result = options.includeResult ? getSolutionResult(finalTableau) : null;
  const resultText = result ? plainResultText(result, display) : null;
  const resultWidth = resultText ? resultText.length * 10 + 56 : 0;
  const width = Math.max(resultWidth, ...layouts.map((layout) => layout.width));
  const tableausHeight = layouts.reduce((sum, layout) => sum + layout.height, 0)
    + Math.max(0, layouts.length - 1) * STAGE_GAP;
  const height = tableausHeight + (resultText ? RESULT_HEIGHT : 0);
  const parts: string[] = [];

  if (!transparent) {
    parts.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);
  }

  let y = 0;
  layouts.forEach((stage, stageIndex) => {
    if (stageIndex > 0) y += STAGE_GAP;
    if (stage.label) {
      if (!transparent) parts.push(`<rect x="0" y="${y}" width="${stage.width}" height="${STAGE_LABEL_HEIGHT}" fill="#f2f6f4"/>`);
      parts.push(`<text x="14" y="${y + STAGE_LABEL_HEIGHT / 2}" text-anchor="start" dominant-baseline="middle" ${textPaint()} font-size="14" font-weight="700">${escapeXml(stage.label)}</text>`);
      y += STAGE_LABEL_HEIGHT;
    }
    stage.steps.forEach((layout, stepIndex) => {
      if (stepIndex > 0) {
        parts.push(`<rect x="0" y="${y}" width="${layout.width}" height="${STEP_SEPARATOR}" fill="${GRID}"/>`);
        y += STEP_SEPARATOR;
      }
      parts.push(...renderTableau(
        layout.tableau,
        display,
        y,
        layout.showHeader,
        layout.pivotMark,
        stepIndex === 0,
        transparent,
      ));
      y += layout.height;
    });
  });

  if (result) {
    if (!transparent) parts.push(`<rect x="0" y="${tableausHeight}" width="${width}" height="${RESULT_HEIGHT}" fill="#f2f6f4"/>`);
    parts.push(renderResultEquation(result, display, width, tableausHeight + RESULT_HEIGHT / 2 + 1));
    parts.push(`<rect x="1" y="${tableausHeight + 1}" width="${width - 2}" height="${RESULT_HEIGHT - 2}" fill="none" stroke="${GRID}" stroke-width="2"/>`);
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<title>${escapeXml(title)}</title>`,
    '<desc>Complete Simplex Method Tableau exported from Simplex Assistant.</desc>',
    `<g font-family="Segoe UI, Arial, sans-serif">${parts.join('')}</g>`,
    '</svg>',
  ].join('');

  return { svg, width, height };
}

function renderTableau(
  tableau: Tableau,
  display: NumberDisplay,
  top: number,
  showHeader: boolean,
  pivotMark: PivotRecord | undefined,
  drawTopEdge: boolean,
  transparent: boolean,
): string[] {
  const width = tableWidth(tableau);
  const height = tableHeight(tableau, showHeader);
  const dataTop = top + (showHeader ? HEADER_HEIGHT : 0);
  const rhsX = BASIS_WIDTH + tableau.variables.length * VALUE_WIDTH;
  const objectiveY = dataTop + tableau.rows.length * ROW_HEIGHT;
  const parts: string[] = [];

  if (showHeader) {
    if (!transparent) parts.push(`<rect x="0" y="${top}" width="${width}" height="${HEADER_HEIGHT}" fill="#f2f6f4"/>`);
    parts.push(textLabel('Basis', BASIS_WIDTH / 2, top + HEADER_HEIGHT / 2, true, 15));
    tableau.variables.forEach((variable, index) => {
      parts.push(variableLabel(
        variable.name,
        BASIS_WIDTH + index * VALUE_WIDTH + VALUE_WIDTH / 2,
        top + HEADER_HEIGHT / 2,
        false,
      ));
    });
    parts.push(textLabel('RHS', rhsX + RHS_WIDTH / 2, top + HEADER_HEIGHT / 2, true, 15));
  }
  if (!transparent) parts.push(`<rect x="0" y="${objectiveY}" width="${width}" height="${ROW_HEIGHT}" fill="#edf7f1"/>`);

  tableau.rows.forEach((row, rowIndex) => {
    const centerY = dataTop + rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
    const basis = tableau.variables.find((variable) => variable.id === row.basisId)?.name ?? '—';
    parts.push(variableLabel(basis, BASIS_WIDTH / 2, centerY, true));
    row.values.slice(0, tableau.variables.length).forEach((value, columnIndex) => {
      parts.push(numberLabel(value, display, BASIS_WIDTH + columnIndex * VALUE_WIDTH + VALUE_WIDTH / 2, centerY, false));
    });
    parts.push(numberLabel(row.values[tableau.variables.length], display, rhsX + RHS_WIDTH / 2, centerY, true));
  });

  const objectiveCenterY = objectiveY + ROW_HEIGHT / 2;
  parts.push(variableLabel(tableau.objectiveName, BASIS_WIDTH / 2, objectiveCenterY, true));
  tableau.objective.slice(0, tableau.variables.length).forEach((value, columnIndex) => {
    parts.push(numberLabel(value, display, BASIS_WIDTH + columnIndex * VALUE_WIDTH + VALUE_WIDTH / 2, objectiveCenterY, true));
  });
  parts.push(numberLabel(tableau.objective[tableau.variables.length], display, rhsX + RHS_WIDTH / 2, objectiveCenterY, true));

  const verticals = [0, BASIS_WIDTH];
  for (let index = 1; index <= tableau.variables.length; index += 1) {
    verticals.push(BASIS_WIDTH + index * VALUE_WIDTH);
  }
  verticals.push(width);
  verticals.forEach((x) => {
    const strong = x === BASIS_WIDTH || x === rhsX;
    parts.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${top + height}" stroke="${GRID}" stroke-width="${strong ? 2 : 1}"/>`);
  });

  if (drawTopEdge) parts.push(`<line x1="0" y1="${top}" x2="${width}" y2="${top}" stroke="${GRID}"/>`);
  if (showHeader) parts.push(`<line x1="0" y1="${dataTop}" x2="${width}" y2="${dataTop}" stroke="${GRID}"/>`);
  for (let index = 1; index <= tableau.rows.length; index += 1) {
    const rowEdge = dataTop + index * ROW_HEIGHT;
    parts.push(`<line x1="0" y1="${rowEdge}" x2="${width}" y2="${rowEdge}" stroke="${GRID}" stroke-width="${index === tableau.rows.length ? 2 : 1}"/>`);
  }
  parts.push(`<line x1="0" y1="${top + height}" x2="${width}" y2="${top + height}" stroke="${GRID}"/>`);

  if (pivotMark) {
    const rowIndex = tableau.rows.findIndex((row) => row.id === pivotMark.rowId);
    const columnIndex = tableau.variables.findIndex((variable) => variable.id === pivotMark.variableId);
    if (rowIndex >= 0 && columnIndex >= 0) {
      const centerX = BASIS_WIDTH + columnIndex * VALUE_WIDTH + VALUE_WIDTH / 2;
      const centerY = dataTop + rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      parts.push(`<ellipse cx="${centerX}" cy="${centerY}" rx="${VALUE_WIDTH * .39}" ry="${ROW_HEIGHT * .31}" fill="none" stroke="#d98520" stroke-width="3" transform="rotate(-5 ${centerX} ${centerY})"/>`);
    }
  }

  return parts;
}

export async function tableauGraphicToPng(graphic: TableauGraphic): Promise<Blob> {
  const source = new Blob([graphic.svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The tableau image could not be rendered.'));
      image.src = url;
    });

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = graphic.width * scale;
    canvas.height = graphic.height * scale;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas export is unavailable in this browser.');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, graphic.width, graphic.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('The PNG file could not be created.'));
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function numberLabel(
  value: Rational,
  display: NumberDisplay,
  x: number,
  y: number,
  bold = false,
): string {
  if (display.mode === 'decimal' || value.denominator === 1n) {
    return signedTextLabel(formatRational(value, display), x, y, bold, 18);
  }

  const negative = value.numerator < 0n;
  const numerator = `${negative ? -value.numerator : value.numerator}`;
  const denominator = value.denominator.toString();
  const lineWidth = Math.max(numerator.length, denominator.length) * 8 + 8;
  const signWidth = 8;
  const signGap = 5;
  const fractionX = x;
  const signRight = fractionX - lineWidth / 2 - signGap;
  const weight = bold ? 700 : 500;
  return [
    negative ? `<line x1="${signRight - signWidth}" y1="${y}" x2="${signRight}" y2="${y}" stroke="${INK}" stroke-opacity="1" stroke-width="1.2"/>` : '',
    `<text x="${fractionX}" y="${y - 9}" text-anchor="middle" dominant-baseline="middle" ${textPaint()} font-size="14" font-weight="${weight}">${escapeXml(numerator)}</text>`,
    `<line x1="${fractionX - lineWidth / 2}" y1="${y}" x2="${fractionX + lineWidth / 2}" y2="${y}" stroke="${INK}" stroke-opacity="1" stroke-width="1.2"/>`,
    `<text x="${fractionX}" y="${y + 12}" text-anchor="middle" dominant-baseline="middle" ${textPaint()} font-size="14" font-weight="${weight}">${escapeXml(denominator)}</text>`,
  ].join('');
}

function variableLabel(value: string, x: number, y: number, bold = false): string {
  const match = /^(.*?)(\d+)$/.exec(value);
  const weight = bold ? 700 : 600;
  if (!match) return textLabel(value, x, y, bold, 16);
  return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" ${textPaint()} font-size="16" font-weight="${weight}">${escapeXml(match[1])}<tspan baseline-shift="sub" font-size="11">${escapeXml(match[2])}</tspan></text>`;
}

function textLabel(value: string, x: number, y: number, bold = false, size = 15): string {
  return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" ${textPaint()} font-size="${size}" font-weight="${bold ? 700 : 500}">${escapeXml(value)}</text>`;
}

function signedTextLabel(value: string, x: number, y: number, bold = false, size = 15): string {
  if (!value.startsWith('-')) return textLabel(value, x, y, bold, size);
  const magnitude = value.slice(1);
  const estimatedMagnitudeWidth = Math.max(size * .55, magnitude.length * size * .56);
  const signRight = x - estimatedMagnitudeWidth / 2 - size * .1;
  const signWidth = size * .42;
  // Exported integers use the same centred rule as exported fractions. A
  // text-glyph minus has font-dependent bearings and no guaranteed relation to
  // the fraction bar, which recreates the UI alignment bug in SVG/PNG output.
  return [
    `<line x1="${signRight - signWidth}" y1="${y}" x2="${signRight}" y2="${y}" stroke="${INK}" stroke-opacity="1" stroke-width="1.2"/>`,
    textLabel(magnitude, x, y, bold, size),
  ].join('');
}

function textPaint(): string {
  return `fill="${INK}" fill-opacity="1"`;
}

function plainResultText(result: SolutionResult, display: NumberDisplay): string {
  const point = result.values.map(({ value }) => formatRational(value, display)).join(', ');
  return `${result.objectiveName}_min = ${formatRational(result.objectiveValue, display)} at (${point})`;
}

function renderResultEquation(result: SolutionResult, display: NumberDisplay, width: number, y: number): string {
  const base = result.objectiveName;
  const suffix = ` = ${formatRational(result.objectiveValue, display).replace('-', '−')} at (${result.values
    .map(({ value }) => formatRational(value, display).replace('-', '−'))
    .join(', ')})`;
  const baseWidth = Math.max(12, base.length * 12);
  const indexWidth = 20;
  const suffixWidth = Math.max(24, suffix.length * 10.3);
  const gap = 7;
  const totalWidth = baseWidth + indexWidth + gap + suffixWidth;
  const startX = width / 2 - totalWidth / 2;
  return [
    `<text x="${startX}" y="${y}" text-anchor="start" dominant-baseline="middle" ${textPaint()} font-size="20" font-weight="700">${escapeXml(base)}</text>`,
    `<text x="${startX + baseWidth}" y="${y + 7}" text-anchor="start" dominant-baseline="middle" ${textPaint()} font-size="12" font-weight="700">min</text>`,
    `<text x="${startX + baseWidth + indexWidth + gap}" y="${y}" text-anchor="start" dominant-baseline="middle" ${textPaint()} font-size="20" font-weight="700">${escapeXml(suffix)}</text>`,
  ].join('');
}

function tableWidth(tableau: Tableau): number {
  return BASIS_WIDTH + tableau.variables.length * VALUE_WIDTH + RHS_WIDTH;
}

function tableHeight(tableau: Tableau, showHeader: boolean): number {
  return (showHeader ? HEADER_HEIGHT : 0) + (tableau.rows.length + 1) * ROW_HEIGHT;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
