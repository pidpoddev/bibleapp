import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppSettings } from '@/utils/app-settings';

const BREATH_STEPS = [
  { key: 'inhale', durationMs: 4000 },
  { key: 'hold', durationMs: 2500 },
  { key: 'exhale', durationMs: 4500 },
  { key: 'rest', durationMs: 2000 },
] as const;

type BreathStepKey = (typeof BREATH_STEPS)[number]['key'];

export default function BreatheScreen() {
  const router = useRouter();
  const { colorTheme, t } = useAppSettings();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = BREATH_STEPS[stepIndex];

  useEffect(() => {
    const timer = setTimeout(() => {
      setStepIndex((current) => (current + 1) % BREATH_STEPS.length);
    }, currentStep.durationMs);

    return () => clearTimeout(timer);
  }, [currentStep.durationMs]);

  const stepLabel = useMemo(() => {
    const labels: Record<BreathStepKey, string> = {
      inhale: t('breatheStepInhale'),
      hold: t('breatheStepHold'),
      exhale: t('breatheStepExhale'),
      rest: t('breatheStepRest'),
    };

    return labels[currentStep.key];
  }, [currentStep.key, t]);

  useFocusEffect(
    useCallback(() => {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      });
    }, [])
  );

  return (
    <ScrollView
      ref={scrollViewRef}
      style={[styles.screen, { backgroundColor: colorTheme.screenBackground }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colorTheme.cardBackground,
            borderColor: colorTheme.border,
          },
        ]}>
        <View style={[styles.badge, { backgroundColor: colorTheme.toolbarBackground }]}>
          <Ionicons name="leaf-outline" size={22} color="#6F8C7A" />
        </View>
        <Text style={styles.title}>{t('breatheTitle')}</Text>
        <Text style={styles.subtitle}>{t('breatheSubtitle')}</Text>

        <View
          style={[
            styles.breathCircle,
            {
              backgroundColor: colorTheme.selectionBackground,
              borderColor: colorTheme.border,
            },
          ]}>
          <Text style={styles.breathLabel}>{stepLabel}</Text>
        </View>

        <View style={styles.stepRow}>
          {BREATH_STEPS.map((step, index) => (
            <View
              key={step.key}
              style={[
                styles.stepDot,
                {
                  backgroundColor:
                    index === stepIndex ? colorTheme.tint : colorTheme.toolbarBackground,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View
        style={[
          styles.verseCard,
          {
            backgroundColor: colorTheme.cardBackground,
            borderColor: colorTheme.border,
          },
        ]}>
        <Text style={styles.sectionLabel}>{t('breatheVerseLabel')}</Text>
        <Text style={styles.verseText}>{t('breatheVerseText')}</Text>
        <Text style={styles.verseReference}>{t('breatheVerseReference')}</Text>
      </View>

      <View
        style={[
          styles.prayerCard,
          {
            backgroundColor: colorTheme.cardBackground,
            borderColor: colorTheme.border,
          },
        ]}>
        <Text style={styles.sectionLabel}>{t('breathePrayerTitle')}</Text>
        <Text style={styles.prayerText}>{t('breathePrayerText')}</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() =>
            router.push({ pathname: '/studio', params: { blankStudioToken: String(Date.now()), saveTarget: 'prayer' } })
          }
          style={[styles.primaryButton, { backgroundColor: colorTheme.tint }]}>
          <Text style={styles.primaryButtonText}>{t('breathePrimaryAction')}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/bible')}
          style={[
            styles.secondaryButton,
            {
              backgroundColor: colorTheme.cardBackground,
              borderColor: colorTheme.border,
            },
          ]}>
          <Text style={styles.secondaryButtonText}>{t('breatheSecondaryAction')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 18,
  },
  heroCard: {
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: '#7A6F66',
    textAlign: 'center',
  },
  breathCircle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  breathLabel: {
    fontSize: 24,
    fontWeight: '700',
    color: '#5B514D',
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  verseCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  prayerCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9B7A59',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  verseText: {
    marginTop: 10,
    fontSize: 20,
    lineHeight: 30,
    color: '#3A342F',
    fontWeight: '600',
  },
  verseReference: {
    marginTop: 12,
    fontSize: 14,
    color: '#7A6F66',
    fontWeight: '700',
  },
  prayerText: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    color: '#4A433D',
  },
  actionRow: {
    gap: 12,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: '#5B514D',
    fontSize: 15,
    fontWeight: '700',
  },
});
