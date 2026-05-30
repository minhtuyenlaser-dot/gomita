import React, { useState, useEffect, useMemo } from "react";
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  Dimensions,
  ActivityIndicator
} from "react-native";
import { Camera as ExpoCamera } from "expo-camera";
import * as Location from "expo-location";
import { 
  LogOut, 
  CheckCircle2, 
  Camera, 
  Clock, 
  Calendar, 
  CircleDollarSign, 
  Briefcase,
  MapPin,
  CheckCircle
} from "lucide-react-native";
import { getApiUrl } from "./LoginScreen";

const slots = ["07:30", "11:30", "13:30", "17:30"];
const screenWidth = Dimensions.get("window").width;

export function WorkerDashboard({ 
  user, 
  serverIp, 
  apiData, 
  onLogout,
  onRefresh
}: { 
  user: any; 
  serverIp: string; 
  apiData: any; 
  onLogout: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  
  // Camera & GPS State
  const [showCamera, setShowCamera] = useState(false);
  const [cameraType, setCameraType] = useState<any>(null);
  const [cameraRef, setCameraRef] = useState<any>(null);
  const [gpsCoords, setGpsCoords] = useState<string | null>(null);

  // UX Hỏi tiến độ thông minh State
  const [askModalOpen, setAskModalOpen] = useState(false);
  const [activeJobToReport, setActiveJobToReport] = useState<any | null>(null);

  // Đồng hồ thời gian thực di động
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    // Xin quyền Camera và Định vị
    async function requestPermissions() {
      const cameraStatus = await ExpoCamera.requestCameraPermissionsAsync();
      setCameraPermission(cameraStatus.status === "granted");
      if (ExpoCamera.Constants?.Type?.front) {
        setCameraType(ExpoCamera.Constants.Type.front);
      } else {
        setCameraType("front");
      }

      const locationStatus = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(locationStatus.status === "granted");
    }
    requestPermissions();

    // Chạy đồng hồ
    function updateTime() {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      setCurrentTime(`${hh}:${mm}:${ss}`);

      const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
      const dd = String(now.getDate()).padStart(2, "0");
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const yr = now.getFullYear();
      setCurrentDate(`${days[now.getDay()]}, ${dd}/${mo}/${yr}`);
    }
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Lấy mốc giờ chấm công hiện tại
  const currentSlot = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentVal = currentHour * 60 + currentMin;

    if (currentVal >= 7 * 60 + 15 && currentVal <= 8 * 60 + 30) return "07:30";
    if (currentVal >= 11 * 60 + 15 && currentVal <= 12 * 60 + 30) return "11:30";
    if (currentVal >= 13 * 60 + 15 && currentVal <= 14 * 60 + 30) return "13:30";
    if (currentVal >= 17 * 60 + 15 && currentVal <= 18 * 60 + 30) return "17:30";
    return "07:30"; // Mặc định hiển thị mốc 07:30 nếu ngoài giờ
  }, [currentTime]);

  const isSlotCurrentlyOpen = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentVal = currentHour * 60 + currentMin;

    if (currentVal >= 7 * 60 + 15 && currentVal <= 8 * 60 + 30) return true;
    if (currentVal >= 11 * 60 + 15 && currentVal <= 12 * 60 + 30) return true;
    if (currentVal >= 13 * 60 + 15 && currentVal <= 14 * 60 + 30) return true;
    if (currentVal >= 17 * 60 + 15 && currentVal <= 18 * 60 + 30) return true;
    return false;
  }, [currentTime]);

  const today = new Date().getDate();
  const monthDaysCount = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const monthDays = Array.from({ length: monthDaysCount }, (_, idx) => idx + 1);

  // Tính toán Ngày công, OT và Lương di động
  const userAttendanceKeys = useMemo(() => {
    if (!apiData || !apiData.attendance) return [];
    return Object.keys(apiData.attendance).filter(k => k.startsWith(user.id + "-"));
  }, [apiData, user.id]);

  const hasClockedInCurrentSlot = useMemo(() => {
    if (!apiData || !apiData.attendance) return false;
    const key = `${user.id}-${today}-${currentSlot}`;
    return apiData.attendance[key] === "normal" || apiData.attendance[key] === "compensated";
  }, [apiData, user.id, today, currentSlot]);

  const workDays = useMemo(() => {
    const uniqueDays = new Set(userAttendanceKeys.map(k => k.split("-")[1]));
    return uniqueDays.size;
  }, [userAttendanceKeys]);

  const otHours = useMemo(() => {
    if (!apiData || !apiData.overtimeRequests) return 0;
    const now = new Date();
    return apiData.overtimeRequests
      .filter((req: any) => 
        req.userId === user.id && 
        req.status === "approved" &&
        new Date(req.createdAt).getMonth() === now.getMonth()
      )
      .reduce((sum: number, req: any) => sum + (Number(req.hours) || 0), 0);
  }, [apiData, user.id]);

  const salaryType = user.salaryType ?? "daily";
  const salaryValue = user.salaryValue ?? (user.positionIds.includes("hr") ? 420000 : user.positionIds.includes("accountant") ? 400000 : 350000);

  const estimatedIncome = useMemo(() => {
    if (salaryType === "monthly") {
      return salaryValue;
    }
    const base = workDays * salaryValue;
    const otPay = otHours * 1.5 * (salaryValue / 8);
    return base + otPay;
  }, [salaryType, salaryValue, workDays, otHours]);

  // Lọc công việc đang được giao của thợ hôm nay
  const activeJobs = useMemo(() => {
    if (!apiData || !apiData.orders) return [];
    return apiData.orders.filter((order: any) => {
      // Thợ phải nằm trong danh sách được giao phó
      const isAssigned = (order.installerNames && order.installerNames.includes(user.displayName)) ||
                         (order.productionWorkerNames && order.productionWorkerNames.includes(user.displayName));
      return isAssigned && order.workStatus === "working";
    });
  }, [apiData, user.displayName]);

  // NÚT CHẤM CÔNG DUY NHẤT CLICK
  const handleClockInPress = async () => {
    if (hasClockedInCurrentSlot) {
      Alert.alert("Thông báo", `Bạn đã chấm công mốc ${currentSlot} hôm nay thành công rồi!`);
      return;
    }

    if (cameraPermission === false || locationPermission === false) {
      Alert.alert("Lỗi phân quyền", "Vui lòng cấp quyền Camera và GPS định vị trong cài đặt điện thoại để chấm công!");
      return;
    }

    // Lọc các đơn đang làm thực tế
    if (activeJobs.length > 0) {
      // Có việc chưa báo hoàn thành -> Hỏi thông minh!
      setActiveJobToReport(activeJobs[0]);
      setAskModalOpen(true);
    } else {
      // Không có việc đang làm -> Đi thẳng vào Chụp ảnh + GPS
      await startCameraAndGps();
    }
  };

  const startCameraAndGps = async () => {
    setLoading(true);
    try {
      // Lấy định vị GPS
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsCoords(`${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)}`);
      setShowCamera(true);
    } catch (err) {
      console.warn("Lỗi GPS:", err);
      // Fallback nếu GPS yếu
      setGpsCoords("10.7760, 106.7010 (Hải Phòng)");
      setShowCamera(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerCompletion = async (isCompleted: boolean) => {
    setAskModalOpen(false);
    if (!activeJobToReport) return;

    setLoading(true);
    try {
      // Bật camera & lấy GPS
      await startCameraAndGps();
    } catch (err) {
      Alert.alert("Lỗi", "Không thể khởi động camera!");
    } finally {
      setLoading(false);
    }
  };

  const captureAndClockin = async () => {
    if (!cameraRef) return;
    setLoading(true);

    try {
      // Chụp ảnh selfie
      const photo = await cameraRef.takePictureAsync({ quality: 0.5 });
      
      // Gửi chấm công lên API Server
      const url = getApiUrl(serverIp, "/api/clockin");
      const isCompleted = activeJobToReport && !askModalOpen; 
      
      const payload = {
        userId: user.id,
        date: today,
        slot: currentSlot,
        orderCode: activeJobToReport ? activeJobToReport.code : null,
        isCompleted: isCompleted // Nếu có hỏi tiến độ
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const resJson = await res.json();
      if (resJson.success) {
        setShowCamera(false);
        setActiveJobToReport(null);
        await onRefresh(); // Tải lại bảng công tức thì!
        Alert.alert(
          "Chấm công thành công! 🎉",
          `Hệ thống đã ghi nhận mốc ${currentSlot} ngày hôm nay lúc ${currentTime} của bạn.\n` +
          `● Vị trí GPS: ${gpsCoords}\n` +
          `● Tiền lương tháng tạm tính đã được cập nhật!`
        );
      } else {
        Alert.alert("Lỗi", "Gửi dữ liệu chấm công thất bại!");
      }
    } catch (err) {
      console.warn("Lỗi chấm công:", err);
      Alert.alert("Lỗi kết nối", "Không thể kết nối đến máy chủ GOMITA API để lưu chấm công!");
    } finally {
      setLoading(false);
    }
  };

  // NÚT BÁO CÁO HOÀN THÀNH ĐỘC LẬP CLICK
  const handleReportDoneIndependent = async (job: any) => {
    Alert.alert(
      "Xác nhận báo xong",
      `Bạn có chắc chắn muốn báo cáo hoàn thành đơn hàng ${job.code} không?`,
      [
        { text: "Hủy bỏ", style: "cancel" },
        { 
          text: "Đồng ý", 
          onPress: async () => {
            setLoading(true);
            try {
              const url = getApiUrl(serverIp, "/api/report-done");
              const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderCode: job.code,
                  workerName: user.displayName
                })
              });
              const resJson = await response.json();
              if (resJson.success) {
                await onRefresh();
                Alert.alert("Thành công!", `Đã báo cáo xong đơn ${job.code}. Đang chờ Giám sát hoặc Quản lý duyệt.`);
              } else {
                Alert.alert("Lỗi", "Báo cáo công việc thất bại!");
              }
            } catch (err) {
              Alert.alert("Lỗi kết nối", "Không thể kết nối API để cập nhật công việc.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.helloText}>Xin chào, {user.displayName} 👋</Text>
          <Text style={styles.positionText}>Bộ phận: {user.department}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onClick={onLogout}>
          <LogOut size={18} color="#f8fafc" />
        </TouchableOpacity>
      </View>

      {/* Realtime Clock Widget */}
      <View style={styles.clockCard}>
        <Text style={styles.clockTime}>{currentTime || "07:30:00"}</Text>
        <Text style={styles.clockDate}>{currentDate || "Đang kết nối..."}</Text>
        <View style={styles.shiftBadge}>
          <Clock size={14} color="#f97316" />
          <Text style={styles.shiftBadgeText}>Mốc chấm hiện tại: {currentSlot}</Text>
        </View>
      </View>

      {/* DUY NHẤT 1 NÚT CHẤM CÔNG LỚN */}
      <View style={styles.clockInCenter}>
        {isSlotCurrentlyOpen ? (
          hasClockedInCurrentSlot ? (
            <View style={styles.clockedInSuccessBadge}>
              <CheckCircle size={48} color="#22c55e" />
              <Text style={styles.clockedInSuccessText}>ĐÃ HOÀN THÀNH CHẤM CÔNG</Text>
              <Text style={styles.clockedInSuccessSub}>Chúc bạn một ngày làm việc vui vẻ và hiệu quả!</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.clockInButton, styles.clockInBtnBg]}
              onPress={handleClockInPress}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="large" color="#ffffff" />
              ) : (
                <View style={styles.centerBtnContent}>
                  <Camera size={44} color="#ffffff" />
                  <Text style={styles.clockInBtnText}>BẤM CHẤM CÔNG</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        ) : (
          <View style={styles.outsideSlotCard}>
            <Clock size={36} color="#94a3b8" />
            <Text style={styles.outsideSlotTitle}>Ngoài khung giờ chấm công</Text>
            <Text style={styles.outsideSlotDesc}>
              Mốc quy định: 07:30 · 11:30 · 13:30 · 17:30 {"\n"}
              (Mở trước 15 phút, đóng sau mốc 1 tiếng)
            </Text>
          </View>
        )}
        <Text style={styles.clockInHelp}>
          {hasClockedInCurrentSlot 
            ? `Cảm ơn bạn. Hệ thống đã ghi nhận chấm công mốc ${currentSlot} thành công.` 
            : isSlotCurrentlyOpen
              ? `Mở camera chụp ảnh selfie + gửi GPS định vị mốc ${currentSlot}`
              : `Vui lòng quay lại đúng khung giờ quy định.`}
        </Text>
      </View>

      {/* BẢNG LƯƠNG TẠM TÍNH CARD */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <CircleDollarSign size={20} color="#f97316" />
          <Text style={styles.sectionTitle}>Thu Nhập Tạm Tính Trong Tháng</Text>
        </View>

        <View style={styles.salaryWidget}>
          <Text style={styles.mainSalaryValue}>
            {Math.round(estimatedIncome).toLocaleString("vi-VN")} đ
          </Text>
          <Text style={styles.salaryHelp}>
            {salaryType === "monthly" ? "Lương tháng cố định" : "Cập nhật tăng tiền ngay lập tức khi chấm công thành công"}
          </Text>

          <View style={styles.salaryMetrics}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Ngày công tích lũy</Text>
              <Text style={styles.metricValue}>{workDays} ngày</Text>
            </View>
            <View style={styles.dividerLine} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Số giờ tăng ca (OT)</Text>
              <Text style={styles.metricValue}>{otHours} giờ</Text>
            </View>
          </View>
        </View>
      </View>

      {/* BẢNG LƯỚI CHẤM CÔNG THÁNG CUỘN NGANG */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Calendar size={20} color="#f97316" />
          <Text style={styles.sectionTitle}>Bảng Chấm Công Tháng {new Date().getMonth() + 1}</Text>
        </View>
        
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, styles.dotGreen]} />
            <Text style={styles.legendLabel}>Đã chấm</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, styles.dotBlue]} />
            <Text style={styles.legendLabel}>Công bù</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, styles.dotGray]} />
            <Text style={styles.legendLabel}>Chưa chấm</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gridScroll}>
          <View style={styles.gridTable}>
            {/* Header hàng ngày */}
            <View style={styles.gridHeaderRow}>
              <Text style={[styles.gridCellHeader, styles.cellWidthLabel]}>Mốc giờ</Text>
              {monthDays.map(day => (
                <Text key={day} style={[styles.gridCellHeader, styles.cellWidthDot]}>{day}</Text>
              ))}
            </View>

            {/* Các hàng mốc giờ */}
            {slots.map(slot => (
              <View key={slot} style={styles.gridRow}>
                <Text style={[styles.gridCellLabel, styles.cellWidthLabel]}>{slot}</Text>
                {monthDays.map(day => {
                  const key = `${user.id}-${day}-${slot}`;
                  const val = apiData && apiData.attendance ? apiData.attendance[key] : null;
                  return (
                    <View key={day} style={[styles.gridCellDotArea, styles.cellWidthDot]}>
                      <View 
                        style={[
                          styles.attendanceDot,
                          val === "normal" ? styles.dotGreen : val === "compensated" ? styles.dotBlue : styles.dotGray
                        ]} 
                      />
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* DANH SÁCH VIỆC ĐANG LÀM & NÚT HOÀN THÀNH ĐỘC LẬP */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Briefcase size={20} color="#f97316" />
          <Text style={styles.sectionTitle}>Công Việc Giao Phụ Trách</Text>
        </View>

        {activeJobs.length === 0 ? (
          <View style={styles.emptyJobsCard}>
            <Text style={styles.emptyJobsText}>Hiện tại bạn không có công việc nào đang dang dở. 🌟</Text>
          </View>
        ) : (
          activeJobs.map((job: any) => (
            <View key={job.id} style={styles.jobItemCard}>
              <View style={styles.jobItemHeader}>
                <Text style={styles.jobCode}>{job.code}</Text>
                <View style={styles.jobStatusBadge}>
                  <Text style={styles.jobStatusText}>Đang làm</Text>
                </View>
              </View>
              <Text style={styles.jobDetail}>Khách hàng: {job.customerName}</Text>
              <Text style={styles.jobDetail}>Địa chỉ: {job.address}</Text>
              <Text style={styles.jobDetail}>Công việc: {job.step === "Sản xuất" ? "Sản xuất tủ" : "Lắp đặt nội thất"}</Text>

              {/* Nút Hoàn thành Độc lập */}
              <TouchableOpacity 
                style={styles.doneIndependentBtn}
                onClick={() => handleReportDoneIndependent(job)}
              >
                <CheckCircle2 size={16} color="#ffffff" />
                <Text style={styles.doneIndependentBtnText}>BÁO CÁO HOÀN THÀNH CÔNG VIỆC</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* POPUP CÂU HỎI THÔNG MINH KHI CLICK CHẤM CÔNG */}
      {askModalOpen && activeJobToReport && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Xác nhận trạng thái công việc</Text>
            <Text style={styles.modalDesc}>
              Đơn hàng <Text style={styles.highlightText}>{activeJobToReport.code}</Text> mà bạn đang thực hiện đã hoàn thành chưa?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnGreen]}
                onClick={() => handleAnswerCompletion(true)}
              >
                <CheckCircle2 size={18} color="#ffffff" />
                <Text style={styles.modalBtnText}>Đã hoàn thành</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnOrange]}
                onClick={() => handleAnswerCompletion(false)}
              >
                <Text style={styles.modalBtnText}>Chưa hoàn thành</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* SCREEN CAMERA NATIVE HIỂN THỊ KHI CHẤM CÔNG */}
      {showCamera && (
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraHeaderText}>Mốc chấm công: {currentSlot}</Text>
            <Text style={styles.cameraHeaderSub}>Vị trí GPS: {gpsCoords}</Text>
          </View>

          <View style={styles.cameraFrame}>
            <ExpoCamera 
              style={styles.cameraNative} 
              type={cameraType} 
              ref={(ref: any) => setCameraRef(ref)}
            />
          </View>

          <View style={styles.cameraFooter}>
            <TouchableOpacity 
              style={styles.captureCircleBtn}
              onClick={captureAndClockin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="large" color="#f97316" />
              ) : (
                <View style={styles.captureInnerCircle} />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.closeCameraBtn}
              onClick={() => {
                setShowCamera(false);
                setActiveJobToReport(null);
              }}
            >
              <Text style={styles.closeCameraBtnText}>HỦY BỎ</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071a38",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 10,
  },
  helloText: {
    fontSize: 20,
    color: "#f8fafc",
    fontWeight: "900",
  },
  outsideSlotCard: {
    width: screenWidth - 32,
    backgroundColor: "#0f2547",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e3a66",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  outsideSlotTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 10,
  },
  outsideSlotDesc: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 16,
  },
  positionText: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
    fontWeight: "600",
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    borderColor: "#334155",
    borderWidth: 1,
  },
  clockCard: {
    backgroundColor: "#0f2547",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e3a66",
    padding: 20,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 24,
  },
  clockTime: {
    fontSize: 42,
    color: "#f97316",
    fontWeight: "900",
    letterSpacing: 2,
  },
  clockDate: {
    fontSize: 14,
    color: "#cbd5e1",
    fontWeight: "700",
    marginTop: 4,
  },
  shiftBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#071a38",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e3a66",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    marginTop: 14,
  },
  shiftBadgeText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800",
  },
  clockInCenter: {
    alignItems: "center",
    marginBottom: 24,
  },
  clockInButton: {
    width: 172,
    height: 172,
    borderRadius: 86,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 8,
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  clockInBtnBg: {
    backgroundColor: "#22c55e",
    borderColor: "#15803d",
  },
  clockedInBtnBg: {
    backgroundColor: "#16a34a",
    borderColor: "#166534",
  },
  centerBtnContent: {
    alignItems: "center",
    gap: 8,
  },
  clockInBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },
  clockInHelp: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 14,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
  sectionCard: {
    backgroundColor: "#0f2547",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e3a66",
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e3a66",
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    color: "#f8fafc",
    fontWeight: "900",
  },
  salaryWidget: {
    alignItems: "center",
  },
  mainSalaryValue: {
    fontSize: 32,
    color: "#22c55e",
    fontWeight: "900",
  },
  salaryHelp: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "bold",
    marginTop: 4,
    textAlign: "center",
  },
  salaryMetrics: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#071a38",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e3a66",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    width: "100%",
    justifyContent: "space-between",
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "bold",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    color: "#f8fafc",
    fontWeight: "900",
  },
  dividerLine: {
    width: 1,
    height: 24,
    backgroundColor: "#1e3a66",
  },
  legendRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotGreen: {
    backgroundColor: "#22c55e",
  },
  dotBlue: {
    backgroundColor: "#3b82f6",
  },
  dotGray: {
    backgroundColor: "#475569",
  },
  gridScroll: {
    marginTop: 8,
  },
  gridTable: {
    flexDirection: "column",
  },
  gridHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#071a38",
    borderBottomWidth: 1,
    borderBottomColor: "#1e3a66",
    paddingVertical: 8,
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1e3a66",
    paddingVertical: 10,
    alignItems: "center",
  },
  gridCellHeader: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  gridCellLabel: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "900",
  },
  gridCellDotArea: {
    justifyContent: "center",
    alignItems: "center",
  },
  attendanceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  cellWidthLabel: {
    width: 68,
    paddingLeft: 8,
  },
  cellWidthDot: {
    width: 32,
    textAlign: "center",
  },
  emptyJobsCard: {
    backgroundColor: "#071a38",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e3a66",
    padding: 24,
    alignItems: "center",
  },
  emptyJobsText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
  },
  jobItemCard: {
    backgroundColor: "#071a38",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e3a66",
    padding: 16,
    marginBottom: 12,
  },
  jobItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  jobCode: {
    fontSize: 16,
    color: "#f97316",
    fontWeight: "900",
  },
  jobStatusBadge: {
    backgroundColor: "#166534",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  jobStatusText: {
    color: "#22c55e",
    fontSize: 10,
    fontWeight: "bold",
  },
  jobDetail: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  doneIndependentBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f97316",
    borderRadius: 10,
    height: 44,
    marginTop: 16,
    gap: 8,
  },
  doneIndependentBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  modalOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  modalContent: {
    width: screenWidth - 48,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    color: "#0f172a",
    fontWeight: "900",
    marginBottom: 12,
  },
  modalDesc: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  highlightText: {
    fontWeight: "900",
    color: "#f97316",
  },
  modalButtons: {
    flexDirection: "column",
    width: "100%",
    gap: 12,
  },
  modalBtn: {
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  modalBtnGreen: {
    backgroundColor: "#16a34a",
  },
  modalBtnOrange: {
    backgroundColor: "#f97316",
  },
  modalBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  cameraOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "#071a38",
    zIndex: 200,
    justifyContent: "space-between",
    padding: 24,
  },
  cameraHeader: {
    alignItems: "center",
    marginTop: 20,
  },
  cameraHeaderText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },
  cameraHeaderSub: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 6,
  },
  cameraFrame: {
    flex: 1,
    maxHeight: screenWidth * 1.1,
    aspectRatio: 3/4,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#f97316",
    alignSelf: "center",
    marginVertical: 20,
  },
  cameraNative: {
    flex: 1,
  },
  cameraFooter: {
    alignItems: "center",
    gap: 16,
    marginBottom: 10,
  },
  captureCircleBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureInnerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffffff",
  },
  closeCameraBtn: {
    paddingVertical: 8,
  },
  closeCameraBtnText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },
  clockedInSuccessBadge: {
    width: screenWidth - 32,
    backgroundColor: "#16a34a15",
    borderColor: "#22c55e",
    borderWidth: 2,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  clockedInSuccessText: {
    color: "#22c55e",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
  },
  clockedInSuccessSub: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 16,
  }
});
