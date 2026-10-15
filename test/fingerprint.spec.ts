import { serializeNode } from '../src/utils';
import SparkMD5 from 'spark-md5';

const solid = (r: number, g: number, b: number) => [{ type: 'SOLID', color: { r, g, b } }];

describe('Fingerprint Generation & Coordinate Rounding', () => {
  it('should generate identical fingerprints for sub-pixel coordinate variations', () => {
    const nodeA = { type: 'RECTANGLE', x: 10.2, y: 20.4, width: 100.1, height: 50.8, fills: solid(1, 0, 0) };
    const nodeB = { type: 'RECTANGLE', x: 10.4, y: 20.1, width: 100.4, height: 51.2, fills: solid(1, 0, 0) };

    const parentA = { type: 'FRAME', x: 0, y: 0, width: 500, height: 500, children: [nodeA] };
    const parentB = { type: 'FRAME', x: 0, y: 0, width: 500, height: 500, children: [nodeB] };

    expect(SparkMD5.hash(serializeNode(parentA))).toBe(SparkMD5.hash(serializeNode(parentB)));
  });

  it('kéo cả slide sang chỗ khác trên canvas không tính là sửa', () => {
    const a = { type: 'FRAME', x: 0, y: 0, width: 500, height: 500, fills: solid(0, 0, 0) };
    const b = { ...a, x: 2000, y: 900 };
    expect(serializeNode(a)).toBe(serializeNode(b));
  });

  it('should generate different fingerprints when text changes', () => {
    const nodeA = { type: 'TEXT', x: 10, y: 10, width: 100, height: 20, characters: 'Hello World' };
    const nodeB = { ...nodeA, characters: 'Hello Figma' };
    expect(serializeNode(nodeA)).not.toBe(serializeNode(nodeB));
  });

  it('should generate different fingerprints when structure changes', () => {
    const parentA = {
      type: 'FRAME', x: 0, y: 0, width: 500, height: 500,
      children: [{ type: 'TEXT', x: 10, y: 10, width: 100, height: 20, characters: 'Title' }],
    };
    const parentB = {
      ...parentA,
      children: [...parentA.children, { type: 'RECTANGLE', x: 10, y: 50, width: 100, height: 100 }],
    };
    expect(serializeNode(parentA)).not.toBe(serializeNode(parentB));
  });

  it('đổi màu fill là có thay đổi', () => {
    const a = { type: 'RECTANGLE', x: 0, y: 0, width: 10, height: 10, fills: solid(1, 0, 0) };
    const b = { ...a, fills: solid(0, 0, 1) };
    expect(serializeNode(a)).not.toBe(serializeNode(b));
  });

  it('thay ảnh là có thay đổi', () => {
    const a = { type: 'RECTANGLE', x: 0, y: 0, width: 10, height: 10, fills: [{ type: 'IMAGE', imageHash: 'h1', scaleMode: 'FILL' }] };
    const b = { ...a, fills: [{ type: 'IMAGE', imageHash: 'h2', scaleMode: 'FILL' }] };
    expect(serializeNode(a)).not.toBe(serializeNode(b));
  });

  it('đổi font, cỡ chữ, ẩn hiện, độ mờ, xoay đều là có thay đổi', () => {
    const base = {
      type: 'TEXT', x: 0, y: 0, width: 10, height: 10, characters: 'A',
      fontName: { family: 'Inter', style: 'Bold' }, fontSize: 40, opacity: 1, visible: true, rotation: 0,
    };
    const variants = [
      { ...base, fontName: { family: 'Inter', style: 'Regular' } },
      { ...base, fontSize: 32 },
      { ...base, visible: false },
      { ...base, opacity: 0.5 },
      { ...base, rotation: 15 },
    ];
    for (const v of variants) {
      expect(serializeNode(v)).not.toBe(serializeNode(base));
    }
  });

  it('text nhiều kiểu fill (figma.mixed) không làm vỡ', () => {
    const node = { type: 'TEXT', x: 0, y: 0, width: 10, height: 10, characters: 'A', fills: Symbol('mixed') };
    expect(serializeNode(node)).toContain('mixed');
  });
});
