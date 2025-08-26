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
  FlatList,
  Dimensions,
} from "react-native";
import { useContext, useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useNavigation } from "@react-navigation/native";
import MapView, { Marker, Polyline } from "react-native-maps";
import AuthContext from "../contexts/AuthContext";

const { width } = Dimensions.get("window");

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { logout } = useContext(AuthContext);
  const [userProfile, setUserProfile] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("posts"); // posts, liked, saved

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
        setUserPosts([]);
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

        if (data.user) {
          // Set user profile data
          setUserProfile({
            id: data.user._id,
            name: data.user.name || "User",
            email: data.user.email,
            avatar: data.user.avatar || data.user.profilePicture || null,
            postsCount: data.user.posts?.length || 0,
            followersCount: data.user.followersCount || 0,
            followingCount: data.user.followingCount || 0,
            bio: data.user.bio || "",
            location: data.user.location || "",
            website: data.user.website || "",
            joinedDate: data.user.createdAt || data.user.joinedDate,
          });

          // Set user posts data
          if (data.user.posts && Array.isArray(data.user.posts)) {
            console.log("Setting user posts:", data.user.posts.length, "posts");
            setUserPosts(data.user.posts);
          } else {
            console.log("No posts found in response");
            setUserPosts([]);
          }
        } else {
          // Handle case where user data is not found
          console.log("No user data in response", data);
          throw new Error("User data not found");
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
          setUserPosts([]);
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
        setUserPosts([]);
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

  const renderPostCard = ({ item }) => {
    const trip = item.trip;
    const createdAt = new Date(item.createdAt).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const distanceKm = trip?.distance ? (trip.distance / 1000).toFixed(2) : "-";
    const durationMs = trip?.duration || 0;
    const durationMin = Math.floor(durationMs / 60000);
    const durationStr =
      durationMin > 60
        ? `${Math.floor(durationMin / 60)}j ${durationMin % 60}m`
        : `${durationMin}m`;

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <Text style={styles.postDate}>{createdAt}</Text>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("PostDetailScreen", { postId: item._id })
            }
          >
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>
        </View>

        <Text style={styles.postCaption}>{item.caption}</Text>

        {/* Route Preview */}
        {trip?.path && trip.path.length > 0 && (
          <View style={styles.routePreview}>
            <View style={styles.mapPreviewContainer}>
              {(() => {
                try {
                  return (
                    <MapView
                      style={styles.mapPreview}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      rotateEnabled={false}
                      pitchEnabled={false}
                      initialRegion={{
                        latitude: trip.path[0].lat,
                        longitude: trip.path[0].lng,
                        latitudeDelta: Math.max(
                          Math.abs(
                            Math.max(...trip.path.map((p) => p.lat)) -
                              Math.min(...trip.path.map((p) => p.lat))
                          ) * 1.5,
                          0.01
                        ),
                        longitudeDelta: Math.max(
                          Math.abs(
                            Math.max(...trip.path.map((p) => p.lng)) -
                              Math.min(...trip.path.map((p) => p.lng))
                          ) * 1.5,
                          0.01
                        ),
                      }}
                      mapType="standard"
                    >
                      {trip.path.length > 1 && (
                        <Polyline
                          coordinates={trip.path.map((point) => ({
                            latitude: point.lat,
                            longitude: point.lng,
                          }))}
                          strokeColor="#fff"
                          strokeWidth={3}
                          lineCap="round"
                          lineJoin="round"
                        />
                      )}

                      <Marker
                        coordinate={{
                          latitude: trip.path[0].lat,
                          longitude: trip.path[0].lng,
                        }}
                        anchor={{ x: 0.5, y: 0.5 }}
                      >
                        <View style={styles.startMarker}>
                          <Ionicons
                            name="play-circle"
                            size={16}
                            color="#00FF00"
                          />
                        </View>
                      </Marker>

                      {trip.path.length > 1 && (
                        <Marker
                          coordinate={{
                            latitude: trip.path[trip.path.length - 1].lat,
                            longitude: trip.path[trip.path.length - 1].lng,
                          }}
                          anchor={{ x: 0.5, y: 0.5 }}
                        >
                          <View style={styles.endMarker}>
                            <Ionicons
                              name="stop-circle"
                              size={16}
                              color="#FF0000"
                            />
                          </View>
                        </Marker>
                      )}
                    </MapView>
                  );
                } catch (error) {
                  return (
                    <View style={styles.mapFallback}>
                      <Ionicons name="map-outline" size={30} color="#666" />
                      <Text style={styles.mapFallbackText}>
                        Peta tidak tersedia
                      </Text>
                    </View>
                  );
                }
              })()}
            </View>
          </View>
        )}

        {/* Post Images */}
        {(item.imageUrl || item.imageUrls) && (
          <View style={styles.postImageContainer}>
            {item.imageUrl && (
              <Image source={{ uri: item.imageUrl }} style={styles.postImage} />
            )}
            {item.imageUrls && item.imageUrls.length > 0 && (
              <View style={styles.multiImageContainer}>
                {item.imageUrls.slice(0, 3).map((url, index) => (
                  <Image
                    key={index}
                    source={{ uri: url }}
                    style={styles.multiImage}
                  />
                ))}
                {item.imageUrls.length > 3 && (
                  <View style={styles.moreImagesOverlay}>
                    <Text style={styles.moreImagesText}>
                      +{item.imageUrls.length - 3}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        <View style={styles.postStats}>
          <View style={styles.postStatItem}>
            <Ionicons name="map" size={16} color="#fff" />
            <Text style={styles.postStatText}>{distanceKm} km</Text>
          </View>
          <View style={styles.postStatItem}>
            <Ionicons name="timer" size={16} color="#fff" />
            <Text style={styles.postStatText}>{durationStr}</Text>
          </View>
        </View>
      </View>
    );
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
        nestedScrollEnabled={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}></View>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            style={styles.logoutIconButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
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
          </View>

          <Text style={styles.name}>{userProfile.name}</Text>
          <Text style={styles.email}>{userProfile.email}</Text>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{userPosts?.length || 0}</Text>
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

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "posts" && styles.activeTab]}
            onPress={() => setActiveTab("posts")}
          >
            <Ionicons
              name="grid-outline"
              size={20}
              color={activeTab === "posts" ? "#fff" : "#888"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "posts" && styles.activeTabText,
              ]}
            >
              My Posts
            </Text>
          </TouchableOpacity>
        </View>

        {/* Posts Content */}
        {activeTab === "posts" && (
          <View style={styles.postsContainer}>
            {loading ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Loading posts...</Text>
              </View>
            ) : userPosts.length > 0 ? (
              <FlatList
                data={userPosts}
                renderItem={renderPostCard}
                keyExtractor={(item) => item._id}
                scrollEnabled={false}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.postsList}
                ItemSeparatorComponent={() => (
                  <View style={styles.postSeparator} />
                )}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="camera-outline" size={64} color="#666" />
                <Text style={styles.emptyTitle}>No posts yet</Text>
                <Text style={styles.emptyText}>
                  Start recording your trips to share your adventures
                </Text>
                <TouchableOpacity
                  style={styles.createPostButton}
                  onPress={() => navigation.navigate("RecordScreen")}
                >
                  <Ionicons name="add" size={20} color="#000" />
                  <Text style={styles.createPostButtonText}>
                    Create First Post
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Liked Posts Content */}
        {activeTab === "liked" && (
          <View style={styles.comingSoonContainer}>
            <Ionicons name="heart-outline" size={64} color="#666" />
            <Text style={styles.comingSoonTitle}>Liked Posts</Text>
            <Text style={styles.comingSoonText}>
              This feature is coming soon!
            </Text>
          </View>
        )}

        {/* Saved Posts Content */}
        {activeTab === "saved" && (
          <View style={styles.comingSoonContainer}>
            <Ionicons name="bookmark-outline" size={64} color="#666" />
            <Text style={styles.comingSoonTitle}>Saved Posts</Text>
            <Text style={styles.comingSoonText}>
              This feature is coming soon!
            </Text>
          </View>
        )}

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            <Text style={styles.menuText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="settings-outline" size={20} color="#fff" />
            <Text style={styles.menuText}>Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#888" />
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
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  headerLeft: {
    width: 40, // Same width as logout button for balance
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
    textAlign: "center",
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
  // Tab Navigation Styles
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#111",
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: "#333",
  },
  tabText: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  activeTabText: {
    color: "#fff",
    fontWeight: "600",
  },
  // Posts Section Styles
  postsContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  postsLoadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  postsList: {
    paddingBottom: 10,
  },
  postSeparator: {
    height: 16,
  },
  postCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#222",
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  postDate: {
    color: "#888",
    fontSize: 14,
  },
  postCaption: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 16,
  },
  // Route Preview Styles
  routePreview: {
    marginBottom: 16,
  },
  mapPreviewContainer: {
    height: 120,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#222",
  },
  mapPreview: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  mapFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2A2A2A",
  },
  mapFallbackText: {
    color: "#666",
    fontSize: 12,
    marginTop: 8,
  },
  startMarker: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  endMarker: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  // Post Images Styles
  postImageContainer: {
    marginBottom: 16,
  },
  postImage: {
    width: "100%",
    height: 150,
    borderRadius: 8,
  },
  multiImageContainer: {
    flexDirection: "row",
    gap: 4,
    height: 100,
  },
  multiImage: {
    flex: 1,
    borderRadius: 8,
  },
  moreImagesOverlay: {
    position: "absolute",
    right: 4,
    bottom: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 4,
    padding: 4,
  },
  moreImagesText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  postStats: {
    flexDirection: "row",
    gap: 20,
  },
  postStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#222",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  postStatText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  // Empty State Styles
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  createPostButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
  },
  createPostButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  // Coming Soon Styles
  comingSoonContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
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
  logoutIconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 68, 68, 0.2)",
  },
});
