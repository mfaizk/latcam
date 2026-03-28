import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import CameraScreen from './src/screens/CameraScreen';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <CameraScreen />
      </BottomSheetModalProvider>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}
