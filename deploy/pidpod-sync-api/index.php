<?php
declare(strict_types=1);

$configPath = __DIR__ . '/../bibleapp-sync-config.php';
if (!is_file($configPath)) {
    respond(500, ['error' => 'Sync API config is missing.']);
}

$config = require $configPath;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Sync-User-Id, X-Sync-Device-Id, X-Sync-Device-Secret');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

class HttpException extends RuntimeException
{
    public function __construct(string $message, public int $statusCode)
    {
        parent::__construct($message);
    }
}

function db(array $config): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $config['mysql_host'],
        (int) $config['mysql_port'],
        $config['mysql_database']
    );

    $pdo = new PDO($dsn, $config['mysql_user'], $config['mysql_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}

function jsonInput(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw httpError('Request body must be valid JSON.', 400);
    }

    return $decoded;
}

function httpError(string $message, int $status): RuntimeException
{
    return new HttpException($message, $status);
}

function requireString(mixed $value, string $name): string
{
    if (!is_string($value) || trim($value) === '') {
        throw httpError($name . ' is required', 400);
    }

    return trim($value);
}

function sha256(string $value): string
{
    return hash('sha256', $value);
}

function randomId(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function trimNullableString(mixed $value, int $maxLength): ?string
{
    if (!is_string($value) || $value === '') {
        return null;
    }

    return substr($value, 0, $maxLength);
}

function authDevice(PDO $pdo): array
{
    $userId = requireString($_SERVER['HTTP_X_SYNC_USER_ID'] ?? null, 'x-sync-user-id');
    $deviceId = requireString($_SERVER['HTTP_X_SYNC_DEVICE_ID'] ?? null, 'x-sync-device-id');
    $deviceSecret = requireString($_SERVER['HTTP_X_SYNC_DEVICE_SECRET'] ?? null, 'x-sync-device-secret');

    $statement = $pdo->prepare(
        'SELECT d.id AS device_id, d.user_id
         FROM devices d
         JOIN users u ON u.id = d.user_id
         WHERE d.id = ? AND d.user_id = ? AND d.device_secret_hash = ?
           AND d.revoked_at IS NULL AND u.disabled_at IS NULL'
    );
    $statement->execute([$deviceId, $userId, sha256($deviceSecret)]);
    $row = $statement->fetch();
    if (!$row) {
        throw httpError('Unauthorized sync device.', 401);
    }

    $pdo->prepare('UPDATE devices SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$deviceId]);
    $pdo->prepare('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$userId]);

    return ['userId' => $userId, 'deviceId' => $deviceId];
}

function writeSyncErrorLog(array $config, string $method, string $path, int $statusCode, Throwable $error, ?array $body, ?array $auth): void
{
    if (!str_starts_with($path, '/v1/sync/')) {
        return;
    }

    $logPath = $config['error_log_path'] ?? (__DIR__ . '/../sync-api-logs/sync-error-log.jsonl');
    $dir = dirname($logPath);
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }

    $entry = [
        'timestamp' => gmdate('c'),
        'requestId' => randomId(),
        'method' => $method,
        'path' => $path,
        'statusCode' => $statusCode,
        'isSaveRequest' => $path === '/v1/sync/push',
        'itemCount' => isset($body['items']) && is_array($body['items']) ? count($body['items']) : null,
        'userId' => $auth['userId'] ?? null,
        'deviceId' => $auth['deviceId'] ?? null,
        'errorCode' => $error->getCode() ?: null,
        'errorMessage' => $error->getMessage() ?: 'Unknown sync API error.',
    ];

    file_put_contents($logPath, json_encode($entry, JSON_UNESCAPED_SLASHES) . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function isoDate(mixed $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    if ($value instanceof DateTimeInterface) {
        return $value->format(DateTimeInterface::ATOM);
    }
    return date(DateTimeInterface::ATOM, strtotime((string) $value));
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$body = null;
$auth = null;

try {
    $pdo = db($config);

    if ($method === 'GET' && ($path === '/' || $path === '/health')) {
        $pdo->query('SELECT 1');
        respond(200, ['ok' => true, 'service' => 'BibleApp sync API']);
    }

    if ($method === 'POST' && $path === '/v1/sync/bootstrap') {
        $body = jsonInput();
        $recoveryId = requireString($body['recoveryId'] ?? null, 'recoveryId');
        $authSecret = requireString($body['authSecret'] ?? null, 'authSecret');
        $deviceSecret = requireString($body['deviceSecret'] ?? null, 'deviceSecret');
        $deviceName = trimNullableString($body['deviceName'] ?? null, 120);
        $authHash = sha256($authSecret);
        $deviceSecretHash = sha256($deviceSecret);
        $userId = randomId();
        $deviceId = randomId();
        $kdfSalt = random_bytes(32);

        $pdo->beginTransaction();
        $statement = $pdo->prepare('SELECT id, sync_phrase_auth_hash FROM users WHERE recovery_id = ? AND disabled_at IS NULL');
        $statement->execute([$recoveryId]);
        $existing = $statement->fetch();
        $resolvedUserId = $userId;

        if ($existing) {
            if (!hash_equals($existing['sync_phrase_auth_hash'], $authHash)) {
                $pdo->rollBack();
                respond(401, ['error' => 'Private Sync Phrase did not match.']);
            }
            $resolvedUserId = $existing['id'];
        } else {
            $pdo->prepare('INSERT INTO users (id, recovery_id, sync_phrase_auth_hash, kdf_salt) VALUES (?, ?, ?, ?)')
                ->execute([$resolvedUserId, $recoveryId, $authHash, $kdfSalt]);
        }

        $pdo->prepare('INSERT INTO devices (id, user_id, device_name, device_secret_hash, last_seen_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)')
            ->execute([$deviceId, $resolvedUserId, $deviceName, $deviceSecretHash]);
        $pdo->prepare('INSERT INTO sync_cursors (user_id, device_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP')
            ->execute([$resolvedUserId, $deviceId]);
        $pdo->commit();

        respond(200, [
            'userId' => $resolvedUserId,
            'deviceId' => $deviceId,
            'status' => 'connected',
            'message' => 'Connected',
        ]);
    }

    if ($method === 'POST' && $path === '/v1/sync/push') {
        $body = jsonInput();
        $auth = authDevice($pdo);
        $items = isset($body['items']) && is_array($body['items']) ? $body['items'] : [];
        $results = [];
        $maxItemBytes = (int) ($config['max_sync_item_bytes'] ?? 524288);

        $pdo->beginTransaction();
        foreach ($items as $item) {
            $clientItemId = requireString($item['clientItemId'] ?? null, 'clientItemId');
            $itemType = requireString($item['itemType'] ?? null, 'itemType');
            $nonce = base64_decode(requireString($item['nonce'] ?? null, 'nonce'), true);
            $ciphertext = base64_decode(requireString($item['ciphertext'] ?? null, 'ciphertext'), true);
            $payloadSha256 = requireString($item['payloadSha256'] ?? null, 'payloadSha256');
            $clientUpdatedAt = $item['clientUpdatedAt'] ?? null;
            $schemaVersion = (int) ($item['schemaVersion'] ?? 1);
            $localStorageKey = trimNullableString($item['localStorageKey'] ?? null, 220);
            $baseVersionId = trimNullableString($item['baseVersionId'] ?? null, 36);
            $isDeleted = ($item['deleted'] ?? false) === true;

            if ($nonce === false || $ciphertext === false) {
                throw httpError('Sync item encryption payload must be base64.', 400);
            }
            if (!is_numeric($clientUpdatedAt)) {
                throw httpError('clientUpdatedAt must be a number', 400);
            }
            if (strlen($ciphertext) > $maxItemBytes) {
                throw httpError('Sync item ' . $clientItemId . ' is too large.', 413);
            }

            $statement = $pdo->prepare('SELECT id, current_version_id FROM encrypted_items WHERE user_id = ? AND client_item_id = ?');
            $statement->execute([$auth['userId'], $clientItemId]);
            $existing = $statement->fetch();
            $itemId = $existing['id'] ?? randomId();
            $currentVersionId = $existing['current_version_id'] ?? null;
            $versionId = randomId();
            $hasConflict = (bool) ($currentVersionId && $baseVersionId !== $currentVersionId);

            if (!$existing) {
                $pdo->prepare('INSERT INTO encrypted_items (id, user_id, client_item_id, item_type, local_storage_key, schema_version) VALUES (?, ?, ?, ?, ?, ?)')
                    ->execute([$itemId, $auth['userId'], $clientItemId, $itemType, $localStorageKey, $schemaVersion]);
            }

            $pdo->prepare(
                'INSERT INTO encrypted_item_versions
                 (id, item_id, user_id, device_id, base_version_id, client_updated_at, encryption_version, nonce, ciphertext, payload_sha256)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $versionId,
                $itemId,
                $auth['userId'],
                $auth['deviceId'],
                $baseVersionId,
                (int) $clientUpdatedAt,
                (int) ($item['encryptionVersion'] ?? 1),
                $nonce,
                $ciphertext,
                $payloadSha256,
            ]);

            if ($hasConflict) {
                $pdo->prepare('UPDATE encrypted_items SET has_conflict = TRUE, conflict_detected_at = CURRENT_TIMESTAMP WHERE id = ?')
                    ->execute([$itemId]);
            } else {
                $deletedSql = $isDeleted ? 'CURRENT_TIMESTAMP' : 'NULL';
                $pdo->prepare(
                    "UPDATE encrypted_items
                     SET current_version_id = ?, item_type = ?, local_storage_key = ?, schema_version = ?,
                         has_conflict = FALSE, conflict_detected_at = NULL, deleted_at = $deletedSql
                     WHERE id = ?"
                )->execute([$versionId, $itemType, $localStorageKey, $schemaVersion, $itemId]);
            }

            $results[] = [
                'clientItemId' => $clientItemId,
                'itemId' => $itemId,
                'versionId' => $versionId,
                'hasConflict' => $hasConflict,
            ];
        }

        $pdo->prepare('INSERT INTO sync_cursors (user_id, device_id, last_pushed_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE last_pushed_at = CURRENT_TIMESTAMP')
            ->execute([$auth['userId'], $auth['deviceId']]);
        $pdo->prepare('INSERT INTO sync_events (user_id, device_id, event_type, item_count) VALUES (?, ?, ?, ?)')
            ->execute([$auth['userId'], $auth['deviceId'], 'push', count($items)]);
        $pdo->commit();

        respond(200, ['pushed' => $results]);
    }

    if ($method === 'GET' && $path === '/v1/sync/pull') {
        $auth = authDevice($pdo);
        $since = isset($_GET['since']) && is_string($_GET['since']) ? $_GET['since'] : null;
        $timestamp = $since ? strtotime($since) : false;
        $sinceSql = $timestamp ? gmdate('Y-m-d H:i:s', $timestamp) : '1970-01-01 00:00:00';

        $statement = $pdo->prepare(
            'SELECT i.id AS item_id, i.client_item_id, i.item_type, i.local_storage_key,
                    i.schema_version, i.current_version_id, i.has_conflict, i.deleted_at, i.updated_at,
                    v.id AS version_id, v.device_id, v.client_updated_at, v.server_created_at,
                    TO_BASE64(v.nonce) AS nonce, TO_BASE64(v.ciphertext) AS ciphertext,
                    v.payload_sha256
             FROM encrypted_items i
             JOIN encrypted_item_versions v ON v.id = i.current_version_id
             WHERE i.user_id = ? AND i.updated_at > ?
             ORDER BY i.updated_at ASC'
        );
        $statement->execute([$auth['userId'], $sinceSql]);
        $rows = $statement->fetchAll();

        $pdo->prepare('INSERT INTO sync_cursors (user_id, device_id, last_pulled_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE last_pulled_at = CURRENT_TIMESTAMP')
            ->execute([$auth['userId'], $auth['deviceId']]);
        $pdo->prepare('INSERT INTO sync_events (user_id, device_id, event_type, item_count) VALUES (?, ?, ?, ?)')
            ->execute([$auth['userId'], $auth['deviceId'], 'pull', count($rows)]);

        $items = array_map(fn(array $row): array => [
            'itemId' => $row['item_id'],
            'clientItemId' => $row['client_item_id'],
            'itemType' => $row['item_type'],
            'localStorageKey' => $row['local_storage_key'],
            'schemaVersion' => (int) $row['schema_version'],
            'currentVersionId' => $row['current_version_id'],
            'hasConflict' => (bool) $row['has_conflict'],
            'deletedAt' => isoDate($row['deleted_at']),
            'updatedAt' => isoDate($row['updated_at']),
            'version' => [
                'id' => $row['version_id'],
                'deviceId' => $row['device_id'],
                'clientUpdatedAt' => (int) $row['client_updated_at'],
                'serverCreatedAt' => isoDate($row['server_created_at']),
                'nonce' => $row['nonce'],
                'ciphertext' => $row['ciphertext'],
                'payloadSha256' => $row['payload_sha256'],
            ],
        ], $rows);

        respond(200, ['pulledAt' => gmdate('c'), 'items' => $items]);
    }

    if ($method === 'GET' && $path === '/v1/sync/log') {
        $auth = authDevice($pdo);
        $statement = $pdo->prepare(
            "SELECT id, event_type, item_count, created_at
             FROM sync_events
             WHERE user_id = ? AND event_type IN ('push', 'pull', 'restore')
             ORDER BY created_at DESC
             LIMIT 30"
        );
        $statement->execute([$auth['userId']]);
        $events = array_map(fn(array $event): array => [
            'id' => (string) $event['id'],
            'type' => $event['event_type'],
            'itemCount' => (int) $event['item_count'],
            'createdAt' => isoDate($event['created_at']),
        ], $statement->fetchAll());

        $statement = $pdo->prepare('SELECT last_pushed_at, last_pulled_at, updated_at FROM sync_cursors WHERE user_id = ? AND device_id = ? LIMIT 1');
        $statement->execute([$auth['userId'], $auth['deviceId']]);
        $cursor = $statement->fetch() ?: null;

        respond(200, ['events' => $events, 'cursor' => $cursor]);
    }

    if ($method === 'GET' && $path === '/v1/sync/conflicts') {
        $auth = authDevice($pdo);
        $statement = $pdo->prepare(
            'SELECT i.id AS item_id, i.client_item_id, i.item_type, i.local_storage_key,
                    v.id AS version_id, v.device_id, d.device_name, v.client_updated_at,
                    v.server_created_at, TO_BASE64(v.nonce) AS nonce,
                    TO_BASE64(v.ciphertext) AS ciphertext, v.payload_sha256
             FROM encrypted_items i
             JOIN encrypted_item_versions v ON v.item_id = i.id
             JOIN devices d ON d.id = v.device_id
             WHERE i.user_id = ? AND i.has_conflict = TRUE
             ORDER BY i.conflict_detected_at DESC, v.server_created_at DESC'
        );
        $statement->execute([$auth['userId']]);
        respond(200, ['conflicts' => $statement->fetchAll()]);
    }

    if ($method === 'POST' && preg_match('#^/v1/sync/conflicts/([^/]+)/resolve$#', $path, $matches)) {
        $body = jsonInput();
        $auth = authDevice($pdo);
        $itemId = $matches[1];
        $action = requireString($body['action'] ?? null, 'action');
        $versionId = trimNullableString($body['versionId'] ?? null, 36);

        $pdo->beginTransaction();
        if ($action === 'keep_version') {
            requireString($versionId, 'versionId');
            $pdo->prepare('UPDATE encrypted_items SET current_version_id = ?, has_conflict = FALSE, conflict_detected_at = NULL WHERE id = ? AND user_id = ?')
                ->execute([$versionId, $itemId, $auth['userId']]);
        } elseif ($action === 'save_both') {
            $sourceVersionId = requireString($versionId, 'versionId');
            $statement = $pdo->prepare(
                'SELECT i.item_type, i.local_storage_key, i.schema_version, v.*
                 FROM encrypted_item_versions v
                 JOIN encrypted_items i ON i.id = v.item_id
                 WHERE v.id = ? AND v.user_id = ? AND v.item_id = ?'
            );
            $statement->execute([$sourceVersionId, $auth['userId'], $itemId]);
            $source = $statement->fetch();
            if (!$source) {
                throw httpError('Conflict version was not found.', 404);
            }

            $newItemId = randomId();
            $newVersionId = randomId();
            $pdo->prepare(
                'INSERT INTO encrypted_items
                 (id, user_id, client_item_id, item_type, local_storage_key, schema_version, current_version_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $newItemId,
                $auth['userId'],
                ($source['local_storage_key'] ?: $source['item_type']) . ':' . $newItemId,
                $source['item_type'],
                $source['local_storage_key'],
                (int) $source['schema_version'],
                $newVersionId,
            ]);
            $pdo->prepare(
                'INSERT INTO encrypted_item_versions
                 (id, item_id, user_id, device_id, base_version_id, client_updated_at, encryption_version, nonce, ciphertext, payload_sha256)
                 VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)'
            )->execute([
                $newVersionId,
                $newItemId,
                $auth['userId'],
                $source['device_id'],
                (int) $source['client_updated_at'],
                (int) $source['encryption_version'],
                $source['nonce'],
                $source['ciphertext'],
                $source['payload_sha256'],
            ]);
            $pdo->prepare('UPDATE encrypted_items SET has_conflict = FALSE, conflict_detected_at = NULL WHERE id = ? AND user_id = ?')
                ->execute([$itemId, $auth['userId']]);
        } else {
            throw httpError('Unsupported conflict resolution action.', 400);
        }

        $pdo->prepare('INSERT INTO sync_events (user_id, event_type, item_count) VALUES (?, ?, ?)')
            ->execute([$auth['userId'], 'conflict_resolved', 1]);
        $pdo->commit();
        respond(200, ['ok' => true]);
    }

    respond(404, ['error' => 'Not found.']);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $statusCode = $error instanceof HttpException ? $error->statusCode : 500;
    if ($statusCode < 400 || $statusCode > 599) {
        $statusCode = 500;
    }
    writeSyncErrorLog($config, $method, $path, $statusCode, $error, $body, $auth);
    respond($statusCode, [
        'error' => $statusCode === 500 ? 'Unexpected API error.' : $error->getMessage(),
    ]);
}
