/**
 * Adaptive Engine — Đo đạc và tính toán tỷ lệ layout trước khi vẽ.
 * Nguyên tắc: Tính toán trước, vẽ sau. Không vẽ xong rồi mới sửa.
 *
 * Ref: design_engine_execution_specification.md §2 (Adaptive Composition)
 */

import { CANVAS, LAYOUT, TYPOGRAPHY, SizeLevel, BODY_SIZE_LEVELS, HEADING_SIZE_LEVELS } from '../tokens';
import { LayoutContext } from '../core/context';
import { LayoutPattern } from '../types';

// ─── Text Height Estimation ───────────────────────────────────────────────────

/**
 * Ước tính chiều cao của một khối text dựa trên số ký tự và font size.
 * Đây là phép ước tính trước khi Figma render (không thể đo chính xác trước).
 * Công thức: (số ký tự / chars per line) * line height px
 */
export function estimateTextHeight(
  text: string,
  sizeLevel: SizeLevel,
  containerWidth: number,
): number {
  const token = TYPOGRAPHY[sizeLevel];
  const paragraphs = text.split('\n');
  let totalLines = 0;
  
  // Proportional font average char width multiplier (0.60 is safer for Vietnamese accents/caps)
  const avgCharWidth = token.fontSize * 0.60;
  const charsPerLine = Math.floor(containerWidth / avgCharWidth);
  const safeCharsPerLine = Math.max(charsPerLine, 1);

  for (const para of paragraphs) {
    if (para.trim() === '') {
      totalLines += 1; // Empty paragraph is a line break
    } else {
      totalLines += Math.ceil(para.length / safeCharsPerLine);
    }
  }

  const lineHeightPx = token.fontSize * token.lineHeight;
  return totalLines * lineHeightPx;
}

// ─── Split Ratio Resolver ─────────────────────────────────────────────────────

export interface SplitRatio {
  textWidthPct: number;   // 0.0 – 1.0
  imageWidthPct: number;  // 0.0 – 1.0
  triggeredAdaptive: boolean;
}

/**
 * Tính toán tỷ lệ Text/Image cho Split Layout.
 * Bắt đầu từ 50/50, nếu text quá dài thì chuyển sang 60/40.
 * Nếu 60/40 vẫn chưa đủ → trả về warn flag.
 *
 * Ref: Thuật toán A trong Execution Spec
 */
export function resolveSplitRatio(
  context: LayoutContext,
  headingText: string,
  headingSizeLevel: SizeLevel,
  bodyText: string,
  bodySizeLevel: SizeLevel,
): SplitRatio & { shouldWarn: boolean } {
  const safeW = context.safeZone.width;
  const safeH = context.safeZone.height;
  const gap = LAYOUT.Split.GapBetweenCols;

  // Bước 1: Tính với tỷ lệ 50/50
  const defaultRatio = LAYOUT.Split.DefaultRatio;
  const textWidth50 = safeW * defaultRatio - gap / 2;
  const hHeight = estimateTextHeight(headingText, headingSizeLevel, textWidth50);
  const bHeight = estimateTextHeight(bodyText, bodySizeLevel, textWidth50);
  const totalHeight50 = hHeight + bHeight + 32; // 32px gap between heading/body

  if (totalHeight50 <= safeH) {
    return { textWidthPct: defaultRatio, imageWidthPct: 1 - defaultRatio, triggeredAdaptive: false, shouldWarn: false };
  }

  // Bước 2: Thử 60/40
  const adaptiveRatio = LAYOUT.Split.AdaptiveRatio;
  const textWidth60 = safeW * adaptiveRatio - gap / 2;
  const hHeight2 = estimateTextHeight(headingText, headingSizeLevel, textWidth60);
  const bHeight2 = estimateTextHeight(bodyText, bodySizeLevel, textWidth60);
  const totalHeight60 = hHeight2 + bHeight2 + 32;

  if (totalHeight60 <= safeH) {
    return { textWidthPct: adaptiveRatio, imageWidthPct: 1 - adaptiveRatio, triggeredAdaptive: true, shouldWarn: false };
  }

  // Bước 3: Vẫn không đủ → cảnh báo, giữ 60/40
  return { textWidthPct: adaptiveRatio, imageWidthPct: 1 - adaptiveRatio, triggeredAdaptive: true, shouldWarn: true };
}

// ─── Font Scale Down ──────────────────────────────────────────────────────────

/**
 * Hạ size_level xuống một bậc cho Center/Grid khi text quá dài.
 * BodyL → BodyM → BodyS → (không hạ nữa, emit warn)
 *
 * Ref: Thuật toán B & C trong Execution Spec
 */
export function scaleFontDown(current: SizeLevel): { result: SizeLevel; canScaleMore: boolean } {
  const idx = BODY_SIZE_LEVELS.indexOf(current as any);
  if (idx < 0 || idx >= BODY_SIZE_LEVELS.length - 1) {
    return { result: current, canScaleMore: false };
  }
  return { result: BODY_SIZE_LEVELS[idx + 1], canScaleMore: idx + 1 < BODY_SIZE_LEVELS.length - 1 };
}

