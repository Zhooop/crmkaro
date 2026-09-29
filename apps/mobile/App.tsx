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
import { OnboardingScreen } from "./src/screens/auth/OnboardingScreen";
import { DashboardScreen } from "./src/screens/dashboard/DashboardScreen";
import { QuickCollectScreen } from "./src/screens/quickCollect/QuickCollectScreen";
import { PeopleListScreen } from "./src/screens/people/PeopleListScreen";
import { FinanceScreen } from "./src/screens/finance/FinanceScreen";
import { MoreMenuScreen } from "./src/screens/more/MoreMenuScreen";
import { StudentsScreen } from "./src/screens/students/StudentsScreen";
import { GroupsScreen } from "./src/screens/groups/GroupsScreen";
import { CrmScreen } from "./src/screens/crm/CrmScreen";
import { SettingsScreen } from "./src/screens/settings/SettingsScreen";
import { TransactionsScreen } from "./src/screens/transactions/TransactionsScreen";
import { InventoryScreen } from "./src/screens/inventory/InventoryScreen";
import { PayrollScreen } from "./src/screens/payroll/PayrollScreen";

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
          borderTopWidth: 1.5,
          height: 66,
          paddingBottom: 10,
          paddingTop: 6,
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800",
          marginTop: -2,
        },
      }}
    >
      <TabScreen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size, focused }: any) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
              <Icon name="Home" size={size - 2} color={focused ? colors.brand : color} />
            </View>
          ),
        }}
      />
      <TabScreen
        name="QuickCollect"
        component={QuickCollectScreen}
        options={{
          tabBarLabel: "Collect",
          tabBarActiveTintColor: colors.emerald,
          tabBarIcon: ({ color, size, focused }: any) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconWrapEmerald]}>
              <Icon name="Zap" size={size - 3} color={focused ? colors.emerald : color} />
            </View>
          ),
        }}
      />
      <TabScreen
        name="People"
        component={PeopleListScreen}
        options={{
          tabBarLabel: "Directory",
          tabBarIcon: ({ color, size, focused }: any) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
              <Icon name="Users" size={size - 3} color={focused ? colors.brand : color} />
            </View>
          ),
        }}
      />
      <TabScreen
        name="Finance"
        component={FinanceScreen}
        options={{
          tabBarLabel: "Finance",
          tabBarIcon: ({ color, size, focused }: any) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
              <Icon name="FileText" size={size - 3} color={focused ? colors.brand : color} />
            </View>
          ),
        }}
      />
      <TabScreen
        name="More"
        component={MoreMenuScreen}
        options={{
          tabBarLabel: "Menu",
          tabBarIcon: ({ color, size, focused }: any) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
              <Icon name="Menu" size={size - 3} color={focused ? colors.brand : color} />
            </View>
          ),
        }}
      />
    </TabNavigator>
  );
}

function RootNavigator() {
  const { user, loading, needsSetup } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  const screenHeaderOpts = {
    headerShown: true,
    headerBackTitle: "Back",
    headerStyle: {
      backgroundColor: colors.surface,
    },
    headerTintColor: colors.brandNavy,
    headerTitleStyle: {
      fontWeight: "800" as const,
      fontSize: 16,
    },
    headerShadowVisible: false,
  };

  return (
    <NavContainer>
      <StackNavigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <StackScreen name="Login" component={LoginScreen} />
        ) : needsSetup ? (
          <StackScreen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <StackScreen name="MainTabs" component={MainTabs} />
            <StackScreen
              name="Students"
              component={StudentsScreen}
              options={{ ...screenHeaderOpts, title: "Students & Attendance" }}
            />
            <StackScreen
              name="Groups"
              component={GroupsScreen}
              options={{ ...screenHeaderOpts, title: "Groups & Batches" }}
            />
            <StackScreen
              name="CRM"
              component={CrmScreen}
              options={{ ...screenHeaderOpts, title: "Leads & CRM Pipeline" }}
            />
            <StackScreen
              name="Settings"
              component={SettingsScreen}
              options={{ ...screenHeaderOpts, title: "Workspace Settings" }}
            />
            <StackScreen
              name="Transactions"
              component={TransactionsScreen}
              options={{ ...screenHeaderOpts, title: "Transactions & Receipts" }}
            />
            <StackScreen
              name="Inventory"
              component={InventoryScreen}
              options={{ ...screenHeaderOpts, title: "Inventory & Catalog" }}
            />
            <StackScreen
              name="Payroll"
              component={PayrollScreen}
              options={{ ...screenHeaderOpts, title: "Payroll & Staff" }}
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
  tabIconWrap: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrapActive: {
    backgroundColor: colors.brandLight,
    borderWidth: 1,
    borderColor: colors.brandBorder,
  },
  tabIconWrapEmerald: {
    backgroundColor: colors.emeraldLight,
    borderWidth: 1,
    borderColor: colors.emeraldBorder,
  },
});
