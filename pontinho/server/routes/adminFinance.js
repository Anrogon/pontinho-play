const express = require("express");
const pool = require("../config/db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { cancelWithdrawal, completeWithdrawal } = require("../services/cashWalletService");

const router = express.Router();

router.get("/summary", requireAuth, requireAdmin, async (req, res) => {
  try {
    const summaryResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE type = 'deposit') AS total_deposits,
        COUNT(*) FILTER (WHERE type = 'deposit' AND status = 'approved') AS approved_deposits,
        COUNT(*) FILTER (WHERE type = 'deposit' AND status = 'pending') AS pending_deposits,
        COALESCE(SUM(amount_cents) FILTER (WHERE type = 'deposit' AND status = 'approved'), 0) AS approved_amount_cents,
        COALESCE(SUM(chips_amount) FILTER (WHERE type = 'deposit' AND status = 'approved'), 0) AS approved_chips
      FROM wallet_transactions
    `);

    const todayResult = await pool.query(`
      SELECT
        COALESCE(SUM(amount_cents), 0) AS today_amount_cents,
        COALESCE(SUM(chips_amount), 0) AS today_chips
      FROM wallet_transactions
      WHERE type = 'deposit'
        AND status = 'approved'
        AND created_at::date = CURRENT_DATE
    `);

    const totalRevenueResult = await pool.query(`
        SELECT
            COALESCE(SUM(amount_cents), 0) AS total_amount_cents
        FROM wallet_transactions
        WHERE type = 'deposit'
            AND status = 'approved'
    `);

    const recentResult = await pool.query(`
      SELECT
        wt.id,
        wt.user_id,
        u.username,
        u.email,
        wt.type,
        wt.status,
        wt.amount_cents,
        wt.chips_amount,
        wt.provider,
        wt.provider_payment_id,
        wt.created_at,
        wt.updated_at
      FROM wallet_transactions wt
      LEFT JOIN users u ON u.id = wt.user_id
      ORDER BY wt.created_at DESC
      LIMIT 50
    `);

    return res.json({
        ok: true,
        summary: summaryResult.rows[0],
        today: todayResult.rows[0],
        revenue: totalRevenueResult.rows[0],
        transactions: recentResult.rows,
    });
  } catch (err) {
    console.error("GET /admin/finance/summary error:", err);

    return res.status(500).json({
      ok: false,
      message: "Erro ao carregar financeiro.",
    });
  }
});


// =========================================================
// SAQUES — LISTAR PENDENTES
// =========================================================
router.get("/withdrawals/pending", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        wr.id,
        wr.user_id,
        u.username,
        u.email,
        wr.amount,
        wr.pix_key_type,
        wr.pix_key,
        wr.status,
        wr.requested_at
      FROM withdrawal_requests wr
      LEFT JOIN users u ON u.id = wr.user_id
      WHERE wr.status = 'PENDING'
      ORDER BY wr.requested_at ASC
    `);

    return res.json({
      ok: true,
      withdrawals: result.rows,
    });
  } catch (err) {
    console.error("GET /admin/finance/withdrawals/pending error:", err);

    return res.status(500).json({
      ok: false,
      message: "Erro ao carregar saques pendentes.",
    });
  }
});

// =========================================================
// SAQUES — CANCELAR SOLICITAÇÃO
// =========================================================
router.post(
  "/withdrawals/:withdrawalId/cancel",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const withdrawalId = Number(req.params.withdrawalId);

      const adminNote =
        req.body?.adminNote != null
          ? String(req.body.adminNote).trim()
          : null;

      const result = await cancelWithdrawal({
        withdrawalId,
        adminNote,
      });

      return res.json({
        ok: true,
        withdrawal: result,
      });

    } catch (err) {
      console.error(
        "POST /admin/finance/withdrawals/:withdrawalId/cancel error:",
        err
      );

      return res.status(400).json({
        ok: false,
        message:
          err.message ||
          "Não foi possível cancelar a solicitação de saque.",
      });
    }
  }
);

// =========================================================
// SAQUES — CONCLUIR SOLICITAÇÃO
// =========================================================
router.post(
  "/withdrawals/:withdrawalId/complete",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const withdrawalId = Number(req.params.withdrawalId);

      const adminNote =
        req.body?.adminNote != null
          ? String(req.body.adminNote).trim()
          : null;

      const result = await completeWithdrawal({
        withdrawalId,
        adminNote,
      });

      return res.json({
        ok: true,
        withdrawal: result,
      });

    } catch (err) {
      console.error(
        "POST /admin/finance/withdrawals/:withdrawalId/complete error:",
        err
      );

      return res.status(400).json({
        ok: false,
        message:
          err.message ||
          "Não foi possível concluir a solicitação de saque.",
      });
    }
  }
);

module.exports = router;