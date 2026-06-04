import type { Order } from "./orderFlow";
import type { UserAccount } from "@/modules/hr/accounts";

function calculateWorkingHours(startStr?: string, endStr?: string): number {
  if (!startStr) return 0;
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : new Date();
  if (end < start) return 0;
  
  let totalHours = 0;
  let d = new Date(start);
  const stepMinutes = 15;
  
  while (d < end) {
    const day = d.getDay();
    if (day !== 0) { // Bỏ qua Chủ Nhật
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      
      const isMorning = timeInMinutes >= 450 && timeInMinutes < 690;
      const isAfternoon = timeInMinutes >= 810 && timeInMinutes < 1050;
      
      if (isMorning || isAfternoon) {
        totalHours += stepMinutes / 60;
      }
    }
    d.setMinutes(d.getMinutes() + stepMinutes);
  }
  return parseFloat(totalHours.toFixed(1));
}

function getMaxWorkDaysForDate(dateLike?: string) {
  const baseDate = dateLike ? new Date(dateLike) : new Date();
  if (Number.isNaN(baseDate.getTime())) return 26;
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let total = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    if (new Date(year, month, day).getDay() !== 0) total += 1;
  }
  return total;
}

function getHourlyRateForAssignee(accounts: UserAccount[], displayName?: string, dateLike?: string) {
  if (!displayName) return 0;
  const account = accounts.find((item) => item.status === "active" && item.displayName === displayName);
  if (!account || !account.salaryValue) return 0;
  if ((account.salaryType ?? "daily") === "monthly") {
    const maxWorkDays = getMaxWorkDaysForDate(dateLike);
    return maxWorkDays > 0 ? account.salaryValue / maxWorkDays / 8 : 0;
  }
  return account.salaryValue / 8;
}

function getAssigneeListForStep(order: Order, step: string): string[] {
  switch (step) {
    case "Tiếp nhận":
    case "Báo giá":
      return order.saleName ? order.saleName.split(",").map((s) => s.trim()).filter(Boolean) : [];
    case "Thiết kế":
      return ((order.designerNames?.length ? order.designerNames : [order.designerName]) as string[]).filter(Boolean);
    case "Ra file":
      return ((order.fileOperatorNames?.length ? order.fileOperatorNames : [order.fileOperatorName]) as string[]).filter(Boolean);
    case "Sản xuất":
      return ((order.productionWorkerNames?.length ? order.productionWorkerNames : [order.productionWorkerName]) as string[]).filter(Boolean);
    case "Lắp đặt":
      return ((order.installerNames?.length ? order.installerNames : [order.installerName]) as string[]).filter(Boolean);
    case "Nghiệm thu":
    case "Hoàn công":
      return ((order.supervisorNames?.length ? order.supervisorNames : [order.supervisorName]) as string[]).filter(Boolean);
    default:
      return [];
  }
}

