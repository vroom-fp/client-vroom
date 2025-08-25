import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useNavigation } from "@react-navigation/native";

export default function AIScreen() {
  const navigation = useNavigation();
  const [location, setLocation] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [tips, setTips] = useState([]);
  const [addingToWishlist, setAddingToWishlist] = useState(null); // Track which item is being added

  const generateRecommendations = async () => {
    if (!location.trim()) {
      Alert.alert("Error", "Please enter a location");
      return;
    }

    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("access_token");

      const response = await fetch(
        "https://vroom-api.vercel.app/api/ai-recommendation",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            location: location.trim(),
            source: "mobile-app",
          }),
        }
      );

      console.log("Response status:", response.status);

      // Check if response has content and handle empty responses
      let data;
      try {
        const responseText = await response.text();
        console.log("Response text:", responseText);

        if (!responseText) {
          console.log("Empty response, using sample data");
          Alert.alert(
            "Info",
            "Using sample data (API returned empty response)"
          );
          generateLocationBasedSampleData(location);
          return;
        }

        data = JSON.parse(responseText);
      } catch (parseError) {
        console.log("JSON parse error:", parseError);
        Alert.alert("Info", "Using sample data (API response format issue)");
        generateLocationBasedSampleData(location);
        return;
      }

      console.log("API Response:", data);

      if (response.ok && data.success) {
        setRecommendations(data.data.recommendations || []);
        setSummary(data.data.summary || "");
        setTips(data.data.tips || []);

        // Debug: log the first recommendation to see its structure
        if (data.data.recommendations && data.data.recommendations.length > 0) {
          console.log(
            "First recommendation structure:",
            JSON.stringify(data.data.recommendations[0], null, 2)
          );
          console.log(
            "Has wishlistData?",
            !!data.data.recommendations[0].wishlistData
          );
        }

        if (data.data.recommendations && data.data.recommendations.length > 0) {
          Alert.alert(
            "Success",
            `Found ${data.data.recommendations.length} recommendations for ${location}`
          );
        } else {
          Alert.alert("Info", "No recommendations found for this location");
        }
      } else {
        console.log("API Error:", data);

        // If AI service not configured, use mock data
        if (
          data.message === "AI service not configured properly" ||
          data.error === "AI service not configured properly"
        ) {
          Alert.alert(
            "🚧 Backend Under Development",
            `AI service sedang dalam tahap pengembangan. Menampilkan sample data untuk lokasi ${
              location || "Indonesia"
            }.`,
            [{ text: "OK", style: "default" }]
          );
          generateLocationBasedSampleData(location);
          return;
        }

        Alert.alert("Error", data.message || "Failed to get recommendations");
      }
    } catch (error) {
      console.error("Network Error:", error);
      Alert.alert(
        "📡 Connection Issue",
        `Tidak dapat terhubung ke server. Menampilkan sample data untuk lokasi ${
          location || "Indonesia"
        }.`,
        [{ text: "OK", style: "default" }]
      );
      generateLocationBasedSampleData(location);
    } finally {
      setLoading(false);
    }
  };

  const addToWishlist = async (place) => {
    try {
      setAddingToWishlist(place.name); // Set loading state for this specific item

      const token = await SecureStore.getItemAsync("access_token");
      if (!token) {
        Alert.alert("Error", "Please login first to add items to wishlist");
        return;
      }

      // Use the wishlistData from the recommendation if available, otherwise create our own
      let wishlistData;

      if (place.wishlistData) {
        // Use the wishlistData provided by the API, but ensure it's wrapped in source
        if (place.wishlistData.source) {
          wishlistData = { ...place.wishlistData };
        } else {
          wishlistData = {
            source: { ...place.wishlistData },
          };
        }
        console.log("Using provided wishlistData:", place.wishlistData);
      } else {
        // Fallback: create our own structure
        let normalizedCategory = place.category || "wisata_alam";
        if (normalizedCategory === "budaya_rekreasi") {
          normalizedCategory = "wisata_budaya";
        }

        wishlistData = {
          source: {
            name: place.name,
            category: normalizedCategory,
            type: "ai-recommendation",
            aiRecommendationId: `${location}_${place.name}_${Date.now()}`,
          },
        };

        // Only add fields if they have actual values
        if (place.description && place.description.trim()) {
          wishlistData.source.description = place.description.trim();
        }
        if (place.location && place.location.trim()) {
          wishlistData.source.location = place.location.trim();
        }
        if (place.estimatedCost && place.estimatedCost.trim()) {
          wishlistData.source.estimatedCost = place.estimatedCost.trim();
        }
        if (place.rating && Number(place.rating) > 0) {
          wishlistData.source.rating = Number(place.rating);
        }
        if (Array.isArray(place.highlights) && place.highlights.length > 0) {
          wishlistData.source.highlights = place.highlights;
        }

        console.log("Created fallback wishlistData:", wishlistData);
      }

      console.log(
        "Final wishlist data being sent:",
        JSON.stringify(wishlistData, null, 2)
      );
      console.log("Request details:");
      console.log("- URL:", "https://vroom-api.vercel.app/api/wishlist");
      console.log("- Method: POST");
      console.log("- Headers:", {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ? "[TOKEN_PRESENT]" : "[NO_TOKEN]"}`,
      });
      console.log("- Body:", JSON.stringify(wishlistData, null, 2));

      const response = await fetch(
        "https://vroom-api.vercel.app/api/wishlist",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(wishlistData),
        }
      );

      let data;
      try {
        const responseText = await response.text();
        console.log("Raw response text:", responseText);
        console.log("Response status:", response.status);
        console.log("Response headers:", response.headers);
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.log("Failed to parse response:", parseError);
        console.log("Response status:", response.status);
        throw new Error("Invalid response format from server");
      }
      console.log("Parsed wishlist API Response:", data);

      if (response.ok && data.success) {
        // Navigate to wishlist screen immediately after successful addition
        Alert.alert(
          "✅ Added to Wishlist!",
          `${place.name} has been saved to your wishlist.`,
          [
            {
              text: "View Wishlist",
              style: "default",
              onPress: () => {
                // Navigate to wishlist tab
                navigation.navigate("Wishlist");
              },
            },
            {
              text: "Continue Exploring",
              style: "cancel",
            },
          ],
          { cancelable: false }
        );
      } else {
        console.log("Wishlist API Error:", data);
        // Handle specific error cases
        if (response.status === 401) {
          Alert.alert("Authentication Error", "Please login again to continue");
        } else if (response.status === 400) {
          if (data.message === "Source data is required") {
            Alert.alert(
              "Data Error",
              "Required information is missing. Please try searching for recommendations again."
            );
          } else {
            Alert.alert(
              "Invalid Data",
              data.message || "Some required data is missing"
            );
          }
        } else if (data.message && data.message.includes("already exists")) {
          Alert.alert(
            "Already in Wishlist",
            `${place.name} is already in your wishlist!`,
            [
              {
                text: "View Wishlist",
                style: "default",
                onPress: () => {
                  navigation.navigate("Wishlist");
                },
              },
              {
                text: "OK",
                style: "cancel",
              },
            ]
          );
        } else {
          Alert.alert(
            "Error",
            data.message || "Failed to add to wishlist. Please try again."
          );
        }
      }
    } catch (error) {
      console.error("Network Error:", error);
      Alert.alert(
        "Connection Error",
        "Unable to connect to server. Please check your internet connection and try again."
      );
    } finally {
      setAddingToWishlist(null); // Clear loading state
    }
  };

  const getCategoryIcon = (category) => {
    const iconMap = {
      wisata_alam: "leaf-outline",
      wisata_budaya: "library-outline",
      wisata_religi: "business-outline",
      wisata_sejarah: "time-outline",
      wisata_buatan: "construct-outline",
      budaya_rekreasi: "library-outline", // Add this mapping
    };
    return iconMap[category] || "location-outline";
  };

  const getCategoryColor = (category) => {
    const colorMap = {
      wisata_alam: "#4CAF50",
      wisata_budaya: "#FF9800",
      wisata_religi: "#2196F3",
      wisata_sejarah: "#9C27B0",
      wisata_buatan: "#E91E63",
      budaya_rekreasi: "#FF9800", // Add this mapping
    };
    return colorMap[category] || "#757575";
  };

  const formatCategoryName = (category) => {
    return category.replace("_", " ").toUpperCase();
  };

  const generateLocationBasedSampleData = (userLocation) => {
    const locationData = {
      jakarta: {
        recommendations: [
          {
            name: "Monumen Nasional (Monas)",
            description:
              "Menara setinggi 132 meter yang menjadi simbol kemerdekaan Indonesia. Terdapat museum sejarah dan dek observasi di puncaknya.",
            location: "Jl. Silang Monas, Gambir, Jakarta Pusat",
            category: "wisata_sejarah",
            estimatedCost: "Rp 15.000 - 30.000",
            rating: 4.3,
            highlights: [
              "Pemandangan kota dari atas",
              "Museum sejarah",
              "Taman yang luas",
              "Arsitektur ikonik",
            ],
            wishlistData: {
              name: "Monumen Nasional (Monas)",
              description:
                "Menara setinggi 132 meter yang menjadi simbol kemerdekaan Indonesia.",
              location: "Jl. Silang Monas, Gambir, Jakarta Pusat",
              category: "wisata_sejarah",
              estimatedCost: "Rp 15.000 - 30.000",
              rating: 4.3,
              highlights: [
                "Pemandangan kota dari atas",
                "Museum sejarah",
                "Taman yang luas",
                "Arsitektur ikonik",
              ],
              aiRecommendationId: `${userLocation}_1`,
            },
          },
          {
            name: "Kota Tua Jakarta",
            description:
              "Kawasan bersejarah dengan arsitektur kolonial Belanda. Terdapat museum, kafe, dan area pejalan kaki yang menarik.",
            location: "Jl. Taman Fatahillah No.1, Pinangsia, Jakarta Barat",
            category: "wisata_sejarah",
            estimatedCost: "Rp 20.000 - 100.000",
            rating: 4.1,
            highlights: [
              "Arsitektur kolonial",
              "Museum Fatahillah",
              "Seni jalanan",
              "Kuliner tradisional",
            ],
            wishlistData: {
              name: "Kota Tua Jakarta",
              description:
                "Kawasan bersejarah dengan arsitektur kolonial Belanda.",
              location: "Jl. Taman Fatahillah No.1, Pinangsia, Jakarta Barat",
              category: "wisata_sejarah",
              estimatedCost: "Rp 20.000 - 100.000",
              rating: 4.1,
              highlights: [
                "Arsitektur kolonial",
                "Museum Fatahillah",
                "Seni jalanan",
                "Kuliner tradisional",
              ],
              aiRecommendationId: `${userLocation}_2`,
            },
          },
        ],
        summary: `Rekomendasi wisata di ${
          userLocation || "Jakarta"
        } mencakup tempat-tempat bersejarah dan landmark ikonik yang menggambarkan kekayaan budaya Indonesia.`,
        tips: [
          "Kunjungi pada pagi atau sore hari untuk menghindari cuaca yang terlalu panas.",
          "Gunakan transportasi umum seperti TransJakarta atau MRT untuk kemudahan akses.",
          "Bawa kamera untuk mengabadikan arsitektur dan pemandangan yang indah.",
        ],
      },
      bogor: {
        recommendations: [
          {
            name: "Kebun Raya Bogor",
            description:
              "Kebun raya tertua di Indonesia dengan koleksi flora yang beragam. Tempat yang ideal untuk bersantai dan menikmati udara segar.",
            location: "Jl. Ir. H. Juanda No.13, Paledang, Bogor Tengah",
            category: "wisata_alam",
            estimatedCost: "Rp 20.000 - 50.000",
            rating: 4.7,
            highlights: [
              "Koleksi flora langka",
              "Udara sejuk",
              "Istana Bogor",
              "Spot foto menarik",
            ],
            wishlistData: {
              name: "Kebun Raya Bogor",
              description:
                "Kebun raya tertua di Indonesia dengan koleksi flora yang beragam.",
              location: "Jl. Ir. H. Juanda No.13, Paledang, Bogor Tengah",
              category: "wisata_alam",
              estimatedCost: "Rp 20.000 - 50.000",
              rating: 4.7,
              highlights: [
                "Koleksi flora langka",
                "Udara sejuk",
                "Istana Bogor",
                "Spot foto menarik",
              ],
              aiRecommendationId: `${userLocation}_1`,
            },
          },
        ],
        summary: `Rekomendasi wisata di ${
          userLocation || "Bogor"
        } dengan fokus pada wisata alam dan udara sejuk khas kota hujan.`,
        tips: [
          "Bawa payung atau jas hujan karena Bogor sering hujan.",
          "Kunjungi pada pagi hari untuk udara yang lebih segar.",
          "Coba kuliner khas Bogor seperti asinan dan toge goreng.",
        ],
      },
    };

    const searchLocation = (userLocation || "").toLowerCase();
    let selectedData = locationData.jakarta; // default

    if (searchLocation.includes("bogor")) {
      selectedData = locationData.bogor;
    } else if (searchLocation.includes("jakarta")) {
      selectedData = locationData.jakarta;
    }

    setRecommendations(selectedData.recommendations);
    setSummary(selectedData.summary);
    setTips(selectedData.tips);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Travel Recommendations</Text>
      </View>

      {/* Search Section */}
      <View style={styles.searchSection}>
        <Text style={styles.searchLabel}>Where do you want to go?</Text>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Enter location (e.g., Bogor, Jakarta)"
            placeholderTextColor="#888"
            value={location}
            onChangeText={setLocation}
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={generateRecommendations}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Ionicons name="search" size={20} color="#000" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Results */}
      <ScrollView
        style={styles.resultsContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Loading State */}
        {loading && (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Getting recommendations...</Text>
          </View>
        )}

        {!loading && (
          <>
            {/* Summary */}
            {summary && (
              <View style={styles.summaryContainer}>
                <Text style={styles.summaryTitle}>📍 Summary</Text>
                <Text style={styles.summaryText}>{summary}</Text>
              </View>
            )}

            {/* Tips */}
            {tips.length > 0 && (
              <View style={styles.tipsContainer}>
                <Text style={styles.tipsTitle}>💡 Tips</Text>
                {tips.map((tip, index) => (
                  <Text key={index} style={styles.tipText}>
                    • {tip}
                  </Text>
                ))}
              </View>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <View style={styles.recommendationsContainer}>
                <Text style={styles.recommendationsTitle}>
                  Recommendations ({recommendations.length})
                </Text>

                {recommendations.map((place, index) => (
                  <View key={index} style={styles.placeCard}>
                    {/* Place Header */}
                    <View style={styles.placeHeader}>
                      <View style={styles.placeInfo}>
                        <Text style={styles.placeName}>{place.name}</Text>
                        <View style={styles.categoryContainer}>
                          <Ionicons
                            name={getCategoryIcon(place.category)}
                            size={16}
                            color={getCategoryColor(place.category)}
                          />
                          <Text
                            style={[
                              styles.categoryText,
                              { color: getCategoryColor(place.category) },
                            ]}
                          >
                            {formatCategoryName(place.category)}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.wishlistButton,
                          addingToWishlist === place.name &&
                            styles.wishlistButtonLoading,
                        ]}
                        onPress={() => addToWishlist(place)}
                        disabled={addingToWishlist === place.name}
                      >
                        {addingToWishlist === place.name ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons
                            name="heart-outline"
                            size={20}
                            color="#fff"
                          />
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Rating and Cost */}
                    <View style={styles.ratingCostContainer}>
                      <View style={styles.ratingContainer}>
                        <Ionicons name="star" size={16} color="#FFD700" />
                        <Text style={styles.ratingText}>{place.rating}</Text>
                      </View>
                      <Text style={styles.costText}>{place.estimatedCost}</Text>
                    </View>

                    {/* Description */}
                    <Text style={styles.description}>{place.description}</Text>

                    {/* Location */}
                    <View style={styles.locationContainer}>
                      <Ionicons
                        name="location-outline"
                        size={16}
                        color="#888"
                      />
                      <Text style={styles.locationText}>{place.location}</Text>
                    </View>

                    {/* Highlights */}
                    {place.highlights && place.highlights.length > 0 && (
                      <View style={styles.highlightsContainer}>
                        <Text style={styles.highlightsTitle}>Highlights:</Text>
                        {place.highlights.map((highlight, idx) => (
                          <Text key={idx} style={styles.highlightText}>
                            • {highlight}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Empty State */}
            {recommendations.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={64} color="#555" />
                <Text style={styles.emptyTitle}>Discover Amazing Places</Text>
                <Text style={styles.emptyText}>
                  Enter a location to get AI-powered travel recommendations
                  tailored just for you
                </Text>
                <Text style={styles.emptySubtext}>
                  Try locations like: Jakarta, Bali, Yogyakarta, Bandung
                </Text>
              </View>
            )}
          </>
        )}
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  searchSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  searchLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
  },
  searchButton: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 50,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 12,
  },
  summaryContainer: {
    backgroundColor: "#111",
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: "#ccc",
    lineHeight: 20,
  },
  tipsContainer: {
    backgroundColor: "#111",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: "#ccc",
    marginBottom: 4,
    lineHeight: 18,
  },
  recommendationsContainer: {
    marginBottom: 20,
  },
  recommendationsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  placeCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#222",
  },
  placeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  categoryContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
  },
  wishlistButton: {
    backgroundColor: "#ff4444",
    padding: 8,
    borderRadius: 8,
  },
  wishlistButtonLoading: {
    backgroundColor: "#ff6666",
    opacity: 0.7,
  },
  ratingCostContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  costText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4CAF50",
  },
  description: {
    fontSize: 14,
    color: "#ccc",
    lineHeight: 20,
    marginBottom: 12,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 12,
    color: "#888",
    flex: 1,
  },
  highlightsContainer: {
    marginTop: 8,
  },
  highlightsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  highlightText: {
    fontSize: 12,
    color: "#ccc",
    marginBottom: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    fontStyle: "italic",
  },
});
