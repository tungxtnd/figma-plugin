import { orderByPosition } from '../shared/layout';
import { CanvasSlide, MetadataUpdate } from '../shared/diff';
import { SandboxToUi } from '../shared/messages';
import {
  findSection,
  fingerprintOf,
  getWorkPage,
  readFrameMeta,
  setKnownAssets,
  slideFrames,
  writeFrameMeta,
} from './canvas';

/**
 * Đọc slide trong Section của bài để đối chiếu với hệ thống.
 *
 * Chỉ xét frame nằm TRONG Section: frame có metadata của bài là slide sẵn có,
 * frame không metadata là slide mới người dùng thêm. Frame của bài khác lỡ kéo
 * vào thì bỏ qua (đếm ở `foreign`). Thứ tự = vị trí trái sang phải.
 */
export async function scanSection(postId: string, send: (m: SandboxToUi) => void): Promise<void> {
  const page = await getWorkPage();
  const section = findSection(page, postId);
  const slides: CanvasSlide[] = [];
  let foreign = 0;

  if (section) {
    const frames = orderByPosition(slideFrames(section));
    let order = 0;
    for (const frame of frames) {
      const meta = readFrameMeta(frame);
      if (meta && meta.postId !== postId) {
        foreign++;
        continue;
      }
      slides.push({
        figmaNodeId: frame.id,
        assetId: meta?.assetId,
        version: meta?.version,
        orderIndex: order++,
        fingerprint: fingerprintOf(frame),
      });
    }
  }

  send({ type: 'section-scanned', postId, slides, foreign });
}

export async function exportFrames(
  requestId: string,
  nodeIds: string[],
  scale: number,
  send: (m: SandboxToUi) => void,
): Promise<void> {
  const exports: { nodeId: string; bytes: Uint8Array }[] = [];
  const missing: string[] = [];
  try {
    for (const nodeId of nodeIds) {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node || node.type !== 'FRAME') {
        missing.push(nodeId);
        continue;
      }
      const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale } });
      exports.push({ nodeId, bytes });
      // Nhường luồng để Figma không đơ khi xuất nhiều slide.
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    send({ type: 'frames-exported', requestId, exports, missing });
  } catch (err) {
    send({
      type: 'frames-exported',
      requestId,
      exports,
      missing,
      error: `Không xuất được ảnh slide: ${(err as Error)?.message || err}`,
    });
  }
}

/** Gửi xong: ghi metadata server trả và chốt lại danh sách slide của Section. */
export async function commitSync(postId: string, updates: MetadataUpdate[]): Promise<void> {
  const page = await getWorkPage();
  const section = findSection(page, postId);
  const byNode = new Map(updates.map((u) => [u.figmaNodeId, u]));

  if (section) {
    const frames = orderByPosition(slideFrames(section));
    let order = 0;
    for (const frame of frames) {
      const update = byNode.get(frame.id);
      const meta = update
        ? { postId, assetId: update.assetId, version: update.version, fingerprint: update.fingerprint }
        : readFrameMeta(frame);
      if (!meta || meta.postId !== postId) continue;
      writeFrameMeta(frame, { ...meta, orderIndex: order++ });
    }
    setKnownAssets(
      section,
      slideFrames(section)
        .map((f) => readFrameMeta(f))
        .filter((m) => m && m.postId === postId)
        .map((m) => m!.assetId),
    );
  }
}
