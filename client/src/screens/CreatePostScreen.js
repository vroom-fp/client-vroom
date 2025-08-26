import {
  useNavigation,
  useRoute,
  CommonActions,
} from "@react-navigation/native";
import { useState, useEffect, useContext } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AuthContext from "../contexts/AuthContext";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";

const { width, height } = Dimensions.get("window");

export default function CreatePostScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const authContext = useContext(AuthContext);

  // Get trip data from navigation params (passed from RecordScreen)
  const tripData = route.params?.tripData || null;

  // Form states
  const [caption, setCaption] = useState("");
  const [selectedImages, setSelectedImages] = useState([]);
  const [isPosting, setIsPosting] = useState(false);

  // Trip stats from params or fetch
  const [trip, setTrip] = useState(tripData);
  const [loading, setLoading] = useState(!tripData);

  useEffect(() => {
    // If no trip data passed, try to get latest trip
    if (!tripData) {
      fetchLatestTrip();
    }
  }, []);

  const fetchLatestTrip = async () => {
    try {
      const token = await SecureStore.getItemAsync("access_token");
      const response = await fetch(
        "https://vroom-api.vercel.app/api/trips/latest",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (response.ok && data.trip) {
        setTrip(data.trip);
      }
    } catch (error) {
      console.error("Error fetching latest trip:", error);
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
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  const formatDistance = (meters) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    } else {
      return `${meters.toFixed(0)} m`;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Image picker functionality
  const handleAddPhoto = async () => {
    try {
      // Show options for camera or gallery
      Alert.alert("Add Photo", "Choose how you want to add a photo", [
        {
          text: "Camera",
          onPress: () => openCamera(),
        },
        {
          text: "Gallery",
          onPress: () => openGallery(),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]);
    } catch (error) {
      console.error("Error showing photo options:", error);
      Alert.alert("Error", "Failed to open photo options");
    }
  };

  const openCamera = async () => {
    try {
      // Request camera permissions
      const cameraPermission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (cameraPermission.status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Camera permission is required to take photos"
        );
        return;
      }

      let result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8, // Reduce quality for faster upload
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImage = {
          uri: result.assets[0].uri,
          type: result.assets[0].type || "image/jpeg",
          name: result.assets[0].fileName || `photo_${Date.now()}.jpg`,
          width: result.assets[0].width,
          height: result.assets[0].height,
        };
        setSelectedImages([...selectedImages, newImage]);
      }
    } catch (error) {
      console.error("Error opening camera:", error);
      Alert.alert("Error", "Failed to open camera");
    }
  };

  const openGallery = async () => {
    try {
      // No permissions request is necessary for launching the image library
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8, // Reduce quality for faster upload
        allowsMultipleSelection: true, // Allow multiple images
      });

      console.log("Image picker result:", result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages = result.assets.map((asset, index) => ({
          uri: asset.uri,
          type: asset.type || "image/jpeg",
          name: asset.fileName || `image_${Date.now()}_${index}.jpg`,
          width: asset.width,
          height: asset.height,
        }));

        // Add new images to existing selected images (max 5 images)
        const updatedImages = [...selectedImages, ...newImages];
        if (updatedImages.length > 5) {
          Alert.alert(
            "Limit Reached",
            "You can only add up to 5 images per post"
          );
          setSelectedImages(updatedImages.slice(0, 5));
        } else {
          setSelectedImages(updatedImages);
        }
      }
    } catch (error) {
      console.error("Error opening gallery:", error);
      Alert.alert("Error", "Failed to open gallery");
    }
  };

  // Remove selected image (for future implementation)
  const removeImage = (index) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const createPost = async () => {
    if (!trip) {
      Alert.alert("Error", "No trip data available to create post");
      return;
    }

    if (!caption.trim() && selectedImages.length === 0) {
      Alert.alert("Error", "Please add a caption or photo to create a post");
      return;
    }

    setIsPosting(true);

    try {
      const token = await SecureStore.getItemAsync("access_token");

      // Create FormData for multipart/form-data
      const formData = new FormData();
      formData.append("tripId", trip._id);

      if (caption.trim()) {
        formData.append("caption", caption.trim());
      }

      // Add images to formData (for future implementation)
      selectedImages.forEach((image, index) => {
        formData.append("image", {
          uri: image.uri,
          type: image.type || "image/jpeg",
          name: image.name || `image_${index}.jpg`,
        });
      });

      const response = await fetch("https://vroom-api.vercel.app/api/post", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        // Navigate back to TabNavigator and switch to PostNavigator tab
        navigation.navigate("TabNavigator", {
          screen: "PostNavigator",
          params: { screen: "PostScreen" },
        });
      } else {
        Alert.alert("Error", data.message || "Failed to create post");
      }
    } catch (error) {
      console.error("Error creating post:", error);
      Alert.alert("Error", "Failed to create post. Please try again.");
    } finally {
      setIsPosting(false);
    }
  };

  const previewPost = () => {
    Alert.alert(
      "Post Preview",
      `Caption: ${caption || "No caption"}\nTrip: ${
        trip ? formatDistance(trip.distance) : "N/A"
      } - ${trip ? formatDuration(trip.duration) : "N/A"}\nPhotos: ${
        selectedImages.length
      } selected`,
      [
        { text: "Edit", style: "cancel" },
        { text: "Post Now", onPress: createPost },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading trip data...</Text>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Create Post</Text>
        <TouchableOpacity
          style={styles.previewButton}
          onPress={previewPost}
          disabled={!caption.trim() && selectedImages.length === 0}
        >
          <Ionicons
            name="eye"
            size={24}
            color={
              !caption.trim() && selectedImages.length === 0 ? "#666" : "#fff"
            }
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Trip Summary Card */}
        {trip && (
          <View style={styles.tripCard}>
            <View style={styles.tripHeader}>
              <Ionicons name="location" size={20} color="#007AFF" />
              <Text style={styles.tripTitle}>Trip Summary</Text>
              <View style={styles.tripDate}>
                <Text style={styles.tripDateText}>
                  {formatDate(trip.createdAt)}
                </Text>
              </View>
            </View>

            <View style={styles.tripStats}>
              <View style={styles.statItem}>
                <Ionicons name="speedometer" size={16} color="#666" />
                <Text style={styles.statLabel}>Distance</Text>
                <Text style={styles.statValue}>
                  {formatDistance(trip.distance || 0)}
                </Text>
              </View>

              <View style={styles.statItem}>
                <Ionicons name="time" size={16} color="#666" />
                <Text style={styles.statLabel}>Duration</Text>
                <Text style={styles.statValue}>
                  {formatDuration(trip.duration || 0)}
                </Text>
              </View>

              <View style={styles.statItem}>
                <Ionicons name="calendar" size={16} color="#666" />
                <Text style={styles.statLabel}>Started</Text>
                <Text style={styles.statValue}>
                  {formatTime(trip.createdAt)}
                </Text>
              </View>
            </View>

            {trip.startPoint && (
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>Route:</Text>
                <Text style={styles.routeText}>
                  {trip.startPoint.lat?.toFixed(4)},{" "}
                  {trip.startPoint.lng?.toFixed(4)}
                  {trip.endPoint &&
                    ` → ${trip.endPoint.lat?.toFixed(
                      4
                    )}, ${trip.endPoint.lng?.toFixed(4)}`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Caption Input */}
        <View style={styles.captionCard}>
          <Text style={styles.sectionTitle}>Share Your Experience</Text>
          <TextInput
            style={styles.captionInput}
            placeholder="Write about your trip... How was the route? Any interesting stops?"
            placeholderTextColor="#888"
            multiline
            numberOfLines={4}
            maxLength={500}
            value={caption}
            onChangeText={setCaption}
          />
          <Text style={styles.characterCount}>
            {caption.length}/500 characters
          </Text>
        </View>

        {/* Photo Section */}
        <View style={styles.photoCard}>
          <View style={styles.photoHeader}>
            <Text style={styles.sectionTitle}>Add Photos</Text>
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={handleAddPhoto}
            >
              <Ionicons name="camera" size={16} color="#007AFF" />
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </TouchableOpacity>
          </View>

          {selectedImages.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.photoGrid}>
                {selectedImages.map((image, index) => (
                  <View key={index} style={styles.photoItem}>
                    <Image
                      source={{ uri: image.uri }}
                      style={styles.photoImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.removePhoto}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close-circle" size={20} color="#ff3b30" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.emptyPhotoState}>
              <Ionicons name="camera-outline" size={48} color="#ccc" />
              <Text style={styles.emptyPhotoText}>No photos added yet</Text>
              <Text style={styles.emptyPhotoSubtext}>
                Tap "Add Photo" to include images of your trip
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Create Post Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[
            styles.createButton,
            !caption.trim() &&
              selectedImages.length === 0 &&
              styles.createButtonDisabled,
          ]}
          onPress={createPost}
          disabled={
            isPosting || (!caption.trim() && selectedImages.length === 0)
          }
        >
          {isPosting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#000" />
              <Text style={styles.createButtonText}>Share Post</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 16,
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  previewButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tripCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  tripHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 8,
    flex: 1,
  },
  tripDate: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tripDateText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  tripStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  statValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  routeInfo: {
    backgroundColor: "#1a1a1a",
    padding: 12,
    borderRadius: 8,
  },
  routeLabel: {
    color: "#888",
    fontSize: 12,
    marginBottom: 4,
  },
  routeText: {
    color: "#00ff00",
    fontSize: 12,
    fontFamily: "monospace",
  },
  captionCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 12,
  },
  captionInput: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 16,
    color: "#fff",
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#333",
  },
  characterCount: {
    color: "#888",
    fontSize: 12,
    textAlign: "right",
    marginTop: 8,
  },
  photoCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  photoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  addPhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  addPhotoText: {
    color: "#007AFF",
    fontSize: 14,
    marginLeft: 6,
  },
  photoGrid: {
    flexDirection: "row",
    gap: 12,
  },
  photoItem: {
    position: "relative",
  },
  photoImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  removePhoto: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#000",
    borderRadius: 10,
  },
  emptyPhotoState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyPhotoText: {
    color: "#888",
    fontSize: 16,
    marginTop: 12,
  },
  emptyPhotoSubtext: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
  },
  previewCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  postPreview: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 16,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    backgroundColor: "#333",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  previewUserInfo: {
    marginLeft: 12,
  },
  previewUsername: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  previewTime: {
    color: "#888",
    fontSize: 12,
  },
  previewCaption: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  previewImagesContainer: {
    marginBottom: 12,
  },
  previewImage: {
    width: 120,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
  },
  previewImageCount: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  previewTripInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewTripText: {
    color: "#007AFF",
    fontSize: 12,
    marginLeft: 4,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  createButton: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
  },
  createButtonDisabled: {
    backgroundColor: "#333",
  },
  createButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
