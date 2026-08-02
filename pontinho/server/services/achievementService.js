const pool = require("../config/db");


/* =========================================================
   CONFIGURAÇÃO DAS CONQUISTAS
========================================================= */

const ACHIEVEMENTS = [
  {
    key: "wins5",
    winsRequired: 5,
    title: "5 vitórias",
    rewardType: "lucky_card",
    luckyCards: 1,
    chips: 0
  },

  {
    key: "wins10",
    winsRequired: 10,
    title: "10 vitórias",
    rewardType: "lucky_card",
    luckyCards: 1,
    chips: 0
  },

  {
    key: "wins25",
    winsRequired: 25,
    title: "25 vitórias",
    rewardType: "chips",
    luckyCards: 0,
    chips: 2000
  },

  {
    key: "wins50",
    winsRequired: 50,
    title: "50 vitórias",
    rewardType: "chips",
    luckyCards: 0,
    chips: 4000
  },

  {
    key: "wins100",
    winsRequired: 100,
    title: "100 vitórias",
    rewardType: "chips",
    luckyCards: 0,
    chips: 8000
  }
];


/* =========================================================
   UTILITÁRIOS
========================================================= */

function normalizeAchievementsJson(value) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return { ...value };
  }

  return {};
}


function getAchievementDescription(achievement) {
  if (achievement.rewardType === "lucky_card") {
    return (
      `Conquista — ${achievement.title} — ` +
      `${achievement.luckyCards} Carta da Sorte`
    );
  }

  return (
    `Conquista — ${achievement.title} — ` +
    `${achievement.chips.toLocaleString("pt-BR")} fichas`
  );
}


/* =========================================================
   PROCESSAR CONQUISTAS DO USUÁRIO
========================================================= */

