import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Image, Dimensions, SafeAreaView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface GalleryGridProps {
  isVisible: boolean;
  onClose: () => void;
}

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_SIZE = width / COLUMN_COUNT;

export const GalleryGrid: React.FC<GalleryGridProps> = ({ isVisible, onClose }) => {
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const loadPhotos = async () => {
    try {
      if (!FileSystem.documentDirectory) return;
      const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
      
      const latcamPhotos = files
        .filter(f => f.startsWith('latcam_') && f.endsWith('.jpg'))
        .sort((a, b) => b.localeCompare(a))
        .map(f => `${FileSystem.documentDirectory}${f}`);
        
      setPhotos(latcamPhotos);
    } catch (error) {
      console.error("Failed to load generic gallery files", error);
    }
  };

  useEffect(() => {
    if (isVisible) {
      loadPhotos();
    } else {
      setSelectedPhoto(null);
    }
  }, [isVisible]);

  const sharePhoto = async (uri: string) => {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri);
    } else {
      Alert.alert("Error", "Sharing is not available on this device.");
    }
  };

  const deletePhoto = async (uri: string) => {
    Alert.alert(
      "Delete Photo",
      "Are you sure you want to delete this photo?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(uri);
              setSelectedPhoto(null);
              loadPhotos();
            } catch(e) {
              Alert.alert("Error", "Could not delete file locally.");
            }
          }
        }
      ]
    );
  };

  const renderGridItem = ({ item }: { item: string }) => (
    <TouchableOpacity onPress={() => setSelectedPhoto(item)}>
      <Image source={{ uri: item }} style={styles.gridImage} />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (selectedPhoto) {
          setSelectedPhoto(null);
        } else {
          onClose();
        }
      }}
    >
      <SafeAreaView style={styles.container}>
        {selectedPhoto ? (
          <View style={styles.fullScreenContainer}>
            <View style={styles.fullScreenHeader}>
              <TouchableOpacity style={styles.iconButton} onPress={() => setSelectedPhoto(null)}>
                <Ionicons name="arrow-back" size={28} color="white" />
              </TouchableOpacity>
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.iconButton} onPress={() => sharePhoto(selectedPhoto)}>
                  <Ionicons name="share-outline" size={28} color="white" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => deletePhoto(selectedPhoto)}>
                  <Ionicons name="trash-outline" size={28} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
            <Image source={{ uri: selectedPhoto }} style={styles.fullScreenImage} resizeMode="contain" />
          </View>
        ) : (
          <View style={styles.gridContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>All Photos</Text>
              <TouchableOpacity onPress={onClose} style={styles.doneButton}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
            
            {photos.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="images-outline" size={64} color="#666" />
                <Text style={styles.emptyText}>No Photos Taken Yet</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  doneButton: {
    padding: 5,
  },
  doneText: {
    color: '#0A84FF',
    fontSize: 17,
    fontWeight: '600',
  },
  gridContainer: {
    flex: 1,
  },
  gridImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderWidth: 1,
    borderColor: '#000',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    marginTop: 15,
    fontSize: 16,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    zIndex: 10,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 15,
  },
  iconButton: {
    padding: 5,
  },
  fullScreenImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  }
});