export function exportOrderToExcel(order: Order, accounts: UserAccount[] = [], overtimeRequests: any[] = []) {
  const quotation = order.quotation || { estimateValue: 0, quoteValue: 0 };
  const materials = order.materialsList || [];
  const incurred = order.incurredCosts || [];
  const accessories = order.externalAccessories || [];
  const logs = order.historyLogs || [];

  const formatMoney = (val: number) => (val || 0).toLocaleString("vi-VN") + " đ";
  
  // 1. Tính toán tiền công thợ và ngày công
  let totalLaborCost = 0;
  let totalWorkdays = 0;
  const allowedSteps = ["Thiết kế", "Ra file", "Sản xuất", "Lắp đặt"];
  const logsSummary = logs
    .filter((log) => allowedSteps.includes(log.step))
    .map((log) => {
      const workingHours = calculateWorkingHours(log.startedAt, log.completedAt);
      const assigneeList = getAssigneeListForStep(order, log.step);
      const finalAssignees = assigneeList.length > 0 ? assigneeList : [log.assignee].filter(Boolean);

      const assigneeDetails = finalAssignees.map((name) => {
        const personOT = overtimeRequests
          .filter((req) => req.orderCode === order.code && req.userDisplayName === name && req.status === "approved")
          .reduce((sum, req) => sum + (req.hours || 0), 0);
        const totalHours = workingHours + personOT;
        const workdays = parseFloat((totalHours / 8).toFixed(2));
        const hourlyRate = getHourlyRateForAssignee(accounts, name, log.completedAt || log.startedAt);
        const cost = (workingHours * hourlyRate) + (personOT * hourlyRate * 1.5);
        totalWorkdays += workdays;
        totalLaborCost += cost;
        return { name, overtimeHours: personOT, workdays, cost, hourlyRate };
      });

      return {
        step: log.step,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        workingHours,
        assignees: assigneeDetails,
      };
    });

  // 2. Chi phí vật tư
  const materialCost = materials.reduce((sum, mat) => sum + mat.price, 0);

  // 3. Phụ kiện ngoài
  let accessorySales = 0;
  let accessoryCost = 0;
  const activeAccessories = (accessories || []).filter((acc) => acc.name.trim());
  activeAccessories.forEach((acc) => {
    const cost = acc.actualCost || acc.costPrice || 0;
    accessorySales += acc.sellPrice || 0;
    accessoryCost += cost;
  });

  // 4. Chi phí lắp đặt khác
  const transport = order.installationCosts?.transport || 0;
  const loader = order.installationCosts?.loader || 0;

  // 5. Doanh thu & Lợi nhuận
  const revenue = quotation.quoteValue + accessorySales;
  const totalExpenses = (order.customLaborCost !== undefined ? order.customLaborCost : totalLaborCost) + materialCost + accessoryCost + transport + loader;
  const profit = revenue - totalExpenses;

  // Xây dựng template HTML
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8"/>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Hồ sơ quyết toán</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
      <style>
        table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10pt; width: 100%; }
        td, th { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: middle; }
        .header-banner { background-color: #ea580c; color: white; font-size: 16pt; font-weight: bold; text-align: center; padding: 15px; }
        .section-title { background-color: #e2e8f0; font-weight: bold; font-size: 11pt; color: #0f172a; text-align: left; padding: 8px 10px; border-bottom: 2px solid #94a3b8; }
        .label { font-weight: bold; color: #475569; background-color: #f8fafc; width: 180px; }
        .value { color: #0f172a; }
        .number { text-align: right; }
        .bold { font-weight: bold; }
        .text-center { text-align: center; }
        .highlight-green { color: #16a34a; font-weight: bold; background-color: #f0fdf4; }
        .highlight-red { color: #dc2626; font-weight: bold; background-color: #fef2f2; }
        .table-header { background-color: #f1f5f9; font-weight: bold; color: #334155; }
        .sub-header { background-color: #fafafa; font-style: italic; color: #64748b; }
      </style>
    </head>
    <body>
      <table>
        <!-- BANNER -->
        <tr>
          <td colspan="7" class="header-banner">HỒ SƠ QUYẾT TOÁN CHI TIẾT ĐƠN HÀNG: ${order.code}</td>
        </tr>
        <tr><td colspan="7" style="border:none; height:10px;"></td></tr>
        
        <!-- SECTION I: THÔNG TIN CHUNG -->
        <tr>
          <td colspan="7" class="section-title">I. THÔNG TIN CHUNG KHÁCH HÀNG & PHÂN CÔNG</td>
        </tr>
        <tr>
          <td class="label">Mã đơn hàng</td>
          <td class="value bold" colspan="2">${order.code}</td>
          <td class="label">Trạng thái hiện tại</td>
          <td class="value bold" colspan="2">${order.step}</td>
          <td></td>
        </tr>
        <tr>
          <td class="label">Khách hàng</td>
          <td class="value" colspan="2">${order.customerName}</td>
          <td class="label">Số điện thoại</td>
          <td class="value" colspan="2">${order.phone}</td>
          <td></td>
        </tr>
        <tr>
          <td class="label">Địa chỉ lắp đặt</td>
          <td class="value" colspan="5">${order.address}</td>
          <td></td>
        </tr>
        <tr>
          <td class="label">Khu vực</td>
          <td class="value" colspan="2">${order.area}</td>
          <td class="label">Thời gian xuất báo cáo</td>
          <td class="value" colspan="2">${new Date().toLocaleString("vi-VN")}</td>
          <td></td>
        </tr>
        <tr>
          <td class="label">Sale phụ trách</td>
          <td class="value" colspan="2">${order.saleName || "Chưa phân công"}</td>
          <td class="label">Thiết kế phụ trách</td>
          <td class="value" colspan="2">${order.designerName || "Chưa phân công"}</td>
          <td></td>
        </tr>
        <tr>
          <td class="label">Thợ CNC/Ra file</td>
          <td class="value" colspan="2">${order.fileOperatorName || "Chưa phân công"}</td>
          <td class="label">Thợ sản xuất</td>
          <td class="value" colspan="2">${order.productionWorkerName || "Chưa phân công"}</td>
          <td></td>
        </tr>
        <tr>
          <td class="label">Thợ lắp đặt</td>
          <td class="value" colspan="2">${order.installerName || "Chưa phân công"}</td>
          <td class="label">Giám sát công trình</td>
          <td class="value" colspan="2">${order.supervisorName || "Chưa phân công"}</td>
          <td></td>
        </tr>
        <tr><td colspan="7" style="border:none; height:15px;"></td></tr>

        <!-- SECTION II: TIẾN ĐỘ THỰC HIỆN & CHI PHÍ NHÂN CÔNG -->
        <tr>
          <td colspan="7" class="section-title">II. TIẾN ĐỘ THỰC HIỆN & TIỀN CÔNG THỢ</td>
        </tr>
        <tr class="table-header">
          <td colspan="2">Công đoạn</td>
          <td>Người đảm nhận</td>
          <td class="number">Bắt đầu</td>
          <td class="number">Hoàn thành</td>
          <td class="number">Giờ làm (OT)</td>
          <td class="number">Thành tiền công</td>
        </tr>
  `;

  if (logsSummary.length === 0) {
    html += `<tr><td colspan="7" style="color: #64748b; font-style: italic; text-align: center;">Chưa ghi nhận lịch sử công đoạn</td></tr>`;
  } else {
    logsSummary.forEach((log) => {
      const startStr = log.startedAt ? new Date(log.startedAt).toLocaleString("vi-VN") : "Chưa rõ";
      const endStr = log.completedAt ? new Date(log.completedAt).toLocaleString("vi-VN") : "Đang thực hiện";
      const isManyPeople = log.assignees.length > 1;

      html += `
        <tr style="background-color: #faf5ff;">
          <td colspan="2" class="bold">${log.step}</td>
          <td>${isManyPeople ? "Nhiều người phụ trách" : (log.assignees[0]?.name || "Chưa ghi nhận")}</td>
          <td class="number">${startStr}</td>
          <td class="number">${endStr}</td>
          <td class="number">${log.workingHours}h</td>
          <td class="number bold">${formatMoney(log.assignees.reduce((s, p) => s + p.cost, 0))}</td>
        </tr>
      `;

      if (isManyPeople) {
        log.assignees.forEach((p) => {
          html += `
            <tr class="sub-header">
              <td colspan="2" style="padding-left: 20px;">└─ Chi tiết nhân sự</td>
              <td>${p.name}</td>
              <td colspan="2" class="text-center">Đơn giá: ${formatMoney(p.hourlyRate)}/h</td>
              <td class="number">${(p.workdays * 8).toFixed(1)}h (${p.overtimeHours}h OT)</td>
              <td class="number">${formatMoney(p.cost)}</td>
            </tr>
          `;
        });
      }
    });
  }

  // Row for total labor cost
  html += `
        <tr class="table-header">
          <td colspan="5" class="bold">Tổng cộng tiền công thợ ước tính (${totalWorkdays.toFixed(2)} ngày công)</td>
          <td colspan="2" class="number highlight-red">${formatMoney(totalLaborCost)}</td>
        </tr>
        <tr><td colspan="7" style="border:none; height:15px;"></td></tr>

        <!-- SECTION III: CHI TIẾT VẬT TƯ & CHI PHÍ PHỤ -->
        <tr>
          <td colspan="7" class="section-title">III. CHI TIẾT VẬT TƯ & CHI PHÍ LẮP ĐẶT PHỤ</td>
        </tr>
        <tr class="table-header">
          <td colspan="4">Danh mục vật tư / Chi phí phụ</td>
          <td colspan="3" class="number">Số tiền</td>
        </tr>
  `;

  if (materials.length === 0) {
    html += `<tr><td colspan="7" style="color: #64748b; font-style: italic; text-align: center;">Không có vật tư nào ghi nhận</td></tr>`;
  } else {
    materials.forEach((mat) => {
      html += `
        <tr>
          <td colspan="4">${mat.name}</td>
          <td colspan="3" class="number">${formatMoney(mat.price)}</td>
        </tr>
      `;
    });
  }

  // Installation Costs
  html += `
        <tr class="table-header">
          <td colspan="4" class="bold">Tổng chi phí vật tư sản xuất</td>
          <td colspan="3" class="number highlight-red">${formatMoney(materialCost)}</td>
        </tr>
        <tr>
          <td colspan="4">Chi phí xe vận chuyển (Giám sát nhập)</td>
          <td colspan="3" class="number">${formatMoney(transport)}</td>
        </tr>
        <tr>
          <td colspan="4">Chi phí bốc xếp (Giám sát nhập)</td>
          <td colspan="3" class="number">${formatMoney(loader)}</td>
        </tr>
        <tr class="table-header">
          <td colspan="4" class="bold">Tổng chi phí vận chuyển & bốc xếp</td>
          <td colspan="3" class="number highlight-red">${formatMoney(transport + loader)}</td>
        </tr>
        <tr><td colspan="7" style="border:none; height:15px;"></td></tr>

        <!-- SECTION IV: CHI TIẾT PHỤ KIỆN NGOÀI -->
        <tr>
          <td colspan="7" class="section-title">IV. CHI TIẾT PHỤ KIỆN NGOÀI</td>
        </tr>
        <tr class="table-header">
          <td colspan="3">Tên phụ kiện ngoài</td>
          <td class="number">Giá bán (Khách trả)</td>
          <td class="number">Giá vốn (Kế toán nhập)</td>
          <td class="number">Chi phí thực tế</td>
          <td class="number">Chênh lệch bán - vốn</td>
        </tr>
  `;

  if (activeAccessories.length === 0) {
    html += `<tr><td colspan="7" style="color: #64748b; font-style: italic; text-align: center;">Không có phụ kiện ngoài</td></tr>`;
  } else {
    activeAccessories.forEach((acc) => {
      const cost = acc.actualCost || acc.costPrice || 0;
      const profitMargin = acc.sellPrice - cost;
      html += `
        <tr>
          <td colspan="3">${acc.name}</td>
          <td class="number">${formatMoney(acc.sellPrice)}</td>
          <td class="number">${formatMoney(acc.costPrice)}</td>
          <td class="number">${formatMoney(acc.actualCost)}</td>
          <td class="number bold ${profitMargin >= 0 ? 'highlight-green' : 'highlight-red'}">${formatMoney(profitMargin)}</td>
        </tr>
      `;
    });
    html += `
      <tr class="table-header">
        <td colspan="3" class="bold">Tổng phụ kiện ngoài</td>
        <td class="number">${formatMoney(accessorySales)}</td>
        <td colspan="2" class="number highlight-red">Giá vốn: ${formatMoney(accessoryCost)}</td>
        <td class="number highlight-green">Lợi nhuận: ${formatMoney(accessorySales - accessoryCost)}</td>
      </tr>
    `;
  }

  html += `
        <tr><td colspan="7" style="border:none; height:15px;"></td></tr>

        <!-- SECTION V: CÁC KHOẢN PHÁT SINH TĂNG/GIẢM -->
        <tr>
          <td colspan="7" class="section-title">V. CÁC KHOẢN PHÁT SINH TĂNG/GIẢM (KẾ TOÁN NHẬP)</td>
        </tr>
        <tr class="table-header">
          <td colspan="4">Nội dung phát sinh</td>
          <td colspan="3" class="number">Số tiền</td>
        </tr>
  `;

  if (incurred.length === 0) {
    html += `<tr><td colspan="7" style="color: #64748b; font-style: italic; text-align: center;">Chưa ghi nhận khoản phát sinh nào</td></tr>`;
  } else {
    incurred.forEach((inc) => {
      html += `
        <tr>
          <td colspan="4">${inc.note}</td>
          <td colspan="3" class="number bold ${inc.amount >= 0 ? 'highlight-green' : 'highlight-red'}">${formatMoney(inc.amount)}</td>
        </tr>
      `;
    });
    const totalIncurred = incurred.reduce((sum, item) => sum + (item.amount || 0), 0);
    html += `
      <tr class="table-header">
        <td colspan="4" class="bold">Tổng phát sinh tăng/giảm</td>
        <td colspan="3" class="number ${totalIncurred >= 0 ? 'highlight-green' : 'highlight-red'}">${formatMoney(totalIncurred)}</td>
      </tr>
    `;
  }

  // Bảng tổng hợp
  html += `
        <tr><td colspan="7" style="border:none; height:20px;"></td></tr>
        
        <!-- SECTION VI: BẢNG TỔNG HỢP QUYẾT TOÁN -->
        <tr>
          <td colspan="7" class="section-title" style="background-color: #0f172a; color: white;">VI. TỔNG HỢP DOANH THU, CHI PHÍ & LỢI NHUẬN RÒNG</td>
        </tr>
        <tr>
          <td class="label" colspan="3">Doanh thu dự kiến (Báo giá khách)</td>
          <td class="value number bold" colspan="4">${formatMoney(quotation.quoteValue)}</td>
        </tr>
        <tr>
          <td class="label" colspan="3">Doanh thu phụ kiện bán thêm</td>
          <td class="value number bold" colspan="4">${formatMoney(accessorySales)}</td>
        </tr>
        <tr style="background-color: #f8fafc;">
          <td class="label" colspan="3" style="background-color: #e2e8f0; font-size: 11pt;">TỔNG DOANH THU ĐƠN HÀNG (A)</td>
          <td class="value number bold highlight-green" colspan="4" style="font-size: 11pt;">${formatMoney(revenue)}</td>
        </tr>
        <tr>
          <td class="label" colspan="3">Chi phí tiền công thợ thực tế ${order.customLaborCost !== undefined ? '(Kế toán sửa)' : ''}</td>
          <td class="value number highlight-red" colspan="4">${formatMoney(order.customLaborCost !== undefined ? order.customLaborCost : totalLaborCost)}</td>
        </tr>
        <tr>
          <td class="label" colspan="3">Chi phí vật tư sản xuất</td>
          <td class="value number highlight-red" colspan="4">${formatMoney(materialCost)}</td>
        </tr>
        <tr>
          <td class="label" colspan="3">Chi phí nhập phụ kiện ngoài</td>
          <td class="value number highlight-red" colspan="4">${formatMoney(accessoryCost)}</td>
        </tr>
        <tr>
          <td class="label" colspan="3">Chi phí vận chuyển & bốc xếp</td>
          <td class="value number highlight-red" colspan="4">${formatMoney(transport + loader)}</td>
        </tr>
        <tr style="background-color: #fef2f2;">
          <td class="label" colspan="3" style="background-color: #f1f5f9; font-size: 11pt;">TỔNG CHI PHÍ THỰC TẾ (B)</td>
          <td class="value number bold highlight-red" colspan="4" style="font-size: 11pt;">${formatMoney(totalExpenses)}</td>
        </tr>
        <tr style="background-color: ${profit >= 0 ? '#f0fdf4' : '#fef2f2'};">
          <td class="label" colspan="3" style="background-color: #cbd5e1; font-size: 12pt; height: 35px;">LỢI NHUẬN RÒNG ĐƠN HÀNG (A - B)</td>
          <td class="value number bold ${profit >= 0 ? 'highlight-green' : 'highlight-red'}" colspan="4" style="font-size: 13pt;">${formatMoney(profit)} (${profit >= 0 ? 'CÓ LÃI' : 'BỊ THUA LỖ'})</td>
        </tr>
        
        <tr><td colspan="7" style="border:none; height:30px;"></td></tr>
        <tr>
          <td colspan="3" style="border:none; text-align: center; font-style: italic;">Sale phụ trách<br/><br/><br/><b>${order.saleName || '—'}</b></td>
          <td style="border:none;"></td>
          <td colspan="3" style="border:none; text-align: center; font-style: italic;">Người phê duyệt quyết toán<br/><br/><br/><b>Kế toán / Giám đốc</b></td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", url);
  downloadAnchor.setAttribute("download", `GOMITA-DonHang-${order.code}.xls`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