async function processUserAchievements(userId) {
  const numericUserId = Number(userId);

  if (
    !Number.isInteger(numericUserId) ||
    numericUserId <= 0
  ) {
    return {
      ok: false,
      message: "Usuário inválido para processar conquistas.",
      unlocked: []
    };
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Garante que o usuário possua registro de progresso.
     */
    await client.query(
      `
        INSERT INTO user_reward_progress (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `,
      [numericUserId]
    );

    /*
     * Bloqueia o progresso para impedir pagamento duplicado
     * caso duas chamadas ocorram quase ao mesmo tempo.
     */
    const progressResult = await client.query(
      `
        SELECT
          achievements_json,
          lucky_cards_available
        FROM user_reward_progress
        WHERE user_id = $1
        FOR UPDATE
      `,
      [numericUserId]
    );

    if (!progressResult.rows.length) {
      throw new Error(
        `Progresso de recompensas não encontrado para o usuário ${numericUserId}.`
      );
    }

    /*
     * user_stats é a fonte oficial das vitórias.
     */
    const statsResult = await client.query(
      `
        SELECT wins
        FROM user_stats
        WHERE user_id = $1
      `,
      [numericUserId]
    );

    const wins =
      Number(statsResult.rows[0]?.wins) || 0;

    const achievementsJson =
      normalizeAchievementsJson(
        progressResult.rows[0]?.achievements_json
      );

    const unlocked = [];

    let chipsToCredit = 0;
    let luckyCardsToCredit = 0;

    /*
     * Pode liberar mais de uma conquista na mesma chamada.
     *
     * Exemplo:
     * jogador antigo já possui 27 vitórias e ainda não teve
     * as conquistas processadas. Ele recebe 5, 10 e 25.
     */
    for (const achievement of ACHIEVEMENTS) {
      const alreadyClaimed =
        achievementsJson[achievement.key] === true;

      const reachedGoal =
        wins >= achievement.winsRequired;

      if (alreadyClaimed || !reachedGoal) {
        continue;
      }

      achievementsJson[achievement.key] = true;

      chipsToCredit +=
        Number(achievement.chips) || 0;

      luckyCardsToCredit +=
        Number(achievement.luckyCards) || 0;

      unlocked.push({
        key: achievement.key,
        title: achievement.title,
        winsRequired: achievement.winsRequired,
        rewardType: achievement.rewardType,
        chips: Number(achievement.chips) || 0,
        luckyCards:
          Number(achievement.luckyCards) || 0
      });
    }

    /*
     * Nenhuma conquista nova.
     */
    if (!unlocked.length) {
      await client.query("COMMIT");

      return {
        ok: true,
        wins,
        unlocked: [],
        chipsBalance: null,
        luckyCardsAvailable:
          Number(
            progressResult.rows[0]
              ?.lucky_cards_available
          ) || 0
      };
    }

    /*
     * Atualiza as conquistas e credita Cartas da Sorte.
     */
    const progressUpdateResult =
      await client.query(
        `
          UPDATE user_reward_progress
          SET
            achievements_json = $1::jsonb,

            lucky_cards_available =
              COALESCE(lucky_cards_available, 0) + $2,

            updated_at = NOW()
          WHERE user_id = $3

          RETURNING
            achievements_json,
            lucky_cards_available
        `,
        [
          JSON.stringify(achievementsJson),
          luckyCardsToCredit,
          numericUserId
        ]
      );

    let chipsBalance = null;

    /*
     * Credita fichas somente quando houver conquista
     * com prêmio em fichas.
     */
    if (chipsToCredit > 0) {
      const balanceResult = await client.query(
        `
          UPDATE users
          SET
            chips_balance =
              COALESCE(chips_balance, 0) + $1,

            updated_at = NOW()
          WHERE id = $2

          RETURNING chips_balance
        `,
        [
          chipsToCredit,
          numericUserId
        ]
      );

      if (balanceResult.rowCount !== 1) {
        throw new Error(
          `Usuário ${numericUserId} não encontrado ao creditar conquistas.`
        );
      }

      chipsBalance =
        Number(
          balanceResult.rows[0]?.chips_balance
        ) || 0;
    } else {
      const balanceResult = await client.query(
        `
          SELECT chips_balance
          FROM users
          WHERE id = $1
        `,
        [numericUserId]
      );

      chipsBalance =
        Number(
          balanceResult.rows[0]?.chips_balance
        ) || 0;
    }

    /*
     * Registra cada conquista separadamente no histórico.
     *
     * Para Carta da Sorte, chips recebe 0 porque a tabela
     * reward_transactions exige esse campo.
     */
    for (const achievement of unlocked) {
      await client.query(
        `
          INSERT INTO reward_transactions (
            user_id,
            reward_type,
            description,
            chips
          )
          VALUES (
            $1,
            $2,
            $3,
            $4
          )
        `,
        [
          numericUserId,

          achievement.rewardType === "lucky_card"
            ? "achievement_lucky_card"
            : "achievement_chips",

          getAchievementDescription(achievement),

          achievement.chips
        ]
      );
    }

    await client.query("COMMIT");

    const luckyCardsAvailable =
      Number(
        progressUpdateResult.rows[0]
          ?.lucky_cards_available
      ) || 0;

    console.log(
      "[ACHIEVEMENTS] Conquistas liberadas:",
      {
        userId: numericUserId,
        wins,
        unlocked: unlocked.map(
          achievement => achievement.key
        ),
        chipsCredit: chipsToCredit,
        luckyCardsCredit: luckyCardsToCredit,
        chipsBalance,
        luckyCardsAvailable
      }
    );

    return {
      ok: true,
      wins,
      unlocked,
      chipsCredit: chipsToCredit,
      luckyCardsCredit: luckyCardsToCredit,
      chipsBalance,
      luckyCardsAvailable,
      achievements: achievementsJson
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "[ACHIEVEMENTS] Erro no rollback:",
        rollbackError
      );
    }

    throw error;
  } finally {
    client.release();
  }
}


/* =========================================================
   STATUS DAS CONQUISTAS
========================================================= */

async function getUserAchievementsStatus(userId) {
  const numericUserId = Number(userId);

  if (
    !Number.isInteger(numericUserId) ||
    numericUserId <= 0
  ) {
    return {
      wins: 0,
      achievements: []
    };
  }

  const result = await pool.query(
    `
      SELECT
        COALESCE(us.wins, 0) AS wins,
        COALESCE(
          urp.achievements_json,
          '{}'::jsonb
        ) AS achievements_json

      FROM users u

      LEFT JOIN user_stats us
        ON us.user_id = u.id

      LEFT JOIN user_reward_progress urp
        ON urp.user_id = u.id

      WHERE u.id = $1
    `,
    [numericUserId]
  );

  const row = result.rows[0];

  const wins =
    Number(row?.wins) || 0;

  const achievementsJson =
    normalizeAchievementsJson(
      row?.achievements_json
    );

  return {
    wins,

    achievements: ACHIEVEMENTS.map(
      achievement => ({
        key: achievement.key,
        title: achievement.title,

        winsRequired:
          achievement.winsRequired,

        currentWins:
          Math.min(
            wins,
            achievement.winsRequired
          ),

        completed:
          wins >= achievement.winsRequired,

        claimed:
          achievementsJson[
            achievement.key
          ] === true,

        rewardType:
          achievement.rewardType,

        chips:
          Number(achievement.chips) || 0,

        luckyCards:
          Number(
            achievement.luckyCards
          ) || 0
      })
    )
  };
}


module.exports = {
  ACHIEVEMENTS,
  processUserAchievements,
  getUserAchievementsStatus
};