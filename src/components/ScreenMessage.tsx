import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/theme';
import { AppIcon, type IconName } from './AppIcon';
import { PrimaryButton } from './PrimaryButton';

export function ScreenMessage({ title, description, icon = 'alert-circle-outline', onRetry }: {
  title: string;
  description?: string;
  icon?: IconName;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.card}>
      <AppIcon name={icon} size={30} color={colors.green} />
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {onRetry && <PrimaryButton label="Încearcă din nou" icon="refresh" variant="secondary" onPress={onRetry} />}
    </View>
  );
}

export function ScreenLoading() {
  return <ActivityIndicator style={styles.loading} accessibilityLabel="Se încarcă" color={colors.green} />;
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', padding: 22, gap: 10, backgroundColor: colors.white, borderRadius: 20, borderColor: colors.border, borderWidth: 1 },
  title: { textAlign: 'center', color: colors.ink, fontSize: 18, fontWeight: '800' },
  description: { textAlign: 'center', color: colors.muted, fontSize: 15 },
  loading: { marginVertical: 24 },
});
