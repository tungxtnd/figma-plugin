export function serializeNode(node: any, isRoot: boolean = true): string {
  // If it's the root frame, ignore its absolute X/Y on the canvas. For children, keep X/Y relative to parent.
  const x = isRoot ? 0 : Math.round(node.x);
  const y = isRoot ? 0 : Math.round(node.y);
  let str = `${node.type}|${x}|${y}|${Math.round(node.width)}|${Math.round(node.height)}`;
  if ('characters' in node) str += `|${node.characters}`;
  if ('fills' in node) {
    const fills = node.fills;
    if (Array.isArray(fills) && fills.length > 0) {
      str += `|has_fill`;
    }
  }
  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      str += `>(${serializeNode(child, false)})`;
    }
  }
  return str;
}
