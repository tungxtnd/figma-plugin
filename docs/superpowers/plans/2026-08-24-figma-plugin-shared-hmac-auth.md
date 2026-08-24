# Figma Plugin: Shared HMAC Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Figma plugin authenticate to the NestJS backend using the same HMAC scheme n8n already uses (`HMAC_N8N_TO_NEST_CURRENT`), replacing the dead `x-client-id`/`x-client-secret` mechanism that `UnifiedAuthGuard` no longer accepts, and fix the two stale `/content/posts/...` paths left over from the 19-08-2026 route migration.

**Architecture:** Port the canonical-string + HMAC-SHA256 signing logic from `Marketing-Automation-OS/src/common/security/services/hmac-auth.service.ts` and `.../utils/canonical-path.util.ts` into a new `src/services/hmac-signer.ts` in the plugin, using the Web Crypto API (`crypto.subtle`) since the plugin UI runs in a browser iframe (no Node `crypto`). `api-client.ts` is rewritten to sign every request instead of sending client-id/secret headers. No NestJS changes are needed — `UnifiedAuthGuard` already accepts `HMAC_N8N_TO_NEST_CURRENT` for any caller, since it doesn't track caller identity.

**Tech Stack:** TypeScript, Web Crypto API (`crypto.subtle`, `crypto.randomUUID`, `crypto.getRandomValues`), Jest + ts-jest (devDependencies already present, not yet wired up), esbuild (existing build, untouched).

**Spec:** This plan is based on live investigation of both repos during this conversation (no separate written spec file) — the load-bearing facts are recorded inline in Task 2 and the Global Constraints below, each traceable to an exact file/line in `Marketing-Automation-OS`.

## Global Constraints

- Canonical string format (v3.2): `METHOD\nPATH\nTIMESTAMP\nNONCE\nSHA256_hex(body)`, joined with `\n` — from `hmac-auth.service.ts:56-65`.
- `TIMESTAMP` is **seconds**, not milliseconds: `Math.floor(Date.now() / 1000)` — from `hmac-auth.service.ts:117`.
- `NONCE` is a UUID v4 (`crypto.randomUUID()`), not the `/^[0-9a-f]{32}$/` format the older doc describes — from `hmac-auth.service.ts:118`.
- `PATH` must go through `normalizeSignedPath()` byte-for-byte identical to `canonical-path.util.ts:23-39`: strip trailing `/` (root stays `/`), sort raw `k=v` query pairs as strings, **never** URL-decode, **never** use `URLSearchParams` (it re-encodes and desyncs the signature).
- Body hash for **JSON POST**: `sha256` of the exact UTF-8 bytes of the JSON string actually sent — matches `hmac-auth.service.ts:51-54`.
- Body hash for **GET and multipart/form-data POST**: `sha256` of an **empty** buffer. This is not a simplification — it's what the server actually verifies. `main.ts:10` enables Nest's `rawBody: true`, but that feature only wraps the `json`/`urlencoded`/`text` body parsers; multipart is parsed separately by Multer via `FileInterceptor`/`AnyFilesInterceptor`, so `req.rawBody` is `undefined` for multipart requests. `unified-auth.guard.ts` passes `req.rawBody` straight into `buildCanonicalString`, which does `rawBody ?? Buffer.alloc(0)` (`hmac-auth.service.ts:53`) — confirmed by the existing regression test `hmac-auth.service.spec.ts:53-73` ("body rỗng và body undefined cho cùng một hash") and by `unified-auth.guard.spec.ts:131-138`, which signs a GET request against an empty buffer and comments "GET không có body -> đúng như thực tế". Signing the real multipart bytes will produce a signature the server can never validate.
- Secret value: the content of `secrets/hmac_n8n_to_nest_current` on the server (env var `HMAC_N8N_TO_NEST_CURRENT` inside the n8n container). This value is **never** committed to the plugin repo — it is pasted once into the plugin's Settings tab at runtime and persisted only in `figma.clientStorage` (per Figma account/machine).
- No NestJS-side changes in this plan — `SECRET_FILES.INBOUND_CURRENT` already accepts this key for every route behind `UnifiedAuthGuard`.

---

## File Structure

New:
- `src/services/hmac-signer.ts` — `normalizeSignedPath`, `buildCanonicalString`, `buildSignedHeaders`. Pure, no I/O beyond Web Crypto.
- `src/services/hmac-signer.test.ts` — unit tests, including a cross-check against Node's `crypto.createHmac` so a passing suite proves byte-for-byte compatibility with what the real NestJS server computes.
- `src/services/api-client.test.ts` — tests `ApiClient` against a mocked `global.fetch`.
- `jest.config.js`, `tsconfig.jest.json`, `jest.setup.ts` — test runner wiring (currently `jest`/`ts-jest`/`@types/jest` are installed but nothing is configured).

