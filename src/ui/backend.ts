import { ApiClient } from '../services/api-client';
import {
  ClaimedJob,
  Envelope,
  MyWork,
  RemoteDesign,
  SyncResponse,
} from '../shared/api-types';
import { SlideChange } from '../shared/diff';

/** Máy chủ có sẵn. Mặc định là bản chính thức; còn lại nằm trong "Nâng cao". */
export const SERVERS = [
  { id: 'production', label: 'Chính thức', url: 'https://automation.ipactechnology.com/api' },
  { id: 'staging', label: 'Thử nghiệm (staging)', url: 'https://staging.ipactechnology.com/api' },
] as const;

export const DEFAULT_SERVER = SERVERS[0].url;

/** Byte PNG từ sandbox → Blob (TS coi Uint8Array có thể dùng SharedArrayBuffer). */
export function pngBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as unknown as BlobPart], { type: 'image/png' });
}

export function serverLabel(url: string): string {
  return SERVERS.find((s) => s.url === url)?.label ?? url;
}

/** Các lời gọi backend của plugin, theo đúng hợp đồng `docs/04-api-va-bao-mat.md` §6. */
export class Backend {
  constructor(readonly client: ApiClient) {}

  async mine(): Promise<MyWork> {
    return (await this.client.get<Envelope<MyWork>>('/designs/mine')).data;
  }

  async claimNext(): Promise<ClaimedJob | null> {
    return (await this.client.post<Envelope<ClaimedJob | null>>('/designs/claim-next')).data;
  }

  async uploadResult(assetId: string, bytes: Uint8Array, renderResult: unknown): Promise<void> {
    const form = new FormData();
    form.append('file', pngBlob(bytes), `${assetId}.png`);
    form.append('renderResult', JSON.stringify(renderResult));
    await this.client.postFormData(`/designs/${assetId}/render-result`, form);
  }

  async reportFailed(assetId: string, error: string): Promise<void> {
    await this.client.post(`/designs/${assetId}/render-failed`, { error: error.slice(0, 2000) });
  }

  async retryFailed(postId: string): Promise<number> {
    return (await this.client.post<Envelope<{ retried: number }>>('/designs/retry-failed', { postId })).data.retried;
  }

  async canvasStatus(postIds: string[]): Promise<string[]> {
    if (postIds.length === 0) return [];
    return (
      await this.client.post<Envelope<{ removable: string[] }>>('/designs/canvas-status', {
        postIds: postIds.slice(0, 200),
      })
    ).data.removable;
  }

  async designs(postId: string): Promise<RemoteDesign[]> {
    return (await this.client.get<Envelope<RemoteDesign[]>>(`/posts/${postId}/designs`)).data;
  }

  async sync(
    postId: string,
    changes: SlideChange[],
    files: { fieldName: string; bytes: Uint8Array }[],
  ): Promise<SyncResponse> {
    const form = new FormData();
    form.append('changes', JSON.stringify({ changes }));
    for (const f of files) {
      form.append(f.fieldName, pngBlob(f.bytes), `${f.fieldName}.png`);
    }
    const res = await this.client.postFormData<Envelope<SyncResponse>>(`/posts/${postId}/sync-canvas`, form, {
      headers: { 'X-Transaction-ID': uuid() },
    });
    return res.data;
  }
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
