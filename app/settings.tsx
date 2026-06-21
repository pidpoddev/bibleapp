import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAppSettings } from '@/utils/app-settings';
import { buildJournalExportSnapshot, resetJournalData } from '@/utils/journal-storage';
import {
  connectPrivateSyncPhrase,
  disconnectPrivateSync,
  getEncryptedSyncConflicts,
  getEncryptedSyncLog,
  getSyncSession,
  keepEncryptedSyncConflictVersion,
  pullEncryptedSync,
  pushEncryptedSync,
  saveBothEncryptedSyncConflictVersions,
  type SyncConflict,
  type SyncConflictVersion,
  type SyncLogEvent,
} from '@/utils/sync-client';

type AccountSession = {
  email: string;
  signedInAt: number;
};

function getFriendlySyncError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;

  if (message.includes('did not match') || message.includes('does not match')) {
    return 'That phrase does not match this device.';
  }

  if (message.includes('Unauthorized sync device')) {
    return 'Cloud Save needs to reconnect. Enter your Secret Phrase again.';
  }

  if (message.includes('Private Sync Phrase') || message.includes('Create or enter')) {
    return 'Enter your Secret Phrase first.';
  }

  if (message.includes('Unexpected API error') || message.includes('Sync request failed')) {
    return fallback;
  }

  return message
    .replaceAll('Private Sync', 'Cloud Save')
    .replaceAll('sync', 'cloud save')
    .replaceAll('Sync', 'Cloud Save');
}

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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [accountSession, setAccountSession] = useState<AccountSession | null>(null);
  const [dataMessage, setDataMessage] = useState('');
  const [dataError, setDataError] = useState('');
  const [exportText, setExportText] = useState('');
  const [privateSyncPhrase, setPrivateSyncPhrase] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');
  const [isSyncBusy, setIsSyncBusy] = useState(false);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([]);
  const [syncLogEvents, setSyncLogEvents] = useState<SyncLogEvent[]>([]);
  const [isSyncLogVisible, setIsSyncLogVisible] = useState(false);

  useEffect(() => {
    const loadAccountSession = async () => {
      try {
        const storedSyncSession = await getSyncSession();

        if (storedSyncSession) {
          setAccountSession({
            email: `Cloud Save ${storedSyncSession.phraseFingerprint}`,
            signedInAt: storedSyncSession.createdAt,
          });
        }
      } catch (error) {
        console.log('Error loading account session:', error);
      }
    };

    void loadAccountSession();
  }, []);

  const refreshPrivateSyncSession = async () => {
    const storedSyncSession = await getSyncSession();

    if (storedSyncSession) {
      setAccountSession({
        email: `Cloud Save ${storedSyncSession.phraseFingerprint}`,
        signedInAt: storedSyncSession.createdAt,
      });
    } else {
      setAccountSession(null);
    }
  };

  const handleConnectPrivateSyncPhrase = async () => {
    if (!privateSyncPhrase.trim()) {
      setSyncError('Enter your Secret Phrase first.');
      setSyncMessage('');
      return;
    }

    setIsSyncBusy(true);
    try {
      const result = await connectPrivateSyncPhrase(privateSyncPhrase);
      await refreshPrivateSyncSession();
      setSyncConflicts([]);
      setSyncError('');
      setSyncMessage(result.message || 'Connected');
    } catch (error) {
      setSyncError(getFriendlySyncError(error, 'Could not connect cloud save.'));
      setSyncMessage('');
    } finally {
      setIsSyncBusy(false);
    }
  };

  const handlePushPrivateSync = async () => {
    if (!privateSyncPhrase.trim()) {
      setSyncError('Enter your Secret Phrase to save to cloud.');
      setSyncMessage('');
      return;
    }

    setIsSyncBusy(true);
    try {
      const result = await pushEncryptedSync(privateSyncPhrase);
      await refreshPrivateSyncSession();
      setSyncError('');
      setSyncMessage(
        result.conflictCount > 0
          ? `Saved ${result.pushedCount} things. ${result.conflictCount} need a quick check.`
          : "Y'all N Sync"
      );

      if (result.conflictCount > 0) {
        setSyncConflicts(await getEncryptedSyncConflicts(privateSyncPhrase));
      }
    } catch (error) {
      setSyncError(getFriendlySyncError(error, 'Could not save to cloud.'));
      setSyncMessage('');
    } finally {
      setIsSyncBusy(false);
    }
  };

  const handlePullPrivateSync = async () => {
    if (!privateSyncPhrase.trim()) {
      setSyncError('Enter your Secret Phrase to get your cloud saves.');
      setSyncMessage('');
      return;
    }

    setIsSyncBusy(true);
    try {
      const result = await pullEncryptedSync(privateSyncPhrase, { full: true });
      await refreshPrivateSyncSession();
      setSyncError('');
      setSyncMessage(
        result.pulledCount === 0 && result.deletedCount === 0
          ? "Y'all N Sync"
          : `Got ${result.pulledCount} saved thing${result.pulledCount === 1 ? '' : 's'}${
              result.deletedCount ? ` and cleaned up ${result.deletedCount}` : ''
            }.`
      );
    } catch (error) {
      setSyncError(getFriendlySyncError(error, 'Could not get cloud saves.'));
      setSyncMessage('');
    } finally {
      setIsSyncBusy(false);
    }
  };

  const handleReviewSyncConflicts = async () => {
    if (!privateSyncPhrase.trim()) {
      setSyncError('Enter your Secret Phrase to check saved versions.');
      setSyncMessage('');
      return;
    }

    setIsSyncBusy(true);
    try {
      const conflicts = await getEncryptedSyncConflicts(privateSyncPhrase);
      setSyncConflicts(conflicts);
      setSyncError('');
      setSyncMessage(
        conflicts.length === 0
          ? 'No mix-ups to fix.'
          : `${conflicts.length} saved thing${conflicts.length === 1 ? '' : 's'} need a quick check.`
      );
    } catch (error) {
      setSyncError(getFriendlySyncError(error, 'Could not check saved versions.'));
      setSyncMessage('');
    } finally {
      setIsSyncBusy(false);
    }
  };

  const handleShowSyncLog = async () => {
    setIsSyncBusy(true);
    try {
      const log = await getEncryptedSyncLog();
      setSyncLogEvents(log.events);
      setIsSyncLogVisible(true);
      setSyncError('');
      setSyncMessage(log.events.length === 0 ? 'Nothing saved or downloaded yet.' : "Y'all N Sync");
    } catch (error) {
      setSyncError(getFriendlySyncError(error, 'Could not load Cloud Save Log.'));
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
      setSyncError('Enter your Secret Phrase to fix this.');
      setSyncMessage('');
      return;
    }

    setIsSyncBusy(true);
    try {
      await keepEncryptedSyncConflictVersion(privateSyncPhrase, conflict, version);
      const conflicts = await getEncryptedSyncConflicts(privateSyncPhrase);
      setSyncConflicts(conflicts);
      setSyncError('');
      setSyncMessage('Saved version picked.');
    } catch (error) {
      setSyncError(getFriendlySyncError(error, 'Could not pick that version.'));
      setSyncMessage('');
    } finally {
      setIsSyncBusy(false);
    }
  };

  const handleSaveBothConflictVersions = async (conflict: SyncConflict) => {
    if (!privateSyncPhrase.trim()) {
      setSyncError('Enter your Secret Phrase to fix this.');
      setSyncMessage('');
      return;
    }

    setIsSyncBusy(true);
    try {
      await saveBothEncryptedSyncConflictVersions(privateSyncPhrase, conflict);
      const conflicts = await getEncryptedSyncConflicts(privateSyncPhrase);
      setSyncConflicts(conflicts);
      setSyncError('');
      setSyncMessage('Both versions were saved.');
    } catch (error) {
      setSyncError(getFriendlySyncError(error, 'Could not save both versions.'));
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
      setExportText(nextExportText);
      setDataError('');
      setDataMessage(
        downloadExportText(nextExportText)
          ? 'Journal backup downloaded.'
          : 'Journal backup is ready below.'
      );
    } catch (error) {
      console.log('Error exporting journal data:', error);
      setDataError('Could not prepare journal backup.');
      setDataMessage('');
    }
  };

  const performResetJournalData = async () => {
    try {
      await resetJournalData();
      setExportText('');
      setDataError('');
      setDataMessage('Journal entries and saved designs were reset.');
    } catch (error) {
      console.log('Error resetting journal data:', error);
      setDataError('Could not reset journal data.');
      setDataMessage('');
    }
  };

  const handleResetJournalData = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Reset all journal entries and saved designs? This cannot be undone.')) {
        void performResetJournalData();
      }
      return;
    }

    Alert.alert(
      'Reset journal data?',
      'This removes journal entries and saved designs from this device. Account, theme, and language settings stay.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => void performResetJournalData() },
      ]
    );
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
              <Ionicons name="key-outline" size={22} color="#5B514D" />
            </View>

            <View style={styles.accountHeaderText}>
              <Text style={styles.accountTitle}>
                {accountSession
                  ? 'Cloud Save connected'
                  : 'Secret Phrase'}
              </Text>
              <Text style={styles.accountHint}>
                {accountSession
                  ? 'Your journal can save to the cloud.'
                  : 'Use one phrase to save and get your journal on your devices.'}
              </Text>
            </View>
          </View>

          <Text style={styles.accountHint}>
            Your journal is locked before it saves to the cloud.
          </Text>
          <Text style={styles.phraseWarningText}>
            {"Don't lose the phrase! It can't be recovered."}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Secret Phrase</Text>
            <TextInput
              value={privateSyncPhrase}
              onChangeText={setPrivateSyncPhrase}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!isPasswordVisible}
              placeholder="Enter Secret Phrase"
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

          <View style={styles.signedInRow}>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => setIsPasswordVisible((current) => !current)}
              style={[styles.secondaryButton, { borderColor: colorTheme.border }]}>
              <Ionicons
                name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={16}
                color="#5B514D"
              />
              <Text style={styles.secondaryButtonText}>
                {isPasswordVisible ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>

          {syncError ? <Text style={styles.errorText}>{syncError}</Text> : null}
          {syncMessage ? <Text style={styles.successText}>{syncMessage}</Text> : null}

          <TouchableOpacity
            activeOpacity={0.88}
            disabled={isSyncBusy}
            onPress={handleConnectPrivateSyncPhrase}
            style={[styles.primaryButton, { backgroundColor: colorTheme.tint }]}>
            <Ionicons name="link-outline" size={17} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>
              {accountSession ? 'Reconnect Cloud Save' : 'Connect Cloud Save'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            disabled={isSyncBusy || !accountSession}
            onPress={handlePushPrivateSync}
            style={[styles.primaryButton, { backgroundColor: colorTheme.tint }]}>
            <Ionicons name="cloud-upload-outline" size={17} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Save to Cloud</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            disabled={isSyncBusy || !accountSession}
            onPress={handlePullPrivateSync}
            style={[styles.secondaryButton, { borderColor: colorTheme.border }]}>
            <Ionicons name="cloud-download-outline" size={17} color="#5B514D" />
            <Text style={styles.secondaryButtonText}>Get Cloud Saves</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            disabled={isSyncBusy || !accountSession}
            onPress={handleReviewSyncConflicts}
            style={[styles.secondaryButton, { borderColor: colorTheme.border }]}>
            <Ionicons name="git-compare-outline" size={17} color="#5B514D" />
            <Text style={styles.secondaryButtonText}>Fix Mix-Ups</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            disabled={isSyncBusy || !accountSession}
            onPress={handleShowSyncLog}
            style={[styles.secondaryButton, { borderColor: colorTheme.border }]}>
            <Ionicons name="list-outline" size={17} color="#5B514D" />
            <Text style={styles.secondaryButtonText}>Log</Text>
          </TouchableOpacity>

          {isSyncLogVisible ? (
            <View style={[styles.syncLogCard, { borderColor: colorTheme.border }]}>
              <Text style={styles.syncLogTitle}>Cloud Save Log</Text>
              {syncLogEvents.length === 0 ? (
                <Text style={styles.syncLogEmpty}>No uploads or downloads yet.</Text>
              ) : (
                syncLogEvents.map((event) => (
                  <View key={event.id} style={styles.syncLogRow}>
                    <Ionicons
                      name={event.type === 'pull' ? 'cloud-download-outline' : 'cloud-upload-outline'}
                      size={16}
                      color="#5B514D"
                    />
                    <Text style={styles.syncLogText}>
                      {event.type === 'pull' ? 'Download' : 'Upload'} • {event.itemCount}{' '}
                      item{event.itemCount === 1 ? '' : 's'} •{' '}
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
                <Text style={styles.conflictTitle}>Pick the version you want</Text>
                <Text style={styles.conflictSubtitle}>
                  This was saved on more than one device.
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
                      disabled={isSyncBusy}
                      onPress={() => void handleKeepConflictVersion(conflict, version)}
                      style={[styles.smallChoiceButton, { borderColor: colorTheme.border }]}>
                      <Text style={styles.smallChoiceButtonText}>Pick</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {canSaveBoth ? (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    disabled={isSyncBusy}
                    onPress={() => void handleSaveBothConflictVersions(conflict)}
                    style={[styles.secondaryButton, { borderColor: colorTheme.border }]}>
                    <Ionicons name="copy-outline" size={17} color="#5B514D" />
                    <Text style={styles.secondaryButtonText}>Keep Both</Text>
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
              <Text style={styles.dangerButtonText}>Disconnect this device</Text>
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
        <Text style={styles.sectionTitle}>Data safety</Text>

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
              <Text style={styles.accountTitle}>Journal backup</Text>
              <Text style={styles.accountHint}>
                Export entries before changing devices or clearing local data.
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
            <Text style={styles.primaryButtonText}>Export journal data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handleResetJournalData}
            style={[styles.dangerButton, { borderColor: colorTheme.border }]}>
            <Ionicons name="trash-outline" size={17} color="#B85F62" />
            <Text style={styles.dangerButtonText}>Reset journal data</Text>
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
  dataHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
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
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
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
