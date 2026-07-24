/**
 * Rendering Pipeline Orchestrator v1.0
 * Điều phối luồng thực thi: Context -> Constraint -> Render -> Quality Scorer
 *
 * Ref: design_engine_execution_specification.md §1 (Pipeline Thực Thi)
 */

import { DesignJob, RenderResult, DesignIntent, WarningCode, Component } from '../types';
import { LayoutContext, ImageAsset } from './context';
import { resolveTheme } from '../engines/theme-engine';
import { preflightCheck, sanitizeContentBlock, ConstraintViolation } from '../constraint-engine';
import { getLayoutRenderer } from '../layouts/registry';
import { calculateQualityScore } from '../engines/quality-engine';
import { addAmbientOrbs, createLogo } from '../components/chrome';
import { assetFallbackUsed, resetFallbackFlag } from '../components/image';
import { CANVAS } from '../tokens';
import { pickVariant } from '../engines/variant-engine';
import { processGrammar } from './grammar-parser';

export interface PipelineResult {
  slideNode: FrameNode;
  renderResult: RenderResult;
  variantUsed: string;  // Cho slide tiếp theo biết variant nào vừa được dùng
}

/** Mapping các lỗi của Constraint Engine sang WarningCode thô */
function mapViolationToWarning(code: string): WarningCode {
  if (code === 'LIMIT_EXCEEDED') return WarningCode.TOO_MANY_ITEMS;
  if (code === 'TEXT_LENGTH') return WarningCode.TEXT_OVERFLOW;
  return WarningCode.TEXT_OVERFLOW;
}

