const pool = require("../config/db");


/* =========================================================
   CONFIGURAÇÃO DO RANKING MENSAL
========================================================= */

const MONTHLY_RANKING_GAME_CODE = "PONTINHO";

/*
 * A fórmula definida foi:
 *
 * pontos = vitórias × aproveitamento
 * pontos = (vitórias × vitórias) / partidas
 *
 * Como ranking_points é INTEGER no banco, multiplicamos
 * por 1.000 para preservar três casas decimais.
 *
 * Exemplo:
 * 16,375 pontos reais = 16.375 no banco.
 */
const MONTHLY_RANKING_SCORE_SCALE = 1000;


/* =========================================================
   UTILITÁRIOS
========================================================= */

function getCurrentRankingMonth() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  return `${year}-${month}-01`;
}


function calculateMonthlyRankingPoints(
  wins,
  matchesPlayed
) {
  const safeWins = Math.max(
    Number(wins) || 0,
    0
  );

  const safeMatches = Math.max(
    Number(matchesPlayed) || 0,
    0
  );

  if (safeMatches <= 0 || safeWins <= 0) {
    return 0;
  }

  const rawPoints =
    (safeWins * safeWins) / safeMatches;

  return Math.round(
    rawPoints * MONTHLY_RANKING_SCORE_SCALE
  );
}


function formatMonthlyRankingPoints(
  rankingPoints
) {
  return (
    (Number(rankingPoints) || 0) /
    MONTHLY_RANKING_SCORE_SCALE
  );
}


/* =========================================================
   REGISTRAR RESULTADO DE UMA PARTIDA
========================================================= */

async function processMonthlyRankingResult({
  userId,
  isWinner,
  gameCode = MONTHLY_RANKING_GAME_CODE
}) {
  const numericUserId = Number(userId);

  if (
    !Number.isInteger(numericUserId) ||
    numericUserId <= 0
  ) {
    return {
      ok: false,
      message:
        "Usuário inválido para o ranking mensal."
    };
  }

  const normalizedGameCode =
    String(gameCode || MONTHLY_RANKING_GAME_CODE)
      .trim()
      .toUpperCase();

  const rankingMonth =
    getCurrentRankingMonth();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Cria o registro mensal ou soma o resultado
     * desta partida ao registro já existente.
     */
    const upsertResult = await client.query(
      `
        INSERT INTO monthly_ranking (
          user_id,
          game_code,
          ranking_month,
          matches_played,
          wins,
          ranking_points,
          prize_chips,
          prize_lucky_cards,
          prize_paid,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          1,
          $4,
          0,
          0,
          0,
          FALSE,
          NOW(),
          NOW()
        )

        ON CONFLICT (
          user_id,
          game_code,
          ranking_month
        )
        DO UPDATE SET
          matches_played =
            monthly_ranking.matches_played + 1,

          wins =
            monthly_ranking.wins +
            EXCLUDED.wins,

          updated_at = NOW()

        RETURNING
          id,
          user_id,
          game_code,
          ranking_month,
          matches_played,
          wins,
          ranking_points,
          prize_chips,
          prize_lucky_cards,
          prize_paid
      `,
      [
        numericUserId,
        normalizedGameCode,
        rankingMonth,
        isWinner === true ? 1 : 0
      ]
    );

    const rankingRow =
      upsertResult.rows[0];

    const matchesPlayed =
      Number(rankingRow.matches_played) || 0;

    const wins =
      Number(rankingRow.wins) || 0;

    const rankingPoints =
      calculateMonthlyRankingPoints(
        wins,
        matchesPlayed
      );

    /*
     * Recalcula a pontuação após atualizar
     * partidas e vitórias.
     */
    const updateResult = await client.query(
      `
        UPDATE monthly_ranking
        SET
          ranking_points = $1,
          updated_at = NOW()
        WHERE id = $2

        RETURNING
          id,
          user_id,
          game_code,
          ranking_month,
          matches_played,
          wins,
          ranking_points,
          prize_chips,
          prize_lucky_cards,
          prize_paid,
          updated_at
      `,
      [
        rankingPoints,
        rankingRow.id
      ]
    );

    await client.query("COMMIT");

    const updated =
      updateResult.rows[0];

    const losses = Math.max(
      Number(updated.matches_played) -
      Number(updated.wins),
      0
    );

    const winRate =
      Number(updated.matches_played) > 0
        ? (
            Number(updated.wins) /
            Number(updated.matches_played)
          ) * 100
        : 0;

    const result = {
      ok: true,

      userId:
        Number(updated.user_id),

      gameCode:
        updated.game_code,

      rankingMonth:
        updated.ranking_month,

      matchesPlayed:
        Number(updated.matches_played) || 0,

      wins:
        Number(updated.wins) || 0,

      losses,

      winRate:
        Number(winRate.toFixed(2)),

      rankingPoints:
        Number(updated.ranking_points) || 0,

      displayPoints:
        Number(
          formatMonthlyRankingPoints(
            updated.ranking_points
          ).toFixed(3)
        ),

      prizePaid:
        updated.prize_paid === true
    };

    console.log(
      "[MONTHLY RANKING] Resultado registrado:",
      result
    );

    return result;

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "[MONTHLY RANKING] Erro no rollback:",
        rollbackError
      );
    }

    throw error;

  } finally {
    client.release();
  }
}


