import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { BarChart3, FileSearch, Home, UserCircle2, UserRoundSearch } from "lucide-react-native";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { FeedbackScreen } from "@/screens/FeedbackScreen";
import { InterviewScreen } from "@/screens/InterviewScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { PracticeInterviewScreen } from "@/screens/PracticeInterviewScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { ProgressScreen } from "@/screens/ProgressScreen";
import { ResumeAnalyzerScreen } from "@/screens/ResumeAnalyzerScreen";
import { RoleSelectionScreen } from "@/screens/RoleSelectionScreen";
import { SignupScreen } from "@/screens/SignupScreen";
import { SplashScreen } from "@/screens/SplashScreen";
import { colors } from "@/theme";
import type { InterviewMode } from "@/types/interview";

export type RootStackParamList = {
  Splash: undefined;
  Signup: undefined;
  Login: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  RoleSelection: { mode?: InterviewMode; role?: string } | undefined;
  Interview: undefined;
  PracticeInterview: undefined;
  Feedback: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Roles: { mode?: InterviewMode; role?: string } | undefined;
  PracticeInterview: undefined;
  Interview: undefined;
  Progress: undefined;
  Resume: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="Roles"
        component={RoleSelectionScreen}
        options={{ tabBarIcon: ({ color, size }) => <UserRoundSearch color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="PracticeInterview"
        component={PracticeInterviewScreen}
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="Interview"
        component={InterviewScreen}
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="Resume"
        component={ResumeAnalyzerScreen}
        options={{ tabBarIcon: ({ color, size }) => <FileSearch color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <UserCircle2 color={color} size={size} /> }}
      />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="Interview" component={InterviewScreen} />
      <Stack.Screen name="PracticeInterview" component={PracticeInterviewScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
    </Stack.Navigator>
  );
}
