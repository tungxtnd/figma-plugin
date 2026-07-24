import { LayoutContext } from '../../core/context';
import { renderStandard } from './standard';
import { renderHorizontal } from './horizontal';
import { renderRoadmap } from './roadmap';
import { renderNumbered } from './numbered';
import { renderProcess } from './process';
import { renderZigzag } from './zigzag';

export type TimelineVariantRenderer = (
  parent: FrameNode,
  context: LayoutContext,
  variant: string
) => Promise<{ warned: boolean }>;

export const timelineVariantRegistry: Record<string, TimelineVariantRenderer> = {
  timeline_standard: renderStandard,
  timeline_horizontal: renderHorizontal,
  timeline_roadmap: renderRoadmap,
  timeline_numbered: renderNumbered,
  timeline_process: renderProcess,
  timeline_zigzag: renderZigzag,
};
