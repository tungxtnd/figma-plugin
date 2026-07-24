import { LayoutContext, getHeading, getListComponents } from '../../core/context';
import { createTitle } from '../../components/title';
import { createFooter } from '../../components/chrome';
import { LAYOUT } from '../../tokens';

export async function renderStandard(
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
  stepsContainer.name = 'Timeline Steps';
  stepsContainer.layoutMode = 'VERTICAL';
  stepsContainer.layoutAlign = 'STRETCH';
  stepsContainer.layoutGrow = 1;
  stepsContainer.itemSpacing = LAYOUT.Timeline.StepGap;
  stepsContainer.fills = [];
  parent.appendChild(stepsContainer);

  const items = lists.length > 0 ? lists[0].items : [];
  const cappedItems = items.slice(0, LAYOUT.Timeline.MaxItems);
  if (items.length > LAYOUT.Timeline.MaxItems) warned = true;

  for (let i = 0; i < cappedItems.length; i++) {
    const row = figma.createFrame();
    row.name = `Step ${i + 1}`;
    row.layoutMode = 'HORIZONTAL';
    row.layoutAlign = 'STRETCH';
    row.counterAxisAlignItems = 'CENTER';
    row.itemSpacing = 20;
    row.fills = [];

    // Badge tròn
    const badge = figma.createFrame();
    badge.name = 'Badge';
    badge.resize(LAYOUT.Timeline.BadgeSize, LAYOUT.Timeline.BadgeSize);
    badge.cornerRadius = LAYOUT.Timeline.BadgeSize / 2;
    badge.fills = [{ type: 'SOLID', color: theme.highlight }];
    badge.layoutMode = 'HORIZONTAL';
    badge.primaryAxisAlignItems = 'CENTER';
    badge.counterAxisAlignItems = 'CENTER';
    badge.primaryAxisSizingMode = 'FIXED';
    badge.counterAxisSizingMode = 'FIXED';

    const badgeText = figma.createText();
    badgeText.fontName = { family: 'Inter', style: 'Bold' };
    badgeText.fontSize = 20;
    badgeText.characters = String(i + 1);
    badgeText.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    badge.appendChild(badgeText);
    row.appendChild(badge);

    // Step text
    const stepText = figma.createText();
    stepText.fontName = { family: 'Inter', style: 'Regular' };
    stepText.fontSize = 28;
    stepText.characters = cappedItems[i];
    stepText.fills = [{ type: 'SOLID', color: theme.textPrimary }];
    stepText.layoutAlign = 'STRETCH';
    stepText.textAutoResize = 'HEIGHT';
    stepText.layoutGrow = 1;
    row.appendChild(stepText);

    stepsContainer.appendChild(row);
  }

  await createFooter(parent, context);
  return { warned };
}
