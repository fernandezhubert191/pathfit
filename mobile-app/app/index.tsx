import { Platform } from 'react-native';
import AdminLoginWeb from '@/components/AdminLoginWeb';
import RoleSelectMobile from '@/components/RoleSelectMobile';

/**
 * Root screen:
 *  - Web  → Admin login only
 *  - Mobile (iOS / Android) → Student / Teacher role selection
 */
export default function IndexScreen() {
  if (Platform.OS === 'web') {
    return <AdminLoginWeb />;
  }

  return <RoleSelectMobile />;
}
