import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  SafeAreaView,
  Alert,
  PanResponder,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useMonetTheme } from '../theme/useMonetTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GalleryGridProps {
  isVisible: boolean;
  onClose: () => void;
  onNewPhoto?: (path: string) => void;
}

interface PhotoInfo {
  fileName: string;
  dateTaken: string;
  timeTaken: string;
  fileSize: string;
  uri: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_SIZE = SCREEN_WIDTH / COLUMN_COUNT;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25; // 25% of screen width to trigger nav

// ─── Helper: parse info from latcam filename ──────────────────────────────────

function parseFileName(uri: string): { fileName: string; dateTaken: string; timeTaken: string } {
  const parts = uri.split('/');
  const fileName = parts[parts.length - 1]; // e.g. latcam_1711700400000.jpg
  const match = fileName.match(/latcam_(\d+)\.jpg/);
  if (match) {
    const ts = parseInt(match[1], 10);
    const d = new Date(ts);
    return {
      fileName,
      dateTaken: d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
      timeTaken: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  }
  return { fileName, dateTaken: '—', timeTaken: '—' };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const GalleryGrid: React.FC<GalleryGridProps> = ({ isVisible, onClose, onNewPhoto }) => {
  const theme = useMonetTheme();
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [photoInfo, setPhotoInfo] = useState<PhotoInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);

  // Track pan gesture for swipe navigation
  const panStartX = useRef(0);

  const selectedPhoto = selectedIndex !== null ? photos[selectedIndex] : null;

  // ── Load photos ─────────────────────────────────────────────────────────────

  const loadPhotos = useCallback(async () => {
    try {
      if (!FileSystem.documentDirectory) return;
      const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
      const latcam = files
        .filter((f) => f.startsWith('latcam_') && f.endsWith('.jpg'))
        .sort((a, b) => b.localeCompare(a))
        .map((f) => `${FileSystem.documentDirectory}${f}`);
      setPhotos(latcam);
    } catch (e) {
      console.error('Failed to load gallery files', e);
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      loadPhotos();
    } else {
      setSelectedIndex(null);
      setShowInfoModal(false);
    }
  }, [isVisible, loadPhotos]);

  // ── Swipe PanResponder ──────────────────────────────────────────────────────

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
    onPanResponderGrant: (_, gs) => {
      panStartX.current = gs.x0;
    },
    onPanResponderRelease: (_, gs) => {
      const dx = gs.dx;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      if (dx < 0 && selectedIndex !== null && selectedIndex < photos.length - 1) {
        // swipe left → next (older)
        setSelectedIndex(selectedIndex + 1);
      } else if (dx > 0 && selectedIndex !== null && selectedIndex > 0) {
        // swipe right → previous (newer)
        setSelectedIndex(selectedIndex - 1);
      }
    },
  });

  // ── Share / Delete ──────────────────────────────────────────────────────────

