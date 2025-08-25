import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "../screens/HomeScreen";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import PostNavigator from "./PostNavigator";
import WishlistScreen from "../screens/WishlistScreen";
import AIScreen from "../screens/AIScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();

function ThreadsHeader() {
  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity>
        <Text style={styles.headerLogo}>VROOM</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarStyle: {
          backgroundColor: "#000",
          borderTopColor: "#222",
          paddingVertical: 8,
          height: 80,
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#888",
        tabBarShowLabel: false,
        header: () => <ThreadsHeader />,
        headerStyle: {
          backgroundColor: "#000",
          borderBottomColor: "#222",
          borderBottomWidth: 1,
        },
      })}
    >
      <Tab.Screen
        name="PostNavigator"
        component={PostNavigator}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Wishlist"
        component={WishlistScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AIScreen"
        component={AIScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: "#000",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    alignItems: "center",
  },
  headerLogo: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
});
