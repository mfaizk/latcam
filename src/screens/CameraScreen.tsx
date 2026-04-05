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
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedProps } from 'react-native-reanimated';
import * as Sharing from 'expo-sharing';

import { WatermarkOverlay } from '../components/WatermarkOverlay';
import { CollapsableMenu, CollapsableMenuRef } from '../components/CollapsableMenu';
import { GalleryGrid } from '../components/GalleryGrid';
import { addExifMetadata } from '../utils/metadataHelper';
import { useMonetTheme } from '../theme/useMonetTheme';

const AnimatedCameraView = Animated.createAnimatedComponent(Camera);
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

  // ── Camera permission (vision-camera hook) ──────────────────────────────────
  const { hasPermission: cameraAllowed, requestPermission: requestCameraPermission } = useCameraPermission();

  // ── Other permission states ───────────────────────────────────────────────
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [hasMediaLibraryPermission, setHasMediaLibraryPermission] = useState(false);

  // ── Camera state ──────────────────────────────────────────────────────────
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');

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
  const [captureData, setCaptureData] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [lastSavedImage, setLastSavedImage] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);

  const device = useCameraDevice(facing);
  const cameraRef = useRef<Camera>(null);
  const menuRef = useRef<CollapsableMenuRef>(null);
  const captureStageRef = useRef<View>(null);

  const startZoom = useSharedValue(0);
  const zoomValue = useSharedValue(0);

  // ── Initialization mapping for VisionCamera Zoom ──────────────────────────
  useEffect(() => {
    if (device) {
      zoomValue.value = device.neutralZoom ?? device.minZoom ?? 1;
    }
  }, [device]);

  const animatedCameraProps = useAnimatedProps(() => ({ zoom: zoomValue.value }));

  // ── Permissions: check first, request only when needed / allowed ──────────
  useEffect(() => {
    (async () => {
      // ── Location ─────────────────────────────────────────────────────────
      const locCurrent = await Location.getForegroundPermissionsAsync();
      if (locCurrent.granted) {
        setHasLocationPermission(true);
      } else if (locCurrent.canAskAgain) {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        setHasLocationPermission(granted);
      }

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

  // ── Pre-populate thumbnail from disk on startup ───────────────────────────
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
          const g = geocode[0];
          setLocationText(g.city || g.region || g.country || 'Unknown');
        }
      });
      const locSub = Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        async (loc) => {
          setLatitude(loc.coords.latitude);
          setLongitude(loc.coords.longitude);
          const geocode = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          if (geocode.length > 0) {
            const g = geocode[0];
            setLocationText(g.city || g.region || g.country || 'Unknown');
          }
        }
      );
      return () => {
        locSub.then((sub) => sub.remove());
      };
    }
  }, [hasLocationPermission]);

  // ── Process capture using captureRef (off-screen) ─────────────────────────
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

          let savedToLibrary = false;
          try {
            if (hasMediaLibraryPermission) {
              await MediaLibrary.saveToLibraryAsync(docPath);
              savedToLibrary = true;
            }
          } catch (_) {}

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
  if (!device) {
    return <View style={[styles.container, { backgroundColor: theme.background }]} />;
  }

  if (!cameraAllowed) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.permissionCard, { backgroundColor: theme.surface }]}>
          <View style={[styles.permissionIconCircle, { backgroundColor: theme.primaryVariant }]}>
            <Ionicons name="camera" size={32} color={theme.primary} />
          </View>
          <Text style={[styles.permissionTitle, { color: theme.onSurface }]}>Camera Access Required</Text>
          <Text style={[styles.permissionSubtitle, { color: theme.onSurfaceVariant }]}>
            LatCam needs access to your camera to capture photos. Location access is optional but recommended.
          </Text>
          <TouchableOpacity
            onPress={requestCameraPermission}
            style={[styles.permissionButton, { backgroundColor: theme.primary }]}
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
      try {
        const photo = await cameraRef.current.takePhoto();
        if (photo && photo.path) {
          setCaptureData({ uri: `file://${photo.path}`, width: photo.width, height: photo.height });
        } else {
          setIsCapturing(false);
        }
      } catch (err) {
        console.error('VisionCamera capture err:', err);
        setIsCapturing(false);
      }
    }
  };

  const pinch = Gesture.Pinch()
    .onBegin(() => { startZoom.value = zoomValue.value; })
    .onUpdate((e) => {
      let nextZoom = startZoom.value * e.scale;
      zoomValue.value = Math.max(device.minZoom ?? 1, Math.min(nextZoom, device.maxZoom ?? 40));
    })
    .onEnd(() => {
      zoomValue.value = zoomValue.value;
    });

  const w = captureData?.width || 1080;
  const h = captureData?.height || 1440;
  const targetWidth  = 1080;
  const targetHeight = (h / w) * targetWidth;

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
              source={{ uri: captureData.uri }}
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
            device={device}
            isActive={true}
            photo={true}
            torch={flash === 'on' ? 'on' : 'off'}
            animatedProps={animatedCameraProps}
          />
          {/* Live watermark sibling overlay */}
          <View pointerEvents="none" style={styles.watermarkLiveContainer}>
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
        </View>
      </GestureDetector>

      {/* ── Overlay controls ──────────────────────────────────────────────── */}
      <View style={styles.overlay} pointerEvents="box-none">
        
        {/* Gallery Overlay */}
        <GalleryGrid
          isVisible={showGallery}
          onClose={() => setShowGallery(false)}
          onNewPhoto={(path) => setLastSavedImage(path)}
        />

        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.topLeft}>
            <Text style={[styles.logoText, { color: theme.onBackground }]}>LatCam</Text>
            {isCapturing && (
              <View style={styles.savingBadge}>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.savingText}>Processing</Text>
              </View>
            )}
          </View>
          <View style={styles.topRight}>
            <TouchableOpacity onPress={toggleFlash} style={[styles.iconButton, { backgroundColor: theme.surface }]}>
              <Ionicons
                name={flash === 'on' ? 'flash' : 'flash-off'}
                size={22}
                color={flash === 'on' ? '#FFD700' : theme.onSurface}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => menuRef.current?.expand()}
              style={[styles.iconButton, { backgroundColor: theme.surface }]}
            >
              <Ionicons name="settings-outline" size={24} color={theme.onSurface} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Bar Controls */}
        <View style={styles.bottomBar}>
          {/* Left: Gallery Link */}
          <View style={[styles.bottomSide, { alignItems: 'flex-start' }]}>
            <TouchableOpacity onPress={() => setShowGallery(true)} style={[styles.galleryButton, { borderColor: theme.surfaceVariant }]}>
              {lastSavedImage ? (
                <Image source={{ uri: lastSavedImage }} style={styles.thumbnailImg} resizeMode="cover" />
              ) : (
                <View style={[styles.thumbnailPlaceholder, { backgroundColor: theme.surfaceVariant }]}>
                  <Ionicons name="images-outline" size={24} color={theme.onSurfaceVariant} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Center: Shutter Button */}
          <View style={styles.bottomCenter}>
            <TouchableOpacity
              onPress={takePicture}
              disabled={isCapturing}
              style={[
                styles.captureOuter,
                { borderColor: theme.onBackground },
                isCapturing && styles.captureOuterDisabled,
              ]}
              activeOpacity={0.7}
            >
              <View style={[styles.captureInner, { backgroundColor: isCapturing ? theme.surfaceVariant : theme.onBackground }]} />
            </TouchableOpacity>
          </View>

          {/* Right: Flip Camera */}
          <View style={[styles.bottomSide, { alignItems: 'flex-end' }]}>
            <TouchableOpacity onPress={toggleCameraFacing} style={[styles.flipButton, { backgroundColor: theme.surfaceVariant }]}>
              <Ionicons name="camera-reverse" size={24} color={theme.onSurface} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Settings Panel */}
      <CollapsableMenu 
        ref={menuRef}
        showLat={showLat}     setShowLat={setShowLat}
        showLng={showLng}     setShowLng={setShowLng}
        showLoc={showLoc}     setShowLoc={setShowLoc}
        showDate={showDate}   setShowDate={setShowDate}
        showTime={showTime}   setShowTime={setShowTime}
      />
    </View>
  );
}

