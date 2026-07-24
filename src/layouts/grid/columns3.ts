import { LayoutContext, getHeading, getListComponents, getStatistics } from '../../core/context';
import { createTitle } from '../../components/title';
import { createListItems } from '../../components/body';
import { createFooter } from '../../components/chrome';
import { renderStatBlock } from './standard';

export async function renderColumns3(
  parent: FrameNode,
  context: LayoutContext,
  variant: string
): Promise<{ warned: boolean }> {
  const { intent } = context;
  const heading = getHeading(intent);
  const lists = getListComponents(intent);
  const statistics = getStatistics(intent);
  let warned = false;

  if (heading) {
    await createTitle(parent, context, heading);
  }

  const row = figma.createFrame();
  row.name = 'Grid 3-Columns Row';
  row.layoutMode = 'HORIZONTAL';
  row.layoutAlign = 'STRETCH';
  row.layoutGrow = 1;
  row.itemSpacing = 24;
  row.fills = [];
  row.counterAxisAlignItems = 'CENTER';
  parent.appendChild(row);

  if (statistics.length > 0) {
    const statsToDraw = statistics.slice(0, 3);
    for (const stat of statsToDraw) {
      await renderStatBlock(row, context, stat);
    }
  } else {
    // Chia danh sách items thành 3 cột
    const listsToDraw = lists.slice(0, 3);
    for (const list of listsToDraw) {
      const col = figma.createFrame();
      col.name = 'List Column';
      col.layoutMode = 'VERTICAL';
      col.layoutAlign = 'STRETCH';
      col.layoutGrow = 1;
      col.fills = [];
      row.appendChild(col);
      await createListItems(col, context, list);
    }
  }

  await createFooter(parent, context);
  return { warned };
}
