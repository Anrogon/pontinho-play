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


const MONTHLY_RANKING_PRIZES = [
  {
    from: 1,
    to: 1,
    chips: 5000,
    luckyCards: 0
  },
  {
    from: 2,
    to: 2,
    chips: 3000,
    luckyCards: 0
  },
  {
    from: 3,
    to: 3,
    chips: 2000,
    luckyCards: 0
  },
  {
    from: 4,
    to: 10,
    chips: 1000,
    luckyCards: 0
  },
  {
    from: 11,
    to: 50,
    chips: 500,
    luckyCards: 0
  },
  {
    from: 51,
    to: 100,
    chips: 0,
    luckyCards: 1
  }
];

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

function normalizeRankingMonth(value) {
  const text = String(value || "").trim();

  if (!/^\d{4}-\d{2}-01$/.test(text)) {
    throw new Error(
      `Mês de ranking inválido: ${text}`
    );
  }

  return text;
}


function getPreviousRankingMonth() {
  const now = new Date();

  const previousMonth = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1
  );

  const year =
    previousMonth.getFullYear();

  const month = String(
    previousMonth.getMonth() + 1
  ).padStart(2, "0");

  return `${year}-${month}-01`;
}


function getMonthlyRankingPrize(position) {
  const numericPosition =
    Number(position) || 0;

  const prize = MONTHLY_RANKING_PRIZES.find(
    item =>
      numericPosition >= item.from &&
      numericPosition <= item.to
  );

  return {
    chips:
      Number(prize?.chips) || 0,

    luckyCards:
      Number(prize?.luckyCards) || 0
  };
}


