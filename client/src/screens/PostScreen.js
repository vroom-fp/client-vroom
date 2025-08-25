import React from "react";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import {
  Button,
  FlatList,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polyline } from "react-native-maps";

export default function PostScreen() {
  const navigation = useNavigation();
  const [posts, setPosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("https://vroom-api.vercel.app/api/post", {
        method: "GET",
        headers: {
          Authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4YTZmOTE5YWU1YWY2ZDk1NjYwZDZmNCIsImVtYWlsIjoicml6a2FAZ21haWwuY29tIiwiaWF0IjoxNzU1OTQ0NzI5fQ.oIUvNQsfwpxBFYfih6UyfsmdM1UiK8VcW5yJQNbSkZA",
        },
      });
      const data = await res.json();
      console.log(data);
      setPosts(data.posts || []);
    } catch (err) {
      setError("Gagal mengambil data post");
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
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="bicycle" size={48} color="#FF5A00" />
        <Text style={{ color: "#fff", marginTop: 10, fontSize: 18 }}>
          Memuat post...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={fetchPosts}>
          <Text style={styles.retryText}>Coba Lagi</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderItem = ({ item }) => {
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
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons
            name="person-circle"
            size={40}
            color="#FF5A00"
            style={{ marginRight: 12 }}
          />
          <View>
            <Text style={styles.username}>
              {item.user?.name || "Anonymous"}
            </Text>
            <Text style={styles.time}>{createdAt}</Text>
          </View>
        </View>
        <Text style={styles.caption}>{item.caption}</Text>

        {/* Route Preview - Interactive map visualization */}
        {trip?.path && trip.path.length > 0 && (
          <View style={styles.routeContainer}>
            <View style={styles.routeHeader}>
              <Ionicons name="map" size={20} color="#FF5A00" />
              <Text style={styles.routeTitle}>Rute Perjalanan</Text>
            </View>
            <View style={styles.mapContainer}>
              {/* Try to render map, fallback to basic info if error */}
              {(() => {
                try {
                  return (
                    <MapView
                      style={styles.mapView}
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
                      showsUserLocation={false}
                      showsMyLocationButton={false}
                      showsCompass={false}
                      showsScale={false}
                      showsTraffic={false}
                      showsIndoors={false}
                      showsBuildings={false}
                      showsPointsOfInterest={false}
                    >
                      {/* Route polyline - only show if we have more than 1 point */}
                      {trip.path.length > 1 && (
                        <Polyline
                          coordinates={trip.path.map((point) => ({
                            latitude: point.lat,
                            longitude: point.lng,
                          }))}
                          strokeColor="#FF5A00"
                          strokeWidth={4}
                          lineCap="round"
                          lineJoin="round"
                        />
                      )}

                      {/* Start marker */}
                      <Marker
                        coordinate={{
                          latitude: trip.path[0].lat,
                          longitude: trip.path[0].lng,
                        }}
                        title="Start"
                        description="Titik awal perjalanan"
                        anchor={{ x: 0.5, y: 0.5 }}
                      >
                        <View style={styles.startMarker}>
                          <Ionicons
                            name="play-circle"
                            size={20}
                            color="#00FF00"
                          />
                        </View>
                      </Marker>

                      {/* End marker - only show if different from start */}
                      {trip.path.length > 1 && (
                        <Marker
                          coordinate={{
                            latitude: trip.path[trip.path.length - 1].lat,
                            longitude: trip.path[trip.path.length - 1].lng,
                          }}
                          title="End"
                          description="Titik akhir perjalanan"
                          anchor={{ x: 0.5, y: 0.5 }}
                        >
                          <View style={styles.endMarker}>
                            <Ionicons
                              name="stop-circle"
                              size={20}
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
                      <Ionicons name="map-outline" size={40} color="#666" />
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

              {/* Map overlay with route info */}
              <View style={styles.mapOverlay}>
                <View style={styles.routeLabels}>
                  <View style={styles.startLabel}>
                    <Ionicons name="play-circle" size={16} color="#00FF00" />
                    <Text style={styles.pointText}>Start</Text>
                  </View>
                  {trip.path.length > 1 && (
                    <View style={styles.endLabel}>
                      <Ionicons name="stop-circle" size={16} color="#FF0000" />
                      <Text style={styles.pointText}>End</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <Text style={styles.routeInfo}>
              {trip.path.length} titik koordinat • {distanceKm} km
            </Text>
          </View>
        )}

        {/* Display images if available */}
        {(item.imageUrl || item.imageUrls) && (
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

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Ionicons name="map" size={18} color="#FF5A00" />
            <Text style={styles.statText}>{distanceKm} km</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="timer" size={18} color="#FF5A00" />
            <Text style={styles.statText}>{durationStr}</Text>
          </View>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              navigation.navigate("PostDetailScreen", { postId: item._id })
            }
          >
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#fff"
            />
            <Text style={styles.actionText}>Detail</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="heart-outline" size={20} color="#fff" />
            <Text style={styles.actionText}>Suka</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Ionicons
          name="bicycle"
          size={28}
          color="#FF5A00"
          style={{ marginRight: 8 }}
        />
        <Text style={styles.headerText}>Vroom - Post Trip</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={22} color="#FF5A00" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={posts}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <Text style={{ color: "#fff", textAlign: "center", marginTop: 40 }}>
            Belum ada post.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#181818",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    backgroundColor: "#181818",
  },
  headerText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    flex: 1,
  },
  refreshBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#222",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#181818",
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
    marginBottom: 10,
  },
  retryText: {
    color: "#FF5A00",
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: "#222",
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  username: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#fff",
    marginRight: 6,
  },
  time: {
    color: "#888",
    fontSize: 14,
  },
  caption: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
    color: "#fff",
  },
  statsRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 12,
  },
  statBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#181818",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statText: {
    color: "#FF5A00",
    fontWeight: "bold",
    fontSize: 15,
    marginLeft: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 20,
    paddingTop: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FF5A00",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  actionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 4,
  },
  routeContainer: {
    backgroundColor: "#333",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  routeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  routeTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  routeVisualization: {
    marginBottom: 8,
    position: "relative",
  },
  mapContainer: {
    height: 150,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 8,
    position: "relative",
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
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
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
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
    padding: 6,
  },
  startMarker: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 10,
    padding: 3,
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
    borderRadius: 10,
    padding: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  svgContainer: {
    marginBottom: 8,
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
  },
  routeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  startLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  endLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pointText: {
    color: "#fff",
    fontSize: 12,
  },
  routeInfo: {
    color: "#888",
    fontSize: 12,
  },
  imageContainer: {
    marginBottom: 12,
  },
  postImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
  },
  multiImageContainer: {
    flexDirection: "row",
    gap: 4,
    height: 120,
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
    fontSize: 12,
    fontWeight: "bold",
  },
});
