import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TabNavigator from "./TabNavigator";
import RecordScreen from "../screens/RecordScreen";
import CreatePostScreen from "../screens/CreatePostScreen";
import PostScreen from "../screens/PostScreen";
import PostDetailScreen from "../screens/PostDetailScreen copy";

const Stack = createNativeStackNavigator();

export default function PostNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PostScreen" component={PostScreen} />
      <Stack.Screen name="PostDetailScreen" component={PostDetailScreen} />
    </Stack.Navigator>
  );
}
