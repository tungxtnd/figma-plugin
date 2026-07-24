/**
 * Center Layout Dispatcher — Điều phối các biến thể Center Layout.
 * Hỗ trợ các biến thể: standard, typography_first, hero, statistic, quote, minimal, cover.
 *
 * Ref: Thuật toán B trong Execution Spec §2 + doc 04-variant-spec.md
 */

import { LayoutContext, getHeading, getBodies } from '../core/context';
import { resolveOptimalFontSizes } from '../engines/adaptive-engine';
import { centerVariantRegistry } from './center/registry';

export async function renderCenterLayout(
  parent: FrameNode,
  context: LayoutContext,
  variant: string = 'center_standard',
): Promise<{ warned: boolean; variantUsed: string }> {
  const { intent } = context;
  const heading = getHeading(intent);
  const bodies = getBodies(intent);
  const body = bodies[0];

  // Tính kích thước font tối ưu trước khi vẽ
  let warned = false;
  let headingSizeLevel = heading?.size_level || 'HeadingM';
  let bodySizeLevel = body?.size_level || 'BodyS';

  if (heading && body) {
    const resolved = resolveOptimalFontSizes(
      context, heading.text, heading.size_level, body.text, body.size_level, 'center'
    );
    heading.size_level = resolved.headingSizeLevel;
    body.size_level = resolved.bodySizeLevel;
    headingSizeLevel = resolved.headingSizeLevel;
    bodySizeLevel = resolved.bodySizeLevel;
    warned = resolved.warned;
  }

  const fontSizeData = { headingSizeLevel, bodySizeLevel, warned };

  // Tìm hàm vẽ tương ứng trong registry phụ
  const renderer = centerVariantRegistry[variant] || centerVariantRegistry['center_standard'];
  const result = await renderer(parent, context, variant, fontSizeData);

  return {
    warned,
    variantUsed: result?.variantUsed ?? variant,
  };
}
