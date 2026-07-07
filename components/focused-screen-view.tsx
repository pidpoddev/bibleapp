import { useIsFocused } from '@react-navigation/native';
import { View, type ViewProps } from 'react-native';

export function FocusedScreenView(props: ViewProps) {
  const isFocused = useIsFocused();

  return (
    <View
      accessibilityElementsHidden={!isFocused}
      importantForAccessibility={isFocused ? 'auto' : 'no-hide-descendants'}
      {...props}
    />
  );
}
