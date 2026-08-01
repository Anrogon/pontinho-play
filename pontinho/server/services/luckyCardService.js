const { randomUUID } = require("crypto");
const pool = require("../config/db");

const LUCKY_CARD_SESSION_MINUTES = 10;

const LUCKY_CARD_REWARDS = {
  "2": 200,
  "3": 300,
  "4": 400,
  "5": 500,
  "6": 600,
  "7": 700,
  "8": 800,
  "9": 900,
  "10": 1000,
  J: 1100,
  Q: 1200,
  K: 1300,
  A: 1500,
  JOKER: 2000
};

const LUCKY_CARD_SUITS = [
  { key: "spades", symbol: "♠" },
  { key: "hearts", symbol: "♥" },
  { key: "diamonds", symbol: "♦" },
  { key: "clubs", symbol: "♣" }
];

const LUCKY_CARD_RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A"
];

function createLuckyCardDeck() {
  const deck = [];

  for (const rank of LUCKY_CARD_RANKS) {
    for (const suit of LUCKY_CARD_SUITS) {
      deck.push({
        id: `${rank}-${suit.key}`,
        rank,
        suit: suit.key,
        symbol: suit.symbol,
        reward: LUCKY_CARD_REWARDS[rank],
        isJoker: false
      });
    }
  }

  deck.push({
    id: "JOKER-1",
    rank: "JOKER",
    suit: null,
    symbol: "🃏",
    reward: LUCKY_CARD_REWARDS.JOKER,
    isJoker: true
  });

  deck.push({
    id: "JOKER-2",
    rank: "JOKER",
    suit: null,
    symbol: "🃏",
    reward: LUCKY_CARD_REWARDS.JOKER,
    isJoker: true
  });

  return deck;
}

function shuffleLuckyCardDeck(deck) {
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(
      Math.random() * (index + 1)
    );

    [
      shuffled[index],
      shuffled[randomIndex]
    ] = [
      shuffled[randomIndex],
      shuffled[index]
    ];
  }

  return shuffled;
}

function generateLuckyCardChoices() {
  const deck = createLuckyCardDeck();
  const shuffled = shuffleLuckyCardDeck(deck);

  return shuffled.slice(0, 3);
}

function serializeLuckyCard(card) {
  if (!card) return null;

  return {
    rank: card.rank,
    suit: card.suit,
    symbol: card.symbol,
    reward: Number(card.reward) || 0,
    isJoker: card.isJoker === true
  };
}

