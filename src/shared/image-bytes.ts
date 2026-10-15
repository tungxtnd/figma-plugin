/**
 * `figma.createImage` chỉ nhận PNG, JPEG, GIF. Ảnh khác (SVG, WebP) hoặc một
 * trang HTML trả 200 (trang cảnh báo virus của Google Drive) làm job vỡ giữa
 * chừng — nên kiểm vài byte đầu trước khi gửi sang sandbox.
 */
export type ImageKind = 'png' | 'jpeg' | 'gif';

export function sniffImage(bytes: Uint8Array | null | undefined): ImageKind | null {
  if (!bytes || bytes.length < 4) return null;
  const [a, b, c, d] = bytes;
  if (a === 0x89 && b === 0x50 && c === 0x4e && d === 0x47) return 'png';
  if (a === 0xff && b === 0xd8 && c === 0xff) return 'jpeg';
  if (a === 0x47 && b === 0x49 && c === 0x46 && d === 0x38) return 'gif';
  return null;
}

/**
 * Cache ảnh theo URL, có trần dung lượng. Map trần trước đây giữ mọi ảnh của cả
 * phiên — vài trăm slide là vài trăm MB trong iframe.
 */
export class ByteLru {
  private readonly items = new Map<string, Uint8Array>();
  private total = 0;

  constructor(private readonly maxBytes: number) {}

  get(key: string): Uint8Array | undefined {
    const value = this.items.get(key);
    if (value) {
      // Đưa lên cuối = mới dùng gần nhất.
      this.items.delete(key);
      this.items.set(key, value);
    }
    return value;
  }

  set(key: string, value: Uint8Array): void {
    if (value.length > this.maxBytes) return;
    const old = this.items.get(key);
    if (old) {
      this.total -= old.length;
      this.items.delete(key);
    }
    this.items.set(key, value);
    this.total += value.length;
    while (this.total > this.maxBytes) {
      const oldest = this.items.keys().next().value as string;
      this.total -= this.items.get(oldest)!.length;
      this.items.delete(oldest);
    }
  }

  get size(): number {
    return this.total;
  }
}
