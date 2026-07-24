/**
 * BaseLayoutRenderer — Abstract class cho tất cả Layout Renderers.
 * Định nghĩa interface render() + các shared helpers dùng chung.
 *
 * Ref: doc 12-renderer-api.md
 */

import { LayoutContext } from './context';
import {
  DesignIntent,
  HeadingComponent,
  BodyComponent,
  ListComponent,
  StatisticComponent,
  QuoteComponent,
  BadgeComponent,
} from '../types';
import { resolveTypography, lineHeightToFigma } from '../engines/theme-engine';
import { LAYOUT, CANVAS, COLOR } from '../tokens';
import { createImageFrame } from '../components/image';

// ─── Render Metadata ──────────────────────────────────────────────────────────

export interface RenderMeta {
  adaptiveTriggered: boolean;
  warned: boolean;
  variantUsed: string;
}

// ─── Base Abstract Class ──────────────────────────────────────────────────────

export abstract class BaseLayoutRenderer {
  /** Tên layout đăng ký trong Registry (ví dụ: "split") */
  abstract readonly layoutName: string;

  /** Danh sách variant được hỗ trợ */
  abstract readonly supportedVariants: string[];

  /**
   * Hàm render chính — mỗi subclass implement logic layout riêng.
   */
  abstract render(
    parent: FrameNode,
    context: LayoutContext,
    intent: DesignIntent,
    variant: string,
  ): Promise<RenderMeta>;

  // ─── Shared Render Helpers ──────────────────────────────────────────────────

