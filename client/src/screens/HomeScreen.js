import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useContext } from "react";
import AuthContext from "../contexts/AuthContext";

export function HomeScreen() {
  const navigation = useNavigation();
  const authContext = useContext(AuthContext);

  const startQuickRecord = () => {
    Alert.alert("Start Riding", "Ready to start recording your trip?", [
      { text: "Cancel", style: "cancel" },
      { text: "Start", onPress: () => navigation.navigate("RecordScreen") },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.usernameText}>
              {authContext.user?.username || "Explorer"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate("ProfileScreen")}
          >
            <Ionicons name="person-circle" size={32} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={startQuickRecord}
            >
              <Ionicons name="play-circle" size={24} color="#000" />
              <Text style={styles.primaryActionText}>Start Riding</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Getting Started */}
        <View style={styles.gettingStartedContainer}>
          <Text style={styles.sectionTitle}>Getting Started</Text>
          <View style={styles.gettingStartedCard}>
            <Ionicons name="map" size={48} color="#007AFF" />
            <Text style={styles.gettingStartedTitle}>Start Your Journey</Text>
            <Text style={styles.gettingStartedText}>
              Record your car touring adventures, share your experiences, and
              discover new routes.
            </Text>
            <TouchableOpacity
              style={styles.gettingStartedButton}
              onPress={() => navigation.navigate("RecordScreen")}
            >
              <Text style={styles.gettingStartedButtonText}>
                Record First Trip
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  welcomeText: {
    color: "#888",
    fontSize: 14,
  },
  usernameText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 4,
  },
  profileButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
  },
  quickActionsContainer: {
    marginTop: 20,
    marginBottom: 32,
  },
  quickActions: {
    gap: 16,
  },
  primaryAction: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryActionText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: "#111",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    gap: 8,
  },
  secondaryActionText: {
    color: "#007AFF",
    fontSize: 12,
    fontWeight: "500",
  },
  gettingStartedContainer: {
    marginBottom: 32,
  },
  gettingStartedCard: {
    backgroundColor: "#111",
    padding: 32,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  gettingStartedTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 12,
  },
  gettingStartedText: {
    color: "#888",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  gettingStartedButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  gettingStartedButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
