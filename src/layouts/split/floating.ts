import { LayoutContext, getHeading, getBodies } from '../../core/context';
import { createTitle } from '../../components/title';
import { createBody } from '../../components/body';
import { createImageFrame } from '../../components/image';
import { createFooter } from '../../components/chrome';
import { CANVAS } from '../../tokens';

export async function renderFloating(
  parent: FrameNode,
  context: LayoutContext,
  variant: string,
  ratio: { textWidthPct: number; imageWidthPct: number; adaptiveTriggered: boolean; warned: boolean }
): Promise<any> {
  const { intent, safeZone, theme } = context;
  const heading = getHeading(intent);
  const bodies = getBodies(intent);
  const body = bodies[0];

  // Container trung gian có kích thước khớp safeZone để chứa các layer tuyệt đối
  const container = figma.createFrame();
  container.name = 'Floating Card Container';
  container.layoutMode = 'NONE';
  container.layoutAlign = 'STRETCH';
  container.layoutGrow = 1;
  container.fills = [];
  container.resize(safeZone.width, safeZone.height);
  parent.appendChild(container);

  // 1. Ảnh minh họa (chiếm 60% bên phải)
  const imgW = Math.round(safeZone.width * 0.6);
  const imgH = safeZone.height;
  const imgFrame = await createImageFrame(container, context, imgW, imgH);
  imgFrame.x = safeZone.width - imgW;
  imgFrame.y = 0;

  // 2. Glassmorphism card (chiếm 55% bên trái, đè lên ảnh 15% chiều ngang)
  const cardW = Math.round(safeZone.width * 0.55);
  const cardH = safeZone.height - 80;
  const card = figma.createFrame();
  card.name = 'Floating Card';
  card.layoutMode = 'VERTICAL';
  card.primaryAxisAlignItems = 'CENTER';
  card.counterAxisAlignItems = 'MIN';
  card.itemSpacing = 24;
  card.paddingTop = 40;
  card.paddingBottom = 40;
  card.paddingLeft = 40;
  card.paddingRight = 40;
  card.cornerRadius = CANVAS.BorderRadius;
  card.fills = [{ type: 'SOLID', color: theme.cardBg, opacity: 0.9 }];
  
  // Đặt kích thước cố định để căn chỉnh chính xác
  card.resize(cardW, cardH);
  card.primaryAxisSizingMode = 'FIXED';
  card.counterAxisSizingMode = 'FIXED';
  card.x = 0;
  card.y = 40; // Căn giữa dọc
  container.appendChild(card);

  if (heading) await createTitle(card, context, heading);
  if (body) await createBody(card, context, body);
  
  await createFooter(parent, context);
  return { variantUsed: variant };
}
