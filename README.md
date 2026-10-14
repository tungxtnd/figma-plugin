# Figma Design Engine Plugin (MVP)

> Figma Plugin đóng vai trò là **Design Engine** cho hệ sinh thái **Marketing Automation OS (MA)**.
> Plugin tự động hóa việc render slide truyền thông trực tiếp trên Figma canvas và hỗ trợ đồng bộ thủ công 2 chiều (Figma ↔ Backend & Cloudinary).

---

## 📌 Mục lục

- [Giới thiệu](#-giới-thiệu)
- [Tính năng chính](#-tính-năng-chính)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
  - [Cơ chế 2 tầng của Figma Plugin](#cơ-chế-2-tầng-của-figma-plugin)
  - [Pipeline tự động vẽ (Auto Renderer)](#pipeline-tự-động-vẽ-auto-renderer)
  - [Cơ chế đồng bộ canvas (Manual Sync & Reconciliation)](#cơ-chế-đồng-bộ-canvas-manual-sync--reconciliation)
- [Cấu trúc mã nguồn](#-cấu-trúc-mã-nguồn)
- [Yêu cầu môi trường](#-yêu-cầu-môi-trường)
- [Cài đặt & Phát triển](#-cài-đặt--phát-triển)
- [Cài đặt Plugin vào Figma Desktop](#-cài-đặt-plugin-vào-figma-desktop)
- [Cấu hình & Token xác thực](#-cấu-hình--token-xác-thực)
- [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)
  - [1. Chế độ vẽ tự động (Auto Renderer)](#1-chế-độ-vẽ-tự-động-auto-renderer)
  - [2. Chế độ đồng bộ chỉnh sửa (Manual Sync)](#2-chế-độ-đồng-bộ-chỉnh-sửa-manual-sync)
- [API & Giao tiếp Backend](#-api--giao-tiếp-backend)
- [Kiểm thử (Testing)](#-kiểm-thử-testing)
- [Khắc phục sự cố (Troubleshooting)](#-khắc-phục-sự-cố-troubleshooting)
- [Đóng góp & Giấy phép](#-đóng-góp--giấy-phép)

---

## 📖 Giới thiệu

Trong kiến trúc của **Marketing Automation OS**, bài viết mạng xã hội (đặc biệt là bài định dạng Carousel / Slide Facebook & LinkedIn) cần được tạo thành hình ảnh chất lượng cao. Thay vì dùng renderer headless tĩnh bên ngoài, hệ thống tích hợp trực tiếp **Figma Desktop** của designer làm engine dựng hình nhằm:
1. Cho phép render tự động dựa trên các nguyên tắc thiết kế chuyên nghiệp (Design Tokens, Adaptive Typography, Visual Balance).
2. Cho phép designer có thể trực tiếp can thiệp, chỉnh sửa bố cục/chữ/ảnh ngay trên Figma canvas và đồng bộ ngược về hệ thống dễ dàng.

---

## ✨ Tính năng chính

- **🤖 Auto Renderer (Vẽ tự động theo hàng đợi):**
  - Định kỳ (polling 3s/lần) lấy các tác vụ thiết kế đang chờ (`pending designs`) từ backend.
  - Tự động dựng frame, tính toán phân bổ bố cục (Center, Split, Grid, Timeline), căn chỉnh tỷ lệ cỡ chữ (Adaptive Engine) và áp dụng bảng màu (Theme Engine).
  - Chấm điểm chất lượng thẩm mỹ (Quality Engine) và tự động export PNG chất lượng cao gửi về backend.

- **🔄 Manual Sync & Canvas Reconciliation (Đồng bộ thủ công 2 chiều):**
  - Quét (Scan) canvas để đối chiếu các frame với cơ sở dữ liệu server qua metadata ẩn `figma_reconciliation_metadata` gắn trên mỗi frame.
  - Tự động phát hiện 4 loại biến đổi: `CREATE` (tạo frame mới), `UPDATE` (nội dung/ảnh thay đổi dựa trên MD5 fingerprint), `REORDER` (đổi thứ tự slide), `DELETE` (xoá slide).
  - Xuất ảnh PNG và đóng gói multipart gửi lên Cloudinary thông qua backend server.

- **🛡️ Bảo mật xác thực qua Token (FigmaPluginGuard):**
  - Xác thực qua header `x-plugin-token`.
  - Token được mã hóa an toàn và lưu cục bộ trên máy designer thông qua `figma.clientStorage`.

---

## 🏗️ Kiến trúc hệ thống

### Cơ chế 2 tầng của Figma Plugin

Tuân thủ kiến trúc sandbox của Figma, plugin được chia làm 2 môi trường biệt lập giao tiếp với nhau qua `postMessage`:

```
┌──────────────────────────────────────────────┐
│  src/ui.tsx (UI Iframe - React 18)           │
│  - Giao diện người dùng (Tab Sync / Auto)    │
│  - Thực hiện HTTP Request tới Backend API    │
│  - Tính toán MD5 Fingerprint                 │
│  - Tải tài nguyên ảnh (Cloudinary, Drive...) │
└──────────────────────┬───────────────────────┘
                       │ postMessage
                       ▼
┌──────────────────────────────────────────────┐
│  src/code.ts (Figma Sandbox - Web Worker)    │
│  - Truy cập & thao tác trực tiếp với Canvas  │
│  - Dựng Node, Text, Shape, AutoLayout        │
│  - Export PNG buffer từ Node                 │
│  - Đọc / ghi metadata (getPluginData)        │
└──────────────────────────────────────────────┘
```

### Pipeline tự động vẽ (Auto Renderer)

```
Pending Job Payload
       │
       ▼
[ Grammar Parser & Intent Validation ]  (Kiểm tra tính hợp lệ & giới hạn)
       │
       ▼
[ Layout Registry Selection ]           (Chọn layout: Center / Split / Grid / Timeline)
       │
       ▼
[ Component Assembly ]                  (Dựng Chrome, Header, Body, Media, Badge)
       │
       ▼
[ Engine Processing ]
   ├── Adaptive Engine                  (Co giãn cỡ chữ theo độ dài văn bản)
   ├── Theme Engine                     (Áp dụng Dark/Light palette & Tokens)
   └── Quality Engine                   (Chấm điểm mật độ, độ tương phản)
       │
       ▼
[ Export PNG & Upload Callback ]        (Gửi ảnh về backend)
```

### Cơ chế đồng bộ canvas (Manual Sync & Reconciliation)

Mỗi frame trên canvas được gán một chuỗi metadata JSON qua `figma.setPluginData`:
```json
{
  "postId": "string",
  "assetId": "string",
  "version": 1,
  "fingerprint": "md5-hash-of-content"
}
```
Khi designer bấm **Scan**:
1. Service `select-post-frames.ts` lọc ra các frame thuộc bài viết tương ứng.
2. Service `canvas-diff.ts` tính toán so sánh trạng thái canvas hiện tại với danh sách từ server:
   - Frame chưa có `assetId` và đang được chọn trên canvas ➔ `CREATE`.
   - Frame có `fingerprint` khác với server ➔ `UPDATE`.
   - Vị trí thứ tự x/y trên canvas thay đổi ➔ `REORDER`.
   - Frame có trên server nhưng không còn trên canvas ➔ `DELETE`.
3. Khi bấm **Sync**: Client gửi multipart form lên `POST /posts/:id/sync-canvas` với timeout 180s. Tránh ghi đè trùng bằng kiểm tra `version` (báo `409 Conflict` nếu server đã có cập nhật mới hơn).

---

## 📁 Cấu trúc mã nguồn

```
figma-plugin/
├── dist/                          # Output sau khi build (code.js, ui.html)
├── docs/                          # Tài liệu kỹ thuật, kế hoạch thiết kế
├── src/
│   ├── code.ts                    # Entry point của Figma sandbox
│   ├── ui.tsx                     # Entry point của giao diện React (iframe)
│   ├── types.ts                   # Định nghĩa kiểu dữ liệu toàn bộ plugin
│   ├── tokens.ts                  # Design Tokens chuẩn: Màu sắc, Khoảng cách, Font size
│   ├── constraint-engine.ts       # Ràng buộc cứng về số lượng từ, độ dài ký tự
│   ├── components/                # Các thành phần giao diện trên canvas (Header, Body, Chrome...)
│   ├── core/
│   │   ├── pipeline.ts            # Pipeline điều phối quá trình render slide
│   │   └── context.ts             # Context quản lý trạng thái render
│   ├── engines/
│   │   ├── adaptive-engine.ts     # Tự động co giãn cỡ chữ phù hợp với khung
│   │   ├── theme-engine.ts        # Quản lý phối màu Dark/Light theme
│   │   └── quality-engine.ts      # Chấm điểm chất lượng slide sau khi vẽ
│   ├── layouts/                   # Các bố cục hỗ trợ
│   │   ├── center/                # Cover, Minimal, Centered layouts
│   │   ├── split/                 # Chia đôi chữ/ảnh
│   │   ├── grid/                  # Lưới 2 cột, 3 cột
│   │   └── timeline/              # Tiến trình, lộ trình
│   └── services/
│       ├── api-client.ts          # Client gọi API backend với retry & token auth
│       ├── canvas-diff.ts         # Tính toán chênh lệch canvas vs server
│       └── select-post-frames.ts  # Nhận diện frame bài viết trên canvas
├── test/                          # Unit tests (Jest + ts-jest)
├── esbuild.js                     # Script đóng gói code & nhúng HTML
├── manifest.json                  # Cấu hình plugin cho Figma (Permissions, Domains)
├── package.json                   # Dependencies & npm scripts
├── tsconfig.json                  # Cấu hình TypeScript
└── HANDOVER.md                    # Tài liệu bàn giao nội bộ
```

---

## 💻 Yêu cầu môi trường

- **Node.js**: Phiên bản 18 LTS trở lên
- **Trình quản lý gói**: `npm` hoặc `pnpm`
- **Figma Desktop**: Ứng dụng Figma Desktop trên macOS hoặc Windows
- **Font hệ thống**: Cần cài đặt font chữ **`Inter`** trên máy tính (Figma sandbox yêu cầu font có sẵn trên máy để load và tính toán text box)

---

## 🚀 Cài đặt & Phát triển

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Build plugin

Đóng gói mã nguồn thành `dist/code.js` và `dist/ui.html`:

```bash
npm run build
```

### 3. Chế độ Watch (Dev)

Khi đang phát triển giao diện hoặc logic, chạy watch để tự động build lại mỗi khi lưu file:

```bash
npm run watch
```

### 4. Chạy Unit Test

```bash
npm test
```

---

## 🔌 Cài đặt Plugin vào Figma Desktop

1. Khởi động ứng dụng **Figma Desktop**.
2. Trên thanh menu, chọn **Plugins** ➔ **Development** ➔ **Import plugin from manifest...**.
3. Duyệt đến thư mục repo và chọn file **`manifest.json`**.
4. Plugin **Figma Design Engine MVP** sẽ xuất hiện trong danh sách Plugins cá nhân của bạn.

> ⚠️ **Lưu ý về Domain whitelist (`networkAccess`):**
> Figma bắt buộc mọi kết nối HTTP từ plugin phải được khai báo trước trong `manifest.json`.
> Nếu backend của bạn chuyển sang một domain khác, bạn cần cập nhật mục `networkAccess.allowedDomains` trong `manifest.json` và import/reload lại plugin.

---

## 🔑 Cấu hình & Token xác thực

Sau khi mở plugin trong Figma, chuyển sang tab **Settings**:

1. **Backend URL**: Nhập địa chỉ API gốc của backend (mặc định môi trường dev: `http://localhost:3000/api`, hoặc URL production: `https://automation.ipactechnology.com/api`).
2. **Plugin Token**: Nhập chuỗi secret token được cấp từ server.

### Cách cấp Plugin Token từ VPS Backend

Trên server Marketing Automation OS:
```bash
cd /opt/marketing-os
openssl rand -base64 32 > secrets/plugin-tokens/<ten-designer>_current
chmod 600 secrets/plugin-tokens/<ten-designer>_current
chown 1000:1000 secrets/plugin-tokens/<ten-designer>_current
docker compose restart api
```
Copy chuỗi token này và dán vào ô **Plugin Token** trong tab **Settings** của plugin.

---

## 🖥️ Hướng dẫn sử dụng

### 1. Chế độ vẽ tự động (Auto Renderer)
- Mở file Figma của dự án thiết kế.
- Bật plugin và chuyển sang tab **Auto Renderer**.
- Giữ cửa sổ plugin mở. Plugin sẽ tự động kiểm tra hàng đợi mỗi 3 giây:
  - Khi có slide mới cần vẽ, plugin sẽ tự động kéo tài nguyên, dựng frame trên canvas và gửi ảnh hoàn thiện về hệ thống.
  - Tiến trình và log trạng thái sẽ hiển thị trực quan ngay trên giao diện plugin.

### 2. Chế độ đồng bộ chỉnh sửa (Manual Sync)
- Khi designer cần sửa tay một frame đã có hoặc thêm frame mới:
  - **Để thêm frame mới:** Chọn (select) frame mới trên canvas trước khi quét.
  - Mở tab **Manual Sync** ➔ bấm **Scan Canvas**.
  - Plugin sẽ hiển thị bảng danh sách thay đổi dự kiến (`CREATE`, `UPDATE`, `REORDER`, `DELETE`).
  - Sau khi kiểm tra thông tin, bấm **Sync Changes** để đẩy toàn bộ ảnh và metadata lên Cloudinary/Backend.

---

## 📡 API & Giao tiếp Backend

Mọi request từ plugin gửi tới backend đều được đính kèm header:
`x-plugin-token: <your-plugin-token>`

| Tuyến API (Endpoint) | Phương thức | Chức năng |
|---|---|---|
| `/designs/pending` | `GET` | Polling lấy danh sách công việc chờ render |
| `/designs/:id/render-result` | `POST` (multipart) | Gửi ảnh PNG render hoàn tất và điểm số |
| `/posts/:id/designs` | `GET` | Lấy danh sách slides server đang lưu trữ để đối chiếu |
| `/posts/:id/sync-canvas` | `POST` (multipart) | Đồng bộ thay đổi từ canvas lên Cloudinary/Database |

---

## 🧪 Kiểm thử (Testing)

Dự án sử dụng **Jest** và **ts-jest** để đảm bảo độ tin cậy cho các thuật toán trọng yếu:

```bash
npm test
```

Các bộ kiểm thử bao gồm:
- `test/canvas-diff.spec.ts`: Kiểm tra logic phân loại sai khác giữa canvas và server (CREATE, UPDATE, DELETE, REORDER).
- `test/select-post-frames.spec.ts`: Kiểm tra khả năng nhận diện frame thuộc bài viết và xử lý frame mới được chọn.
- `test/fingerprint.spec.ts`: Đảm bảo tính toán MD5 fingerprint nhất quán cho nội dung frame.
- `test/grammar-parser.spec.ts`: Kiểm tra cấu trúc câu lệnh và dữ liệu payload.
- `test/knowledge-constraints.spec.ts`: Kiểm tra các giới hạn ký tự và quy tắc dàn trang.

---

## 🛠️ Khắc phục sự cố (Troubleshooting)

| Vấn đề | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Log *"Polling paused... configure Plugin Token"* | Chưa điền token xác thực | Vào tab **Settings**, nhập đúng Plugin Token và Backend URL. |
| Lỗi `401 Unauthorized` | Token không khớp hoặc backend chưa nạp token mới | Kiểm tra file token trên VPS backend và khởi động lại API backend (`docker compose restart api`). |
| Lỗi mạng (*Failed to fetch* / *Blocked*) | Domain API chưa được cấp phép trong Figma | Thêm domain vào `networkAccess.allowedDomains` trong `manifest.json`, sau đó reload lại plugin. |
| Đồng bộ báo `409 Conflict` | Metadata version của frame trên canvas bị lệch so với database | Bấm **Scan Canvas** lại để plugin đọc dữ liệu mới nhất từ server rồi mới bấm Sync. |
| Thiếu font khi render (*Font not found*) | Máy tính thiếu font chữ `Inter` | Cài đặt bộ font `Inter` đầy đủ (Regular, Medium, Bold) vào hệ điều hành của máy. |

---

## 📄 Giấy phép

Dự án nội bộ được phát triển cho hệ sinh thái **Marketing Automation OS**. Mọi quyền được bảo lưu.
