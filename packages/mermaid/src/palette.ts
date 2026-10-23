import type { MermaidSemanticTheme, MermaidSeriesColor } from './types.js';

/*
 * Categorical series for charts and diagrams that color many parts apart (pie, Gantt, git graph,
 * journey, mindmap, radar, xychart, venn). Each entry has three tones generated in OKLCH:
 *   mark   a mid tone for slices, bars, lines and branches (3:1 against the canvas, readable text on it),
 *   fill   a quiet tone for blocks that carry their own text,
 *   border the edge tone of a fill block.
 * Hue order puts blue and teal first, then amber and violet, so neighbours never read alike.
 * Mermaid's base theme would derive these from the primary color, which leaves every part navy.
 */
function series(fill: string, border: string, mark: string): MermaidSeriesColor {
  return { fill, border, mark };
}

export const DEFAULT_LIGHT_SERIES: readonly MermaidSeriesColor[] = [
  series('#dce9ff', '#335aa6', '#5889e6'),
  series('#cbf1eb', '#006d64', '#02a295'),
  series('#f8e5cb', '#7f5400', '#bb7e00'),
  series('#eee2fe', '#6f4797', '#a272d4'),
  series('#ffdfe1', '#98374a', '#d76074'),
  series('#d7f0d9', '#13702f', '#3da454'),
  series('#ffe1d3', '#97400d', '#d46a34'),
  series('#cdeefc', '#006884', '#089ac3'),
  series('#fbdef0', '#8b3b74', '#c664a8'),
  series('#e9ebcc', '#626202', '#929300'),
  series('#e5e5ff', '#584fa3', '#847ce2'),
  series('#caf0f5', '#006b74', '#0d9eab'),
];

export const DEFAULT_DARK_SERIES: readonly MermaidSeriesColor[] = [
  series('#1d2d4c', '#7ba4f0', '#77a4f6'),
  series('#003631', '#26bdae', '#0bbeaf'),
  series('#3f2903', '#d09945', '#d49838'),
  series('#352546', '#b691e1', '#b88fe6'),
  series('#472026', '#e58491', '#ea808f'),
  series('#16361c', '#6db979', '#67bb75'),
  series('#462312', '#e28b63', '#e7885d'),
  series('#003344', '#39b4dd', '#22b5e1'),
  series('#412137', '#d686bc', '#da83be'),
  series('#303006', '#a9ab4a', '#aaab3f'),
  series('#2b294b', '#9d99ed', '#9d98f2'),
  series('#00353a', '#17bac8', '#0ebac9'),
];

export const ARCHIFY_LIGHT_SERIES: readonly MermaidSeriesColor[] = [
  series('#d4f6fa', '#06717a', '#0698a4'),
  series('#dbf6e7', '#04764c', '#019f68'),
  series('#fdecd5', '#865900', '#b37901'),
  series('#efebff', '#6953a0', '#8d73d1'),
  series('#ffe8e9', '#9b424d', '#cc5e6b'),
  series('#e4f0ff', '#2e64a6', '#4687d8'),
  series('#e7f4db', '#4c701a', '#699630'),
  series('#ffe9e0', '#994920', '#c96736'),
  series('#ffe6f6', '#8f4478', '#bc61a0'),
  series('#d6f7f1', '#00736a', '#0d9b8f'),
  series('#eaeeff', '#505ba7', '#6f7dd9'),
  series('#f4f0d5', '#716400', '#998702'),
];

export const ARCHIFY_DARK_SERIES: readonly MermaidSeriesColor[] = [
  series('#002a2e', '#1acfdf', '#0ebac9'),
  series('#082b1b', '#61d19a', '#3fbf86'),
  series('#322004', '#e8aa4e', '#d79628'),
  series('#261f3a', '#bda7fe', '#ab91f2'),
  series('#39191c', '#ff939c', '#ef7d88'),
  series('#12253c', '#85bafe', '#65a7fa'),
  series('#1c290d', '#9cc86c', '#87b651'),
  series('#381b0e', '#fc9b6f', '#eb8656'),
  series('#341a2c', '#ee95d1', '#de80c0'),
  series('#002b27', '#2bd2c2', '#08beaf'),
  series('#1d223c', '#a3b2fe', '#8c9cfb'),
  series('#2a2403', '#cbb94c', '#b9a624'),
];

function channels(color: string): [number, number, number] | null {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  return [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16)) as [number, number, number];
}