function getMonthlyRankingPrizeDescription({
  position,
  rankingMonth,
  chips,
  luckyCards
}) {
  const monthLabel =
    String(rankingMonth)
      .slice(0, 7)
      .split("-")
      .reverse()
      .join("/");

  if (luckyCards > 0) {
    return (
      `Ranking mensal ${monthLabel} — ` +
      `${position}º lugar — ` +
      `${luckyCards} Carta da Sorte`
    );
  }

  return (
    `Ranking mensal ${monthLabel} — ` +
    `${position}º lugar — ` +
    `${Number(chips).toLocaleString("pt-BR")} fichas`
  );
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


/* =========================================================
   FECHAR E PAGAR UM MÊS DO RANKING
========================================================= */

async function finalizeMonthlyRankingMonth({
  rankingMonth,
  gameCode = MONTHLY_RANKING_GAME_CODE
}) {
  const normalizedRankingMonth =
    normalizeRankingMonth(rankingMonth);

  const normalizedGameCode =
    String(
      gameCode ||
      MONTHLY_RANKING_GAME_CODE
    )
      .trim()
      .toUpperCase();

  /*
   * Impede que o mês atual seja fechado por engano.
   */
  if (
    normalizedRankingMonth ===
    getCurrentRankingMonth()
  ) {
    return {
      ok: false,
      status: 409,
      message:
        "O ranking do mês atual ainda não pode ser fechado."
    };
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Bloqueia todos os registros ainda não pagos
     * do mês que será fechado.
     */
    const rankingResult = await client.query(
      `
        SELECT
          ranked.id,
          ranked.user_id,
          ranked.matches_played,
          ranked.wins,
          ranked.ranking_points,
          ranked.position

        FROM (
          SELECT
            mr.id,
            mr.user_id,
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

          WHERE
            mr.game_code = $1
            AND mr.ranking_month = $2
        ) ranked

        INNER JOIN monthly_ranking locked_row
          ON locked_row.id = ranked.id

        WHERE locked_row.prize_paid = FALSE

        ORDER BY ranked.position ASC

        FOR UPDATE OF locked_row
      `,
      [
        normalizedGameCode,
        normalizedRankingMonth
      ]
    );

    const rankingRows =
      rankingResult.rows || [];

    if (!rankingRows.length) {
      await client.query("COMMIT");

      return {
        ok: true,
        rankingMonth:
          normalizedRankingMonth,
        gameCode:
          normalizedGameCode,
        processedPlayers: 0,
        rewardedPlayers: 0,
        totalChipsPaid: 0,
        totalLuckyCardsPaid: 0,
        message:
          "Nenhum prêmio pendente para este mês."
      };
    }

    let rewardedPlayers = 0;
    let totalChipsPaid = 0;
    let totalLuckyCardsPaid = 0;

    const paidPlayers = [];

    for (const row of rankingRows) {
      const position =
        Number(row.position) || 0;

      const userId =
        Number(row.user_id);

      const prize =
        getMonthlyRankingPrize(position);

      const chips =
        Number(prize.chips) || 0;

      const luckyCards =
        Number(prize.luckyCards) || 0;

      /*
       * Garante o registro de progresso,
       * necessário para creditar Carta da Sorte.
       */
      await client.query(
        `
          INSERT INTO user_reward_progress (
            user_id
          )
          VALUES ($1)
          ON CONFLICT (user_id) DO NOTHING
        `,
        [userId]
      );

      if (chips > 0) {
        const chipsResult =
          await client.query(
            `
              UPDATE users
              SET
                chips_balance =
                  COALESCE(
                    chips_balance,
                    0
                  ) + $1,

                updated_at = NOW()

              WHERE id = $2

              RETURNING chips_balance
            `,
            [
              chips,
              userId
            ]
          );

        if (chipsResult.rowCount !== 1) {
          throw new Error(
            `Usuário ${userId} não encontrado ao pagar o ranking mensal.`
          );
        }
      }

      if (luckyCards > 0) {
        await client.query(
          `
            UPDATE user_reward_progress
            SET
              lucky_cards_available =
                COALESCE(
                  lucky_cards_available,
                  0
                ) + $1,

              updated_at = NOW()

            WHERE user_id = $2
          `,
          [
            luckyCards,
            userId
          ]
        );
      }

      /*
       * Registra no histórico apenas quem ganhou
       * fichas ou Carta da Sorte.
       */
      if (chips > 0 || luckyCards > 0) {
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
            userId,

            luckyCards > 0
              ? "monthly_ranking_lucky_card"
              : "monthly_ranking_chips",

            getMonthlyRankingPrizeDescription({
              position,
              rankingMonth:
                normalizedRankingMonth,
              chips,
              luckyCards
            }),

            chips
          ]
        );

        rewardedPlayers += 1;
        totalChipsPaid += chips;
        totalLuckyCardsPaid +=
          luckyCards;

        paidPlayers.push({
          userId,
          position,
          chips,
          luckyCards
        });
      }

      /*
       * Todos os participantes são marcados como
       * processados, inclusive os que ficaram fora
       * das faixas premiadas.
       */
      await client.query(
        `
          UPDATE monthly_ranking
          SET
            prize_chips = $1,
            prize_lucky_cards = $2,
            prize_paid = TRUE,
            updated_at = NOW()

          WHERE
            id = $3
            AND prize_paid = FALSE
        `,
        [
          chips,
          luckyCards,
          row.id
        ]
      );
    }

    await client.query("COMMIT");

    const result = {
      ok: true,

      rankingMonth:
        normalizedRankingMonth,

      gameCode:
        normalizedGameCode,

      processedPlayers:
        rankingRows.length,

      rewardedPlayers,

      totalChipsPaid,

      totalLuckyCardsPaid,

      paidPlayers
    };

    console.log(
      "[MONTHLY RANKING] Fechamento concluído:",
      result
    );

    return result;

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "[MONTHLY RANKING] Erro no rollback do fechamento:",
        rollbackError
      );
    }

    throw error;

  } finally {
    client.release();
  }
}


/* =========================================================
   FECHAR O MÊS ANTERIOR
========================================================= */

async function finalizePreviousMonthlyRanking(
  gameCode = MONTHLY_RANKING_GAME_CODE
) {
  return finalizeMonthlyRankingMonth({
    rankingMonth:
      getPreviousRankingMonth(),

    gameCode
  });
}


