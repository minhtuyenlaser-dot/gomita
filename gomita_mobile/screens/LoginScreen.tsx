import React, { useState } from "react";
import {
  StyleSheet,
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView
} from "react-native";
import { Lock, User, Settings, Check } from "lucide-react-native";
import { getApiUrl } from "../lib/api";

export function LoginScreen({ 
  defaultIp, 
  onLoginSuccess 
}: { 
  defaultIp: string; 
  onLoginSuccess: (user: any, serverIp: string) => void 
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverIp, setServerIp] = useState(defaultIp);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setErrorMsg("Vui lòng nhập tài khoản và mật khẩu!");
      return;
    }
    setErrorMsg("");
    setLoading(true);
  
    try {
      const url = getApiUrl(serverIp, "/api/login");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim()
        })
      });

      const resJson = await response.json();
      if (resJson.success) {
        onLoginSuccess(resJson.account, serverIp.trim());
      } else {
        setErrorMsg(resJson.error || "Tài khoản hoặc mật khẩu không chính xác!");
      }
    } catch (err) {
      console.warn("Lỗi kết nối:", err);
      setErrorMsg("Không thể kết nối đến máy chủ GOMITA API! Vui lòng kiểm tra lại địa chỉ IP hoặc Wi-Fi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.headerArea}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>G</Text>
          </View>
          <Text style={styles.brandTitle}>GOMITA MOBILE</Text>
          <Text style={styles.subText}>Hệ thống chấm công di động chuyên dụng</Text>
        </View>

        <View style={styles.formArea}>
          <Text style={styles.formTitle}>Đăng Nhập Hệ Thống</Text>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <User size={20} color="#94a3b8" style={styles.inputIcon} />
            <TextInput 
              style={styles.textInput}
              placeholder="Tên đăng nhập"
              placeholderTextColor="#64748b"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Lock size={20} color="#94a3b8" style={styles.inputIcon} />
            <TextInput 
              style={styles.textInput}
              placeholder="Mật khẩu"
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity 
            style={styles.loginButton} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginButtonText}>ĐĂNG NHẬP</Text>
            )}
          </TouchableOpacity>

          {/* Cấu hình IP Máy chủ di động linh hoạt */}
          <TouchableOpacity 
            style={styles.settingToggle} 
            onPress={() => setShowSettings(!showSettings)}
          >
            <Settings size={16} color="#64748b" />
            <Text style={styles.settingToggleText}>Cấu hình kết nối máy chủ</Text>
          </TouchableOpacity>

          {showSettings && (
            <View style={styles.settingBox}>
              <Text style={styles.settingTitle}>Địa chỉ GOMITA Server (IP:Port):</Text>
              <TextInput 
                style={styles.settingInput}
                placeholder="Ví dụ: 192.168.1.15:3001"
                placeholderTextColor="#64748b"
                value={serverIp}
                onChangeText={setServerIp}
                autoCapitalize="none"
              />
              <Text style={styles.settingHelp}>Nhập địa chỉ IP Wi-Fi của máy tính đang chạy server để kết nối đồng bộ trực tiếp.</Text>
            </View>
          )}
        </View>

        <View style={styles.footerArea}>
          <Text style={styles.footerText}>© 2026 GOMITA CNC. All rights reserved.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071a38",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  headerArea: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#f97316",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 16,
  },
  logoText: {
    fontSize: 40,
    color: "#ffffff",
    fontWeight: "900",
  },
  brandTitle: {
    fontSize: 26,
    color: "#f97316",
    fontWeight: "900",
    letterSpacing: 2,
  },
  subText: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 6,
    fontWeight: "600",
  },
  formArea: {
    backgroundColor: "#0f2547",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1e3a66",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  formTitle: {
    fontSize: 18,
    color: "#f8fafc",
    fontWeight: "900",
    marginBottom: 20,
    textAlign: "center",
  },
  errorBox: {
    backgroundColor: "#7f1d1d",
    borderColor: "#b91c1c",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
    fontWeight: "bold",
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#071a38",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e3a66",
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "bold",
  },
  loginButton: {
    backgroundColor: "#f97316",
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  settingToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    gap: 8,
  },
  settingToggleText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "bold",
  },
  settingBox: {
    backgroundColor: "#071a38",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e3a66",
    padding: 16,
    marginTop: 16,
  },
  settingTitle: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
  },
  settingInput: {
    height: 40,
    backgroundColor: "#0f2547",
    borderColor: "#1e3a66",
    borderWidth: 1,
    borderRadius: 8,
    color: "#f8fafc",
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: "bold",
  },
  settingHelp: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 8,
    lineHeight: 14,
  },
  footerArea: {
    alignItems: "center",
    marginTop: 40,
  },
  footerText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "bold",
  }
});
