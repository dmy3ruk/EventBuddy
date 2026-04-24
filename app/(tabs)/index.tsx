import { Redirect } from 'expo-router';
import { getAuth } from 'firebase/auth';

export default function Index() {
    const user = getAuth().currentUser;

    return <Redirect href={user ? "/(tabs)" : "/SignIn"} />;
}