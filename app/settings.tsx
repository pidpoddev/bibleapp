import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAppSettings, type TranslationKey } from '@/utils/app-settings';
import {
  getBibleReadingProgress,
  type BibleReadingProgress,
} from '@/utils/bible-reading-progress';
import { buildJournalExportSnapshot, resetJournalData } from '@/utils/journal-storage';
import { useResponsiveLayout } from '@/utils/responsive-layout';
import {
  checkSyncUsernameAvailability,
  connectPrivateSyncPhrase,
  disconnectPrivateSync,
  getEncryptedSyncConflicts,
  getEncryptedSyncLog,
  getSyncSession,
  keepEncryptedSyncConflictVersion,
  pullEncryptedSync,
  pushEncryptedSync,
  saveBothEncryptedSyncConflictVersions,
  updateSyncUsername,
  type SyncConflict,
  type SyncConflictVersion,
  type SyncLogEvent,
} from '@/utils/sync-client';

type AccountSession = {
  email: string;
  signedInAt: number;
};

const CLOUD_USERNAME_STORAGE_KEY = 'bibleapp:cloud-username';
const FAITH_CANVAS_ICON = require('../assets/brand/faith-canvas/light/app-icon-light.png');
const FAITH_CANVAS_LINKS = {
  privacy: 'https://pidpod.com/faithcanvas/privacy.html',
  safety: 'https://pidpod.com/faithcanvas/safety.html',
  support: 'https://pidpod.com/faithcanvas/support.html',
  email: 'mailto:support@pidpod.com',
};

const USERNAME_PREFIXES = [
  'Grace',
  'Mercy',
  'Hope',
  'Joy',
  'Faith',
  'Glory',
  'Peace',
  'Light',
  'Blessed',
  'Promise',
];

const USERNAME_SUFFIXES = [
  'Bloom',
  'Dove',
  'Lily',
  'Song',
  'Star',
  'Sprout',
  'Rose',
  'River',
  'Garden',
  'Sparkle',
];

function makePrettyUsername() {
  const prefix = USERNAME_PREFIXES[Math.floor(Math.random() * USERNAME_PREFIXES.length)];
  const suffix = USERNAME_SUFFIXES[Math.floor(Math.random() * USERNAME_SUFFIXES.length)];
  const number = Math.floor(100 + Math.random() * 900);
  return `${prefix}${suffix}${number}`;
}

function cleanUsername(value: string) {
  return value.replace(/\s+/g, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40);
}

type SettingsTranslator = (
  key: TranslationKey,
  params?: Record<string, string | number>
) => string;

function getFriendlySyncError(error: unknown, fallback: string, t: SettingsTranslator) {
  const message = error instanceof Error ? error.message : fallback;

  if (message.includes('Username and Secret Phrase')) {
    return t('settingsSyncErrorUsernamePhraseMismatch');
  }

  if (message.includes('username is already taken') || message.includes('Username')) {
    return t('settingsSyncErrorUsernameTaken');
  }

  if (message.includes('did not match') || message.includes('does not match')) {
    return t('settingsSyncErrorPhraseMismatch');
  }

  if (message.includes('Unauthorized sync device')) {
    return t('settingsSyncErrorReconnect');
  }

  if (message.includes('Private Sync Phrase') || message.includes('Create or enter')) {
    return t('settingsSyncErrorEnterPhrase');
  }

  if (message.includes('Unexpected API error') || message.includes('Sync request failed')) {
    return fallback;
  }

  if (message.includes('timed out')) {
    return t('settingsSyncErrorTimedOut');
  }

  return message
    .replaceAll('Private Sync', 'Cloud Save')
    .replaceAll('sync', 'cloud save')
    .replaceAll('Sync', 'Cloud Save');
}

function waitForBusyIndicator() {
  return new Promise((resolve) => {
    setTimeout(resolve, 80);
  });
}

function confirmUsernameChange(
  currentUsername: string,
  nextUsername: string,
  t: SettingsTranslator
) {
  const message = t('settingsUsernameChangeMessage', { currentUsername, nextUsername });

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(message));
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(t('settingsUsernameChangeTitle'), message, [
      { text: t('actionCancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: t('settingsUsernameChangeAction'), onPress: () => resolve(true) },
    ]);
  });
}

