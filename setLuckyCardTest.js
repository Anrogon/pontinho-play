require("dotenv").config();

const pool = require("./pontinho/server/config/db");

async function main() {
  try {
    const result = await pool.query(
      `
      UPDATE user_reward_progress
      SET
        lucky_cards_available = 1,
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING
        user_id,
        lucky_cards_available
      `,
      [9]
    );

    console.log(result.rows[0]);

  } catch (err) {

    console.error(err);

  } finally {

    await pool.end();

  }
}

main();