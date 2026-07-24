/**
 * Figma Plugin Types v1.0
 * JSON Contract giữa AI Backend ↔ Plugin
 *
 * Ref: design_engine_technical_specification_v1.md §4
 */

// ─── Warning Codes (v1.0) ────────────────────────────────────────────────────

export enum WarningCode {
  TEXT_OVERFLOW = 'TEXT_OVERFLOW',
  SAFEZONE_OVERFLOW = 'SAFEZONE_OVERFLOW',
  IMAGE_MISSING = 'IMAGE_MISSING',
  FONT_SCALE_MIN = 'FONT_SCALE_MIN',
  TOO_MANY_ITEMS = 'TOO_MANY_ITEMS',
  LOW_CONTRAST = 'LOW_CONTRAST'
}

export interface LayoutMetrics {
  textCoverage: number;       // Tỷ lệ diện tích text / safezone (0.0 - 1.0)
  imageCoverage: number;      // Tỷ lệ diện tích image / safezone (0.0 - 1.0)
  whitespace: number;         // Tỷ lệ diện tích trống (0.0 - 1.0)
  overflowCount: number;      // Số lần tràn bounds thực tế phát hiện được
  fontScaleLevel: number;     // Bậc font đã scale down (0: gốc, 1: BodyM, 2: BodyS)
}

// ─── DesignIntent: JSON do AI Backend gửi sang Plugin ────────────────────────

export type LayoutPattern = 'split' | 'center' | 'grid' | 'timeline';
export type Theme = 'dark' | 'light';
export type SizeLevel = 'HeadingXL' | 'HeadingL' | 'HeadingM' | 'BodyL' | 'BodyM' | 'BodyS';
export type AssetType = '3d_icon' | 'flat_vector' | 'mockup';
export type AssetCategory = 'ux' | 'marketing' | 'general';
export type AssetVariant = 'modern' | 'playful';

export interface HeadingComponent {
  type: 'heading';
  text: string;
  size_level: SizeLevel;
  highlight_words?: string[];   // Các từ được tô màu Highlight (#FFB117)
}

export interface BodyComponent {
  type: 'body';
  text: string;
  size_level: SizeLevel;
}

export interface ListComponent {
  type: 'list';
  style: 'checklist' | 'numbered';
  items: string[];
  size_level?: SizeLevel;       // Font size cho từng item (default: BodyM)
}

// ─── Grammar blocks mới (doc 01-grammar-spec.md) ─────────────────────────────

export interface StatisticComponent {
  type: 'statistic';
  value: string;          // Ví dụ: "95%", "2.5x", "+120" (tối đa 8 ký tự)
  metric: string;         // Tên chỉ số: "Conversion Rate"
  trend?: string;         // Xu hướng: "↑ 22%"
  caption?: string;       // Chú thích ngắn (tối đa 30 ký tự)
}

export interface QuoteComponent {
  type: 'quote';
  text: string;           // Nội dung trích dẫn (tối đa 150 ký tự)
  author?: string;        // Tên người nói
  title?: string;         // Chức danh: "CEO @ Apple"
}

export interface BadgeComponent {
  type: 'badge';
  text: string;           // Chữ in hoa (tối đa 15 ký tự)
  badgeType: 'primary' | 'warning' | 'success';
}

export type Component = HeadingComponent | BodyComponent | ListComponent
  | StatisticComponent | QuoteComponent | BadgeComponent;


export interface AssetQuery {
  asset_type: AssetType;
  category: AssetCategory;
  variant: AssetVariant;
}

export interface DesignIntent {
  version: '1.0' | '2.0';
  layout_pattern: LayoutPattern;
  theme: Theme;
  content: Component[];
  asset_query?: AssetQuery;
  // Legacy support — deprecated, dùng asset_query thay thế
  illustration_keyword?: string;

  // V2 Fields (Optional for parsing / backward compatibility)
  semanticType?: 'tutorial' | 'checklist' | 'comparison' | 'statistic' | 'quote' | 'story' | 'general';
  layoutCandidates?: Array<{ layout: string; score: number; reason: string }>;
  preferredVariants?: string[];
  visualDensity?: 'low' | 'medium' | 'high';
  importance?: number;
  readingTime?: number;
  constraints?: string[];
}

// ─── DesignJob: Job object truyền vào Plugin từ UI bridge ────────────────────

export interface DesignJob {
  assetId: string;
  postId: string;
  orderIndex: number;
  runId: string;
  renderedPayload: {
    pageType: 'cover' | 'content' | 'cta';
    template: string;

    // New v1.0 fields (DesignIntent)
    designIntent?: DesignIntent;

    // Legacy v0 fields (backward compat)
    title?: string;
    body?: string;
    [key: string]: unknown;
  };
}

// ─── RenderResult: Plugin gửi ngược về Backend sau khi render ────────────────

export interface RenderResult {
  version: '1.0';
  renderId: string;
  jobId: string;
  slideId: string;
  score: number;
  overflow: boolean;
  warnings: WarningCode[];
  metrics: LayoutMetrics;
  pluginVersion: string;
  export_url?: string;
  fingerprint?: string;
  figmaNodeId?: string;
}

// ─── Plugin Message Protocol ──────────────────────────────────────────────────

export type PluginMessage =
  | { type: 'ui-ready' }
  | { type: 'start-processing'; backendUrl: string }
  | {
      type: 'process-job';
      job: DesignJob;
      images: { url: string; bytes: Uint8Array }[];
      bgBytes?: Uint8Array;
      logoBytes?: Uint8Array;
    }
  | {
      type: 'job-rendered';
      assetId: string;
      bytes: Uint8Array;
      fileName: string;
      renderResult: RenderResult;   // v1.0: kèm Quality Score
      rawFingerprint?: string;      // Passed to UI thread to SparkMD5 hash
    }
  | { type: 'job-failed'; assetId: string; error: string }
  | { type: 'log'; message: string; status: 'info' | 'success' | 'error' }
  // Phase 9: Sync Manager Messages
  | { type: 'scan-canvas'; postId: string }
  | { type: 'canvas-scanned'; slides: SyncSlide[] }
  | { type: 'export-frames'; nodeIds: string[] }
  | { type: 'frames-exported'; exports: { nodeId: string; bytes: Uint8Array }[] }
  | { type: 'commit-rendered-fingerprint'; assetId: string; figmaNodeId: string; fingerprint: string }
  | { type: 'commit-metadata'; updates: any[] };

// ─── Phase 9: Canvas Sync Types ─────────────────────────────────────────────

export interface SyncSlide {
  figmaNodeId: string;
  pluginAssetId?: string; // from setPluginData
  version?: number;
  orderIndex: number;
  fingerprint: string;
}

export type DiffAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'UNCHANGED';

export interface DiffResult {
  figmaNodeId: string;
  assetId?: string;
  version: number;
  orderIndex: number;
  fingerprint: string;
  action: DiffAction;
}

export interface ReconciliationPayload {
  changes: DiffResult[];
}
