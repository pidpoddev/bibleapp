import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const templates = [
  {
    key: 'prayer',
    icon: '🙏',
    title: 'Prayer Journal',
  },
  {
    key: 'bible-study',
    icon: '📖',
    title: 'Bible Study',
  },
  {
    key: 'daily-devotional',
    icon: '🌅',
    title: 'Daily Devotional',
  },
] as const;

export default function JournalScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Journal ✍️</Text>
      <Text style={styles.subtitle}>Choose your journaling style 💕</Text>

      <View style={styles.cardStack}>
        {templates.map((template) => (
          <TouchableOpacity
            key={template.key}
            activeOpacity={0.88}
            onPress={() =>
              router.push(
                template.key === 'prayer'
                  ? '/prayer-journal-list'
                  : template.key === 'bible-study'
                    ? '/bible-study-journal'
                  : {
                      pathname: '/journal-editor',
                      params: { template: template.key },
                    }
              )
            }
            style={styles.templateCard}>
            <Text style={styles.templateIcon}>{template.icon}</Text>
            <Text style={styles.templateTitle}>{template.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 20,
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
  cardStack: {
    marginTop: 28,
    gap: 14,
  },
  templateCard: {
    backgroundColor: '#F6F1EB',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  templateIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  templateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F1F1F',
  },
});
