import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { AppIcon, type IconName } from '../../components/AppIcon';
import { colors } from '../../theme/theme';

const tabs = [
  { name: 'index', title: 'Acasă', icon: 'home-variant-outline', active: 'home-variant' },
  { name: 'frigider', title: 'Frigider', icon: 'fridge-outline', active: 'fridge' },
  { name: 'retete', title: 'Rețete', icon: 'book-open-page-variant-outline', active: 'book-open-page-variant' },
  { name: 'cumparaturi', title: 'Cumpărături', icon: 'cart-outline', active: 'cart' },
] satisfies { name: string; title: string; icon: IconName; active: IconName }[];

export default function MainTabs() {
  return (
    <Tabs backBehavior="history" screenOptions={{
      headerShown: false,
      sceneStyle: { backgroundColor: colors.background },
      tabBarActiveTintColor: colors.greenDark,
      tabBarInactiveTintColor: colors.muted,
      tabBarHideOnKeyboard: true,
      tabBarLabelStyle: styles.label,
      tabBarStyle: styles.bar,
      tabBarItemStyle: styles.item,
    }}>
      {tabs.map(({ name, title, icon, active }) => (
        <Tabs.Screen key={name} name={name} options={{
          title,
          tabBarAccessibilityLabel: title,
          tabBarIcon: ({ focused }) => (
            <View style={[styles.icon, focused && styles.active]}>
              <AppIcon name={focused ? active : icon} color={focused ? colors.greenDark : colors.muted} size={21} />
            </View>
          ),
        }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.white, borderTopColor: colors.border },
  item: { paddingVertical: 2 },
  icon: { width: 46, minHeight: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  active: { backgroundColor: colors.greenSoft },
  label: { fontWeight: '700', fontSize: 11 },
});
