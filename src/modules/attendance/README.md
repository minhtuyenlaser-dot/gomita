# Module chấm công

Module này xử lý:

- Chấm công 4 mốc: 07:30, 11:30, 13:30, 17:30
- Mở chấm công trước 15 phút
- Chấm công có camera và lưu ảnh Supabase Storage
- Chấm công bù không cần ảnh
- Duyệt chấm công bù theo vị trí nhân sự và số lần thiếu trong tháng
- Sau khi duyệt, ghi nhận công bù và đổi màu ngày trên bảng công

Logic duyệt nằm ở `compensationRules.ts`, UI nằm ở `components/AttendanceDashboard.tsx`.
