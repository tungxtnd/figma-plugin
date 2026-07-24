import { LayoutContext } from '../core/context';
import { CANVAS, FALLBACK_ASSET } from '../tokens';
import { drawFallbackVector } from './fallback';

/** Track xem có dùng fallback không để Quality Engine tính điểm */
export let assetFallbackUsed = false;

export function resetFallbackFlag() {
  assetFallbackUsed = false;
}

/**
 * Tạo Image Frame với Asset Strategy theo 3 tầng ưu tiên:
 * 1. Ảnh thật từ context.assets.images
 * 2. Placeholder gradient (nếu không có ảnh)
 * 3. Frame trống với warning
 */
export async function createImageFrame(
  parent: FrameNode,
  context: LayoutContext,
  width: number,
  height: number,
): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = 'Asset Frame';
  frame.resize(width, height);
  frame.cornerRadius = 20;
  frame.layoutAlign = 'INHERIT';
  frame.primaryAxisSizingMode = 'FIXED';
  frame.counterAxisSizingMode = 'FIXED';

  const images = context.assets.images;

  if (images && images.length > 0) {
    // Tầng 1: Ảnh thật
    try {
      const img = figma.createImage(images[0].bytes);
      frame.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: img.hash }];
      // Drop shadow
      frame.effects = [{
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 0, y: 10 },
        radius: 20,
        visible: true,
        blendMode: 'NORMAL',
        showShadowBehindNode: false,
      }];
    } catch (_) {
      applyFallback(frame, context);
    }
  } else {
    // Tầng 2 & 3: Fallback
    applyFallback(frame, context);
  }

  parent.appendChild(frame);
  return frame;
}

function applyFallback(frame: FrameNode, context: LayoutContext): void {
  assetFallbackUsed = true;
  const layoutName = context.intent.layout_pattern;
  const fallbackName = FALLBACK_ASSET[layoutName] || FALLBACK_ASSET['split'];

  // 1. Phủ nền tối giản
  frame.fills = [{ type: 'SOLID', color: context.theme.cardBg }];

  // 2. Vẽ hình học vector Capi Demy làm đồ họa tượng trưng
  drawFallbackVector(frame, frame.width, frame.height, context.theme, layoutName);

  console.warn(`[AssetStrategy] No image found, drew vector fallback for "${fallbackName}"`);
}
