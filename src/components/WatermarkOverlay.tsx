import React from "react";
import { View, Text, StyleSheet } from "react-native";

export interface WatermarkProps {
  latitude: number | null;
  longitude: number | null;
  date: Date;
  locationText: string | null;
  showLat: boolean;
  showLng: boolean;
  showDate: boolean;
  showTime: boolean;
  showLoc: boolean;
  large?: boolean;
}

export const WatermarkOverlay: React.FC<WatermarkProps> = ({
  latitude,
  longitude,
  date,
  locationText,
  showLat,
  showLng,
  showDate,
  showTime,
  showLoc,
  large = false,
}) => {
  const formattedDate = date.toLocaleDateString();
  const formattedTime = date.toLocaleTimeString();

  const hasContent =
    (showLat && latitude !== null) ||
    (showLng && longitude !== null) ||
    (showLoc && locationText) ||
    showDate ||
    showTime;

  if (!hasContent) return null;

  const textStyle = large ? styles.textLarge : styles.textSmall;

  return (
    <View style={[styles.container, large && styles.containerLarge]}>
      {showLat && latitude !== null && (
        <Text style={textStyle} allowFontScaling={false}>
          Lat: {latitude.toFixed(6)}
        </Text>
      )}
      {showLng && longitude !== null && (
        <Text style={textStyle} allowFontScaling={false}>
          Lng: {longitude.toFixed(6)}
        </Text>
      )}
      {showLoc && locationText && (
        <Text style={textStyle} allowFontScaling={false}>
          Loc: {locationText}
        </Text>
      )}
      {showDate && (
        <Text style={textStyle} allowFontScaling={false}>
          Date: {formattedDate}
        </Text>
      )}
      {showTime && (
        <Text style={textStyle} allowFontScaling={false}>
          Time: {formattedTime}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  containerLarge: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  textSmall: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    marginBottom: 2,
  },
  textLarge: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    textShadowColor: "rgba(0, 0, 0, 0.9)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
    marginBottom: 5,
    letterSpacing: 0.3,
  },
});
