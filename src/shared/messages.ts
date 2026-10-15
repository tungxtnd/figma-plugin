import { ClaimedJob } from './api-types';
import { CanvasSlide, MetadataUpdate } from './diff';
import { RenderResult } from '../types';

export interface PluginConfig {
  backendUrl: string;
  token: string;
  autoRender: boolean;
  /** Nhớ từ lần kết nối trước, để nút "Lấy mã kết nối" mở đúng trang web. */
  webAppUrl: string | null;
}

export interface SectionState {
  postId: string;
  /** Tên Section — dùng khi bài không có trong danh sách của mình (file được mời vào sửa hộ). */
  name: string;
  slideCount: number;
  /** Có sửa trên canvas mà chưa gửi (so với metadata lần dựng/gửi gần nhất). */
  dirty: boolean;
}

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

/** UI (iframe) → sandbox. */
export type UiToSandbox =
  | { type: 'init' }
  | { type: 'save-config'; config: PluginConfig }
  | {
      type: 'render-job';
      job: ClaimedJob;
      images: { url: string; bytes: Uint8Array }[];
      bgBytes?: Uint8Array;
      logoBytes?: Uint8Array;
      /** Ảnh tải không được hoặc sai định dạng — ghi vào cảnh báo của slide. */
      missingImages: string[];
    }
  | { type: 'scan-section'; postId: string }
  | { type: 'export-frames'; requestId: string; nodeIds: string[]; scale: number }
  | { type: 'commit-sync'; postId: string; updates: MetadataUpdate[] }
  | { type: 'focus-post'; postId: string }
  | { type: 'remove-sections'; postIds: string[] }
  | { type: 'notify'; message: string; error?: boolean }
  | { type: 'open-external'; url: string };

/** Sandbox → UI. */
export type SandboxToUi =
  | { type: 'config'; config: PluginConfig }
  | { type: 'canvas'; sections: SectionState[] }
  | { type: 'selection'; postId: string | null }
  | { type: 'job-rendered'; assetId: string; bytes: Uint8Array; renderResult: RenderResult }
  | { type: 'job-failed'; assetId: string; error: string }
  | { type: 'section-scanned'; postId: string; slides: CanvasSlide[]; foreign: number }
  | {
      type: 'frames-exported';
      requestId: string;
      exports: { nodeId: string; bytes: Uint8Array }[];
      missing: string[];
      error?: string;
    }
  | { type: 'log'; level: LogLevel; message: string; detail?: string };
