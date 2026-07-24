import { LayoutContext, getHeading, getBodies } from '../../core/context';
import { createTitle } from '../../components/title';
import { createBody } from '../../components/body';
import { createFooter } from '../../components/chrome';

export async function renderCover(
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
  content.name = 'Center Cover Content';
  content.layoutMode = 'VERTICAL';
  content.layoutAlign = 'STRETCH';
  content.layoutGrow = 1;
  content.primaryAxisAlignItems = 'CENTER';
  content.counterAxisAlignItems = 'CENTER';
  content.itemSpacing = 24;
  content.fills = [];
  parent.appendChild(content);

  // Layout bìa phụ: Chữ to rõ rệt, căn giữa, dồn toàn bộ không gian
  if (heading) {
    const forcedHeading = { ...heading, size_level: 'HeadingXL' as const };
    const titleNode = await createTitle(content, context, forcedHeading);
    titleNode.textAlignHorizontal = 'CENTER';
  }

  if (body) {
    const bodyNode = await createBody(content, context, body);
    bodyNode.textAlignHorizontal = 'CENTER';
  }

  // Cover thường dùng footer mờ nhẹ hoặc tối giản
  await createFooter(parent, context);

  return { variantUsed: variant };
}
