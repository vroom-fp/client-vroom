import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Image,
} from "react-native";
import { useState, useEffect, useCallback, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useFocusEffect } from "@react-navigation/native";

export default function WishlistScreen() {
  const flatListRef = useRef(null);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingItems, setRemovingItems] = useState(new Set());
  const [updatingItems, setUpdatingItems] = useState(new Set());

  useEffect(() => {
    fetchWishlist();
  }, []);

  // Refresh data when screen comes into focus (when navigating from AI screen)
  useFocusEffect(
    useCallback(() => {
      fetchWishlist();
    }, [])
  );

  const fetchWishlist = async () => {
    try {
      const token = await SecureStore.getItemAsync("access_token");
      if (!token) {
        console.log("No token found");
        setLoading(false);
        return;
      }

      console.log("Fetching wishlist from API...");
      const response = await fetch(
        "https://vroom-api.vercel.app/api/wishlist?filter=all",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("Wishlist API response status:", response.status);
      console.log("Using filter=all to get all wishlist items");

      if (response.ok) {
        const data = await response.json();
        console.log("Wishlist API response:", data);

        if (data.success && data.data) {
          // Check if data array is not empty before accessing first item
          if (data.data.length > 0) {
            console.log(
              "First wishlist item structure:",
              JSON.stringify(data.data[0], null, 2)
            );
            console.log("Item ID field available:", data.data[0]._id);
            console.log("Full item structure for debugging:", {
              _id: data.data[0]._id,
              isVisited: data.data[0].isVisited,
              userId: data.data[0].userId,
              hasSource: !!data.data[0].source,
            });
          } else {
            console.log("Wishlist is empty - no items to display");
          }

          // Sort items by creation date (newest first) only if array has items
          const sortedItems =
            data.data.length > 0
              ? data.data.sort((a, b) => {
                  const dateA = new Date(a.createdAt || 0);
                  const dateB = new Date(b.createdAt || 0);
                  return dateB - dateA;
                })
              : [];

          setWishlistItems(sortedItems);
        } else {
          console.log("API returned success: false", data);
          setWishlistItems([]);
        }
      } else {
        const errorData = await response.json();
        console.log("Wishlist API error:", errorData);
        Alert.alert("Error", errorData.message || "Failed to fetch wishlist");
        setWishlistItems([]);
      }
    } catch (error) {
      console.log("Error fetching wishlist:", error);
      // More specific error handling
      if (
        error instanceof TypeError &&
        error.message.includes("Cannot read property")
      ) {
        console.log("Data structure error - likely empty array access");
        Alert.alert(
          "Info",
          "Your wishlist is empty. Start adding places to see them here!"
        );
      } else {
        Alert.alert("Error", "Network error. Please check your connection.");
      }
      setWishlistItems([]);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (itemId) => {
    try {
      const token = await SecureStore.getItemAsync("access_token");
      if (!token) {
        Alert.alert("Error", "Please login first");
        return;
      }

      // Add to removing set for loading state
      setRemovingItems((prev) => new Set(prev).add(itemId));

      console.log("Removing item from wishlist:", itemId);
      console.log(
        "DELETE URL:",
        `https://vroom-api.vercel.app/api/wishlist?id=${itemId}`
      );

      const response = await fetch(
        `https://vroom-api.vercel.app/api/wishlist?id=${itemId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      console.log("Remove wishlist response status:", response.status);
      console.log("Remove wishlist response:", data);

      if (response.ok && data.success) {
        Alert.alert("Success", "Item removed from wishlist!");
        // Remove item from local state immediately for better UX
        setWishlistItems((prevItems) =>
          prevItems.filter((item) => item._id !== itemId)
        );
        // Also refresh data from server to ensure sync
        setTimeout(() => {
          fetchWishlist();
        }, 500);
      } else {
        Alert.alert("Error", data.message || "Failed to remove item");
      }
    } catch (error) {
      console.log("Error removing from wishlist:", error);
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      // Remove from removing set
      setRemovingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const updateVisitStatus = async (itemId, currentStatus) => {
    try {
      const token = await SecureStore.getItemAsync("access_token");
      if (!token) {
        Alert.alert("Error", "Please login first");
        return;
      }

      // Add to updating set for loading state
      setUpdatingItems((prev) => new Set(prev).add(itemId));

      const newStatus = !currentStatus; // Toggle status
      console.log("Updating visit status for item:", itemId, "to:", newStatus);
      console.log("PUT URL:", "https://vroom-api.vercel.app/api/wishlist");

      // Try different payload formats that the API might expect
      const payload = {
        wishlistId: itemId,
        isVisited: newStatus,
      };

      console.log("PUT Request payload:", JSON.stringify(payload, null, 2));

      const response = await fetch(
        "https://vroom-api.vercel.app/api/wishlist",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      console.log("PUT Request body sent:", JSON.stringify(payload, null, 2));

      const data = await response.json();
      console.log("Update visit status response status:", response.status);
      console.log("Update visit status response:", data);

      if (response.ok && data.success) {
        const statusText = newStatus
          ? "marked as visited"
          : "marked as not visited";
        Alert.alert("Success", `Item ${statusText}!`);

        // Update local state immediately for better UX
        setWishlistItems((prevItems) =>
          prevItems.map((item) =>
            item._id === itemId ? { ...item, isVisited: newStatus } : item
          )
        );

        // Also refresh data from server to ensure sync
        setTimeout(() => {
          fetchWishlist();
        }, 500);
      } else {
        console.log(
          "PUT request failed, trying alternative payload formats..."
        );

        // Try alternative format 1: _id instead of wishlistId
        const altPayload1 = {
          _id: itemId,
          isVisited: newStatus,
        };

        console.log(
          "Trying alternative payload 1:",
          JSON.stringify(altPayload1, null, 2)
        );

        const altResponse1 = await fetch(
          "https://vroom-api.vercel.app/api/wishlist",
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(altPayload1),
          }
        );

        const altData1 = await altResponse1.json();
        console.log("Alternative request 1 response:", altData1);

        if (altResponse1.ok && altData1.success) {
          const statusText = newStatus
            ? "marked as visited"
            : "marked as not visited";
          Alert.alert("Success", `Item ${statusText}!`);

          // Update local state
          setWishlistItems((prevItems) =>
            prevItems.map((item) =>
              item._id === itemId ? { ...item, isVisited: newStatus } : item
            )
          );

          setTimeout(() => {
            fetchWishlist();
          }, 500);
        } else {
          // Try alternative format 2: id instead of wishlistId
          const altPayload2 = {
            id: itemId,
            isVisited: newStatus,
          };

          console.log(
            "Trying alternative payload 2:",
            JSON.stringify(altPayload2, null, 2)
          );

          const altResponse2 = await fetch(
            "https://vroom-api.vercel.app/api/wishlist",
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(altPayload2),
            }
          );

          const altData2 = await altResponse2.json();
          console.log("Alternative request 2 response:", altData2);

          if (altResponse2.ok && altData2.success) {
            const statusText = newStatus
              ? "marked as visited"
              : "marked as not visited";
            Alert.alert("Success", `Item ${statusText}!`);

            // Update local state
            setWishlistItems((prevItems) =>
              prevItems.map((item) =>
                item._id === itemId ? { ...item, isVisited: newStatus } : item
              )
            );

            setTimeout(() => {
              fetchWishlist();
            }, 500);
          } else {
            console.log("All payload formats failed");
            Alert.alert(
              "Error",
              altData2.message ||
                data.message ||
                "Failed to update visit status"
            );
          }
        }
      }
    } catch (error) {
      console.log("Error updating visit status:", error);
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      // Remove from updating set
      setUpdatingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWishlist();
    setRefreshing(false);
  };

  const getCategoryIcon = (category) => {
    const iconMap = {
      wisata_alam: "leaf-outline",
      wisata_budaya: "library-outline",
      wisata_religi: "business-outline",
      wisata_sejarah: "time-outline",
      wisata_buatan: "construct-outline",
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
    };
    return colorMap[category] || "#757575";
  };

  const formatCategoryName = (category) => {
    if (!category) return "UNCATEGORIZED";
    return category.replace("_", " ").toUpperCase();
  };

  const renderWishlistItem = ({ item }) => {
    // Extract data from source object or use item directly for backward compatibility
    const data = item.source || item;

    // Check if item was added in the last 24 hours
    const isNewItem =
      item.createdAt &&
      new Date() - new Date(item.createdAt) < 24 * 60 * 60 * 1000;

    // Check if item is visited
    const isVisited = item.isVisited;

    // Check if item is being removed
    const isRemoving = removingItems.has(item._id);

    // Check if item is being updated
    const isUpdating = updatingItems.has(item._id);

    return (
      <View
        style={[
          styles.itemCard,
          isNewItem && styles.newItemCard,
          isVisited && styles.visitedItemCard,
        ]}
      >
        {/* New Item Badge */}
        {isNewItem && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}

        {/* Visited Status Badge */}
        {isVisited && (
          <View style={styles.visitedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.visitedBadgeText}>Visited</Text>
          </View>
        )}

        {/* Item Header */}
        <View style={styles.itemHeader}>
          <View style={styles.itemInfo}>
            <Text
              style={[styles.itemName, isVisited && styles.visitedItemName]}
              numberOfLines={2}
            >
              {data.name || "Unnamed Place"}
            </Text>
            <View style={styles.categoryContainer}>
              <Ionicons
                name={getCategoryIcon(data.category)}
                size={16}
                color={getCategoryColor(data.category)}
              />
              <Text
                style={[
                  styles.categoryText,
                  { color: getCategoryColor(data.category) },
                ]}
              >
                {formatCategoryName(data.category)}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            {/* Remove Button */}
            <TouchableOpacity
              style={[
                styles.removeButton,
                isRemoving && styles.removeButtonLoading,
              ]}
              onPress={() => {
                if (isRemoving) return; // Prevent multiple clicks
                Alert.alert(
                  "Remove from Wishlist",
                  `Are you sure you want to remove "${data.name}" from your wishlist?`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Remove",
                      style: "destructive",
                      onPress: () => removeFromWishlist(item._id),
                    },
                  ]
                );
              }}
              disabled={isRemoving}
            >
              {isRemoving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="heart" size={20} color="#ff4444" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Rating and Cost */}
        {(data.rating || data.estimatedCost) && (
          <View style={styles.ratingCostContainer}>
            {data.rating && (
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingText}>{data.rating}</Text>
              </View>
            )}
            {data.estimatedCost && (
              <Text style={styles.costText}>{data.estimatedCost}</Text>
            )}
          </View>
        )}

        {/* Description */}
        {data.description && (
          <Text style={styles.description} numberOfLines={3}>
            {data.description}
          </Text>
        )}

        {/* Location */}
        {data.location && (
          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={16} color="#888" />
            <Text style={styles.locationText} numberOfLines={2}>
              {data.location}
            </Text>
          </View>
        )}

        {/* Highlights */}
        {data.highlights && data.highlights.length > 0 && (
          <View style={styles.highlightsContainer}>
            <Text style={styles.highlightsTitle}>Highlights:</Text>
            {data.highlights.slice(0, 3).map((highlight, idx) => (
              <Text key={idx} style={styles.highlightText}>
                • {highlight}
              </Text>
            ))}
            {data.highlights.length > 3 && (
              <Text style={styles.highlightText}>
                • +{data.highlights.length - 3} more...
              </Text>
            )}
          </View>
        )}

        {/* Actions Section */}
        <View style={styles.actionsSection}>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                isVisited
                  ? styles.markUnvisitedButton
                  : styles.markVisitedButton,
                isUpdating && styles.actionButtonLoading,
              ]}
              onPress={() => {
                if (isUpdating) return;
                updateVisitStatus(item._id, isVisited);
              }}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={
                      isVisited
                        ? "close-circle-outline"
                        : "checkmark-circle-outline"
                    }
                    size={16}
                    color={isVisited ? "#ff9800" : "#4CAF50"}
                  />
                  <Text
                    style={[
                      styles.actionButtonText,
                      { color: isVisited ? "#ff9800" : "#4CAF50" },
                    ]}
                  >
                    {isVisited ? "Mark Unvisited" : "Mark Visited"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Added Date */}
        {item.createdAt && (
          <Text style={styles.dateText}>
            Added: {new Date(item.createdAt).toLocaleDateString()}
            {isNewItem && " ✨"}
          </Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Wishlist</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading your wishlist...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Wishlist</Text>
        {wishlistItems.length > 0 && (
          <View style={styles.headerStats}>
            <Text style={styles.headerSubtitle}>
              {wishlistItems.length} place
              {wishlistItems.length !== 1 ? "s" : ""} saved
            </Text>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                <Text style={styles.statText}>
                  {wishlistItems.filter((item) => item.isVisited).length}{" "}
                  visited
                </Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="bookmark-outline" size={14} color="#888" />
                <Text style={styles.statText}>
                  {wishlistItems.filter((item) => !item.isVisited).length} to
                  visit
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Wishlist Content */}
      {wishlistItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={64} color="#555" />
          <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
          <Text style={styles.emptyText}>
            Start exploring and add places you'd love to visit to your wishlist!
          </Text>
          <Text style={styles.emptySubtext}>
            Use the AI recommendations or browse posts to find amazing
            destinations
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={wishlistItems}
          renderItem={renderWishlistItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
              title="Pull to refresh"
              titleColor="#fff"
            />
          }
        />
      )}
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
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  headerStats: {
    alignItems: "center",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#888",
    marginBottom: 8,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: "#888",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 12,
  },
  listContainer: {
    padding: 20,
  },
  itemCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#222",
    position: "relative",
  },
  newItemCard: {
    borderColor: "#4CAF50",
    borderWidth: 2,
    backgroundColor: "#0a1f0a",
  },
  visitedItemCard: {
    backgroundColor: "#1a1a1a",
    borderColor: "#444",
    opacity: 0.8,
  },
  newBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#4CAF50",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
  },
  visitedBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a3a1a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1,
    gap: 4,
  },
  visitedBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingTop: 4, // Prevent visited badge overlap
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  visitedItemName: {
    color: "#aaa",
    textDecorationLine: "line-through",
    marginTop: 20, // Prevent overlap with visited badge
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
  removeButton: {
    backgroundColor: "#222",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ff4444",
  },
  removeButtonLoading: {
    backgroundColor: "#333",
    opacity: 0.7,
  },
  actionButtonsContainer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  actionsSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  actionsSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#222",
    gap: 6,
  },
  markVisitedButton: {
    borderColor: "#4CAF50",
    backgroundColor: "#0a1f0a",
  },
  markUnvisitedButton: {
    borderColor: "#ff9800",
    backgroundColor: "#1f1f0a",
  },
  actionButtonLoading: {
    backgroundColor: "#333",
    opacity: 0.7,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "600",
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
    alignItems: "flex-start",
    gap: 4,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 12,
    color: "#888",
    flex: 1,
    lineHeight: 16,
  },
  highlightsContainer: {
    marginBottom: 12,
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
  dateText: {
    fontSize: 11,
    color: "#666",
    fontStyle: "italic",
    textAlign: "right",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 20,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    fontStyle: "italic",
  },
});
