import { LayoutContext, getHeading, getBodies } from '../../core/context';
import { createTitle } from '../../components/title';
import { createBody } from '../../components/body';
import { createImageFrame } from '../../components/image';
import { createFooter } from '../../components/chrome';
import { CANVAS } from '../../tokens';

export async function renderBleed(
  parent: FrameNode,
  context: LayoutContext,
  variant: string,
  ratio: { textWidthPct: number; imageWidthPct: number; adaptiveTriggered: boolean; warned: boolean }
): Promise<any> {
  const { intent, safeZone } = context;
  const heading = getHeading(intent);
  const bodies = getBodies(intent);
  const body = bodies[0];

  // 1. Cột chữ bên trái chạy theo Auto Layout trong safeZone
  const textCol = figma.createFrame();
  textCol.name = 'Text Column (Bleed Layout)';
  textCol.layoutMode = 'VERTICAL';
  textCol.layoutAlign = 'MIN';
  textCol.primaryAxisAlignItems = 'CENTER';
  textCol.counterAxisAlignItems = 'MIN';
  textCol.itemSpacing = 24;
  textCol.fills = [];
  // Chiếm 50% chiều ngang Safezone
  textCol.resize(Math.round(safeZone.width * 0.5), safeZone.height);
  parent.appendChild(textCol);

  if (heading) await createTitle(textCol, context, heading);
  if (body) await createBody(textCol, context, body);

  // 2. Khung ảnh bên phải đặt tuyệt đối tràn toàn bộ góc trên, phải, dưới
  const bleedW = Math.round(CANVAS.Size * 0.45); // 45% chiều rộng slide (1080px)
  const bleedH = CANVAS.Size; // Tràn toàn bộ 1080px chiều dọc

  // Tạo container phụ tuyệt đối để lấp ảnh
  const absoluteContainer = figma.createFrame();
  absoluteContainer.name = 'Absolute Bleed Wrapper';
  absoluteContainer.fills = [];
  parent.appendChild(absoluteContainer);
  (absoluteContainer as any).layoutPositioning = 'ABSOLUTE';
  absoluteContainer.resize(bleedW, bleedH);
  absoluteContainer.x = CANVAS.Size - bleedW;
  absoluteContainer.y = 0;

  // Vẽ ảnh khít trong container này
  const imgFrame = await createImageFrame(absoluteContainer, context, bleedW, bleedH);
  // Bo góc 0 ở các rìa tràn viền (phải, trên, dưới)
  imgFrame.x = 0;
  imgFrame.y = 0;
  imgFrame.cornerRadius = 0; // Tràn viền phẳng

  // 3. Footer ở dưới
  await createFooter(parent, context);

  return { variantUsed: variant };
}
