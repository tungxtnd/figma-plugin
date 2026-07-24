/**
 * Quality Engine — Phát hiện overflow bằng absoluteBoundingBox thực tế của Figma,
 * tính toán metrics chi tiết và chấm điểm chất lượng theo công thức chuẩn.
 *
 * Ref: design_engine_execution_specification.md §4
 */

import { RenderResult, WarningCode, LayoutMetrics } from '../types';
import { CANVAS } from '../tokens';

// ─── Overflow Detection ───────────────────────────────────────────────────────

export interface BoundsViolation {
  nodeName: string;
  nodeType: string;
  overflowPx: number;
  axis: 'horizontal' | 'vertical';
  isSafezone: boolean;
}

/**
 * Quét toàn bộ children của slide để tìm các node bị tràn ra ngoài bounds hoặc safezone.
 */
export function detectOverflow(slide: FrameNode): BoundsViolation[] {
  const violations: BoundsViolation[] = [];
  const slideRight = slide.x + slide.width;
  const slideBottom = slide.y + slide.height;

  // Safezone bounds
  const safezoneLeft = slide.x + CANVAS.Padding;
  const safezoneRight = slide.x + slide.width - CANVAS.Padding;
  const safezoneTop = slide.y + CANVAS.Padding + 60;
  const safezoneBottom = slide.y + slide.height - CANVAS.Padding - 40;

  function scanNode(node: SceneNode): void {
    // Không kiểm tra các node được thiết kế để nằm ngoài safezone theo chủ ý:
    // - Ambient Orbs: hiệu ứng trang trí nền
    // - Brand Logo: nằm ở vùng padding phía trỬn theo thiết kế
    // - Footer: nằm ở vùng padding phía dưới theo thiết kế
    if (
      node.name.startsWith('Ambient Orb')
      || node.name.startsWith('Orb')
      || node.name === 'Brand Logo'
      || node.name === 'Footer'
    ) return;

    if (!('absoluteBoundingBox' in node) || !node.absoluteBoundingBox) return;
    const b = node.absoluteBoundingBox;

    // 1. Kiểm tra tràn Canvas cứng (Overflow)
    const canvasRightOverflow = (b.x + b.width) - slideRight;
    const canvasBottomOverflow = (b.y + b.height) - slideBottom;

    if (canvasRightOverflow > 2) {
      violations.push({ nodeName: node.name, nodeType: node.type, overflowPx: canvasRightOverflow, axis: 'horizontal', isSafezone: false });
    }
    if (canvasBottomOverflow > 2) {
      violations.push({ nodeName: node.name, nodeType: node.type, overflowPx: canvasBottomOverflow, axis: 'vertical', isSafezone: false });
    }

    // 2. Kiểm tra tràn Safezone (Safezone Overflow)
    if (b.x < safezoneLeft) {
      violations.push({ nodeName: node.name, nodeType: node.type, overflowPx: safezoneLeft - b.x, axis: 'horizontal', isSafezone: true });
    }
    if (b.x + b.width > safezoneRight) {
      violations.push({ nodeName: node.name, nodeType: node.type, overflowPx: (b.x + b.width) - safezoneRight, axis: 'horizontal', isSafezone: true });
    }
    if (b.y < safezoneTop) {
      violations.push({ nodeName: node.name, nodeType: node.type, overflowPx: safezoneTop - b.y, axis: 'vertical', isSafezone: true });
    }
    if (b.y + b.height > safezoneBottom) {
      violations.push({ nodeName: node.name, nodeType: node.type, overflowPx: (b.y + b.height) - safezoneBottom, axis: 'vertical', isSafezone: true });
    }

    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        scanNode(child);
      }
    }
  }

  if ('children' in slide) {
    for (const child of slide.children) {
      scanNode(child);
    }
  }

  return violations;
}

// ─── Metrics Computation ──────────────────────────────────────────────────────

/**
 * Tính toán LayoutMetrics của slide dựa trên kích thước các text và image nodes.
 */
