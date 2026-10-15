export interface ApiClientConfig {
  baseUrl: string;
  /** Mã kết nối người dùng tự tạo trên web (menu tài khoản → Kết nối Figma plugin). */
  pluginToken: string;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public rawData?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Mã kết nối sai, đã thu hồi, hoặc tài khoản bị khoá. */
  get isAuth(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export class ApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = normalize(config);
  }

  public updateConfig(partial: Partial<ApiClientConfig>): void {
    this.config = normalize({ ...this.config, ...partial });
  }

  public hasValidCredentials(): boolean {
    return Boolean(this.config.baseUrl && this.config.pluginToken.length > 0);
  }

  private async request<T>(
    endpointPath: string,
    method: string,
    body?: any,
    options?: RequestOptions,
    isFormData: boolean = false,
  ): Promise<T> {
    if (!this.hasValidCredentials()) {
      throw new ApiError(0, 'NO_SECRET', 'Bạn chưa nhập mã kết nối.');
    }

    const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    const url = `${this.config.baseUrl}${cleanPath}`;
    const timeoutMs = options?.timeoutMs || 15000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'x-plugin-token': this.config.pluginToken,
        ...options?.headers,
      };
      if (!isFormData && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

      const res = await fetch(url, {
        method,
        headers,
        signal: controller.signal,
        body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      });
      clearTimeout(timer);

      if (!res.ok) {
        let errJson: any = null;
        try {
          errJson = await res.json();
        } catch (_) {}
        const message = errJson?.message || `HTTP ${res.status} ${res.statusText}`;
        const code = errJson?.error_code || errJson?.errorCode || errJson?.code || `HTTP_${res.status}`;
        throw new ApiError(res.status, code, message, errJson);
      }

      return (await res.json()) as T;
    } catch (err: any) {
      clearTimeout(timer);
      if (err instanceof ApiError) throw err;
      if (err?.name === 'AbortError') {
        throw new ApiError(408, 'REQUEST_TIMEOUT', `Máy chủ không trả lời sau ${Math.round(timeoutMs / 1000)} giây.`);
      }
      throw new ApiError(0, 'NETWORK_ERROR', err?.message || 'Không kết nối được máy chủ.');
    }
  }

  public async get<T>(path: string, options?: RequestOptions): Promise<T> {
    let retries = 2;
    while (true) {
      try {
        return await this.request<T>(path, 'GET', undefined, options, false);
      } catch (err: any) {
        if (retries > 0 && (err.status === 429 || err.code === 'NETWORK_ERROR')) {
          retries--;
          await new Promise((resolve) => setTimeout(resolve, 1000 * (2 - retries)));
          continue;
        }
        throw err;
      }
    }
  }

  public async post<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'POST', body ?? {}, options, false);
  }

  public async postFormData<T>(path: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'POST', formData, { timeoutMs: 180000, ...options }, true);
  }
}

function normalize(config: ApiClientConfig): ApiClientConfig {
  return {
    baseUrl: (config.baseUrl || '').trim().replace(/\/+$/, ''),
    pluginToken: (config.pluginToken || '').trim(),
  };
}
