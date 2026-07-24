import { LayoutContext, getHeading, getBodies } from '../../core/context';
import { createTitle } from '../../components/title';
import { createBody } from '../../components/body';
import { createImageFrame } from '../../components/image';
import { createFooter } from '../../components/chrome';
import { COLOR } from '../../tokens';

export async function renderQuote(
  parent: FrameNode,
  context: LayoutContext,
  variant: string,
  ratio: { textWidthPct: number; imageWidthPct: number; adaptiveTriggered: boolean; warned: boolean }
): Promise<any> {
  const { intent, safeZone } = context;
  const heading = getHeading(intent);
  const bodies = getBodies(intent);
  const body = bodies[0];

  const cols = figma.createFrame();
  cols.name = 'Quote Columns';
  cols.layoutMode = 'HORIZONTAL';
  cols.layoutAlign = 'STRETCH';
  cols.layoutGrow = 1;
  cols.counterAxisSizingMode = 'FIXED';
  cols.counterAxisAlignItems = 'CENTER';
  cols.primaryAxisSizingMode = 'FIXED';
  cols.itemSpacing = 40;
  cols.fills = [];
  parent.appendChild(cols);

  // Cột chữ chứa trích dẫn: 50%
  const quoteCol = figma.createFrame();
  quoteCol.name = 'Quote Text Column';
  quoteCol.layoutMode = 'NONE'; // Dùng NONE để đặt dấu nháy kép tuyệt đối chìm dưới nền
  quoteCol.layoutAlign = 'STRETCH';
  quoteCol.resize(Math.round(safeZone.width * 0.5 - 20), safeZone.height);
  cols.appendChild(quoteCol);

  // 1. Tạo dấu nháy kép khổng lồ chìm dưới nền
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  const quoteMark = figma.createText();
  quoteMark.name = 'Giant Quote Mark';
  quoteMark.fontName = { family: 'Inter', style: 'Bold' };
  quoteMark.fontSize = 280;
  quoteMark.characters = '“';
  quoteMark.fills = [{ type: 'SOLID', color: COLOR.Highlight }];
  quoteMark.opacity = 0.12; // Mờ chìm dưới nền
  quoteMark.x = -20;
  quoteMark.y = safeZone.height / 2 - 220;
  quoteCol.appendChild(quoteMark);

  // 2. Nội dung trích dẫn xếp chồng lên trên dấu nháy kép
  const quoteContent = figma.createFrame();
  quoteContent.name = 'Quote Content Stack';
  quoteContent.layoutMode = 'VERTICAL';
  quoteContent.primaryAxisAlignItems = 'CENTER';
  quoteContent.counterAxisAlignItems = 'MIN';
  quoteContent.itemSpacing = 16;
  quoteContent.fills = [];
  quoteContent.resize(quoteCol.width, quoteCol.height);
  quoteContent.x = 0;
  quoteContent.y = 0;
  quoteCol.appendChild(quoteContent);

  if (heading) {
    // Để hiển thị Quote nghệ thuật, chúng ta đổi sang font chữ Italic (nghiêng)
    const headingCopy = { ...heading, style_level: 2 }; // Giảm size nhẹ cho vừa mắt
    const textNode = await createTitle(quoteContent, context, headingCopy);
    // Áp dụng kiểu chữ nghiêng
    const length = textNode.characters.length;
    try {
      await figma.loadFontAsync({ family: 'Inter', style: 'Italic' });
      textNode.fontName = { family: 'Inter', style: 'Italic' };
    } catch (e) {
      console.warn('Failed to load Inter Italic font:', e);
    }
  }

  // Author trích dẫn (chính là body text)
  if (body) {
    const authorText = `— ${body.text}`;
    const bodyCopy = { ...body, text: authorText };
    await createBody(quoteContent, context, bodyCopy);
  }

  // Cột ảnh bên phải: 50%
  const imgCol = figma.createFrame();
  imgCol.name = 'Quote Image Column';
  imgCol.layoutMode = 'VERTICAL';
  imgCol.layoutAlign = 'INHERIT';
  imgCol.primaryAxisAlignItems = 'CENTER';
  imgCol.counterAxisAlignItems = 'CENTER';
  imgCol.fills = [];
  imgCol.layoutGrow = 1;
  cols.appendChild(imgCol);

  const imgW = Math.round(safeZone.width * 0.5 - 20);
  const imgH = Math.min(safeZone.height - 80, imgW);
  const imgFrame = await createImageFrame(imgCol, context, imgW, imgH);
  
  // Thiết kế ảnh bo tròn dạng Circle (hoặc 100% hình tròn nếu là ảnh chân dung tác giả)
  imgFrame.cornerRadius = imgW / 2;

  await createFooter(parent, context);

  return { variantUsed: variant };
}
