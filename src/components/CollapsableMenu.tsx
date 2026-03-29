import React, { forwardRef, useImperativeHandle, useState } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  Platform,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
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
  const [visible, setVisible] = useState(false);
  const theme = useMonetTheme();

  useImperativeHandle(ref, () => ({
    expand: () => setVisible(true),
    close:  () => setVisible(false),
  }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
      <TouchableWithoutFeedback onPress={() => setVisible(false)}>
        <View style={[styles.backdrop, { backgroundColor: theme.scrim }]}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
              {/* Drag handle */}
              <View style={[styles.dragHandle, { backgroundColor: theme.outline }]} />

              <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                  <Text style={[styles.title, { color: theme.onSurface }]}>Watermark Settings</Text>
                  <TouchableOpacity onPress={() => setVisible(false)}>
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
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
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
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '60%',
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 24,
  },
  dragHandle: {
    width: 50,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 8,
  },
  content: {
    flex: 1,
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
