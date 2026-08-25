import { LayoutContext } from '../../core/context';
import { renderStandard } from './standard';
import { renderHero } from './hero';
import { renderStatistic } from './statistic';
import { renderQuote } from './quote';
import { renderMinimal, renderCover } from './cover';

export type CenterVariantRenderer = (
  parent: FrameNode,
  context: LayoutContext,
  variant: string,
  fontSizeData: { headingSizeLevel: any; bodySizeLevel: any; warned: boolean }
) => Promise<any>;

export const centerVariantRegistry: Record<string, CenterVariantRenderer> = {
  center_standard: renderStandard,
  center_typography_first: renderStandard,
  center_hero: renderHero,
  center_statistic: renderStatistic,
  center_quote: renderQuote,
  center_minimal: renderMinimal,
  center_cover: renderCover,
};