/* =========================================================
   FECHAR TODOS OS MESES ANTERIORES PENDENTES
========================================================= */

async function finalizePendingMonthlyRankings(
  gameCode = MONTHLY_RANKING_GAME_CODE
) {
  const normalizedGameCode =
    String(
      gameCode ||
      MONTHLY_RANKING_GAME_CODE
    )
      .trim()
      .toUpperCase();

  const currentRankingMonth =
    getCurrentRankingMonth();

  /*
   * Procura meses anteriores que ainda tenham
   * pelo menos um participante não processado.
   */
  const pendingResult = await pool.query(
    `
      SELECT DISTINCT
        ranking_month

      FROM monthly_ranking

      WHERE
        game_code = $1
        AND ranking_month < $2
        AND prize_paid = FALSE

      ORDER BY ranking_month ASC
    `,
    [
      normalizedGameCode,
      currentRankingMonth
    ]
  );

  const pendingMonths =
    pendingResult.rows.map(row => {
      const value = row.ranking_month;

      /*
       * O PostgreSQL pode devolver DATE como objeto Date.
       * Convertemos sempre para YYYY-MM-01.
       */
      if (value instanceof Date) {
        const year =
          value.getFullYear();

        const month = String(
          value.getMonth() + 1
        ).padStart(2, "0");

        return `${year}-${month}-01`;
      }

      return String(value).slice(0, 10);
    });

  if (!pendingMonths.length) {
    return {
      ok: true,
      processedMonths: 0,
      results: [],
      message:
        "Nenhum ranking mensal pendente."
    };
  }

  const results = [];

  /*
   * Fecha um mês por vez. Se um fechamento falhar,
   * o erro é lançado e os meses seguintes não são
   * processados silenciosamente.
   */
  for (const rankingMonth of pendingMonths) {
    const result =
      await finalizeMonthlyRankingMonth({
        rankingMonth,
        gameCode: normalizedGameCode
      });

    if (
      Number(result.processedPlayers) > 0 ||
      Number(result.rewardedPlayers) > 0
    ) {
      results.push(result);
    }
  }

  const summary = {
    ok: true,

    processedMonths:
      results.length,

    processedPlayers:
      results.reduce(
        (total, result) =>
          total +
          (
            Number(
              result.processedPlayers
            ) || 0
          ),
        0
      ),

    rewardedPlayers:
      results.reduce(
        (total, result) =>
          total +
          (
            Number(
              result.rewardedPlayers
            ) || 0
          ),
        0
      ),

    totalChipsPaid:
      results.reduce(
        (total, result) =>
          total +
          (
            Number(
              result.totalChipsPaid
            ) || 0
          ),
        0
      ),

    totalLuckyCardsPaid:
      results.reduce(
        (total, result) =>
          total +
          (
            Number(
              result.totalLuckyCardsPaid
            ) || 0
          ),
        0
      ),

    results
  };
/*
  console.log(
    "[MONTHLY RANKING] Verificação de pendências concluída:",
    {
      processedMonths:
        summary.processedMonths,

      processedPlayers:
        summary.processedPlayers,

      rewardedPlayers:
        summary.rewardedPlayers,

      totalChipsPaid:
        summary.totalChipsPaid,

      totalLuckyCardsPaid:
        summary.totalLuckyCardsPaid
    }
  );*/

  return summary;
}


module.exports = {
  MONTHLY_RANKING_GAME_CODE,
  MONTHLY_RANKING_SCORE_SCALE,
  MONTHLY_RANKING_PRIZES,

  calculateMonthlyRankingPoints,
  formatMonthlyRankingPoints,

  processMonthlyRankingResult,
  getMonthlyRankingStatus,
  getMonthlyRankingLeaderboard,

  getPreviousRankingMonth,
  getMonthlyRankingPrize,

  finalizeMonthlyRankingMonth,
  finalizePreviousMonthlyRanking,
  finalizePendingMonthlyRankings
};