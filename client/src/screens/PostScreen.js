import React from "react";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as SecureStore from "expo-secure-store";

const { width } = Dimensions.get("window");

export default function PostScreen() {
  const navigation = useNavigation();
  const [posts, setPosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [userId, setUserId] = React.useState(null);
  const [likeLoading, setLikeLoading] = React.useState({}); // Track loading state for each post

  const fetchPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync("access_token");
      const res = await fetch("https://vroom-api.vercel.app/api/post", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      console.log("Posts data:", data);
      const postsData = data.posts || [];
      setPosts(postsData);

      // Like statuses will be checked when userId is available via useEffect
    } catch (err) {
      console.error("Fetch posts error:", err);
      setError("Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  React.useEffect(() => {
    fetchPosts();
    fetchUserId();
  }, []);

  // Update like statuses when userId becomes available
  React.useEffect(() => {
    if (userId && posts.length > 0) {
      updateLikeStatuses();
    }
  }, [userId]);

  const updateLikeStatuses = async () => {
    if (!userId || !posts.length) return;

    const postsWithLikes = await checkLikeStatuses(posts);
    setPosts(postsWithLikes);
  };

  // Function to get user ID from profile API
  const fetchUserId = async () => {
    try {
      const token = await SecureStore.getItemAsync("access_token");
      if (!token) return;

      const response = await fetch("https://vroom-api.vercel.app/api/profile", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user && data.user._id) {
          setUserId(data.user._id);
          console.log("User ID fetched for likes:", data.user._id);
        }
      }
    } catch (error) {
      console.error("Error fetching user ID:", error);
    }
  };

  // Check like status for multiple posts
  const checkLikeStatuses = async (postsData) => {
    if (!userId || !postsData.length) return postsData;

    try {
      const token = await SecureStore.getItemAsync("access_token");

      // Create promises for all like status checks
      const likePromises = postsData.map(async (post) => {
        try {
          const response = await fetch(
            `https://vroom-api.vercel.app/api/likes?postId=${post._id}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "x-user-id": userId,
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              return {
                ...post,
                isLiked: data.isLiked,
                likeCount: data.likeCount,
              };
            }
          }
          return post;
        } catch (error) {
          console.error(
            `Error checking like status for post ${post._id}:`,
            error
          );
          return post;
        }
      });

      const updatedPosts = await Promise.all(likePromises);
      return updatedPosts;
    } catch (error) {
      console.error("Error checking like statuses:", error);
      return postsData;
    }
  };

  // Toggle like/unlike for a specific post
  const handleLike = async (postId) => {
    if (!userId || likeLoading[postId]) return;

    setLikeLoading((prev) => ({ ...prev, [postId]: true }));

    try {
      const token = await SecureStore.getItemAsync("access_token");
      const response = await fetch("https://vroom-api.vercel.app/api/likes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-user-id": userId,
        },
        body: JSON.stringify({
          postId: postId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Toggle like response:", data);
        if (data.success) {
          // Update the specific post in the posts array
          setPosts((prevPosts) =>
            prevPosts.map((post) =>
              post._id === postId
                ? { ...post, isLiked: data.isLiked, likeCount: data.likeCount }
                : post
            )
          );
        }
      } else {
        const errorData = await response.json();
        console.error("Like toggle failed:", errorData);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    } finally {
      setLikeLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Trip Posts</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Trip Posts</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ff3b30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchPosts}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderItem = ({ item }) => {
    const trip = item.trip;
    const createdAt = new Date(item.createdAt).toLocaleString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const distanceKm = trip?.distance ? (trip.distance / 1000).toFixed(2) : "0";
    const durationMs = trip?.duration || 0;
    const durationMin = Math.floor(durationMs / 60000);
    const durationStr =
      durationMin > 60
        ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`
        : `${durationMin}m`;

    return (
      <TouchableOpacity
        style={styles.postCard}
        onPress={() =>
          navigation.navigate("PostDetailScreen", { postId: item._id })
        }
        activeOpacity={0.8}
      >
        {/* Post Header */}
        <View style={styles.postHeader}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color="#007AFF" />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.username}>
                {item.user?.name || "Anonymous"}
              </Text>
              <Text style={styles.timestamp}>{createdAt}</Text>
            </View>
          </View>
        </View>

        {/* Post Caption */}
        {item.caption && <Text style={styles.caption}>{item.caption}</Text>}

        {/* Trip Stats */}
        <View style={styles.tripStats}>
          <View style={styles.statItem}>
            <Ionicons name="map" size={16} color="#007AFF" />
            <Text style={styles.statText}>{distanceKm} km</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="timer" size={16} color="#007AFF" />
            <Text style={styles.statText}>{durationStr}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="location" size={16} color="#007AFF" />
            <Text style={styles.statText}>
              {trip?.path?.length || 0} points
            </Text>
          </View>
        </View>

        {/* Route Map Preview */}
        {trip?.path && trip.path.length > 0 && (
          <View style={styles.mapContainer}>
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
                    {/* Route Polyline */}
                    {trip.path.length > 1 && (
                      <Polyline
                        coordinates={trip.path.map((point) => ({
                          latitude: point.lat,
                          longitude: point.lng,
                        }))}
                        strokeColor="#007AFF"
                        strokeWidth={4}
                        lineCap="round"
                        lineJoin="round"
                      />
                    )}

                    {/* Start Marker */}
                    <Marker
                      coordinate={{
                        latitude: trip.path[0].lat,
                        longitude: trip.path[0].lng,
                      }}
                      title="Start"
                      description="Trip start point"
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      <View style={styles.startMarker}>
                        <Ionicons
                          name="play-circle"
                          size={16}
                          color="#00ff00"
                        />
                      </View>
                    </Marker>

                    {/* End Marker */}
                    {trip.path.length > 1 && (
                      <Marker
                        coordinate={{
                          latitude: trip.path[trip.path.length - 1].lat,
                          longitude: trip.path[trip.path.length - 1].lng,
                        }}
                        title="End"
                        description="Trip end point"
                        anchor={{ x: 0.5, y: 0.5 }}
                      >
                        <View style={styles.endMarker}>
                          <Ionicons
                            name="stop-circle"
                            size={16}
                            color="#ff3b30"
                          />
                        </View>
                      </Marker>
                    )}
                  </MapView>
                );
              } catch (error) {
                console.log("Map render error:", error);
                return (
                  <View style={styles.mapFallback}>
                    <Ionicons name="map-outline" size={40} color="#666" />
                    <Text style={styles.mapFallbackText}>
                      Map not available
                    </Text>
                    <Text style={styles.mapFallbackSubtext}>
                      {trip.path.length} points • {distanceKm} km
                    </Text>
                  </View>
                );
              }
            })()}

            {/* Map Overlay */}
            <View style={styles.mapOverlay}>
              <View style={styles.mapInfo}>
                <View style={styles.routePoint}>
                  <Ionicons name="play-circle" size={12} color="#00ff00" />
                  <Text style={styles.pointLabel}>Start</Text>
                </View>
                {trip.path.length > 1 && (
                  <View style={styles.routePoint}>
                    <Ionicons name="stop-circle" size={12} color="#ff3b30" />
                    <Text style={styles.pointLabel}>End</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Post Images */}
        {(item.imageUrl || (item.imageUrls && item.imageUrls.length > 0)) && (
          <View style={styles.imageContainer}>
            {item.imageUrl && (
              <Image source={{ uri: item.imageUrl }} style={styles.postImage} />
            )}
            {item.imageUrls && item.imageUrls.length > 0 && (
              <View style={styles.multiImageContainer}>
                {item.imageUrls.slice(0, 3).map((url, index) => (
                  <Image
                    key={index}
                    source={{ uri: url }}
                    style={[
                      styles.multiImage,
                      item.imageUrls.length === 1 && { width: "100%" },
                      item.imageUrls.length === 2 && { width: "49%" },
                      item.imageUrls.length >= 3 && { width: "32%" },
                    ]}
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

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              item.isLiked && styles.actionButtonActive,
            ]}
            onPress={(e) => {
              e.stopPropagation(); // Prevent navigation to detail screen
              handleLike(item._id);
            }}
            disabled={likeLoading[item._id]}
          >
            <Ionicons
              name={item.isLiked ? "heart" : "heart-outline"}
              size={18}
              color={item.isLiked ? "#ff3b30" : "#007AFF"}
            />
            <Text
              style={[
                styles.actionText,
                item.isLiked && styles.actionTextActive,
              ]}
            >
              {likeLoading[item._id]
                ? "..."
                : `${item.likeCount || 0} ${
                    (item.likeCount || 0) === 1 ? "Like" : "Likes"
                  }`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="bookmark-outline" size={18} color="#007AFF" />
            <Text style={styles.actionText}>Save</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trip Posts</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <Ionicons
            name="refresh"
            size={20}
            color={refreshing ? "#666" : "#007AFF"}
          />
        </TouchableOpacity>
      </View>

      {/* Posts List */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
            title="Pull to refresh"
            titleColor="#888"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="documents-outline" size={64} color="#666" />
            <Text style={styles.emptyTitle}>No Posts Yet</Text>
            <Text style={styles.emptyText}>
              Be the first to share your trip experiences!
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#333",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#888",
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  errorText: {
    color: "#888",
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: 20,
  },
  separator: {
    height: 1,
    backgroundColor: "#333",
    marginHorizontal: 20,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 80,
    paddingHorizontal: 40,
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
  },

  // Post Card Styles
  postCard: {
    backgroundColor: "#111",
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    overflow: "hidden",
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#555",
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
    color: "#888",
  },
  caption: {
    fontSize: 16,
    lineHeight: 22,
    color: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  // Trip Stats
  tripStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#0a0a0a",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#333",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },

  // Map Styles
  mapContainer: {
    height: 200,
    backgroundColor: "#222",
    position: "relative",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#333",
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
    backgroundColor: "#222",
  },
  mapFallbackText: {
    color: "#888",
    fontSize: 16,
    marginTop: 8,
  },
  mapFallbackSubtext: {
    color: "#666",
    fontSize: 12,
    marginTop: 4,
  },
  mapOverlay: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 8,
    padding: 8,
  },
  mapInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pointLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  startMarker: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  endMarker: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  // Image Styles
  imageContainer: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#333",
  },
  postImage: {
    width: "100%",
    height: 250,
  },
  multiImageContainer: {
    flexDirection: "row",
    gap: 2,
    height: 200,
    position: "relative",
  },
  multiImage: {
    flex: 1,
    borderRadius: 0,
  },
  moreImagesOverlay: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  moreImagesText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },

  // Action Buttons
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: "#333",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "#333",
    gap: 6,
  },
  actionButtonActive: {
    backgroundColor: "#2a2a2a",
    borderColor: "#007AFF",
  },
  actionText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "500",
  },
  actionTextActive: {
    color: "#007AFF",
  },
});
