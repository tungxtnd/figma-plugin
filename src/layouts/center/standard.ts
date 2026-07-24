import { LayoutContext, getHeading, getBodies } from '../../core/context';
import { createTitle } from '../../components/title';
import { createBody } from '../../components/body';
import { createFooter } from '../../components/chrome';
import { resolveTypography, lineHeightToFigma } from '../../engines/theme-engine';
import { LAYOUT } from '../../tokens';
import { QuoteComponent } from '../../types';

export async function renderStandard(
  parent: FrameNode,
  context: LayoutContext,
  variant: string,
  fontSizeData: { headingSizeLevel: any; bodySizeLevel: any; warned: boolean }
): Promise<any> {
  const { intent, theme } = context;
  const heading = getHeading(intent);
  const bodies = getBodies(intent);
  const body = bodies[0];

  // Lấy quote block nếu có
  const quoteBlock = intent.content.find(c => c.type === 'quote') as QuoteComponent | undefined;

  // ── Variant: center_typography_first ──────────────────────────────────────
  if (variant === 'center_typography_first') {
    const content = figma.createFrame();
    content.name = 'Typography First Content';
    content.layoutMode = 'VERTICAL';
    content.layoutAlign = 'STRETCH';
    content.layoutGrow = 1;
    content.primaryAxisAlignItems = 'CENTER';
    content.counterAxisAlignItems = 'CENTER';
    content.itemSpacing = 16;
    content.fills = [];
    parent.appendChild(content);

    if (heading) {
      const forcedHeading = { ...heading, size_level: 'HeadingXL' as const };
      const titleNode = await createTitle(content, context, forcedHeading);
      titleNode.textAlignHorizontal = 'CENTER';
    }
    if (body) {
      const token = resolveTypography('BodyS');
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      const subtleBody = figma.createText();
      subtleBody.name = 'Body Subtle';
      subtleBody.fontName = { family: 'Inter', style: 'Regular' };
      subtleBody.fontSize = token.fontSize;
      subtleBody.characters = body.text;
      subtleBody.fills = [{ type: 'SOLID', color: theme.textMuted, opacity: 0.7 }];
      subtleBody.layoutAlign = 'STRETCH';
      subtleBody.textAutoResize = 'HEIGHT';
      subtleBody.textAlignHorizontal = 'CENTER';
      subtleBody.lineHeight = lineHeightToFigma(token.lineHeight);
      content.appendChild(subtleBody);
    }

    await createFooter(parent, context);
    return { variantUsed: variant };
  }

  // ── Variant: center_standard (default) ────────────────────────────────────
  const content = figma.createFrame();
  content.name = 'Center Content';
  content.layoutMode = 'VERTICAL';
  content.layoutAlign = 'STRETCH';
  content.layoutGrow = 1;
  content.primaryAxisAlignItems = 'CENTER';
  content.counterAxisAlignItems = 'CENTER';
  content.itemSpacing = LAYOUT.Center.TitleBodyGap;
  content.fills = [];
  parent.appendChild(content);

  // Vẽ quote block nếu có
  if (quoteBlock) {
    await renderQuoteBlock(content, context, quoteBlock);
  } else {
    if (heading) {
      const titleNode = await createTitle(content, context, heading);
      titleNode.textAlignHorizontal = 'CENTER';
    }
    if (body) {
      const bodyNode = await createBody(content, context, body);
      bodyNode.textAlignHorizontal = 'CENTER';
    }
  }

  await createFooter(parent, context);
  return { variantUsed: variant };
}

async function renderQuoteBlock(
  parent: FrameNode,
  context: LayoutContext,
  component: QuoteComponent,
): Promise<void> {
  const { theme } = context;

  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Italic' });

  // Dấu nháy kép lớn màu vàng
  const quoteMark = figma.createText();
  quoteMark.fontName = { family: 'Inter', style: 'Bold' };
  quoteMark.fontSize = 80;
  quoteMark.characters = '\u201c';
  quoteMark.fills = [{ type: 'SOLID', color: theme.highlight }];
  quoteMark.textAutoResize = 'WIDTH_AND_HEIGHT';
  quoteMark.textAlignHorizontal = 'CENTER';
  parent.appendChild(quoteMark);

  // Text trích dẫn
  const quoteText = figma.createText();
  quoteText.name = 'Quote Text';
  quoteText.fontName = { family: 'Inter', style: 'Italic' };
  quoteText.fontSize = 36;
  quoteText.characters = component.text;
  quoteText.fills = [{ type: 'SOLID', color: theme.textPrimary }];
  quoteText.layoutAlign = 'STRETCH';
  quoteText.textAutoResize = 'HEIGHT';
  quoteText.textAlignHorizontal = 'CENTER';
  parent.appendChild(quoteText);

  // Author + Title
  if (component.author) {
    const authorText = component.title
      ? `\u2014 ${component.author}, ${component.title}`
      : `\u2014 ${component.author}`;
    const authorNode = figma.createText();
    authorNode.name = 'Quote Author';
    authorNode.fontName = { family: 'Inter', style: 'Bold' };
    authorNode.fontSize = 26;
    authorNode.characters = authorText;
    authorNode.fills = [{ type: 'SOLID', color: theme.textMuted }];
    authorNode.layoutAlign = 'STRETCH';
    authorNode.textAutoResize = 'HEIGHT';
    authorNode.textAlignHorizontal = 'CENTER';
    parent.appendChild(authorNode);
  }
}
