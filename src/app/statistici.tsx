import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon, type IconName } from '../components/AppIcon';
import { ScreenLoading, ScreenMessage } from '../components/ScreenMessage';
import { ScreenTopBar } from '../components/ScreenTopBar';
import type { ActivityPeriod, ActivityType, InventoryActivity } from '../models/activity';
import { getActiveFoods, getInventoryActivity } from '../services/foodDatabase';
import { colors } from '../theme/theme';
import { activityStatistics } from '../utils/activityStatistics';
import { dateForPicker, displayDate } from '../utils/expiration';
import { useFocusedData } from '../utils/useFocusedData';
import { useToday } from '../utils/useToday';

const periods: { value: ActivityPeriod; label: string }[] = [
  { value: 7, label: 'Ultimele 7 zile' },
  { value: 30, label: 'Ultimele 30 de zile' },
  { value: 'all', label: 'Tot timpul' },
];

const activityLabels: Record<ActivityType, { icon: IconName; label: string; color: string; background: string }> = {
  added: { icon: 'plus', label: 'Ai adăugat', color: colors.green, background: colors.greenSoft },
  purchased: { icon: 'cart-outline', label: 'Ai cumpărat', color: colors.blue, background: colors.blueSoft },
  consumed: { icon: 'check-circle-outline', label: 'Ai consumat', color: colors.green, background: colors.greenSoft },
  discarded: { icon: 'delete-outline', label: 'Ai aruncat', color: colors.red, background: colors.redSoft },
};

const dateTimeFormat = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short' });
const monthFormat = new Intl.DateTimeFormat('ro-RO', { month: 'short', year: 'numeric' });

async function loadStatistics() {
  const [foods, events] = await Promise.all([getActiveFoods(), getInventoryActivity()]);
  return { foods, events };
}

function Metric({ label, count, icon, tone }: {
  label: string; count: number; icon: IconName; tone: string;
}) {
  return (
    <View style={styles.metric}>
      <AppIcon name={icon} size={22} color={tone} />
      <Text style={[styles.count, { color: tone }]}>{count}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function Bar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  return (
    <View style={styles.barRow}>
      <View style={styles.barHeading}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.barValue}>{count}</Text>
      </View>
      <View style={styles.track}>
        <View style={{ backgroundColor: color, width: `${total ? count / total * 100 : 0}%`, height: '100%' }} />
      </View>
    </View>
  );
}

function ActivityRow({ event }: { event: InventoryActivity }) {
  const { icon, label, color, background } = activityLabels[event.type];
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIcon, { backgroundColor: background }]}><AppIcon name={icon} size={21} color={color} /></View>
      <View style={styles.activityText}>
        <Text style={styles.barValue}>{label} {event.quantity} {event.unit} · {event.name}</Text>
        <Text style={styles.label}>{dateTimeFormat.format(new Date(event.occurredAt))}</Text>
      </View>
    </View>
  );
}

export default function StatisticsScreen() {
  const router = useRouter();
  const { result, retry } = useFocusedData(loadStatistics);
  const [period, setPeriod] = useState<ActivityPeriod>(7);
  const today = useToday();
  const stats = useMemo(() => result.status === 'ready'
    ? activityStatistics(result.data.foods, result.data.events, period, today)
    : null, [result, period, today]);

  const finalizedCount = stats ? stats.totals.consumed + stats.totals.discarded : 0;
  const peak = stats?.evolution.reduce((max, [, count]) => Math.max(max, count), 0) ?? 0;

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenTopBar title="Statistici" onBack={() => router.dismissTo('/')} />
      <ScrollView contentContainerStyle={styles.content}>
        {result.status === 'loading' && <ScreenLoading />}
        {result.status === 'error' && <ScreenMessage title="Nu am putut încărca statisticile" onRetry={retry} />}
        {stats && (
          <>
            <Text accessibilityRole="header" style={styles.heading}>Inventar acum</Text>
            <View style={styles.metrics}>
              <Metric count={stats.active} label="Produse active" icon="basket-outline" tone={colors.green} />
              <Metric count={stats.soon} label="Expiră în cel mult 3 zile" icon="clock-outline" tone={colors.amber} />
            </View>

            <View style={styles.filters}>
              {periods.map(({ value, label }) => (
                <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: period === value }}
                  onPress={() => setPeriod(value)}
                  style={({ pressed }) => [styles.filter, period === value && styles.selected, pressed && styles.pressed]}>
                  <Text style={[styles.filterLabel, period === value && styles.selectedLabel]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.heading}>Loturi finalizate</Text>
              <Text style={styles.label}>Un lot este finalizat când ultima cantitate rămasă este consumată sau aruncată.</Text>
              <Bar label="Consumate" count={stats.totals.consumed} total={finalizedCount} color={colors.green} />
              <Bar label="Aruncate" count={stats.totals.discarded} total={finalizedCount} color={colors.red} />
            </View>

            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.heading}>Cantități înregistrate</Text>
              <Text style={styles.label}>Include consumul și aruncarea parțială.</Text>
              {stats.quantities.length === 0 && <Text style={styles.label}>Nicio cantitate consumată sau aruncată în această perioadă.</Text>}
              {stats.quantities.map(([unit, counts]) => (
                <View key={unit} style={styles.quantityRow}>
                  <Text style={styles.barValue}>Consumate · {counts.consumed.toString()} {unit}</Text>
                  <Text style={styles.barValue}>Aruncate · {counts.discarded.toString()} {unit}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.heading}>Evoluția activității</Text>
              <Text style={styles.label}>{period === 7 ? 'Acțiuni pe zi' : period === 30 ? 'Acțiuni pe interval de până la 7 zile' : 'Acțiuni pe lună'}</Text>
              {peak === 0 ? <Text style={styles.label}>Nicio activitate în perioada selectată.</Text> : stats.evolution.map(([key, count]) => (
                <Bar key={key} label={period === 'all' ? monthFormat.format(dateForPicker(`${key}-01`)) : displayDate(key)}
                  count={count} total={peak} color={colors.green} />
              ))}
            </View>

            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.heading}>Activitate recentă</Text>
              {stats.recent.length > 0 ? stats.recent.map((event) => <ActivityRow key={event.id} event={event} />) : (
                <Text style={styles.label}>Activitatea va apărea aici când adaugi, cumperi, consumi sau arunci alimente.</Text>
              )}
              {stats.recent.length === 10 && <Text style={styles.label}>Sunt afișate cel mult 10 acțiuni din perioada selectată.</Text>}
            </View>
            <Text style={styles.note}>Jurnalul și statisticile pe perioade încep odată cu această actualizare. Înregistrările anterioare sunt disponibile în Istoric.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, gap: 16 },
  heading: { fontSize: 19, fontWeight: '800', color: colors.ink },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flexGrow: 1, flexBasis: 125, gap: 6, padding: 15, borderRadius: 18, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1 },
  count: { fontSize: 28, fontWeight: '800' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { justifyContent: 'center', minHeight: 48, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  selected: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  pressed: { opacity: 0.75 },
  filterLabel: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  selectedLabel: { color: colors.greenDark },
  card: { gap: 10, padding: 16, borderRadius: 20, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1 },
  label: { color: colors.muted, fontSize: 14, flexShrink: 1 },
  barRow: { gap: 4 },
  barHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  barValue: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border },
  quantityRow: { gap: 4, paddingVertical: 5 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 9, borderTopWidth: 1, borderColor: colors.border },
  activityIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activityText: { flex: 1, gap: 3 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19, paddingHorizontal: 4 },
});
