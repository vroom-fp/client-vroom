import { useNavigation } from "@react-navigation/native";
import { useContext, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import AuthContext from "../contexts/AuthContext";

export function LoginScreen() {
  const navigation = useNavigation();
  const authContext = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  const [input, setInput] = useState({
    email: "",
    password: "",
  });

  const handleChange = (text, key) => {
    setInput({
      ...input,
      [key]: text,
    });
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch("https://vroom-api.vercel.app/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (response.ok) {
        // Simpan token dan update auth state
        if (data.token && authContext && authContext.login) {
          await authContext.login(data.token);
        }
        // Navigation akan otomatis handle oleh App.js berdasarkan auth state
      } else {
        Alert.alert(
          "Login Failed",
          data.message || "Invalid email or password"
        );
      }
    } catch (error) {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log in to vroom</Text>

      <View style={styles.formContainer}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={input.email}
          onChangeText={(text) => handleChange(text, "email")}
          placeholder="Enter your email"
          placeholderTextColor="#777"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={input.password}
          onChangeText={(text) => handleChange(text, "password")}
          placeholder="Enter your password"
          placeholderTextColor="#777"
          secureTextEntry={true}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>Log in</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.switchAuthContainer, loading && styles.linkDisabled]}
          onPress={() => navigation.navigate("RegisterScreen")}
          disabled={loading}
        >
          <Text style={styles.switchAuthText}>Don't have an account? </Text>
          <Text
            style={[
              styles.switchAuthText,
              { color: "#fff", fontWeight: "600" },
            ]}
          >
            Sign up
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "#000",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
    color: "#fff",
  },
  formContainer: {
    width: "100%",
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: "500",
    color: "#fff",
  },
  input: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: "#111",
    color: "#fff",
  },
  button: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
    height: 50,
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  switchAuthContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  linkDisabled: {
    opacity: 0.5,
  },
  switchAuthText: {
    color: "#777",
    textAlign: "center",
  },
});
