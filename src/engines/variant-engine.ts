/**
 * Variant Engine — Tự động chọn biến thể layout tối ưu.
 * Không hardcode odd/even. Dùng Variant Score để quyết định.
 *
 * Ref: doc 04-variant-spec.md
 */

import { DesignIntent } from '../types';

// ─── Variant Registry ─────────────────────────────────────────────────────────

export interface LayoutVariant {
  /** Tên biến thể — key duy nhất (ví dụ: "split_standard") */
  name: string;
  /** Layout pattern mà variant này thuộc về */
  layoutName: string;
  /**
   * Điều kiện ưu tiên dùng variant này.
   * Dùng trong Picker Scoring để tăng/giảm điểm.
   */
  hints: {
    preferShortText?: boolean;   // Ưu tiên khi text ngắn (< 100 ký tự)
    preferLongText?: boolean;    // Ưu tiên khi text dài (> 200 ký tự)
    preferNoImage?: boolean;     // Ưu tiên khi không có ảnh
    preferHasImage?: boolean;    // Ưu tiên khi có ảnh
    semanticTypes?: string[];    // Ưu tiên cho semantic hints (quote, process...)
  };
}

/**
 * VARIANT_REGISTRY — Danh sách tất cả biến thể được hỗ trợ.
 * Thêm variant mới: chỉ cần append vào đây, không sửa pipeline.
 */
const VARIANT_REGISTRY: LayoutVariant[] = [
  // ─── Split variants ───────────────────────────────────────────────────────
  {
    name: 'split_standard',
    layoutName: 'split',
    hints: { preferHasImage: true },
  },
  {
    name: 'split_reversed',
    layoutName: 'split',
    hints: { preferHasImage: true },
  },
  {
    name: 'split_card_floating',
    layoutName: 'split',
    hints: { preferHasImage: true, semanticTypes: ['quote', 'tip'] },
  },
  {
    name: 'split_hero',
    layoutName: 'split',
    hints: { preferHasImage: true, semanticTypes: ['heading'] },
  },
  {
    name: 'split_bleed',
    layoutName: 'split',
    hints: { preferHasImage: true, preferLongText: true },
  },
  {
    name: 'split_editorial',
    layoutName: 'split',
    hints: { preferHasImage: true, semanticTypes: ['body'] },
  },
  {
    name: 'split_quote',
    layoutName: 'split',
    hints: { preferHasImage: true, semanticTypes: ['quote'] },
  },
  {
    name: 'split_statistics',
    layoutName: 'split',
    hints: { preferHasImage: true, semanticTypes: ['statistic'] },
  },
  {
    name: 'center_standard',
    layoutName: 'center',
    hints: {},
  },
  {
    name: 'center_typography_first',
    layoutName: 'center',
    hints: { preferShortText: true },
  },
  {
    name: 'center_hero',
    layoutName: 'center',
    hints: { preferHasImage: true, semanticTypes: ['heading'] },
  },
  {
    name: 'center_statistic',
    layoutName: 'center',
    hints: { semanticTypes: ['statistic'] },
  },
  {
    name: 'center_quote',
    layoutName: 'center',
    hints: { semanticTypes: ['quote'] },
  },
  {
    name: 'center_minimal',
    layoutName: 'center',
    hints: { preferShortText: true },
  },
  {
    name: 'center_cover',
    layoutName: 'center',
    hints: { preferShortText: true, semanticTypes: ['heading'] },
  },
  {
    name: 'grid_standard',
    layoutName: 'grid',
    hints: {},
  },
  {
    name: 'grid_columns2',
    layoutName: 'grid',
    hints: { semanticTypes: ['list'] },
  },
  {
    name: 'grid_columns3',
    layoutName: 'grid',
    hints: { semanticTypes: ['list'] },
  },
  {
    name: 'grid_cards',
    layoutName: 'grid',
    hints: { semanticTypes: ['list'] },
  },
  {
    name: 'grid_pricing',
    layoutName: 'grid',
    hints: { semanticTypes: ['list'] },
  },
  {
    name: 'grid_comparison',
    layoutName: 'grid',
    hints: { semanticTypes: ['list', 'statistic'] },
  },
  {
    name: 'timeline_standard',
    layoutName: 'timeline',
    hints: {},
  },
  {
    name: 'timeline_horizontal',
    layoutName: 'timeline',
    hints: { semanticTypes: ['list'] },
  },
  {
    name: 'timeline_roadmap',
    layoutName: 'timeline',
    hints: { semanticTypes: ['list'] },
  },
  {
    name: 'timeline_numbered',
    layoutName: 'timeline',
    hints: { semanticTypes: ['list'] },
  },
  {
    name: 'timeline_process',
    layoutName: 'timeline',
    hints: { semanticTypes: ['list'] },
  },
  {
    name: 'timeline_zigzag',
    layoutName: 'timeline',
    hints: { semanticTypes: ['list'] },
  },
];

