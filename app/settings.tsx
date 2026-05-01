import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAppSettings } from '@/utils/app-settings';

export default function SettingsScreen() {
  const { colorTheme, colorThemes, setColorThemeKey } = useAppSettings();

  return (
    <View style={[styles.container, { backgroundColor: colorTheme.screenBackground }]}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>
        Pick a soft pastel palette to make the app feel more you.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Colors</Text>

        {colorThemes.map((theme) => {
          const isSelected = theme.key === colorTheme.key;

          return (
            <TouchableOpacity
              key={theme.key}
              activeOpacity={0.88}
              onPress={() => setColorThemeKey(theme.key)}
              style={[
                styles.colorCard,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: isSelected ? theme.tint : theme.border,
                },
              ]}>
              <View style={[styles.swatch, { backgroundColor: theme.accent }]} />

              <View style={styles.colorTextBlock}>
                <Text style={styles.colorName}>{theme.name}</Text>
                <Text style={styles.colorHint}>
                  Soft, sweet, and easy on the eyes
                </Text>
              </View>

              {isSelected ? (
                <Ionicons name="checkmark-circle" size={22} color={theme.tint} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: '#7A6F66',
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5B514D',
    marginBottom: 12,
  },
  colorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 14,
  },
  colorTextBlock: {
    flex: 1,
  },
  colorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  colorHint: {
    marginTop: 2,
    fontSize: 13,
    color: '#7A6F66',
  },
});
