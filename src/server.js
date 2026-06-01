const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, "gomita_db.json");

// Khởi tạo cơ sở dữ liệu mẫu mặc định
const initialData = {
  compensationRequests: [],
  accounts: [
    {
      id: "u-director",
      employeeCode: "NV-0001",
      displayName: "Giám đốc GOMITA",
      username: "giamdoc",
      password: "123",
      department: "Giám đốc",
      positionIds: ["director"],
      status: "active",
      salaryType: "monthly",
      salaryValue: 20000000,
      idCardNumber: "001086000001",
      laborContractNote: "Hợp đồng điều hành công ty"
    },
    {
      id: "u-hr",
      employeeCode: "NV-0002",
      displayName: "Nhân sự GOMITA",
      username: "nhansu",
      password: "123",
      department: "Nhân sự",
      positionIds: ["hr"],
      status: "active",
      salaryType: "daily",
      salaryValue: 420000
    },
    {
      id: "u-tuan",
      employeeCode: "NV-0101",
      displayName: "Tuấn sản xuất",
      username: "tuan",
      password: "123",
      department: "Xưởng",
      positionIds: ["production_worker"],
      status: "active",
      salaryType: "daily",
      salaryValue: 350000
    },
    {
      id: "u-hoa",
      employeeCode: "NV-0102",
      displayName: "Hoa lắp đặt",
      username: "hoa",
      password: "123",
      department: "Giám sát",
      positionIds: ["installer"],
      status: "active",
      salaryType: "daily",
      salaryValue: 350000
    }
  ],
  orders: [
    {
      id: "o-1",
      code: "TUAN-LECHAN-759",
      customerName: "Anh Tuấn Lê Chân",
      area: "Hải Phòng",
      phone: "0912***456",
      address: "123 Lạch Tray, Ngô Quyền",
      step: "Sản xuất",
      progressPercent: 60,
      deadline: "2026-06-05",
      workStatus: "working",
      productionWorkerName: "Tuấn sản xuất",
      productionWorkerNames: ["Tuấn sản xuất"]
    },
    {
      id: "o-2",
      code: "HOA-THUYNGUYEN-258",
      customerName: "Chị Hoa Thủy Nguyên",
      area: "Hải Phòng",
      phone: "0904***789",
      address: "Đường Đà Nẵng, Thủy Nguyên",
      step: "Lắp đặt",
      progressPercent: 40,
      deadline: "2026-06-08",
      workStatus: "working",
      installerName: "Hoa lắp đặt",
      installerNames: ["Hoa lắp đặt"]
    }
  ],
  overtimeRequests: [
    {
      id: "ot-mock-1",
      userId: "u-tuan",
      userDisplayName: "Tuấn sản xuất",
      from: "18:00",
      to: "20:00",
      hours: 2,
      reason: "Tăng ca lắp ráp tủ CNC gấp",
      status: "approved",
      createdAt: new Date().toISOString()
    }
  ],
  leaveRequests: [],
  cashTransactions: [],
  customerDebts: [],
  holidayDates: [
    "2026-01-01",
    "2026-02-16",
    "2026-02-17",
    "2026-02-18",
    "2026-02-19",
    "2026-02-20",
    "2026-04-30",
    "2026-05-01",
    "2026-09-01",
    "2026-09-02"
  ],
  attendance: {}, // { "userId-date-slot": "normal" | "compensated" | "leave_locked" }
  attendanceDetails: {}, // { "userId-date-slot": { photo: string, gps: string | object, time: string } }
  attendanceCompensationState: {}
};

// Đảm bảo có tệp tin cơ sở dữ liệu
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf8");
}

function readDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Lỗi đọc cơ sở dữ liệu:", err);
    return initialData;
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Lỗi ghi cơ sở dữ liệu:", err);
  }
}

function getAttendanceCompState(db, userId) {
  db.attendanceCompensationState = db.attendanceCompensationState || {};
  if (!db.attendanceCompensationState[userId]) {
    db.attendanceCompensationState[userId] = {
      declineCount: 0,
      lockedThroughDate: null,
      lastDeclinedAt: null
    };
  }
  return db.attendanceCompensationState[userId];
}

function toAttendanceKey(userId, item) {
  const dateText = typeof item.date === "string" ? item.date : "";
  const parts = dateText.split("-");
  const dayToken = parts.length === 3 ? String(Number(parts[2])) : String(item.day ?? dateText);
  return `${userId}-${dayToken}-${item.slot}`;
}

function toCurrentLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isAttendanceBlockedDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (date.getDay() === 0) return true;
  return false;
}

