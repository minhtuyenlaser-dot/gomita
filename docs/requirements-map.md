# Bản đồ yêu cầu Quản lý GOMITA

## Trung tâm hệ thống

- Đơn hàng/công trình là trung tâm: `src/modules/orders`
- Nhân sự, chức vụ, nhiều vị trí trên một tài khoản: `src/modules/hr`
- Phân quyền theo vị trí đang chọn: `src/modules/hr/roles.ts`

## Module nghiệp vụ

- Nhân sự: hồ sơ, tài khoản, hợp đồng, lương, chức vụ, phân quyền
- Chấm công: `src/modules/attendance`
- Tăng ca: bảng `overtime_requests` trong `supabase/schema.sql`
- Luồng đơn hàng: `src/modules/orders/orderFlow.ts`
- Kế toán/tài chính: `src/modules/finance`
- KPI/sao động viên: `src/modules/kpi`
- Thông báo realtime: `src/modules/notifications`
- File/ảnh: `src/modules/files`
- Backup/restore: `src/modules/backup`

## Chấm công bù

Luồng hiện có trong prototype:

1. Người lao động chọn ngày thiếu công.
2. Tích các mốc cần bù: 07:30, 11:30, 13:30, 17:30.
3. Nhập lý do.
4. Hệ thống tính số lần thiếu trong tháng.
5. Hệ thống xác định cấp duyệt theo vị trí nhân sự và số lần thiếu.
6. Duyệt đủ mới tính công.
7. Yêu cầu đã duyệt ẩn khỏi danh sách chờ và bảng công đổi màu.

Logic duyệt nằm ở `src/modules/attendance/compensationRules.ts`.

## Supabase

Schema nền nằm ở `supabase/schema.sql`, gồm:

- nhân sự và vị trí
- đơn hàng và log nghiệp vụ quan trọng
- chấm công và chấm công bù
- tăng ca
- thông báo realtime
- tài chính
- KPI

Realtime đã bật cho:

- `notifications`
- `orders`
- `attendance_compensation_requests`