/** Helper sinh renderId độc nhất vô nhị cho lượt render này */
function generateRenderId(assetId: string): string {
  return `render-${assetId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/**
 * Hàm chạy pipeline xử lý và render slides động theo Design Engine v1.0
 */
export async function runRenderingPipeline(
  job: DesignJob,
  intent: DesignIntent,
  images: ImageAsset[],
  logoBytes?: Uint8Array,
  bgBytes?: Uint8Array,
  prevVariantName?: string,  // Variant đã dùng ở slide trước (Variant Engine constraint)
): Promise<PipelineResult> {
  
  // ── Step 1-3: Grammar Parser, Normalize Layer, Capability Check ─────────────
  if (intent.content) {
    const processed = processGrammar(intent.content, intent.layout_pattern);
    const normalizedContent: Component[] = [];
    if (processed.heading) normalizedContent.push(processed.heading);
    normalizedContent.push(...processed.bodies);
    normalizedContent.push(...processed.lists);
    normalizedContent.push(...processed.statistics);
    normalizedContent.push(...processed.quotes);
    normalizedContent.push(...processed.badges);
    intent.content = normalizedContent;
  }

  // ── Step 1: Pre-flight & Constraint Checks ──────────────────────────────────
  const allViolations: ConstraintViolation[] = [];
  
  // Run Pre-flight Checks (Hard limits / Reject)
  const preflight = preflightCheck(intent);
  allViolations.push(...preflight.violations);
  
  if (preflight.shouldAbort) {
    const rejects = preflight.violations.filter(v => v.severity === 'reject').map(v => v.message);
    throw new Error(`Pre-flight Reject: ${rejects.join(', ')}`);
  }
  
  // Sanitize Content (Override / Case capitalization / Size Level Map)
  let maxScaledLevel = 0; // Tracking xem có bị scale down font không
  if (intent.content) {
    for (const block of intent.content) {
      if (block.type === 'heading' || block.type === 'body' || block.type === 'list') {
        const sanitized = sanitizeContentBlock(block as any);
        (block as any).text = sanitized.text;
        (block as any).size_level = sanitized.sizeLevel;
        allViolations.push(...sanitized.violations);

        // Tracking font scale down level
        if (sanitized.sizeLevel === 'BodyM') maxScaledLevel = Math.max(maxScaledLevel, 1);
        if (sanitized.sizeLevel === 'BodyS') maxScaledLevel = Math.max(maxScaledLevel, 2);
      }
    }
  }

  // ── Step 2: Build Layout Context ───────────────────────────────────────────
  const theme = resolveTheme(intent.theme);
  
  const canvasW = CANVAS.Size;
  const canvasH = CANVAS.Size;
  const padding = CANVAS.Padding;
  
  const logoPosition = job.renderedPayload?.logoPosition || 'top-center';
  const safeZoneTop = logoPosition === 'top-center' ? (padding + 60) : padding;
  const safeZoneBottom = logoPosition === 'top-center' ? (padding + 40) : (padding + 100);

  const context: LayoutContext = {
    intent,
    theme,
    canvas: { width: canvasW, height: canvasH },
    safeZone: {
      top: safeZoneTop,
      bottom: safeZoneBottom,
      left: padding,
      right: padding,
      width: canvasW - (padding * 2),
      height: canvasH - (padding * 2) - 100 // Safezone thực tế trừ logo & footer
    },
    assets: {
      background: bgBytes,
      logo: logoBytes,
      images: images
    },
    logoPosition: logoPosition as any
  };

  // ── Step 3: Initialize Frame & Chrome elements ─────────────────────────────
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  
  const slide = figma.createFrame();
  slide.name = `Slide_${job.orderIndex + 1}_IntentV1_${job.postId}`;
  slide.resize(canvasW, canvasH);
  
  // Set Background
  if (bgBytes) {
    const bgImg = figma.createImage(bgBytes);
    slide.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: bgImg.hash }];
  } else {
    slide.fills = [{ type: 'SOLID', color: theme.background }];
  }
  
  // Slide outer layout setup
  slide.layoutMode = 'VERTICAL';
  slide.primaryAxisSizingMode = 'FIXED';
  slide.counterAxisSizingMode = 'FIXED';
  slide.paddingTop = padding;
  slide.paddingBottom = padding;
  slide.paddingLeft = padding;
  slide.paddingRight = padding;
  slide.itemSpacing = CANVAS.Spacing;

  // Thêm ambient glow orbs đằng sau
  addAmbientOrbs(slide, context);

  // Thêm Logo ở trên cùng nếu vị trí được cấu hình ở top-center
  if (logoPosition === 'top-center') {
    await createLogo(slide, context);
  }

  // ── Step 4: Variant Picker + Dispatch Render to Layout Registry ──────────
  
  // Hỗ trợ V2 layoutCandidates nếu tồn tại (chỉ đọc thêm, fallback nếu không có)
  if (intent.layoutCandidates && Array.isArray(intent.layoutCandidates) && intent.layoutCandidates.length > 0) {
    const sortedCandidates = [...intent.layoutCandidates].sort((a, b) => b.score - a.score);
    if (sortedCandidates[0] && sortedCandidates[0].layout) {
      const bestLayout = sortedCandidates[0].layout;
      if (bestLayout !== intent.layout_pattern) {
        console.log(`[Pipeline V2] Parsed layoutCandidates. Overriding layout_pattern from '${intent.layout_pattern}' to highest score layout: '${bestLayout}' (Score: ${sortedCandidates[0].score})`);
        intent.layout_pattern = bestLayout as any;
      }
    }
  }

  const renderer = getLayoutRenderer(intent.layout_pattern);
  if (!renderer) {
    throw new Error(`Unsupported layout pattern: "${intent.layout_pattern}"`);
  }

  // Chọn variant tối ưu, tránh trùng với slide liền trước
  let chosenVariant = pickVariant(intent, prevVariantName, job.orderIndex);

  // Hỗ trợ preferredVariants V2 nếu tồn tại (chỉ đọc thêm, fallback nếu không có)
  if (intent.preferredVariants && Array.isArray(intent.preferredVariants) && intent.preferredVariants.length > 0) {
    const matchingVariant = intent.preferredVariants.find((v: string) => v.startsWith(intent.layout_pattern));
    if (matchingVariant) {
      chosenVariant = matchingVariant;
      console.log(`[Pipeline V2] Parsed preferredVariants. Overriding chosen variant to: '${chosenVariant}'`);
    }
  }

  console.log(`[RENDERER] Executing renderer for layout_pattern="${intent.layout_pattern}", variant="${chosenVariant}"`);

  resetFallbackFlag(); // Reset indicator fallback trước khi chạy render

  // Chạy layout renderer với variant đã chọn
  let renderMeta: any;
  try {
    renderMeta = await renderer(slide, context, chosenVariant);

    // Thêm Logo ở dưới cùng nếu vị trí được cấu hình ở bottom-center
    if (logoPosition === 'bottom-center') {
      await createLogo(slide, context);
    }
    
    // ── Step 5: Post-flight & Quality Scoring ──────────────────────────────────
    // Để Figma tính toán Auto-layout bounds
    await new Promise((resolve) => setTimeout(resolve, 100));

    const preflightWarnings = allViolations
      .filter(v => v.severity === 'warn')
      .map(v => mapViolationToWarning(v.code));

    const renderResult = calculateQualityScore({
      slideId: job.assetId,
      jobId: job.runId || job.postId,
      renderId: generateRenderId(job.assetId),
      slide,
      preflightWarnings,
      assetFallbackUsed: assetFallbackUsed,
      adaptiveResizeTriggered: !!(renderMeta && renderMeta.adaptiveTriggered),
      fontScaleLevel: maxScaledLevel
    });

    const finalVariant = renderMeta?.variantUsed ?? chosenVariant;

    return {
      slideNode: slide,
      renderResult,
      variantUsed: finalVariant,
    };
  } catch (err) {
    try {
      slide.remove();
    } catch (removeErr) {
      console.warn('[Pipeline] Failed to remove corrupted slide node:', removeErr);
    }
    throw err;
  }
}
