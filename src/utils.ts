/**
 * Chuỗi mô tả hình ảnh của một node, để băm thành fingerprint so với server.
 *
 * Trước đây chuỗi chỉ ghi `has_fill`: đổi màu, thay ảnh, đổi font đều ra cùng
 * fingerprint, nên "Gửi bản sửa" báo không có thay đổi gì. Giờ ghi đủ những gì
 * người nhìn thấy. Toạ độ làm tròn để lệch dưới nửa pixel không tính là sửa.
 */
export function serializeNode(node: any, isRoot: boolean = true): string {
  // Frame gốc bỏ toạ độ tuyệt đối trên canvas — kéo cả slide đi chỗ khác không phải là sửa.
  const x = isRoot ? 0 : Math.round(node.x);
  const y = isRoot ? 0 : Math.round(node.y);
  let str = `${node.type}|${x}|${y}|${Math.round(node.width)}|${Math.round(node.height)}`;

  if (node.visible === false) str += '|hidden';
  if (typeof node.opacity === 'number' && node.opacity !== 1) str += `|o${round2(node.opacity)}`;
  if (typeof node.rotation === 'number' && Math.round(node.rotation) !== 0) str += `|r${Math.round(node.rotation)}`;
  if ('characters' in node) str += `|${node.characters}`;
  if (node.fontName && typeof node.fontName === 'object') str += `|f${node.fontName.family}/${node.fontName.style}`;
  if (typeof node.fontSize === 'number') str += `|s${Math.round(node.fontSize)}`;
  if ('fills' in node) str += `|${serializePaints(node.fills)}`;
  if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
    str += `|k${serializePaints(node.strokes)}`;
  }

  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      str += `>(${serializeNode(child, false)})`;
    }
  }
  return str;
}

function serializePaints(paints: unknown): string {
  // `figma.mixed` (nhiều kiểu fill trong một text) không phải mảng.
  if (!Array.isArray(paints)) return 'mixed';
  return paints
    .filter((p: any) => p && p.visible !== false)
    .map((p: any) => {
      if (p.type === 'SOLID' && p.color) {
        const alpha = p.opacity !== undefined && p.opacity !== 1 ? `@${round2(p.opacity)}` : '';
        return `S${hex(p.color.r)}${hex(p.color.g)}${hex(p.color.b)}${alpha}`;
      }
      if (p.type === 'IMAGE') return `I${p.imageHash ?? ''}:${p.scaleMode ?? ''}`;
      return p.type;
    })
    .join(',');
}

function hex(channel: number): string {
  return Math.round(channel * 255).toString(16).padStart(2, '0');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
