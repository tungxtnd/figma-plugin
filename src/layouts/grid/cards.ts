import { LayoutContext, getHeading, getListComponents } from '../../core/context';
import { createTitle } from '../../components/title';
import { createListItems } from '../../components/body';
import { createFooter } from '../../components/chrome';
import { CANVAS } from '../../tokens';

export async function renderCards(
  parent: FrameNode,
  context: LayoutContext,
  variant: string
): Promise<{ warned: boolean }> {
  const { intent, theme } = context;
  const heading = getHeading(intent);
  const lists = getListComponents(intent);
  let warned = false;

  if (heading) {
    await createTitle(parent, context, heading);
  }

  const row = figma.createFrame();
  row.name = 'Cards Row';
  row.layoutMode = 'HORIZONTAL';
  row.layoutAlign = 'STRETCH';
  row.layoutGrow = 1;
  row.itemSpacing = 32;
  row.fills = [];
  row.counterAxisAlignItems = 'CENTER';
  parent.appendChild(row);

  const listsToDraw = lists.slice(0, 3);
  for (const list of listsToDraw) {
    const card = figma.createFrame();
    card.name = 'Premium Card Item';
    card.layoutMode = 'VERTICAL';
    card.layoutAlign = 'STRETCH';
    card.layoutGrow = 1;
    card.paddingTop = 24;
    card.paddingBottom = 24;
    card.paddingLeft = 24;
    card.paddingRight = 24;
    card.cornerRadius = CANVAS.BorderRadius;
    card.fills = [{ type: 'SOLID', color: theme.cardBg }];
    
    // Thêm viền mỏng tinh tế
    card.strokes = [{ type: 'SOLID', color: theme.textMuted, opacity: 0.15 }];
    card.strokeWeight = 1;
    
    row.appendChild(card);
    await createListItems(card, context, list);
  }

  await createFooter(parent, context);
  return { warned };
}
