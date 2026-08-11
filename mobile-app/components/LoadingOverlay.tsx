import { View, ActivityIndicator, Text, StyleSheet, Modal } from 'react-native';

type Props = {
  visible: boolean;
  message?: string;
};

export default function LoadingOverlay({ visible, message = 'Please wait…' }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.text}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 36,
    alignItems: 'center',
    gap: 14,
    minWidth: 160,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
});
