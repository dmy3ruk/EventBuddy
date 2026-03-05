import React from "react";
import { Modal, View, TouchableOpacity, Text, StyleSheet } from "react-native";
import MapView, { Marker, MapPressEvent, Region } from "react-native-maps";

export type Location = {
  latitude: number;
  longitude: number;
};

type MapModalProps = {
  visible: boolean;
  location: Location | null;
  onChangeLocation: (location: Location) => void;
  onClose: () => void;
};

export default function MapModal({
  visible,
  location,
  onChangeLocation,
  onClose,
}: MapModalProps) {
  const initialRegion: Region = {
    latitude: location?.latitude || 50.4501,
    longitude: location?.longitude || 30.5234,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const handlePress = (e: MapPressEvent) => {
    onChangeLocation(e.nativeEvent.coordinate);
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <MapView
          style={styles.map}
          initialRegion={initialRegion}
          onPress={handlePress}
        >
          {location && <Marker coordinate={location} />}
        </MapView>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={onClose}
            disabled={!location}
          >
            <Text style={styles.confirmText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  map: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    backgroundColor: "#fff",
  },
  cancelBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  confirmBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 999,
    backgroundColor: "#505BEB",
    alignItems: "center",
  },
  confirmText: {
    color: "#fff",
  },
});

