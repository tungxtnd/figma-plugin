import { LayoutContext, getHeading, getBodies } from '../../core/context';
import { createTitle } from '../../components/title';
import { createBody } from '../../components/body';
import { createFooter } from '../../components/chrome';
import { COLOR, CANVAS } from '../../tokens';

export async function renderQuote(
  parent: FrameNode,
  context: LayoutContext,
  variant: string,
  fontSizeData: { headingSizeLevel: any; bodySizeLevel: any; warned: boolean }
): Promise<any> {
  const { intent, safeZone, theme } = context;
  const heading = getHeading(intent);
  const bodies = getBodies(intent);
  const body = bodies[0];

  const container = figma.createFrame();
  container.name = 'Center Quote Wrapper';
  container.layoutMode = 'NONE'; // Tuyệt đối để đặt dấu nháy kép chìm
  container.layoutAlign = 'STRETCH';
  container.layoutGrow = 1;
  container.fills = [];
  container.resize(safeZone.width, safeZone.height);
  parent.appendChild(container);

  // 1. Dấu nháy kép khổng lồ nằm ở trung tâm
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  const quoteMark = figma.createText();
  quoteMark.name = 'Giant Background Quote Mark';
  quoteMark.fontName = { family: 'Inter', style: 'Bold' };
  quoteMark.fontSize = 240;
  quoteMark.characters = '“';
  quoteMark.fills = [{ type: 'SOLID', color: COLOR.Highlight }];
  quoteMark.opacity = 0.12;
  quoteMark.textAlignHorizontal = 'CENTER';
  quoteMark.resize(safeZone.width, 260);
  quoteMark.x = 0;
  quoteMark.y = (safeZone.height - 260) / 2 - 80;
  container.appendChild(quoteMark);

  // 2. Nội dung trích dẫn căn giữa nổi lên trên
  const content = figma.createFrame();
  content.name = 'Quote Content';
  content.layoutMode = 'VERTICAL';
  content.primaryAxisAlignItems = 'CENTER';
  content.counterAxisAlignItems = 'CENTER';
  content.itemSpacing = 24;
  content.fills = [];
  content.resize(safeZone.width, safeZone.height);
  content.x = 0;
  content.y = 0;
  container.appendChild(content);

  // Thẻ chứa văn bản
  const card = figma.createFrame();
  card.name = 'Quote Card';
  card.layoutMode = 'VERTICAL';
  card.primaryAxisAlignItems = 'CENTER';
  card.counterAxisAlignItems = 'CENTER';
  card.itemSpacing = 16;
  card.paddingTop = 32;
  card.paddingBottom = 32;
  card.paddingLeft = 32;
  card.paddingRight = 32;
  card.cornerRadius = CANVAS.BorderRadius;
  card.fills = [{ type: 'SOLID', color: theme.cardBg, opacity: 0.8 }];
  card.layoutAlign = 'STRETCH';
  content.appendChild(card);

  if (heading) {
    const textNode = await createTitle(card, context, heading);
    textNode.textAlignHorizontal = 'CENTER';
    // Đổi sang font chữ nghiêng nghệ thuật
    try {
      await figma.loadFontAsync({ family: 'Inter', style: 'Italic' });
      textNode.fontName = { family: 'Inter', style: 'Italic' };
    } catch (e) {}
  }
  if (body) {
    const bodyNode = await createBody(card, context, { ...body, text: `— ${body.text}` });
    bodyNode.textAlignHorizontal = 'CENTER';
  }

  await createFooter(parent, context);
  return { variantUsed: variant };
}
