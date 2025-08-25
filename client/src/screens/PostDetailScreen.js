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
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import MapView, { Marker, Polyline } from "react-native-maps";

const { width: screenWidth } = Dimensions.get("window");

export default function PostDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { postId } = route.params;

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  const fetchPostDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://vroom-api.vercel.app/api/post/${postId}`,
        {
          method: "GET",
          headers: {
            Authorization:
              "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4YTZmOTE5YWU1YWY2ZDk1NjYwZDZmNCIsImVtYWlsIjoicml6a2FAZ21haWwuY29tIiwiaWF0IjoxNzU1OTQ0NzI5fQ.oIUvNQsfwpxBFYfih6UyfsmdM1UiK8VcW5yJQNbSkZA",
          },
        }
      );
      const data = await res.json();
      setPost(data.post);
    } catch (err) {
      setError("Gagal mengambil detail post");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPostDetail();
  }, [postId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF5A00" />
        <Text style={styles.loadingText}>Memuat detail post...</Text>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || "Post tidak ditemukan"}</Text>
        <TouchableOpacity onPress={fetchPostDetail} style={styles.retryButton}>
          <Text style={styles.retryText}>Coba Lagi</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const trip = post.trip;
  const createdAt = new Date(post.createdAt).toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const distanceKm = trip?.distance ? (trip.distance / 1000).toFixed(2) : "-";
  const durationMs = trip?.duration || 0;
  const durationHours = Math.floor(durationMs / 3600000);
  const durationMin = Math.floor((durationMs % 3600000) / 60000);
  const durationStr =
    durationHours > 0 ? `${durationHours}j ${durationMin}m` : `${durationMin}m`;

  // Calculate average speed
  const avgSpeed =
    trip?.distance && trip?.duration
      ? (trip.distance / 1000 / (trip.duration / 3600000)).toFixed(1)
      : "-";

  const images = post.imageUrls || (post.imageUrl ? [post.imageUrl] : []);

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
          <Text style={styles.mapTitle}>Peta Rute Perjalanan</Text>
          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => setIsMapExpanded(!isMapExpanded)}
          >
            <Ionicons
              name={isMapExpanded ? "contract" : "expand"}
              size={20}
              color="#FF5A00"
            />
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.mapWrapper,
            isMapExpanded && styles.mapWrapperExpanded,
          ]}
        >
          {/* Try to render map, fallback to basic info if error */}
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
                  showsScale={true}
                  showsTraffic={false}
                  showsIndoors={false}
                  showsBuildings={true}
                  showsPointsOfInterest={true}
                >
                  {/* Route polyline */}
                  {trip.path.length > 1 && (
                    <Polyline
                      coordinates={trip.path.map((point) => ({
                        latitude: point.lat,
                        longitude: point.lng,
                      }))}
                      strokeColor="#FF5A00"
                      strokeWidth={5}
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

                  {/* Start marker */}
                  <Marker
                    coordinate={{
                      latitude: trip.path[0].lat,
                      longitude: trip.path[0].lng,
                    }}
                    title="Titik Mulai"
                    description={`Lat: ${trip.path[0].lat.toFixed(
                      4
                    )}, Lng: ${trip.path[0].lng.toFixed(4)}`}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={styles.startMarker}>
                      <Ionicons name="play-circle" size={28} color="#00FF00" />
                    </View>
                  </Marker>

                  {/* End marker - only show if different from start */}
                  {trip.path.length > 1 && (
                    <Marker
                      coordinate={{
                        latitude: trip.path[trip.path.length - 1].lat,
                        longitude: trip.path[trip.path.length - 1].lng,
                      }}
                      title="Titik Akhir"
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
                          size={28}
                          color="#FF0000"
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
                  <Text style={styles.mapFallbackText}>
                    Peta tidak tersedia
                  </Text>
                  <Text style={styles.mapFallbackSubtext}>
                    {trip.path.length} titik koordinat • {distanceKm} km
                  </Text>
                </View>
              );
            }
          })()}

          {/* Map legend */}
          <View style={styles.mapLegend}>
            <View style={styles.legendItem}>
              <View style={styles.startDot} />
              <Text style={styles.legendText}>Start</Text>
            </View>
            {trip.path.length > 1 && (
              <View style={styles.legendItem}>
                <View style={styles.endDot} />
                <Text style={styles.legendText}>End</Text>
              </View>
            )}
            {trip.path.length > 2 && (
              <View style={styles.legendItem}>
                <View style={styles.waypointLegendDot} />
                <Text style={styles.legendText}>Waypoints</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detail Post</Text>
        <TouchableOpacity style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Info */}
        <View style={styles.userSection}>
          <Ionicons name="person-circle" size={50} color="#FF5A00" />
          <View style={styles.userInfo}>
            <Text style={styles.username}>
              {post.user?.name || "Anonymous"}
            </Text>
            <Text style={styles.postDate}>{createdAt}</Text>
          </View>
        </View>

        {/* Caption */}
        <Text style={styles.caption}>{post.caption}</Text>

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

        {/* Trip Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="map" size={24} color="#FF5A00" />
            <Text style={styles.statValue}>{distanceKm} km</Text>
            <Text style={styles.statLabel}>Jarak</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="timer" size={24} color="#FF5A00" />
            <Text style={styles.statValue}>{durationStr}</Text>
            <Text style={styles.statLabel}>Durasi</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="speedometer" size={24} color="#FF5A00" />
            <Text style={styles.statValue}>{avgSpeed} km/h</Text>
            <Text style={styles.statLabel}>Kecepatan</Text>
          </View>
        </View>

        {/* Route Map */}
        {renderRouteMap()}

        {/* Trip Details */}
        <View style={styles.tripDetails}>
          <Text style={styles.sectionTitle}>Detail Perjalanan</Text>

          <View style={styles.detailRow}>
            <Ionicons name="play-circle" size={20} color="#00FF00" />
            <Text style={styles.detailLabel}>Titik Mulai:</Text>
            <Text style={styles.detailValue}>
              {trip.startPoint?.lat.toFixed(4)},{" "}
              {trip.startPoint?.lng.toFixed(4)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="stop-circle" size={20} color="#FF0000" />
            <Text style={styles.detailLabel}>Titik Akhir:</Text>
            <Text style={styles.detailValue}>
              {trip.endPoint?.lat.toFixed(4)}, {trip.endPoint?.lng.toFixed(4)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="location" size={20} color="#FF5A00" />
            <Text style={styles.detailLabel}>Total Waypoints:</Text>
            <Text style={styles.detailValue}>
              {trip.path?.length || 0} titik
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time" size={20} color="#FF5A00" />
            <Text style={styles.detailLabel}>Waktu Mulai:</Text>
            <Text style={styles.detailValue}>
              {new Date(trip.startTime).toLocaleString("id-ID")}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="checkmark-circle" size={20} color="#FF5A00" />
            <Text style={styles.detailLabel}>Waktu Selesai:</Text>
            <Text style={styles.detailValue}>
              {new Date(trip.endTime).toLocaleString("id-ID")}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.likeButton}>
            <Ionicons name="heart-outline" size={24} color="#fff" />
            <Text style={styles.buttonText}>Suka</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.commentButton}>
            <Ionicons name="chatbubble-outline" size={24} color="#fff" />
            <Text style={styles.buttonText}>Komentar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#181818",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#181818",
  },
  loadingText: {
    color: "#fff",
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#181818",
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#FF5A00",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontWeight: "bold",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  shareButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  userSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  userInfo: {
    marginLeft: 12,
  },
  username: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  postDate: {
    color: "#888",
    fontSize: 14,
    marginTop: 2,
  },
  caption: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  imageSection: {
    marginBottom: 16,
  },
  postImage: {
    width: screenWidth,
    height: 250,
    resizeMode: "cover",
  },
  imageIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#666",
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#FF5A00",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#222",
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 8,
  },
  statLabel: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
  },
  mapContainer: {
    backgroundColor: "#222",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  mapTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  expandButton: {
    backgroundColor: "#333",
    borderRadius: 6,
    padding: 6,
  },
  mapWrapper: {
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    height: 300, // Increased height for better detail view
  },
  mapWrapperExpanded: {
    height: 500, // Expanded height
  },
  mapView: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  mapSvg: {
    backgroundColor: "#333",
  },
  startMarker: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  endMarker: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  waypointMarker: {
    alignItems: "center",
    justifyContent: "center",
  },
  waypointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF5A00",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  mapLegend: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 8,
    padding: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  legendText: {
    color: "#fff",
    fontSize: 12,
    marginLeft: 8,
    fontWeight: "500",
  },
  startDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#00FF00",
  },
  endDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF0000",
  },
  waypointLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF5A00",
    borderWidth: 1,
    borderColor: "#fff",
  },
  tripDetails: {
    backgroundColor: "#222",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  detailLabel: {
    color: "#888",
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  detailValue: {
    color: "#fff",
    fontSize: 14,
    flex: 1,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  likeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF5A00",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  commentButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#333",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  mapFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
  },
  mapFallbackText: {
    fontSize: 16,
    color: "#fff",
    marginTop: 8,
    fontWeight: "500",
  },
  mapFallbackSubtext: {
    fontSize: 14,
    color: "#ccc",
    marginTop: 4,
  },
});
