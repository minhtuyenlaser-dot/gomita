"use client";

import type { Order, OrderStep } from "@/modules/orders/orderFlow";
import type { UserAccount } from "@/modules/hr/accounts";
import { useState, useMemo } from "react";
import { Plus, Trash2, CalendarCheck, BriefcaseBusiness, ReceiptText, ShieldCheck } from "lucide-react";

export function FinanceDashboard({ 
  orders, 
  setOrders, 
  overtimeRequests = [], 
  accounts = [] 
}: { 
  orders: Order[]; 
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>; 
  overtimeRequests: any[];
  accounts: UserAccount[];
}) {
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? "");
  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId) ?? orders[0], [orders, selectedOrderId]);

  // Form thêm vật tư mới
  const [newMatName, setNewMatName] = useState("");
  const [newMatPrice, setNewMatPrice] = useState(0);

  // Tính giờ làm việc hành chính (bỏ qua nghỉ trưa 11h30-13h30, tối/đêm, Chủ Nhật)
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
        
        // Mốc hành chính Sáng: 7:30 (450p) -> 11:30 (690p)
        // Mốc hành chính Chiều: 13:30 (810p) -> 17:30 (1050p)
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

  // Thêm vật tư mới vào đơn hàng
  function addMaterial() {
    if (!selectedOrder || !newMatName.trim() || newMatPrice <= 0) return;
    const updatedMats = [...(selectedOrder.materialsList || []), { name: newMatName.trim(), price: newMatPrice }];
    setOrders(current => current.map(o => o.id === selectedOrder.id ? { ...o, materialsList: updatedMats } : o));
    setNewMatName("");
    setNewMatPrice(0);
  }

  // Xóa vật tư
  function deleteMaterial(index: number) {
    if (!selectedOrder || !selectedOrder.materialsList) return;
    const updatedMats = selectedOrder.materialsList.filter((_, idx) => idx !== index);
    setOrders(current => current.map(o => o.id === selectedOrder.id ? { ...o, materialsList: updatedMats } : o));
  }

  // Cập nhật phụ kiện ngoài (giá vốn, chi phí thực tế)
  function updateAccessory(index: number, field: "costPrice" | "actualCost", value: number) {
    if (!selectedOrder || !selectedOrder.externalAccessories) return;
    const updatedAccs = selectedOrder.externalAccessories.map((acc, idx) => {
      if (idx === index) {
        return { ...acc, [field]: value };
      }
      return acc;
    });
    setOrders(current => current.map(o => o.id === selectedOrder.id ? { ...o, externalAccessories: updatedAccs } : o));
  }

  // Tính toán số liệu tài chính cho đơn hàng được chọn
  const financeStats = useMemo(() => {
    if (!selectedOrder) return { laborCost: 0, materialCost: 0, accessorySales: 0, accessoryCost: 0, profit: 0, totalWorkdays: 0, logsWithTime: [] };

    // 1. Tính công thợ & tiền công thợ dựa trên log lịch sử các công đoạn và tăng ca
    let totalWorkdays = 0;
    let laborCost = 0;
    const logsWithTime = (selectedOrder.historyLogs || []).map(log => {
      const workingHours = calculateWorkingHours(log.startedAt, log.completedAt);
      
      // Lấy giờ tăng ca được phê duyệt
      const overtimeHours = overtimeRequests
        .filter(req => req.orderCode === selectedOrder.code && req.userDisplayName === log.assignee && req.status === "approved")
        .reduce((sum, req) => sum + (req.hours || 0), 0);

      const totalHours = workingHours + overtimeHours;
      const workdays = totalHours / 8;
      totalWorkdays += workdays;

      // Đơn giá công thợ theo ngày (mặc định 350.000 đ)
      const dayRate = 350000;
      const stepCost = workdays * dayRate;
      laborCost += stepCost;

      return {
        ...log,
        workingHours,
        overtimeHours,
        totalHours,
        workdays: parseFloat(workdays.toFixed(2)),
        cost: stepCost
      };
    });

    // 2. Chi phí vật tư
    const materialCost = (selectedOrder.materialsList || []).reduce((sum, mat) => sum + mat.price, 0);

    // 3. Phụ kiện ngoài
    let accessorySales = 0;
    let accessoryCost = 0;
    (selectedOrder.externalAccessories || []).forEach(acc => {
      if (acc.name.trim()) {
        accessorySales += acc.sellPrice || 0;
        accessoryCost += acc.actualCost || acc.costPrice || 0;
      }
    });

    // 4. Chi phí lắp đặt khác (vận chuyển, bốc vác)
    const transport = selectedOrder.installationCosts?.transport || 0;
    const loader = selectedOrder.installationCosts?.loader || 0;

    // 5. Lợi nhuận
    const revenue = selectedOrder.quotation.quoteValue + accessorySales;
    const totalExpenses = laborCost + materialCost + accessoryCost + transport + loader;
    const profit = revenue - totalExpenses;

    return {
      laborCost,
      materialCost,
      accessorySales,
      accessoryCost,
      profit,
      totalWorkdays: parseFloat(totalWorkdays.toFixed(2)),
      logsWithTime
    };
  }, [selectedOrder, overtimeRequests]);

  return (
    <section className="grid gap-6 text-slate-900">
      {/* 1. Thanh Tổng hợp */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Doanh thu dự kiến</div>
          <div className="mt-2 text-2xl font-black text-blue-600">
            {selectedOrder ? ((selectedOrder.quotation.quoteValue + financeStats.accessorySales).toLocaleString("vi-VN") + " đ") : "0 đ"}
          </div>
          <div className="mt-1 text-xs text-slate-400">Gồm giá báo và phụ kiện ngoài</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Chi phí vật tư</div>
          <div className="mt-2 text-2xl font-black text-orange-600">
            {financeStats.materialCost.toLocaleString("vi-VN")} đ
          </div>
          <div className="mt-1 text-xs text-slate-400">Tổng cộng {selectedOrder?.materialsList?.length || 0} mục vật tư</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Công thợ (bao gồm tăng ca)</div>
          <div className="mt-2 text-2xl font-black text-amber-600">
            {financeStats.laborCost.toLocaleString("vi-VN")} đ
          </div>
          <div className="mt-1 text-xs text-slate-400">Tổng {financeStats.totalWorkdays} ngày công thợ</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Lợi nhuận ròng dự tính</div>
          <div className={`mt-2 text-2xl font-black ${financeStats.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
            {financeStats.profit.toLocaleString("vi-VN")} đ
          </div>
          <div className="mt-1 text-xs text-slate-400">Lãi gộp sau chi phí nhân công, vật tư, phụ kiện</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* 2. Danh sách Đơn Hàng Bên Trái */}
        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm h-[600px] overflow-y-auto">
          <h3 className="mb-4 text-base font-black text-slate-800 flex items-center gap-2">
            <BriefcaseBusiness className="h-5 w-5 text-orange-500" />
            Xem lại toàn bộ đơn hàng
          </h3>
          <div className="grid gap-2">
            {orders.map(order => (
              <button 
                key={order.id} 
                className={`w-full rounded-lg border p-3 text-left transition ${order.id === selectedOrderId ? "border-orange-500 bg-orange-50/50 text-orange-950 font-bold" : "border-slate-100 bg-white hover:bg-slate-50 text-slate-700"}`}
                onClick={() => setSelectedOrderId(order.id)}
                type="button"
              >
                <div className="text-sm font-black">{order.code}</div>
                <div className="mt-1 text-xs text-slate-500">{order.customerName} - {order.area}</div>
                <span className="mt-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{order.step}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* 3. Panel Chi Tiết Theo Dõi & Hạch Toán Bên Phải */}
        {selectedOrder ? (
          <section className="grid gap-6">
            {/* Lịch sử công đoạn & tính giờ làm việc */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-black text-slate-800 flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-green-500" />
                Thời gian thực hiện & Công thợ từng công đoạn
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold">
                      <th className="py-2.5">Công đoạn</th>
                      <th>Người đảm nhận</th>
                      <th>Giờ hành chính</th>
                      <th>Giờ tăng ca</th>
                      <th>Tổng công</th>
                      <th className="text-right">Tiền công dự tính</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financeStats.logsWithTime.map((log, index) => (
                      <tr key={index} className="border-b border-slate-100 text-slate-700">
                        <td className="py-3 font-bold">{log.step}</td>
                        <td className="font-semibold text-slate-900">{log.assignee}</td>
                        <td>{log.workingHours} giờ</td>
                        <td className={log.overtimeHours > 0 ? "font-bold text-orange-600" : ""}>{log.overtimeHours} giờ</td>
                        <td className="font-bold">{log.workdays} công</td>
                        <td className="text-right font-black text-slate-900">{(log.cost || 0).toLocaleString("vi-VN")} đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quản lý vật tư thực tế */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-black text-slate-800 flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-orange-500" />
                Chi tiết vật tư & Chi phí lắp đặt phụ
              </h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-600 mb-2">Thêm vật tư mới</h4>
                  <div className="flex gap-2">
                    <input 
                      className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 outline-none" 
                      placeholder="Tên vật tư (Vd: Bản lề, Gỗ, Ván...)" 
                      value={newMatName} 
                      onChange={e => setNewMatName(e.target.value)}
                    />
                    <input 
                      className="h-10 w-28 rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 outline-none" 
                      type="number" 
                      placeholder="Giá tiền" 
                      value={newMatPrice || ""} 
                      onChange={e => setNewMatPrice(Number(e.target.value))}
                    />
                    <button className="h-10 w-10 grid place-items-center rounded-lg bg-orange-500 text-white font-bold" onClick={addMaterial} type="button">
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-4 grid gap-2 max-h-48 overflow-y-auto">
                    {(!selectedOrder.materialsList || selectedOrder.materialsList.length === 0) ? (
                      <div className="text-slate-400 text-sm italic">Chưa có vật tư được ghi nhận.</div>
                    ) : (
                      selectedOrder.materialsList.map((mat, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-sm">
                          <div>
                            <span className="font-bold">{mat.name}</span>
                          </div>
                          <div className="flex items-center gap-3 font-black">
                            {mat.price.toLocaleString("vi-VN")} đ
                            <button className="text-red-500 hover:text-red-700" onClick={() => deleteMaterial(idx)} type="button">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="border-l border-slate-100 pl-6">
                  <h4 className="font-bold text-sm text-slate-600 mb-3">Chi phí Lắp đặt bổ sung (Giám sát nhập)</h4>
                  <div className="grid gap-4">
                    <div className="flex justify-between items-center rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                      <span className="font-bold text-sm text-slate-700">Tiền vận chuyển</span>
                      <span className="font-black text-slate-900">{(selectedOrder.installationCosts?.transport || 0).toLocaleString("vi-VN")} đ</span>
                    </div>
                    <div className="flex justify-between items-center rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                      <span className="font-bold text-sm text-slate-700">Tiền bốc vác</span>
                      <span className="font-black text-slate-900">{(selectedOrder.installationCosts?.loader || 0).toLocaleString("vi-VN")} đ</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">● Các chi phí lắp đặt phụ này do Giám sát nhập khi lập checklist nghiệm thu.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Phụ kiện ngoài & Hạch toán giá vốn */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-2 text-lg font-black text-slate-800 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-500" />
                Hạch toán Phụ kiện ngoài (Kế toán nhập giá vốn)
              </h3>
              <p className="text-xs text-slate-500 mb-4">Các phụ kiện do phòng Sale khai báo tại bước Báo giá. Kế toán nhập Giá vốn và Chi phí thực tế để hạch toán lãi lỗ chính xác.</p>
              
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="py-2.5 px-3">Tên phụ kiện</th>
                      <th>Giá bán (khách)</th>
                      <th>Giá vốn (Kế toán nhập)</th>
                      <th className="pr-3">Chi phí thực tế (Kế toán nhập)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!selectedOrder.externalAccessories || selectedOrder.externalAccessories.filter(a => a.name.trim()).length === 0) ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400 italic">Không có phụ kiện ngoài nào được khai báo trong đơn hàng này.</td>
                      </tr>
                    ) : (
                      selectedOrder.externalAccessories.map((acc, idx) => {
                        if (!acc.name.trim()) return null;
                        return (
                          <tr key={idx} className="border-b border-slate-100 text-slate-700">
                            <td className="py-2.5 px-3 font-bold">{acc.name}</td>
                            <td className="font-black text-blue-600">{acc.sellPrice.toLocaleString("vi-VN")} đ</td>
                            <td>
                              <input 
                                className="h-9 w-32 rounded-lg border border-slate-200 px-2 font-black outline-none focus:border-indigo-500" 
                                type="number" 
                                value={acc.costPrice || ""} 
                                onChange={e => updateAccessory(idx, "costPrice", Number(e.target.value))}
                                placeholder="Giá vốn"
                              />
                            </td>
                            <td className="pr-3">
                              <input 
                                className="h-9 w-32 rounded-lg border border-slate-200 px-2 font-black outline-none focus:border-indigo-500" 
                                type="number" 
                                value={acc.actualCost || ""} 
                                onChange={e => updateAccessory(idx, "actualCost", Number(e.target.value))}
                                placeholder="CP thực tế"
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500 bg-white">Không có đơn hàng nào được chọn.</div>
        )}
      </div>
    </section>
  );
}
