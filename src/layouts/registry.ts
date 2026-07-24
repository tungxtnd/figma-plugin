/**
 * Layout Registry — Map từ LayoutPattern đến LayoutRenderer.
 * Thêm layout mới: chỉ cần import renderer và gọi register().
 * Không sửa switch-case, không sửa pipeline.
 */

import { LayoutPattern } from '../types';
import { LayoutRenderer } from '../core/context';
import { renderSplitLayout } from './split';
import { renderCenterLayout } from './center';
import { renderGridLayout } from './grid';
import { renderTimelineLayout } from './timeline';

// ─── Registry ─────────────────────────────────────────────────────────────────

const registry = new Map<LayoutPattern, LayoutRenderer>();

registry.set('split', renderSplitLayout);
registry.set('center', renderCenterLayout);
registry.set('grid', renderGridLayout);
registry.set('timeline', renderTimelineLayout);

// ─── Lookup ───────────────────────────────────────────────────────────────────

export function getLayoutRenderer(pattern: LayoutPattern): LayoutRenderer | undefined {
  return registry.get(pattern);
}

export function getSupportedLayouts(): LayoutPattern[] {
  return Array.from(registry.keys());
}
