import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { colors } from '../theme/theme';
import { AppIcon, type IconName } from './AppIcon';

const photos: Partial<Record<string, ImageSourcePropType>> = {
  'omleta-cu-branza': require('../../assets/food/omelette.webp'),
  'paste-cu-rosii': require('../../assets/food/pasta.webp'),
  'salata-de-legume': require('../../assets/food/salad.webp'),
};

export function RecipePhoto({ id, height }: { id: string; height: number }) {
  const source = photos[id];
  if (source) {
    return <Image accessible={false} source={source} resizeMode="cover" style={[styles.image, { height }]} />;
  }

  const icon: IconName = id.startsWith('salata') ? 'bowl-mix-outline'
    : id.startsWith('paste') ? 'pasta'
    : id.startsWith('supa') ? 'pot-steam-outline'
    : 'silverware-fork-knife';

  return (
    <View importantForAccessibility="no-hide-descendants" style={[styles.placeholder, { height }]}>
      <View style={styles.plate}><AppIcon name={icon} size={34} color={colors.greenDark} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', backgroundColor: colors.greenSoft },
  placeholder: { width: '100%', backgroundColor: '#E2E8D9', alignItems: 'center', justifyContent: 'center' },
  plate: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
});