Modified:
- `src/services/api-client.ts` — replace `x-client-id`/`x-client-secret` header building with HMAC signing; `ApiClientConfig.clientSecret` → `hmacSecret`; drop `clientId` entirely.
- `src/types.ts` — `AuthConfig.clientSecret` → `hmacSecret`.
- `src/code.ts` — `figma.clientStorage` key rename, `config.clientSecret` → `config.hmacSecret`.
- `src/ui.tsx` — rename state/wiring to match, fix the two `/content/posts/...` paths, update the Settings label.
- `package.json` — add `"test": "jest"` script.

---

### Task 1: Wire up Jest

**Files:**
- Create: `jest.config.js`
- Create: `tsconfig.jest.json`
- Create: `jest.setup.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: a working `npm test` that runs `**/*.test.ts` under `src/`, with `globalThis.crypto` guaranteed present (Web Crypto polyfill for Node test environment).

- [ ] **Step 1: Create `tsconfig.jest.json`**

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "lib": ["es2020", "dom"],
    "types": ["jest", "node"]
  },
  "include": ["src/**/*.ts"]
}
```

(The plugin's real build uses `"module": "es6"` via `tsconfig.base.json` — Jest needs CommonJS, so this file overrides only that, without touching the esbuild-facing configs.)

- [ ] **Step 2: Create `jest.setup.ts`**

```ts
import { webcrypto } from 'node:crypto';

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto;
}
```

- [ ] **Step 3: Create `jest.config.js`**

```js
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
};
```

- [ ] **Step 4: Add the test script**

In `package.json`, inside `"scripts"`, add:

```json
"test": "jest"
```

- [ ] **Step 5: Verify the runner works with a throwaway test**

Create a temporary file `src/services/__setup_check.test.ts`:

```ts
test('jest is wired up', () => {
  expect(1 + 1).toBe(2);
});
```

Run: `npm test`
Expected: 1 passed test, 0 failed.

Delete `src/services/__setup_check.test.ts` after confirming (it is not part of the plan's deliverables).

- [ ] **Step 6: Commit**

```bash
git add jest.config.js tsconfig.jest.json jest.setup.ts package.json
git commit -m "test: wire up jest for the figma-plugin package"
```

---

### Task 2: `hmac-signer.ts` — canonical string + HMAC signing

**Files:**
- Create: `src/services/hmac-signer.ts`
- Test: `src/services/hmac-signer.test.ts`

**Interfaces:**
- Produces:
  - `normalizeSignedPath(rawPath: string): string`
  - `buildCanonicalString(method: string, path: string, timestamp: string, nonce: string, rawBody: Uint8Array): Promise<string>`
  - `buildSignedHeaders(method: string, path: string, rawBody: Uint8Array, secret: string): Promise<{ 'x-timestamp': string; 'x-nonce': string; 'x-signature': string }>`
- Consumes: nothing from other tasks (this is the base module).

- [ ] **Step 1: Write the failing tests**

Create `src/services/hmac-signer.test.ts`:

```ts
import * as nodeCrypto from 'node:crypto';
import { normalizeSignedPath, buildCanonicalString, buildSignedHeaders } from './hmac-signer';

describe('normalizeSignedPath', () => {
  it('sorts query params so send order does not change the signature', () => {
    expect(normalizeSignedPath('/api/x?b=2&a=1')).toBe('/api/x?a=1&b=2');
    expect(normalizeSignedPath('/api/x?b=2&a=1')).toBe(normalizeSignedPath('/api/x?a=1&b=2'));
  });

  it('sorts stably even with a repeated key', () => {
    expect(normalizeSignedPath('/api/x?a=2&a=1')).toBe('/api/x?a=1&a=2');
  });

  it('strips trailing slashes, keeps root as-is', () => {
    expect(normalizeSignedPath('/api/campaigns/')).toBe('/api/campaigns');
    expect(normalizeSignedPath('/api/campaigns///')).toBe('/api/campaigns');
    expect(normalizeSignedPath('/')).toBe('/');
    expect(normalizeSignedPath('')).toBe('/');
  });

  it('does NOT decode percent-encoding', () => {
    expect(normalizeSignedPath('/api/x?q=a%20b')).toBe('/api/x?q=a%20b');
  });

  it('keeps a literal ? inside a query value', () => {
    expect(normalizeSignedPath('/api/x?u=a?b')).toBe('/api/x?u=a?b');
  });

  it('drops empty query pairs', () => {
    expect(normalizeSignedPath('/api/x?a=1&')).toBe('/api/x?a=1');
  });

  it('does not conflate two different paths', () => {
    expect(normalizeSignedPath('/api/campaigns')).not.toBe(normalizeSignedPath('/api/angles'));
  });
});

