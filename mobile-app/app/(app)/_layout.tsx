import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="student-dashboard" />
      <Stack.Screen name="teacher-dashboard" />
      <Stack.Screen name="module-viewer" />
      <Stack.Screen name="progress-lessons" />
      <Stack.Screen name="progress-quizzes" />
      <Stack.Screen name="student-progress" />
      <Stack.Screen name="quiz-result-detail" />
    </Stack>
  );
}
