# Construction Project Management (CPM)

Hệ thống quản lý dự án xây dựng — Angular 21 (standalone, signals, zoneless), Angular Material, NgRx Signal Store.
Chưa có backend thật: toàn bộ API được giả lập bằng **MSW** (Mock Service Worker) + **@faker-js/faker** (locale vi).

## Chạy dự án

```bash
npm install        # .npmrc đã bật legacy-peer-deps (tránh lỗi arborist của npm 10.9)
npm start          # ng serve -> http://localhost:4200
npm test           # unit test (Vitest)
npm run build      # build production
```

> Yêu cầu Node `^20.19 || ^22.12 || >=24`. Angular 22 cần Node ≥ 22.22.3 nên dự án đang dùng Angular 21.

## Tài khoản demo

Mật khẩu chung: `Demo@123` (trang đăng nhập có nút đăng nhập nhanh).

| Role              | Email             | Quyền chính                                   |
| ----------------- | ----------------- | --------------------------------------------- |
| `ADMIN`           | admin@cpm.vn      | Toàn quyền, quản trị người dùng & cấu hình     |
| `PROJECT_MANAGER` | pm@cpm.vn         | Quản lý dự án, nhân sự, ngân sách, báo cáo     |
| `SITE_ENGINEER`   | kysu@cpm.vn       | Công việc, nhật ký công trường, vật tư         |
| `CLIENT`          | chudautu@cpm.vn   | Chỉ xem: dự án, tiến độ, ngân sách, báo cáo     |

Menu và quyền truy cập route được khai báo một chỗ tại `src/app/core/layout/navigation.ts`.

## Nhật ký công trường

- Ảnh được nén còn tối đa 1600px (JPEG) trước khi tải lên; GPS lấy bằng Geolocation API (cần HTTPS hoặc localhost) và
  hiển thị khoảng cách tới công trình — ảnh chụp cách xa hơn 1 km được đánh dấu.
- Xuất PDF hoàn toàn phía client bằng pdfmake (font Roboto có dấu tiếng Việt); thư viện ~1 MB chỉ tải khi bấm "Xuất PDF".

## Fake BE (MSW)

- Bật/tắt trong `src/environments/*.ts`: `useMocks`, độ trễ (`mock.minDelayMs`/`maxDelayMs`), lỗi ngẫu nhiên (`mock.randomErrors`, `mock.errorRate`).
- Dữ liệu nằm trong in-memory DB (`src/app/mocks/db.ts`), persist xuống `localStorage` (key `cpm.mock-db`).
- "Reset dữ liệu demo" (trang đăng nhập hoặc menu tài khoản) gọi `POST /api/v1/__demo/reset` để nạp lại seed.
- Handler chia theo resource trong `src/app/mocks/handlers/`, factory dữ liệu trong `src/app/mocks/factories/`.
- Danh sách hỗ trợ `?page=&pageSize=&sort=field|-field&q=` và lọc theo field (`?status=A,B`), trả về `{ data, total, page, pageSize }`.
- Khi có BE thật: đặt `useMocks: false` và trỏ `apiBaseUrl` tới BE — không cần sửa code feature.

### Endpoint fake BE

| Endpoint | Ghi chú |
| --- | --- |
| `GET/POST /projects`, `GET/PUT/DELETE /projects/:id`, `GET /projects/:id/members` | Ghi: ADMIN, PM. SITE_ENGINEER chỉ thấy dự án được gán (403 với dự án khác). Trùng mã → 409, dữ liệu sai → 422 |
| `GET/POST /tasks`, `GET/PATCH/DELETE /tasks/:id` | Sửa: ADMIN, PM, SITE_ENGINEER (dự án được gán). Xoá: ADMIN, PM. `status: DONE` → tự đặt 100% |
| `GET/POST /tasks/:id/comments` | CLIENT chỉ đọc |
| `GET /dashboard/summary` | KPI, S-curve, chi phí theo dự án, việc trễ hạn — tính trực tiếp từ DB mock theo phạm vi quyền |
| `GET/POST /site-diaries`, `GET/PUT/DELETE /site-diaries/:id` | Lọc `?projectId=&status=&from=&to=`. Một dự án chỉ có một nhật ký/ngày (409). Chỉ sửa khi DRAFT/REJECTED, chỉ xoá DRAFT. CLIENT chỉ thấy APPROVED |
| `POST /site-diaries/:id/submit` · `/approve` · `/reject` | DRAFT/REJECTED → SUBMITTED → APPROVED/REJECTED. Duyệt: PROJECT_MANAGER (và ADMIN). Trả lại bắt buộc có lý do |
| `POST /uploads` (multipart, field `file`), `GET /files/:id` | Fake upload: ảnh lưu Blob trong **IndexedDB** (localStorage không đủ chỗ), phục vụ lại qua URL `/api/v1/files/:id` |

Ma trận quyền dùng chung cho UI và fake BE: `src/app/core/auth/permissions.ts`.

Seed: 8 dự án (Hà Nội, TP.HCM, Đà Nẵng, Hải Phòng, Cần Thơ, Bắc Ninh, Khánh Hòa), ~130 công việc, ~100 bình luận,
~135 nhật ký công trường 30 ngày gần nhất (ảnh seed là SVG minh hoạ do fake BE sinh ra).
Ngày tháng tính tương đối so với hôm nay; tiến độ thực tế = trung bình % hoàn thành của công việc nên kéo thả trên Kanban
sẽ làm thay đổi tiến độ dự án và số liệu dashboard.

## Cấu trúc

```
src/app/
├── core/        # auth (store, guards), interceptors, layout, theme, config
├── shared/      # models, directives (*hasRole), pipes, ui
├── mocks/       # MSW: db, seed, factories, handlers, utils
└── features/    # auth, dashboard, errors, ... (lazy load)
```
