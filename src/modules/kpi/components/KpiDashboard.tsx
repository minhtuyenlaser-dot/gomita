export function KpiDashboard() {
  return (
    <section className="grid gap-4 rounded-lg border border-gomita-line bg-white p-4">
      <h2 className="text-xl font-black">KPI / Sao động viên</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard title="Tốc độ" score="92%" note="Nhanh hơn trung bình, +1 sao" />
        <KpiCard title="Tiến độ" score="86%" note="Đúng hạn" />
        <KpiCard title="Trả đơn" score="1 lần" note="Theo dõi nguyên nhân" />
      </div>
      <div className="rounded-lg bg-emerald-50 p-4 font-bold text-gomita-green">
        Bạn đang làm nhanh hơn trung bình. Tiếp tục giữ nhịp tốt.
      </div>
      <div className="rounded-lg bg-orange-50 p-4 font-bold text-gomita-orange">
        Nếu một đơn chậm hơn 50%, hệ thống sẽ hỏi “Có khó khăn gì cần hỗ trợ không?” và báo quản lý khi cần.
      </div>
    </section>
  );
}

function KpiCard({ title, score, note }: { title: string; score: string; note: string }) {
  return (
    <div className="rounded-lg border border-gomita-line p-4">
      <div className="text-sm font-bold text-gomita-muted">{title}</div>
      <div className="mt-2 text-2xl font-black">{score}</div>
      <div className="mt-1 text-sm text-gomita-muted">{note}</div>
    </div>
  );
}
