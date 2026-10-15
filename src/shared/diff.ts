import { RemoteDesign, SyncResultItem } from './api-types';

/** Một frame trong Section của bài, đã đọc metadata và băm fingerprint. */
export interface CanvasSlide {
  figmaNodeId: string;
  /** Có khi frame do plugin dựng hoặc đã sync; không có = slide người dùng mới thêm. */
  assetId?: string;
  version?: number;
  orderIndex: number;
  fingerprint: string;
}

export type ChangeAction = 'CREATE' | 'UPDATE' | 'REORDER' | 'DELETE';

/** Đúng hình `SlideChangeItem` mà `POST /posts/:id/sync-canvas` nhận. */
export interface SlideChange {
  action: ChangeAction;
  assetId: string | null;
  figmaNodeId: string;
  fingerprint: string;
  version: number;
  orderIndex: number;
  fileFieldName?: string;
}

export interface DiffSummary {
  changes: SlideChange[];
  counts: Record<ChangeAction, number>;
  unchanged: number;
  /** Frame mang assetId mà hệ thống không còn (bộ slide đã được dựng lại). Bỏ qua, không gửi. */
  stale: number;
}

/**
 * Chỉ slide ĐÃ DỰNG mới được đề xuất xoá khi vắng mặt trên canvas. Slide đang chờ,
 * đang dựng hoặc lỗi chưa có frame là chuyện bình thường — xoá chúng là mất việc.
 */
export const DELETABLE_STATUSES = ['IN_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'COMPLETED'];

export function fileFieldFor(figmaNodeId: string): string {
  return `slide_${figmaNodeId}`;
}

export function computeDiff(slides: CanvasSlide[], remote: RemoteDesign[]): DiffSummary {
  const remoteById = new Map(remote.map((r) => [r.assetId, r]));
  const seen = new Set<string>();
  const changes: SlideChange[] = [];
  let unchanged = 0;
  let stale = 0;

  for (const slide of slides) {
    if (!slide.assetId) {
      changes.push({
        action: 'CREATE',
        assetId: null,
        figmaNodeId: slide.figmaNodeId,
        fingerprint: slide.fingerprint,
        version: 1,
        orderIndex: slide.orderIndex,
        fileFieldName: fileFieldFor(slide.figmaNodeId),
      });
      continue;
    }

    const existing = remoteById.get(slide.assetId);
    if (!existing) {
      stale++;
      continue;
    }
    seen.add(slide.assetId);

    // Khoá lạc quan: gửi version frame đang giữ. Người khác sync trước thì
    // server trả 409 thay vì đè mất bản của họ.
    const version = slide.version ?? existing.version;
    if (existing.fingerprint !== slide.fingerprint) {
      changes.push({
        action: 'UPDATE',
        assetId: slide.assetId,
        figmaNodeId: slide.figmaNodeId,
        fingerprint: slide.fingerprint,
        version,
        orderIndex: slide.orderIndex,
        fileFieldName: fileFieldFor(slide.figmaNodeId),
      });
    } else if (existing.orderIndex !== slide.orderIndex) {
      changes.push({
        action: 'REORDER',
        assetId: slide.assetId,
        figmaNodeId: slide.figmaNodeId,
        fingerprint: slide.fingerprint,
        version,
        orderIndex: slide.orderIndex,
      });
    } else {
      unchanged++;
    }
  }

  for (const r of remote) {
    if (seen.has(r.assetId) || !DELETABLE_STATUSES.includes(r.status)) continue;
    changes.push({
      action: 'DELETE',
      assetId: r.assetId,
      figmaNodeId: r.figmaNodeId || '',
      fingerprint: r.fingerprint || '',
      version: r.version,
      orderIndex: r.orderIndex,
    });
  }

  const counts: Record<ChangeAction, number> = { CREATE: 0, UPDATE: 0, REORDER: 0, DELETE: 0 };
  for (const c of changes) counts[c.action]++;

  return { changes, counts, unchanged, stale };
}

/** Tóm tắt bằng lời: "2 slide đã sửa · 1 slide đổi thứ tự · 1 slide mới". */
export function describeCounts(counts: Record<ChangeAction, number>): string {
  const parts: string[] = [];
  if (counts.UPDATE) parts.push(`${counts.UPDATE} slide đã sửa`);
  if (counts.REORDER) parts.push(`${counts.REORDER} slide đổi thứ tự`);
  if (counts.CREATE) parts.push(`${counts.CREATE} slide mới`);
  if (counts.DELETE) parts.push(`${counts.DELETE} slide bị xoá`);
  return parts.length ? parts.join(' · ') : 'Không có thay đổi nào';
}

export interface MetadataUpdate {
  figmaNodeId: string;
  postId: string;
  assetId: string;
  version: number;
  fingerprint: string;
}

/**
 * Sau khi sync: ghi lại metadata cho frame bằng assetId và version DO SERVER TRẢ.
 * Không tự sinh assetId, không tự cộng version — tự đoán là lần sync sau lệch
 * với server (trùng slide hoặc 409).
 */
export function metadataFromResults(
  postId: string,
  changes: SlideChange[],
  results: SyncResultItem[],
): MetadataUpdate[] {
  // Kết quả DELETE mang figmaNodeId cũ của slide bị xoá, có thể trùng frame đang sống.
  const byNode = new Map(
    results.filter((r) => r.action !== 'DELETE').map((r) => [r.figmaNodeId, r]),
  );
  const updates: MetadataUpdate[] = [];
  for (const change of changes) {
    if (change.action === 'DELETE') continue;
    const result = byNode.get(change.figmaNodeId);
    if (!result) continue;
    updates.push({
      figmaNodeId: change.figmaNodeId,
      postId,
      assetId: result.assetId,
      version: result.newVersion,
      fingerprint: change.fingerprint,
    });
  }
  return updates;
}
