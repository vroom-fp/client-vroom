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
import Svg, {
  Polyline,
  Circle,
  Defs,
  Pattern,
  Path,
  Rect,
} from "react-native-svg";

const { width: screenWidth } = Dimensions.get("window");

export default function PostDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { postId } = route.params;

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

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

    // Calculate SVG dimensions with proper margins
    const svgWidth = screenWidth - 64; // Account for container padding
    const svgHeight = 200;
    const margin = 30;

    const svgPoints = trip.path.map((point) => {
      const x =
        ((point.lng - minLng) / lngRange) * (svgWidth - 2 * margin) + margin;
      const y =
        ((maxLat - point.lat) / latRange) * (svgHeight - 2 * margin) + margin;
      return { x, y };
    });

    const firstPoint = svgPoints[0];
    const lastPoint = svgPoints[svgPoints.length - 1];

    return (
      <View style={styles.mapContainer}>
        <Text style={styles.mapTitle}>Peta Rute Perjalanan</Text>
        <View style={styles.mapWrapper}>
          <Svg height={svgHeight} width={svgWidth} style={styles.mapSvg}>
            {/* Route path */}
            <Polyline
              points={svgPoints.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#FF5A00"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Waypoints for complex routes */}
            {svgPoints.length > 2 &&
              svgPoints
                .slice(1, -1)
                .map((point, index) => (
                  <Circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill="#FF5A00"
                    opacity="0.8"
                  />
                ))}

            {/* Start marker */}
            <Circle cx={firstPoint.x} cy={firstPoint.y} r="12" fill="#00FF00" />
            <Circle cx={firstPoint.x} cy={firstPoint.y} r="6" fill="#fff" />

            {/* End marker */}
            <Circle cx={lastPoint.x} cy={lastPoint.y} r="12" fill="#FF0000" />
            <Circle cx={lastPoint.x} cy={lastPoint.y} r="6" fill="#fff" />
          </Svg>

          {/* Map legend */}
          <View style={styles.mapLegend}>
            <View style={styles.legendItem}>
              <View style={styles.startDot} />
              <Text style={styles.legendText}>Start</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.endDot} />
              <Text style={styles.legendText}>End</Text>
            </View>
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
  mapTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  mapWrapper: {
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  mapSvg: {
    backgroundColor: "#333",
  },
  mapLegend: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 6,
    padding: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  legendText: {
    color: "#fff",
    fontSize: 12,
    marginLeft: 6,
  },
  startDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00FF00",
  },
  endDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF0000",
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
});
