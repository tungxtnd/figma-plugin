import { LayoutContext, getHeading, getListComponents } from '../../core/context';
import { createTitle } from '../../components/title';
import { createListItems } from '../../components/body';
import { createFooter } from '../../components/chrome';
import { COLOR, CANVAS } from '../../tokens';

export async function renderPricing(
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
  row.name = 'Pricing Row';
  row.layoutMode = 'HORIZONTAL';
  row.layoutAlign = 'STRETCH';
  row.layoutGrow = 1;
  row.itemSpacing = 24;
  row.fills = [];
  row.counterAxisAlignItems = 'CENTER';
  parent.appendChild(row);

  const listsToDraw = lists.slice(0, 3);
  let index = 0;
  for (const list of listsToDraw) {
    const card = figma.createFrame();
    card.name = `Pricing Card - ${index + 1}`;
    card.layoutMode = 'VERTICAL';
    card.layoutAlign = 'STRETCH';
    card.layoutGrow = 1;
    card.paddingTop = 32;
    card.paddingBottom = 32;
    card.paddingLeft = 24;
    card.paddingRight = 24;
    card.cornerRadius = CANVAS.BorderRadius;
    
    // Nổi bật thẻ ở giữa (phổ biến nhất)
    const isPopular = index === 1 && listsToDraw.length === 3;
    if (isPopular) {
      card.fills = [{ type: 'SOLID', color: theme.cardBg }];
      card.strokes = [{ type: 'SOLID', color: COLOR.Highlight }];
      card.strokeWeight = 3; // Viền highlight dày hơn

      // Tạo nhãn "POPULAR" đè lên đầu
      const badge = figma.createFrame();
      badge.name = 'Popular Badge';
      badge.layoutMode = 'HORIZONTAL';
      badge.primaryAxisAlignItems = 'CENTER';
      badge.counterAxisAlignItems = 'CENTER';
      badge.paddingTop = 6;
      badge.paddingBottom = 6;
      badge.paddingLeft = 12;
      badge.paddingRight = 12;
      badge.cornerRadius = 100;
      badge.fills = [{ type: 'SOLID', color: COLOR.Highlight }];
      
      await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
      const badgeText = figma.createText();
      badgeText.fontName = { family: 'Inter', style: 'Bold' };
      badgeText.fontSize = 14;
      badgeText.characters = 'RECOMMENDED';
      badgeText.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]; // Chữ đen
      badgeText.textAutoResize = 'WIDTH_AND_HEIGHT';
      badge.appendChild(badgeText);
      
      card.appendChild(badge);
    } else {
      card.fills = [{ type: 'SOLID', color: theme.cardBg, opacity: 0.6 }];
      card.strokes = [{ type: 'SOLID', color: theme.textMuted, opacity: 0.15 }];
      card.strokeWeight = 1;
    }
    
    row.appendChild(card);
    await createListItems(card, context, list);
    index++;
  }

  await createFooter(parent, context);
  return { warned };
}
