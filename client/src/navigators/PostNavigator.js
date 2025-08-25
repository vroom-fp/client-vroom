import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PostScreen from "../screens/PostScreen";

const Stack = createNativeStackNavigator();

export default function PostNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PostScreen" component={PostScreen} />
    </Stack.Navigator>
  );
}
