import { LayoutContext, getHeading, getBodies } from '../../core/context';
import { createTitle } from '../../components/title';
import { createBody } from '../../components/body';
import { createImageFrame } from '../../components/image';
import { createFooter } from '../../components/chrome';
import { COLOR, LAYOUT } from '../../tokens';

export async function renderEditorial(
  parent: FrameNode,
  context: LayoutContext,
  variant: string,
  ratio: { textWidthPct: number; imageWidthPct: number; adaptiveTriggered: boolean; warned: boolean }
): Promise<any> {
  const { intent, safeZone } = context;
  const heading = getHeading(intent);
  const bodies = getBodies(intent);
  const body = bodies[0];

  const gap = 48; // Airy spacing

  const cols = figma.createFrame();
  cols.name = 'Editorial Columns';
  cols.layoutMode = 'HORIZONTAL';
  cols.layoutAlign = 'STRETCH';
  cols.layoutGrow = 1;
  cols.counterAxisSizingMode = 'FIXED';
  cols.counterAxisAlignItems = 'CENTER';
  cols.primaryAxisSizingMode = 'FIXED';
  cols.itemSpacing = gap;
  cols.fills = [];
  parent.appendChild(cols);

  // Cột chữ bên trái: 42%
  const textCol = figma.createFrame();
  textCol.name = 'Editorial Text Column';
  textCol.layoutMode = 'HORIZONTAL';
  textCol.layoutAlign = 'STRETCH';
  textCol.primaryAxisAlignItems = 'MIN';
  textCol.counterAxisAlignItems = 'CENTER';
  textCol.itemSpacing = 24;
  textCol.fills = [];
  textCol.resize(Math.round(safeZone.width * 0.45 - gap / 2), safeZone.height);
  cols.appendChild(textCol);

  // Thêm đường kẻ dọc Accent màu vàng Highlight trang trí sát cột chữ
  const accentBar = figma.createFrame();
  accentBar.name = 'Vertical Accent Bar';
  accentBar.resize(4, 180);
  accentBar.cornerRadius = 2;
  accentBar.fills = [{ type: 'SOLID', color: COLOR.Highlight }];
  accentBar.layoutAlign = 'INHERIT';
  textCol.appendChild(accentBar);

  const textStack = figma.createFrame();
  textStack.name = 'Text Stack';
  textStack.layoutMode = 'VERTICAL';
  textStack.layoutAlign = 'STRETCH';
  textStack.layoutGrow = 1;
  textStack.primaryAxisAlignItems = 'CENTER';
  textStack.counterAxisAlignItems = 'MIN';
  textStack.itemSpacing = 20;
  textStack.fills = [];
  textCol.appendChild(textStack);

  if (heading) await createTitle(textStack, context, heading);
  if (body) await createBody(textStack, context, body);

  // Cột ảnh bên phải: 55%
  const imgCol = figma.createFrame();
  imgCol.name = 'Editorial Image Column';
  imgCol.layoutMode = 'VERTICAL';
  imgCol.layoutAlign = 'INHERIT';
  imgCol.primaryAxisAlignItems = 'CENTER';
  imgCol.counterAxisAlignItems = 'CENTER';
  imgCol.fills = [];
  imgCol.layoutGrow = 1;
  cols.appendChild(imgCol);

  const imgW = Math.round(safeZone.width * 0.55 - gap / 2);
  const imgH = Math.min(safeZone.height - 80, imgW);
  await createImageFrame(imgCol, context, imgW, imgH);

  await createFooter(parent, context);

  return { variantUsed: variant };
}
