import { LayoutContext, getHeading, getListComponents } from '../../core/context';
import { createTitle } from '../../components/title';
import { createFooter } from '../../components/chrome';
import { LAYOUT, CANVAS } from '../../tokens';

export async function renderRoadmap(
  parent: FrameNode,
  context: LayoutContext,
  variant: string
): Promise<{ warned: boolean }> {
  const { intent, theme, safeZone } = context;
  const heading = getHeading(intent);
  const lists = getListComponents(intent);
  let warned = false;

  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  if (heading) await createTitle(parent, context, heading);

  // Tạo container phụ tuyệt đối để đặt đường line ngang
  const wrapper = figma.createFrame();
  wrapper.name = 'Roadmap Wrapper';
  wrapper.layoutMode = 'NONE';
  wrapper.layoutAlign = 'STRETCH';
  wrapper.layoutGrow = 1;
  wrapper.fills = [];
  parent.appendChild(wrapper);

  // 1. Tạo đường kẻ ngang (Timeline line) chìm ở trung tâm
  const line = figma.createFrame();
  line.name = 'Connecting Line';
  line.resize(safeZone.width, 6);
  line.cornerRadius = 3;
  line.fills = [{ type: 'SOLID', color: theme.highlight, opacity: 0.4 }];
  line.x = 0;
  line.y = 120; // Đặt ngang tầm với các badge tròn
  wrapper.appendChild(line);

  // 2. Bố trí các bước theo chiều ngang đè lên line
  const stepsRow = figma.createFrame();
  stepsRow.name = 'Roadmap Steps';
  stepsRow.layoutMode = 'HORIZONTAL';
  stepsRow.itemSpacing = 40;
  stepsRow.fills = [];
  stepsRow.counterAxisAlignItems = 'MIN';
  stepsRow.resize(safeZone.width, 400);
  stepsRow.x = 0;
  stepsRow.y = 100;
  wrapper.appendChild(stepsRow);

  const items = lists.length > 0 ? lists[0].items : [];
  const cappedItems = items.slice(0, 3);
  if (items.length > 3) warned = true;

  for (let i = 0; i < cappedItems.length; i++) {
    const col = figma.createFrame();
    col.name = `Roadmap Step ${i + 1}`;
    col.layoutMode = 'VERTICAL';
    col.layoutAlign = 'STRETCH';
    col.layoutGrow = 1;
    col.itemSpacing = 16;
    col.fills = [];
    col.counterAxisAlignItems = 'CENTER';
    stepsRow.appendChild(col);

    // Badge
    const badge = figma.createFrame();
    badge.name = 'Badge';
    badge.resize(46, 46);
    badge.cornerRadius = 23;
    badge.fills = [{ type: 'SOLID', color: theme.highlight }];
    badge.layoutMode = 'HORIZONTAL';
    badge.primaryAxisAlignItems = 'CENTER';
    badge.counterAxisAlignItems = 'CENTER';
    badge.primaryAxisSizingMode = 'FIXED';
    badge.counterAxisSizingMode = 'FIXED';

    const badgeText = figma.createText();
    badgeText.fontName = { family: 'Inter', style: 'Bold' };
    badgeText.fontSize = 18;
    badgeText.characters = String(i + 1);
    badgeText.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    badge.appendChild(badgeText);
    col.appendChild(badge);

    // Text dưới badge
    const stepText = figma.createText();
    stepText.fontName = { family: 'Inter', style: 'Regular' };
    stepText.fontSize = 22;
    stepText.characters = cappedItems[i];
    stepText.fills = [{ type: 'SOLID', color: theme.textPrimary }];
    stepText.layoutAlign = 'STRETCH';
    stepText.textAutoResize = 'HEIGHT';
    stepText.textAlignHorizontal = 'CENTER';
    col.appendChild(stepText);
  }

  await createFooter(parent, context);
  return { warned };
}
