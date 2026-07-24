/**
 * Title Component — Vẽ text node Heading với highlight words và typography token.
 * Mọi styling đến từ ThemeTokenSet, không hardcode màu sắc.
 */

import { LayoutContext } from '../core/context';
import { HeadingComponent } from '../types';
import { TYPOGRAPHY } from '../tokens';
import { resolveTypography, lineHeightToFigma } from '../engines/theme-engine';

export async function createTitle(
  parent: FrameNode,
  context: LayoutContext,
  component: HeadingComponent,
): Promise<TextNode> {
  const { theme } = context;
  const token = resolveTypography(component.size_level);

  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

  const textNode = figma.createText();
  textNode.name = 'Heading';
  textNode.fontName = { family: 'Inter', style: 'Bold' };
  textNode.fontSize = token.fontSize;
  textNode.characters = component.text;
  textNode.fills = [{ type: 'SOLID', color: theme.textPrimary }];
  textNode.layoutAlign = 'STRETCH';
  textNode.textAutoResize = 'HEIGHT';
  textNode.lineHeight = lineHeightToFigma(token.lineHeight);

  // Highlight words
  if (component.highlight_words && component.highlight_words.length > 0) {
    const lower = component.text.toLowerCase();
    for (const word of component.highlight_words) {
      if (!word || word.trim() === "") continue;
      let start = 0;
      while (true) {
        const idx = lower.indexOf(word.toLowerCase(), start);
        if (idx === -1) break;
        textNode.setRangeFills(idx, idx + word.length, [{ type: 'SOLID', color: theme.highlight }]);
        start = idx + word.length;
      }
    }
  }

  parent.appendChild(textNode);
  return textNode;
}
