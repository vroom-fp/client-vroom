import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useContext, useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import AuthContext from "../contexts/AuthContext";

export default function ProfileScreen() {
  const { logout } = useContext(AuthContext);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync("access_token");
      if (!token) {
        console.log("No token found");
        setUserProfile({
          name: "Guest User",
          email: "guest@example.com",
          postsCount: 0,
          followersCount: 0,
          followingCount: 0,
        });
        setLoading(false);
        return;
      }

      console.log("Fetching profile from API...");
      const response = await fetch("https://vroom-api.vercel.app/api/profile", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Profile API response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("Profile API response:", data);

        if (data.success && data.data) {
          setUserProfile({
            id: data.data.id,
            name: data.data.name || data.data.username || "User",
            email: data.data.email,
            avatar: data.data.avatar || data.data.profilePicture || null,
            postsCount: data.data.postsCount || 0,
            followersCount: data.data.followersCount || 0,
            followingCount: data.data.followingCount || 0,
            bio: data.data.bio || "",
            location: data.data.location || "",
            website: data.data.website || "",
            joinedDate: data.data.createdAt || data.data.joinedDate,
          });
        } else {
          // Handle case where API returns success: false
          console.log("API returned success: false", data);
          throw new Error(data.message || "Failed to fetch profile");
        }
      } else {
        const errorData = await response.json();
        console.log("Profile API error:", errorData);
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
    } catch (error) {
      console.log("Error fetching profile from API:", error);

      // Fallback: try to decode JWT token for basic info
      try {
        const token = await SecureStore.getItemAsync("access_token");
        if (token) {
          const base64Url = token.split(".")[1];
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split("")
              .map(function (c) {
                return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
              })
              .join("")
          );

          const userData = JSON.parse(jsonPayload);
          console.log("Using JWT fallback data:", userData);

          setUserProfile({
            id: userData.id,
            name: userData.name || userData.username || "User",
            email: userData.email,
            avatar: null,
            postsCount: 0,
            followersCount: 0,
            followingCount: 0,
          });
        }
      } catch (jwtError) {
        console.log("JWT fallback also failed:", jwtError);
        // Final fallback with basic info
        setUserProfile({
          name: "User",
          email: "user@example.com",
          postsCount: 0,
          followersCount: 0,
          followingCount: 0,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ]);
  };

  const handleEditProfile = () => {
    // Simple edit functionality - could open a modal or navigate to edit screen
    Alert.alert("Edit Profile", "Edit profile feature will be available soon!");
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserProfile();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading profile from API...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            title="Pull to refresh profile"
            titleColor="#fff"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Profile Info Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Image
              source={{
                uri:
                  userProfile?.avatar ||
                  "https://ui-avatars.com/api/?name=" +
                    (userProfile?.name || "User") +
                    "&background=333&color=fff&size=120",
              }}
              style={styles.avatar}
            />
            <TouchableOpacity style={styles.avatarEditButton}>
              <Ionicons name="camera" size={16} color="#000" />
            </TouchableOpacity>
          </View>

          <Text style={styles.name}>{userProfile.name}</Text>
          <Text style={styles.email}>{userProfile.email}</Text>

          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEditProfile}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {userProfile?.postsCount || 0}
            </Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {userProfile?.followersCount || 0}
            </Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {userProfile?.followingCount || 0}
            </Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="bookmark-outline" size={20} color="#fff" />
            <Text style={styles.menuText}>Saved Posts</Text>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="heart-outline" size={20} color="#fff" />
            <Text style={styles.menuText}>Liked Posts</Text>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            <Text style={styles.menuText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#333",
  },
  avatarEditButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#fff",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#000",
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: "#888",
    marginBottom: 20,
  },
  editButton: {
    backgroundColor: "#fff",
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 20,
  },
  editButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  statsSection: {
    flexDirection: "row",
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: "#111",
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: "#888",
  },
  statDivider: {
    width: 1,
    backgroundColor: "#333",
    marginHorizontal: 16,
  },
  menuSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#111",
    borderRadius: 12,
    marginBottom: 8,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
    marginLeft: 16,
  },
  logoutSection: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff4444",
    paddingVertical: 16,
    borderRadius: 12,
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
