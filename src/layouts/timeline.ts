/**
 * Timeline Layout Dispatcher — Điều phối các biến thể Timeline Layout.
 * Hỗ trợ các biến thể: standard, horizontal, roadmap, numbered, process, zigzag.
 *
 * Ref: doc 01-grammar-spec.md & doc 04-variant-spec.md
 */

import { LayoutContext, getHeading } from '../core/context';
import { createTitle } from '../components/title';
import { timelineVariantRegistry } from './timeline/registry';

export async function renderTimelineLayout(
  parent: FrameNode,
  context: LayoutContext,
  variant: string = 'timeline_standard',
): Promise<{ warned: boolean; variantUsed: string }> {
  const { intent } = context;
  const heading = getHeading(intent);

  // Tìm hàm vẽ tương ứng trong registry phụ của Timeline
  const renderer = timelineVariantRegistry[variant] || timelineVariantRegistry['timeline_standard'];
  const result = await renderer(parent, context, variant);

  return {
    warned: result.warned,
    variantUsed: variant,
  };
}
