import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { View, Text, Switch, StyleSheet, Platform, Modal, TouchableOpacity, SafeAreaView, TouchableWithoutFeedback } from 'react-native';

export interface CollapsableMenuProps {
  showLat: boolean;
  setShowLat: (val: boolean) => void;
  showLng: boolean;
  setShowLng: (val: boolean) => void;
  showLoc: boolean;
  setShowLoc: (val: boolean) => void;
  showDate: boolean;
  setShowDate: (val: boolean) => void;
  showTime: boolean;
  setShowTime: (val: boolean) => void;
}

export interface CollapsableMenuRef {
  expand: () => void;
  close: () => void;
}

export const CollapsableMenu = forwardRef<CollapsableMenuRef, CollapsableMenuProps>((props, ref) => {
  const [visible, setVisible] = useState(false);

  useImperativeHandle(ref, () => ({
    expand: () => {
      setVisible(true);
    },
    close: () => {
      setVisible(false);
    }
  }));

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <TouchableWithoutFeedback onPress={() => setVisible(false)}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetBackground}>
              <View style={styles.dragHandle} />
              <View style={styles.contentContainer}>
                <View style={styles.header}>
                  <Text style={styles.title}>Watermark Settings</Text>
                  <TouchableOpacity onPress={() => setVisible(false)}>
                    <Text style={styles.doneText}>Done</Text>
                  </TouchableOpacity>
                </View>

                <SettingRow label="Latitude" value={props.showLat} onValueChange={props.setShowLat} />
                <SettingRow label="Longitude" value={props.showLng} onValueChange={props.setShowLng} />
                <SettingRow label="Location Address" value={props.showLoc} onValueChange={props.setShowLoc} />
                <SettingRow label="Date" value={props.showDate} onValueChange={props.setShowDate} />
                <SettingRow label="Time" value={props.showTime} onValueChange={props.setShowTime} />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

const SettingRow = ({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (val: boolean) => void }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: "#3a3a3c", true: "#0A84FF" }}
      thumbColor={Platform.OS === 'android' ? (value ? "#ffffff" : "#f4f3f4") : undefined}
      ios_backgroundColor="#3a3a3c"
    />
  </View>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetBackground: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '60%',
    paddingTop: 12,
  },
  dragHandle: {
    backgroundColor: '#48484a',
    width: 50,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 8,
  },
  contentContainer: {
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
    color: '#ffffff',
  },
  doneText: {
    color: '#0A84FF',
    fontSize: 17,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383a',
  },
  rowLabel: {
    fontSize: 17,
    fontWeight: '500',
    color: '#ffffff',
  },
});
