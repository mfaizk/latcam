import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions, FlashMode } from 'expo-camera';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedProps, withSpring } from 'react-native-reanimated';
import * as Sharing from 'expo-sharing';

import { WatermarkOverlay } from '../components/WatermarkOverlay';
import { CollapsableMenu, CollapsableMenuRef } from '../components/CollapsableMenu';
import { GalleryGrid } from '../components/GalleryGrid';
import { addExifMetadata } from '../utils/metadataHelper';
import { useMonetTheme } from '../theme/useMonetTheme';

const AnimatedCameraView = Animated.createAnimatedComponent(CameraView);
const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: find the most-recent latcam photo on disk (for thumbnail persistence)
// ─────────────────────────────────────────────────────────────────────────────
async function findLatestPhoto(): Promise<string | null> {
  try {
    if (!FileSystem.documentDirectory) return null;
    const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
    const latcam = files
      .filter((f) => f.startsWith('latcam_') && f.endsWith('.jpg'))
      .sort((a, b) => b.localeCompare(a)); // newest first
    if (latcam.length > 0) {
      return `${FileSystem.documentDirectory}${latcam[0]}`;
    }
  } catch (_) {}
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function CameraScreen() {
  const theme = useMonetTheme();

  // ── Camera permission (expo-camera hook) ──────────────────────────────────
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // ── Other permission states ───────────────────────────────────────────────
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [hasMediaLibraryPermission, setHasMediaLibraryPermission] = useState(false);

  // ── Camera state ──────────────────────────────────────────────────────────
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<FlashMode>('off');

  // ── Location / watermark state ────────────────────────────────────────────
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationText, setLocationText] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [showLat, setShowLat] = useState(true);
  const [showLng, setShowLng] = useState(true);
  const [showLoc, setShowLoc] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [showTime, setShowTime] = useState(true);

  // ── Capture / gallery state ───────────────────────────────────────────────
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureData, setCaptureData] = useState<{ base64: string; width: number; height: number } | null>(null);
  const [lastSavedImage, setLastSavedImage] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const menuRef = useRef<CollapsableMenuRef>(null);
  const captureStageRef = useRef<View>(null);

  const startZoom = useSharedValue(0);
  const zoomValue = useSharedValue(0);
  const animatedCameraProps = useAnimatedProps(() => ({ zoom: zoomValue.value }));

  // ── Permissions: check first, request only when needed / allowed ──────────
  useEffect(() => {
    (async () => {
      // ── Location ─────────────────────────────────────────────────────────
      // Always attempt: Expo/RN will not re-show the dialog if already granted.
      // canAskAgain guards against permanently-denied state.
      const locCurrent = await Location.getForegroundPermissionsAsync();
      if (locCurrent.granted) {
        // Already granted — use immediately, no dialog
        setHasLocationPermission(true);
      } else if (locCurrent.canAskAgain) {
        // Not granted yet but allowed to ask (first run, or user hasn't chosen yet)
        const { granted } = await Location.requestForegroundPermissionsAsync();
        setHasLocationPermission(granted);
      }
      // else: permanently denied — respect the user's choice, no dialog

      // ── Media Library ─────────────────────────────────────────────────────
      const mediaCurrent = await MediaLibrary.getPermissionsAsync();
      if (mediaCurrent.granted) {
        setHasMediaLibraryPermission(true);
      } else if (mediaCurrent.canAskAgain) {
        const { granted } = await MediaLibrary.requestPermissionsAsync();
        setHasMediaLibraryPermission(granted);
      }
    })();

    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── FIX 2: Pre-populate thumbnail from disk on startup ────────────────────
  useEffect(() => {
    findLatestPhoto().then((path) => {
      if (path) setLastSavedImage(path);
    });
  }, []);

  // ── Fetch location once permission is granted ─────────────────────────────
  useEffect(() => {
    if (hasLocationPermission) {
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(async (loc) => {
        setLatitude(loc.coords.latitude);
        setLongitude(loc.coords.longitude);
        const geocode = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geocode.length > 0) {
          const p = geocode[0];
          setLocationText(`${p.city || p.subregion}, ${p.region}, ${p.country}`);
        }
      });
    }
  }, [hasLocationPermission]);

  // ── Process capture (stamp watermark → save) ──────────────────────────────
  useEffect(() => {
    if (captureData && captureStageRef.current) {
      const processCapture = async () => {
        try {
          const stampedUri = await captureRef(captureStageRef, {
            format: 'jpg',
            quality: 0.9,
            result: 'base64',
          });

          const finalBase64 = addExifMetadata(stampedUri, latitude, longitude, currentDate);

          const fileName = `latcam_${Date.now()}.jpg`;
          const docPath = `${FileSystem.documentDirectory}${fileName}`;
          await FileSystem.writeAsStringAsync(docPath, finalBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Try saving to device photo library (works in APK build; limited in Expo Go)
          let savedToLibrary = false;
          try {
            if (hasMediaLibraryPermission) {
              await MediaLibrary.saveToLibraryAsync(docPath);
              savedToLibrary = true;
            }
          } catch (_) {
            // Expo Go media library restriction — silent, in-app gallery still works
          }

          setLastSavedImage(docPath);
          Alert.alert(
            '✅ Photo Saved',
            savedToLibrary
              ? 'Saved to your device Gallery with GPS & timestamp.'
              : 'Saved to LatCam gallery. Open in device Gallery requires a production build.',
          );
        } catch (e) {
          console.error('Save error', e);
          Alert.alert('Error', 'Could not save photo.');
        } finally {
          setIsCapturing(false);
          setCaptureData(null);
        }
      };

      setTimeout(processCapture, 500);
    }
  }, [captureData]);

  // ── Camera permission gate ────────────────────────────────────────────────
  if (!cameraPermission) {
    // Hook loading
    return <View style={[styles.container, { backgroundColor: theme.background }]} />;
  }

  if (!cameraPermission.granted) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.permissionCard, { backgroundColor: theme.surface }]}>
          <View style={[styles.permissionIconCircle, { backgroundColor: theme.primaryVariant }]}>
            <Ionicons name="camera" size={40} color={theme.primary} />
          </View>
          <Text style={[styles.permissionTitle, { color: theme.onSurface }]}>
            Camera Access Needed
          </Text>
          <Text style={[styles.permissionMessage, { color: theme.onSurfaceVariant }]}>
            LatCam needs access to your camera to capture geo-tagged photos.
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: theme.primary }]}
            onPress={requestCameraPermission}
          >
            <Text style={[styles.permissionButtonText, { color: theme.onPrimary }]}>
              Grant Camera Access
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  const toggleCameraFacing = () => setFacing((c) => (c === 'back' ? 'front' : 'back'));
  const toggleFlash       = () => setFlash((c) => (c === 'off' ? 'on' : 'off'));

  const takePicture = async () => {
    if (cameraRef.current && !isCapturing) {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.8 });
      if (photo && photo.base64) {
        setCaptureData({ base64: photo.base64, width: photo.width, height: photo.height });
      } else {
        setIsCapturing(false);
      }
    }
  };

  const pinch = Gesture.Pinch()
    .onBegin(() => { startZoom.value = zoomValue.value; })
    .onUpdate((e) => {
      let z = startZoom.value + (e.scale - 1) * 0.4;
      zoomValue.value = Math.max(0, Math.min(z, 1));
    })
    .onEnd(() => {
      zoomValue.value = withSpring(zoomValue.value, { damping: 18, stiffness: 120, mass: 0.6 });
    });

  const targetWidth  = 1080;
  const targetHeight = captureData ? (captureData.height / captureData.width) * targetWidth : 1920;

  return (
    <View style={styles.container}>
      {/* ── Off-screen capture stage ──────────────────────────────────────── */}
      {captureData && (
        <View style={styles.offScreenWrapper}>
          <View
            ref={captureStageRef}
            style={{ width: targetWidth, height: targetHeight, backgroundColor: 'black' }}
            collapsable={false}
          >
            <ImageBackground
              source={{ uri: `data:image/jpeg;base64,${captureData.base64}` }}
              style={{ width: targetWidth, height: targetHeight, justifyContent: 'flex-end', padding: 40 }}
            >
              <WatermarkOverlay
                latitude={latitude}
                longitude={longitude}
                date={currentDate}
                locationText={locationText}
                showLat={showLat}
                showLng={showLng}
                showLoc={showLoc}
                showDate={showDate}
                showTime={showTime}
                large={true}
              />
            </ImageBackground>
          </View>
        </View>
      )}

      {/* ── Camera view ───────────────────────────────────────────────────── */}
      <GestureDetector gesture={pinch}>
        <View style={styles.cameraContainer}>
          <AnimatedCameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            flash={flash}
            enableTorch={flash === 'on'}
            animatedProps={animatedCameraProps}
          >
            {/* Live watermark */}
            <View style={styles.watermarkLiveContainer}>
              <WatermarkOverlay
                latitude={latitude}
                longitude={longitude}
                date={currentDate}
                locationText={locationText}
                showLat={showLat}
                showLng={showLng}
                showLoc={showLoc}
                showDate={showDate}
                showTime={showTime}
                large={false}
              />
            </View>

            {/* Top bar */}
            <View style={styles.topBar}>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
                onPress={toggleFlash}
              >
                <Ionicons
                  name={flash === 'off' ? 'flash-off' : 'flash'}
                  size={26}
                  color="white"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
                onPress={toggleCameraFacing}
              >
                <Ionicons name="camera-reverse" size={26} color="white" />
              </TouchableOpacity>
            </View>

            {/* Bottom bar */}
            <View style={styles.bottomBar}>
              {/* FIX 2: thumbnail always visible if a photo exists */}
              {lastSavedImage ? (
                <TouchableOpacity
                  style={styles.imageThumbnail}
                  onPress={() => setShowGallery(true)}
                >
                  <Image source={{ uri: lastSavedImage }} style={styles.thumbnailImage} />
                  <View style={[styles.shareBadge, { backgroundColor: theme.primary }]}>
                    <Ionicons name="images" size={12} color="white" />
                  </View>
                </TouchableOpacity>
              ) : (
                /* Ghost placeholder keeps layout stable */
                <TouchableOpacity
                  style={[styles.imageThumbnail, styles.thumbnailGhost]}
                  onPress={() => setShowGallery(true)}
                >
                  <Ionicons name="images-outline" size={24} color="rgba(255,255,255,0.45)" />
                </TouchableOpacity>
              )}

              {/* Shutter */}
              <TouchableOpacity
                style={[styles.captureButton, { borderColor: `${theme.primary}CC` }]}
                onPress={takePicture}
                disabled={isCapturing}
              >
                {isCapturing ? (
                  <ActivityIndicator size="large" color={theme.primary} />
                ) : (
                  <View style={[styles.captureInner, { backgroundColor: theme.primary }]} />
                )}
              </TouchableOpacity>

              {/* Settings */}
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
                onPress={() => menuRef.current?.expand()}
              >
                <Ionicons name="options" size={30} color="white" />
              </TouchableOpacity>
            </View>
          </AnimatedCameraView>
        </View>
      </GestureDetector>

      {/* ── Settings sheet ────────────────────────────────────────────────── */}
      <CollapsableMenu
        ref={menuRef}
        showLat={showLat}   setShowLat={setShowLat}
        showLng={showLng}   setShowLng={setShowLng}
        showLoc={showLoc}   setShowLoc={setShowLoc}
        showDate={showDate} setShowDate={setShowDate}
        showTime={showTime} setShowTime={setShowTime}
      />

      {/* ── Gallery modal ─────────────────────────────────────────────────── */}
      <GalleryGrid
        isVisible={showGallery}
        onClose={() => setShowGallery(false)}
        onNewPhoto={(path) => setLastSavedImage(path)}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },

  // Permission screen
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionCard: {
    width: '100%',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  permissionIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 50,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Camera
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },

  topBar: {
    position: 'absolute',
    top: 55,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  iconButton: {
    padding: 11,
    borderRadius: 30,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  captureInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  watermarkLiveContainer: {
    position: 'absolute',
    bottom: 140,
    left: 16,
    zIndex: 10,
  },

  // Thumbnail
  imageThumbnail: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailGhost: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  shareBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 8,
    padding: 2,
  },

  // Off-screen
  offScreenWrapper: {
    position: 'absolute',
    top: -10000,
    left: -10000,
  },
});
