Huong tach file phan mem Quan ly GOMITA

Hien tai app.js dang la file tong hop toan bo logic. Co the tach duoc, nhung nen tach theo tung buoc nho de tranh vo du lieu dang test trong localStorage.

De xuat cau truc:

1. core.js
- Hang so vai tro, phong ban, cong doan, trang thai.
- Du lieu goc, migrateDb, saveDb, cac ham tien ich chung.

2. ui.js
- render, layout, sidebar, dashboard, modal, bang, card, badge.
- Chi xu ly hien thi, khong sua truc tiep luong don hang.

3. orders.js
- Tao don, chi tiet don, Kanban, giao viec, chuyen cong doan, tiep nhan, xac nhan, tra lai, tam dung/tiep tuc.

4. attendance.js
- Cham cong, cham cong bu, tang ca, bang cong, tinh cong, tinh luong hien tai.

5. finance.js
- Ke toan, vat tu, hoan cong, thu du tien, tong ket gio/tien cong theo don hang.

6. customers.js
- Tao khach hang, phe duyet khach, tra lai, danh sach khach hang.

7. employees.js
- Tai khoan, vai tro, nhan su, khoa/xoa/sua, ung luong, ho so nhan su.

Thu tu script sau khi tach:
core.js -> attendance.js -> customers.js -> orders.js -> employees.js -> finance.js -> ui.js -> bootstrap.js

Nguyen tac khi tach:
- Moi lan chi tach mot nhom ham, mo PM kiem tra lai roi moi tach nhom tiep theo.
- Khong doi ten key localStorage gomita_company_db neu muon giu du lieu test.
- Nhung ham dang duoc goi tu onclick trong HTML string phai nam tren window/global scope.
