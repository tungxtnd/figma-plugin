import { LayoutContext, getHeading, getListComponents, getStatistics } from '../../core/context';
import { createTitle } from '../../components/title';
import { createListItems } from '../../components/body';
import { createFooter } from '../../components/chrome';
import { renderStatBlock } from './standard';
import { COLOR, CANVAS } from '../../tokens';

export async function renderComparison(
  parent: FrameNode,
  context: LayoutContext,
  variant: string
): Promise<{ warned: boolean }> {
  const { intent, theme } = context;
  const heading = getHeading(intent);
  const lists = getListComponents(intent);
  const statistics = getStatistics(intent);
  let warned = false;

  if (heading) {
    await createTitle(parent, context, heading);
  }

  const wrapper = figma.createFrame();
  wrapper.name = 'Comparison Wrapper';
  wrapper.layoutMode = 'NONE'; // Tuyệt đối để đặt VS Badge ở giữa đè lên
  wrapper.layoutAlign = 'STRETCH';
  wrapper.layoutGrow = 1;
  wrapper.fills = [];
  parent.appendChild(wrapper);

  const row = figma.createFrame();
  row.name = 'Comparison Side-by-Side';
  row.layoutMode = 'HORIZONTAL';
  row.itemSpacing = 64; // Khoảng trống lớn cho VS Badge ở giữa
  row.fills = [];
  row.counterAxisAlignItems = 'CENTER';
  row.resize(1080 - 160, 500); // Kích thước theo Safezone
  row.x = 0;
  row.y = 0;
  row.layoutAlign = 'STRETCH';
  wrapper.appendChild(row);

  if (statistics.length > 0) {
    const statsToDraw = statistics.slice(0, 2);
    for (const stat of statsToDraw) {
      await renderStatBlock(row, context, stat);
    }
  } else {
    const listsToDraw = lists.slice(0, 2);
    for (const list of listsToDraw) {
      const col = figma.createFrame();
      col.name = 'Comparison Column';
      col.layoutMode = 'VERTICAL';
      col.layoutAlign = 'STRETCH';
      col.layoutGrow = 1;
      col.paddingTop = 24;
      col.paddingBottom = 24;
      col.paddingLeft = 24;
      col.paddingRight = 24;
      col.cornerRadius = CANVAS.BorderRadius;
      col.fills = [{ type: 'SOLID', color: theme.cardBg }];
      col.strokes = [{ type: 'SOLID', color: theme.textMuted, opacity: 0.15 }];
      col.strokeWeight = 1;
      row.appendChild(col);
      if (list.title) {
        await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
        const listTitle = figma.createText();
        listTitle.name = 'Comparison Column Title';
        listTitle.fontName = { family: 'Inter', style: 'Bold' };
        listTitle.fontSize = 24;
        listTitle.characters = list.title;
        listTitle.fills = [{ type: 'SOLID', color: theme.highlight }];
        listTitle.layoutAlign = 'STRETCH';
        listTitle.textAutoResize = 'HEIGHT';
        col.appendChild(listTitle);
      }
      await createListItems(col, context, list);
    }
  }

  // Tạo VS Badge chính giữa
  const vsBadge = figma.createFrame();
  vsBadge.name = 'VS Badge';
  vsBadge.layoutMode = 'HORIZONTAL';
  vsBadge.primaryAxisAlignItems = 'CENTER';
  vsBadge.counterAxisAlignItems = 'CENTER';
  vsBadge.resize(60, 60);
  vsBadge.cornerRadius = 30;
  vsBadge.fills = [{ type: 'SOLID', color: COLOR.Highlight }];
  
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  const vsText = figma.createText();
  vsText.fontName = { family: 'Inter', style: 'Bold' };
  vsText.fontSize = 20;
  vsText.characters = 'VS';
  vsText.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
  vsText.textAutoResize = 'WIDTH_AND_HEIGHT';
  vsBadge.appendChild(vsText);

  // Đặt VS Badge vào đúng tâm giữa 2 cột
  vsBadge.x = (1080 - 160) / 2 - 30;
  vsBadge.y = 200;
  wrapper.appendChild(vsBadge);

  await createFooter(parent, context);
  return { warned };
}
