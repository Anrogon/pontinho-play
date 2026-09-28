const express = require("express");
const pool = require("../config/db");
const { requireAuth } = require("../middleware/auth");
const {  CHIP_PACKAGES, CASH_PACKAGES, getChipPackage, getCashPackage} = require("../config/chipPackages");
const { createPixPayment, getPaymentById } = require("../services/mercadoPago");
const { createWithdrawalRequest } = require("../services/cashWalletService");



const router = express.Router();

router.get("/packages", requireAuth, async (req, res) => {
  return res.json({
    ok: true,
    packages: CHIP_PACKAGES,
    cashPackages: CASH_PACKAGES,
  });
});

router.post("/deposit", requireAuth, async (req, res) => {
  try {
    const packageId = String(req.body?.packageId || "");

    const purpose =
      String(req.body?.purpose || "CHIPS").toUpperCase();

    if (!["CHIPS", "CASH"].includes(purpose)) {
      return res.status(400).json({
        ok: false,
        message: "Finalidade de depósito inválida.",
      });
    }

    const pack =
      purpose === "CASH"
        ? getCashPackage(packageId)
        : getChipPackage(packageId);

    if (!pack) {
      return res.status(400).json({
        ok: false,
        message: "Pacote inválido.",
      });
    }

    const amountCents =
      purpose === "CASH"
        ? Number(pack.amountCents) || 0
        : Number(pack.priceCents) || 0;

    const chipsAmount =
      purpose === "CHIPS"
        ? Number(pack.chips) || 0
        : 0;

    const txResult = await pool.query(
      `
      INSERT INTO wallet_transactions (
        user_id,
        type,
        status,
        amount_cents,
        chips_amount,
        provider,
        purpose
      )
      VALUES ($1, 'deposit', 'pending', $2, $3, 'mercado_pago', $4)
      RETURNING *
      `,
      [
        req.auth.userId,
        amountCents,
        chipsAmount,
        purpose
      ]
    );

    const transaction = txResult.rows[0];

    const mpPayment = await createPixPayment({
      amountCents,

      description:
        purpose === "CASH"
          ? `Depósito de R$ ${(amountCents / 100).toFixed(2)}`
          : `Compra de ${chipsAmount} fichas`,

      payerEmail:
        req.auth.email || "cliente@pontinhoplay.com.br",

      externalReference: transaction.id,
    });

    const paymentId = mpPayment?.id || null;

    const qrCode =
      mpPayment?.point_of_interaction
        ?.transaction_data
        ?.qr_code || null;

    const qrCodeBase64 =
      mpPayment?.point_of_interaction
        ?.transaction_data
        ?.qr_code_base64 || null;

    await pool.query(
      `
      UPDATE wallet_transactions
      SET
        provider_payment_id = $1,
        pix_qr_code = $2,
        pix_qr_code_base64 = $3,
        updated_at = NOW()
      WHERE id = $4
      `,
      [
        String(paymentId || ""),
        qrCode,
        qrCodeBase64,
        transaction.id
      ]
    );

    return res.json({
      ok: true,
      transactionId: transaction.id,
      paymentId,
      qrCode,
      qrCodeBase64,
      purpose,
      amount: amountCents / 100,
      chips: chipsAmount,
    });

  } catch (err) {
    console.error("POST /wallet/deposit error:", err);

    return res.status(500).json({
      ok: false,
      message: "Erro ao gerar PIX.",
    });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  try {
    // =====================================================
    // PAGINAÇÃO
    // =====================================================

    const requestedPage = Number(req.query.page);
    const requestedLimit = Number(req.query.limit);

    const page =
      Number.isInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;

    const limit =
      Number.isInteger(requestedLimit) &&
      requestedLimit > 0 &&
      requestedLimit <= 100
        ? requestedLimit
        : 50;

    const offset = (page - 1) * limit;

    // =====================================================
    // FILTRO POR PERÍODO
    // =====================================================

    const startDate =
      typeof req.query.startDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(req.query.startDate)
        ? req.query.startDate
        : null;

    const endDate =
      typeof req.query.endDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(req.query.endDate)
        ? req.query.endDate
        : null;

    if (
      req.query.startDate &&
      !startDate
    ) {
      return res.status(400).json({
        ok: false,
        message: "Data inicial inválida.",
      });
    }

    if (
      req.query.endDate &&
      !endDate
    ) {
      return res.status(400).json({
        ok: false,
        message: "Data final inválida.",
      });
    }

    if (
      startDate &&
      endDate &&
      startDate > endDate
    ) {
      return res.status(400).json({
        ok: false,
        message: "A data inicial não pode ser posterior à data final.",
      });
    }

    // =====================================================
    // TOTAL DE MOVIMENTAÇÕES
    // =====================================================

    const countResult = await pool.query(
      `
      SELECT
        (
          SELECT COUNT(*)
          FROM wallet_transactions wt
          WHERE
            wt.user_id = $1
            AND COALESCE(wt.purpose, 'CHIPS') = 'CHIPS'
            AND (
              $2::DATE IS NULL
              OR wt.created_at >= $2::DATE
            )
            AND (
              $3::DATE IS NULL
              OR wt.created_at < ($3::DATE + INTERVAL '1 day')
            )
        )
        +
        (
          SELECT COUNT(*)
          FROM cash_transactions ct
          WHERE
            ct.user_id = $1
            AND (
              $2::DATE IS NULL
              OR ct.created_at >= $2::DATE
            )
            AND (
              $3::DATE IS NULL
              OR ct.created_at < ($3::DATE + INTERVAL '1 day')
            )
        ) AS total
      `,
      [
        req.auth.userId,
        startDate,
        endDate,
      ]
    );

    const total =
      Number(countResult.rows[0]?.total) || 0;

    const totalPages =
      total > 0
        ? Math.ceil(total / limit)
        : 0;

    // =====================================================
    // HISTÓRICO UNIFICADO
    // =====================================================

    const result = await pool.query(
      `
      SELECT *
      FROM (
        -- =================================================
        -- FICHAS
        -- =================================================
        SELECT
          wt.id,
          wt.type,
          wt.status,
          wt.amount_cents,
          wt.chips_amount,
          wt.provider,
          wt.provider_payment_id,
          wt.created_at,
          wt.updated_at,
          'CHIPS' AS category,
          NULL::NUMERIC AS cash_amount,
          NULL::VARCHAR AS description

        FROM wallet_transactions wt

        WHERE
          wt.user_id = $1
          AND COALESCE(wt.purpose, 'CHIPS') = 'CHIPS'

          AND (
            $2::DATE IS NULL
            OR wt.created_at >= $2::DATE
          )

          AND (
            $3::DATE IS NULL
            OR wt.created_at < ($3::DATE + INTERVAL '1 day')
          )

        UNION ALL

        -- =================================================
        -- DINHEIRO REAL
        -- =================================================
        SELECT
          ct.id,
          ct.type,
          ct.status,
          NULL::INTEGER AS amount_cents,
          NULL::INTEGER AS chips_amount,
          ct.provider,
          ct.provider_transaction_id AS provider_payment_id,
          ct.created_at,
          ct.updated_at,
          'CASH' AS category,
          ct.amount AS cash_amount,
          ct.description

        FROM cash_transactions ct

        WHERE
          ct.user_id = $1

          AND (
            $2::DATE IS NULL
            OR ct.created_at >= $2::DATE
          )

          AND (
            $3::DATE IS NULL
            OR ct.created_at < ($3::DATE + INTERVAL '1 day')
          )

      ) AS history

      ORDER BY created_at DESC

      LIMIT $4
      OFFSET $5
      `,
      [
        req.auth.userId,
        startDate,
        endDate,
        limit,
        offset,
      ]
    );

    return res.json({
      ok: true,
      transactions: result.rows,

      pagination: {
        page,
        limit,
        total,
        totalPages,
      },

      filters: {
        startDate,
        endDate,
      },
    });

  } catch (err) {
    console.error("GET /wallet/history error:", err);

    return res.status(500).json({
      ok: false,
      message: "Erro ao carregar histórico.",
    });
  }
});


async function creditApprovedDepositByPaymentId(paymentId) {
  const paymentIdStr = String(paymentId || "");

  if (!paymentIdStr) {
    return { ok: false, message: "paymentId vazio." };
  }

  const mpPayment = await getPaymentById(paymentIdStr);
  const mpStatus = String(mpPayment?.status || "unknown");

  const txResult = await pool.query(
    `
    SELECT *
    FROM wallet_transactions
    WHERE provider_payment_id = $1
    LIMIT 1
    `,
    [paymentIdStr]
  );

  const tx = txResult.rows[0];

  if (!tx) {
    return {
      ok: false,
      status: mpStatus,
      message: "Transação não encontrada.",
    };
  }

  if (mpStatus !== "approved") {
    await pool.query(
      `
      UPDATE wallet_transactions
      SET status = $2,
          updated_at = NOW()
      WHERE id = $1 AND status <> 'approved'
      `,
      [tx.id, mpStatus]
    );

    return {
      ok: true,
      status: mpStatus,
      credited: false,
      message: "Pagamento ainda não aprovado.",
    };
  }

  const mpExternalReference =
      String(mpPayment?.external_reference || "");

    const mpAmount =
      Number(mpPayment?.transaction_amount || 0);

    const expectedAmount =
      Number(tx.amount_cents || 0) / 100;

    if (mpExternalReference !== String(tx.id)) {
      return {
        ok: false,
        status: mpStatus,
        credited: false,
        message: "Referência do pagamento não corresponde à transação.",
      };
    }

    if (
      !Number.isFinite(mpAmount) ||
      Math.abs(mpAmount - expectedAmount) > 0.001
    ) {
      return {
        ok: false,
        status: mpStatus,
        credited: false,
        message: "Valor do pagamento não corresponde à transação.",
      };
    }

  await pool.query("BEGIN");

  try {
    const lockResult = await pool.query(
      `
      SELECT *
      FROM wallet_transactions
      WHERE id = $1
      FOR UPDATE
      `,
      [tx.id]
    );

    const lockedTx = lockResult.rows[0];

    if (!lockedTx) {
      await pool.query("ROLLBACK");
      return { ok: false, message: "Transação não encontrada no lock." };
    }

    if (lockedTx.status === "approved") {
      await pool.query("COMMIT");
      return {
        ok: true,
        status: "approved",
        credited: false,
        message: "Transação já estava aprovada.",
      };
    }

    const purpose =
      String(lockedTx.purpose || "CHIPS").toUpperCase();

    if (purpose === "CASH") {
      const amount = Number(lockedTx.amount_cents || 0) / 100;

      if (amount <= 0) {
        throw new Error("Valor de depósito CASH inválido.");
      }

      const userResult = await pool.query(
        `
        SELECT cash_balance
        FROM users
        WHERE id = $1
        FOR UPDATE
        `,
        [lockedTx.user_id]
      );

      const user = userResult.rows[0];

      if (!user) {
        throw new Error("Usuário do depósito não encontrado.");
      }

      const balanceBefore =
        Number(user.cash_balance) || 0;

      const balanceAfter =
        Number((balanceBefore + amount).toFixed(2));

      await pool.query(
        `
        UPDATE users
        SET cash_balance = $1,
            updated_at = NOW()
        WHERE id = $2
        `,
        [
          balanceAfter,
          lockedTx.user_id
        ]
      );

      await pool.query(
        `
        INSERT INTO cash_transactions (
          user_id,
          type,
          status,
          amount,
          balance_before,
          balance_after,
          reference_type,
          reference_id,
          provider,
          provider_transaction_id,
          description
        )
        VALUES (
          $1,
          'DEPOSIT',
          'COMPLETED',
          $2,
          $3,
          $4,
          'WALLET_DEPOSIT',
          $5,
          'mercado_pago',
          $6,
          $7
        )
        `,
        [
          lockedTx.user_id,
          amount,
          balanceBefore,
          balanceAfter,
          String(lockedTx.id),
          String(lockedTx.provider_payment_id || ""),
          `Depósito PIX aprovado - R$ ${amount.toFixed(2)}`
        ]
      );

    } else {
          await pool.query(
            `
            UPDATE users
            SET chips_balance = COALESCE(chips_balance, 0) + $1,
                updated_at = NOW()
            WHERE id = $2
            `,
            [lockedTx.chips_amount, lockedTx.user_id]
          );
        }

    await pool.query(
      `
      UPDATE wallet_transactions
      SET status = 'approved',
          updated_at = NOW()
      WHERE id = $1
      `,
      [lockedTx.id]
    );

    await pool.query("COMMIT");

    return {
      ok: true,
      status: "approved",
      credited: true,
      purpose,
      chips:
        purpose === "CHIPS"
          ? Number(lockedTx.chips_amount) || 0
          : 0,
      amount:
        purpose === "CASH"
          ? Number(lockedTx.amount_cents || 0) / 100
          : 0,
      userId: lockedTx.user_id,
      message:
        purpose === "CASH"
          ? "Pagamento aprovado e saldo em dinheiro creditado."
          : "Pagamento aprovado e fichas creditadas.",
    };

  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}


router.get("/deposit/:transactionId/status", requireAuth, async (req, res) => {
  try {
    const transactionId = Number(req.params.transactionId);

    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Transação inválida.",
      });
    }

    const txResult = await pool.query(
      `
      SELECT *
      FROM wallet_transactions
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      [transactionId, req.auth.userId]
    );

    const tx = txResult.rows[0];

    if (!tx) {
      return res.status(404).json({
        ok: false,
        message: "Transação não encontrada.",
      });
    }

    if (tx.status === "approved") {
      const purpose =
        String(tx.purpose || "CHIPS").toUpperCase();

      return res.json({
        ok: true,
        status: "approved",
        credited: true,
        purpose,
        chips:
          purpose === "CHIPS"
            ? Number(tx.chips_amount) || 0
            : 0,
        amount:
          purpose === "CASH"
            ? Number(tx.amount_cents || 0) / 100
            : 0,
        message:
          purpose === "CASH"
            ? "Pagamento já aprovado. Saldo em dinheiro creditado."
            : "Pagamento já aprovado.",
      });
    }

    if (!tx.provider_payment_id) {
      return res.status(400).json({
        ok: false,
        message: "Pagamento ainda não foi gerado.",
      });
    }

    const mpPayment = await getPaymentById(tx.provider_payment_id);
    const mpStatus = String(mpPayment?.status || "unknown");


    if (mpStatus !== "approved") {
      await pool.query(
        `
        UPDATE wallet_transactions
        SET status = $2, updated_at = NOW()
        WHERE id = $1 AND status <> 'approved'
        `,
        [tx.id, mpStatus]
      );

      return res.json({
        ok: true,
        status: mpStatus,
        credited: false,
        message: "Pagamento ainda não aprovado.",
      });
    }

    const mpExternalReference =
      String(mpPayment?.external_reference || "");

    const mpAmount =
      Number(mpPayment?.transaction_amount || 0);

    const expectedAmount =
      Number(tx.amount_cents || 0) / 100;

    if (mpExternalReference !== String(tx.id)) {
      return res.status(400).json({
        ok: false,
        status: mpStatus,
        credited: false,
        message: "Referência do pagamento não corresponde à transação.",
      });
    }

    if (
      !Number.isFinite(mpAmount) ||
      Math.abs(mpAmount - expectedAmount) > 0.001
    ) {
      return res.status(400).json({
        ok: false,
        status: mpStatus,
        credited: false,
        message: "Valor do pagamento não corresponde à transação.",
      });
    }

    await pool.query("BEGIN");

    const lockResult = await pool.query(
      `
      SELECT *
      FROM wallet_transactions
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
      `,
      [tx.id, req.auth.userId]
    );

    const lockedTx = lockResult.rows[0];

    if (!lockedTx) {
      await pool.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Transação não encontrada.",
      });
    }

    if (lockedTx.status === "approved") {
      const purpose =
        String(lockedTx.purpose || "CHIPS").toUpperCase();

      await pool.query("COMMIT");

      return res.json({
        ok: true,
        status: "approved",
        credited: true,
        purpose,
        chips:
          purpose === "CHIPS"
            ? Number(lockedTx.chips_amount) || 0
            : 0,
        amount:
          purpose === "CASH"
            ? Number(lockedTx.amount_cents || 0) / 100
            : 0,
        message:
          purpose === "CASH"
            ? "Pagamento já aprovado. Saldo em dinheiro creditado."
            : "Pagamento já aprovado.",
      });
    }

    const purpose =
      String(lockedTx.purpose || "CHIPS").toUpperCase();

    if (purpose === "CASH") {
      const amount = Number(lockedTx.amount_cents || 0) / 100;

      if (amount <= 0) {
        throw new Error("Valor de depósito CASH inválido.");
      }

      const userResult = await pool.query(
        `
        SELECT cash_balance
        FROM users
        WHERE id = $1
        FOR UPDATE
        `,
        [lockedTx.user_id]
      );

      const user = userResult.rows[0];

      if (!user) {
        throw new Error("Usuário do depósito não encontrado.");
      }

      const balanceBefore =
        Number(user.cash_balance) || 0;

      const balanceAfter =
        Number((balanceBefore + amount).toFixed(2));

      await pool.query(
        `
        UPDATE users
        SET cash_balance = $1,
            updated_at = NOW()
        WHERE id = $2
        `,
        [
          balanceAfter,
          lockedTx.user_id
        ]
      );

      await pool.query(
        `
        INSERT INTO cash_transactions (
          user_id,
          type,
          status,
          amount,
          balance_before,
          balance_after,
          reference_type,
          reference_id,
          provider,
          provider_transaction_id,
          description
        )
        VALUES (
          $1,
          'DEPOSIT',
          'COMPLETED',
          $2,
          $3,
          $4,
          'WALLET_DEPOSIT',
          $5,
          'mercado_pago',
          $6,
          $7
        )
        `,
        [
          lockedTx.user_id,
          amount,
          balanceBefore,
          balanceAfter,
          String(lockedTx.id),
          String(lockedTx.provider_payment_id || ""),
          `Depósito PIX aprovado - R$ ${amount.toFixed(2)}`
        ]
      );

    } else {
      await pool.query(
        `
        UPDATE users
        SET chips_balance = COALESCE(chips_balance, 0) + $1,
            updated_at = NOW()
        WHERE id = $2
        `,
        [lockedTx.chips_amount, lockedTx.user_id]
      );
    }

    await pool.query(
      `
      UPDATE wallet_transactions
      SET status = 'approved',
          updated_at = NOW()
      WHERE id = $1
      `,
      [lockedTx.id]
    );

    await pool.query("COMMIT");

    return res.json({
      ok: true,
      status: "approved",
      credited: true,
      purpose,
      chips:
        purpose === "CHIPS"
          ? Number(lockedTx.chips_amount) || 0
          : 0,
      amount:
        purpose === "CASH"
          ? Number(lockedTx.amount_cents || 0) / 100
          : 0,
      message:
        purpose === "CASH"
          ? "Pagamento aprovado. Saldo em dinheiro creditado."
          : "Pagamento aprovado. Fichas creditadas.",
    });

  } catch (err) {
    try {
      await pool.query("ROLLBACK");
    } catch {}

    console.error("GET /wallet/deposit/:transactionId/status error:", err);

    return res.status(500).json({
      ok: false,
      message: "Erro ao consultar pagamento.",
    });
  }
});



// =========================================================
// SAQUE — CRIAR SOLICITAÇÃO
// =========================================================
router.post("/withdraw", requireAuth, async (req, res) => {
  try {
    const userId = Number(req.auth?.userId || req.auth?.id);

    const {
      amount,
      pixKeyType,
      pixKey,
    } = req.body || {};

    const result = await createWithdrawalRequest({
      userId,
      amount,
      pixKeyType,
      pixKey,
    });

    return res.json({
      ok: true,
      withdrawal: result,
    });
  } catch (err) {
    console.error("[WALLET] Erro ao solicitar saque:", err);

    return res.status(400).json({
      ok: false,
      error: err.message || "Não foi possível solicitar o saque.",
    });
  }
});


module.exports = router;