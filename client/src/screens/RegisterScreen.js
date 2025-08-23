import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";

export function RegisterScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  const [input, setInput] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
  });

  const handleChange = (text, key) => {
    setInput({
      ...input,
      [key]: text,
    });
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "https://vroom-api.vercel.app/api/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        }
      );

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          "Registration Successful",
          "Your account has been created successfully. Please log in.",
          [{ text: "OK", onPress: () => navigation.navigate("LoginScreen") }]
        );
      } else {
        Alert.alert(
          "Registration Failed",
          data.message || "Registration failed. Please try again."
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
      <Text style={styles.title}>Create your account</Text>

      <View style={styles.formContainer}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={input.name}
          onChangeText={(text) => handleChange(text, "name")}
          placeholder="Enter your full name"
          placeholderTextColor="#777"
        />

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
          placeholder="Create a password"
          placeholderTextColor="#777"
          secureTextEntry={true}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>Sign up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.switchAuthContainer, loading && styles.linkDisabled]}
          onPress={() => navigation.navigate("LoginScreen")}
          disabled={loading}
        >
          <Text style={styles.switchAuthText}>Already have an account? </Text>
          <Text
            style={[
              styles.switchAuthText,
              { color: "#fff", fontWeight: "600" },
            ]}
          >
            Log in
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
    marginVertical: 20,
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
    marginTop: 20,
  },
  linkDisabled: {
    opacity: 0.5,
  },
  switchAuthText: {
    color: "#777",
    textAlign: "center",
  },
});
