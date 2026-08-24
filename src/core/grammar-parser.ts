/**
 * Grammar Parser — Steps 1-3 của Rendering Pipeline.
 * Step 1: Parse   — Đọc content[] và phân loại theo type.
 * Step 2: Normalize — Gộp/chuyển đổi block vượt giới hạn.
 * Step 3: CapabilityFilter — Lọc block không được layout hỗ trợ.
 *
 * Ref: doc 05-render-pipeline.md §2
 */

import {
  Component,
  HeadingComponent,
  BodyComponent,
  ListComponent,
  StatisticComponent,
  QuoteComponent,
  BadgeComponent,
  LayoutPattern,
} from '../types';

// ─── Parsed Grammar Result ────────────────────────────────────────────────────

export interface ParsedGrammar {
  heading?: HeadingComponent;
  bodies: BodyComponent[];
  lists: ListComponent[];
  statistics: StatisticComponent[];
  quotes: QuoteComponent[];
  badges: BadgeComponent[];
  /** Số block bị drop sau CapabilityFilter */
  droppedCount: number;
}

// ─── Capability Matrix ────────────────────────────────────────────────────────

/**
 * Mỗi layout pattern hỗ trợ tập hợp block types nhất định.
 * Ref: doc 03-renderer-capability.md
 */
const CAPABILITY_MATRIX: Record<LayoutPattern, Set<string>> = {
  split: new Set(['heading', 'body', 'list', 'badge']),
  center: new Set(['heading', 'body', 'quote', 'badge']),
  grid: new Set(['heading', 'body', 'list', 'statistic', 'badge']),
  timeline: new Set(['heading', 'body', 'list', 'badge']),
};

// ─── Step 1: Parse ────────────────────────────────────────────────────────────

/**
 * Đọc mảng content[] và phân loại thành ParsedGrammar.
 * Chỉ lấy block đầu tiên của heading (max 1 per slide theo Grammar Spec).
 */
export function parseGrammar(content: Component[]): ParsedGrammar {
  const result: ParsedGrammar = {
    bodies: [],
    lists: [],
    statistics: [],
    quotes: [],
    badges: [],
    droppedCount: 0,
  };

  for (const block of content) {
    switch (block.type) {
      case 'heading':
        if (!result.heading) result.heading = block;  // Max 1 heading
        break;
      case 'body':
        result.bodies.push(block);
        break;
      case 'list':
        result.lists.push(block);
        break;
      case 'statistic':
        result.statistics.push(block);
        break;
      case 'quote':
        result.quotes.push(block);
        break;
      case 'badge':
        result.badges.push(block);
        break;
    }
  }

  return result;
}

// ─── Step 2: Normalize ────────────────────────────────────────────────────────

/**
 * Chuẩn hóa dữ liệu thô từ AI trước khi render:
 * - Nếu có > 2 body blocks → gộp thành 2 (nối text lại)
 * - Nếu có > 1 list block → chỉ giữ list đầu tiên
 * - Nếu có > 2 statistic blocks → chỉ giữ 2 đầu tiên (per Grammar Spec §1.4)
 * - Nếu có > 1 badge → chỉ giữ badge đầu tiên
 *
 * Ref: doc 05-render-pipeline.md Step 2
 */
export function normalizeGrammar(
  parsed: ParsedGrammar,
  layout?: LayoutPattern,
): ParsedGrammar {
  const result = { ...parsed };

  // Gộp body nếu quá nhiều
  if (result.bodies.length > 2) {
    const merged = result.bodies.slice(0, 2);
    // Nối phần text thừa vào body cuối cùng
    const overflow = result.bodies.slice(2).map(b => b.text).join(' ');
    merged[1] = {
      ...merged[1],
      text: merged[1].text + ' ' + overflow,
    };
    result.bodies = merged;
  }

  // Comparison grid needs two independent lists (one per column). Other layouts
  // retain the original single-list limit to avoid accidental dense slides.
  if (result.lists.length > 1) {
    result.lists = layout === 'grid'
      ? result.lists.slice(0, 2)
      : [result.lists[0]];
  }

  // Chỉ giữ tối đa 2 statistic blocks (Grammar Spec §1.4: "vẽ cạnh nhau")
  if (result.statistics.length > 2) {
    result.statistics = result.statistics.slice(0, 2);
  }

  // Chỉ giữ 1 badge
  if (result.badges.length > 1) {
    result.badges = [result.badges[0]];
  }

  return result;
}

// ─── Step 3: Capability Filter ────────────────────────────────────────────────

/**
 * Lọc bỏ các block không được layout hỗ trợ.
 * Ví dụ: layout=center không hỗ trợ statistic → drop statistic blocks.
 *
 * Ref: doc 05-render-pipeline.md Step 3
 */
export function capabilityFilter(parsed: ParsedGrammar, layout: LayoutPattern): ParsedGrammar {
  const supported = CAPABILITY_MATRIX[layout] ?? new Set<string>();
  const result = { ...parsed, droppedCount: 0 };

  if (!supported.has('statistic') && result.statistics.length > 0) {
    result.droppedCount += result.statistics.length;
    result.statistics = [];
  }
  if (!supported.has('quote') && result.quotes.length > 0) {
    result.droppedCount += result.quotes.length;
    result.quotes = [];
  }
  if (!supported.has('list') && result.lists.length > 0) {
    result.droppedCount += result.lists.length;
    result.lists = [];
  }
  if (!supported.has('badge') && result.badges.length > 0) {
    result.droppedCount += result.badges.length;
    result.badges = [];
  }

  if (result.droppedCount > 0) {
    console.warn(`[GrammarParser] layout="${layout}" dropped ${result.droppedCount} unsupported block(s).`);
  }

  return result;
}

// ─── Combined Helper ──────────────────────────────────────────────────────────

/**
 * Chạy cả 3 bước (Parse → Normalize → CapabilityFilter) trong 1 lần gọi.
 * Dùng trong pipeline.ts Step 1-3.
 */
export function processGrammar(content: Component[], layout: LayoutPattern): ParsedGrammar {
  const parsed = parseGrammar(content);
  const normalized = normalizeGrammar(parsed, layout);
  return capabilityFilter(normalized, layout);
}