export function computeLayoutMetrics(
  slide: FrameNode,
  overflowCount: number,
  fontScaleLevel: number
): LayoutMetrics {
  const safeW = CANVAS.Size - CANVAS.Padding * 2;
  const safeH = CANVAS.Size - CANVAS.Padding * 2 - 100;
  const safeArea = safeW * safeH;

  let textSum = 0;
  let imageSum = 0;

  function collectAreas(node: SceneNode) {
    if (node.name.startsWith('Ambient Orb') || node.name.startsWith('Orb')) return;
    
    if (node.type === 'TEXT') {
      textSum += node.width * node.height;
    } else if (node.name === 'Asset Frame' || node.name === 'Hero Image' || node.type === 'RECTANGLE') {
      imageSum += node.width * node.height;
    }

    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        collectAreas(child);
      }
    }
  }

  for (const child of slide.children) {
    collectAreas(child);
  }

  const textCoverage = parseFloat((textSum / safeArea).toFixed(3));
  const imageCoverage = parseFloat((imageSum / safeArea).toFixed(3));
  const whitespace = parseFloat(Math.max(0, 1.0 - (textCoverage + imageCoverage)).toFixed(3));

  return {
    textCoverage,
    imageCoverage,
    whitespace,
    overflowCount,
    fontScaleLevel
  };
}

// ─── Quality Scorer ───────────────────────────────────────────────────────────

export interface QualityInput {
  slideId: string;
  jobId: string;
  renderId: string;
  slide: FrameNode;
  preflightWarnings: WarningCode[];
  assetFallbackUsed: boolean;
  adaptiveResizeTriggered: boolean;
  fontScaleLevel: number;
}

/**
 * Chấm điểm chất lượng slide theo công thức chuẩn trong Master Spec.
 * Base score = 100.
 */
export function calculateQualityScore(input: QualityInput): RenderResult {
  let score = 100;
  const warnings: WarningCode[] = [...input.preflightWarnings];

  const boundsViolations = detectOverflow(input.slide);
  const canvasOverflows = boundsViolations.filter(v => !v.isSafezone);
  const safezoneOverflows = boundsViolations.filter(v => v.isSafezone);

  const hasCanvasOverflow = canvasOverflows.length > 0;

  // 1. Trừ điểm Canvas Overflow (-50)
  if (hasCanvasOverflow) {
    score -= 50;
    warnings.push(WarningCode.TEXT_OVERFLOW);
  }

  // 2. Trừ điểm Safezone Overflow (-20)
  if (safezoneOverflows.length > 0 && !warnings.includes(WarningCode.SAFEZONE_OVERFLOW)) {
    score -= 20;
    warnings.push(WarningCode.SAFEZONE_OVERFLOW);
  }

  // 3. Trừ điểm Asset Fallback (-15)
  if (input.assetFallbackUsed) {
    score -= 15;
    warnings.push(WarningCode.IMAGE_MISSING);
  }

  // 4. Trừ điểm Adaptive Resize (-10)
  if (input.adaptiveResizeTriggered) {
    score -= 10;
    warnings.push(WarningCode.FONT_SCALE_MIN);
  }

  // 5. Trừ điểm Font Scale Level (-10 nếu ở mức tối thiểu)
  if (input.fontScaleLevel >= 2) { // 2 = BodyS
    score -= 10;
    if (!warnings.includes(WarningCode.FONT_SCALE_MIN)) {
      warnings.push(WarningCode.FONT_SCALE_MIN);
    }
  }

  score = Math.max(0, score);

  // Đảm bảo không trùng các mã cảnh báo
  const uniqueWarnings = Array.from(new Set(warnings));

  // Đo đạc Metrics
  const metrics = computeLayoutMetrics(
    input.slide,
    boundsViolations.length,
    input.fontScaleLevel
  );

  return {
    version: '1.0',
    renderId: input.renderId,
    jobId: input.jobId,
    slideId: input.slideId,
    score,
    overflow: hasCanvasOverflow,
    warnings: uniqueWarnings,
    metrics,
    pluginVersion: '1.0.2'
  };
}
