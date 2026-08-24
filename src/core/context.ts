/**
 * Layout Context — Ngữ cảnh duy nhất được truyền vào mọi hàm render.
 * Không có tham số rời rạc. Thêm field mới không phá vỡ function signature.
 *
 * Ref: design_engine_execution_specification.md §1 (Pipeline)
 */

import { DesignIntent, Component, HeadingComponent, BodyComponent, ListComponent, StatisticComponent, QuoteComponent, BadgeComponent, RenderConstraints } from '../types';
import { ThemeTokenSet } from '../engines/theme-engine';

// ─── Asset Types ──────────────────────────────────────────────────────────────

export interface ImageAsset {
  bytes: Uint8Array;
  url?: string;
}

// ─── Layout Context ───────────────────────────────────────────────────────────

export interface LayoutContext {
  /** DesignIntent v1.0 JSON từ AI — nguồn sự thật về nội dung và layout */
  intent: DesignIntent;

  /** TokenSet đã được resolve theo theme (dark/light) */
  theme: ThemeTokenSet;

  /** Kích thước canvas thực tế (px) */
  canvas: { width: number; height: number };

  /** Vùng an toàn sau khi trừ padding */
  safeZone: { top: number; bottom: number; left: number; right: number; width: number; height: number };

  /** Tất cả asset cần cho render (bytes đã download) */
  assets: {
    background?: Uint8Array;
    logo?: Uint8Array;
    images: ImageAsset[];    // Ảnh nội dung (hero, illustration)
  };
  logoPosition?: 'top-center' | 'bottom-center';
  renderConstraints?: RenderConstraints;
}

// ─── Layout Renderer Type ─────────────────────────────────────────────────────

/** Mọi Layout Renderer phải implement interface này.
 * Trả về metadata object (adaptiveTriggered, warned, variantUsed, v.v.) hoặc void.
 * FIX BUG-14: dùng Promise<any> thay vì Promise<void> để phản ánh đúng các renderer có return metadata. */
export type LayoutRenderer = (parent: FrameNode, context: LayoutContext, variant?: string) => Promise<any>;

// ─── Component Accessor Helpers ───────────────────────────────────────────────

export function getHeading(intent: DesignIntent): HeadingComponent | undefined {
  return intent.content.find((c): c is HeadingComponent => c.type === 'heading');
}

export function getBodies(intent: DesignIntent): BodyComponent[] {
  return intent.content.filter((c): c is BodyComponent => c.type === 'body');
}

export function getListComponents(intent: DesignIntent): ListComponent[] {
  return intent.content.filter((c): c is ListComponent => c.type === 'list');
}

export function getStatistics(intent: DesignIntent): StatisticComponent[] {
  return intent.content.filter((c): c is StatisticComponent => c.type === 'statistic');
}

export function getQuotes(intent: DesignIntent): QuoteComponent[] {
  return intent.content.filter((c): c is QuoteComponent => c.type === 'quote');
}

export function getBadge(intent: DesignIntent): BadgeComponent | undefined {
  return intent.content.find((c): c is BadgeComponent => c.type === 'badge');
}
