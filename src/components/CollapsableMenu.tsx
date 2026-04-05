import React, { forwardRef, useImperativeHandle, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useMonetTheme } from '../theme/useMonetTheme';

export interface CollapsableMenuProps {
  showLat: boolean;  setShowLat:  (v: boolean) => void;
  showLng: boolean;  setShowLng:  (v: boolean) => void;
  showLoc: boolean;  setShowLoc:  (v: boolean) => void;
  showDate: boolean; setShowDate: (v: boolean) => void;
  showTime: boolean; setShowTime: (v: boolean) => void;
}

export interface CollapsableMenuRef {
  expand: () => void;
  close:  () => void;
}

export const CollapsableMenu = forwardRef<CollapsableMenuRef, CollapsableMenuProps>((props, ref) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const theme = useMonetTheme();

  useImperativeHandle(ref, () => ({
    expand: () => bottomSheetRef.current?.present(),
    close:  () => bottomSheetRef.current?.dismiss(),
  }));

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      enableDynamicSizing={true}
      enablePanDownToClose={true}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.surface, borderRadius: 24 }}
      handleIndicatorStyle={{ backgroundColor: theme.outline, width: 50, height: 5 }}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: Platform.OS === 'ios' ? 40 : 24 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.onSurface }]}>Watermark Settings</Text>
          <TouchableOpacity onPress={() => bottomSheetRef.current?.dismiss()}>
             <Text style={[styles.doneText, { color: theme.primary }]}>Done</Text>
          </TouchableOpacity>
        </View>

        <SettingRow
          label="Latitude"
          value={props.showLat}
          onValueChange={props.setShowLat}
          primaryColor={theme.primary}
          labelColor={theme.onSurface}
          trackOffColor={theme.surfaceVariant}
          dividerColor={theme.outlineVariant}
        />
        <SettingRow
          label="Longitude"
          value={props.showLng}
          onValueChange={props.setShowLng}
          primaryColor={theme.primary}
          labelColor={theme.onSurface}
          trackOffColor={theme.surfaceVariant}
          dividerColor={theme.outlineVariant}
        />
        <SettingRow
          label="Location Address"
          value={props.showLoc}
          onValueChange={props.setShowLoc}
          primaryColor={theme.primary}
          labelColor={theme.onSurface}
          trackOffColor={theme.surfaceVariant}
          dividerColor={theme.outlineVariant}
        />
        <SettingRow
          label="Date"
          value={props.showDate}
          onValueChange={props.setShowDate}
          primaryColor={theme.primary}
          labelColor={theme.onSurface}
          trackOffColor={theme.surfaceVariant}
          dividerColor={theme.outlineVariant}
        />
        <SettingRow
          label="Time"
          value={props.showTime}
          onValueChange={props.setShowTime}
          primaryColor={theme.primary}
          labelColor={theme.onSurface}
          trackOffColor={theme.surfaceVariant}
          dividerColor={theme.outlineVariant}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
});

// ─── Sub-component ────────────────────────────────────────────────────────────

interface SettingRowProps {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  primaryColor: string;
  labelColor: string;
  trackOffColor: string;
  dividerColor: string;
}

const SettingRow = ({
  label, value, onValueChange,
  primaryColor, labelColor, trackOffColor, dividerColor,
}: SettingRowProps) => (
  <View style={[styles.row, { borderBottomColor: dividerColor }]}>
    <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: trackOffColor, true: primaryColor }}
      thumbColor={Platform.OS === 'android' ? (value ? '#ffffff' : '#f4f3f4') : undefined}
      ios_backgroundColor={trackOffColor}
    />
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  doneText: {
    fontSize: 17,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 17,
    fontWeight: '500',
  },
});