describe('buildCanonicalString', () => {
  it('joins METHOD/PATH/TS/NONCE/hash in order, 5 lines', async () => {
    const rawBody = new TextEncoder().encode('{"key":"value"}');
    const canonical = await buildCanonicalString(
      'post',
      '/api/posts/123/generate-design',
      '1753624000',
      'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      rawBody,
    );

    const lines = canonical.split('\n');
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe('POST'); // method always uppercased
    expect(lines[1]).toBe('/api/posts/123/generate-design');
    expect(lines[2]).toBe('1753624000');
    expect(lines[3]).toBe('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
    expect(lines[4]).toBe(
      nodeCrypto.createHash('sha256').update(Buffer.from('{"key":"value"}', 'utf8')).digest('hex'),
    );
  });

  it('hashes an empty body to the hash of an empty buffer', async () => {
    const canonical = await buildCanonicalString('GET', '/api/designs/pending', '1', 'n', new Uint8Array(0));
    expect(canonical.split('\n')[4]).toBe(
      nodeCrypto.createHash('sha256').update(Buffer.alloc(0)).digest('hex'),
    );
  });

  it('changing one byte of the body changes the hash', async () => {
    const a = await buildCanonicalString('POST', '/api/x', '1', 'n', new TextEncoder().encode('a'));
    const b = await buildCanonicalString('POST', '/api/x', '1', 'n', new TextEncoder().encode('b'));
    expect(a).not.toBe(b);
  });
});

describe('buildSignedHeaders', () => {
  const SECRET = 'test-secret-must-be-at-least-32-chars-long';

  it('signature matches an independently-computed Node HMAC (cross-check against what NestJS runs)', async () => {
    const method = 'POST';
    const path = '/api/posts/abc-123/generate-design';
    const bodyStr = '{"runId":"r-1"}';
    const rawBody = new TextEncoder().encode(bodyStr);

    const headers = await buildSignedHeaders(method, path, rawBody, SECRET);

    const expectedBodyHash = nodeCrypto
      .createHash('sha256')
      .update(Buffer.from(bodyStr, 'utf8'))
      .digest('hex');
    const expectedCanonical = [method, path, headers['x-timestamp'], headers['x-nonce'], expectedBodyHash].join('\n');
    const expectedSignature = nodeCrypto.createHmac('sha256', SECRET).update(expectedCanonical).digest('hex');

    expect(headers['x-signature']).toBe(expectedSignature);
  });

  it('timestamp is in seconds, nonce is a UUID v4', async () => {
    const headers = await buildSignedHeaders('GET', '/api/designs/pending', new Uint8Array(0), SECRET);

    expect(headers['x-nonce']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const ts = Number(headers['x-timestamp']);
    expect(Math.abs(ts - Math.floor(Date.now() / 1000))).toBeLessThanOrEqual(2);
  });

  it('a different secret produces a different signature for the same request', async () => {
    const h1 = await buildSignedHeaders('GET', '/api/designs/pending', new Uint8Array(0), 'secret-one-aaaaaaaaaaaaaaaaaaaaaaaa');
    const h2 = await buildSignedHeaders('GET', '/api/designs/pending', new Uint8Array(0), 'secret-two-bbbbbbbbbbbbbbbbbbbbbbbb');
    expect(h1['x-signature']).not.toBe(h2['x-signature']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- hmac-signer`
Expected: FAIL — `Cannot find module './hmac-signer'`.

- [ ] **Step 3: Write the implementation**

Create `src/services/hmac-signer.ts`:

```ts
/**
 * 1:1 port of normalizeSignedPath from
 * Marketing-Automation-OS/src/common/security/utils/canonical-path.util.ts.
 * This logic is part of what gets signed — one differing character means
 * every request gets a 401 signature_invalid. Do not "improve" it (no
 * URLSearchParams, no percent-decoding) — see Global Constraints in the plan.
 */
export function normalizeSignedPath(rawPath: string): string {
  const q = rawPath.indexOf('?');
  let pathname = q === -1 ? rawPath : rawPath.slice(0, q);
  const query = q === -1 ? '' : rawPath.slice(q + 1);

  while (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  if (pathname === '') pathname = '/';

  const pairs = query.split('&').filter(Boolean).sort();
  return pairs.length > 0 ? `${pathname}?${pairs.join('&')}` : pathname;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(digest);
}

export async function buildCanonicalString(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  rawBody: Uint8Array,
): Promise<string> {
  const bodyHash = await sha256Hex(rawBody);
  return [method.toUpperCase(), normalizeSignedPath(path), timestamp, nonce, bodyHash].join('\n');
}

async function hmacSha256Hex(canonicalString: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(canonicalString));
  return bufferToHex(signature);
}

export interface SignedHeaders {
  'x-timestamp': string;
  'x-nonce': string;
  'x-signature': string;
}

/**
 * `rawBody` must match what NestJS actually verifies, which is NOT always
 * the true request bytes:
 *   - JSON body           -> real UTF-8 bytes of the JSON string sent
 *   - GET / multipart POST -> empty (new Uint8Array(0))
 *
 * See "Global Constraints" in the plan for why multipart signs empty.
 */
export async function buildSignedHeaders(
  method: string,
  path: string,
  rawBody: Uint8Array,
  secret: string,
): Promise<SignedHeaders> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const canonicalString = await buildCanonicalString(method, path, timestamp, nonce, rawBody);
  const signature = await hmacSha256Hex(canonicalString, secret);
  return {
    'x-timestamp': timestamp,
    'x-nonce': nonce,
    'x-signature': signature,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- hmac-signer`
Expected: all tests in `hmac-signer.test.ts` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/hmac-signer.ts src/services/hmac-signer.test.ts
git commit -m "feat: port NestJS HMAC v3.2 signing to the figma plugin via Web Crypto"
```

---

### Task 3: Rewrite `api-client.ts` to sign instead of sending client-id/secret

**Files:**
- Modify: `src/services/api-client.ts`
- Test: `src/services/api-client.test.ts`

**Interfaces:**
- Consumes: `buildSignedHeaders` from `./hmac-signer` (Task 2).
- Produces:
  - `ApiClientConfig { baseUrl: string; hmacSecret: string }` (was `{ baseUrl, clientId, clientSecret }`)
  - `ApiClient.get<T>(path, options?)`, `.post<T>(path, body?, options?)`, `.postFormData<T>(path, formData, options?)` — **same method names and call signatures as before**, so `ui.tsx` call sites for `.get`/`.postFormData` don't need to change their argument shape, only the config field name (Task 5).
  - `ApiClient.hasValidCredentials()`, `.updateConfig()`, `.getConfig()` — unchanged signatures.
  - `ApiError` — unchanged.

- [ ] **Step 1: Write the failing tests**

Create `src/services/api-client.test.ts`:

```ts
import { ApiClient } from './api-client';

const SECRET = 'test-secret-must-be-at-least-32-chars-long';

function mockFetchOnce(status: number, jsonBody: any) {
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status',
    json: async () => jsonBody,
  });
}

describe('ApiClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects with NO_SECRET when hmacSecret is empty', async () => {
    const client = new ApiClient({ baseUrl: 'https://api.example.com', hmacSecret: '' });
    await expect(client.get('/designs/pending')).rejects.toMatchObject({ code: 'NO_SECRET' });
  });

  it('GET sends the 3 signed headers and no client-id/client-secret', async () => {
    mockFetchOnce(200, { data: [] });
    const client = new ApiClient({ baseUrl: 'https://api.example.com', hmacSecret: SECRET });

    await client.get('/designs/pending');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-timestamp']).toBeDefined();
    expect(headers['x-nonce']).toBeDefined();
    expect(headers['x-signature']).toMatch(/^[0-9a-f]{64}$/);
    expect(headers['x-client-id']).toBeUndefined();
    expect(headers['x-client-secret']).toBeUndefined();
  });

  it('POST JSON sends the right URL, Content-Type and body string', async () => {
    mockFetchOnce(200, { ok: true });
    const client = new ApiClient({ baseUrl: 'https://api.example.com', hmacSecret: SECRET });

    await client.post('/posts/abc/generate-design', { runId: 'r-1' });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.example.com/posts/abc/generate-design');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"runId":"r-1"}');
  });

  it('postFormData leaves Content-Type unset so fetch generates its own multipart boundary', async () => {
    mockFetchOnce(200, { ok: true });
    const client = new ApiClient({ baseUrl: 'https://api.example.com', hmacSecret: SECRET });
    const form = new FormData();
    form.append('file', new Blob(['x']), 'a.png');

    await client.postFormData('/designs/abc/render-result', form);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.body).toBe(form);
  });

  it('throws ApiError with the code from the response body on HTTP error', async () => {
    mockFetchOnce(401, { error_code: 'signature_invalid', message: 'bad sig' });
    const client = new ApiClient({ baseUrl: 'https://api.example.com', hmacSecret: SECRET });

    await expect(client.get('/designs/pending')).rejects.toMatchObject({
      status: 401,
      code: 'signature_invalid',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- api-client`
Expected: FAIL — `ApiClientConfig` still requires `clientId`/`clientSecret`, and headers still include `x-client-id`/`x-client-secret` (or TS compile error on the mismatched config shape).

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `src/services/api-client.ts`:

```ts
import { buildSignedHeaders } from './hmac-signer';

export interface ApiClientConfig {
  baseUrl: string;
  hmacSecret: string;
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
      hmacSecret: config.hmacSecret || '',
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
    return Boolean(this.config.baseUrl && this.config.hmacSecret.trim().length > 0);
  }

  private async request<T>(
    endpointPath: string,
    method: string,
    rawBody: Uint8Array,
    fetchBody: BodyInit | undefined,
    contentType: string | undefined,
    options?: RequestOptions,
  ): Promise<T> {
    if (!this.hasValidCredentials()) {
      throw new ApiError(
        0,
        'NO_SECRET',
        'Authentication not configured. Please enter your HMAC Secret in Settings.'
      );
    }

    const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    const url = `${this.config.baseUrl}${cleanPath}`;
    const timeoutMs = options?.timeoutMs || 15000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const signed = await buildSignedHeaders(method, cleanPath, rawBody, this.config.hmacSecret);
      const headers: Record<string, string> = {
        'x-timestamp': signed['x-timestamp'],
        'x-nonce': signed['x-nonce'],
        'x-signature': signed['x-signature'],
        'ngrok-skip-browser-warning': 'true',
        ...options?.headers,
      };
      if (contentType && !headers['Content-Type']) {
        headers['Content-Type'] = contentType;
      }

      const reqInit: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };
      if (fetchBody !== undefined) {
        reqInit.body = fetchBody;
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
        return await this.request<T>(path, 'GET', new Uint8Array(0), undefined, undefined, options);
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
    const json = body !== undefined ? JSON.stringify(body) : undefined;
    const rawBody = json !== undefined ? new TextEncoder().encode(json) : new Uint8Array(0);
    return this.request<T>(path, 'POST', rawBody, json, 'application/json', options);
  }

  /**
   * NestJS's `rawBody: true` (main.ts) only wraps the json/urlencoded/text
   * parsers, not multipart (Multer reads that separately via
   * FileInterceptor/AnyFilesInterceptor) — so for multipart Content-Type the
   * server always verifies against an EMPTY body hash. We sign empty here to
   * match, and keep sending the real `FormData` unchanged so `fetch` still
   * generates the correct multipart boundary itself. See Global Constraints
   * in the plan for the exact trace through NestJS's guard code.
   */
  public async postFormData<T>(path: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return this.request<T>(
      path,
      'POST',
      new Uint8Array(0),
      formData,
      undefined,
      { timeoutMs: 60000, ...options },
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- api-client`
Expected: all tests in `api-client.test.ts` PASS.

- [ ] **Step 5: Run the full suite to confirm nothing else broke**

Run: `npm test`
Expected: all tests across `hmac-signer.test.ts` and `api-client.test.ts` PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/api-client.ts src/services/api-client.test.ts
git commit -m "feat: sign api-client requests with HMAC instead of client-id/client-secret"
```

---

### Task 4: Rename `clientSecret` → `hmacSecret` in `types.ts` and `code.ts`

**Files:**
- Modify: `src/types.ts:174-177`
- Modify: `src/code.ts:95-123`

**Interfaces:**
- Consumes: nothing new.
- Produces: `AuthConfig { backendUrl: string; hmacSecret: string }`, used by Task 5 (`ui.tsx`) and already used by `code.ts`'s own message handlers.

This task has no independent unit test — `code.ts` runs inside the Figma plugin sandbox (`tsconfig.sandbox.json`, no DOM/fetch), and `figma.clientStorage` is a Figma-provided global not available under Jest. Correctness here is checked by Task 6's manual verification. Both files still need `tsc --noEmit` to type-check cleanly, which Step 3 below verifies.

- [ ] **Step 1: Rename the interface field in `types.ts`**

In `src/types.ts`, change:

```ts
export interface AuthConfig {
  backendUrl: string;
  clientSecret: string;
}
```

to:

```ts
export interface AuthConfig {
  backendUrl: string;
  hmacSecret: string;
}
```

- [ ] **Step 2: Update `code.ts`'s `get-config` and `save-config` handlers**

In `src/code.ts`, the `get-config` handler currently reads:

```ts
  if (msg.type === 'get-config') {
    try {
      const savedUrl = await figma.clientStorage.getAsync('FIGMA_M2M_BACKEND_URL');
      const savedSecret = await figma.clientStorage.getAsync('FIGMA_M2M_CLIENT_SECRET');
      sendToUi({
        type: 'config-loaded',
        config: {
          backendUrl: savedUrl || 'http://localhost:3000/api',
          clientSecret: savedSecret || '',
        }
      });
    } catch (e) {
      sendToUi({
        type: 'config-loaded',
        config: { backendUrl: 'http://localhost:3000/api', clientSecret: '' }
      });
    }
  }

  if (msg.type === 'save-config') {
    try {
      const { config } = msg;
      await figma.clientStorage.setAsync('FIGMA_M2M_BACKEND_URL', config.backendUrl || 'http://localhost:3000/api');
      await figma.clientStorage.setAsync('FIGMA_M2M_CLIENT_SECRET', config.clientSecret || '');
      sendToUi({ type: 'log', message: '✅ Settings saved to Figma clientStorage.', status: 'success' });
      sendToUi({ type: 'config-loaded', config });
    } catch (e) {
      sendToUi({ type: 'log', message: `Failed to save settings: ${(e as Error).message}`, status: 'error' });
    }
  }
```

Replace with:

```ts
  if (msg.type === 'get-config') {
    try {
      const savedUrl = await figma.clientStorage.getAsync('FIGMA_M2M_BACKEND_URL');
      const savedSecret = await figma.clientStorage.getAsync('FIGMA_M2M_HMAC_SECRET');
      sendToUi({
        type: 'config-loaded',
        config: {
          backendUrl: savedUrl || 'http://localhost:3000/api',
          hmacSecret: savedSecret || '',
        }
      });
    } catch (e) {
      sendToUi({
        type: 'config-loaded',
        config: { backendUrl: 'http://localhost:3000/api', hmacSecret: '' }
      });
    }
  }

  if (msg.type === 'save-config') {
    try {
      const { config } = msg;
      await figma.clientStorage.setAsync('FIGMA_M2M_BACKEND_URL', config.backendUrl || 'http://localhost:3000/api');
      await figma.clientStorage.setAsync('FIGMA_M2M_HMAC_SECRET', config.hmacSecret || '');
      sendToUi({ type: 'log', message: '✅ Settings saved to Figma clientStorage.', status: 'success' });
      sendToUi({ type: 'config-loaded', config });
    } catch (e) {
      sendToUi({ type: 'log', message: `Failed to save settings: ${(e as Error).message}`, status: 'error' });
    }
  }
```

Note the `clientStorage` key itself changes from `FIGMA_M2M_CLIENT_SECRET` to `FIGMA_M2M_HMAC_SECRET` — anyone who already saved a client-secret will see an empty field on next load and need to paste the new HMAC secret. That's expected: the old value is a client-secret, not an HMAC key, and is not usable under the new scheme regardless.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.sandbox.json`
Expected: no errors.

(`tsconfig.json`'s `include: ["src/**/*"]` also picks up `ui.tsx`, which won't type-check cleanly until Task 5 lands — that's expected here, don't chase it in this task. Checking `tsconfig.sandbox.json` in isolation confirms `code.ts` alone is correct.)

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/code.ts
git commit -m "refactor: rename AuthConfig.clientSecret to hmacSecret, update clientStorage key"
```

---

### Task 5: Update `ui.tsx` — rename wiring, fix the two stale paths, update Settings label

**Files:**
- Modify: `src/ui.tsx` (multiple locations, listed below)

**Interfaces:**
- Consumes: `ApiClientConfig { baseUrl, hmacSecret }` (Task 3), `AuthConfig { backendUrl, hmacSecret }` (Task 4).
- Produces: nothing consumed by later tasks — this is the last code change.

No unit test here: `ui.tsx` is a React component driven by Figma's `postMessage` bridge and real network calls, not practically unit-testable in isolation without a much larger test harness than this plan's scope justifies. Task 6 covers it end-to-end.

- [ ] **Step 1: Rename the state variable (line 39)**

Change:
```ts
  const [clientSecret, setClientSecret] = React.useState('');
```
to:
```ts
  const [hmacSecret, setHmacSecret] = React.useState('');
```

- [ ] **Step 2: Fix the `ApiClient` construction (line 51)**

Change:
```ts
  const apiClientRef = React.useRef(new ApiClient({ baseUrl: backendUrl, clientId: 'figma-plugin', clientSecret }));
```
to:
```ts
  const apiClientRef = React.useRef(new ApiClient({ baseUrl: backendUrl, hmacSecret }));
```

- [ ] **Step 3: Fix the `config-loaded` handler (lines 96, 98-101, 103-104)**

Change:
```ts
        setBackendUrl(config.backendUrl || 'https://unrepined-min-unexultantly.ngrok-free.dev/api');
        setClientSecret(config.clientSecret || '');

        apiClientRef.current.updateConfig({
          baseUrl: config.backendUrl || 'https://unrepined-min-unexultantly.ngrok-free.dev/api',
          clientSecret: config.clientSecret || '',
        });

        if (!config.clientSecret || config.clientSecret.trim().length === 0) {
          addLog('[Auth Warning] Authentication not configured. Please enter Client Secret in Settings.', 'warning');
        } else {
```
to:
```ts
        setBackendUrl(config.backendUrl || 'https://unrepined-min-unexultantly.ngrok-free.dev/api');
        setHmacSecret(config.hmacSecret || '');

        apiClientRef.current.updateConfig({
          baseUrl: config.backendUrl || 'https://unrepined-min-unexultantly.ngrok-free.dev/api',
          hmacSecret: config.hmacSecret || '',
        });

        if (!config.hmacSecret || config.hmacSecret.trim().length === 0) {
          addLog('[Auth Warning] Authentication not configured. Please enter HMAC Secret in Settings.', 'warning');
        } else {
```

- [ ] **Step 4: Fix the polling-paused warning (line 335)**

Change:
```ts
          addLog('[Auth Warning] Polling paused. Please configure Client Secret in Settings.', 'warning');
```
to:
```ts
          addLog('[Auth Warning] Polling paused. Please configure HMAC Secret in Settings.', 'warning');
```

- [ ] **Step 5: Fix `handleScan` and `handleSync` warnings (lines 357, 368)**

In both `handleScan` and `handleSync`, change:
```ts
      addLog('[Auth Warning] Authentication not configured. Please enter Client Secret in Settings.', 'warning');
```
to:
```ts
      addLog('[Auth Warning] Authentication not configured. Please enter HMAC Secret in Settings.', 'warning');
```
(two occurrences, one per function)

- [ ] **Step 6: Fix `handleSaveSettings` (lines 388-395)**

Change:
```ts
  const handleSaveSettings = () => {
    apiClientRef.current.updateConfig({
      baseUrl: backendUrl,
      clientSecret: clientSecret,
    });
    sendToSandbox({
      type: 'save-config',
      config: { backendUrl, clientSecret }
    });
  };
```
to:
```ts
  const handleSaveSettings = () => {
    apiClientRef.current.updateConfig({
      baseUrl: backendUrl,
      hmacSecret: hmacSecret,
    });
    sendToSandbox({
      type: 'save-config',
      config: { backendUrl, hmacSecret }
    });
  };
```

- [ ] **Step 7: Fix the header warning badge (line 405)**

Change:
```ts
        {!clientSecret && (
```
to:
```ts
        {!hmacSecret && (
```

- [ ] **Step 8: Fix the Settings tab input (lines 490, 494-497, 502, 504)**

Change:
```ts
            <label style={styles.label}>Client Secret (x-client-secret)</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                style={{ ...styles.input, flex: 1 }}
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={e => setClientSecret(e.target.value)}
                placeholder="Paste sk_figma_secret_key here..."
```
to:
```ts
            <label style={styles.label}>HMAC Secret (shared with n8n's HMAC_N8N_TO_NEST_CURRENT)</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                style={{ ...styles.input, flex: 1 }}
                type={showSecret ? 'text' : 'password'}
                value={hmacSecret}
                onChange={e => setHmacSecret(e.target.value)}
                placeholder="Paste the value of secrets/hmac_n8n_to_nest_current here..."
```

(the `showSecret`/`setShowSecret` state and the `Show`/`Hide` toggle button stay unchanged — they only control the input's `type`, not the field name)

- [ ] **Step 9: Fix the two stale `/content/posts/...` paths**

At line 132, change:
```ts
          const jsonRes = await apiClientRef.current.get<{ data: any[] }>(`/content/posts/${activePostId}/designs`);
```
to:
```ts
          const jsonRes = await apiClientRef.current.get<{ data: any[] }>(`/posts/${activePostId}/designs`);
```

At line 203, change:
```ts
          const jsonRes = await apiClientRef.current.postFormData<{ results: any[] }>(`/content/posts/${postId}/sync-canvas`, form, {
            headers: { 'X-Transaction-ID': txId }
          });
```
to:
```ts
          const jsonRes = await apiClientRef.current.postFormData<{ results: any[] }>(`/posts/${postId}/sync-canvas`, form, {
            headers: { 'X-Transaction-ID': txId }
          });
```

- [ ] **Step 10: Type-check and build**

Run: `npx tsc --noEmit -p tsconfig.ui.json`
Expected: no errors.

Run: `npm run build`
Expected: `Build completed successfully.` printed, `dist/code.js` and `dist/ui.html` regenerated.

- [ ] **Step 11: Commit**

```bash
git add src/ui.tsx
git commit -m "fix: sign requests with shared HMAC secret, fix stale /content/posts paths"
```

---

### Task 6: Manual end-to-end verification against the real stack

This cannot be automated — it needs a running NestJS backend with a real `secrets/hmac_n8n_to_nest_current` value, and the actual Figma desktop app. This task is the acceptance gate for the whole plan.

**Files:** none (verification only).

- [ ] **Step 1: Get the real secret value**

On the server (or wherever `Marketing-Automation-OS/secrets/` lives):

```bash
cat secrets/hmac_n8n_to_nest_current
```

Copy the value — this is what goes into the plugin's Settings, not a new value you invent.

- [ ] **Step 2: Load the built plugin in Figma**

In Figma desktop: `Plugins` → `Development` → `Import plugin from manifest...` → select `D:\figma-plugin\manifest.json` (build from Task 5, Step 10 must be current). Open the plugin.

- [ ] **Step 3: Configure Settings**

In the plugin's Settings tab: set Backend URL to the real NestJS base URL (e.g. `https://<your-ngrok-or-real-domain>/api`), paste the secret from Step 1 into the HMAC Secret field, click Save. Confirm the log shows `✅ Settings saved to Figma clientStorage.` and the "⚠️ Auth Unconfigured" badge in the header disappears.

- [ ] **Step 4: Verify `GET /designs/pending`**

Switch to the Renderer tab (or wherever polling starts) and confirm no `401` appears in the plugin's log panel. A `200` with an empty or populated `data` array is correct either way — the point is no auth error.

- [ ] **Step 5: Verify `POST /designs/{id}/render-result`**

Trigger a render job end-to-end (via the normal NestJS → design-queue flow that creates a pending design asset), let the plugin pick it up and upload the rendered PNG. Confirm the log shows `✅ Successfully uploaded design {assetId}`, not an `ApiError`.

- [ ] **Step 6: Verify `GET /posts/{postId}/designs`**

In the Sync tab, enter a real `postId`, click Scan. Confirm the diff step completes without a `404` (this endpoint was one of the two broken paths — a lingering `404 Cannot GET /content/posts/...` here means Task 5 Step 9 didn't take effect, likely a stale build; re-run `npm run build` and reload the plugin).

- [ ] **Step 7: Verify `POST /posts/{postId}/sync-canvas`**

With at least one changed frame, click Sync. Confirm the log shows `✅ Sync completed successfully!` and no `404` or `401`.

- [ ] **Step 8: Cross-check against `SecurityAuditLog`**

On the server, confirm these four calls actually reached and passed `UnifiedAuthGuard` (reuses the same verification pattern used earlier for the n8n HMAC fixes):

```bash
docker compose exec postgres psql -U app_owner -d appdb -c "
SELECT \"path\", \"authResult\", \"reason\", count(*), max(\"createdAt\")
FROM marketing_domain.\"SecurityAuditLog\"
WHERE \"createdAt\" > now() - interval '30 minutes'
GROUP BY 1,2,3 ORDER BY 5 DESC;
"
```

Expected: rows for `/designs/pending`, `/designs/{id}/render-result`, `/posts/{id}/designs`, `/posts/{id}/sync-canvas` all show `authResult = ok`. Any `signature_invalid` row here means Task 2's canonical string doesn't match the server's — stop and re-check the Global Constraints section before touching anything else.

- [ ] **Step 9: Record the result**

If all four endpoints pass, the plan is done — no commit needed for this task (verification only). If something fails, do not patch it ad hoc: reopen the relevant task (2 or 3), add a regression test that reproduces the failure, then fix.
