/**
 * Fallback Vector Assets Library v1.0
 * Dựng trực tiếp các khối hình học vector Figma làm hình minh họa nếu không tải được ảnh.
 * Bảo đảm Plugin chạy offline 100% không bị vỡ bố cục khi thiếu asset.
 *
 * Ref: design_engine_execution_specification.md §3b (Default Asset Fallback)
 */

import { RGB } from '../tokens';

export function drawFallbackVector(
  parent: FrameNode,
  width: number,
  height: number,
  colors: { textPrimary: RGB; highlight: RGB; cardBg: RGB },
  layoutName?: string
): void {
  // Set layoutPositioning sang ABSOLUTE để tự do xếp đè tạo tính nghệ thuật
  const isAutoLayout = parent.layoutMode !== 'NONE';
  
  // 1. Khối nền Card trang trí
  const baseCard = figma.createRectangle();
  baseCard.name = 'Fallback Base Card';
  baseCard.resize(width * 0.8, height * 0.8);
  baseCard.cornerRadius = 16;
  baseCard.fills = [{ type: 'SOLID', color: colors.cardBg }];
  baseCard.x = (width - baseCard.width) / 2;
  baseCard.y = (height - baseCard.height) / 2;
  parent.appendChild(baseCard);
  if (isAutoLayout) {
    (baseCard as any).layoutPositioning = 'ABSOLUTE';
  }

  // 2. Định nghĩa chuỗi đường cong vector tượng trưng
  let pathData = '';
  let fillColor = colors.highlight;

  if (layoutName === 'timeline') {
    // Minh họa kết nối chuỗi / timeline
    pathData = 'M 15 50 L 85 50 M 30 35 L 45 50 L 30 65 M 70 35 L 85 50 L 70 65';
    fillColor = colors.highlight;
  } else if (layoutName === 'grid') {
    // Minh họa Avatar người dùng (Vẽ đầu hình tròn bằng Cubic Bezier thay vì Arc A)
    pathData = 'M 65 30 C 65 38.28 58.28 45 50 45 C 41.72 45 35 38.28 35 30 C 35 21.72 41.72 15 50 15 C 58.28 15 65 21.72 65 30 Z M 25 75 C 25 60 35 55 50 55 C 65 55 75 60 75 75 Z';
    fillColor = colors.highlight;
  } else {
    // Mặc định: Núi và mặt trời tượng trưng cho phong cảnh/hình ảnh (Vẽ mặt trời bằng Cubic Bezier thay vì Arc A)
    pathData = 'M 15 75 L 45 35 L 75 75 Z M 50 75 L 70 50 L 90 75 Z M 75 20 C 75 25.52 70.52 30 65 30 C 59.48 30 55 25.52 55 20 C 55 14.48 59.48 10 65 10 C 70.52 10 75 14.48 75 20 Z';
    fillColor = colors.highlight;
  }

  // 3. Tạo Vector Node
  const vector = figma.createVector();
  vector.name = 'Fallback Vector Graphic';
  vector.vectorPaths = [{ windingRule: 'NONZERO', data: pathData }];
  vector.fills = [{ type: 'SOLID', color: fillColor }];
  vector.strokes = [{ type: 'SOLID', color: colors.textPrimary }];
  vector.strokeWeight = 2;
  vector.opacity = 0.85;

  // Tính tỷ lệ co giãn (hộp vẽ 100x100)
  const scale = Math.min(baseCard.width * 0.4, baseCard.height * 0.4) / 100;
  vector.resize(100 * scale, 100 * scale);

  // Căn giữa vector node
  vector.x = baseCard.x + (baseCard.width - vector.width) / 2;
  vector.y = baseCard.y + (baseCard.height - vector.height) / 2;

  parent.appendChild(vector);
  if (isAutoLayout) {
    (vector as any).layoutPositioning = 'ABSOLUTE';
  }
}
