import { LayoutContext, getHeading, getBodies } from '../../core/context';
import { createTitle } from '../../components/title';
import { createBody } from '../../components/body';
import { createFooter } from '../../components/chrome';

export async function renderMinimal(
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
  content.name = 'Center Minimal Content';
  content.layoutMode = 'VERTICAL';
  content.layoutAlign = 'STRETCH';
  content.layoutGrow = 1;
  content.primaryAxisAlignItems = 'CENTER';
  content.counterAxisAlignItems = 'CENTER';
  content.itemSpacing = 32; // Airy spacing
  content.fills = [];
  parent.appendChild(content);

  // Layout tối giản tập trung vào chữ, không chứa ảnh, dùng font size to rộng rãi
  if (heading) {
    const headingCopy = { ...heading, size_level: 'HeadingXL' as const };
    const titleNode = await createTitle(content, context, headingCopy);
    titleNode.textAlignHorizontal = 'CENTER';
  }
  if (body) {
    const bodyNode = await createBody(content, context, body);
    bodyNode.textAlignHorizontal = 'CENTER';
  }

  await createFooter(parent, context);
  return { variantUsed: variant };
}
