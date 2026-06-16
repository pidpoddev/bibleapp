import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAppSettings } from '@/utils/app-settings';

const ACCOUNT_SESSION_STORAGE_KEY = 'account_session_v1';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AccountSession = {
  email: string;
  signedInAt: number;
};

type AccountMode = 'sign-in' | 'create';

export default function SettingsScreen() {
  const {
    colorTheme,
    colorThemes,
    language,
    languages,
    setColorThemeKey,
    setLanguageKey,
    t,
  } = useAppSettings();
  const [accountEmail, setAccountEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [accountMode, setAccountMode] = useState<AccountMode>('sign-in');
  const [accountSession, setAccountSession] = useState<AccountSession | null>(null);
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState('');

  useEffect(() => {
    const loadAccountSession = async () => {
      try {
        const storedSession = await AsyncStorage.getItem(ACCOUNT_SESSION_STORAGE_KEY);

        if (!storedSession) {
          return;
        }

        const parsedSession = JSON.parse(storedSession) as AccountSession;

        if (parsedSession.email) {
          setAccountSession(parsedSession);
          setAccountEmail(parsedSession.email);
        }
      } catch (error) {
        console.log('Error loading account session:', error);
      }
    };

    void loadAccountSession();
  }, []);

  const handleAccountSubmit = async () => {
    const normalizedEmail = accountEmail.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setAccountError(t('settingsAccountEmailError'));
      setAccountMessage('');
      return;
    }

    if (password.length < 8) {
      setAccountError(t('settingsAccountPasswordError'));
      setAccountMessage('');
      return;
    }

    const nextSession: AccountSession = {
      email: normalizedEmail,
      signedInAt: Date.now(),
    };

    try {
      await AsyncStorage.setItem(
        ACCOUNT_SESSION_STORAGE_KEY,
        JSON.stringify(nextSession)
      );
      setAccountSession(nextSession);
      setAccountEmail(normalizedEmail);
      setPassword('');
      setAccountError('');
      setAccountMessage(t('settingsAccountSaved'));
    } catch (error) {
      console.log('Error saving account session:', error);
      setAccountError(t('settingsAccountEmailError'));
      setAccountMessage('');
    }
  };

  const handleCreateAccount = async () => {
    const normalizedEmail = accountEmail.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setAccountError(t('settingsAccountEmailError'));
      setAccountMessage('');
      return;
    }

    if (password.length < 8) {
      setAccountError(t('settingsAccountPasswordError'));
      setAccountMessage('');
      return;
    }

    if (password !== confirmPassword) {
      setAccountError(t('settingsAccountPasswordMatchError'));
      setAccountMessage('');
      return;
    }

    const nextSession: AccountSession = {
      email: normalizedEmail,
      signedInAt: Date.now(),
    };

    try {
      await AsyncStorage.setItem(
        ACCOUNT_SESSION_STORAGE_KEY,
        JSON.stringify(nextSession)
      );
      setAccountSession(nextSession);
      setAccountEmail(normalizedEmail);
      setPassword('');
      setConfirmPassword('');
      setAccountError('');
      setAccountMessage(t('settingsAccountCreated'));
    } catch (error) {
      console.log('Error creating account session:', error);
      setAccountError(t('settingsAccountEmailError'));
      setAccountMessage('');
    }
  };

  const handleAccountSignOut = async () => {
    try {
      await AsyncStorage.removeItem(ACCOUNT_SESSION_STORAGE_KEY);
      setAccountSession(null);
      setPassword('');
      setConfirmPassword('');
      setAccountMessage('');
      setAccountError('');
    } catch (error) {
      console.log('Error signing out:', error);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colorTheme.screenBackground }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t('settingsTitle')}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settingsAccount')}</Text>

        <View
          style={[
            styles.accountCard,
            {
              backgroundColor: colorTheme.cardBackground,
              borderColor: colorTheme.border,
            },
          ]}>
          <View style={styles.accountHeader}>
            <View style={[styles.accountIcon, { backgroundColor: colorTheme.toolbarBackground }]}>
              <Ionicons name="person-circle-outline" size={22} color="#5B514D" />
            </View>

            <View style={styles.accountHeaderText}>
              <Text style={styles.accountTitle}>
                {accountSession
                  ? t('settingsAccountSignedIn')
                  : accountMode === 'create'
                    ? t('settingsAccountCreateSubtitle')
                    : t('settingsAccountSubtitle')}
              </Text>
              <Text style={styles.accountHint}>
                {accountSession?.email ?? t('settingsAccountSyncStatus')}
              </Text>
            </View>
          </View>

          {accountSession ? (
            <View style={styles.signedInRow}>
              <View style={[styles.syncPill, { backgroundColor: colorTheme.toolbarBackground }]}>
                <Ionicons name="cloud-outline" size={15} color="#5B514D" />
                <Text style={styles.syncPillText}>{t('settingsAccountSyncStatus')}</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                onPress={handleAccountSignOut}
                style={[styles.secondaryButton, { borderColor: colorTheme.border }]}>
                <Text style={styles.secondaryButtonText}>{t('settingsAccountSignOut')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.accountModeRow,
                  { backgroundColor: colorTheme.toolbarBackground },
                ]}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => {
                    setAccountMode('sign-in');
                    setAccountError('');
                    setAccountMessage('');
                  }}
                  style={[
                    styles.accountModeButton,
                    accountMode === 'sign-in'
                      ? { backgroundColor: colorTheme.cardBackground }
                      : null,
                  ]}>
                  <Text style={styles.accountModeText}>{t('settingsAccountAction')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => {
                    setAccountMode('create');
                    setAccountError('');
                    setAccountMessage('');
                  }}
                  style={[
                    styles.accountModeButton,
                    accountMode === 'create'
                      ? { backgroundColor: colorTheme.cardBackground }
                      : null,
                  ]}>
                  <Text style={styles.accountModeText}>
                    {t('settingsAccountCreateAction')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('settingsAccountEmail')}</Text>
                <TextInput
                  value={accountEmail}
                  onChangeText={setAccountEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor="#A99D96"
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colorTheme.paperBackground,
                      borderColor: colorTheme.border,
                    },
                  ]}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('settingsAccountPassword')}</Text>
                <View
                  style={[
                    styles.passwordRow,
                    {
                      backgroundColor: colorTheme.paperBackground,
                      borderColor: colorTheme.border,
                    },
                  ]}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    textContentType="password"
                    secureTextEntry={!isPasswordVisible}
                    placeholder="Password"
                    placeholderTextColor="#A99D96"
                    style={styles.passwordInput}
                  />
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={() => setIsPasswordVisible((current) => !current)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isPasswordVisible ? 'Hide password' : 'Show password'
                    }
                    style={styles.passwordToggle}>
                    <Ionicons
                      name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#5B514D"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {accountMode === 'create' ? (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {t('settingsAccountConfirmPassword')}
                  </Text>
                  <View
                    style={[
                      styles.passwordRow,
                      {
                        backgroundColor: colorTheme.paperBackground,
                        borderColor: colorTheme.border,
                      },
                    ]}>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="password"
                      textContentType="password"
                      secureTextEntry={!isPasswordVisible}
                      placeholder="Password"
                      placeholderTextColor="#A99D96"
                      style={styles.passwordInput}
                    />
                  </View>
                </View>
              ) : null}

              {accountError ? <Text style={styles.errorText}>{accountError}</Text> : null}
              {accountMessage ? <Text style={styles.successText}>{accountMessage}</Text> : null}

              <TouchableOpacity
                activeOpacity={0.88}
                onPress={
                  accountMode === 'create' ? handleCreateAccount : handleAccountSubmit
                }
                style={[styles.primaryButton, { backgroundColor: colorTheme.tint }]}>
                <Ionicons
                  name={accountMode === 'create' ? 'person-add-outline' : 'log-in-outline'}
                  size={17}
                  color="#FFFFFF"
                />
                <Text style={styles.primaryButtonText}>
                  {accountMode === 'create'
                    ? t('settingsAccountCreateAction')
                    : t('settingsAccountAction')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settingsColors')}</Text>

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
                <Text style={styles.colorHint}>{t('colorHint')}</Text>
              </View>

              {isSelected ? (
                <Ionicons name="checkmark-circle" size={22} color={theme.tint} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settingsLanguage')}</Text>

        {languages.map((option) => {
          const isSelected = option.key === language.key;
          const optionLabel =
            option.key === 'es' ? t('languageSpanish') : t('languageEnglish');

          return (
            <TouchableOpacity
              key={option.key}
              activeOpacity={0.88}
              onPress={() => setLanguageKey(option.key)}
              style={[
                styles.colorCard,
                {
                  backgroundColor: colorTheme.cardBackground,
                  borderColor: isSelected ? colorTheme.tint : colorTheme.border,
                },
              ]}>
              <View style={[styles.swatch, { backgroundColor: colorTheme.accent }]}>
                <Ionicons name="language-outline" size={16} color="#5B514D" />
              </View>

              <View style={styles.colorTextBlock}>
                <Text style={styles.colorName}>{optionLabel}</Text>
                <Text style={styles.colorHint}>
                  {`${option.nativeName} • ${t('languageHint')}`}
                </Text>
              </View>

              {isSelected ? (
                <Ionicons name="checkmark-circle" size={22} color={colorTheme.tint} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF9',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 20 : 28,
    paddingBottom: Platform.OS === 'web' ? 48 : 120,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F1F1F',
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
  accountCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  accountIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountHeaderText: {
    flex: 1,
  },
  accountTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  accountHint: {
    marginTop: 3,
    fontSize: 13,
    color: '#7A6F66',
  },
  accountModeRow: {
    minHeight: 42,
    borderRadius: 15,
    padding: 4,
    marginBottom: 14,
    flexDirection: 'row',
    gap: 4,
  },
  accountModeButton: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  accountModeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B514D',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#5B514D',
  },
  textInput: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    fontSize: 15,
    color: '#1F1F1F',
  },
  passwordRow: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F1F1F',
  },
  passwordToggle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 15,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  signedInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  syncPill: {
    minHeight: 38,
    borderRadius: 19,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
  },
  syncPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B514D',
  },
  secondaryButton: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B514D',
  },
  errorText: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#B85F62',
  },
  successText: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#5F8F73',
  },
});
