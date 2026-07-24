import { LayoutContext, getHeading, getBodies } from '../../core/context';
import { createTitle } from '../../components/title';
import { createBody } from '../../components/body';
import { createImageFrame } from '../../components/image';
import { createFooter } from '../../components/chrome';

export async function renderHero(
  parent: FrameNode,
  context: LayoutContext,
  variant: string,
  fontSizeData: { headingSizeLevel: any; bodySizeLevel: any; warned: boolean }
): Promise<any> {
  const { intent, safeZone } = context;
  const heading = getHeading(intent);
  const bodies = getBodies(intent);
  const body = bodies[0];

  const content = figma.createFrame();
  content.name = 'Center Hero Content';
  content.layoutMode = 'VERTICAL';
  content.layoutAlign = 'STRETCH';
  content.layoutGrow = 1;
  content.primaryAxisAlignItems = 'CENTER';
  content.counterAxisAlignItems = 'CENTER';
  content.itemSpacing = 24;
  content.fills = [];
  parent.appendChild(content);

  if (heading) {
    const titleNode = await createTitle(content, context, heading);
    titleNode.textAlignHorizontal = 'CENTER';
  }
  if (body) {
    const bodyNode = await createBody(content, context, body);
    bodyNode.textAlignHorizontal = 'CENTER';
  }

  // Khung ảnh minh họa đặt ở trung tâm phía dưới văn bản
  const imgW = Math.round(safeZone.width * 0.7);
  const imgH = Math.round(safeZone.height * 0.45);
  await createImageFrame(content, context, imgW, imgH);

  await createFooter(parent, context);
  return { variantUsed: variant };
}
