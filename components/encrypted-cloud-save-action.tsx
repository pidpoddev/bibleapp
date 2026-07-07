import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import {
  connectPrivateSyncPhrase,
  getSyncSession,
  pushEncryptedSync,
} from '@/utils/sync-client';
import { useAppSettings, type TranslationKey } from '@/utils/app-settings';

type CloudSaveResult = {
  pushedCount: number;
  conflictCount: number;
};

type EncryptedCloudSaveActionProps = {
  label?: string;
  buttonStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  iconColor?: string;
  disabledStyle?: StyleProp<ViewStyle>;
  onSaved?: (result: CloudSaveResult) => void;
};

function getFriendlyCloudError(
  error: unknown,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
) {
  const message = error instanceof Error ? error.message : t('cloudSaveGenericError');

  if (message.includes('did not match') || message.includes('does not match')) {
    return t('cloudSavePhraseMismatch');
  }

  if (message.includes('Unauthorized sync device')) {
    return t('cloudSaveReconnect');
  }

  if (message.includes('Private Sync Phrase') || message.includes('Create or enter')) {
    return t('cloudSaveEnterPhrase');
  }

  if (message.includes('Unexpected API error') || message.includes('Sync request failed')) {
    return t('cloudSaveGenericError');
  }

  return message
    .replaceAll('Private Sync', 'Cloud Save')
    .replaceAll('sync', 'cloud save')
    .replaceAll('Sync', 'Cloud Save');
}

export function EncryptedCloudSaveAction({
  label,
  buttonStyle,
  textStyle,
  iconColor = '#5B514D',
  disabledStyle,
  onSaved,
}: EncryptedCloudSaveActionProps) {
  const { t } = useAppSettings();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [phrase, setPhrase] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const buttonLabel = label ?? t('actionSaveToCloud');

  const openCloudSave = async () => {
    setError('');
    setMessage('');
    setIsModalVisible(true);

    try {
      const session = await getSyncSession();
      setHasSession(Boolean(session));
      setMessage(
        session
          ? t('cloudSaveExistingSessionPrompt')
          : t('cloudSaveNewSessionPrompt')
      );
    } catch {
      setHasSession(false);
      setMessage(t('cloudSaveNewSessionPrompt'));
    }
  };

  const closeCloudSave = () => {
    if (isBusy) {
      return;
    }

    setIsModalVisible(false);
    setPhrase('');
    setError('');
  };

  const saveToCloud = async () => {
    if (!phrase.trim()) {
      setError(t('cloudSaveEnterPhrase'));
      return;
    }

    setIsBusy(true);
    setError('');

    try {
      const session = await getSyncSession();

      if (!session) {
        await connectPrivateSyncPhrase(phrase);
      }

      const result = await pushEncryptedSync(phrase);
      setPhrase('');
      setError('');

      if (onSaved) {
        setIsModalVisible(false);
        setMessage('');
        onSaved(result);
      } else {
        setMessage(
          result.conflictCount > 0
            ? t('cloudSaveConflictMessage')
            : t(result.pushedCount === 1 ? 'cloudSaveSuccessCountOne' : 'cloudSaveSuccessCount', {
                count: result.pushedCount,
              })
        );
      }
    } catch (cloudError) {
      setError(getFriendlyCloudError(cloudError, t));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          void openCloudSave();
        }}
        style={[buttonStyle, isBusy ? disabledStyle : null]}
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}>
        <View style={styles.encryptedIcon}>
          <Ionicons name="cloud-upload-outline" size={17} color={iconColor} />
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={8} color="#FFFFFF" />
          </View>
        </View>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.1} style={textStyle}>
          {buttonLabel}
        </Text>
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent
        visible={isModalVisible}
        onRequestClose={closeCloudSave}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconShell}>
              <Ionicons name="cloud-upload-outline" size={26} color="#FFFFFF" />
              <View style={styles.modalLockBadge}>
                <Ionicons name="lock-closed" size={11} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.modalTitle}>{t('actionSaveToCloud')}</Text>
            <Text style={styles.modalBody}>{t('cloudSaveModalBody')}</Text>
            <Text style={styles.phraseWarningText}>
              {t('settingsPhraseWarning')}
            </Text>
            {message ? <Text style={styles.modalMessage}>{message}</Text> : null}

            <TextInput
              value={phrase}
              onChangeText={setPhrase}
              placeholder={t('settingsSecretPhrase')}
              placeholderTextColor="#9C9087"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={hasSession === true}
              editable={!isBusy}
              style={styles.phraseInput}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable
                onPress={closeCloudSave}
                disabled={isBusy}
                style={[styles.secondaryAction, isBusy ? styles.disabledAction : null]}>
                <Text style={styles.secondaryActionText}>{t('actionCancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void saveToCloud();
                }}
                disabled={isBusy}
                style={[styles.primaryAction, isBusy ? styles.disabledAction : null]}>
                {isBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                <Text style={styles.primaryActionText}>
                  {isBusy ? t('actionSaving') : t('actionSaveToCloud')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  encryptedIcon: {
    width: 22,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6F8F78',
    borderWidth: 1,
    borderColor: '#FFFDF9',
  },
  modalScrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    backgroundColor: 'rgba(45, 38, 34, 0.42)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 24,
    padding: 22,
    alignItems: 'stretch',
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E8DCD4',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  modalIconShell: {
    alignSelf: 'center',
    width: 58,
    height: 58,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6F8F78',
    marginBottom: 13,
  },
  modalLockBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C88C93',
    borderWidth: 2,
    borderColor: '#FFFDF9',
  },
  modalTitle: {
    textAlign: 'center',
    color: '#3E3834',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },
  modalBody: {
    color: '#665B55',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 6,
  },
  phraseWarningText: {
    color: '#B55E53',
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '900',
    marginBottom: 12,
  },
  modalMessage: {
    color: '#6F8F78',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 12,
  },
  phraseInput: {
    minHeight: 46,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E2D6CE',
    backgroundColor: '#FBF6EF',
    color: '#3E3834',
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#B55E53',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 10,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1E6DE',
  },
  secondaryActionText: {
    color: '#5B514D',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryAction: {
    flex: 1.35,
    minHeight: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6F8F78',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  disabledAction: {
    opacity: 0.68,
  },
});