/* =========================================================
   CONSULTAR POSIÇÃO DO JOGADOR
========================================================= */

async function getMonthlyRankingStatus(
  userId,
  gameCode = MONTHLY_RANKING_GAME_CODE
) {
  const numericUserId = Number(userId);

  if (
    !Number.isInteger(numericUserId) ||
    numericUserId <= 0
  ) {
    return {
      position: null,
      totalPlayers: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      rankingPoints: 0,
      displayPoints: 0
    };
  }

  const normalizedGameCode =
    String(gameCode || MONTHLY_RANKING_GAME_CODE)
      .trim()
      .toUpperCase();

  const rankingMonth =
    getCurrentRankingMonth();

  const result = await pool.query(
    `
      WITH ranked_players AS (
        SELECT
          mr.user_id,
          mr.matches_played,
          mr.wins,
          mr.ranking_points,
          mr.updated_at,

          ROW_NUMBER() OVER (
            ORDER BY
              mr.ranking_points DESC,
              mr.wins DESC,
              (
                mr.matches_played -
                mr.wins
              ) ASC,
              mr.updated_at ASC,
              mr.user_id ASC
          ) AS position,

          COUNT(*) OVER () AS total_players

        FROM monthly_ranking mr

        WHERE
          mr.game_code = $1
          AND mr.ranking_month = $2
      )

      SELECT
        user_id,
        matches_played,
        wins,
        ranking_points,
        position,
        total_players

      FROM ranked_players

      WHERE user_id = $3
    `,
    [
      normalizedGameCode,
      rankingMonth,
      numericUserId
    ]
  );

  const row = result.rows[0];

  if (!row) {
    return {
      rankingMonth,
      position: null,
      totalPlayers: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      rankingPoints: 0,
      displayPoints: 0
    };
  }

  const matchesPlayed =
    Number(row.matches_played) || 0;

  const wins =
    Number(row.wins) || 0;

  const losses =
    Math.max(matchesPlayed - wins, 0);

  const winRate =
    matchesPlayed > 0
      ? (wins / matchesPlayed) * 100
      : 0;

  return {
    rankingMonth,

    position:
      Number(row.position) || null,

    totalPlayers:
      Number(row.total_players) || 0,

    matchesPlayed,
    wins,
    losses,

    winRate:
      Number(winRate.toFixed(2)),

    rankingPoints:
      Number(row.ranking_points) || 0,

    displayPoints:
      Number(
        formatMonthlyRankingPoints(
          row.ranking_points
        ).toFixed(3)
      )
  };
}


/* =========================================================
   CONSULTAR CLASSIFICAÇÃO
========================================================= */

async function getMonthlyRankingLeaderboard({
  gameCode = MONTHLY_RANKING_GAME_CODE,
  limit = 100
} = {}) {
  const normalizedGameCode =
    String(gameCode || MONTHLY_RANKING_GAME_CODE)
      .trim()
      .toUpperCase();

  const safeLimit = Math.min(
    Math.max(Number(limit) || 100, 1),
    100
  );

  const rankingMonth =
    getCurrentRankingMonth();

  const result = await pool.query(
    `
      SELECT
        mr.user_id,
        u.email,
        mr.matches_played,
        mr.wins,
        mr.ranking_points,

        ROW_NUMBER() OVER (
          ORDER BY
            mr.ranking_points DESC,
            mr.wins DESC,
            (
              mr.matches_played -
              mr.wins
            ) ASC,
            mr.updated_at ASC,
            mr.user_id ASC
        ) AS position

      FROM monthly_ranking mr

      INNER JOIN users u
        ON u.id = mr.user_id

      WHERE
        mr.game_code = $1
        AND mr.ranking_month = $2

      ORDER BY
        mr.ranking_points DESC,
        mr.wins DESC,
        (
          mr.matches_played -
          mr.wins
        ) ASC,
        mr.updated_at ASC,
        mr.user_id ASC

      LIMIT $3
    `,
    [
      normalizedGameCode,
      rankingMonth,
      safeLimit
    ]
  );

  return result.rows.map(row => {
    const matchesPlayed =
      Number(row.matches_played) || 0;

    const wins =
      Number(row.wins) || 0;

    const losses =
      Math.max(matchesPlayed - wins, 0);

    return {
      position:
        Number(row.position),

      userId:
        Number(row.user_id),

      email:
        row.email,

      matchesPlayed,
      wins,
      losses,

      rankingPoints:
        Number(row.ranking_points) || 0,

      displayPoints:
        Number(
          formatMonthlyRankingPoints(
            row.ranking_points
          ).toFixed(3)
        )
    };
  });
}


module.exports = {
  MONTHLY_RANKING_GAME_CODE,
  MONTHLY_RANKING_SCORE_SCALE,

  calculateMonthlyRankingPoints,
  formatMonthlyRankingPoints,

  processMonthlyRankingResult,
  getMonthlyRankingStatus,
  getMonthlyRankingLeaderboard
};