const server = http.createServer((req, res) => {
  // Cấu hình CORS để cả Web và App Mobile đều kết nối được
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const db = readDB();

  if (url.pathname === "/api/data" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(db));
    return;
  }

  if (url.pathname === "/api/sync" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const patch = JSON.parse(body);
        if (patch.accounts) db.accounts = patch.accounts;
        if (patch.orders) db.orders = patch.orders;
        if (patch.overtimeRequests) db.overtimeRequests = patch.overtimeRequests;
        if (patch.leaveRequests) db.leaveRequests = patch.leaveRequests;
        if (patch.cashTransactions) db.cashTransactions = patch.cashTransactions;
        if (patch.customerDebts) db.customerDebts = patch.customerDebts;
        if (patch.compensationRequests) db.compensationRequests = patch.compensationRequests;
        if (patch.holidayDates) db.holidayDates = patch.holidayDates;
        if (patch.attendance) db.attendance = patch.attendance;
        if (patch.attendanceDetails) db.attendanceDetails = patch.attendanceDetails;
        if (patch.attendanceCompensationState) db.attendanceCompensationState = patch.attendanceCompensationState;
        writeDB(db);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, db }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Dữ liệu JSON không hợp lệ" }));
      }
    });
    return;
  }

  // API Đăng nhập nhanh cho di động
  if (url.pathname === "/api/login" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { username, password } = JSON.parse(body);
        const normUser = username.trim().toLowerCase();
        const normPass = password.trim();
        const account = db.accounts.find(
          (acc) => acc.username.toLowerCase() === normUser && acc.password === normPass && acc.status === "active"
        );
        if (account) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, account }));
        } else {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Sai tài khoản hoặc mật khẩu!" }));
        }
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Lỗi xử lý yêu cầu" }));
      }
    });
    return;
  }

  // API chấm công di động
  if (url.pathname === "/api/clockin" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { userId, date, slot, orderCode, isCompleted, photo, gps, gpsAddress, gpsMeta, time } = JSON.parse(body);
        const localDateString = toCurrentLocalDateString();
        const holidayDates = Array.isArray(db.holidayDates) ? db.holidayDates : [];
        if (isAttendanceBlockedDate(localDateString) || holidayDates.includes(localDateString)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Hôm nay là ngày nghỉ hoặc ngày lễ, không được chấm công." }));
          return;
        }
        
        // Cập nhật chấm công
        const key = `${userId}-${date}-${slot}`;
        db.attendance[key] = "normal";

        // Cập nhật chi tiết ảnh & gps & giờ chấm thực tế
        if (photo || gps) {
          db.attendanceDetails = db.attendanceDetails || {};
          db.attendanceDetails[key] = {
            photo: photo || "",
            gps: gps || "",
            gpsAddress: gpsAddress || "",
            gpsMeta: gpsMeta || null,
            time: time || new Date().toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          };
        }

        // Nếu có báo cáo tiến độ đơn hàng
        if (orderCode) {
          db.orders = db.orders.map((o) => {
            if (o.code === orderCode) {
              return {
                ...o,
                workStatus: isCompleted ? "pending_confirmation" : "working",
                progressPercent: isCompleted ? 100 : o.progressPercent
              };
            }
            return o;
          });
        }

        writeDB(db);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, db }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Lỗi ghi nhận chấm công" }));
      }
    });
    return;
  }

  // API báo cáo hoàn thành đơn hàng di động độc lập
  if (url.pathname === "/api/report-done" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { orderCode, workerName } = JSON.parse(body);
        db.orders = db.orders.map((o) => {
          if (o.code === orderCode) {
            return {
              ...o,
              workStatus: "pending_confirmation",
              progressPercent: 100,
              finalNote: `Thợ ${workerName} báo cáo hoàn thành qua Mobile App`
            };
          }
          return o;
        });
        writeDB(db);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, db }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Lỗi ghi nhận hoàn thành công việc" }));
      }
    });
    return;
  }

  if (url.pathname === "/api/attendance-compensation-response" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { userId, decision, pendingSlots = [] } = JSON.parse(body);
        if (!userId || (decision !== "decline" && decision !== "reset")) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Thiếu dữ liệu quyết định bù công" }));
          return;
        }

        const state = getAttendanceCompState(db, userId);

        if (decision === "reset") {
          state.declineCount = 0;
          state.lastDeclinedAt = null;
          writeDB(db);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, locked: false, state }));
          return;
        }

        state.declineCount += 1;
        state.lastDeclinedAt = new Date().toISOString();

        let locked = false;
        if (state.declineCount >= 5 && Array.isArray(pendingSlots) && pendingSlots.length > 0) {
          pendingSlots.forEach((item) => {
            const attendanceKey = toAttendanceKey(userId, item);
            if (!db.attendance[attendanceKey]) {
              db.attendance[attendanceKey] = "leave_locked";
            }
          });

          const sortedDates = pendingSlots
            .map((item) => item.date)
            .filter(Boolean)
            .sort((left, right) => left.localeCompare(right));

          state.lockedThroughDate = sortedDates[sortedDates.length - 1] || state.lockedThroughDate || null;
          state.declineCount = 0;
          locked = true;
        }

        writeDB(db);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, locked, state }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Không xử lý được quyết định bù công" }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Đường dẫn không tồn tại" }));
});

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 GOMITA API SERVER ĐANG CHẠY TRÊN PORT ${PORT}`);
  console.log(`📂 Lưu trữ cơ sở dữ liệu tại: ${DB_FILE}`);
  console.log(`=================================================`);
});
