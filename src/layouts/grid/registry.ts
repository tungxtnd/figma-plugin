import { LayoutContext } from '../../core/context';
import { renderStandard } from './standard';
import { renderColumns2 } from './columns2';
import { renderColumns3 } from './columns3';
import { renderCards } from './cards';
import { renderPricing } from './pricing';
import { renderComparison } from './comparison';

export type GridVariantRenderer = (
  parent: FrameNode,
  context: LayoutContext,
  variant: string
) => Promise<{ warned: boolean }>;

export const gridVariantRegistry: Record<string, GridVariantRenderer> = {
  grid_standard: renderStandard,
  grid_columns2: renderColumns2,
  grid_columns3: renderColumns3,
  grid_cards: renderCards,
  grid_pricing: renderPricing,
  grid_comparison: renderComparison,
};
