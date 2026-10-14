import { DiffResult, SyncChange, SyncSlide } from '../types';

export type ScannedSlide = SyncSlide;

/** Một design phía server (`GET /posts/:id/designs`). */
export interface RemoteDesign {
  assetId: string;
  figmaNodeId: string | null;
  fingerprint: string | null;
  version: number;
  orderIndex: number;
}

/** Một mục `results` server trả về sau sync-canvas. */
export interface SyncResultItem {
  assetId: string;
  figmaNodeId: string;
  action: string;
  newVersion: number;
}

/**
 * So frame trên canvas với design trên server → danh sách thay đổi.
 *
 * Thuần — không gọi Figma API, để test bằng jest. Luật (plans 09 §4.6–4.7):
 * - Frame không metadata, hoặc assetId không còn trên server → `CREATE`.
 * - Nhiều frame cùng assetId (duplicate Ctrl+D chép cả pluginData): frame
 *   ĐỨNG TRƯỚC theo thứ tự canvas giữ asset; các frame sau là `CREATE`.
 * - Fingerprint khác → `UPDATE`; giống mà khác `orderIndex` → `REORDER`.
 * - Asset server không còn frame nào giữ → `DELETE`.
 * - `local.version > remote.version` chỉ xảy ra do lỗi cũ (plugin tự cộng
 *   version sau CREATE) → dùng version server, gắn cảnh báo. Nhỏ hơn là xung
 *   đột thật — giữ nguyên để server 409.
 */
export function computeCanvasDiff(
  slides: ScannedSlide[],
  remoteDesigns: RemoteDesign[],
  hash: (raw: string) => string,
): DiffResult[] {
  const remoteMap = new Map(remoteDesigns.map((d) => [d.assetId, d]));
  const claimed = new Set<string>();
  const diffs: DiffResult[] = [];

  for (const slide of slides) {
    const fingerprint = hash(slide.fingerprint);
    const assetId = slide.pluginAssetId;
    const remote =
      assetId && !claimed.has(assetId) ? remoteMap.get(assetId) : undefined;

    const name = slide.name !== undefined ? { name: slide.name } : {};

    if (!assetId || !remote) {
      diffs.push({
        figmaNodeId: slide.figmaNodeId,
        assetId: undefined,
        version: 1,
        orderIndex: slide.orderIndex,
        fingerprint,
        action: 'CREATE',
        ...name,
      });
      continue;
    }
    claimed.add(assetId);

    const contentMatches = remote.fingerprint === fingerprint;
    let version = slide.version ?? remote.version;
    let warning: string | undefined;
    let healMetadata: boolean | undefined;
    if (contentMatches && version !== remote.version) {
      // Nội dung y hệt bản trên server → frame đang mới nhất, chỉ metadata cũ.
      healMetadata = true;
      version = remote.version;
    } else if (version > remote.version) {
      warning = `Frame ${slide.figmaNodeId}: version trên frame (${version}) lớn hơn server (${remote.version}) — dùng version server.`;
      version = remote.version;
    }

    const action = !contentMatches
      ? 'UPDATE'
      : remote.orderIndex !== slide.orderIndex
        ? 'REORDER'
        : 'UNCHANGED';

    diffs.push({
      figmaNodeId: slide.figmaNodeId,
      assetId,
      version,
      orderIndex: slide.orderIndex,
      fingerprint,
      action,
      fromIndex: remote.orderIndex,
      ...name,
      ...(warning ? { warning } : {}),
      ...(healMetadata ? { healMetadata } : {}),
    });
  }

  for (const remote of remoteDesigns) {
    if (claimed.has(remote.assetId)) continue;
    diffs.push({
      figmaNodeId: remote.figmaNodeId || '',
      assetId: remote.assetId,
      version: remote.version || 1,
      orderIndex: -1,
      fingerprint: remote.fingerprint || '',
      action: 'DELETE',
      fromIndex: remote.orderIndex,
    });
  }

  return diffs;
}

/** Field multipart chứa PNG của một frame. */
export function fileFieldNameOf(figmaNodeId: string): string {
  return `slide_${figmaNodeId}`;
}

