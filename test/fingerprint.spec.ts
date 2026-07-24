import { serializeNode } from '../src/utils';
import SparkMD5 from 'spark-md5';

describe('Fingerprint Generation & Coordinate Rounding', () => {
  it('should generate identical fingerprints for sub-pixel coordinate variations', () => {
    const nodeA = {
      type: 'RECTANGLE',
      x: 10.2,
      y: 20.4,
      width: 100.1,
      height: 50.8,
      fills: [{ type: 'SOLID' }]
    };

    const nodeB = {
      type: 'RECTANGLE',
      x: 10.4, // within 0.5 diff
      y: 20.1,
      width: 100.4,
      height: 51.2, // rounds to 51
      fills: [{ type: 'SOLID' }]
    };

    const strA = serializeNode(nodeA);
    const strB = serializeNode(nodeB);

    expect(strA).toBe(strB); // Both round to RECTANGLE|10|20|100|51|has_fill

    const hashA = SparkMD5.hash(strA);
    const hashB = SparkMD5.hash(strB);

    expect(hashA).toBe(hashB);
  });

  it('should generate different fingerprints when text changes', () => {
    const nodeA = {
      type: 'TEXT',
      x: 10, y: 10, width: 100, height: 20,
      characters: 'Hello World'
    };

    const nodeB = {
      type: 'TEXT',
      x: 10, y: 10, width: 100, height: 20,
      characters: 'Hello Figma'
    };

    const strA = serializeNode(nodeA);
    const strB = serializeNode(nodeB);

    expect(strA).not.toBe(strB);
    expect(SparkMD5.hash(strA)).not.toBe(SparkMD5.hash(strB));
  });

  it('should generate different fingerprints when structure changes', () => {
    const parentA = {
      type: 'FRAME',
      x: 0, y: 0, width: 500, height: 500,
      children: [
        { type: 'TEXT', x: 10, y: 10, width: 100, height: 20, characters: 'Title' }
      ]
    };

    const parentB = {
      type: 'FRAME',
      x: 0, y: 0, width: 500, height: 500,
      children: [
        { type: 'TEXT', x: 10, y: 10, width: 100, height: 20, characters: 'Title' },
        { type: 'RECTANGLE', x: 10, y: 50, width: 100, height: 100 }
      ]
    };

    const strA = serializeNode(parentA);
    const strB = serializeNode(parentB);

    expect(strA).not.toBe(strB);
    expect(SparkMD5.hash(strA)).not.toBe(SparkMD5.hash(strB));
  });
});