  /** Vẽ Heading với highlight_words và typography token. */
  protected async renderHeading(
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

    if (component.highlight_words?.length) {
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

  /** Vẽ Body text block. */
  protected async renderBody(
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

  /** Vẽ List block (checklist hoặc numbered). */
  protected async renderList(
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

      const prefix = figma.createText();
      prefix.fontName = { family: 'Inter', style: 'Bold' };
      prefix.fontSize = token.fontSize;
      prefix.characters = component.style === 'numbered' ? `${i + 1}.` : '✓';
      prefix.fills = [{ type: 'SOLID', color: theme.highlight }];
      prefix.textAutoResize = 'WIDTH_AND_HEIGHT';
      row.appendChild(prefix);

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

  /**
   * Vẽ Quote block — text in nghiêng + dấu nháy kép vàng + author/title.
   * Ref: doc 01-grammar-spec.md §1.5
   */
  protected async renderQuote(
    parent: FrameNode,
    context: LayoutContext,
    component: QuoteComponent,
  ): Promise<FrameNode> {
    const { theme } = context;

    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

    const container = figma.createFrame();
    container.name = 'Quote Block';
    container.layoutMode = 'VERTICAL';
    container.layoutAlign = 'STRETCH';
    container.itemSpacing = 16;
    container.fills = [];

    // Dấu nháy kép lớn màu vàng
    const quoteMark = figma.createText();
    quoteMark.fontName = { family: 'Inter', style: 'Bold' };
    quoteMark.fontSize = 80;
    quoteMark.characters = '\u201c';
    quoteMark.fills = [{ type: 'SOLID', color: theme.highlight }];
    quoteMark.textAutoResize = 'WIDTH_AND_HEIGHT';
    container.appendChild(quoteMark);

    // Text trích dẫn
    const quoteText = figma.createText();
    quoteText.name = 'Quote Text';
    quoteText.fontName = { family: 'Inter', style: 'Regular' };
    quoteText.fontSize = 36;
    quoteText.characters = component.text;
    quoteText.fills = [{ type: 'SOLID', color: theme.textPrimary }];
    quoteText.layoutAlign = 'STRETCH';
    quoteText.textAutoResize = 'HEIGHT';
    container.appendChild(quoteText);

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
      container.appendChild(authorNode);
    }

    parent.appendChild(container);
    return container;
  }

  /**
   * Vẽ Statistic block — số lớn nổi bật + metric label + trend + caption.
   * Ref: doc 01-grammar-spec.md §1.4
   */
  protected async renderStatistic(
    parent: FrameNode,
    context: LayoutContext,
    component: StatisticComponent,
  ): Promise<FrameNode> {
    const { theme } = context;

    await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

    const card = figma.createFrame();
    card.name = 'Stat Block';
    card.layoutMode = 'VERTICAL';
    card.layoutAlign = 'INHERIT';
    card.layoutGrow = 1;
    card.itemSpacing = 8;
    card.paddingTop = 24;
    card.paddingBottom = 24;
    card.paddingLeft = 24;
    card.paddingRight = 24;
    card.cornerRadius = CANVAS.BorderRadius;
    card.fills = [{ type: 'SOLID', color: theme.cardBg }];

    // Value số lớn màu vàng
    const valueNode = figma.createText();
    valueNode.name = 'Stat Value';
    valueNode.fontName = { family: 'Inter', style: 'Bold' };
    valueNode.fontSize = 64;
    valueNode.characters = component.value;
    valueNode.fills = [{ type: 'SOLID', color: theme.highlight }];
    valueNode.textAutoResize = 'WIDTH_AND_HEIGHT';
    card.appendChild(valueNode);

    // Metric label
    const metricNode = figma.createText();
    metricNode.name = 'Stat Metric';
    metricNode.fontName = { family: 'Inter', style: 'Regular' };
    metricNode.fontSize = 28;
    metricNode.characters = component.metric;
    metricNode.fills = [{ type: 'SOLID', color: theme.textPrimary }];
    metricNode.layoutAlign = 'STRETCH';
    metricNode.textAutoResize = 'HEIGHT';
    card.appendChild(metricNode);

    // Trend (nếu có)
    if (component.trend) {
      const trendNode = figma.createText();
      trendNode.name = 'Stat Trend';
      trendNode.fontName = { family: 'Inter', style: 'Bold' };
      trendNode.fontSize = 24;
      trendNode.characters = component.trend;
      trendNode.fills = [{ type: 'SOLID', color: COLOR.Accent.Green }];
      trendNode.textAutoResize = 'WIDTH_AND_HEIGHT';
      card.appendChild(trendNode);
    }

    // Caption (nếu có)
    if (component.caption) {
      const captionNode = figma.createText();
      captionNode.name = 'Stat Caption';
      captionNode.fontName = { family: 'Inter', style: 'Regular' };
      captionNode.fontSize = 22;
      captionNode.characters = component.caption;
      captionNode.fills = [{ type: 'SOLID', color: theme.textMuted }];
      captionNode.layoutAlign = 'STRETCH';
      captionNode.textAutoResize = 'HEIGHT';
      card.appendChild(captionNode);
    }

    parent.appendChild(card);
    return card;
  }

  /**
   * Vẽ Badge block — nhãn nhỏ màu sắc theo badgeType.
   * Ref: doc 01-grammar-spec.md §1.6
   */
  protected async renderBadge(
    parent: FrameNode,
    context: LayoutContext,
    component: BadgeComponent,
  ): Promise<FrameNode> {
    await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

    const badgeColors = {
      primary: COLOR.Highlight,
      warning: COLOR.Accent.Red,
      success: COLOR.Accent.Green,
    } as const;

    const badge = figma.createFrame();
    badge.name = 'Badge';
    badge.layoutMode = 'HORIZONTAL';
    badge.primaryAxisSizingMode = 'AUTO';
    badge.counterAxisSizingMode = 'AUTO';
    badge.paddingTop = 8;
    badge.paddingBottom = 8;
    badge.paddingLeft = 16;
    badge.paddingRight = 16;
    badge.cornerRadius = 8;
    const badgeColor = badgeColors[component.badgeType];
    badge.fills = [{ type: 'SOLID', color: badgeColor, opacity: 0.15 } as SolidPaint];

    const badgeText = figma.createText();
    badgeText.fontName = { family: 'Inter', style: 'Bold' };
    badgeText.fontSize = 22;
    badgeText.characters = component.text.toUpperCase();
    badgeText.fills = [{ type: 'SOLID', color: badgeColor }];
    badgeText.textAutoResize = 'WIDTH_AND_HEIGHT';
    badge.appendChild(badgeText);

    parent.appendChild(badge);
    return badge;
  }

  /** Vẽ Image frame — wrapper dùng chung. */
  protected async renderImage(
    parent: FrameNode,
    context: LayoutContext,
    width: number,
    height: number,
  ): Promise<FrameNode> {
    return createImageFrame(parent, context, width, height);
  }
}
