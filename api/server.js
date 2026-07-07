const crypto = require('crypto');
const cors = require('cors');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

const app = express();
const port = Number(process.env.API_PORT || 3001);
const maxItemBytes = Number(process.env.MAX_SYNC_ITEM_BYTES || 512 * 1024);
const errorLogPath =
  process.env.SYNC_ERROR_LOG_PATH || path.join(__dirname, 'logs', 'sync-error-log.jsonl');

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '2mb' }));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function randomId() {
  return crypto.randomUUID();
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    const error = new Error(`${name} is required`);
    error.statusCode = 400;
    throw error;
  }

  return value.trim();
}

function normalizeUsername(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const username = value.trim().replace(/\s+/g, '').replace(/[^A-Za-z0-9_]/g, '');
  if (!username) {
    return null;
  }

  if (username.length < 3 || username.length > 40) {
    const error = new Error('Username must be 3 to 40 letters or numbers.');
    error.statusCode = 400;
    throw error;
  }

  return username;
}

function requireUsername(value) {
  const username = normalizeUsername(value);

  if (!username) {
    const error = new Error('Username is required');
    error.statusCode = 400;
    throw error;
  }

  return username;
}

async function assertUsernameAvailable(connection, username, userId) {
  if (!username) {
    return;
  }

  const [rows] = await connection.query(
    'SELECT id FROM users WHERE username = ? AND id <> ? AND disabled_at IS NULL LIMIT 1',
    [username, userId]
  );

  if (rows.length > 0) {
    const error = new Error('That username is already taken.');
    error.statusCode = 409;
    throw error;
  }
}

function getSafeErrorCode(error) {
  if (typeof error.code === 'string') {
    return error.code;
  }

  if (typeof error.errno === 'number') {
    return String(error.errno);
  }

  return null;
}

function writeSyncErrorLog(req, error, statusCode) {
  if (!req.path.startsWith('/v1/sync/')) {
    return;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    requestId: crypto.randomUUID(),
    method: req.method,
    path: req.path,
    statusCode,
    isSaveRequest: req.path === '/v1/sync/push',
    itemCount: Array.isArray(req.body?.items) ? req.body.items.length : undefined,
    userId: req.syncAuth?.userId || null,
    deviceId: req.syncAuth?.deviceId || null,
    errorCode: getSafeErrorCode(error),
    errorMessage: error.message || 'Unknown sync API error.',
  };

  fs.mkdir(path.dirname(errorLogPath), { recursive: true }, (mkdirError) => {
    if (mkdirError) {
      console.error('Failed to create sync error log directory', mkdirError);
      return;
    }

    fs.appendFile(errorLogPath, `${JSON.stringify(entry)}\n`, (appendError) => {
      if (appendError) {
        console.error('Failed to write sync error log', appendError);
      }
    });
  });
}

async function getAuthedDevice(req, res, next) {
  try {
    const userId = requireString(req.header('x-sync-user-id'), 'x-sync-user-id');
    const deviceId = requireString(req.header('x-sync-device-id'), 'x-sync-device-id');
    const deviceSecret = requireString(req.header('x-sync-device-secret'), 'x-sync-device-secret');
    const deviceSecretHash = sha256(deviceSecret);

    const [rows] = await pool.query(
      `SELECT d.id AS device_id, d.user_id
       FROM devices d
       JOIN users u ON u.id = d.user_id
       WHERE d.id = ? AND d.user_id = ? AND d.device_secret_hash = ?
         AND d.revoked_at IS NULL AND u.disabled_at IS NULL`,
      [deviceId, userId, deviceSecretHash]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized sync device.' });
    }

    req.syncAuth = { userId, deviceId };
    await pool.query('UPDATE devices SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?', [
      deviceId,
    ]);
    await pool.query('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?', [
      userId,
    ]);
    next();
  } catch (error) {
    next(error);
  }
}

