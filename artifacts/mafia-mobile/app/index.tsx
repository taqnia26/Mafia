import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { Feather } from "@expo/vector-icons";

const SITE_URL = "https://mafia.ntaqnia.com/";
const ALLOWED_HOSTS = ["mafia.ntaqnia.com", "ntaqnia.com", "clerk.com", "accounts.dev"];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const currentUrlRef = useRef<string>(SITE_URL);

  // Android hardware back button → WebView back
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (canGoBack && webRef.current) {
          webRef.current.goBack();
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [canGoBack]),
  );

  const handleNavChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    currentUrlRef.current = nav.url;
  }, []);

  const handleShouldStartLoad = useCallback((req: { url: string }) => {
    try {
      const u = new URL(req.url);
      return ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
    } catch {
      return true;
    }
  }, []);

  const reload = useCallback(() => {
    setError(null);
    setLoading(true);
    webRef.current?.reload();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    webRef.current?.reload();
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  if (error) {
    return (
      <ScrollView
        style={styles.errorWrap}
        contentContainerStyle={[styles.errorContent, { paddingTop: insets.top + 80 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />}
      >
        <Feather name="wifi-off" size={56} color="#dc2626" />
        <Text style={styles.errorTitle}>تعذّر الاتصال</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={reload}>
          <Feather name="refresh-cw" size={18} color="#fff" />
          <Text style={styles.retryText}>إعادة المحاولة</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <WebView
        ref={webRef}
        source={{ uri: SITE_URL }}
        style={styles.webview}
        containerStyle={{ backgroundColor: "#0a0a0a" }}
        startInLoadingState
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={handleNavChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onError={(e) => {
          setLoading(false);
          setError(e.nativeEvent.description ?? "خطأ غير معروف");
        }}
        onHttpError={(e) => {
          const code = e.nativeEvent.statusCode;
          if (code >= 500) setError(`خطأ في السيرفر (${code})`);
        }}
        pullToRefreshEnabled
        allowsBackForwardNavigationGestures
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        cacheEnabled
        mixedContentMode="compatibility"
        originWhitelist={["https://*", "http://*"]}
        userAgent={Platform.OS === "android"
          ? "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 MafiaWorld/1.0"
          : undefined}
      />
      {loading && (
        <View style={styles.loaderOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#dc2626" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  webview: { flex: 1, backgroundColor: "#0a0a0a" },
  loaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0a0a0aE6",
  },
  errorWrap: { flex: 1, backgroundColor: "#0a0a0a" },
  errorContent: { alignItems: "center", paddingHorizontal: 32, gap: 14 },
  errorTitle: { fontSize: 24, fontWeight: "700", color: "#fafafa", marginTop: 8 },
  errorMsg: { fontSize: 15, color: "#a3a3a3", textAlign: "center" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#dc2626",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  retryText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
