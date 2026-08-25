import { LayoutContext, getHeading, getBodies } from '../../core/context';
import { createTitle } from '../../components/title';
import { createBody } from '../../components/body';
import { createFooter } from '../../components/chrome';

async function renderCenteredText(
  parent: FrameNode,
  context: LayoutContext,
  variant: string,
  options: { frameName: string; itemSpacing: number }
): Promise<any> {
  const { intent } = context;
  const heading = getHeading(intent);
  const bodies = getBodies(intent);
  const body = bodies[0];

  const content = figma.createFrame();
  content.name = options.frameName;
  content.layoutMode = 'VERTICAL';
  content.layoutAlign = 'STRETCH';
  content.layoutGrow = 1;
  content.primaryAxisAlignItems = 'CENTER';
  content.counterAxisAlignItems = 'CENTER';
  content.itemSpacing = options.itemSpacing;
  content.fills = [];
  parent.appendChild(content);

  if (heading) {
    const forcedHeading = { ...heading, size_level: 'HeadingXL' as const };
    const titleNode = await createTitle(content, context, forcedHeading);
    titleNode.textAlignHorizontal = 'CENTER';
  }

  if (body) {
    const bodyNode = await createBody(content, context, body);
    bodyNode.textAlignHorizontal = 'CENTER';
  }

  await createFooter(parent, context);
  return { variantUsed: variant };
}

// Layout bìa: Chữ to rõ rệt, căn giữa, dồn toàn bộ không gian
export function renderCover(
  parent: FrameNode,
  context: LayoutContext,
  variant: string,
  _fontSizeData: { headingSizeLevel: any; bodySizeLevel: any; warned: boolean }
): Promise<any> {
  return renderCenteredText(parent, context, variant, { frameName: 'Center Cover Content', itemSpacing: 24 });
}

// Layout tối giản tập trung vào chữ, không chứa ảnh, spacing rộng rãi hơn cover
export function renderMinimal(
  parent: FrameNode,
  context: LayoutContext,
  variant: string,
  _fontSizeData: { headingSizeLevel: any; bodySizeLevel: any; warned: boolean }
): Promise<any> {
  return renderCenteredText(parent, context, variant, { frameName: 'Center Minimal Content', itemSpacing: 32 });
}
