/**
 * Theme Engine — Chuyển đổi `intent.theme` thành TokenSet cụ thể.
 * Không hardcode màu sắc trong renderer. Thêm theme mới chỉ cần
 * bổ sung một entry trong THEME_REGISTRY.
 *
 * Ref: design_engine_technical_specification_v1.md §1 (Color Tokens)
 */

import { COLOR, TYPOGRAPHY, TypographyToken, SizeLevel } from '../tokens';

// ─── Theme Token Set ──────────────────────────────────────────────────────────

export interface ThemeTokenSet {
  name: string;
  background: { r: number; g: number; b: number };
  textPrimary: { r: number; g: number; b: number };
  textMuted: { r: number; g: number; b: number };
  highlight: { r: number; g: number; b: number };
  cardBg: { r: number; g: number; b: number };
  orbColors: Array<{ r: number; g: number; b: number }>;
  logoVariant: 'dark' | 'light';  // Logo màu nào phù hợp với nền này
}

// ─── Theme Registry ───────────────────────────────────────────────────────────

const THEME_REGISTRY: Record<string, ThemeTokenSet> = {
  dark: {
    name: 'dark',
    background: COLOR.Primary,
    textPrimary: COLOR.TextPrimaryDark,
    textMuted: COLOR.TextMuted,
    highlight: COLOR.Highlight,
    cardBg: COLOR.CardBg,
    orbColors: [COLOR.Accent.Blue, COLOR.Accent.Red],
    logoVariant: 'light',
  },
  light: {
    name: 'light',
    background: COLOR.BackgroundLight,
    textPrimary: COLOR.TextPrimaryLight,
    textMuted: { r: 0.4, g: 0.4, b: 0.4 },  // Gray-600
    highlight: COLOR.Highlight,
    cardBg: { r: 0.96, g: 0.96, b: 0.96 },  // Gray-100
    orbColors: [COLOR.Accent.Green, COLOR.Accent.Blue],
    logoVariant: 'dark',
  },
};

/** Theme mặc định khi AI gửi tên không hợp lệ */
const DEFAULT_THEME = 'dark';

// ─── Resolver ────────────────────────────────────────────────────────────────

/**
 * Nhận tên theme từ DesignIntent, trả về ThemeTokenSet tương ứng.
 * Nếu tên không hợp lệ, dùng theme mặc định (override, không crash).
 */
export function resolveTheme(themeName: string | undefined): ThemeTokenSet {
  if (themeName && THEME_REGISTRY[themeName]) {
    return THEME_REGISTRY[themeName];
  }
  console.warn(`[ThemeEngine] Unknown theme "${themeName}", falling back to "${DEFAULT_THEME}".`);
  return THEME_REGISTRY[DEFAULT_THEME];
}

/** Lấy TypographyToken từ size_level */
export function resolveTypography(sizeLevel: SizeLevel): TypographyToken {
  return TYPOGRAPHY[sizeLevel];
}

/** Chuyển lineHeight multiplier sang Figma's PERCENT unit */
export function lineHeightToFigma(multiplier: number): LineHeight {
  return { value: multiplier * 100, unit: 'PERCENT' };
}
