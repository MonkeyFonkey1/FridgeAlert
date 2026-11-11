import { StyleSheet, Text, View } from 'react-native';
import type { FoodStatus } from '../models/food';
import { colors } from '../theme/theme';
import { daysUntilExpiration, expirationLabel, expiringSoonDays } from '../utils/expiration';
import { AppIcon, type IconName } from './AppIcon';

type BadgeTone = { ink: string; background: string; icon: IconName };

const green: BadgeTone = { ink: colors.green, background: colors.greenSoft, icon: 'calendar-check-outline' };
const amber: BadgeTone = { ink: colors.amber, background: colors.amberSoft, icon: 'clock-outline' };
const red: BadgeTone = { ink: colors.red, background: colors.redSoft, icon: 'alert-circle-outline' };

const statuses: Record<FoodStatus, BadgeTone & { label: string }> = {
  active: { ...green, icon: 'basket-outline', label: 'Activ' },
  consumed: { ink: colors.blue, background: colors.blueSoft, icon: 'check-circle-outline', label: 'Consumat' },
  discarded: { ink: colors.slate, background: colors.slateSoft, icon: 'delete-outline', label: 'Aruncat' },
};

function Badge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <View style={[styles.badge, { backgroundColor: tone.background }]}>
      <AppIcon name={tone.icon} color={tone.ink} size={15} />
      <Text style={[styles.label, { color: tone.ink }]}>{label}</Text>
    </View>
  );
}

export function FoodStatusBadge({ status }: { status: FoodStatus }) {
  return <Badge label={statuses[status].label} tone={statuses[status]} />;
}

export function ExpirationBadge({ expirationDate, today }: { expirationDate: string; today: string }) {
  const days = daysUntilExpiration(expirationDate, today);
  const tone = days < 0 ? red : days <= expiringSoonDays ? amber : green;
  return <Badge label={expirationLabel(days)} tone={tone} />;
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%', gap: 5, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4 },
  label: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
});
