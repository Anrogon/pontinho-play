
"use strict";

const crypto = require("crypto");
const pool = require("../config/db");

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token))
    .digest("hex");
}

async function createEmailVerificationToken(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Invalida qualquer token anterior do usuário.
    await client.query(
      "DELETE FROM email_verification_tokens WHERE user_id = $1",
      [userId]
    );

    await client.query(
      `
      INSERT INTO email_verification_tokens
        (user_id, token_hash, expires_at)
      VALUES
        ($1, $2, NOW() + INTERVAL '24 hours')
      `,
      [userId, tokenHash]
    );

    await client.query("COMMIT");

    // O token original é enviado somente por e-mail.
    return token;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function verifyEmailToken(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
    return { ok: false, reason: "invalid_or_expired" };
  }

  const tokenHash = hashToken(token);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      SELECT user_id
      FROM email_verification_tokens
      WHERE token_hash = $1
        AND expires_at > NOW()
      FOR UPDATE
      `,
      [tokenHash]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid_or_expired" };
    }

    const userId = result.rows[0].user_id;

    await client.query(
      `
      UPDATE users
      SET email_verified = TRUE,
          updated_at = NOW()
      WHERE id = $1
      `,
      [userId]
    );

    // Token de uso único: removido após a confirmação.
    await client.query(
      "DELETE FROM email_verification_tokens WHERE user_id = $1",
      [userId]
    );

    await client.query("COMMIT");

    return { ok: true, userId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}


async function canResendVerificationEmail(userId) {
  const result = await pool.query(
    `
    SELECT 1
    FROM email_verification_tokens
    WHERE user_id = $1
      AND created_at > NOW() - INTERVAL '5 minutes'
    LIMIT 1
    `,
    [userId]
  );

  return result.rowCount === 0;
}


module.exports = {
  createEmailVerificationToken,
  verifyEmailToken,
  canResendVerificationEmail,
};