  const sharePhoto = async (uri: string) => {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri);
    } else {
      Alert.alert('Error', 'Sharing is not available on this device.');
    }
  };

  const deletePhoto = (uri: string, index: number) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(uri);
              await loadPhotos();
              setShowInfoModal(false);

              // Navigate to adjacent photo or close detail
              const newPhotos = photos.filter((_, i) => i !== index);
              if (newPhotos.length === 0) {
                setSelectedIndex(null);
              } else {
                setSelectedIndex(Math.min(index, newPhotos.length - 1));
              }

              if (onNewPhoto && FileSystem.documentDirectory) {
                const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
                const remaining = files
                  .filter((f) => f.startsWith('latcam_') && f.endsWith('.jpg'))
                  .sort((a, b) => b.localeCompare(a));
                if (remaining.length > 0) {
                  onNewPhoto(`${FileSystem.documentDirectory}${remaining[0]}`);
                }
              }
            } catch (_) {
              Alert.alert('Error', 'Could not delete file.');
            }
          },
        },
      ]
    );
  };

  // ── Info modal ──────────────────────────────────────────────────────────────

  const openInfo = async (uri: string) => {
    setShowInfoModal(true);
    setInfoLoading(true);
    try {
      const { fileName, dateTaken, timeTaken } = parseFileName(uri);
      const info = await FileSystem.getInfoAsync(uri, { size: true });
      const sizeBytes = info.exists && 'size' in info ? (info.size as number) : 0;
      setPhotoInfo({
        fileName,
        dateTaken,
        timeTaken,
        fileSize: formatBytes(sizeBytes),
        uri,
      });
    } catch (_) {
      setPhotoInfo(null);
    } finally {
      setInfoLoading(false);
    }
  };

  // ── Grid item ───────────────────────────────────────────────────────────────

  const renderGridItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity onPress={() => setSelectedIndex(index)} activeOpacity={0.85}>
      <Image source={{ uri: item }} style={styles.gridImage} />
    </TouchableOpacity>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (showInfoModal) { setShowInfoModal(false); return; }
        if (selectedIndex !== null) { setSelectedIndex(null); return; }
        onClose();
      }}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        {selectedPhoto && selectedIndex !== null ? (
          // ── Full-screen detail view ────────────────────────────────────────
          <View style={styles.fullScreenContainer}>
            {/* Header */}
            <View style={styles.fullScreenHeader}>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
                onPress={() => setSelectedIndex(null)}
              >
                <Ionicons name="arrow-back" size={24} color="#ffffff" />
              </TouchableOpacity>

              {/* Counter */}
              <Text style={styles.counterText}>
                {selectedIndex + 1} / {photos.length}
              </Text>

              {/* Right-side actions */}
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
                  onPress={() => openInfo(selectedPhoto)}
                >
                  <Ionicons name="information-circle-outline" size={24} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
                  onPress={() => sharePhoto(selectedPhoto)}
                >
                  <Ionicons name="share-outline" size={24} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: 'rgba(255,59,48,0.25)' }]}
                  onPress={() => deletePhoto(selectedPhoto, selectedIndex)}
                >
                  <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Swipeable image area */}
            <View style={styles.imageArea} {...panResponder.panHandlers}>
              <Image
                source={{ uri: selectedPhoto }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />

              {/* Swipe hint arrows */}
              {selectedIndex > 0 && (
                <TouchableOpacity
                  style={[styles.navArrow, styles.navArrowLeft]}
                  onPress={() => setSelectedIndex(selectedIndex - 1)}
                >
                  <Ionicons name="chevron-back" size={28} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              )}
              {selectedIndex < photos.length - 1 && (
                <TouchableOpacity
                  style={[styles.navArrow, styles.navArrowRight]}
                  onPress={() => setSelectedIndex(selectedIndex + 1)}
                >
                  <Ionicons name="chevron-forward" size={28} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              )}
            </View>

            {/* Dot indicator */}
            {photos.length > 1 && photos.length <= 20 && (
              <View style={styles.dotRow}>
                {photos.map((_, i) => (
                  <TouchableOpacity key={i} onPress={() => setSelectedIndex(i)}>
                    <View
                      style={[
                        styles.dot,
                        i === selectedIndex
                          ? { backgroundColor: theme.primary, width: 18 }
                          : { backgroundColor: 'rgba(255,255,255,0.35)' },
                      ]}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Info bottom sheet modal */}
            <Modal
              visible={showInfoModal}
              transparent
              animationType="slide"
              onRequestClose={() => setShowInfoModal(false)}
            >
              <TouchableOpacity
                style={styles.infoBackdrop}
                activeOpacity={1}
                onPress={() => setShowInfoModal(false)}
              >
                <TouchableOpacity activeOpacity={1}>
                  <View style={[styles.infoSheet, { backgroundColor: theme.surface }]}>
                    {/* Handle */}
                    <View style={[styles.sheetHandle, { backgroundColor: theme.outline }]} />

                    <Text style={[styles.infoTitle, { color: theme.onSurface }]}>Photo Info</Text>

                    {infoLoading ? (
                      <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
                    ) : photoInfo ? (
                      <ScrollView showsVerticalScrollIndicator={false}>
                        <InfoRow
                          icon="document-text-outline"
                          label="File Name"
                          value={photoInfo.fileName}
                          theme={theme}
                        />
                        <InfoRow
                          icon="calendar-outline"
                          label="Date Taken"
                          value={photoInfo.dateTaken}
                          theme={theme}
                        />
                        <InfoRow
                          icon="time-outline"
                          label="Time Taken"
                          value={photoInfo.timeTaken}
                          theme={theme}
                        />
                        <InfoRow
                          icon="archive-outline"
                          label="File Size"
                          value={photoInfo.fileSize}
                          theme={theme}
                        />
                      </ScrollView>
                    ) : (
                      <Text style={[styles.infoError, { color: theme.onSurfaceVariant }]}>
                        Could not load photo info.
                      </Text>
                    )}

                    <TouchableOpacity
                      style={[styles.infoDoneBtn, { backgroundColor: theme.primaryVariant }]}
                      onPress={() => setShowInfoModal(false)}
                    >
                      <Text style={[styles.infoDoneText, { color: theme.primary }]}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>
          </View>
        ) : (
          // ── Grid view ────────────────────────────────────────────────────
          <View style={styles.gridContainer}>
            <View style={[styles.header, { borderBottomColor: theme.outlineVariant }]}>
              <Text style={[styles.title, { color: theme.onBackground }]}>All Photos</Text>
              <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
                <Text style={[styles.doneText, { color: theme.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>

            {photos.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconCircle, { backgroundColor: theme.surfaceVariant }]}>
                  <Ionicons name="images-outline" size={48} color={theme.onSurfaceVariant} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.onBackground }]}>No Photos Yet</Text>
                <Text style={[styles.emptySubtitle, { color: theme.onSurfaceVariant }]}>
                  Tap the shutter button to capture your first geo-tagged photo.
                </Text>
              </View>
            ) : (
              <FlatList
                data={photos}
                keyExtractor={(item) => item}
                numColumns={COLUMN_COUNT}
                renderItem={renderGridItem}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

// ─── InfoRow sub-component ────────────────────────────────────────────────────

interface InfoRowProps {
  icon: string;
  label: string;
  value: string;
  theme: ReturnType<typeof useMonetTheme>;
}

function InfoRow({ icon, label, value, theme }: InfoRowProps) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: theme.outlineVariant }]}>
      <View style={[styles.infoIconCircle, { backgroundColor: theme.surfaceVariant }]}>
        <Ionicons name={icon as any} size={18} color={theme.primary} />
      </View>
      <View style={styles.infoTextGroup}>
        <Text style={[styles.infoLabel, { color: theme.onSurfaceVariant }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: theme.onSurface }]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Grid
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 20, fontWeight: '700' },
  doneBtn: { padding: 4 },
  doneText: { fontSize: 17, fontWeight: '600' },
  gridContainer: { flex: 1 },
  gridImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

  // Full-screen
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullScreenHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? 14 : 10,
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    padding: 8,
    borderRadius: 20,
  },
  counterText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  imageArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },

  // Nav arrows
  navArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 24,
    padding: 10,
    zIndex: 5,
  },
  navArrowLeft: { left: 12 },
  navArrowRight: { right: 12 },

  // Dot indicator
  dotRow: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 5,
  },
  dot: {
    height: 6,
    width: 6,
    borderRadius: 3,
  },

  // Info modal
  infoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  infoSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 32,
    minHeight: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  infoIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTextGroup: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '500', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.6 },
  infoValue: { fontSize: 15, fontWeight: '500', flexShrink: 1 },
  infoError: { fontSize: 15, textAlign: 'center', marginTop: 24 },
  infoDoneBtn: {
    marginTop: 20,
    borderRadius: 50,
    paddingVertical: 13,
    alignItems: 'center',
  },
  infoDoneText: { fontSize: 16, fontWeight: '700' },
});
