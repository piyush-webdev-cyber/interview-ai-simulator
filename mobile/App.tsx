import "./global.css";

import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import * as Linking from "expo-linking";
import { completeSupabaseSessionFromUrl } from "./src/lib/supabase";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
  const url = Linking.useURL();

  useEffect(() => {
    if (!url) return;

    completeSupabaseSessionFromUrl(url).catch((error) => {
      console.warn("Could not complete Supabase deep-link session", error);
    });
  }, [url]);

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <AppNavigator />
    </NavigationContainer>
  );
}
