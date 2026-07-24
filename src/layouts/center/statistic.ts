import { LayoutContext, getHeading, getBodies } from '../../core/context';
import { createBody } from '../../components/body';
import { createFooter } from '../../components/chrome';
import { COLOR } from '../../tokens';

export async function renderStatistic(
  parent: FrameNode,
  context: LayoutContext,
  variant: string,
  fontSizeData: { headingSizeLevel: any; bodySizeLevel: any; warned: boolean }
): Promise<any> {
  const { intent } = context;
  const heading = getHeading(intent);
  const bodies = getBodies(intent);
  const body = bodies[0];

  const content = figma.createFrame();
  content.name = 'Center Statistic Content';
  content.layoutMode = 'VERTICAL';
  content.layoutAlign = 'STRETCH';
  content.layoutGrow = 1;
  content.primaryAxisAlignItems = 'CENTER';
  content.counterAxisAlignItems = 'CENTER';
  content.itemSpacing = 24;
  content.fills = [];
  parent.appendChild(content);

  // 1. Chỉ số thống kê lớn nổi bật ở trung tâm
  if (heading) {
    const kpiNode = figma.createText();
    kpiNode.name = 'Huge KPI Number';
    await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
    kpiNode.fontName = { family: 'Inter', style: 'Bold' };
    kpiNode.fontSize = heading.text.length > 8 ? 80 : 120;
    kpiNode.characters = heading.text;
    kpiNode.fills = [{ type: 'SOLID', color: COLOR.Highlight }];
    kpiNode.layoutAlign = 'STRETCH';
    kpiNode.textAutoResize = 'HEIGHT';
    kpiNode.textAlignHorizontal = 'CENTER';
    kpiNode.lineHeight = { value: 110, unit: 'PERCENT' };
    content.appendChild(kpiNode);
  }

  // 2. Nhãn giải thích nhỏ hơn ở dưới
  if (body) {
    const bodyNode = await createBody(content, context, body);
    bodyNode.textAlignHorizontal = 'CENTER';
  }

  await createFooter(parent, context);
  return { variantUsed: variant };
}