app.get('/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post('/v1/sync/bootstrap', async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const recoveryId = requireString(req.body.recoveryId, 'recoveryId');
    const legacyRecoveryId =
      typeof req.body.legacyRecoveryId === 'string' && req.body.legacyRecoveryId.trim()
        ? req.body.legacyRecoveryId.trim()
        : null;
    const authSecret = requireString(req.body.authSecret, 'authSecret');
    const deviceSecret = requireString(req.body.deviceSecret, 'deviceSecret');
    const deviceName =
      typeof req.body.deviceName === 'string' ? req.body.deviceName.slice(0, 120) : null;
    const preferredUsername = requireUsername(req.body.preferredUsername);
    const authHash = sha256(authSecret);
    const deviceSecretHash = sha256(deviceSecret);
    const userId = randomId();
    const deviceId = randomId();
    const kdfSalt = crypto.randomBytes(32);

    await connection.beginTransaction();

    const [usernameMatches] = await connection.query(
      'SELECT id, username, recovery_id, sync_phrase_auth_hash FROM users WHERE username = ? AND disabled_at IS NULL LIMIT 1',
      [preferredUsername]
    );

    let resolvedUserId = userId;
    let resolvedUsername = preferredUsername;
    let existing = usernameMatches[0];

    if (!existing) {
      const recoveryIds = [recoveryId, legacyRecoveryId].filter(Boolean);
      const [existingUsers] = await connection.query(
        `SELECT id, username, recovery_id, sync_phrase_auth_hash
         FROM users
         WHERE recovery_id IN (?) AND disabled_at IS NULL
         LIMIT 1`,
        [recoveryIds]
      );
      existing = existingUsers[0];
    }

    if (existing) {
      if (existing.sync_phrase_auth_hash !== authHash) {
        await connection.rollback();
        return res.status(401).json({ error: 'Username and Secret Phrase did not match.' });
      }
      resolvedUserId = existing.id;
      await assertUsernameAvailable(connection, preferredUsername, resolvedUserId);
      await connection.query('UPDATE users SET username = ?, recovery_id = ? WHERE id = ?', [
        preferredUsername,
        recoveryId,
        resolvedUserId,
      ]);
      resolvedUsername = preferredUsername || existing.username;
    } else {
      await connection.query(
        `INSERT INTO users (id, recovery_id, username, sync_phrase_auth_hash, kdf_salt)
         VALUES (?, ?, ?, ?, ?)`,
        [resolvedUserId, recoveryId, preferredUsername, authHash, kdfSalt]
      );
    }

    await connection.query(
      `INSERT INTO devices (id, user_id, device_name, device_secret_hash, last_seen_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [deviceId, resolvedUserId, deviceName, deviceSecretHash]
    );
    await connection.query(
      `INSERT INTO sync_cursors (user_id, device_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [resolvedUserId, deviceId]
    );
    await connection.commit();

    res.json({
      userId: resolvedUserId,
      deviceId,
      username: resolvedUsername,
      status: 'connected',
      message: 'Connected',
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.get('/v1/sync/username-availability', getAuthedDevice, async (req, res, next) => {
  try {
    const { userId } = req.syncAuth;
    const username = requireUsername(req.query.username);
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE username = ? AND id <> ? AND disabled_at IS NULL LIMIT 1',
      [username, userId]
    );

    res.json({ username, available: rows.length === 0 });
  } catch (error) {
    next(error);
  }
});

app.patch('/v1/sync/account', getAuthedDevice, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const { userId } = req.syncAuth;
    const username = requireUsername(req.body.username);
    const recoveryId =
      typeof req.body.recoveryId === 'string' && req.body.recoveryId.trim()
        ? req.body.recoveryId.trim()
        : null;

    await connection.beginTransaction();
    await assertUsernameAvailable(connection, username, userId);
    if (recoveryId) {
      await connection.query('UPDATE users SET username = ?, recovery_id = ? WHERE id = ?', [
        username,
        recoveryId,
        userId,
      ]);
    } else {
      await connection.query('UPDATE users SET username = ? WHERE id = ?', [username, userId]);
    }
    await connection.commit();

    res.json({ username });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.post('/v1/sync/push', getAuthedDevice, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const { userId, deviceId } = req.syncAuth;
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const results = [];

    await connection.beginTransaction();

    for (const item of items) {
      const clientItemId = requireString(item.clientItemId, 'clientItemId');
      const itemType = requireString(item.itemType, 'itemType');
      const nonce = Buffer.from(requireString(item.nonce, 'nonce'), 'base64');
      const ciphertext = Buffer.from(requireString(item.ciphertext, 'ciphertext'), 'base64');
      const payloadSha256 = requireString(item.payloadSha256, 'payloadSha256');
      const clientUpdatedAt = Number(item.clientUpdatedAt);
      const schemaVersion = Number(item.schemaVersion || 1);
      const localStorageKey =
        typeof item.localStorageKey === 'string' ? item.localStorageKey.slice(0, 220) : null;
      const baseVersionId =
        typeof item.baseVersionId === 'string' && item.baseVersionId ? item.baseVersionId : null;
      const isDeleted = item.deleted === true;

      if (!Number.isFinite(clientUpdatedAt)) {
        throw Object.assign(new Error('clientUpdatedAt must be a number'), { statusCode: 400 });
      }

      if (ciphertext.byteLength > maxItemBytes) {
        throw Object.assign(new Error(`Sync item ${clientItemId} is too large.`), {
          statusCode: 413,
        });
      }

      const [existingItems] = await connection.query(
        'SELECT id, current_version_id FROM encrypted_items WHERE user_id = ? AND client_item_id = ?',
        [userId, clientItemId]
      );

      const itemId = existingItems[0]?.id || randomId();
      const currentVersionId = existingItems[0]?.current_version_id || null;
      const versionId = randomId();
      const hasConflict = Boolean(currentVersionId && baseVersionId !== currentVersionId);

      if (!existingItems[0]) {
        await connection.query(
          `INSERT INTO encrypted_items
           (id, user_id, client_item_id, item_type, local_storage_key, schema_version)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [itemId, userId, clientItemId, itemType, localStorageKey, schemaVersion]
        );
      }

      await connection.query(
        `INSERT INTO encrypted_item_versions
         (id, item_id, user_id, device_id, base_version_id, client_updated_at,
          encryption_version, nonce, ciphertext, payload_sha256)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          versionId,
          itemId,
          userId,
          deviceId,
          baseVersionId,
          clientUpdatedAt,
          Number(item.encryptionVersion || 1),
          nonce,
          ciphertext,
          payloadSha256,
        ]
      );

      if (hasConflict) {
        await connection.query(
          `UPDATE encrypted_items
           SET has_conflict = TRUE, conflict_detected_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [itemId]
        );
      } else {
        await connection.query(
          `UPDATE encrypted_items
           SET current_version_id = ?, item_type = ?, local_storage_key = ?, schema_version = ?,
               has_conflict = FALSE, conflict_detected_at = NULL,
               deleted_at = ${isDeleted ? 'CURRENT_TIMESTAMP' : 'NULL'}
           WHERE id = ?`,
          [versionId, itemType, localStorageKey, schemaVersion, itemId]
        );
      }

      results.push({ clientItemId, itemId, versionId, hasConflict });
    }

    await connection.query(
      `INSERT INTO sync_cursors (user_id, device_id, last_pushed_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE last_pushed_at = CURRENT_TIMESTAMP`,
      [userId, deviceId]
    );
    await connection.query(
      'INSERT INTO sync_events (user_id, device_id, event_type, item_count) VALUES (?, ?, ?, ?)',
      [userId, deviceId, 'push', items.length]
    );
    await connection.commit();

    res.json({ pushed: results });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.get('/v1/sync/pull', getAuthedDevice, async (req, res, next) => {
  try {
    const { userId, deviceId } = req.syncAuth;
    const since = typeof req.query.since === 'string' ? req.query.since : null;
    const sinceDate = since ? new Date(since) : null;
    const sinceSql =
      sinceDate && Number.isFinite(sinceDate.getTime())
        ? sinceDate.toISOString().slice(0, 19).replace('T', ' ')
        : '1970-01-01 00:00:00';

    const [rows] = await pool.query(
      `SELECT i.id AS item_id, i.client_item_id, i.item_type, i.local_storage_key,
              i.schema_version, i.current_version_id, i.has_conflict, i.deleted_at, i.updated_at,
              v.id AS version_id, v.device_id, v.client_updated_at, v.server_created_at,
              TO_BASE64(v.nonce) AS nonce, TO_BASE64(v.ciphertext) AS ciphertext,
              v.payload_sha256
       FROM encrypted_items i
       JOIN encrypted_item_versions v ON v.id = i.current_version_id
       WHERE i.user_id = ? AND i.updated_at > ?
       ORDER BY i.updated_at ASC`,
      [userId, sinceSql]
    );

    await pool.query(
      `INSERT INTO sync_cursors (user_id, device_id, last_pulled_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE last_pulled_at = CURRENT_TIMESTAMP`,
      [userId, deviceId]
    );
    await pool.query(
      'INSERT INTO sync_events (user_id, device_id, event_type, item_count) VALUES (?, ?, ?, ?)',
      [userId, deviceId, 'pull', rows.length]
    );

    res.json({
      pulledAt: new Date().toISOString(),
      items: rows.map((row) => ({
        itemId: row.item_id,
        clientItemId: row.client_item_id,
        itemType: row.item_type,
        localStorageKey: row.local_storage_key,
        schemaVersion: row.schema_version,
        currentVersionId: row.current_version_id,
        hasConflict: Boolean(row.has_conflict),
        deletedAt: row.deleted_at,
        updatedAt: row.updated_at,
        version: {
          id: row.version_id,
          deviceId: row.device_id,
          clientUpdatedAt: Number(row.client_updated_at),
          serverCreatedAt: row.server_created_at,
          nonce: row.nonce,
          ciphertext: row.ciphertext,
          payloadSha256: row.payload_sha256,
        },
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/v1/sync/log', getAuthedDevice, async (req, res, next) => {
  try {
    const { userId, deviceId } = req.syncAuth;
    const [events] = await pool.query(
      `SELECT id, event_type, item_count, created_at
       FROM sync_events
       WHERE user_id = ? AND event_type IN ('push', 'pull', 'restore')
       ORDER BY created_at DESC
       LIMIT 30`,
      [userId]
    );
    const [cursors] = await pool.query(
      `SELECT last_pushed_at, last_pulled_at, updated_at
       FROM sync_cursors
       WHERE user_id = ? AND device_id = ?
       LIMIT 1`,
      [userId, deviceId]
    );

    res.json({
      events: events.map((event) => ({
        id: String(event.id),
        type: event.event_type,
        itemCount: Number(event.item_count),
        createdAt: event.created_at,
      })),
      cursor: cursors[0] || null,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/v1/sync/conflicts', getAuthedDevice, async (req, res, next) => {
  try {
    const { userId } = req.syncAuth;
    const [rows] = await pool.query(
      `SELECT i.id AS item_id, i.client_item_id, i.item_type, i.local_storage_key,
              v.id AS version_id, v.device_id, d.device_name, v.client_updated_at,
              v.server_created_at, TO_BASE64(v.nonce) AS nonce,
              TO_BASE64(v.ciphertext) AS ciphertext, v.payload_sha256
       FROM encrypted_items i
       JOIN encrypted_item_versions v ON v.item_id = i.id
       JOIN devices d ON d.id = v.device_id
       WHERE i.user_id = ? AND i.has_conflict = TRUE
       ORDER BY i.conflict_detected_at DESC, v.server_created_at DESC`,
      [userId]
    );

    res.json({ conflicts: rows });
  } catch (error) {
    next(error);
  }
});

app.post('/v1/sync/conflicts/:itemId/resolve', getAuthedDevice, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const { userId } = req.syncAuth;
    const itemId = req.params.itemId;
    const action = requireString(req.body.action, 'action');
    const versionId =
      typeof req.body.versionId === 'string' && req.body.versionId ? req.body.versionId : null;

    await connection.beginTransaction();

    if (action === 'keep_version') {
      requireString(versionId, 'versionId');
      await connection.query(
        `UPDATE encrypted_items
         SET current_version_id = ?, has_conflict = FALSE, conflict_detected_at = NULL
         WHERE id = ? AND user_id = ?`,
        [versionId, itemId, userId]
      );
    } else if (action === 'save_both') {
      const sourceVersionId = requireString(versionId, 'versionId');
      const [versions] = await connection.query(
        `SELECT i.item_type, i.local_storage_key, i.schema_version, v.*
         FROM encrypted_item_versions v
         JOIN encrypted_items i ON i.id = v.item_id
         WHERE v.id = ? AND v.user_id = ? AND v.item_id = ?`,
        [sourceVersionId, userId, itemId]
      );
      if (versions.length === 0) {
        throw Object.assign(new Error('Conflict version was not found.'), { statusCode: 404 });
      }

      const source = versions[0];
      const newItemId = randomId();
      const newVersionId = randomId();
      await connection.query(
        `INSERT INTO encrypted_items
         (id, user_id, client_item_id, item_type, local_storage_key, schema_version, current_version_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          newItemId,
          userId,
          `${source.local_storage_key || source.item_type}:${newItemId}`,
          source.item_type,
          source.local_storage_key,
          source.schema_version,
          newVersionId,
        ]
      );
      await connection.query(
        `INSERT INTO encrypted_item_versions
         (id, item_id, user_id, device_id, base_version_id, client_updated_at,
          encryption_version, nonce, ciphertext, payload_sha256)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
        [
          newVersionId,
          newItemId,
          userId,
          source.device_id,
          Number(source.client_updated_at),
          Number(source.encryption_version),
          source.nonce,
          source.ciphertext,
          source.payload_sha256,
        ]
      );
      await connection.query(
        `UPDATE encrypted_items
         SET has_conflict = FALSE, conflict_detected_at = NULL
         WHERE id = ? AND user_id = ?`,
        [itemId, userId]
      );
    } else {
      throw Object.assign(new Error('Unsupported conflict resolution action.'), {
        statusCode: 400,
      });
    }

    await connection.query(
      'INSERT INTO sync_events (user_id, event_type, item_count) VALUES (?, ?, ?)',
      [userId, 'conflict_resolved', 1]
    );
    await connection.commit();
    res.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.use((error, req, res, _next) => {
  const statusCode = error.statusCode || 500;
  writeSyncErrorLog(req, error, statusCode);
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Unexpected API error.' : error.message,
  });
});

app.listen(port, () => {
  console.log(`Bible App sync API listening on http://localhost:${port}`);
});
