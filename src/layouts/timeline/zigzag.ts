import { LayoutContext, getHeading, getListComponents } from '../../core/context';
import { createTitle } from '../../components/title';
import { createFooter } from '../../components/chrome';
import { LAYOUT } from '../../tokens';

export async function renderZigzag(
  parent: FrameNode,
  context: LayoutContext,
  variant: string
): Promise<{ warned: boolean }> {
  const { intent, theme } = context;
  const heading = getHeading(intent);
  const lists = getListComponents(intent);
  let warned = false;

  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  if (heading) await createTitle(parent, context, heading);

  // Steps container
  const stepsContainer = figma.createFrame();
  stepsContainer.name = 'Timeline Zigzag Steps';
  stepsContainer.layoutMode = 'VERTICAL';
  stepsContainer.layoutAlign = 'STRETCH';
  stepsContainer.layoutGrow = 1;
  stepsContainer.itemSpacing = 32;
  stepsContainer.fills = [];
  parent.appendChild(stepsContainer);

  const items = lists.length > 0 ? lists[0].items : [];
  const cappedItems = items.slice(0, 3);
  if (items.length > 3) warned = true;

  for (let i = 0; i < cappedItems.length; i++) {
    const row = figma.createFrame();
    row.name = `Zigzag Step ${i + 1}`;
    row.layoutMode = 'HORIZONTAL';
    row.layoutAlign = 'STRETCH';
    row.counterAxisAlignItems = 'CENTER';
    row.itemSpacing = 24;
    row.fills = [];

    // Cân đối căn lề trái/phải zigzag
    const isEven = i % 2 === 0;

    const badge = figma.createFrame();
    badge.name = 'Badge';
    badge.resize(44, 44);
    badge.cornerRadius = 22;
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

    const stepText = figma.createText();
    stepText.fontName = { family: 'Inter', style: 'Regular' };
    stepText.fontSize = 26;
    stepText.characters = cappedItems[i];
    stepText.fills = [{ type: 'SOLID', color: theme.textPrimary }];
    stepText.layoutAlign = 'STRETCH';
    stepText.textAutoResize = 'HEIGHT';
    stepText.layoutGrow = 1;

    // Đảo thứ tự phần tử để tạo ziczac
    if (isEven) {
      row.appendChild(badge);
      row.appendChild(stepText);
      stepText.textAlignHorizontal = 'LEFT';
    } else {
      row.appendChild(stepText);
      row.appendChild(badge);
      stepText.textAlignHorizontal = 'RIGHT';
    }

    stepsContainer.appendChild(row);
  }

  await createFooter(parent, context);
  return { warned };
}
