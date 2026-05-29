const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3001;
const DB_FILE = path.join(__dirname, "gomita_db.json");

// Khởi tạo cơ sở dữ liệu mẫu mặc định
const initialData = {
  accounts: [
    {
      id: "u-director",
      displayName: "Giám đốc GOMITA",
      username: "giamdoc",
      password: "123",
      department: "Giám đốc",
      positionIds: ["director"],
      status: "active",
      salaryType: "monthly",
      salaryValue: 20000000
    },
    {
      id: "u-hr",
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
  attendance: {} // { "userId-date-slot": "normal" | "compensated" }
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
        if (patch.attendance) db.attendance = patch.attendance;
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
        const { userId, date, slot, orderCode, isCompleted } = JSON.parse(body);
        
        // Cập nhật chấm công
        const key = `${userId}-${date}-${slot}`;
        db.attendance[key] = "normal";

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

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Đường dẫn không tồn tại" }));
});

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 GOMITA API SERVER ĐANG CHẠY TRÊN PORT ${PORT}`);
  console.log(`📂 Lưu trữ cơ sở dữ liệu tại: ${DB_FILE}`);
  console.log(`=================================================`);
});
