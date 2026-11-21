
"use strict";

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token))
    .digest("hex");
}

async function createPasswordResetToken(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Invalida os links anteriores deste usuário.
    await client.query(
      "DELETE FROM password_reset_tokens WHERE user_id = $1",
      [userId]
    );

    await client.query(
      `
      INSERT INTO password_reset_tokens
        (user_id, token_hash, expires_at)
      VALUES
        ($1, $2, NOW() + INTERVAL '30 minutes')
      `,
      [userId, tokenHash]
    );

    await client.query("COMMIT");

    return token;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function resetPasswordWithToken(token, newPassword) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
    return { ok: false, reason: "invalid_or_expired" };
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return { ok: false, reason: "invalid_password" };
  }

  const tokenHash = hashToken(token);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      SELECT user_id
      FROM password_reset_tokens
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
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await client.query(
      `
      UPDATE users
      SET
        password_hash = $2,
        must_reset_password = FALSE,
        session_version = COALESCE(session_version, 0) + 1,
        updated_at = NOW()
      WHERE id = $1
      `,
      [userId, passwordHash]
    );

    // O link não poderá ser utilizado novamente.
    await client.query(
      "DELETE FROM password_reset_tokens WHERE user_id = $1",
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

module.exports = {
  createPasswordResetToken,
  resetPasswordWithToken,
};