async function startLuckyCardSession(userId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        INSERT INTO user_reward_progress (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `,
      [userId]
    );

    const progressResult = await client.query(
      `
        SELECT lucky_cards_available
        FROM user_reward_progress
        WHERE user_id = $1
        FOR UPDATE
      `,
      [userId]
    );

    const available =
      Number(
        progressResult.rows[0]?.lucky_cards_available
      ) || 0;

    if (available < 1) {
      await client.query("ROLLBACK");

      return {
        ok: false,
        status: 400,
        message: "Você não possui Carta da Sorte disponível."
      };
    }

    await client.query(
      `
        UPDATE lucky_card_sessions
        SET
          status = 'expired',
          resolved_at = NOW()
        WHERE
          user_id = $1
          AND status = 'pending'
          AND expires_at <= NOW()
      `,
      [userId]
    );

    const pendingResult = await client.query(
      `
        SELECT
          id,
          cards_json,
          expires_at
        FROM lucky_card_sessions
        WHERE
          user_id = $1
          AND status = 'pending'
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      `,
      [userId]
    );

    if (pendingResult.rows.length) {
      const pending = pendingResult.rows[0];

      await client.query("COMMIT");

      return {
        ok: true,
        resumed: true,
        sessionId: pending.id,
        expiresAt: pending.expires_at,
        cards: [0, 1, 2].map(index => ({
          index,
          hidden: true
        }))
      };
    }

    const sessionId = randomUUID();
    const cards = generateLuckyCardChoices();

    const sessionResult = await client.query(
      `
        INSERT INTO lucky_card_sessions (
          id,
          user_id,
          cards_json,
          status,
          expires_at
        )
        VALUES (
          $1,
          $2,
          $3::jsonb,
          'pending',
          NOW() + ($4 * INTERVAL '1 minute')
        )
        RETURNING
          id,
          expires_at
      `,
      [
        sessionId,
        userId,
        JSON.stringify(cards),
        LUCKY_CARD_SESSION_MINUTES
      ]
    );

    await client.query("COMMIT");

    return {
      ok: true,
      resumed: false,
      sessionId: sessionResult.rows[0].id,
      expiresAt: sessionResult.rows[0].expires_at,
      cards: [0, 1, 2].map(index => ({
        index,
        hidden: true
      }))
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    throw error;
  } finally {
    client.release();
  }
}

async function chooseLuckyCard(
  userId,
  sessionId,
  chosenIndex
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sessionResult = await client.query(
      `
        SELECT
          id,
          user_id,
          cards_json,
          status,
          expires_at
        FROM lucky_card_sessions
        WHERE id = $1
        FOR UPDATE
      `,
      [sessionId]
    );

    const session = sessionResult.rows[0];

    if (!session) {
      await client.query("ROLLBACK");

      return {
        ok: false,
        status: 404,
        message: "Sessão da Carta da Sorte não encontrada."
      };
    }

    if (Number(session.user_id) !== Number(userId)) {
      await client.query("ROLLBACK");

      return {
        ok: false,
        status: 403,
        message: "Esta sessão não pertence ao usuário."
      };
    }

    if (session.status !== "pending") {
      await client.query("ROLLBACK");

      return {
        ok: false,
        status: 409,
        message: "Esta Carta da Sorte já foi utilizada."
      };
    }

    if (
      new Date(session.expires_at).getTime() <= Date.now()
    ) {
      await client.query(
        `
          UPDATE lucky_card_sessions
          SET
            status = 'expired',
            resolved_at = NOW()
          WHERE id = $1
        `,
        [sessionId]
      );

      await client.query("COMMIT");

      return {
        ok: false,
        status: 410,
        message: "A sessão da Carta da Sorte expirou."
      };
    }

    if (
      !Number.isInteger(chosenIndex) ||
      chosenIndex < 0 ||
      chosenIndex > 2
    ) {
      await client.query("ROLLBACK");

      return {
        ok: false,
        status: 400,
        message: "Escolha de carta inválida."
      };
    }

    const progressResult = await client.query(
      `
        SELECT lucky_cards_available
        FROM user_reward_progress
        WHERE user_id = $1
        FOR UPDATE
      `,
      [userId]
    );

    const available =
      Number(
        progressResult.rows[0]?.lucky_cards_available
      ) || 0;

    if (available < 1) {
      await client.query("ROLLBACK");

      return {
        ok: false,
        status: 400,
        message: "Você não possui Carta da Sorte disponível."
      };
    }

    const cards = Array.isArray(session.cards_json)
      ? session.cards_json
      : [];

    if (cards.length !== 3) {
      throw new Error(
        `Sessão ${sessionId} possui cartas inválidas.`
      );
    }

    const chosenCard = cards[chosenIndex];

    if (!chosenCard) {
      throw new Error(
        `Carta ${chosenIndex} não encontrada na sessão ${sessionId}.`
      );
    }

    const reward =
      Number(chosenCard.reward) || 0;

    if (reward <= 0) {
      throw new Error(
        `Recompensa inválida na sessão ${sessionId}.`
      );
    }

    const consumeResult = await client.query(
      `
        UPDATE user_reward_progress
        SET
          lucky_cards_available =
            lucky_cards_available - 1,
          updated_at = NOW()
        WHERE
          user_id = $1
          AND lucky_cards_available > 0
        RETURNING lucky_cards_available
      `,
      [userId]
    );

    if (consumeResult.rowCount !== 1) {
      await client.query("ROLLBACK");

      return {
        ok: false,
        status: 409,
        message: "A Carta da Sorte não está mais disponível."
      };
    }

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
      [reward, userId]
    );

    if (balanceResult.rowCount !== 1) {
      throw new Error(
        `Usuário ${userId} não encontrado ao creditar Carta da Sorte.`
      );
    }

    const sessionUpdateResult = await client.query(
      `
        UPDATE lucky_card_sessions
        SET
          status = 'resolved',
          chosen_index = $1,
          chosen_rank = $2,
          chosen_suit = $3,
          reward_chips = $4,
          resolved_at = NOW()
        WHERE
          id = $5
          AND status = 'pending'
        RETURNING id
      `,
      [
        chosenIndex,
        chosenCard.rank,
        chosenCard.suit,
        reward,
        sessionId
      ]
    );

    if (sessionUpdateResult.rowCount !== 1) {
      throw new Error(
        `Não foi possível resolver a sessão ${sessionId}.`
      );
    }

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
          'lucky_card',
          $2,
          $3
        )
      `,
      [
        userId,
        chosenCard.isJoker
          ? "Carta da Sorte — Coringa"
          : `Carta da Sorte — ${chosenCard.rank}${chosenCard.symbol}`,
        reward
      ]
    );

    await client.query("COMMIT");

    return {
      ok: true,
      sessionId,
      chosenIndex,
      chosenCard: serializeLuckyCard(chosenCard),
      cards: cards.map(serializeLuckyCard),
      reward,
      luckyCardsAvailable:
        Number(
          consumeResult.rows[0]?.lucky_cards_available
        ) || 0,
      chipsBalance:
        Number(
          balanceResult.rows[0]?.chips_balance
        ) || 0
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  startLuckyCardSession,
  chooseLuckyCard
};

