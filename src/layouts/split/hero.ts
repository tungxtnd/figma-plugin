import { LayoutContext, getHeading, getBodies } from '../../core/context';
import { createTitle } from '../../components/title';
import { createBody } from '../../components/body';
import { createImageFrame } from '../../components/image';
import { createFooter } from '../../components/chrome';

export async function renderHero(
  parent: FrameNode,
  context: LayoutContext,
  variant: string,
  ratio: { textWidthPct: number; imageWidthPct: number; adaptiveTriggered: boolean; warned: boolean }
): Promise<any> {
  const { intent, safeZone } = context;
  const heading = getHeading(intent);
  const bodies = getBodies(intent);
  const body = bodies[0];

  // Bố cục dọc: Khối chữ ở trên, Khung ảnh ở dưới
  const container = figma.createFrame();
  container.name = 'Hero Vertical Stack';
  container.layoutMode = 'VERTICAL';
  container.layoutAlign = 'STRETCH';
  container.layoutGrow = 1;
  container.primaryAxisAlignItems = 'MIN';
  container.counterAxisAlignItems = 'CENTER';
  container.itemSpacing = 32;
  container.fills = [];
  parent.appendChild(container);

  // 1. Khối văn bản căn giữa (Tiêu đề + Mô tả)
  const textStack = figma.createFrame();
  textStack.name = 'Text Stack';
  textStack.layoutMode = 'VERTICAL';
  textStack.layoutAlign = 'STRETCH';
  textStack.primaryAxisAlignItems = 'MIN';
  textStack.counterAxisAlignItems = 'CENTER';
  textStack.itemSpacing = 16;
  textStack.fills = [];
  container.appendChild(textStack);

  // Tạo tiêu đề căn giữa
  if (heading) {
    const headingCopy = { ...heading, alignment: 'center' as const };
    await createTitle(textStack, context, headingCopy);
  }

  // Tạo mô tả căn giữa
  if (body) {
    const bodyCopy = { ...body, alignment: 'center' as const };
    await createBody(textStack, context, bodyCopy);
  }

  // 2. Khung ảnh minh họa lớn lấp đầy phần dưới
  const imgW = safeZone.width;
  // Chiều cao ảnh chiếm khoảng 60% Safezone trừ đi phần đệm
  const imgH = Math.round(safeZone.height * 0.55);
  
  const imgContainer = figma.createFrame();
  imgContainer.name = 'Hero Image Container';
  imgContainer.layoutMode = 'VERTICAL';
  imgContainer.layoutAlign = 'STRETCH';
  imgContainer.layoutGrow = 1;
  imgContainer.primaryAxisAlignItems = 'CENTER';
  imgContainer.counterAxisAlignItems = 'CENTER';
  imgContainer.fills = [];
  container.appendChild(imgContainer);

  await createImageFrame(imgContainer, context, imgW, imgH);

  // 3. Footer ở dưới cùng của slide
  await createFooter(parent, context);

  return { variantUsed: variant };
}
