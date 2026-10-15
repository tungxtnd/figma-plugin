import { runRenderingPipeline } from '../core/pipeline';
import { CANVAS } from '../tokens';
import { WarningCode } from '../types';
import { slidePosition } from '../shared/layout';
import { SandboxToUi, UiToSandbox } from '../shared/messages';
import {
  ensureSection,
  findFrameByAsset,
  fingerprintOf,
  fitSection,
  getWorkPage,
  knownAssets,
  setKnownAssets,
  writeFrameMeta,
} from './canvas';
import { resolveIntent } from './intent';

type RenderJobMessage = Extract<UiToSandbox, { type: 'render-job' }>;

// Variant của slide liền trước trong cùng bài — tránh hai slide cạnh nhau giống hệt.
let lastPostId: string | undefined;
let lastVariantName: string | undefined;

/**
 * Dựng một slide vào Section của bài.
 *
 * Mọi lỗi đều thành `job-failed` với câu người đọc được — trước đây lỗi xảy ra
 * trước khối try (payload rỗng) không báo gì, UI chờ mãi và hàng đợi dừng hẳn.
 *
 * Không đổi trang, không đổi vùng nhìn, không đổi vùng chọn của người dùng:
 * plugin chạy nền trong lúc họ làm việc khác.
 */
export async function renderJob(msg: RenderJobMessage, send: (m: SandboxToUi) => void): Promise<void> {
  const { job } = msg;
  try {
    if (!job?.renderedPayload) {
      throw new Error('Slide không có nội dung để dựng.');
    }

    if (lastPostId !== job.postId) {
      lastPostId = job.postId;
      lastVariantName = undefined;
    }

    const page = await getWorkPage();
    const section = ensureSection(page, job.postId, job.postTitle, CANVAS.Size);
    const intent = resolveIntent(job.renderedPayload);

    // Vẽ xong mới thay frame cũ: dựng lại hỏng thì frame người dùng đã sửa tay vẫn còn.
    const { slideNode, renderResult, variantUsed } = await runRenderingPipeline(
      job as any,
      intent,
      msg.images,
      msg.logoBytes,
      msg.bgBytes,
      lastVariantName,
    );
    lastVariantName = variantUsed;

    const old = findFrameByAsset(section, job.assetId);
    section.appendChild(slideNode);
    const pos = old ? { x: old.x, y: old.y } : slidePosition(job.orderIndex, slideNode.width);
    slideNode.x = pos.x;
    slideNode.y = pos.y;
    old?.remove();
    fitSection(section, CANVAS.Size);

    const fingerprint = fingerprintOf(slideNode);
    writeFrameMeta(slideNode, {
      postId: job.postId,
      assetId: job.assetId,
      version: job.version,
      fingerprint,
      orderIndex: job.orderIndex,
    });
    setKnownAssets(section, [...knownAssets(section), job.assetId]);

    const bytes = await slideNode.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });

    if (msg.missingImages.length > 0 && !renderResult.warnings.includes(WarningCode.IMAGE_MISSING)) {
      renderResult.warnings.push(WarningCode.IMAGE_MISSING);
    }

    send({
      type: 'job-rendered',
      assetId: job.assetId,
      bytes,
      renderResult: { ...renderResult, fingerprint, figmaNodeId: slideNode.id },
    });
  } catch (err) {
    send({ type: 'job-failed', assetId: job?.assetId, error: friendlyError(err) });
  }
}

function friendlyError(err: unknown): string {
  const message = (err as Error)?.message || String(err || '');
  if (!message) return 'Lỗi không rõ khi dựng slide.';
  // Lỗi của chính plugin đã viết sẵn bằng lời; lỗi của Figma thì kèm nguyên văn.
  if (/[à-ỹ]/i.test(message)) return message;
  return `Figma báo lỗi khi dựng slide: ${message}`;
}
