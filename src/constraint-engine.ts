/**
 * Capi Demy Constraint Engine v1.0
 * "Cảnh sát" thiết kế — tự động sửa lỗi từ AI trước khi render.
 *
 * Severity Levels (ref: design_engine_execution_specification.md §3):
 *   1. Override  — Tự động sửa, không log
 *   2. Resize    — Thay đổi tỷ lệ container
 *   3. Warn      — Ghi log, trừ điểm Quality Score
 *   4. Reject    — Abort pipeline, báo lỗi Backend
 */

import { SizeLevel, HEADING_SIZE_LEVELS, BODY_SIZE_LEVELS, LAYOUT } from './tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConstraintSeverity = 'override' | 'resize' | 'warn' | 'reject';

export interface ConstraintViolation {
  severity: ConstraintSeverity;
  code: string;       // e.g. "FONT_OVERRIDE", "LIST_TOO_LONG"
  message: string;
  field?: string;     // field trong JSON gây ra vi phạm
  originalValue?: unknown;
  fixedValue?: unknown;
}

export interface PreflightResult {
  shouldAbort: boolean;
  violations: ConstraintViolation[];
}

// ─── 1. Text Normalization (Override — Silent Fix) ────────────────────────────

/**
 * Ép text về Sentence case để chặn ALL CAPS từ AI.
 * VD: "THIẾT KẾ UI" → "Thiết kế ui"
 * AI vẫn giữ được khoảng cách và ký tự đặc biệt.
 */
export function normalizeTextCase(text: string): { result: string; fixed: boolean } {
  if (!text) return { result: '', fixed: false };

  // Kiểm tra xem có vẻ là all-caps không (> 60% ký tự chữ là hoa)
  const letters = text.replace(/[^a-zA-ZÀ-ỹ]/g, '');
  if (letters.length === 0) return { result: text, fixed: false };

  const upperCount = (text.match(/[A-ZÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/g) || []).length;
  const ratio = upperCount / letters.length;

  if (ratio > 0.6) {
    // Sentence case: Chữ cái đầu câu hoa, còn lại thường
    const result = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    return { result, fixed: true };
  }

  return { result: text, fixed: false };
}

// ─── 2. Font Enforcement (Override — Silent Fix) ──────────────────────────────

/** Các font weight bị cấm — plugin sẽ map về Bold hoặc Regular */
const FORBIDDEN_WEIGHTS = new Set(['SemiBold', 'Medium', 'Light', 'Thin', 'ExtraBold', 'Black']);
const ALLOWED_FONT = 'Inter';

export function enforceFont(fontFamily: string): { result: string; fixed: boolean } {
  if (fontFamily === ALLOWED_FONT) return { result: fontFamily, fixed: false };
  return { result: ALLOWED_FONT, fixed: true };
}

export function enforceWeight(weight: string): { result: 'Regular' | 'Bold'; fixed: boolean } {
  if (weight === 'Regular' || weight === 'Bold') return { result: weight as 'Regular' | 'Bold', fixed: false };
  // Map về Bold nếu bán đậm, về Regular nếu nhẹ hơn
  const mappedToBold = new Set(['SemiBold', 'ExtraBold', 'Black', 'Medium']);
  const result = mappedToBold.has(weight) ? 'Bold' : 'Regular';
  return { result, fixed: true };
}

// ─── 3. size_level Validation ─────────────────────────────────────────────────

/** Map các alias cũ (như "large"/"medium") về enum chuẩn */
const SIZE_LEVEL_ALIASES: Record<string, SizeLevel> = {
  'large':         'HeadingXL',
  'big':           'HeadingL',
  'medium-heading': 'HeadingM',
  'medium':        'BodyM',
  'small':         'BodyS',
  'tiny':          'BodyS',
};

const ALL_SIZE_LEVELS = new Set<string>([...HEADING_SIZE_LEVELS, ...BODY_SIZE_LEVELS]);

export function normalizeSizeLevel(
  sizeLevel: string,
  componentType: 'heading' | 'body' | 'list',
): { result: SizeLevel; fixed: boolean } {
  // Nếu đã đúng chuẩn
  if (ALL_SIZE_LEVELS.has(sizeLevel)) {
    const level = sizeLevel as SizeLevel;
    // Kiểm tra xem đúng nhóm chưa
    if (componentType === 'heading' && !HEADING_SIZE_LEVELS.includes(level)) {
      return { result: 'HeadingM', fixed: true };
    }
    if ((componentType === 'body' || componentType === 'list') && !BODY_SIZE_LEVELS.includes(level)) {
      return { result: 'BodyM', fixed: true };
    }
    return { result: level, fixed: false };
  }

  // Thử lookup alias
  if (SIZE_LEVEL_ALIASES[sizeLevel.toLowerCase()]) {
    return { result: SIZE_LEVEL_ALIASES[sizeLevel.toLowerCase()], fixed: true };
  }

  // Fallback mặc định theo loại component
  return {
    result: componentType === 'heading' ? 'HeadingM' : 'BodyS',
    fixed: true,
  };
}

// ─── 4. SVG Stroke Removal (Override — Figma node level) ─────────────────────

/**
 * Xóa stroke khỏi node Figma (dùng sau khi insert SVG/Vector).
 * Gọi hàm này trên mọi VectorNode hoặc FrameNode dùng làm icon.
 */
export function removeStroke(node: GeometryMixin & SceneNode): boolean {
  if (node.strokes && node.strokes.length > 0) {
    node.strokes = [];
    return true;
  }
  return false;
}

/**
 * Xóa stroke đệ quy trên toàn bộ subtree (dùng cho các SVG group phức tạp).
 */
export function removeStrokeRecursive(node: SceneNode): number {
  let count = 0;
  if ('strokes' in node && (node as any).strokes?.length > 0) {
    (node as any).strokes = [];
    count++;
  }
  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      count += removeStrokeRecursive(child);
    }
  }
  return count;
}

