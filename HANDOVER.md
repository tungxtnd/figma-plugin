# Bàn giao Figma plugin (Design Engine)

*Viết ngày 14-10-2026, khi Tùng bàn giao cho Khang (owner) và Nguyên (hỗ trợ designer).*
*Plugin: nhánh `main` (`dfb3d0f`, bản đang chạy thật). Backend: đối chiếu với `main` của
Marketing-Automation-OS tại `1c2d8e6` (14-10-2026).*

Plugin chạy trong **Figma Desktop** trên máy designer, làm hai việc cho Marketing Automation OS (MA):

1. **Auto Renderer:** lấy slide đang chờ vẽ từ backend MA, vẽ thành frame trên canvas, export PNG
   rồi gửi về backend.
2. **Manual Sync:** designer sửa tay trên Figma, sau đó Scan → Sync để đẩy thay đổi về backend.
   Backend lưu ảnh lên Cloudinary.

Không có plugin thì slide Facebook không được vẽ, và bài dừng ở bước Thiết kế (Hộp việc báo "Figma
chưa render").

## 1. Code nằm ở đâu, trạng thái

| | |
|---|---|
| Repo | `github.com/tungxtnd/figma-plugin` (**tài khoản cá nhân Tùng → cần chuyển sang tài khoản công ty**) |
| Nhánh dùng | **`main`**: bản đang chạy thật, đã gồm phía plugin của **Figma sync ↔ Cloudinary** (plans V2.2/09 bên MA: `src/services/canvas-diff.ts`, `src/services/select-post-frames.ts` và test) |
| ⚠️ Lệch backend | Plugin gọi `POST /designs/:id/render-failed`, nhưng backend MA trên `main` **chưa có route này** (nó nằm ở nhánh `feat/linkedin-education-content` chưa merge). Khi render lỗi, plugin nhận 404. Cần chọn: đưa route vào backend, hoặc bỏ lời gọi ở plugin |
| Nhánh khác | `figma-plugin-cleanup-deadcode` đã nằm trọn trong `main`. `figma-plugin-shared-hmac-auth` là hướng HMAC cũ, đã bỏ. Cả hai **không dùng nữa**, xoá được |

## 2. Công nghệ và cấu trúc

TypeScript, React 18 (UI), esbuild, Jest. Figma tách plugin thành 2 phần nói chuyện với nhau qua
`postMessage`:

```
src/ui.tsx  (iframe: React UI, gọi HTTP tới backend, MD5 fingerprint, tải ảnh)
   ⇅ postMessage
src/code.ts (sandbox: đọc/ghi canvas Figma, vẽ, export PNG, lưu pluginData)
```

| Thư mục / file | Việc |
|---|---|
| `src/code.ts` | Nhận message: `process-job` (vẽ 1 slide), `scan-canvas`, `export-frames`, `commit-metadata`, `get-config`/`save-config` |
| `src/ui.tsx` | 3 tab: **Manual Sync**, **Auto Renderer** (poll 3 giây/lần), **Settings** |
| `src/services/api-client.ts` | Gọi backend, gắn header `x-plugin-token`; GET tự thử lại khi 429 hoặc lỗi mạng |
| `src/services/canvas-diff.ts` | So canvas với server ra CREATE / UPDATE / REORDER / DELETE |
| `src/services/select-post-frames.ts` | Chỉ lấy frame thuộc bài; frame mới phải được **chọn** lúc Scan |
| `src/core/pipeline.ts` | Bộ vẽ v1.0: `designIntent` → layout → component → chấm điểm chất lượng |
| `src/layouts/{center,split,grid,timeline}/` | Các layout slide. Thêm layout mới thì khai trong `registry.ts` của nhóm đó |
| `src/components/` | Tiêu đề, thân bài, ảnh, khung (chrome) |
| `src/engines/` | `theme-engine` (dark/light → bộ màu), `adaptive-engine` (co chữ), `variant-engine` (tránh lặp layout giữa các slide liền nhau), `quality-engine` (chấm điểm) |
| `src/tokens.ts` | **Màu, cỡ chữ, khoảng cách: nguồn duy nhất.** Font cứng là `Inter` (trong `components/`) |
| `src/legacy/legacy-renderer.ts` | Bộ vẽ cũ v0, chỉ dùng khi payload không có `designIntent` |
| `src/constraint-engine.ts` | Kiểm giới hạn cứng trước khi vẽ |

Màu, font và cỡ chữ slide đang nằm cứng ở đây chứ không lấy từ backend. Đây là nợ đã ghi ở
`docs/no-ky-thuat.md` bên MA.

## 3. Build, test, cài

```bash
npm install
npm run build        # → dist/code.js + dist/ui.html  (npm run watch khi dev)
npx jest             # test trong test/*.spec.ts (package.json chưa có script "test")
```

**Cài cho designer:**
1. Mở Figma Desktop → Plugins → Development → **Import plugin from manifest…**
2. Chọn `manifest.json` ở gốc repo, sau khi đã `npm run build`.

`plugin/` + `plugin.zip` là bản đóng gói gửi designer, build ngày **26-08**, **đã cũ**. Nếu vẫn gửi
designer theo cách này thì build lại, rồi copy `dist/` và `manifest.json` vào `plugin/`.

**Domain:** Figma chỉ cho plugin gọi domain có trong `networkAccess` của manifest.
- `manifest.json` ở gốc có domain production `automation.ipactechnology.com`.
- `plugin/manifest.json` có domain staging `staging.ipactechnology.com`.
- Đổi domain backend thì **phải sửa manifest rồi cài lại plugin**.
- Danh sách còn sót domain thừa (ngrok, Pexels, Pixabay, Unsplash, LoremFlickr): dọn được, vì MA đã
  bỏ tìm ảnh từ 13-10.

## 4. Cấu hình và token

Trong plugin → tab **Settings**:
- **Backend URL**, ví dụ `https://<domain>/api`. Mặc định là `http://localhost:3000/api`.
- **Plugin Token.**

Cả hai lưu trong `figma.clientStorage` trên máy designer, với key `FIGMA_M2M_BACKEND_URL` và
`FIGMA_M2M_CLIENT_SECRET` (tên key cũ, giá trị bên trong là plugin token).

**Cấp token** (làm trên VPS MA):
```bash
cd /opt/marketing-os
openssl rand -base64 32 > secrets/plugin-tokens/<ten-nguoi>_current
chmod 600 secrets/plugin-tokens/<ten-nguoi>_current && chown 1000:1000 secrets/plugin-tokens/<ten-nguoi>_current
docker compose restart api        # token chỉ được nạp lúc khởi động
```
Gửi chuỗi token cho designer qua kênh an toàn. **Thu hồi:** xoá file rồi `docker compose restart api`.
Khi Tùng rời đi thì thu hồi token của Tùng.

## 5. Plugin gọi backend những gì

Mọi route có header `x-plugin-token`; backend kiểm bằng `FigmaPluginGuard` (MA `docs/04` mục 6).
Backend `main` mở đúng 5 route cho plugin, được chốt trong
`src/modules/design/controllers/figma-plugin-routes.spec.ts`.

| Route | Backend `main` | Plugin gọi khi nào |
|---|---|---|
| `GET /designs/pending` | ✅ | Auto Renderer poll 3 giây/lần. Envelope bị bọc 2 lớp, nên mảng nằm ở `data.data` (plugin tự nhận cả 2 dạng) |
| `POST /designs/:id/render-result` | ✅ | Gửi PNG + kết quả chấm điểm sau khi vẽ xong |
| `GET /posts/:id/designs` | ✅ | Manual Sync: lấy danh sách slide server đang giữ để so |
| `POST /posts/:id/sync-canvas` | ✅ | Manual Sync: gửi ảnh các frame đổi (multipart, timeout 180 giây) |
| `POST /designs/:id/callback` | ✅ | Plugin hiện **không gọi** |
| `POST /designs/:id/render-failed` | ⛔ chưa có | Báo vẽ lỗi. Hiện nhận 404 |

Ảnh nền, logo, ảnh nội dung được tải thẳng từ Cloudinary hoặc Drive (không gắn token).

**Mỗi frame mang `pluginData` `figma_reconciliation_metadata`** = `{postId, assetId, version,
fingerprint}`. Nhờ dữ liệu này plugin biết frame nào thuộc slide nào. Xoá hoặc copy frame sang file
khác thì metadata vẫn đi theo. Lệch `version` so với server thì sync trả **409**: Scan lại để
plugin tự sửa metadata.

## 6. Designer dùng hằng ngày

1. Mở file Figma của slide → chạy plugin → tab **Auto Renderer**, để mở. Slide chờ vẽ sẽ tự hiện
   lên canvas.
2. Sửa tay frame nếu cần → tab **Manual Sync** → **Scan**. Frame mới thì phải chọn trước khi Scan.
   Xem danh sách thay đổi rồi bấm **Sync**.
3. Người duyệt duyệt slide trên web MA (bước Thiết kế).

## 7. Lỗi hay gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| Log "Polling paused… configure Plugin Token" | Chưa nhập token ở Settings |
| 401 khi poll | Token sai, đã thu hồi, hoặc backend chưa restart sau khi cấp token |
| Lỗi mạng / bị chặn domain | Domain backend không có trong `networkAccess` của manifest đang cài |
| Hộp việc MA báo "Figma chưa render" sau 15 phút | Designer chưa mở plugin ở tab Auto Renderer, hoặc lỗi token |
| Sync báo 409 | Metadata frame lệch version: Scan lại |
| Frame mới không được sync | Chưa chọn frame lúc Scan |
| Thiếu font khi vẽ | Máy designer chưa có font `Inter` |
