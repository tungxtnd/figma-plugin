/**
 * Grid Layout Dispatcher — Điều phối các biến thể Grid Layout.
 * Hỗ trợ các biến thể: standard, columns2, columns3, cards, pricing, comparison.
 *
 * Ref: Thuật toán C trong Execution Spec §2 + doc 01-grammar-spec.md §1.4
 */

import { LayoutContext, getHeading } from '../core/context';
import { createTitle } from '../components/title';
import { gridVariantRegistry } from './grid/registry';

export async function renderGridLayout(
  parent: FrameNode,
  context: LayoutContext,
  variant: string = 'grid_standard',
): Promise<{ warned: boolean; variantUsed: string }> {
  const { intent } = context;
  const heading = getHeading(intent);
  let warned = false;

  if (!heading) {
    console.warn('[GridLayout] Không có heading component trong intent. Grid slide sẽ thiếu tiêu đề.');
    warned = true;
  }

  // Tìm hàm vẽ tương ứng trong registry phụ của Grid
  const renderer = gridVariantRegistry[variant] || gridVariantRegistry['grid_standard'];
  const result = await renderer(parent, context, variant);

  return {
    warned: warned || result.warned,
    variantUsed: variant,
  };
}
