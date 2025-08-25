import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  RefreshControl,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as SecureStore from "expo-secure-store";

const { width: screenWidth } = Dimensions.get("window");

export default function PostDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { postId } = route.params;

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchPostDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync("access_token");
      const res = await fetch(
        `https://vroom-api.vercel.app/api/post/${postId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      console.log("Post detail response:", data);

      // Check different possible response structures
      if (data && data._id) {
        // Direct post object
        setPost(data);
      } else if (data.post) {
        // Wrapped in post property
        setPost(data.post);
      } else if (data.data) {
        // Wrapped in data property
        setPost(data.data);
      } else if (data.success && data.post) {
        // Success wrapper
        setPost(data.post);
      } else {
        console.error("Unexpected response structure:", data);
        setError("Post not found");
      }
    } catch (err) {
      console.error("Fetch post detail error:", err);
      setError("Failed to load post details");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPostDetail();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchPostDetail();
  }, [postId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading post details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ff3b30" />
          <Text style={styles.errorText}>{error || "Post not found"}</Text>
          <TouchableOpacity
            onPress={fetchPostDetail}
            style={styles.retryButton}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const trip = post.trip;
  const createdAt = new Date(post.createdAt).toLocaleString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const distanceKm = trip?.distance ? (trip.distance / 1000).toFixed(2) : "0";
  const durationMs = trip?.duration || 0;
  const durationHours = Math.floor(durationMs / 3600000);
  const durationMin = Math.floor((durationMs % 3600000) / 60000);
  const durationStr =
    durationHours > 0 ? `${durationHours}h ${durationMin}m` : `${durationMin}m`;

  // Calculate average speed
  const avgSpeed =
    trip?.distance && trip?.duration
      ? (trip.distance / 1000 / (trip.duration / 3600000)).toFixed(1)
      : "0";

  const images = post.imageUrls || (post.imageUrl ? [post.imageUrl] : []);

  const handleLike = () => {
    setLiked(!liked);
    // TODO: Implement API call to like/unlike post
  };

  const handleSave = () => {
    setSaved(!saved);
    // TODO: Implement API call to save/unsave post
  };

  const handleShare = () => {
    // TODO: Implement sharing functionality
    console.log("Share post:", postId);
  };

  const renderRouteMap = () => {
    if (!trip?.path || trip.path.length === 0) return null;

    const lats = trip.path.map((p) => p.lat);
    const lngs = trip.path.map((p) => p.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latRange = maxLat - minLat || 0.001;
    const lngRange = maxLng - minLng || 0.001;

    // Calculate center and deltas for map region
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latitudeDelta = Math.max(latRange * 1.3, 0.01);
    const longitudeDelta = Math.max(lngRange * 1.3, 0.01);

    return (
      <View style={styles.mapContainer}>
        <View style={styles.mapHeader}>
          <View style={styles.mapTitleSection}>
            <Ionicons name="map" size={20} color="#007AFF" />
            <Text style={styles.mapTitle}>Trip Route</Text>
          </View>
          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => setIsMapExpanded(!isMapExpanded)}
          >
            <Ionicons
              name={isMapExpanded ? "contract" : "expand"}
              size={18}
              color="#007AFF"
            />
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.mapWrapper,
            isMapExpanded && styles.mapWrapperExpanded,
          ]}
        >
          {(() => {
            try {
              return (
                <MapView
                  style={styles.mapView}
                  initialRegion={{
                    latitude: centerLat,
                    longitude: centerLng,
                    latitudeDelta,
                    longitudeDelta,
                  }}
                  mapType="standard"
                  showsUserLocation={false}
                  showsMyLocationButton={false}
                  showsCompass={true}
                  showsScale={false}
                  showsTraffic={false}
                  showsIndoors={false}
                  showsBuildings={true}
                  showsPointsOfInterest={false}
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

                  {/* Waypoints for complex routes */}
                  {trip.path.length > 2 &&
                    trip.path.slice(1, -1).map((point, index) => (
                      <Marker
                        key={`waypoint-${index}`}
                        coordinate={{
                          latitude: point.lat,
                          longitude: point.lng,
                        }}
                        anchor={{ x: 0.5, y: 0.5 }}
                      >
                        <View style={styles.waypointMarker}>
                          <View style={styles.waypointDot} />
                        </View>
                      </Marker>
                    ))}

                  {/* Start Marker */}
                  <Marker
                    coordinate={{
                      latitude: trip.path[0].lat,
                      longitude: trip.path[0].lng,
                    }}
                    title="Start Point"
                    description={`Lat: ${trip.path[0].lat.toFixed(
                      4
                    )}, Lng: ${trip.path[0].lng.toFixed(4)}`}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={styles.startMarker}>
                      <Ionicons name="play-circle" size={20} color="#00ff00" />
                    </View>
                  </Marker>

                  {/* End Marker */}
                  {trip.path.length > 1 && (
                    <Marker
                      coordinate={{
                        latitude: trip.path[trip.path.length - 1].lat,
                        longitude: trip.path[trip.path.length - 1].lng,
                      }}
                      title="End Point"
                      description={`Lat: ${trip.path[
                        trip.path.length - 1
                      ].lat.toFixed(4)}, Lng: ${trip.path[
                        trip.path.length - 1
                      ].lng.toFixed(4)}`}
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      <View style={styles.endMarker}>
                        <Ionicons
                          name="stop-circle"
                          size={20}
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
                  <Ionicons name="map-outline" size={60} color="#666" />
                  <Text style={styles.mapFallbackText}>Map not available</Text>
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
              <View style={styles.routePoint}>
                <Ionicons name="location" size={12} color="#007AFF" />
                <Text style={styles.pointLabel}>{trip.path.length} points</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post Details</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
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
      >
        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color="#007AFF" />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.username}>
                {post.user?.name || "Anonymous"}
              </Text>
              <Text style={styles.postDate}>{createdAt}</Text>
            </View>
          </View>
        </View>

        {/* Caption */}
        {post.caption && (
          <View style={styles.captionCard}>
            <Text style={styles.caption}>{post.caption}</Text>
          </View>
        )}

        {/* Trip Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="map" size={20} color="#007AFF" />
            <Text style={styles.statValue}>{distanceKm}</Text>
            <Text style={styles.statLabel}>km</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="timer" size={20} color="#007AFF" />
            <Text style={styles.statValue}>{durationStr}</Text>
            <Text style={styles.statLabel}>duration</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="speedometer" size={20} color="#007AFF" />
            <Text style={styles.statValue}>{avgSpeed}</Text>
            <Text style={styles.statLabel}>km/h</Text>
          </View>
        </View>

        {/* Images */}
        {images.length > 0 && (
          <View style={styles.imageSection}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(
                  event.nativeEvent.contentOffset.x / screenWidth
                );
                setCurrentImageIndex(index);
              }}
            >
              {images.map((url, index) => (
                <Image
                  key={index}
                  source={{ uri: url }}
                  style={styles.postImage}
                />
              ))}
            </ScrollView>
            {images.length > 1 && (
              <View style={styles.imageIndicator}>
                {images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      currentImageIndex === index && styles.activeDot,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Route Map */}
        {renderRouteMap()}

        {/* Trip Details */}
        <View style={styles.tripDetails}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={20} color="#007AFF" />
            <Text style={styles.sectionTitle}>Trip Details</Text>
          </View>

          <View style={styles.detailsList}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="play-circle" size={16} color="#00ff00" />
              </View>
              <Text style={styles.detailLabel}>Start Point</Text>
              <Text style={styles.detailValue}>
                {trip.startPoint?.lat.toFixed(4)},{" "}
                {trip.startPoint?.lng.toFixed(4)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="stop-circle" size={16} color="#ff3b30" />
              </View>
              <Text style={styles.detailLabel}>End Point</Text>
              <Text style={styles.detailValue}>
                {trip.endPoint?.lat.toFixed(4)}, {trip.endPoint?.lng.toFixed(4)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="location" size={16} color="#007AFF" />
              </View>
              <Text style={styles.detailLabel}>Waypoints</Text>
              <Text style={styles.detailValue}>
                {trip.path?.length || 0} points
              </Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="time" size={16} color="#007AFF" />
              </View>
              <Text style={styles.detailLabel}>Start Time</Text>
              <Text style={styles.detailValue}>
                {new Date(trip.startTime).toLocaleString("en-US")}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="checkmark-circle" size={16} color="#007AFF" />
              </View>
              <Text style={styles.detailLabel}>End Time</Text>
              <Text style={styles.detailValue}>
                {new Date(trip.endTime).toLocaleString("en-US")}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, liked && styles.actionButtonActive]}
            onPress={handleLike}
          >
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={20}
              color={liked ? "#ff3b30" : "#007AFF"}
            />
            <Text style={[styles.actionText, liked && styles.actionTextActive]}>
              {liked ? "Liked" : "Like"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, saved && styles.actionButtonActive]}
            onPress={handleSave}
          >
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={20}
              color={saved ? "#007AFF" : "#007AFF"}
            />
            <Text style={[styles.actionText, saved && styles.actionTextActive]}>
              {saved ? "Saved" : "Save"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color="#007AFF" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSpacer: {
    width: 40,
  },
  shareButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },

  // Loading & Error States
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

  // User Card
  userCard: {
    backgroundColor: "#111",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: "#555",
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  postDate: {
    fontSize: 14,
    color: "#888",
  },

  // Caption Card
  captionCard: {
    backgroundColor: "#111",
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    padding: 16,
  },
  caption: {
    fontSize: 16,
    lineHeight: 24,
    color: "#fff",
  },

  // Stats Container
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 12,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#111",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    gap: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  statLabel: {
    fontSize: 12,
    color: "#888",
  },

  // Image Section
  imageSection: {
    marginTop: 12,
  },
  postImage: {
    width: screenWidth,
    height: 300,
    resizeMode: "cover",
  },
  imageIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 16,
    backgroundColor: "#111",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#333",
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#007AFF",
  },

  // Map Container
  mapContainer: {
    backgroundColor: "#111",
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    overflow: "hidden",
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  mapTitleSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  expandButton: {
    backgroundColor: "#333",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#555",
  },
  mapWrapper: {
    height: 300,
    position: "relative",
  },
  mapWrapperExpanded: {
    height: 500,
  },
  mapView: {
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
    fontSize: 16,
    color: "#888",
    marginTop: 8,
  },
  mapFallbackSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  mapOverlay: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 8,
    padding: 12,
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
    borderRadius: 12,
    padding: 6,
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
    borderRadius: 12,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  waypointMarker: {
    alignItems: "center",
    justifyContent: "center",
  },
  waypointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#007AFF",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },

  // Trip Details
  tripDetails: {
    backgroundColor: "#111",
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  detailsList: {
    padding: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  detailIcon: {
    width: 24,
    alignItems: "center",
  },
  detailLabel: {
    color: "#888",
    fontSize: 14,
    flex: 1,
  },
  detailValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    flex: 1.5,
    textAlign: "right",
  },

  // Action Buttons
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    gap: 8,
  },
  actionButtonActive: {
    backgroundColor: "#222",
    borderColor: "#007AFF",
  },
  actionText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
  actionTextActive: {
    color: "#007AFF",
  },
});
