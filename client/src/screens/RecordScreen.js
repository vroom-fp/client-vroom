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
import MapView, { Marker, Polyline } from "react-native-maps";
import AuthContext from "../contexts/AuthContext";
import * as SecureStore from "expo-secure-store";

const { width, height } = Dimensions.get("window");

export default function RecordScreen() {
  const navigation = useNavigation();
  const authContext = useContext(AuthContext);

  // Map ref
  const mapRef = useRef(null);

  // Refs to fix stale closure in intervals
  const recordingStateRef = useRef("idle");
  const currentTripRef = useRef(null);
  const pathPointsRef = useRef([]); // Keep for debug display only
  const lastSentTimeRef = useRef(null); // Track when we last sent a point
  const currentLocationRef = useRef(null); // Track current location

  const [recordingState, setRecordingState] = useState("idle"); // idle, recording, paused
  const [currentTrip, setCurrentTrip] = useState(null);
  const [intervalId, setIntervalId] = useState(null); // Store interval ID
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
  // Remove pathPoints state since we're sending directly to backend
  const [lastSentLocation, setLastSentLocation] = useState(null);
  const [userId, setUserId] = useState(null); // Store user ID for API calls

  useEffect(() => {
    checkLocationPermission();
    fetchUserId(); // Get user ID when component mounts
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

  // Update refs to fix stale closure problem
  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  useEffect(() => {
    currentTripRef.current = currentTrip;
  }, [currentTrip]);

  // Update ref for debug display only
  useEffect(() => {
    if (currentTrip?.path) {
      pathPointsRef.current = currentTrip.path;
    }
  }, [currentTrip?.path]);

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
          console.log("User ID fetched:", data.user._id);
        }
      }
    } catch (error) {
      console.error("Error fetching user ID:", error);
    }
  };

  // Calculate distance between two coordinates in meters
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === "granted");
      if (status === "granted") {
        // Get current location when permission is granted
        try {
          const location = await getCurrentLocation();
          setCurrentLocation(location);
          setInitialRegion({
            latitude: location.lat,
            longitude: location.lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        } catch (error) {
          console.error("Error getting initial location:", error);
        }
      } else {
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
        maximumAge: 10000, // Cache for 10 seconds
        timeout: 15000, // 15 second timeout
      });

      // Validate coordinates to ensure they're reasonable
      const lat = location.coords.latitude;
      const lng = location.coords.longitude;

      // Basic validation for Indonesia coordinates
      if (lat < -11 || lat > 6 || lng < 95 || lng > 141) {
        console.warn("GPS coordinates outside Indonesia bounds:", lat, lng);
        // Still return the coordinates but log the warning
      }

      return {
        lat: lat,
        lng: lng,
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
      // Get current location first
      let location = currentLocation;
      if (!location) {
        location = await getCurrentLocation();
        setCurrentLocation(location);
      }

      // Validate location
      if (!location || !location.lat || !location.lng) {
        throw new Error("Unable to get current location");
      }

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
        console.log("Trip started successfully:", data);
        setCurrentTrip(data.trip);
        currentTripRef.current = data.trip; // Update ref immediately
        setRecordingState("recording");
        recordingStateRef.current = "recording"; // Update ref immediately
        setStartTime(Date.now());
        lastSentTimeRef.current = null; // Reset timer for new trip
        console.log("Recording state set to: recording");
        console.log("Trip ID set to:", data.trip._id);

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

        // Initialize path points array for backend
        const startPathPoint = {
          lat: location.lat,
          lng: location.lng,
          timestamp: new Date().toISOString(),
        };
        console.log("Initial path point:", startPathPoint);
        // Don't store in local state since we send directly to backend
        console.log("Starting location - trip created with ID:", data.trip._id);
        setLastSentLocation(location);

        console.log("Starting location tracking...");
        startLocationTracking();

        // Start 5-second interval to send points
        const id = setInterval(() => {
          if (
            recordingStateRef.current === "recording" &&
            currentLocationRef.current
          ) {
            const pathPoint = {
              lat: currentLocationRef.current.lat,
              lng: currentLocationRef.current.lng,
              timestamp: new Date().toISOString(),
            };

            console.log(
              "🔴 INTERVAL: Sending point every 5 seconds:",
              pathPoint
            );
            updateTripPathDirectly(pathPoint);
          }
        }, 5000);

        setIntervalId(id);
        console.log("Started 5-second interval for sending points");

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
          //upda setiap 1 detik untuk ui nya
          timeInterval: 1000,
          //update setiap berap meter
          distanceInterval: 1,
        },
        async (location) => {
          const newLocation = {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          };

          // Validate coordinates
          if (
            newLocation.lat < -11 ||
            newLocation.lat > 6 ||
            newLocation.lng < 95 ||
            newLocation.lng > 141
          ) {
            console.warn("Invalid GPS coordinates received:", newLocation);
            return; // Skip this update
          }

          console.log("Location update:", newLocation);
          console.log("Current recording state:", recordingStateRef.current);
          setCurrentLocation(newLocation);
          currentLocationRef.current = newLocation; // Update ref for interval
          setCurrentSpeed(location.coords.speed || 0);

          // Add to route path for map visualization
          const newPoint = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };

          setRoutePath((prevPath) => {
            console.log(
              `Adding to route path. Previous length: ${prevPath.length}`
            );
            return [...prevPath, newPoint];
          });

          // Calculate distance from last sent location
          if (lastSentLocation) {
            const distance = calculateDistance(
              lastSentLocation.lat,
              lastSentLocation.lng,
              newLocation.lat,
              newLocation.lng
            );

            console.log(
              `Distance from last sent location: ${distance.toFixed(2)}m`
            );

            // Check if we should send point based on 5-second interval
            const now = Date.now();
            const timeSinceLastSent = lastSentTimeRef.current
              ? now - lastSentTimeRef.current
              : 0;
            const shouldSendByTime = timeSinceLastSent >= 5000; // 5 seconds

            console.log(
              `Time since last sent: ${(timeSinceLastSent / 1000).toFixed(1)}s`
            );

            // Send directly to backend if recording and 5 seconds have passed
            if (recordingStateRef.current === "recording" && shouldSendByTime) {
              const pathPoint = {
                lat: newLocation.lat,
                lng: newLocation.lng,
                timestamp: new Date().toISOString(),
              };

              console.log(
                `🔵 TIME THRESHOLD MET: ${(timeSinceLastSent / 1000).toFixed(
                  1
                )}s - Sending point directly to backend`,
                pathPoint
              );

              // Send directly to backend instead of storing in array
              await updateTripPathDirectly(pathPoint);
              setLastSentLocation(newLocation);
              lastSentTimeRef.current = now;
            } else if (recordingStateRef.current !== "recording") {
              console.log(
                `⚪ Not recording (state: ${recordingStateRef.current}) - not sending to backend`
              );
            } else {
              console.log(
                `⚪ Time threshold not met: ${(
                  timeSinceLastSent / 1000
                ).toFixed(1)}s < 5s - not sending to backend`
              );
            }
          } else {
            console.log("No lastSentLocation - first update");

            // If we're recording and this is the first update, set as last sent location and time
            if (recordingStateRef.current === "recording") {
              setLastSentLocation(newLocation);
              lastSentTimeRef.current = Date.now();
              console.log(
                "Set initial lastSentLocation and time for recording"
              );
            }
          }

          // Update map region to follow user
          if (mapRef.current && recordingState === "recording") {
            try {
              // Center map on current location with smooth animation
              mapRef.current.animateToRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              });
            } catch (error) {
              console.log("Map animation error:", error);
            }
          }
        }
      );
      setLocationSubscription(subscription);

      console.log(
        "Location tracking started - points will be sent directly to backend"
      );
    } catch (error) {
      console.error("Error starting location tracking:", error);
    }
  };

  // Function to send point directly to backend
  const updateTripPathDirectly = async (point) => {
    const currentTripData = currentTripRef.current;
    if (!currentTripData || !currentTripData._id || !userId) {
      console.log("Cannot send point directly - missing:", {
        trip: !!currentTripData,
        tripId: currentTripData?._id,
        userId: !!userId,
      });
      return;
    }

    try {
      const token = await SecureStore.getItemAsync("access_token");
      if (!token) {
        console.log("No token found for direct update");
        return;
      }

      console.log("Sending point directly to backend:", point);
      console.log("Using trip ID:", currentTripData._id);

      const response = await fetch(
        `https://vroom-api.vercel.app/api/trips/${currentTripData._id}/edit`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "x-user-id": userId,
          },
          body: JSON.stringify(point),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("Point added successfully to backend:", result);
        console.log(
          "Current path length:",
          result.data?.path?.length || "unknown"
        );

        // Update the current trip in state with the new path
        if (result.data) {
          setCurrentTrip(result.data);
        }
      } else {
        const errorText = await response.text();
        console.log("Direct point update failed:", response.status, errorText);
      }
    } catch (error) {
      console.log("Error sending point directly:", error);
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
    if (!currentTrip) {
      Alert.alert("Error", "No active trip found");
      return;
    }

    // Get current location before ending
    let endLocation = currentLocation;
    try {
      if (!endLocation || !endLocation.lat || !endLocation.lng) {
        console.log("Getting fresh location for trip end...");
        endLocation = await getCurrentLocation();
      }

      console.log("End location:", endLocation);
    } catch (error) {
      console.error("Failed to get end location:", error);
      Alert.alert("Error", "Unable to get current location. Please try again.");
      return;
    }

    Alert.alert("End Trip", "Do you want to make this trip public?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Private",
        onPress: () => finishTrip(false, endLocation),
        style: "default",
      },
      {
        text: "Public",
        onPress: () => finishTrip(true, endLocation),
        style: "default",
      },
    ]);
  };

  const finishTrip = async (isPublic, endLocation) => {
    setLoading(true);
    try {
      // Check if we have a valid trip using ref
      const currentTripData = currentTripRef.current;
      if (!currentTripData || !currentTripData._id) {
        console.error("No current trip found, cannot finish trip");
        Alert.alert(
          "Error",
          "No active trip found. Please start a trip first."
        );
        setLoading(false);
        return;
      }

      const token = await SecureStore.getItemAsync("access_token");
      if (!token) {
        console.error("No token found");
        Alert.alert(
          "Error",
          "Authentication token not found. Please login again."
        );
        setLoading(false);
        return;
      }

      // Check if we have userId
      if (!userId) {
        console.error("No userId found");
        Alert.alert("Error", "User ID not found. Please login again.");
        setLoading(false);
        return;
      }

      // Use the passed endLocation or get fresh location
      let locationToUse = endLocation;
      if (!locationToUse || !locationToUse.lat || !locationToUse.lng) {
        console.log("Getting fresh location in finishTrip...");
        locationToUse = await getCurrentLocation();
      }

      console.log("Final location for trip end:", locationToUse);

      // Ensure coordinates are numbers
      const endPointData = {
        lat: Number(locationToUse.lat),
        lng: Number(locationToUse.lng),
      };

      console.log("Processed endPoint data:", endPointData);

      const requestBody = {
        endPoint: endPointData,
        isPublic: isPublic,
      };

      console.log(
        "Request body being sent:",
        JSON.stringify(requestBody, null, 2)
      );
      console.log("Trip ID:", currentTripData._id);
      console.log("User ID:", userId);
      console.log(
        "API URL:",
        `https://vroom-api.vercel.app/api/trips/${currentTripData._id}/end`
      );

      // Use the /end endpoint directly as it's more appropriate for ending trips
      const response = await fetch(
        `https://vroom-api.vercel.app/api/trips/${currentTripData._id}/end`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "x-user-id": userId, // Add required header
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await response.json();
      console.log("End trip response:", data);

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

        // Clear 5-second interval
        if (intervalId) {
          clearInterval(intervalId);
          setIntervalId(null);
          console.log("Cleared 5-second interval");
        }

        // Reset state
        setRecordingState("idle");
        recordingStateRef.current = "idle";
        setCurrentTrip(null);
        currentTripRef.current = null;
        setStartTime(null);
        setDuration(0);
        lastSentTimeRef.current = null; // Reset timer

        // Handle different response structures
        let tripData = null;
        if (data.trip) {
          tripData = data.trip;
        } else if (data.data && data.data.trip) {
          tripData = data.data.trip;
        } else if (data._id) {
          // Response is the trip object directly
          tripData = data;
        }

        setDistance(tripData?.distance || 0);
        setRoutePath([]);
        setInitialRegion(null);
        setLastSentLocation(null); // Reset last sent location

        Alert.alert(
          "Trip Completed!",
          tripData
            ? `Distance: ${(tripData.distance / 1000).toFixed(
                2
              )} km\nDuration: ${formatDuration(tripData.duration)}`
            : "Trip completed successfully!",
          [
            {
              text: "OK",
              onPress: () => {
                if (tripData) {
                  navigation.navigate("CreatePostScreen", {
                    tripData: tripData,
                  });
                } else {
                  // Navigate back if no trip data
                  navigation.goBack();
                }
              },
            },
          ]
        );
      } else {
        console.error("API Error Response:", data);
        Alert.alert("Error", data.message || "Failed to end trip");
      }
    } catch (error) {
      console.error("End trip error:", error);
      Alert.alert("Error", "Failed to end trip. Please try again.");
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
        mapRef.current.animateToRegion({
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
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
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsTraffic={false}
            mapType="standard"
            onPress={(e) => {
              console.log("Map clicked:", e.nativeEvent.coordinate);
            }}
          >
            {/* Polyline for route */}
            {routePath.length > 1 && (
              <Polyline
                coordinates={routePath}
                strokeColor="#007AFF"
                strokeWidth={4}
                lineCap="round"
                lineJoin="round"
              />
            )}

            {/* Current location marker */}
            {currentLocation && (
              <Marker
                coordinate={{
                  latitude: currentLocation.lat,
                  longitude: currentLocation.lng,
                }}
                title="Current Location"
                description="You are here"
                pinColor="red"
              />
            )}
          </MapView>

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
          <Text style={styles.gpsCoords}>
            Path Points: {currentTrip?.path?.length || 0} | Route:{" "}
            {routePath.length}
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
