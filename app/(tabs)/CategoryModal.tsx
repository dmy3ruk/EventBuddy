import React from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
} from "react-native";

type Props = {
    visible: boolean;
    categories: string[];
    selectedCategory: string | null;
    onSelect: (cat: string) => void;
    onClose: () => void;
};

export default function CategoryModal({
                                          visible,
                                          categories,
                                          selectedCategory,
                                          onSelect,
                                          onClose,
                                      }: Props) {
    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.backdrop}>
                <View style={styles.modal}>
                    <Text style={styles.title}>Select category</Text>

                    {categories.map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                styles.item,
                                selectedCategory === cat && styles.itemActive,
                            ]}
                            onPress={() => onSelect(cat)}
                        >
                            <Text
                                style={[
                                    styles.itemText,
                                    selectedCategory === cat &&
                                    styles.itemTextActive,
                                ]}
                            >
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}

                    <TouchableOpacity style={styles.cancel} onPress={onClose}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
    },
    modal: {
        width: "100%",
        maxWidth: 360,
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 12,
        color: "#111827",
    },
    item: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 6,
    },
    itemActive: {
        backgroundColor: "#EEF2FF",
    },
    itemText: {
        fontSize: 15,
        color: "#111827",
    },
    itemTextActive: {
        fontWeight: "600",
        color: "#4F46E5",
    },
    cancel: {
        marginTop: 8,
        paddingVertical: 10,
        alignItems: "center",
    },
    cancelText: {
        color: "#6B7280",
        fontSize: 14,
    },
});
