import {Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, View} from 'react-native'
import React, {useState} from 'react'
import {auth, db} from '../FirebaseConfig'
import {createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile} from 'firebase/auth'
import {Link, router} from 'expo-router'
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";


const SignUp = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(''); // нове поле для імені


    const signUp = async () => {
        try {
            const trimmedName = name.trim();
            const nameLower = trimmedName.toLowerCase();

            if (!trimmedName || !email || !password) {
                alert("All fields are required");
                return;
            }

            // 1) Перевірка унікальності
            const usernamesRef = collection(db, "usernames");
            const q = query(usernamesRef, where("usernameLower", "==", nameLower));
            const snap = await getDocs(q);

            if (!snap.empty) {
                alert("This username is already taken. Please choose another.");
                return;
            }

            // 2) Створення юзера
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCred.user;

            // 3) Зберігання даних юзера
            await setDoc(doc(db, "usernames", user.uid), {
                username: trimmedName,
                usernameLower: nameLower,
                email,
                createdAt: new Date(),
            });

            router.replace("/(tabs)/HomeScreen");

        } catch (error: any) {
            alert("Sign-up failed: " + error.message);
        }
    };



    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.signIn}>
                <View style={styles.welcomeView}>
                    <Text style={styles.headline}>Welcome</Text>
                    <Text style={{color: "#6E7D93", textAlign:'center'}}>Sign in to continue planning your next great moment</Text>
                </View>
                <View style={{gap:20}}>
                    <View>
                        <Text>Name</Text>
                        <TextInput
                            style={styles.signInInput}
                            placeholder="Your name"
                            placeholderTextColor="#B7BFCA"
                            value={name}
                            onChangeText={setName}
                        />
                    </View>

                    <View>
                <Text>Email</Text>
                <TextInput style={styles.signInInput} placeholder="email" value={email} placeholderTextColor="#B7BFCA"
                           onChangeText={setEmail}/>
                </View>

                <View>
                <Text>Password</Text>
                <TextInput style={styles.signInInput} placeholder="password" placeholderTextColor="#B7BFCA"
                           value={password} onChangeText={setPassword} secureTextEntry/>
                </View>

                </View>
                <TouchableOpacity style={styles.signInButton} onPress={signUp}>
                    <Text>Login</Text>
                </TouchableOpacity>

                <Text style={{color: '#6E7D93'}}>
                    {"Already have an account? "}
                    <Text
                        style={{color:"#505BEB", fontWeight:"bold"}}
                        onPress={() => router.push('/SignIn')}
                    >
                        Sign In
                    </Text>
                </Text>
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    headline: {
        height: 36,
        fontFamily: 'Inter',
        fontStyle: 'normal',
        fontWeight: '700',
        fontSize: 24,
        lineHeight: 36,
        textAlign: 'center',
        color: '#000000',
        flexGrow: 0,
    },
    signInButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
        borderWidth: 0.5,
        borderColor: '#D6D6D6',
        borderRadius: 8,
        backgroundColor: '#505BEB',
        width: 330,
        height: 48,
    },
    signInText: {
        fontFamily: 'Inter',
        fontWeight: '400',
        fontSize: 12,
        lineHeight: 28,
        color: '#FFFFFF',
    },
    signInInput: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        gap: 8, // Підтримується в нових версіях RN або можна через margin
        width: 330,
        height: 48,
        backgroundColor: '#F8F9FA',
        borderWidth: 0.5,
        borderColor: '#D6D6D6',
        borderRadius: 8,
    },
    forgotPassword: {
        fontFamily: 'Inter',
        fontWeight: '400',
        fontSize: 12,
        lineHeight: 15,
        color: 'rgba(80,91,235,0.59)',
    },
    frame: {
        position: 'absolute',
        top: 210,
        left: 31,
        width: 330,
        height: 268,
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: 0,
        // gap: 20, // або робити marginBottom на дочірніх елементах
    },
    signIn: {
        backgroundColor:"white",
        gap: 24,
        flexDirection: 'column',
        alignItems: 'center',
        padding: 0,
        // gap не завжди підтримується, можна робити marginBottom на дочірніх елементах
    },
    welcomeView: {
        backgroundColor:"white",
        flexDirection: 'column',
        textAlign: 'center',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 0,
        paddingBottom: 1.5,
        paddingHorizontal: 16,
        gap: 16, // Підтримується в нових версіях RN або можна робити marginBottom
        alignSelf: 'stretch',
    }
});
export default SignUp;
