import { LayoutContext, getHeading, getBodies } from '../../core/context';
import { createTitle } from '../../components/title';
import { createBody } from '../../components/body';
import { createImageFrame } from '../../components/image';
import { createFooter } from '../../components/chrome';
import { LAYOUT } from '../../tokens';

export async function renderStandard(
  parent: FrameNode,
  context: LayoutContext,
  variant: string,
  ratio: { textWidthPct: number; imageWidthPct: number; adaptiveTriggered: boolean; warned: boolean }
): Promise<any> {
  const { intent, safeZone } = context;
  const heading = getHeading(intent);
  const bodies = getBodies(intent);
  const body = bodies[0];

  const isReversed = variant === 'split_reversed';

  const cols = figma.createFrame();
  cols.name = 'Split Columns';
  cols.layoutMode = 'HORIZONTAL';
  cols.layoutAlign = 'STRETCH';
  cols.layoutGrow = 1;
  cols.counterAxisSizingMode = 'FIXED';
  cols.counterAxisAlignItems = 'CENTER';
  cols.primaryAxisSizingMode = 'FIXED';
  cols.itemSpacing = LAYOUT.Split.GapBetweenCols;
  cols.fills = [];
  parent.appendChild(cols);

  const textCol = figma.createFrame();
  textCol.name = 'Text Column';
  textCol.layoutMode = 'VERTICAL';
  textCol.layoutAlign = 'INHERIT';
  textCol.primaryAxisAlignItems = 'CENTER';
  textCol.primaryAxisSizingMode = 'AUTO';
  textCol.counterAxisSizingMode = 'FIXED';
  textCol.itemSpacing = 24;
  textCol.fills = [];
  textCol.resize(Math.round(safeZone.width * ratio.textWidthPct - LAYOUT.Split.GapBetweenCols / 2), 100);

  const imgCol = figma.createFrame();
  imgCol.name = 'Image Column';
  imgCol.layoutMode = 'VERTICAL';
  imgCol.layoutAlign = 'INHERIT';
  imgCol.primaryAxisAlignItems = 'CENTER';
  imgCol.counterAxisAlignItems = 'CENTER';
  imgCol.fills = [];
  imgCol.layoutGrow = 1;

  const imgW = Math.round(safeZone.width * ratio.imageWidthPct - LAYOUT.Split.GapBetweenCols / 2);
  const imgH = Math.min(safeZone.height - 80, imgW);

  // split_reversed: Image bên trái, Text bên phải
  if (isReversed) {
    cols.appendChild(imgCol);
    cols.appendChild(textCol);
  } else {
    cols.appendChild(textCol);
    cols.appendChild(imgCol);
  }

  if (heading) await createTitle(textCol, context, heading);
  if (body) await createBody(textCol, context, body);
  await createImageFrame(imgCol, context, imgW, imgH);
  await createFooter(parent, context);

  return { variantUsed: variant };
}