// ─── 5. Pre-flight Validation (Reject — Hard Limits) ─────────────────────────

/**
 * Kiểm tra trước khi render (Bước 3 trong Pipeline).
 * Nếu có vi phạm mức Reject → shouldAbort = true.
 */
export function preflightCheck(designIntent: {
  layout_pattern: string;
  content?: Array<{ type: string; items?: any }>;
}): PreflightResult {
  const violations: ConstraintViolation[] = [];

  const { layout_pattern, content = [] } = designIntent;

  for (const component of content) {
    // Hard limit: List items
    if (component.type === 'list') {
      const itemCount = component.items?.length ?? 0;
      if (layout_pattern === 'grid' && itemCount > LAYOUT.Grid.MaxItems) {
        violations.push({
          severity: 'reject',
          code: 'LIST_TOO_LONG',
          message: `Grid layout cho phép tối đa ${LAYOUT.Grid.MaxItems} items, nhận được ${itemCount}.`,
          field: 'content[].items',
          originalValue: itemCount,
        });
      }
      if (layout_pattern === 'timeline' && itemCount > LAYOUT.Timeline.MaxItems) {
        violations.push({
          severity: 'reject',
          code: 'TIMELINE_TOO_LONG',
          message: `Timeline layout cho phép tối đa ${LAYOUT.Timeline.MaxItems} steps, nhận được ${itemCount}.`,
          field: 'content[].items',
          originalValue: itemCount,
        });
      }
    }
  }

  const shouldAbort = violations.some((v) => v.severity === 'reject');
  return { shouldAbort, violations };
}

// ─── 6. Content Sanitizer (Tổng hợp Override) ────────────────────────────────

export interface SanitizedContent {
  text: string;
  sizeLevel: SizeLevel;
  violations: ConstraintViolation[];
}

/**
 * Sanitize một content block từ AI:
 * - Normalize text case
 * - Normalize size_level
 * Trả về data đã sạch và danh sách các ghi chú override.
 */
export function sanitizeContentBlock(block: {
  type: 'heading' | 'body' | 'list';
  text?: string;
  size_level?: string;
}): SanitizedContent {
  const violations: ConstraintViolation[] = [];
  let text = block.text ?? '';
  let sizeLevelRaw = block.size_level ?? (block.type === 'heading' ? 'HeadingM' : 'BodyS');

  // 1. Normalize text case
  const caseResult = normalizeTextCase(text);
  if (caseResult.fixed) {
    violations.push({
      severity: 'override',
      code: 'CAPS_OVERRIDE',
      message: `Text "${text.slice(0, 30)}..." bị ALL CAPS, đã tự động chuyển về Sentence case.`,
      field: 'text',
      originalValue: text,
      fixedValue: caseResult.result,
    });
    text = caseResult.result;
  }

  // 2. Normalize size_level
  const sizeResult = normalizeSizeLevel(sizeLevelRaw, block.type);
  if (sizeResult.fixed) {
    violations.push({
      severity: 'override',
      code: 'SIZE_LEVEL_OVERRIDE',
      message: `size_level "${sizeLevelRaw}" không hợp lệ cho type="${block.type}", đã map về "${sizeResult.result}".`,
      field: 'size_level',
      originalValue: sizeLevelRaw,
      fixedValue: sizeResult.result,
    });
  }

  return { text, sizeLevel: sizeResult.result, violations };
}
