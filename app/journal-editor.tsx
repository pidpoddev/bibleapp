import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function JournalScreen() {
  const { template } = useLocalSearchParams<{ template?: string }>();
  const router = useRouter();

  const templateLabel =
    template === 'prayer'
      ? 'Prayer Journal'
      : template === 'bible-study'
        ? 'Bible Study'
        : template === 'daily-devotional'
          ? 'Daily Devotional'
          : 'Blank Journal';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Journal ✍️</Text>

      <Text style={styles.subtitle}>
        {templateLabel}
      </Text>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          if (template === 'bible-study') {
            router.push('/bible-study-journal');
            return;
          }

          if (template === 'prayer') {
            router.push('/prayer-journal');
            return;
          }
        }}
        style={styles.button}>
        <Text style={styles.buttonText}>+ New Page</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    padding: 20,
    paddingTop: 72,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    color: '#777777',
  },
  button: {
    marginTop: 24,
    alignSelf: 'flex-start',
    backgroundColor: '#F3EDE8',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
  },
});
