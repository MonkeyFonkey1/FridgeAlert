import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function AppIcon(props: { name: IconName; color: string; size: number }) {
  return <MaterialCommunityIcons {...props} accessible={false} importantForAccessibility="no" />;
}
