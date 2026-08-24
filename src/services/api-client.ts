export interface ApiClientConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
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
    public rawData?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/+$/, ''),
      clientId: config.clientId || 'figma-plugin',
      clientSecret: config.clientSecret || '',
    };
  }

  public updateConfig(partialConfig: Partial<ApiClientConfig>): void {
    this.config = {
      ...this.config,
      ...partialConfig,
      baseUrl: (partialConfig.baseUrl !== undefined ? partialConfig.baseUrl : this.config.baseUrl).replace(/\/+$/, ''),
    };
  }

  public getConfig(): ApiClientConfig {
    return { ...this.config };
  }

  public hasValidCredentials(): boolean {
    return Boolean(this.config.baseUrl && this.config.clientSecret.trim().length > 0);
  }

  private buildHeaders(
    customHeaders?: Record<string, string>,
    isFormData: boolean = false
  ): Record<string, string> {
    // Backend only verifies x-client-secret (HMAC signing was removed from
    // UnifiedAuthGuard) — send it on every request, JSON or multipart.
    const headers: Record<string, string> = {
      'x-client-id': this.config.clientId,
      'x-client-secret': this.config.clientSecret,
      'ngrok-skip-browser-warning': 'true',
      ...customHeaders,
    };

    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  private async request<T>(
    endpointPath: string,
    method: string,
    body?: any,
    options?: RequestOptions,
    isFormData: boolean = false
  ): Promise<T> {
    if (!this.hasValidCredentials()) {
      throw new ApiError(
        0,
        'NO_SECRET',
        'Authentication not configured. Please enter your Client Secret in Settings.'
      );
    }

    const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    const url = `${this.config.baseUrl}${cleanPath}`;
    const timeoutMs = options?.timeoutMs || 15000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = this.buildHeaders(options?.headers, isFormData);
      const reqInit: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (body !== undefined) {
        reqInit.body = isFormData ? body : JSON.stringify(body);
      }

      const res = await fetch(url, reqInit);
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

      if (err instanceof ApiError) {
        throw err;
      }

      if (err.name === 'AbortError') {
        throw new ApiError(408, 'REQUEST_TIMEOUT', `Request timed out after ${timeoutMs}ms`);
      }

      throw new ApiError(0, 'NETWORK_ERROR', err.message || 'Network error occurred');
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
    return this.request<T>(path, 'POST', body, options, false);
  }

  public async postFormData<T>(path: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'POST', formData, { timeoutMs: 60000, ...options }, true);
  }
}
