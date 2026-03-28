import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Dimensions, ActivityIndicator, Alert, Image } from 'react-native';
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

const AnimatedCameraView = Animated.createAnimatedComponent(CameraView);

const { width } = Dimensions.get('window');

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [hasMediaLibraryPermission, setHasMediaLibraryPermission] = useState(false);

  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<FlashMode>('off');

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationText, setLocationText] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [showLat, setShowLat] = useState(true);
  const [showLng, setShowLng] = useState(true);
  const [showLoc, setShowLoc] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [showTime, setShowTime] = useState(true);

  const [isCapturing, setIsCapturing] = useState(false);
  const [captureData, setCaptureData] = useState<{ base64: string; width: number; height: number } | null>(null);
  const [lastSavedImage, setLastSavedImage] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const menuRef = useRef<CollapsableMenuRef>(null);
  const captureStageRef = useRef<View>(null);
  const startZoom = useSharedValue(0);
  const zoomValue = useSharedValue(0);

  const animatedCameraProps = useAnimatedProps(() => ({
    zoom: zoomValue.value,
  }));

  useEffect(() => {
    (async () => {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      setHasLocationPermission(locStatus === 'granted');

      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
      setHasMediaLibraryPermission(mediaStatus === 'granted');
    })();

    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (hasLocationPermission) {
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(async (location) => {
        setLatitude(location.coords.latitude);
        setLongitude(location.coords.longitude);

        const geocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (geocode.length > 0) {
          const place = geocode[0];
          setLocationText(`${place.city || place.subregion}, ${place.region}, ${place.country}`);
        }
      });
    }
  }, [hasLocationPermission]);

  useEffect(() => {
    if (captureData && captureStageRef.current) {
      // Allow the hidden view to layout
      const processCapture = async () => {
        try {
          const stampedUri = await captureRef(captureStageRef, {
            format: 'jpg',
            quality: 0.9,
            result: 'base64',
          });

          const finalBase64 = addExifMetadata(stampedUri, latitude, longitude, currentDate);

          // Save to documentDirectory for persistence (survives sessions, shown in in-app gallery)
          const fileName = `latcam_${Date.now()}.jpg`;
          const docPath = `${FileSystem.documentDirectory}${fileName}`;
          await FileSystem.writeAsStringAsync(docPath, finalBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Also try to save to device photo library
          try {
            await MediaLibrary.saveToLibraryAsync(docPath);
          } catch (_) {
            // Expo Go restricts full media library access — in-app gallery still works
          }

          setLastSavedImage(docPath);
          Alert.alert('✅ Saved', 'Photo saved to your gallery with GPS & timestamp metadata.');
        } catch (e) {
          console.error('Save error', e);
          Alert.alert("Error", "Could not save photo.");
        } finally {
          setIsCapturing(false);
          setCaptureData(null);
        }
      };

      setTimeout(processCapture, 500);
    }
  }, [captureData]);

  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleCameraFacing = () => setFacing(current => (current === 'back' ? 'front' : 'back'));
  const toggleFlash = () => setFlash(current => (current === 'off' ? 'on' : 'off'));

  const takePicture = async () => {
    if (cameraRef.current && !isCapturing) {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.8 });
      if (photo && photo.base64) {
        setCaptureData({
          base64: photo.base64,
          width: photo.width,
          height: photo.height,
        });
      } else {
        setIsCapturing(false);
      }
    }
  };

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startZoom.value = zoomValue.value;
    })
    .onUpdate((e) => {
      let newZoom = startZoom.value + (e.scale - 1) * 0.4;
      newZoom = Math.max(0, Math.min(newZoom, 1));
      zoomValue.value = newZoom;
    })
    .onEnd(() => {
      zoomValue.value = withSpring(zoomValue.value, {
        damping: 18,
        stiffness: 120,
        mass: 0.6,
      });
    });

  const openGallery = () => {
    setShowGallery(true);
  };

  // Target off-screen dimension (maintain aspect ratio to not skew but keep sane memory)
  const targetWidth = 1080;
  const targetHeight = captureData ? (captureData.height / captureData.width) * targetWidth : 1920;

  return (
    <View style={styles.container}>
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
            {/* Live watermark - small, bottom-left */}
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

            {/* Top bar: flash left, flip right */}
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.iconButton} onPress={toggleFlash}>
                <Ionicons name={flash === 'off' ? 'flash-off' : 'flash'} size={26} color="white" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={toggleCameraFacing}>
                <Ionicons name="camera-reverse" size={26} color="white" />
              </TouchableOpacity>
            </View>


            {/* Bottom bar */}
            <View style={styles.bottomBar}>
              {lastSavedImage ? (
                <TouchableOpacity style={styles.imageThumbnail} onPress={openGallery}>
                  <Image source={{ uri: lastSavedImage }} style={styles.thumbnailImage} />
                  <View style={styles.shareBadge}>
                    <Ionicons name="images" size={12} color="white" />
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.thumbnailPlaceholder} />
              )}

              <TouchableOpacity style={styles.captureButton} onPress={takePicture} disabled={isCapturing}>
                {isCapturing ? (
                  <ActivityIndicator size="large" color="#ffffff" />
                ) : (
                  <View style={styles.captureInner} />
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconButton} onPress={() => menuRef.current?.expand()}>
                <Ionicons name="options" size={30} color="white" />
              </TouchableOpacity>
            </View>
          </AnimatedCameraView>
        </View>
      </GestureDetector>

      <CollapsableMenu
        ref={menuRef}
        showLat={showLat}
        setShowLat={setShowLat}
        showLng={showLng}
        setShowLng={setShowLng}
        showLoc={showLoc}
        setShowLoc={setShowLoc}
        showDate={showDate}
        setShowDate={setShowDate}
        showTime={showTime}
        setShowTime={setShowTime}
      />

      <GalleryGrid 
        isVisible={showGallery}
        onClose={() => setShowGallery(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: 'white',
  },
  button: {
    backgroundColor: '#0A84FF',
    padding: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 11,
    borderRadius: 30,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  captureInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#ffffff',
  },
  watermarkLiveContainer: {
    position: 'absolute',
    bottom: 140,
    left: 16,
    zIndex: 10,
  },
  offScreenWrapper: {
    position: 'absolute',
    top: -10000,
    left: -10000,
  },
  imageThumbnail: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ffffff',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  shareBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0A84FF',
    borderRadius: 8,
    padding: 2,
  },
  thumbnailPlaceholder: {
    width: 52,
    height: 52,
  },
});