function getCloudSaveSuccessMessage({
  pushedCount,
  pulledCount,
  deletedCount,
}: {
  pushedCount: number;
  pulledCount: number;
  deletedCount: number;
}, t: SettingsTranslator) {
  const changedCount = pushedCount + pulledCount + deletedCount;

  if (changedCount === 0) {
    return t('settingsCloudConnectedNothingNew');
  }

  const parts = [];

  if (pushedCount > 0) {
    parts.push(t('settingsCloudSavedCount', { count: pushedCount }));
  }

  if (pulledCount > 0) {
    parts.push(t('settingsCloudDownloadedCount', { count: pulledCount }));
  }

  if (deletedCount > 0) {
    parts.push(t('settingsCloudRemovedCount', { count: deletedCount }));
  }

  return `Cloud Save complete: ${parts.join(', ')}.`;
}

async function openFaithCanvasLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.log('Could not open Faith Canvas link:', error);
    Alert.alert('Could not open link', url);
  }
}

export default function SettingsScreen() {
  const {
    colorTheme,
    colorThemes,
    language,
    languages,
    bibleReadingImagesEnabled,
    setColorThemeKey,
    setBibleReadingImagesEnabled,
    setLanguageKey,
    t,
  } = useAppSettings();
  const layout = useResponsiveLayout();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [accountSession, setAccountSession] = useState<AccountSession | null>(null);
  const [dataMessage, setDataMessage] = useState('');
  const [dataError, setDataError] = useState('');
  const [exportText, setExportText] = useState('');
  const [cloudUsername, setCloudUsername] = useState(() => makePrettyUsername());
  const [privateSyncPhrase, setPrivateSyncPhrase] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');
  const [isSyncBusy, setIsSyncBusy] = useState(false);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([]);
  const [syncLogEvents, setSyncLogEvents] = useState<SyncLogEvent[]>([]);
  const [isSyncLogVisible, setIsSyncLogVisible] = useState(false);
  const isMountedRef = useRef(true);
  const activeCloudSyncRef = useRef(false);
  const [bibleReadingProgress, setBibleReadingProgress] = useState<BibleReadingProgress>({
    readCount: 0,
    totalCount: 0,
    percent: 0,
  });
  const isCloudSaveBusy = isSyncBusy || isBackgroundSyncing;

  const persistCloudUsername = async (
    value: string,
    options: {
      fallbackIfEmpty?: boolean;
    } = {}
  ) => {
    const { fallbackIfEmpty = true } = options;
    const cleaned = cleanUsername(value);
    const nextUsername = cleaned || (fallbackIfEmpty ? makePrettyUsername() : '');
    setCloudUsername(nextUsername);

    try {
      await AsyncStorage.setItem(CLOUD_USERNAME_STORAGE_KEY, nextUsername);
    } catch (error) {
      console.log('Error saving cloud username:', error);
    }

    return nextUsername;
  };

  useEffect(() => {
    isMountedRef.current = true;

    const loadAccountSession = async () => {
      try {
        const [storedSyncSession, storedCloudUsername] = await Promise.all([
          getSyncSession(),
          AsyncStorage.getItem(CLOUD_USERNAME_STORAGE_KEY),
        ]);

        if (storedSyncSession) {
          setAccountSession({
            email: storedSyncSession.username || `Cloud Save ${storedSyncSession.phraseFingerprint}`,
            signedInAt: storedSyncSession.createdAt,
          });
          if (storedSyncSession.username) {
            setCloudUsername(storedSyncSession.username);
            try {
              await AsyncStorage.setItem(CLOUD_USERNAME_STORAGE_KEY, storedSyncSession.username);
            } catch (error) {
              console.log('Error saving synced cloud username:', error);
            }
          }
          return;
        }

        if (storedCloudUsername !== null) {
          setCloudUsername(storedCloudUsername);
          return;
        }

        await persistCloudUsername(makePrettyUsername());
      } catch (error) {
        console.log('Error loading account session:', error);
      }
    };

    void loadAccountSession();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      void getBibleReadingProgress()
        .then((progress) => {
          if (isActive) {
            setBibleReadingProgress(progress);
          }
        })
        .catch((error) => {
          console.warn('Failed to load Bible reading progress', error);
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  const refreshPrivateSyncSession = async () => {
    const storedSyncSession = await getSyncSession();

    if (storedSyncSession) {
      setAccountSession({
        email: storedSyncSession.username || `Cloud Save ${storedSyncSession.phraseFingerprint}`,
        signedInAt: storedSyncSession.createdAt,
      });
      if (storedSyncSession.username) {
        await persistCloudUsername(storedSyncSession.username);
      }
    } else {
      setAccountSession(null);
    }
  };

  const startCloudSaveSyncInBackground = (phrase: string, connectedMessage: string) => {
    if (activeCloudSyncRef.current) {
      return;
    }

    activeCloudSyncRef.current = true;
    setIsSyncBusy(false);
    setIsBackgroundSyncing(true);
    setSyncError('');
    setSyncMessage(connectedMessage);

    void (async () => {
      try {
        const pushResult = await pushEncryptedSync(phrase);
        const pullResult = await pullEncryptedSync(phrase, { full: true });

        if (!isMountedRef.current) {
          return;
        }

        await refreshPrivateSyncSession();
        setSyncError('');
        setSyncMessage(
          pushResult.conflictCount > 0
            ? t(
                pushResult.conflictCount === 1
                  ? 'settingsSyncConflictNeedsCheckOne'
                  : 'settingsSyncConflictNeedsCheck',
                { count: pushResult.conflictCount }
              )
            : getCloudSaveSuccessMessage({
                pushedCount: pushResult.pushedCount,
                pulledCount: pullResult.pulledCount,
                deletedCount: pullResult.deletedCount,
              }, t)
        );

        if (pushResult.conflictCount > 0) {
          setSyncConflicts(await getEncryptedSyncConflicts(phrase));
        }
      } catch (error) {
        if (!isMountedRef.current) {
          return;
        }

        setSyncError(
          getFriendlySyncError(
            error,
            t('settingsSyncConnectedGotStuck'),
            t
          )
        );
        setSyncMessage(t('settingsSyncConnectedFinishNeeded'));
      } finally {
        activeCloudSyncRef.current = false;
        if (isMountedRef.current) {
          setIsBackgroundSyncing(false);
        }
      }
    })();
  };

  const handleCloudConnectAndSync = async () => {
    if (isCloudSaveBusy) {
      return;
    }

    if (!privateSyncPhrase.trim()) {
      setSyncError(t('cloudSaveEnterPhrase'));
      setSyncMessage('');
      return;
    }

    const username = cleanUsername(cloudUsername);
    if (username.length < 3) {
      setSyncError(t('settingsUsernameTooShort'));
      setSyncMessage('');
      return;
    }

    setIsSyncBusy(true);
    setSyncError('');
    setSyncConflicts([]);
    setSyncMessage(accountSession ? t('settingsSyncStarting') : t('settingsSyncConnecting'));
    Keyboard.dismiss();
    let didStartBackgroundSync = false;

    try {
      await waitForBusyIndicator();
      if (!accountSession) {
        setSyncMessage(t('settingsSyncProtectingPhrase'));
        await waitForBusyIndicator();
        const result = await connectPrivateSyncPhrase(privateSyncPhrase, username);
        const connectedUsername = result.username || username;
        await persistCloudUsername(connectedUsername);
        setAccountSession({
          email: connectedUsername,
          signedInAt: result.createdAt,
        });
        didStartBackgroundSync = true;
        startCloudSaveSyncInBackground(
          privateSyncPhrase,
          t('settingsSyncConnectedBackground')
        );
        return;
      } else if (username !== accountSession.email) {
        setSyncMessage(t('settingsSyncCheckingUsername'));
        const availability = await checkSyncUsernameAvailability(username);
        if (!availability.available) {
          setSyncError(t('settingsSyncErrorUsernameTaken'));
          setSyncMessage('');
          return;
        }

        const didConfirm = await confirmUsernameChange(accountSession.email, availability.username, t);
        if (!didConfirm) {
          setSyncMessage('');
          return;
        }

        setSyncMessage(t('settingsSyncSavingUsername'));
        const nextSession = await updateSyncUsername(availability.username, privateSyncPhrase);
        const connectedUsername = nextSession.username || username;
        await persistCloudUsername(connectedUsername);
        setAccountSession({
          email: connectedUsername,
          signedInAt: nextSession.createdAt,
        });
        didStartBackgroundSync = true;
        startCloudSaveSyncInBackground(
          privateSyncPhrase,
          t('settingsSyncUsernameChangedBackground')
        );
        return;
      } else {
        didStartBackgroundSync = true;
        startCloudSaveSyncInBackground(privateSyncPhrase, t('settingsSyncBackground'));
        return;
      }
    } catch (error) {
      setSyncError(
        getFriendlySyncError(
          error,
          t('settingsSyncGotStuck'),
          t
        )
      );
      setSyncMessage('');
    } finally {
      if (!didStartBackgroundSync) {
        setIsSyncBusy(false);
      }
    }
  };

  const handleShowSyncLog = async () => {
    setIsSyncBusy(true);
    setSyncError('');
    setSyncMessage(t('settingsSyncLogLoading'));
    try {
      await waitForBusyIndicator();
      const log = await getEncryptedSyncLog();
      setSyncLogEvents(log.events);
      setIsSyncLogVisible(true);
      setSyncError('');
      setSyncMessage(log.events.length === 0 ? t('settingsSyncLogNothing') : t('settingsSyncLogLoaded'));
    } catch (error) {
      setSyncError(getFriendlySyncError(error, t('settingsSyncLogLoadError'), t));
      setSyncMessage('');
    } finally {
      setIsSyncBusy(false);
    }
  };

  const handleKeepConflictVersion = async (
    conflict: SyncConflict,
    version: SyncConflictVersion
  ) => {
    if (!privateSyncPhrase.trim()) {
      setSyncError(t('settingsSyncConflictEnterPhrase'));
      setSyncMessage('');
      return;
    }

    setIsSyncBusy(true);
    setSyncError('');
    setSyncMessage(t('settingsSyncConflictFixing'));
    try {
      await waitForBusyIndicator();
      await keepEncryptedSyncConflictVersion(privateSyncPhrase, conflict, version);
      const conflicts = await getEncryptedSyncConflicts(privateSyncPhrase);
      setSyncConflicts(conflicts);
      setSyncError('');
      setSyncMessage(t('settingsSyncConflictPicked'));
    } catch (error) {
      setSyncError(getFriendlySyncError(error, t('settingsSyncConflictPickError'), t));
      setSyncMessage('');
    } finally {
      setIsSyncBusy(false);
    }
  };

  const handleSaveBothConflictVersions = async (conflict: SyncConflict) => {
    if (!privateSyncPhrase.trim()) {
      setSyncError(t('settingsSyncConflictEnterPhrase'));
      setSyncMessage('');
      return;
    }

    setIsSyncBusy(true);
    setSyncError('');
    setSyncMessage(t('settingsSyncConflictBothSaving'));
    try {
      await waitForBusyIndicator();
      await saveBothEncryptedSyncConflictVersions(privateSyncPhrase, conflict);
      const conflicts = await getEncryptedSyncConflicts(privateSyncPhrase);
      setSyncConflicts(conflicts);
      setSyncError('');
      setSyncMessage(t('settingsSyncConflictBothSaved'));
    } catch (error) {
      setSyncError(getFriendlySyncError(error, t('settingsSyncConflictBothError'), t));
      setSyncMessage('');
    } finally {
      setIsSyncBusy(false);
    }
  };

  const downloadExportText = (text: string) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return false;
    }

    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bible-app-journal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return true;
  };

  const handleExportJournalData = async () => {
    try {
      const snapshot = await buildJournalExportSnapshot();
      const nextExportText = JSON.stringify(snapshot, null, 2);
      const didDownload = downloadExportText(nextExportText);
      setExportText(didDownload ? '' : nextExportText);
      setDataError('');
      setDataMessage(
        didDownload ? t('settingsExportDownloaded') : t('settingsExportReady')
      );
    } catch (error) {
      console.log('Error exporting journal data:', error);
      setDataError(t('settingsExportError'));
      setDataMessage('');
    }
  };

  const performResetJournalData = async () => {
    try {
      await resetJournalData();
      setExportText('');
      setDataError('');
      setDataMessage(t('settingsResetSuccess'));
    } catch (error) {
      console.log('Error resetting journal data:', error);
      setDataError(t('settingsResetError'));
      setDataMessage('');
    }
  };

  const handleResetJournalData = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(t('settingsResetMessage'))) {
        void performResetJournalData();
      }
      return;
    }

    Alert.alert(
      t('settingsResetTitle'),
      t('settingsResetMessage'),
      [
        { text: t('actionCancel'), style: 'cancel' },
        { text: t('settingsResetJournalData'), style: 'destructive', onPress: () => void performResetJournalData() },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colorTheme.screenBackground }]}
      contentContainerStyle={[
        styles.content,
        layout.isTablet
          ? [
              styles.tabletContent,
              {
                maxWidth: layout.settingsMaxWidth,
                paddingHorizontal: layout.pagePaddingHorizontal,
              },
            ]
          : null,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="always">
      <Text style={styles.title}>{t('settingsTitle')}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settingsBibleReadingTitle')}</Text>

        <View
          style={[
            styles.bibleProgressCard,
            {
              backgroundColor: colorTheme.cardBackground,
              borderColor: colorTheme.border,
            },
          ]}>
          <View style={styles.bibleProgressHeader}>
            <View style={[styles.accountIcon, { backgroundColor: colorTheme.toolbarBackground }]}>
              <Ionicons name="book-outline" size={22} color="#5B514D" />
            </View>
            <View style={styles.accountHeaderText}>
              <Text style={styles.accountTitle}>{t('settingsBibleProgressTitle')}</Text>
              <Text style={styles.accountHint}>
                {t('settingsBibleProgressHint', {
                  read: bibleReadingProgress.readCount.toLocaleString(),
                  total: bibleReadingProgress.totalCount.toLocaleString(),
                })}
              </Text>
            </View>
            <Text style={styles.bibleProgressPercent}>
              {bibleReadingProgress.percent < 1 && bibleReadingProgress.percent > 0
                ? '<1%'
                : `${Math.floor(bibleReadingProgress.percent)}%`}
            </Text>
          </View>

          <View style={[styles.bibleProgressTrack, { backgroundColor: colorTheme.paperBackground }]}>
            <View
              style={[
                styles.bibleProgressFill,
                {
                  backgroundColor: colorTheme.tint,
                  width: `${Math.min(100, Math.max(0, bibleReadingProgress.percent))}%`,
                },
              ]}
            />
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.84}
          onPress={() => setBibleReadingImagesEnabled(!bibleReadingImagesEnabled)}
          accessibilityRole="switch"
          accessibilityState={{ checked: bibleReadingImagesEnabled }}
          style={[
            styles.bibleReadingImagesCard,
            {
              backgroundColor: colorTheme.cardBackground,
              borderColor: colorTheme.border,
            },
          ]}>
          <View style={[styles.accountIcon, { backgroundColor: colorTheme.toolbarBackground }]}>
            <Ionicons name="images-outline" size={22} color="#5B514D" />
          </View>
          <View style={styles.accountHeaderText}>
            <Text style={styles.accountTitle}>{t('settingsBibleReadingImages')}</Text>
            <Text style={styles.accountHint}>{t('settingsBibleReadingImagesHint')}</Text>
          </View>
          <Switch
            value={bibleReadingImagesEnabled}
            onValueChange={setBibleReadingImagesEnabled}
            trackColor={{ false: '#E8DCD4', true: colorTheme.tint }}
            thumbColor="#FFFDF9"
            ios_backgroundColor="#E8DCD4"
          />
        </TouchableOpacity>
      </View>

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
              <Ionicons name="sparkles-outline" size={22} color="#5B514D" />
            </View>

            <View style={styles.accountHeaderText}>
              <Text style={styles.accountTitle}>
                {accountSession ? accountSession.email : t('settingsCloudSave')}
              </Text>
              <Text style={styles.accountHint}>{t('settingsPhraseHint')}</Text>
            </View>

            <TouchableOpacity
              accessibilityLabel={t('settingsSyncLogTitle')}
              activeOpacity={0.86}
              disabled={isCloudSaveBusy || !accountSession}
              onPress={handleShowSyncLog}
              style={[styles.iconOnlyButton, { borderColor: colorTheme.border }]}>
              <Ionicons name="list-outline" size={18} color="#5B514D" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('settingsUsername')}</Text>
            <View style={styles.usernameRow}>
              <TextInput
                value={cloudUsername}
                onChangeText={(value) => {
                  void persistCloudUsername(value, { fallbackIfEmpty: false });
                }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isCloudSaveBusy}
                placeholder="GraceBloom123"
                placeholderTextColor="#A99D96"
                style={[
                  styles.textInput,
                  styles.usernameInput,
                  {
                    backgroundColor: colorTheme.paperBackground,
                    borderColor: colorTheme.border,
                  },
                ]}
              />
              <TouchableOpacity
                accessibilityLabel={t('settingsUsernameShuffle')}
                activeOpacity={0.86}
                disabled={isCloudSaveBusy}
                onPress={() => {
                  void persistCloudUsername(makePrettyUsername());
                }}
                style={[styles.shuffleButton, { borderColor: colorTheme.border }]}>
                <Ionicons name="sparkles-outline" size={17} color="#5B514D" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.phraseWarningText}>
            {t('settingsPhraseWarning')}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('settingsSecretPhrase')}</Text>
            <TextInput
              value={privateSyncPhrase}
              onChangeText={setPrivateSyncPhrase}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!isPasswordVisible}
              returnKeyType="go"
              onSubmitEditing={handleCloudConnectAndSync}
              placeholder={t('settingsPhrasePlaceholder')}
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

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => setIsPasswordVisible((current) => !current)}
            style={[styles.secondaryButton, styles.showPhraseButton, { borderColor: colorTheme.border }]}>
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={16}
              color="#5B514D"
            />
            <Text style={styles.secondaryButtonText}>
              {isPasswordVisible ? t('settingsPhraseHide') : t('settingsPhraseShow')}
            </Text>
          </TouchableOpacity>

          {syncError ? <Text style={styles.errorText}>{syncError}</Text> : null}
          {isCloudSaveBusy && syncMessage ? (
            <View style={styles.busyRow}>
              <ActivityIndicator size="small" color="#5F8F73" />
              <Text style={styles.busyText}>{syncMessage}</Text>
            </View>
          ) : syncMessage ? (
            <Text style={styles.successText}>{syncMessage}</Text>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.88}
            disabled={isCloudSaveBusy}
            onPress={handleCloudConnectAndSync}
            style={[styles.primaryButton, { backgroundColor: colorTheme.tint }]}>
            <Ionicons name={accountSession ? 'sync-outline' : 'link-outline'} size={17} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>
              {accountSession ? t('settingsSyncNow') : t('settingsSyncConnect')}
            </Text>
          </TouchableOpacity>

          {isSyncLogVisible ? (
            <View style={[styles.syncLogCard, { borderColor: colorTheme.border }]}>
              <Text style={styles.syncLogTitle}>{t('settingsSyncLogTitle')}</Text>
              {syncLogEvents.length === 0 ? (
                <Text style={styles.syncLogEmpty}>{t('settingsSyncLogEmpty')}</Text>
              ) : (
                syncLogEvents.map((event) => (
                  <View key={event.id} style={styles.syncLogRow}>
                    <Ionicons
                      name={event.type === 'pull' ? 'cloud-download-outline' : 'cloud-upload-outline'}
                      size={16}
                      color="#5B514D"
                    />
                    <Text style={styles.syncLogText}>
                      {event.type === 'pull' ? t('settingsSyncDownload') : t('settingsSyncUpload')} •{' '}
                      {t(
                        event.itemCount === 1
                          ? 'settingsSyncItemCount'
                          : 'settingsSyncItemCountPlural',
                        { count: event.itemCount }
                      )} •{' '}
                      {new Date(event.createdAt).toLocaleString()}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : null}

          {syncConflicts.map((conflict) => {
            const canSaveBoth =
              conflict.versions.length > 1 &&
              (conflict.itemType === 'journal_entry' ||
                conflict.itemType === 'studio_journal_entry');

            return (
              <View
                key={conflict.itemId}
                style={[
                  styles.conflictCard,
                  {
                    backgroundColor: colorTheme.paperBackground,
                    borderColor: colorTheme.border,
                  },
                ]}>
                <Text style={styles.conflictTitle}>{t('settingsConflictPickTitle')}</Text>
                <Text style={styles.conflictSubtitle}>
                  {t('settingsConflictSubtitle')}
                </Text>

                {conflict.versions.map((version) => (
                  <View key={version.id} style={styles.conflictVersionRow}>
                    <View style={styles.conflictVersionText}>
                      <Text style={styles.conflictVersionTitle}>
                        {version.deviceName} •{' '}
                        {new Date(version.clientUpdatedAt).toLocaleString()}
                      </Text>
                      <Text style={styles.conflictPreview}>{version.preview}</Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.86}
                      disabled={isCloudSaveBusy}
                      onPress={() => void handleKeepConflictVersion(conflict, version)}
                      style={[styles.smallChoiceButton, { borderColor: colorTheme.border }]}>
                      <Text style={styles.smallChoiceButtonText}>{t('settingsConflictPick')}</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {canSaveBoth ? (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    disabled={isCloudSaveBusy}
                    onPress={() => void handleSaveBothConflictVersions(conflict)}
                    style={[styles.secondaryButton, { borderColor: colorTheme.border }]}>
                    <Ionicons name="copy-outline" size={17} color="#5B514D" />
                    <Text style={styles.secondaryButtonText}>{t('settingsConflictKeepBoth')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}

          {accountSession ? (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => {
                void disconnectPrivateSync().then(refreshPrivateSyncSession);
                setPrivateSyncPhrase('');
                setSyncConflicts([]);
                setSyncMessage('');
                setSyncError('');
              }}
              style={[styles.dangerButton, { borderColor: colorTheme.border }]}>
              <Ionicons name="unlink-outline" size={17} color="#B85F62" />
              <Text style={styles.dangerButtonText}>{t('settingsDisconnect')}</Text>
            </TouchableOpacity>
          ) : null}
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settingsDataSafety')}</Text>

        <View
          style={[
            styles.dataCard,
            {
              backgroundColor: colorTheme.cardBackground,
              borderColor: colorTheme.border,
            },
          ]}>
          <View style={styles.dataHeaderRow}>
            <View style={[styles.accountIcon, { backgroundColor: colorTheme.toolbarBackground }]}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#5B514D" />
            </View>
            <View style={styles.accountHeaderText}>
              <Text style={styles.accountTitle}>{t('settingsJournalBackupTitle')}</Text>
              <Text style={styles.accountHint}>
                {t('settingsJournalBackupHint')}
              </Text>
            </View>
          </View>

          {dataError ? <Text style={styles.errorText}>{dataError}</Text> : null}
          {dataMessage ? <Text style={styles.successText}>{dataMessage}</Text> : null}

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handleExportJournalData}
            style={[styles.primaryButton, { backgroundColor: colorTheme.tint }]}>
            <Ionicons name="download-outline" size={17} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>{t('settingsExportJournalData')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handleResetJournalData}
            style={[styles.dangerButton, { borderColor: colorTheme.border }]}>
            <Ionicons name="trash-outline" size={17} color="#B85F62" />
            <Text style={styles.dangerButtonText}>{t('settingsResetJournalData')}</Text>
          </TouchableOpacity>

          {exportText ? (
            <TextInput
              value={exportText}
              editable={false}
              multiline
              selectTextOnFocus
              style={[
                styles.exportPreview,
                {
                  backgroundColor: colorTheme.paperBackground,
                  borderColor: colorTheme.border,
                },
              ]}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settingsAboutTitle')}</Text>

        <View
          style={[
            styles.aboutCard,
            {
              backgroundColor: colorTheme.cardBackground,
              borderColor: colorTheme.border,
            },
          ]}>
          <View style={styles.aboutHeaderRow}>
            <Image
              source={FAITH_CANVAS_ICON}
              accessibilityLabel={t('settingsAboutImageLabel')}
              style={styles.aboutLogo}
            />

            <View style={styles.accountHeaderText}>
              <Text style={styles.accountTitle}>{t('settingsAboutAppName')}</Text>
              <Text style={styles.accountHint}>{t('settingsAboutVersion')}</Text>
            </View>
          </View>

          <View style={[styles.privacySummary, { backgroundColor: colorTheme.paperBackground }]}>
            <View style={styles.privacySummaryRow}>
              <Ionicons name="phone-portrait-outline" size={18} color="#5B514D" />
              <Text style={styles.privacySummaryText}>{t('settingsPrivacyLocal')}</Text>
            </View>
            <View style={styles.privacySummaryRow}>
              <Ionicons name="cloud-outline" size={18} color="#5B514D" />
              <Text style={styles.privacySummaryText}>{t('settingsPrivacyCloud')}</Text>
            </View>
            <View style={styles.privacySummaryRow}>
              <Ionicons name="heart-outline" size={18} color="#5B514D" />
              <Text style={styles.privacySummaryText}>{t('settingsPrivacyNoAds')}</Text>
            </View>
          </View>

          <View style={styles.legalLinkGrid}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => void openFaithCanvasLink(FAITH_CANVAS_LINKS.privacy)}
              style={[styles.legalLinkButton, { borderColor: colorTheme.border }]}>
              <Ionicons name="document-text-outline" size={18} color="#5B514D" />
              <Text style={styles.legalLinkText}>{t('settingsPrivacyPolicy')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => void openFaithCanvasLink(FAITH_CANVAS_LINKS.safety)}
              style={[styles.legalLinkButton, { borderColor: colorTheme.border }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#5B514D" />
              <Text style={styles.legalLinkText}>{t('settingsChildSafety')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => void openFaithCanvasLink(FAITH_CANVAS_LINKS.support)}
              style={[styles.legalLinkButton, { borderColor: colorTheme.border }]}>
              <Ionicons name="help-circle-outline" size={18} color="#5B514D" />
              <Text style={styles.legalLinkText}>{t('settingsSupport')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => void openFaithCanvasLink(FAITH_CANVAS_LINKS.email)}
            style={[styles.secondaryButton, styles.supportEmailButton, { borderColor: colorTheme.border }]}>
            <Ionicons name="mail-outline" size={17} color="#5B514D" />
            <Text style={styles.secondaryButtonText}>{t('settingsSupportEmail')}</Text>
          </TouchableOpacity>
        </View>
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
  tabletContent: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: Platform.OS === 'web' ? 24 : 34,
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
  bibleProgressCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bibleProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  bibleProgressPercent: {
    color: '#1F1F1F',
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 12,
  },
  bibleProgressTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  bibleProgressFill: {
    height: '100%',
    borderRadius: 6,
  },
  bibleReadingImagesCard: {
    minHeight: 76,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dataCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  aboutCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dataHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  aboutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  aboutLogo: {
    width: 54,
    height: 54,
    borderRadius: 16,
    marginRight: 12,
  },
  privacySummary: {
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  privacySummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  privacySummaryText: {
    flex: 1,
    color: '#5B514D',
    fontSize: 13,
    lineHeight: 18,
  },
  legalLinkGrid: {
    gap: 10,
    marginTop: 14,
  },
  legalLinkButton: {
    minHeight: 46,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  legalLinkText: {
    color: '#5B514D',
    fontSize: 14,
    fontWeight: '700',
  },
  supportEmailButton: {
    marginTop: 12,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconOnlyButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
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
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  usernameInput: {
    flex: 1,
  },
  shuffleButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  showPhraseButton: {
    alignSelf: 'flex-start',
    marginTop: -4,
    marginBottom: 8,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B514D',
  },
  dangerButton: {
    minHeight: 44,
    borderRadius: 15,
    borderWidth: 1,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  dangerButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#B85F62',
  },
  exportPreview: {
    minHeight: 150,
    maxHeight: 260,
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 12,
    padding: 12,
    fontSize: 12,
    lineHeight: 17,
    color: '#1F1F1F',
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
  busyRow: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  busyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5F8F73',
  },
  phraseWarningText: {
    marginTop: 4,
    marginBottom: 14,
    fontSize: 14,
    fontWeight: '900',
    color: '#B85F62',
  },
  syncLogCard: {
    borderWidth: 1,
    borderRadius: 15,
    marginTop: 10,
    padding: 12,
    backgroundColor: '#FFFDF9',
  },
  syncLogTitle: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  syncLogEmpty: {
    fontSize: 13,
    color: '#7A6F66',
  },
  syncLogRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncLogText: {
    flex: 1,
    fontSize: 12,
    color: '#5B514D',
    fontWeight: '600',
  },
  conflictCard: {
    borderWidth: 1,
    borderRadius: 15,
    marginTop: 12,
    padding: 12,
  },
  conflictTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  conflictSubtitle: {
    marginTop: 2,
    marginBottom: 8,
    fontSize: 12,
    color: '#7A6F66',
  },
  conflictVersionRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  conflictVersionText: {
    flex: 1,
  },
  conflictVersionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B514D',
  },
  conflictPreview: {
    marginTop: 3,
    fontSize: 12,
    color: '#7A6F66',
  },
  smallChoiceButton: {
    minWidth: 54,
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallChoiceButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B514D',
  },
});
