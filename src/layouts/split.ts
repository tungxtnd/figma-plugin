/**
 * Split Layout Dispatcher — Điều phối các biến thể Split Layout.
 * Hỗ trợ các biến thể: standard, reversed, floating, hero, bleed, editorial, quote, stats.
 *
 * Ref: Thuật toán A trong Execution Spec §2 + doc 04-variant-spec.md
 */

import { LayoutContext, getHeading, getBodies } from '../core/context';
import { resolveSplitRatio } from '../engines/adaptive-engine';
import { splitVariantRegistry } from './split/registry';

export async function renderSplitLayout(
  parent: FrameNode,
  context: LayoutContext,
  variant: string = 'split_standard',
): Promise<{ adaptiveTriggered: boolean; warned: boolean; variantUsed: string }> {
  const { intent } = context;
  const heading = getHeading(intent);
  const bodies = getBodies(intent);
  const body = bodies[0];

  // Tính tỷ lệ Adaptive trước khi vẽ
  let adaptiveTriggered = false;
  let warned = false;
  let textWidthPct: number = 0.5;
  let imageWidthPct: number = 0.5;

  if (heading && body) {
    const ratio = resolveSplitRatio(context, heading.text, heading.size_level, body.text, body.size_level);
    textWidthPct = ratio.textWidthPct;
    imageWidthPct = ratio.imageWidthPct;
    adaptiveTriggered = ratio.triggeredAdaptive;
    warned = ratio.shouldWarn;
  }

  const ratioData = { textWidthPct, imageWidthPct, adaptiveTriggered, warned };

  // Tìm hàm vẽ tương ứng trong registry phụ
  const renderer = splitVariantRegistry[variant] || splitVariantRegistry['split_standard'];
  const result = await renderer(parent, context, variant, ratioData);

  return {
    adaptiveTriggered,
    warned,
    variantUsed: result?.variantUsed ?? variant,
  };
}
