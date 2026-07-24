import { LayoutContext, getHeading, getListComponents } from '../../core/context';
import { createTitle } from '../../components/title';
import { createFooter } from '../../components/chrome';
import { LAYOUT, CANVAS } from '../../tokens';

export async function renderHorizontal(
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

  const row = figma.createFrame();
  row.name = 'Timeline Horizontal Steps';
  row.layoutMode = 'HORIZONTAL';
  row.layoutAlign = 'STRETCH';
  row.layoutGrow = 1;
  row.itemSpacing = 24;
  row.fills = [];
  row.counterAxisAlignItems = 'CENTER';
  parent.appendChild(row);

  const items = lists.length > 0 ? lists[0].items : [];
  const cappedItems = items.slice(0, 3); // Max 3 items for horizontal fit
  if (items.length > 3) warned = true;

  for (let i = 0; i < cappedItems.length; i++) {
    const card = figma.createFrame();
    card.name = `Step Card ${i + 1}`;
    card.layoutMode = 'VERTICAL';
    card.layoutAlign = 'STRETCH';
    card.layoutGrow = 1;
    card.paddingTop = 24;
    card.paddingBottom = 24;
    card.paddingLeft = 24;
    card.paddingRight = 24;
    card.cornerRadius = CANVAS.BorderRadius;
    card.fills = [{ type: 'SOLID', color: theme.cardBg }];
    card.itemSpacing = 16;
    card.strokes = [{ type: 'SOLID', color: theme.textMuted, opacity: 0.1 }];
    card.strokeWeight = 1;
    row.appendChild(card);

    // Badge
    const badge = figma.createFrame();
    badge.name = 'Badge';
    badge.resize(40, 40);
    badge.cornerRadius = 20;
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
    card.appendChild(badge);

    // Text
    const stepText = figma.createText();
    stepText.fontName = { family: 'Inter', style: 'Regular' };
    stepText.fontSize = 24;
    stepText.characters = cappedItems[i];
    stepText.fills = [{ type: 'SOLID', color: theme.textPrimary }];
    stepText.layoutAlign = 'STRETCH';
    stepText.textAutoResize = 'HEIGHT';
    card.appendChild(stepText);
  }

  await createFooter(parent, context);
  return { warned };
}
