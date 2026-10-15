/**
 * Hợp đồng với backend (marketing-automation-os, module design).
 * Mọi route plugin trả envelope MỘT lớp: `{ status, message, data, ... }`.
 */

export interface Envelope<T> {
  status: string;
  message?: string;
  error_code?: string | null;
  data: T;
}

/** `POST /designs/claim-next` — một slide đã nhận (có khoá), hoặc null = hết việc. */
export interface ClaimedJob {
  assetId: string;
  postId: string;
  postTitle: string;
  orderIndex: number;
  slideCount: number;
  runId: string;
  version: number;
  renderedPayload: any;
}

export type RenderStage =
  | 'QUEUED'
  | 'RENDERING'
  | 'IN_REVIEW'
  | 'NEEDS_CHANGES'
  | 'APPROVED'
  | 'FAILED';

/** Một bài trên màn "Việc của bạn" — `GET /designs/mine`. */
export interface WorkPost {
  postId: string;
  title: string;
  webUrl: string | null;
  stage: RenderStage;
  slides: { total: number; rendered: number; failed: number };
  reviewNote: string | null;
  lastError: string | null;
}

export interface MyWork {
  me: { name: string; email: string };
  /** Gốc URL web; plugin nhớ để lần sau mở thẳng trang lấy mã kết nối. */
  webAppUrl: string | null;
  posts: WorkPost[];
}

/** `GET /posts/:id/designs` — slide trên hệ thống để đối chiếu với canvas. */
export interface RemoteDesign {
  assetId: string;
  figmaNodeId: string | null;
  fingerprint: string | null;
  version: number;
  orderIndex: number;
  assetUrl: string | null;
  status: string;
}

export interface SyncResultItem {
  assetId: string;
  figmaNodeId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'REORDER';
  newVersion: number;
  assetUrl: string | null;
}

export interface SyncResponse {
  transactionId: string;
  postId: string;
  totalUpdated: number;
  totalDeleted: number;
  results: SyncResultItem[];
}

/** Mã lỗi backend trả khi bài đã giao cho người khác dựng. */
export const RENDER_REASSIGNED = 'RENDER_REASSIGNED';
