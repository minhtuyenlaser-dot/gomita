import React, { useEffect, useState } from "react";
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
          await loadMobileBootstrap(user.id, savedIp || defaultServerHost);
        }
      } catch (error) {
        console.warn("Lỗi khôi phục phiên đăng nhập:", error);
      } finally {
        setLoading(false);
      }
    }

    void restoreSession();
  }, []);

  async function loadMobileBootstrap(userId: string, targetIp: string) {
    try {
      const response = await fetch(
        getApiUrl(targetIp, `/api/mobile/bootstrap?userId=${encodeURIComponent(userId)}`),
        { headers: { "Cache-Control": "no-cache" } }
      );
      const payload = await response.json();

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || "Không tải được dữ liệu di động.");
      }

      setApiData(payload);
      if (payload?.account) {
        setCurrentUser(payload.account);
        await AsyncStorage.setItem("gomita_user_session", JSON.stringify(payload.account));
      }
    } catch (error) {
      console.warn("Không tải được bootstrap di động, giữ dữ liệu gần nhất.", error);
    }
  }

  const handleLoginSuccess = async (user: any, customIp: string) => {
    setCurrentUser(user);
    setServerIp(customIp);
    setApiData((current: any) => current || {});
    await AsyncStorage.setItem("gomita_user_session", JSON.stringify(user));
    await AsyncStorage.setItem("gomita_server_ip", customIp);
    void loadMobileBootstrap(user.id, customIp);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("gomita_user_session");
    setCurrentUser(null);
    setApiData(null);
  };

  const handleUserChange = async (user: any) => {
    setCurrentUser(user);
    await AsyncStorage.setItem("gomita_user_session", JSON.stringify(user));
    void loadMobileBootstrap(user.id, serverIp);
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
          onUserChange={handleUserChange}
          onRefresh={async () => {
            await loadMobileBootstrap(currentUser.id, serverIp);
          }}
        />
      ) : (
        <LoginScreen defaultIp={serverIp} onLoginSuccess={handleLoginSuccess} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071a38"
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#071a38"
  },
  loadingText: {
    marginTop: 12,
    color: "#cbd5e1",
    fontSize: 15,
    fontWeight: "bold"
  }
});
