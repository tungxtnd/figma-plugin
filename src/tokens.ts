/**
 * Capi Demy Design Token Engine v1.0
 * Source of truth cho toàn bộ giá trị thị giác.
 * Plugin tuyệt đối không dùng hardcode giá trị nào ngoài file này.
 *
 * Ref: design_engine_technical_specification_v1.md §1
 */

// ─── Color Tokens ────────────────────────────────────────────────────────────

export type RGB = { r: number; g: number; b: number };
export type RGBA = RGB & { a: number };

function hex(h: string): RGB {
  const v = parseInt(h.replace('#', ''), 16);
  return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
}

export const COLOR = {
  // Backgrounds
  Primary: hex('#1A202C'),         // Dark Navy — nền tối mặc định
  BackgroundLight: hex('#FFFFFF'), // Nền sáng

  // Text
  TextPrimaryDark: hex('#FFFFFF'), // Chữ trên nền tối
  TextPrimaryLight: hex('#000000'), // Chữ trên nền sáng
  TextMuted: hex('#EAEAEA'),       // Chữ phụ, chú thích

  // Brand
  Highlight: hex('#FFB117'),       // Vàng thương hiệu — tô keyword

  // Accent (dùng cho elements, icons, cards)
  Accent: {
    Green: hex('#2BB268'),
    Blue: hex('#00AAFF'),
    Red: hex('#F24444'),
  },

  // Backgrounds nội bộ
  CardBg: hex('#141E3C'),
  CardBgLight: hex('#1E2D55'),
} as const;

// ─── Typography Tokens ────────────────────────────────────────────────────────

export type SizeLevel =
  | 'HeadingXL'
  | 'HeadingL'
  | 'HeadingM'
  | 'BodyL'
  | 'BodyM'
  | 'BodyS';

export type FontWeight = 'Regular' | 'Bold';

export interface TypographyToken {
  fontSize: number;
  fontWeight: FontWeight;
  lineHeight: number; // multiplier, e.g. 1.2
}

export const TYPOGRAPHY: Record<SizeLevel, TypographyToken> = {
  HeadingXL: { fontSize: 64, fontWeight: 'Bold', lineHeight: 1.2 },
  HeadingL:  { fontSize: 56, fontWeight: 'Bold', lineHeight: 1.2 },
  HeadingM:  { fontSize: 48, fontWeight: 'Bold', lineHeight: 1.25 },
  BodyL:     { fontSize: 42, fontWeight: 'Regular', lineHeight: 1.4 },
  BodyM:     { fontSize: 36, fontWeight: 'Regular', lineHeight: 1.4 },
  BodyS:     { fontSize: 32, fontWeight: 'Regular', lineHeight: 1.4 },
};

/** Tập hợp SizeLevel cho Heading (AI chỉ được chọn trong nhóm này cho type="heading") */
export const HEADING_SIZE_LEVELS: SizeLevel[] = ['HeadingXL', 'HeadingL', 'HeadingM'];

/** Tập hợp SizeLevel cho Body (AI chỉ được chọn trong nhóm này cho type="body"|"list") */
export const BODY_SIZE_LEVELS: SizeLevel[] = ['BodyL', 'BodyM', 'BodyS'];

// ─── Canvas & Spacing Tokens ──────────────────────────────────────────────────

export const CANVAS = {
  Size: 1080,        // px — Canvas vuông mặc định (Facebook 1:1)
  Padding: 64,       // px — Padding outer của frame
  Spacing: 40,       // px — itemSpacing mặc định giữa các block
  SafezoneH: 700,    // px — Chiều cao tối đa vùng an toàn cho content
  SafezoneW: 1000,   // px — Chiều rộng tối đa vùng an toàn
  BorderRadius: 20,  // px — Border radius cho card/image
} as const;

// ─── Layout Tokens ────────────────────────────────────────────────────────────

export const LAYOUT = {
  Split: {
    DefaultRatio: 0.5,  // Text 50% : Image 50%
    AdaptiveRatio: 0.6, // Text 60% : Image 40% (khi text dài)
    MinImageWidthPct: 0.35, // Image không được nhỏ hơn 35% → trigger Warn
    GapBetweenCols: 40, // px gap giữa 2 cột
  },
  Center: {
    MaxContentWidth: 800, // px — width tối đa của content block
    TitleBodyGap: 32,     // px — gap giữa title và body
  },
  Grid: {
    MaxItems: 4,     // Hard constraint
    GapDefault: 24,  // px — gap mặc định giữa items
    GapCompact: 16,  // px — gap khi nén do tràn
  },
  Timeline: {
    MaxItems: 3,     // Hard constraint
    StepGap: 24,     // px — gap giữa các bước
    BadgeSize: 48,   // px — kích thước hình tròn số thứ tự
  },
} as const;

// ─── Fallback Asset Names ─────────────────────────────────────────────────────

export const FALLBACK_ASSET: Record<string, string> = {
  split:    'asset/fallback/generic-illustration',
  center:   'asset/fallback/abstract-shape',
  grid:     'asset/fallback/bullet-icon',
  timeline: 'asset/fallback/step-dot',
};