/**
 * Tìm size_level tối ưu cho Center Layout.
 * Trả về size_level đã điều chỉnh và flag shouldWarn nếu đã hạ xuống mức thấp nhất vẫn tràn.
 */
export function resolveBodySizeForCenter(
  context: LayoutContext,
  headingText: string,
  headingSizeLevel: SizeLevel,
  bodyText: string,
  initialBodySizeLevel: SizeLevel,
): { bodySizeLevel: SizeLevel; shouldWarn: boolean } {
  const maxH = context.safeZone.height;
  const maxW = LAYOUT.Center.MaxContentWidth;
  const titleBodyGap = LAYOUT.Center.TitleBodyGap;

  let currentSize = initialBodySizeLevel;
  for (let attempt = 0; attempt < 3; attempt++) {
    const hH = estimateTextHeight(headingText, headingSizeLevel, maxW);
    const bH = estimateTextHeight(bodyText, currentSize, maxW);
    if (hH + bH + titleBodyGap <= maxH) {
      return { bodySizeLevel: currentSize, shouldWarn: false };
    }
    const scaled = scaleFontDown(currentSize);
    currentSize = scaled.result;
    if (!scaled.canScaleMore) break;
  }
  // Đã hạ hết bậc mà vẫn tràn
  return { bodySizeLevel: currentSize, shouldWarn: true };
}

// ─── Heading Scale Down & Optimal Size Resolvers ──────────────────────────────

/**
 * Hạ size_level xuống một bậc cho Heading.
 * HeadingXL → HeadingL → HeadingM → (không hạ nữa)
 */
export function scaleHeadingDown(current: SizeLevel): { result: SizeLevel; canScaleMore: boolean } {
  const idx = HEADING_SIZE_LEVELS.indexOf(current as any);
  if (idx < 0 || idx >= HEADING_SIZE_LEVELS.length - 1) {
    return { result: current, canScaleMore: false };
  }
  return { result: HEADING_SIZE_LEVELS[idx + 1], canScaleMore: idx + 1 < HEADING_SIZE_LEVELS.length - 1 };
}

/**
 * Tìm size_level tối ưu cho cả Heading và Body để tránh tràn.
 * Trả về size_level tối ưu và warned flag nếu vẫn tràn sau khi hạ hết cỡ.
 */
export function resolveOptimalFontSizes(
  context: LayoutContext,
  headingText: string,
  initialHeadingSizeLevel: SizeLevel,
  bodyText: string,
  initialBodySizeLevel: SizeLevel,
  layout: LayoutPattern
): { headingSizeLevel: SizeLevel; bodySizeLevel: SizeLevel; warned: boolean } {
  const maxH = context.safeZone.height;
  
  // Chiều rộng tối đa của content tùy theo layout
  let maxW = context.safeZone.width;
  let gap = 24;
  
  if (layout === 'center') {
    maxW = LAYOUT.Center.MaxContentWidth;
    gap = LAYOUT.Center.TitleBodyGap;
  } else if (layout === 'split') {
    const ratio = LAYOUT.Split.DefaultRatio;
    maxW = context.safeZone.width * ratio - LAYOUT.Split.GapBetweenCols / 2;
    gap = 24;
  } else if (layout === 'grid') {
    gap = LAYOUT.Grid.GapDefault;
  } else if (layout === 'timeline') {
    gap = LAYOUT.Timeline.StepGap;
  }

  let currentHeadingSize = initialHeadingSizeLevel;
  let currentBodySize = initialBodySizeLevel;
  let warned = false;

  // Thuật toán: Thử hạ body trước, sau đó hạ heading
  for (let attempt = 0; attempt < 6; attempt++) {
    const hH = estimateTextHeight(headingText, currentHeadingSize, maxW);
    const bH = estimateTextHeight(bodyText, currentBodySize, maxW);
    
    if (hH + bH + gap <= maxH) {
      return { headingSizeLevel: currentHeadingSize, bodySizeLevel: currentBodySize, warned: false };
    }

    // Ưu tiên hạ body size trước
    const bodyIdx = BODY_SIZE_LEVELS.indexOf(currentBodySize as any);
    if (bodyIdx >= 0 && bodyIdx < BODY_SIZE_LEVELS.length - 1) {
      currentBodySize = BODY_SIZE_LEVELS[bodyIdx + 1];
    } else {
      // Body đã ở mức nhỏ nhất (BodyS) hoặc không có, bắt đầu hạ heading
      const headingIdx = HEADING_SIZE_LEVELS.indexOf(currentHeadingSize as any);
      if (headingIdx >= 0 && headingIdx < HEADING_SIZE_LEVELS.length - 1) {
        currentHeadingSize = HEADING_SIZE_LEVELS[headingIdx + 1];
      } else {
        // Cả hai đã ở mức tối thiểu mà vẫn tràn
        warned = true;
        break;
      }
    }
  }

  return { headingSizeLevel: currentHeadingSize, bodySizeLevel: currentBodySize, warned };
}

