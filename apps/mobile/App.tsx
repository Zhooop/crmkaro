import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { colors } from "./src/theme/colors";
import { Icon } from "./src/components/Icon";

// Screens
import { LoginScreen } from "./src/screens/auth/LoginScreen";
import { DashboardScreen } from "./src/screens/dashboard/DashboardScreen";
import { QuickCollectScreen } from "./src/screens/quickCollect/QuickCollectScreen";
import { PeopleListScreen } from "./src/screens/people/PeopleListScreen";
import { FinanceScreen } from "./src/screens/finance/FinanceScreen";
import { MoreMenuScreen } from "./src/screens/more/MoreMenuScreen";
import { StudentsScreen } from "./src/screens/students/StudentsScreen";
import { GroupsScreen } from "./src/screens/groups/GroupsScreen";
import { CrmScreen } from "./src/screens/crm/CrmScreen";
import { SettingsScreen } from "./src/screens/settings/SettingsScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TabNavigator = Tab.Navigator as any;
const TabScreen = Tab.Screen as any;
const StackNavigator = Stack.Navigator as any;
const StackScreen = Stack.Screen as any;
const NavContainer = NavigationContainer as any;

function MainTabs() {
  return (
    <TabNavigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <TabScreen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }: any) => <Icon name="Home" size={size - 2} color={color} />,
        }}
      />
      <TabScreen
        name="QuickCollect"
        component={QuickCollectScreen}
        options={{
          tabBarLabel: "Collect",
          tabBarActiveTintColor: colors.emerald,
          tabBarIcon: ({ color, size }: any) => <Icon name="Zap" size={size - 2} color={color} />,
        }}
      />
      <TabScreen
        name="People"
        component={PeopleListScreen}
        options={{
          tabBarLabel: "Directory",
          tabBarIcon: ({ color, size }: any) => <Icon name="Users" size={size - 2} color={color} />,
        }}
      />
      <TabScreen
        name="Finance"
        component={FinanceScreen}
        options={{
          tabBarLabel: "Finance",
          tabBarIcon: ({ color, size }: any) => <Icon name="FileText" size={size - 2} color={color} />,
        }}
      />
      <TabScreen
        name="More"
        component={MoreMenuScreen}
        options={{
          tabBarLabel: "Menu",
          tabBarIcon: ({ color, size }: any) => <Icon name="Menu" size={size - 2} color={color} />,
        }}
      />
    </TabNavigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <NavContainer>
      <StackNavigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <StackScreen name="Login" component={LoginScreen} />
        ) : (
          <>
            <StackScreen name="MainTabs" component={MainTabs} />
            <StackScreen
              name="Students"
              component={StudentsScreen}
              options={{ headerShown: true, title: "Students & Attendance", headerBackTitle: "Back" }}
            />
            <StackScreen
              name="Groups"
              component={GroupsScreen}
              options={{ headerShown: true, title: "Groups & Batches", headerBackTitle: "Back" }}
            />
            <StackScreen
              name="CRM"
              component={CrmScreen}
              options={{ headerShown: true, title: "Leads & CRM Pipeline", headerBackTitle: "Back" }}
            />
            <StackScreen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: true, title: "Workspace Settings", headerBackTitle: "Back" }}
            />
          </>
        )}
      </StackNavigator>
    </NavContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
});
