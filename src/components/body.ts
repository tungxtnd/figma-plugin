/**
 * Body Component — Vẽ text node Body/Paragraph.
 */

import { LayoutContext } from '../core/context';
import { BodyComponent, ListComponent } from '../types';
import { resolveTypography, lineHeightToFigma } from '../engines/theme-engine';
import { LAYOUT } from '../tokens';

export async function createBody(
  parent: FrameNode,
  context: LayoutContext,
  component: BodyComponent,
): Promise<TextNode> {
  const { theme } = context;
  const token = resolveTypography(component.size_level);

  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  const textNode = figma.createText();
  textNode.name = 'Body';
  textNode.fontName = { family: 'Inter', style: 'Regular' };
  textNode.fontSize = token.fontSize;
  textNode.characters = component.text;
  textNode.fills = [{ type: 'SOLID', color: theme.textMuted }];
  textNode.layoutAlign = 'STRETCH';
  textNode.textAutoResize = 'HEIGHT';
  textNode.lineHeight = lineHeightToFigma(token.lineHeight);

  parent.appendChild(textNode);
  return textNode;
}

export async function createListItems(
  parent: FrameNode,
  context: LayoutContext,
  component: ListComponent,
): Promise<FrameNode> {
  const { theme } = context;
  const sizeLevel = component.size_level ?? 'BodyS';
  const token = resolveTypography(sizeLevel);

  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

  const container = figma.createFrame();
  container.name = 'List Items';
  container.layoutMode = 'VERTICAL';
  container.layoutAlign = 'STRETCH';
  container.itemSpacing = LAYOUT.Grid.GapDefault;
  container.fills = [];

  for (let i = 0; i < component.items.length; i++) {
    const row = figma.createFrame();
    row.name = `Item ${i + 1}`;
    row.layoutMode = 'HORIZONTAL';
    row.layoutAlign = 'STRETCH';
    row.itemSpacing = 16;
    row.counterAxisAlignItems = 'MIN';
    row.fills = [];

    // Bullet/Number prefix
    const prefix = figma.createText();
    prefix.fontName = { family: 'Inter', style: 'Bold' };
    prefix.fontSize = token.fontSize;
    prefix.characters = component.style === 'numbered' ? `${i + 1}.` : '•';
    prefix.fills = [{ type: 'SOLID', color: theme.highlight }];
    prefix.textAutoResize = 'WIDTH_AND_HEIGHT';
    row.appendChild(prefix);

    // Item text
    const itemText = figma.createText();
    itemText.fontName = { family: 'Inter', style: 'Regular' };
    itemText.fontSize = token.fontSize;
    itemText.characters = component.items[i];
    itemText.fills = [{ type: 'SOLID', color: theme.textPrimary }];
    itemText.layoutAlign = 'STRETCH';
    itemText.textAutoResize = 'HEIGHT';
    itemText.layoutGrow = 1;
    row.appendChild(itemText);

    container.appendChild(row);
  }

  parent.appendChild(container);
  return container;
}