const toHex = (rgb: number[]) => `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;

/** Blends two hex colors; other color forms return the first untouched, since Mermaid cannot mix them. */
export function mixColors(from: string, to: string, amount: number): string {
  const a = channels(from);
  const b = channels(to);
  if (!a || !b) return from;
  return toHex(a.map((value, index) => value + (b[index] - value) * amount));
}

/**
 * Mermaid variables for the diagram types that color many parts apart, plus the surfaces that base-theme
 * derivation leaves cream, grey or black (notes, grids, pie outlines, git labels). Everything here is a
 * pure function of the semantic theme, so a site token change still flows through node and edge colors.
 */
export function buildSeriesVariables(theme: MermaidSemanticTheme): Record<string, unknown> {
  const dark = theme.mode === 'dark';
  const { series: tones, onSeries: onMark, foreground, background } = theme;
  const at = (index: number) => tones[index % tones.length];
  const variables: Record<string, unknown> = {
    darkMode: dark,
    textColor: foreground,
    titleColor: foreground,
    labelTextColor: foreground,
  };
  for (let index = 0; index < 12; index += 1) {
    variables[`cScale${index}`] = at(index).mark;
    variables[`cScaleLabel${index}`] = onMark;
    variables[`pie${index + 1}`] = at(index).mark;
  }
  for (let index = 0; index < 8; index += 1) {
    variables[`git${index}`] = at(index).mark;
    variables[`gitBranchLabel${index}`] = onMark;
    variables[`venn${index + 1}`] = at(index).mark;
    variables[`fillType${index}`] = at(index).mark;
  }
  Object.assign(variables, {
    pieStrokeColor: background,
    pieStrokeWidth: '2px',
    pieOuterStrokeColor: theme.cluster.border,
    pieOuterStrokeWidth: '1px',
    pieOpacity: '1',
    pieSectionTextColor: onMark,
    pieTitleTextColor: foreground,
    pieLegendTextColor: foreground,
    vennTitleTextColor: foreground,
    vennSetTextColor: foreground,
    tagLabelColor: foreground,
    tagLabelBackground: theme.node.fill,
    tagLabelBorder: theme.node.border,
    commitLabelColor: foreground,
    commitLabelBackground: theme.cluster.fill,
    // Sequence and state diagrams.
    actorBkg: theme.node.fill,
    actorBorder: theme.node.border,
    actorTextColor: theme.node.text,
    actorLineColor: mixColors(background, foreground, 0.4),
    signalColor: theme.edge.line,
    signalTextColor: theme.edge.label,
    labelBoxBkgColor: theme.cluster.fill,
    labelBoxBorderColor: theme.cluster.border,
    loopTextColor: foreground,
    noteBkgColor: at(2).fill,
    noteBorderColor: at(2).border,
    noteTextColor: foreground,
    activationBkgColor: theme.coreNode.fill,
    activationBorderColor: theme.node.border,
    sequenceNumberColor: background,
    specialStateColor: theme.edge.line,
    // Gantt: tasks read as a series, done work steps back, critical and today use the danger tone.
    sectionBkgColor: theme.cluster.fill,
    altSectionBkgColor: background,
    sectionBkgColor2: theme.cluster.fill,
    gridColor: mixColors(background, foreground, dark ? 0.2 : 0.16),
    taskBkgColor: at(0).mark,
    taskBorderColor: at(0).border,
    taskTextColor: onMark,
    taskTextLightColor: onMark,
    taskTextDarkColor: foreground,
    taskTextOutsideColor: foreground,
    activeTaskBkgColor: at(1).mark,
    activeTaskBorderColor: at(1).border,
    doneTaskBkgColor: mixColors(background, foreground, dark ? 0.32 : 0.22),
    doneTaskBorderColor: mixColors(background, foreground, dark ? 0.5 : 0.45),
    critBkgColor: theme.danger,
    critBorderColor: theme.danger,
    todayLineColor: theme.danger,
    // Quadrant chart: four quiet fills, one point tone.
    quadrant1Fill: at(0).fill,
    quadrant2Fill: at(1).fill,
    quadrant3Fill: at(4).fill,
    quadrant4Fill: at(2).fill,
    quadrant1TextFill: foreground,
    quadrant2TextFill: foreground,
    quadrant3TextFill: foreground,
    quadrant4TextFill: foreground,
    quadrantPointFill: at(0).border,
    quadrantPointTextFill: foreground,
    quadrantXAxisTextFill: foreground,
    quadrantYAxisTextFill: foreground,
    quadrantTitleFill: foreground,
    quadrantInternalBorderStrokeFill: theme.cluster.border,
    quadrantExternalBorderStrokeFill: theme.node.border,
    // Event modeling: one family per role, so command, event and read model never share a hue.
    emUiFill: background,
    emUiStroke: theme.cluster.border,
    emCommandFill: at(0).fill,
    emCommandStroke: at(0).border,
    emEventFill: at(6).fill,
    emEventStroke: at(6).border,
    emReadModelFill: at(5).fill,
    emReadModelStroke: at(5).border,
    emProcessorFill: at(3).fill,
    emProcessorStroke: at(3).border,
    emSwimlaneBackgroundOdd: theme.cluster.fill,
    emSwimlaneBackgroundStroke: theme.cluster.border,
    attributeBackgroundColorOdd: theme.node.fill,
    attributeBackgroundColorEven: theme.cluster.fill,
    archEdgeColor: theme.edge.line,
    archEdgeArrowColor: theme.edge.arrow,
    wardleyEvolutionColor: theme.danger,
    xyChart: {
      backgroundColor: background,
      titleColor: foreground,
      dataLabelColor: foreground,
      xAxisTitleColor: foreground,
      xAxisLabelColor: foreground,
      xAxisTickColor: theme.edge.line,
      xAxisLineColor: theme.edge.line,
      yAxisTitleColor: foreground,
      yAxisLabelColor: foreground,
      yAxisTickColor: theme.edge.line,
      yAxisLineColor: theme.edge.line,
      plotColorPalette: tones.map((tone) => tone.mark).join(','),
    },
    radar: {
      axisColor: theme.edge.line,
      graticuleColor: mixColors(background, foreground, dark ? 0.2 : 0.12),
      graticuleOpacity: 0.55,
      curveOpacity: 0.38,
    },
    packet: {
      startByteColor: foreground,
      endByteColor: foreground,
      labelColor: foreground,
      titleColor: foreground,
      blockStrokeColor: at(0).border,
      blockFillColor: at(0).fill,
    },
    cynefin: {
      complexBg: at(5).fill,
      complicatedBg: at(0).fill,
      chaoticBg: at(4).fill,
      clearBg: at(2).fill,
      confusionBg: at(3).fill,
      boundaryColor: theme.edge.line,
      arrowColor: theme.edge.line,
      cliffColor: theme.danger,
      textColor: foreground,
      labelColor: foreground,
    },
  });
  return variables;
}
