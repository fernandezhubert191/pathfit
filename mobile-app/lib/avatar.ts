import AsyncStorage from '@react-native-async-storage/async-storage';

function key(userId: number): string {
  return `avatar:${userId}`;
}

export async function getAvatar(userId: number): Promise<string | null> {
  return AsyncStorage.getItem(key(userId));
}

export async function saveAvatar(userId: number, uri: string): Promise<void> {
  await AsyncStorage.setItem(key(userId), uri);
}
