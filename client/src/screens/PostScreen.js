import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { Button, StyleSheet, Text, View } from "react-native";

export default function PostScreen() {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <Text>Post Screen</Text>
      <Button
        title="PostDetail"
        onPress={() => navigation.navigate("PostDetailScreen")}
      />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
