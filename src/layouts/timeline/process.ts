import { LayoutContext, getHeading, getListComponents } from '../../core/context';
import { createTitle } from '../../components/title';
import { createFooter } from '../../components/chrome';
import { COLOR, CANVAS } from '../../tokens';

export async function renderProcess(
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
  row.name = 'Process Horizontal Steps';
  row.layoutMode = 'HORIZONTAL';
  row.layoutAlign = 'STRETCH';
  row.layoutGrow = 1;
  row.itemSpacing = 16;
  row.fills = [];
  row.counterAxisAlignItems = 'CENTER';
  parent.appendChild(row);

  const items = lists.length > 0 ? lists[0].items : [];
  const cappedItems = items.slice(0, 3);
  if (items.length > 3) warned = true;

  for (let i = 0; i < cappedItems.length; i++) {
    // 1. Step Card
    const card = figma.createFrame();
    card.name = `Process Card ${i + 1}`;
    card.layoutMode = 'VERTICAL';
    card.layoutAlign = 'STRETCH';
    card.layoutGrow = 1;
    card.paddingTop = 20;
    card.paddingBottom = 20;
    card.paddingLeft = 20;
    card.paddingRight = 20;
    card.cornerRadius = CANVAS.BorderRadius;
    card.fills = [{ type: 'SOLID', color: theme.cardBg }];
    card.itemSpacing = 12;
    card.strokes = [{ type: 'SOLID', color: theme.textMuted, opacity: 0.1 }];
    card.strokeWeight = 1;
    row.appendChild(card);

    // Number indicator
    const stepLabel = figma.createText();
    stepLabel.fontName = { family: 'Inter', style: 'Bold' };
    stepLabel.fontSize = 18;
    stepLabel.characters = `STEP 0${i + 1}`;
    stepLabel.fills = [{ type: 'SOLID', color: theme.highlight }];
    card.appendChild(stepLabel);

    // Step text
    const stepText = figma.createText();
    stepText.fontName = { family: 'Inter', style: 'Regular' };
    stepText.fontSize = 22;
    stepText.characters = cappedItems[i];
    stepText.fills = [{ type: 'SOLID', color: theme.textPrimary }];
    stepText.layoutAlign = 'STRETCH';
    stepText.textAutoResize = 'HEIGHT';
    card.appendChild(stepText);

    // 2. Thêm mũi tên kết nối nếu chưa phải là phần tử cuối
    if (i < cappedItems.length - 1) {
      const arrow = figma.createText();
      arrow.name = 'Chevron Indicator';
      arrow.fontName = { family: 'Inter', style: 'Bold' };
      arrow.fontSize = 28;
      arrow.characters = '→';
      arrow.fills = [{ type: 'SOLID', color: theme.highlight }];
      arrow.textAutoResize = 'WIDTH_AND_HEIGHT';
      row.appendChild(arrow);
    }
  }

  await createFooter(parent, context);
  return { warned };
}
