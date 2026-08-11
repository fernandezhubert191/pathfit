import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API } from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import { syncProgressFromServer } from '@/lib/progress';
import { fetchWithTimeout } from '@/lib/request';

type Module = {
  id: number;
  title: string;
  course: string;
  description: string | null;
};

const COURSES = [
  { key: 'pathfit1', label: 'Pathfit 1', emoji: '🏃', color: '#1c7ed6', light: '#eff6ff', border: '#bfdbfe' },
  { key: 'pathfit2', label: 'Pathfit 2', emoji: '🧘', color: '#0ca678', light: '#ecfdf5', border: '#a7f3d0' },
] as const;

export default function ProgressLessonsScreen() {
  const router = useRouter();

  const [modules, setModules]     = useState<Module[]>([]);
  const [viewed, setViewed]       = useState<Set<number>>(new Set());
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [u, token] = await Promise.all([getUser(), getToken()]);
      if (!u || !token) return;

      const [{ viewed: v }, res] = await Promise.all([
        syncProgressFromServer(u.id),
        fetchWithTimeout(`${API}/modules`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        }),
      ]);

      setViewed(v);
      if (res.ok) {
        const data = await res.json();
        setModules(data.modules ?? []);
      }
    } catch { /* silent */ }
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalCompleted = modules.filter(m => viewed.has(m.id)).length;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={s.topCenter}>
          <Text style={s.topTitle}>Lessons Done</Text>
          <Text style={s.topSub}>{totalCompleted} of {modules.length} completed</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#1c7ed6" />
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#1c7ed6" />
          }
        >
          {modules.length === 0 && (
            <View style={s.emptyWrap}>
              <Text style={s.emptyEmoji}>📭</Text>
              <Text style={s.emptyText}>No modules available yet.</Text>
            </View>
          )}

          {COURSES.map(c => {
            const list  = modules.filter(m => m.course === c.key);
            if (list.length === 0) return null;
            const done  = list.filter(m => viewed.has(m.id)).length;
            const pct   = list.length > 0 ? done / list.length : 0;

            return (
              <View key={c.key} style={s.section}>
                {/* Course header */}
                <View style={[s.courseHeader, { backgroundColor: c.light, borderColor: c.border }]}>
                  <Text style={s.courseEmoji}>{c.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.courseLabel, { color: c.color }]}>{c.label}</Text>
                    <View style={s.progressRow}>
                      <View style={s.progressTrack}>
                        <View style={[s.progressFill, { backgroundColor: c.color, width: `${pct * 100}%` as any }]} />
                      </View>
                      <Text style={[s.progressCount, { color: c.color }]}>{done}/{list.length}</Text>
                    </View>
                  </View>
                  {done === list.length && list.length > 0 && (
                    <View style={[s.doneBadge, { backgroundColor: c.color }]}>
                      <Text style={s.doneBadgeText}>✓ Done</Text>
                    </View>
                  )}
                </View>

                {/* Module rows */}
                <View style={s.list}>
                  {list.map((m, idx) => {
                    const isViewed = viewed.has(m.id);
                    return (
                      <View
                        key={m.id}
                        style={[
                          s.row,
                          isViewed
                            ? { borderColor: c.border, backgroundColor: c.light }
                            : s.rowPending,
                        ]}
                      >
                        <View style={[s.numWrap, { backgroundColor: isViewed ? c.color : '#e2e8f0' }]}>
                          {isViewed
                            ? <Text style={s.checkIcon}>✓</Text>
                            : <Text style={[s.numText, { color: '#94a3b8' }]}>{idx + 1}</Text>
                          }
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.rowTitle, !isViewed && { color: '#94a3b8' }]}>{m.title}</Text>
                          {m.description
                            ? <Text style={s.rowDesc} numberOfLines={1}>{m.description}</Text>
                            : null}
                        </View>
                        <Text style={[s.statusPill, { color: isViewed ? c.color : '#cbd5e1' }]}>
                          {isViewed ? 'Completed' : 'Pending'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  backBtn:   { width: 60 },
  backText:  { fontSize: 16, color: '#1c7ed6', fontWeight: '600' },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle:  { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  topSub:    { fontSize: 11, color: '#94a3b8', marginTop: 1 },

  section: { marginBottom: 8 },

  courseHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 16, marginBottom: 4,
    borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 12,
  },
  courseEmoji: { fontSize: 26 },
  courseLabel: { fontSize: 15, fontWeight: '800' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  progressTrack: {
    flex: 1, height: 6, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden',
  },
  progressFill:  { height: '100%', borderRadius: 3 },
  progressCount: { fontSize: 12, fontWeight: '700', minWidth: 36 },
  doneBadge:     { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  doneBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  list: { paddingHorizontal: 16, gap: 8, paddingTop: 4 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 13,
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
    backgroundColor: '#ffffff',
  },
  rowPending: { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },

  numWrap: {
    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  checkIcon: { fontSize: 16, fontWeight: '900', color: '#ffffff' },
  numText:   { fontSize: 13, fontWeight: '800' },

  rowTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a', lineHeight: 19 },
  rowDesc:  { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  statusPill: { fontSize: 11, fontWeight: '700' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyEmoji:{ fontSize: 40 },
  emptyText: { fontSize: 14, color: '#94a3b8' },
});
