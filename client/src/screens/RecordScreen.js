import { useNavigation } from "@react-navigation/native";
import { useState, useEffect, useContext, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { AppleMaps, GoogleMaps } from "expo-maps";
import { AppleMapsMapType } from "expo-maps/build/apple/AppleMaps.types";
import { GoogleMapsMapType } from "expo-maps/build/google/GoogleMaps.types";
import AuthContext from "../contexts/AuthContext";
import * as SecureStore from "expo-secure-store";

const { width, height } = Dimensions.get("window");

export default function RecordScreen() {
  const navigation = useNavigation();
  const authContext = useContext(AuthContext);

  // Map ref
  const mapRef = useRef(null);

  // Recording states
  const [recordingState, setRecordingState] = useState("idle"); // idle, recording, paused
  const [currentTrip, setCurrentTrip] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);

  // Trip stats
  const [duration, setDuration] = useState(0);
  const [distance, setDistance] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);

  // Timers and intervals
  const [startTime, setStartTime] = useState(null);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [updateInterval, setUpdateInterval] = useState(null);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);

  // Map and route states
  const [routePath, setRoutePath] = useState([]);
  const [initialRegion, setInitialRegion] = useState(null);

  useEffect(() => {
    checkLocationPermission();
    return () => {
      // Cleanup on unmount
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  }, []);

  // Update duration timer
  useEffect(() => {
    let interval;
    if (recordingState === "recording" && startTime) {
      interval = setInterval(() => {
        setDuration(Date.now() - startTime);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recordingState, startTime]);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === "granted");
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Location permission is required to track your route."
        );
      }
    } catch (error) {
      console.error("Error checking location permission:", error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
    } catch (error) {
      console.error("Error getting current location:", error);
      throw error;
    }
  };

  const startTrip = async () => {
    if (!locationPermission) {
      Alert.alert("Error", "Location permission is required");
      return;
    }

    setLoading(true);
    try {
      const location = await getCurrentLocation();
      setCurrentLocation(location);

      const token = await SecureStore.getItemAsync("access_token");
      const response = await fetch("https://vroom-api.vercel.app/api/trips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startPoint: location,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentTrip(data.trip);
        setRecordingState("recording");
        setStartTime(Date.now());

        // Set initial map region
        setInitialRegion({
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });

        // Add starting point to route path
        setRoutePath([
          {
            latitude: location.lat,
            longitude: location.lng,
          },
        ]);

        startLocationTracking();

        Alert.alert("Trip Started", "Recording your route...");
      } else {
        Alert.alert("Error", data.message || "Failed to start trip");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to start trip. Please try again.");
      console.error("Start trip error:", error);
    } finally {
      setLoading(false);
    }
  };

  const startLocationTracking = async () => {
    try {
      // Watch position for speed updates
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds for UI
          distanceInterval: 10, // Update every 10 meters
        },
        (location) => {
          const newLocation = {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          };

          setCurrentLocation(newLocation);
          setCurrentSpeed(location.coords.speed || 0);

          // Add to route path for map visualization
          const newPoint = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };

          setRoutePath((prevPath) => [...prevPath, newPoint]);

          // Update map region to follow user
          if (mapRef.current && recordingState === "recording") {
            try {
              // Center map on current location with smooth animation
              const cameraPosition = {
                coordinates: {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                },
                zoom: 15,
              };

              mapRef.current.setCameraPosition(cameraPosition);
            } catch (error) {
              console.log("Map animation error:", error);
            }
          }
        }
      );
      setLocationSubscription(subscription);

      // Update path to backend every 10 seconds
      const interval = setInterval(async () => {
        if (recordingState === "recording" && currentTrip) {
          await updateTripPath();
        }
      }, 10000);
      setUpdateInterval(interval);
    } catch (error) {
      console.error("Error starting location tracking:", error);
    }
  };

  const updateTripPath = async () => {
    if (!currentTrip || !currentLocation) return;

    try {
      const token = await SecureStore.getItemAsync("access_token");
      const response = await fetch(
        `https://vroom-api.vercel.app/api/trips/${currentTrip._id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(currentLocation),
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Update local distance if backend provides it
        if (data.trip && data.trip.distance) {
          setDistance(data.trip.distance);
        }
      }
    } catch (error) {
      console.error("Error updating trip path:", error);
    }
  };

  const pauseTrip = () => {
    setRecordingState("paused");
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }
    if (updateInterval) {
      clearInterval(updateInterval);
      setUpdateInterval(null);
    }
  };

  const resumeTrip = () => {
    setRecordingState("recording");
    startLocationTracking();
  };

  const endTrip = async () => {
    if (!currentTrip || !currentLocation) return;

    Alert.alert("End Trip", "Do you want to make this trip public?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Private",
        onPress: () => finishTrip(false),
        style: "default",
      },
      {
        text: "Public",
        onPress: () => finishTrip(true),
        style: "default",
      },
    ]);
  };

  const finishTrip = async (isPublic) => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("access_token");
      const response = await fetch(
        `https://vroom-api.vercel.app/api/trips/${currentTrip._id}/end`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            endPoint: currentLocation,
            isPublic: isPublic,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        // Cleanup
        if (locationSubscription) {
          locationSubscription.remove();
          setLocationSubscription(null);
        }
        if (updateInterval) {
          clearInterval(updateInterval);
          setUpdateInterval(null);
        }

        // Reset state
        setRecordingState("idle");
        setCurrentTrip(null);
        setStartTime(null);
        setDuration(0);
        setDistance(data.trip.distance || 0);
        setRoutePath([]);
        setInitialRegion(null);

        Alert.alert(
          "Trip Completed!",
          `Distance: ${(data.trip.distance / 1000).toFixed(
            2
          )} km\nDuration: ${formatDuration(data.trip.duration)}`,
          [
            {
              text: "OK",
              onPress: () =>
                navigation.navigate("CreatePostScreen", {
                  tripData: data.trip,
                }),
            },
          ]
        );
      } else {
        Alert.alert("Error", data.message || "Failed to end trip");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to end trip. Please try again.");
      console.error("End trip error:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  const formatSpeed = (speed) => {
    // Convert m/s to km/h
    const kmh = (speed * 3.6).toFixed(1);
    return `${kmh} km/h`;
  };

  const centerMapOnCurrentLocation = () => {
    if (mapRef.current && currentLocation) {
      try {
        const cameraPosition = {
          coordinates: {
            latitude: currentLocation.lat,
            longitude: currentLocation.lng,
          },
          zoom: 15,
        };

        mapRef.current.setCameraPosition(cameraPosition);
      } catch (error) {
        console.log("Map center error:", error);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Record Trip</Text>
      </View>

      {/* Map Container */}
      {initialRegion ? (
        <View style={styles.mapContainer}>
          {Platform.OS === "ios" ? (
            <AppleMaps.View
              ref={mapRef}
              style={styles.map}
              cameraPosition={{
                coordinates: {
                  latitude: initialRegion.latitude,
                  longitude: initialRegion.longitude,
                },
                zoom: 15,
              }}
              properties={{
                isTrafficEnabled: false,
                mapType: AppleMapsMapType.STANDARD,
                selectionEnabled: true,
              }}
              polylines={
                routePath.length > 1
                  ? [
                      {
                        coordinates: routePath,
                        color: "#007AFF",
                        width: 4,
                      },
                    ]
                  : []
              }
              markers={
                currentLocation
                  ? [
                      {
                        coordinates: {
                          latitude: currentLocation.lat,
                          longitude: currentLocation.lng,
                        },
                        title: "Current Location",
                        tintColor: "red",
                        systemImage: "location.fill",
                      },
                    ]
                  : []
              }
              onMapClick={(e) => {
                console.log("Map clicked:", e);
              }}
            />
          ) : Platform.OS === "android" ? (
            <GoogleMaps.View
              ref={mapRef}
              style={styles.map}
              cameraPosition={{
                coordinates: {
                  latitude: initialRegion.latitude,
                  longitude: initialRegion.longitude,
                },
                zoom: 15,
              }}
              properties={{
                isBuildingEnabled: true,
                isIndoorEnabled: true,
                mapType: GoogleMapsMapType.NORMAL,
                selectionEnabled: true,
                isMyLocationEnabled: false,
                isTrafficEnabled: false,
              }}
              polylines={
                routePath.length > 1
                  ? [
                      {
                        coordinates: routePath,
                        color: "#007AFF",
                        width: 4,
                      },
                    ]
                  : []
              }
              markers={
                currentLocation
                  ? [
                      {
                        coordinates: {
                          latitude: currentLocation.lat,
                          longitude: currentLocation.lng,
                        },
                        title: "Current Location",
                        snippet: "You are here",
                        draggable: false,
                      },
                    ]
                  : []
              }
              onMapClick={(e) => {
                console.log("Map clicked:", e);
              }}
            />
          ) : (
            <View style={styles.mapPlaceholder}>
              <Text style={styles.mapPlaceholderText}>
                Maps only available on iOS and Android
              </Text>
            </View>
          )}

          {/* Map Controls */}
          <View style={styles.mapControls}>
            <TouchableOpacity
              style={styles.mapControlButton}
              onPress={centerMapOnCurrentLocation}
            >
              <Ionicons name="locate" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.emptyMapContainer}>
          <Ionicons name="map" size={80} color="#666" />
          <Text style={styles.emptyMapText}>Start recording to view map</Text>
        </View>
      )}

      {/* Stats Container */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Duration</Text>
          <Text style={styles.statValue}>{formatDuration(duration)}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>
            {(distance / 1000).toFixed(2)} km
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Speed</Text>
          <Text style={styles.statValue}>{formatSpeed(currentSpeed)}</Text>
        </View>
      </View>

      {/* GPS Status */}
      {recordingState !== "idle" && currentLocation && (
        <View style={styles.gpsContainer}>
          <View style={styles.gpsHeader}>
            <Ionicons name="location" size={16} color="#00ff00" />
            <Text style={styles.gpsText}>GPS Active</Text>
            <View
              style={[
                styles.statusDot,
                recordingState === "recording" && styles.statusRecording,
                recordingState === "paused" && styles.statusPaused,
              ]}
            />
          </View>
          <Text style={styles.gpsCoords}>
            {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
          </Text>
        </View>
      )}

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        {recordingState === "idle" && (
          <TouchableOpacity
            style={[styles.controlButton, styles.startButton]}
            onPress={startTrip}
            disabled={loading || !locationPermission}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="play" size={24} color="#000" />
                <Text style={styles.controlButtonText}>Start Recording</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {recordingState === "recording" && (
          <View style={styles.recordingControls}>
            <TouchableOpacity
              style={[styles.controlButton, styles.pauseButton]}
              onPress={pauseTrip}
            >
              <Ionicons name="pause" size={24} color="#fff" />
              <Text style={[styles.controlButtonText, { color: "#fff" }]}>
                Pause
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.stopButton]}
              onPress={endTrip}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="stop" size={24} color="#fff" />
                  <Text style={[styles.controlButtonText, { color: "#fff" }]}>
                    End Trip
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {recordingState === "paused" && (
          <View style={styles.recordingControls}>
            <TouchableOpacity
              style={[styles.controlButton, styles.resumeButton]}
              onPress={resumeTrip}
            >
              <Ionicons name="play" size={24} color="#000" />
              <Text style={styles.controlButtonText}>Resume</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.stopButton]}
              onPress={endTrip}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="stop" size={24} color="#fff" />
                  <Text style={[styles.controlButtonText, { color: "#fff" }]}>
                    End Trip
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Recording Status */}
      <View style={styles.statusContainer}>
        <View
          style={[
            styles.statusIndicator,
            recordingState === "recording" && styles.statusRecording,
            recordingState === "paused" && styles.statusPaused,
          ]}
        />
        <Text style={styles.statusText}>
          {recordingState === "idle" && "Ready to Record"}
          {recordingState === "recording" && "Recording..."}
          {recordingState === "paused" && "Paused"}
        </Text>
      </View>
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
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  mapContainer: {
    height: 400,
    margin: 20,
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#333",
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
  },
  mapPlaceholderText: {
    color: "#888",
    fontSize: 16,
  },
  emptyMapContainer: {
    height: 400,
    margin: 20,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  emptyMapText: {
    color: "#666",
    fontSize: 16,
    marginTop: 10,
  },
  mapControls: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  mapControlButton: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 12,
    borderRadius: 8,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#111",
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 5,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  statLabel: {
    color: "#888",
    fontSize: 14,
    marginBottom: 8,
  },
  statValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  gpsContainer: {
    backgroundColor: "#111",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  gpsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  gpsText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#888",
  },
  statusRecording: {
    backgroundColor: "#ff3b30",
  },
  statusPaused: {
    backgroundColor: "#ff9500",
  },
  gpsCoords: {
    color: "#00ff00",
    fontSize: 12,
    fontFamily: "monospace",
  },
  controlsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  startButton: {
    backgroundColor: "#fff",
  },
  pauseButton: {
    backgroundColor: "#ff9500",
  },
  resumeButton: {
    backgroundColor: "#fff",
  },
  stopButton: {
    backgroundColor: "#ff3b30",
  },
  controlButtonText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
    color: "#000",
  },
  recordingControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#888",
    marginRight: 8,
  },
  statusText: {
    color: "#888",
    fontSize: 14,
  },
});