const MenuItem = ({ label, value, onToggle, theme }: any) => (
  <TouchableOpacity onPress={onToggle} style={[styles.menuItem, { borderBottomColor: theme.border }]}>
    <Text style={[styles.menuLabel, { color: theme.onSurface }]}>{label}</Text>
    <Ionicons name={value ? 'checkbox' : 'square-outline'} size={24} color={theme.primary} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraContainer: { flex: 1, borderRadius: 24, overflow: 'hidden', margin: 4 },
  camera: { flex: 1 },
  watermarkLiveContainer: { position: 'absolute', bottom: 150,left: 16 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50 },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoText: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  savingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  savingText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  topRight: { flexDirection: 'row', gap: 12 },
  iconButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  bottomBar: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 40, alignItems: 'center', justifyContent: 'space-between' },
  bottomSide: { flex: 1, alignItems: 'center' },
  bottomCenter: { flex: 0 },
  galleryButton: { width: 56, height: 56, borderRadius: 16, borderWidth: 2, overflow: 'hidden' },
  thumbnailImg: { width: '100%', height: '100%' },
  thumbnailPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  captureOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, justifyContent: 'center', alignItems: 'center' },
  captureOuterDisabled: { opacity: 0.5 },
  captureInner: { width: 60, height: 60, borderRadius: 30 },
  flipButton: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permissionCard: { width: '100%', padding: 32, borderRadius: 32, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 24 },
  permissionIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  permissionTitle: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  permissionSubtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  permissionButton: { paddingHorizontal: 32, paddingVertical: 16, borderRadius: 100, width: '100%', alignItems: 'center' },
  permissionButtonText: { fontSize: 16, fontWeight: '600' },
  menuTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  menuLabel: { fontSize: 16, fontWeight: '500' },
  offScreenWrapper: { ...StyleSheet.absoluteFillObject, zIndex: -1 },
});
