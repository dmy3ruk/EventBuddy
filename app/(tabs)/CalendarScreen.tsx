// CalendarScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';

export default function CalendarScreen() {
    const [selectedDate, setSelectedDate] = useState('');

    return (
        <View style={styles.container}>
            <Calendar
                style={styles.calendar}
                onDayPress={(day) => setSelectedDate(day.dateString)}
                markedDates={{
                    [selectedDate]: { selected: true, selectedColor: '#505BEB' },
                }}
                theme={{
                    todayTextColor: '#505BEB',
                    arrowColor: '#505BEB',
                    monthTextColor: '#505BEB',
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 16,
        backgroundColor:"#F9F9F9"
    },
    calendar: {
        borderWidth: 1,
        padding:30,
        borderColor: '#E2E8F0',
        borderRadius: 16,
        width: '100%',
    },
});
