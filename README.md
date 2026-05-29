# Quản lý GOMITA

Phần mềm quản lý công ty nội thất/xưởng sản xuất, lấy đơn hàng/công trình làm trung tâm.

## Công nghệ

- Next.js + React
- Tailwind CSS
- Supabase Auth, PostgreSQL, Storage, Realtime

## Cấu trúc module

- `src/modules/hr`: nhân sự, tài khoản, chức vụ, phân quyền
- `src/modules/attendance`: chấm công, chấm công bù, tăng ca
- `src/modules/orders`: luồng đơn hàng, trả đơn, tách đơn
- `src/modules/finance`: kế toán, tài chính, hoàn công
- `src/modules/kpi`: KPI, sao động viên
- `src/modules/notifications`: popup realtime, bắt buộc đọc
- `src/modules/files`: file, ảnh, Supabase Storage
- `src/modules/backup`: backup, restore

## Chạy local

```bash
npm install
npm run dev
```

Tạo `.env.local` từ `.env.example`, sau đó cấu hình Supabase.