/** Chỉ CREATE/UPDATE cần ảnh — REORDER/DELETE không export, không upload. */
export function needsExport(d: DiffResult): boolean {
  return d.action === 'CREATE' || d.action === 'UPDATE';
}

/** Diff → `changes` gửi server. Bỏ UNCHANGED và trường nội bộ. */
export function buildSyncChanges(diffs: DiffResult[]): SyncChange[] {
  const changes: SyncChange[] = [];
  for (const d of diffs) {
    if (d.action === 'UNCHANGED') continue;
    changes.push({
      figmaNodeId: d.figmaNodeId,
      assetId: d.assetId,
      version: d.version,
      orderIndex: d.orderIndex,
      fingerprint: d.fingerprint,
      action: d.action,
      fileFieldName: needsExport(d) ? fileFieldNameOf(d.figmaNodeId) : undefined,
    });
  }
  return changes;
}

/**
 * Sau 409: nhận version hiện tại của server cho các UPDATE đang gửi version cũ.
 *
 * Không tự gửi lại — phía gọi báo người dùng kiểm ảnh trên web rồi bấm Sync lần
 * nữa (lần bấm đó là xác nhận ghi đè bản trên server bằng frame hiện tại). Body
 * 409 bị bộ lọc lỗi backend bọc lại nên không biết asset nào lệch; tra lại toàn
 * bộ qua `GET /posts/:id/designs`.
 */
export function adoptRemoteVersions(
  diffs: DiffResult[],
  remoteDesigns: RemoteDesign[],
): { diffs: DiffResult[]; adopted: (DiffResult & { fromVersion: number })[] } {
  const remoteVersion = new Map(remoteDesigns.map((d) => [d.assetId, d.version]));
  const adopted: (DiffResult & { fromVersion: number })[] = [];
  const next = diffs.map((d) => {
    const v = d.assetId ? remoteVersion.get(d.assetId) : undefined;
    if (d.action !== 'UPDATE' || v === undefined || v <= d.version) return d;
    const updated = { ...d, version: v };
    adopted.push({ ...updated, fromVersion: d.version });
    return updated;
  });
  return { diffs: next, adopted };
}

/**
 * Lấy `results` từ response sync-canvas. Backend bọc `buildWorkflowEnvelope`
 * nên mảng thật nằm ở `data.results`; vẫn nhận dạng phẳng `results`.
 * (Trước 02-10-2026 plugin đọc `results` ở lớp ngoài → luôn rỗng, và che lỗi bằng
 * cách tự cộng version / sinh assetId ngẫu nhiên.)
 */
export function extractSyncResults(res: unknown): SyncResultItem[] {
  const r = res as { results?: unknown; data?: { results?: unknown } } | undefined;
  const results = r?.data?.results ?? r?.results;
  return Array.isArray(results) ? (results as SyncResultItem[]) : [];
}

/**
 * Metadata ghi ngược vào frame sau sync. `version` lấy từ `newVersion` server
 * trả về — KHÔNG tự cộng (lỗi A: CREATE ghi DB v1 nhưng frame v2 → 409 giả).
 * Frame không có kết quả tương ứng thì không ghi, trả trong `missing` để log.
 */
export function buildMetadataUpdates(
  diffs: DiffResult[],
  results: SyncResultItem[],
  postId: string,
): {
  updates: { figmaNodeId: string; postId: string; assetId: string; version: number; fingerprint: string }[];
  missing: string[];
} {
  const updates = [];
  const missing: string[] = [];
  for (const d of diffs) {
    if (d.action === 'UNCHANGED' || d.action === 'DELETE') continue;
    const result = results.find((r) => r.figmaNodeId === d.figmaNodeId && r.action !== 'DELETE');
    if (!result) {
      missing.push(d.figmaNodeId);
      continue;
    }
    updates.push({
      figmaNodeId: d.figmaNodeId,
      postId,
      assetId: result.assetId,
      version: result.newVersion,
      fingerprint: d.fingerprint,
    });
  }
  return { updates, missing };
}
