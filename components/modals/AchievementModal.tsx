import React, { useEffect, useRef } from "react";
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";

type AchievementModalProps = {
    visible: boolean;
    title: string;
    icon: any;
    color: string;
    onClose: () => void;
};

const { width, height } = Dimensions.get("window");

export default function AchievementModal({
                                             visible,
                                             title,
                                             icon,
                                             color,
                                             onClose,
                                         }: AchievementModalProps) {
    const scale = useRef(new Animated.Value(0.75)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(40)).current;
    const iconPulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!visible) return;

        scale.setValue(0.75);
        opacity.setValue(0);
        translateY.setValue(40);
        iconPulse.setValue(1);

        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 260,
                useNativeDriver: true,
            }),

            Animated.spring(scale, {
                toValue: 1,
                useNativeDriver: true,
                friction: 5,
                tension: 85,
            }),

            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                friction: 6,
            }),

            Animated.sequence([
                Animated.timing(iconPulse, {
                    toValue: 1.15,
                    duration: 280,
                    useNativeDriver: true,
                }),

                Animated.spring(iconPulse, {
                    toValue: 1,
                    useNativeDriver: true,
                    friction: 3,
                }),
            ]),
        ]).start();
    }, [visible]);

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            hardwareAccelerated
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <LottieView
                    source={require("../../assets/animations/confetti on transparent background.json")}
                    autoPlay
                    loop={false}
                    style={styles.lottie}
                />

                <Animated.View
                    style={[
                        styles.card,
                        {
                            opacity,
                            transform: [{ scale }, { translateY }],
                        },
                    ]}
                >
                    <Animated.View
                        style={[
                            styles.iconCircle,
                            {
                                backgroundColor: "#F4F5FF",
                                transform: [{ scale: iconPulse }],
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name={icon}
                            size={50}
                            color={color}
                        />
                    </Animated.View>

                    <Text style={styles.emoji}>🎉</Text>

                    <Text style={styles.kicker}>
                        Achievement unlocked
                    </Text>

                    <Text style={styles.title}>
                        {title}
                    </Text>

                    <Text style={styles.subtitle}>
                        You earned a new badge for your activity in EventBuddy.
                    </Text>

                    <TouchableOpacity
                        style={[
                            styles.button,
                            { backgroundColor: color },
                        ]}
                        onPress={onClose}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.buttonText}>
                            Awesome!
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(15, 23, 42, 0.55)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
        overflow: "visible",
    },

    lottie: {
        position: "absolute",
        width: width,
        height: height,
        top: 0,
    },

    card: {
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: 34,
        padding: 28,
        paddingTop: 78,
        marginTop: 54,
        alignItems: "center",

        shadowColor: "#000",
        shadowOpacity: 0.22,
        shadowRadius: 20,
        elevation: 10,

        overflow: "visible",
    },

    iconCircle: {
        position: "absolute",
        top: -54,

        width: 108,
        height: 108,
        borderRadius: 38,

        justifyContent: "center",
        alignItems: "center",

        shadowColor: "#505BEB",
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
    },

    emoji: {
        fontSize: 38,
        marginBottom: 10,
    },

    kicker: {
        fontSize: 12,
        fontWeight: "800",
        color: "#64748B",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 10,
    },

    title: {
        fontSize: 30,
        fontWeight: "900",
        color: "#0F172A",
        textAlign: "center",
    },

    subtitle: {
        fontSize: 15,
        color: "#64748B",
        textAlign: "center",
        lineHeight: 22,
        marginTop: 12,
        marginBottom: 26,
    },

    button: {
        width: "100%",
        height: 54,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },

    buttonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "800",
    },
});