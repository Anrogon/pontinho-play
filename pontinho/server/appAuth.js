require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const pool = require("./config/db");

const app = express();
const walletRoutes = require("./routes/wallet");
const adminFinanceRoutes = require("./routes/adminFinance");
const { finalizePendingMonthlyRankings} = require("./services/monthlyRankingService"
);

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use("/api/wallet", walletRoutes);
app.use("/api/admin/finance", adminFinanceRoutes);

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.json({ ok: true, db: "up" });
  } catch (err) {
    console.error("Health check DB error:", err);
    return res.status(500).json({ ok: false, db: "down" });
  }
});

async function checkPendingMonthlyRankings() {
  try {
    const result =
      await finalizePendingMonthlyRankings(
        "PONTINHO"
      );

    if (
      Number(result.rewardedPlayers) > 0
    ) {
      console.log(
        "[AUTH] Rankings mensais pendentes processados:",
        {
          processedMonths:
            result.processedMonths,

          processedPlayers:
            result.processedPlayers,

          rewardedPlayers:
            result.rewardedPlayers,

          totalChipsPaid:
            result.totalChipsPaid,

          totalLuckyCardsPaid:
            result.totalLuckyCardsPaid
        }
      );
    } else {
      console.log(
        "[AUTH] Nenhum ranking mensal pendente."
      );
    }
  } catch (error) {
    /*
     * O Auth Server deve continuar funcionando mesmo
     * se o fechamento mensal falhar. O sistema tentará
     * novamente na próxima reinicialização.
     */
    console.error(
      "[AUTH] Erro ao verificar rankings mensais pendentes:",
      error
    );
  }
}

app.use("/api/auth", authRoutes);

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
  console.log(
    `Auth server rodando em http://localhost:${PORT}`
  );

  checkPendingMonthlyRankings();
});