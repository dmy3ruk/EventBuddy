import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './HomeScreen';
import ProfileScreen from './ProfileScreen';
import CalendarScreen from './CalendarScreen';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {Image} from "expo-image";
import ModalScreen from "./ModalScreen";
import FriendsScreen from "./Friends";
import {getAuth} from "firebase/auth";
import {router} from "expo-router";


const Tab = createBottomTabNavigator();

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {

    getAuth().onAuthStateChanged((user)=>{
        if (!user) router.replace('/SignIn')
    })


    return (
        <View style={styles.container}>
            {state.routes.map((route, index) => {
                const isFocused = state.index === index;

                const onPress = () => {
                    if (!isFocused) navigation.navigate(route.name);
                };

                // вибір іконки
                let iconSource;
                if (route.name === "Home") iconSource = require("../../assets/images/Home 1.svg");
                if (route.name === "Calendar") iconSource = require("../../assets/images/Calender 2.svg");
                if (route.name === "AddEvent") iconSource = require("../../assets/images/Add.svg");
                if (route.name === "Profile") iconSource = require("../../assets/images/Profile Circle.svg");
                if (route.name === "Friends") iconSource = require("../../assets/images/search.svg");

                return (
                    <TouchableOpacity
                        key={index}
                        onPress={onPress}
                        style={isFocused ? styles.activeTab : styles.tab}
                    >
                        <Image
                            source={iconSource}
                            style={{ width: 30, height: 30, tintColor: isFocused ? "#fff" : "#505BEB" }}
                        />
                        {isFocused && (
                            <Text style={styles.activeText}>{route.name.toLowerCase()}</Text>
                        )}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
export default function TabLayout() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {backgroundColor: 'transparent',},
            }}
            tabBar={(props) => <CustomTabBar {...props} />}
        >

            <Tab.Screen name="Home" component={HomeScreen}/>
            <Tab.Screen name="Friends" component={FriendsScreen}/>
            <Tab.Screen name="Calendar" component={CalendarScreen}/>
            <Tab.Screen name="Profile" component={ProfileScreen}/>
        </Tab.Navigator>
    );

}


const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        height: 70,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 40,
        marginVertical: 10,
        alignSelf: 'center',   // відцентровуємо по горизонталі
        elevation: 5,
        paddingHorizontal: 10, // відступи всередині
        position: 'absolute',  // поверх усіх
        bottom: 15,
        borderWidth: 0.5,
        borderColor: "#E2E8F0"
    },
    tab: {
        marginHorizontal: 10,   // відстань між іконками
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeTab: {
        backgroundColor: '#505BEB',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 90,          // фіксуємо мінімальну ширину
    },
    activeText: {
        color: '#fff',
        marginLeft: 6,
        fontWeight: '500',
        fontSize: 14,
    },
});
