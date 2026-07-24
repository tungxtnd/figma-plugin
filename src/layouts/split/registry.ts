import { LayoutContext } from '../../core/context';
import { renderStandard } from './standard';
import { renderFloating } from './floating';
import { renderHero } from './hero';
import { renderBleed } from './bleed';
import { renderEditorial } from './editorial';
import { renderQuote } from './quote';
import { renderStatistics } from './statistics';

export type SplitVariantRenderer = (
  parent: FrameNode,
  context: LayoutContext,
  variant: string,
  ratio: { textWidthPct: number; imageWidthPct: number; adaptiveTriggered: boolean; warned: boolean }
) => Promise<any>;

export const splitVariantRegistry: Record<string, SplitVariantRenderer> = {
  split_standard: renderStandard,
  split_reversed: renderStandard,
  split_card_floating: renderFloating,
  split_hero: renderHero,
  split_bleed: renderBleed,
  split_editorial: renderEditorial,
  split_quote: renderQuote,
  split_statistics: renderStatistics,
};
