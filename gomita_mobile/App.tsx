import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  StyleSheet,
  ActivityIndicator, 
  View, 
  Text,
  StatusBar
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { defaultServerHost, getApiUrl } from "./lib/api";
import { LoginScreen } from "./screens/LoginScreen";
import { WorkerDashboard } from "./screens/WorkerDashboard";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [serverIp, setServerIp] = useState(defaultServerHost);
  const [apiData, setApiData] = useState<any>(null);

  // Khôi phục session đăng nhập và server IP
  useEffect(() => {
    async function restoreSession() {
      try {
        const savedIp = await AsyncStorage.getItem("gomita_server_ip");
        if (savedIp) {
          setServerIp(savedIp);
        }

        const savedUser = await AsyncStorage.getItem("gomita_user_session");
        if (savedUser) {
          const user = JSON.parse(savedUser);
          setCurrentUser(user);
          await syncWithServer(user.id, savedIp || serverIp);
        }
      } catch (err) {
        console.warn("Lỗi khôi phục phiên đăng nhập:", err);
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  async function syncWithServer(userId: string, targetIp: string) {
    try {
      const url = getApiUrl(targetIp, "/api/data");
      const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
      const data = await res.json();
      setApiData(data);
      
      // Đồng bộ thông tin cá nhân mới nhất của user
      const freshUser = data.accounts.find((acc: any) => acc.id === userId);
      if (freshUser) {
        setCurrentUser(freshUser);
        await AsyncStorage.setItem("gomita_user_session", JSON.stringify(freshUser));
      }
    } catch (err) {
      console.warn("Không kết nối được server, đang dùng chế độ Offline.", err);
    }
  }

  const handleLoginSuccess = async (user: any, customIp: string) => {
    setCurrentUser(user);
    setServerIp(customIp);
    await AsyncStorage.setItem("gomita_user_session", JSON.stringify(user));
    await AsyncStorage.setItem("gomita_server_ip", customIp);
    setLoading(true);
    await syncWithServer(user.id, customIp);
    setLoading(false);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("gomita_user_session");
    setCurrentUser(null);
    setApiData(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Đang tải GOMITA...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#071a38" />
      {currentUser ? (
        <WorkerDashboard 
          user={currentUser} 
          serverIp={serverIp} 
          apiData={apiData}
          onLogout={handleLogout}
          onRefresh={async () => {
            await syncWithServer(currentUser.id, serverIp);
          }}
        />
      ) : (
        <LoginScreen 
          defaultIp={serverIp}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071a38",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#071a38",
  },
  loadingText: {
    marginTop: 12,
    color: "#cbd5e1",
    fontSize: 15,
    fontWeight: "bold",
  }
});
