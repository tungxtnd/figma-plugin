import { LayoutContext, getHeading, getBodies } from '../../core/context';
import { createTitle } from '../../components/title';
import { createBody } from '../../components/body';
import { createImageFrame } from '../../components/image';
import { createFooter } from '../../components/chrome';
import { COLOR } from '../../tokens';

export async function renderStatistics(
  parent: FrameNode,
  context: LayoutContext,
  variant: string,
  ratio: { textWidthPct: number; imageWidthPct: number; adaptiveTriggered: boolean; warned: boolean }
): Promise<any> {
  const { intent, safeZone } = context;
  const heading = getHeading(intent);
  const bodies = getBodies(intent);
  const body = bodies[0];

  const cols = figma.createFrame();
  cols.name = 'Statistics Columns';
  cols.layoutMode = 'HORIZONTAL';
  cols.layoutAlign = 'STRETCH';
  cols.layoutGrow = 1;
  cols.counterAxisSizingMode = 'FIXED';
  cols.counterAxisAlignItems = 'CENTER';
  cols.primaryAxisSizingMode = 'FIXED';
  cols.itemSpacing = 40;
  cols.fills = [];
  parent.appendChild(cols);

  // Cột chỉ số trái: 45%
  const statCol = figma.createFrame();
  statCol.name = 'Statistic KPI Column';
  statCol.layoutMode = 'VERTICAL';
  statCol.layoutAlign = 'STRETCH';
  statCol.primaryAxisAlignItems = 'CENTER';
  statCol.counterAxisAlignItems = 'MIN';
  statCol.itemSpacing = 20;
  statCol.fills = [];
  statCol.resize(Math.round(safeZone.width * 0.45 - 20), safeZone.height);
  cols.appendChild(statCol);

  // 1. Tạo số liệu thống kê cực lớn ở trên
  if (heading) {
    // Tự động phát hiện nếu tiêu đề có phần trăm hoặc số liệu để vẽ siêu lớn
    const statsText = figma.createText();
    statsText.name = 'Huge KPI Number';
    await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
    statsText.fontName = { family: 'Inter', style: 'Bold' };
    
    // Nếu chữ quá dài thì thu nhỏ size lại để tránh tràn viền
    statsText.fontSize = heading.text.length > 8 ? 64 : 96;
    statsText.characters = heading.text;
    statsText.fills = [{ type: 'SOLID', color: COLOR.Highlight }];
    statsText.layoutAlign = 'STRETCH';
    statsText.textAutoResize = 'HEIGHT';
    statsText.lineHeight = { value: 100, unit: 'PERCENT' };
    statCol.appendChild(statsText);
  }

  // 2. Mô tả chỉ số ở dưới
  if (body) {
    await createBody(statCol, context, body);
  }

  // Cột ảnh minh họa phải: 55%
  const imgCol = figma.createFrame();
  imgCol.name = 'Statistic Image Column';
  imgCol.layoutMode = 'VERTICAL';
  imgCol.layoutAlign = 'INHERIT';
  imgCol.primaryAxisAlignItems = 'CENTER';
  imgCol.counterAxisAlignItems = 'CENTER';
  imgCol.fills = [];
  imgCol.layoutGrow = 1;
  cols.appendChild(imgCol);

  const imgW = Math.round(safeZone.width * 0.55 - 20);
  const imgH = Math.min(safeZone.height - 80, imgW);
  await createImageFrame(imgCol, context, imgW, imgH);

  await createFooter(parent, context);

  return { variantUsed: variant };
}