// ─── Variant Picker ───────────────────────────────────────────────────────────

/**
 * Tính Text Density (0.0 – 1.0) dựa trên tổng ký tự của tất cả blocks.
 */
function computeTextDensity(intent: DesignIntent): number {
  const totalChars = intent.content.reduce((sum, block) => {
    if (block.type === 'heading') return sum + block.text.length;
    if (block.type === 'body') return sum + block.text.length;
    if (block.type === 'list') return sum + block.items.join('').length;
    if (block.type === 'quote') return sum + block.text.length;
    return sum;
  }, 0);
  // Chuẩn hóa: 0 ký tự → 0.0, 400+ ký tự → 1.0
  return Math.min(1.0, totalChars / 400);
}

/**
 * Lấy danh sách variants của một layout cụ thể.
 */
export function getVariantsForLayout(layoutName: string): LayoutVariant[] {
  return VARIANT_REGISTRY.filter(v => v.layoutName === layoutName);
}

/**
 * Thuật toán Variant Picker Scoring.
 * Chọn variant tối ưu dựa trên:
 * - Text Density (ngắn/dài)
 * - Image availability
 * - Random weight (tạo sự đa dạng nhẹ)
 * - Constraint: không dùng variant đã dùng ở slide liền trước
 *
 * Ref: doc 04-variant-spec.md §3
 */
export function pickVariant(
  intent: DesignIntent,
  prevVariantName?: string,
  orderIndex: number = 0,
): string {
  const candidates = getVariantsForLayout(intent.layout_pattern);

  if (candidates.length === 0) {
    // Fallback nếu layout chưa có variants
    return `${intent.layout_pattern}_standard`;
  }

  if (candidates.length === 1) {
    return candidates[0].name;
  }

  const textDensity = computeTextDensity(intent);
  const hasImage = !!(intent as any).asset_query || textDensity < 0.6;

  // Lọc bỏ variant đã dùng ở slide liền trước (doc 04 constraint)
  const filtered = candidates.filter(v => v.name !== prevVariantName);
  const pool = filtered.length > 0 ? filtered : candidates;

  // Trích xuất các loại component hiện có trong Slide
  const activeComponentTypes = intent.content.map(c => c.type) as string[];

  // Tính điểm cho từng candidate
  const scored = pool.map(variant => {
    let score = 50; // Base score

    // Text density signals
    if (variant.hints.preferShortText && textDensity < 0.3) score += 20;
    if (variant.hints.preferLongText && textDensity > 0.6) score += 20;
    if (variant.hints.preferShortText && textDensity > 0.5) score -= 15;

    // Image signals
    if (variant.hints.preferHasImage && hasImage) score += 15;
    if (variant.hints.preferNoImage && !hasImage) score += 15;

    // So khớp ngữ nghĩa (Semantic matching)
    if (variant.hints.semanticTypes && variant.hints.semanticTypes.length > 0) {
      const hasSemanticMatch = variant.hints.semanticTypes.some(type => activeComponentTypes.includes(type));
      if (hasSemanticMatch) score += 30; // Cộng điểm ưu tiên cao cho biến thể phù hợp ngữ nghĩa
    }

    // Deterministic offset based on orderIndex to avoid deterministic patterns
    // across slides while keeping each slide's rendering 100% reproducible.
    const deterministicOffset = ((orderIndex * 7) + variant.name.length) % 15 - 7;
    score += deterministicOffset;

    return { variant, score };
  });

  // Chọn variant có điểm cao nhất
  scored.sort((a, b) => b.score - a.score);
  return scored[0].variant.name;
}
