const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:3001/api"
    : "/api";

const AVATAR_LIST = Array.from({ length: 35 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return `/assets/avatars/avatar-${n}.png`;
});

let currentAvatarIndex = 0;

function setMsg(text, isError = false) {
  const el = document.getElementById("profileMsg");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isError ? "#ffb3b3" : "#ffd38a";
}

function saveLocalUser(user) {
  localStorage.setItem("pontinhoAuthUser", JSON.stringify(user || {}));

  const username = String(user?.username || user?.name || "").trim();
  const avatarUrl = String(user?.avatarUrl || user?.avatar_url || "").trim();

  if (username) {
    localStorage.setItem("pontinhoPlayerName", username);
  } else {
    localStorage.removeItem("pontinhoPlayerName");
  }

  if (avatarUrl) {
    localStorage.setItem("pontinhoAvatarUrl", avatarUrl);
  } else {
    localStorage.removeItem("pontinhoAvatarUrl");
  }
}

function clearLocalAuth() {
  localStorage.removeItem("pontinhoAuthUser");
  localStorage.removeItem("pontinhoPlayerName");
  localStorage.removeItem("pontinhoAvatarUrl");
}

function formatBalance(value) {
  return (Number(value) || 0).toLocaleString("pt-BR");
}

function formatDate(value) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("pt-BR");
}


function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatProfitLoss(totalProfit, totalLoss) {
  const profit = Number(totalProfit) || 0;
  const loss = Number(totalLoss) || 0;
  const net = profit - loss;

  const signal = net > 0 ? "+" : "";
  return `${signal}${net.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}


function updateCarouselUI() {
  const selectedUrl = AVATAR_LIST[currentAvatarIndex] || AVATAR_LIST[0];

  const preview = document.getElementById("carouselAvatarPreview");
  const label = document.getElementById("carouselAvatarLabel");

  if (preview) preview.src = selectedUrl;
  if (label) label.textContent = `Avatar ${String(currentAvatarIndex + 1).padStart(2, "0")}`;
}

function updateMainAvatar(url) {
  const img = document.getElementById("profileAvatar");
  if (!img) return;
  img.src = url || AVATAR_LIST[0];
}

function findAvatarIndex(url) {
  const idx = AVATAR_LIST.indexOf(url);
  return idx >= 0 ? idx : 0;
}

async function loadProfile() {
  setMsg("Carregando perfil...");

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: "GET",
      credentials: "include",
    });

    const data = await res.json().catch(() => null);

    if (res.status === 401) {
      setMsg("Sessão inválida. Faça login novamente.", true);
      setTimeout(() => {
        window.location.href = "./login.html";
      }, 900);
      return;
    }

    if (!res.ok || !data?.ok || !data?.user) {
      setMsg(data?.message || "Não foi possível carregar o perfil.", true);
      return;
    }

    const user = data.user;
    saveLocalUser(user);

    document.getElementById("profileUsername").textContent = user.username || "—";
    document.getElementById("profileEmail").textContent = user.email || "—";
    document.getElementById("profileBalance").textContent = formatBalance(user.chipsBalance);
    document.getElementById("profileCashBalance").textContent =
      (Number(user.cashBalance) || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });

      const withdrawCashBalance = document.getElementById("withdrawCashBalance");

      if (withdrawCashBalance) {
        withdrawCashBalance.textContent =
          (Number(user.cashBalance) || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
          });
      }

    document.getElementById("profileCreatedAt").textContent = formatDate(user.createdAt);

    document.getElementById("profileAccountType").textContent =
      user.is_admin === true || user.is_admin === 1 ? "Administrador" : "Jogador";

    document.getElementById("profileAccountStatus").textContent =
      user.is_blocked === true || user.is_blocked === 1 ? "Bloqueada" : "Ativa";

    document.getElementById("profileStatsBalance").textContent =
    formatBalance(user.chipsBalance);

    document.getElementById("profileStatsMemberSince").textContent =
    formatDate(user.createdAt);

    const avatarUrl = user.avatarUrl || localStorage.getItem("pontinhoAvatarUrl") || AVATAR_LIST[0];
    currentAvatarIndex = findAvatarIndex(avatarUrl);

    updateMainAvatar(avatarUrl);
    updateCarouselUI();

    await loadProfileStats();
    await loadWalletHistory();

    setMsg("Perfil carregado com sucesso.");
  } catch (err) {
    console.error("Erro ao carregar perfil:", err);
    setMsg(`Erro ao carregar perfil. (${err.message})`, true);
  }
}

async function loadProfileStats() {
  try {
    const res = await fetch(`${API_BASE}/auth/me/stats`, {
      method: "GET",
      credentials: "include",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok || !data?.stats) {
      document.getElementById("profileGamesPlayed").textContent = "—";
      document.getElementById("profileWins").textContent = "—";
      document.getElementById("profileLosses").textContent = "—";
      document.getElementById("profileWinRate").textContent = "—";
      document.getElementById("profileProfitLoss").textContent = "—";
      return;
    }

    const stats = data.stats;
    const matchesPlayed = Number(stats.matchesPlayed) || 0;
    const wins = Number(stats.wins) || 0;
    const losses = Number(stats.losses) || 0;
    const totalProfit = Number(stats.totalProfit) || 0;
    const totalLoss = Number(stats.totalLoss) || 0;

    const winRate = matchesPlayed > 0 ? (wins / matchesPlayed) * 100 : 0;

    document.getElementById("profileGamesPlayed").textContent = String(matchesPlayed);
    document.getElementById("profileWins").textContent = String(wins);
    document.getElementById("profileLosses").textContent = String(losses);
    document.getElementById("profileWinRate").textContent = formatPercent(winRate);
    document.getElementById("profileProfitLoss").textContent = formatProfitLoss(totalProfit, totalLoss);
  } catch (err) {
    console.error("Erro ao carregar estatísticas do perfil:", err);

    document.getElementById("profileGamesPlayed").textContent = "—";
    document.getElementById("profileWins").textContent = "—";
    document.getElementById("profileLosses").textContent = "—";
    document.getElementById("profileWinRate").textContent = "—";
    document.getElementById("profileProfitLoss").textContent = "—";
  }
}

function formatMoneyFromCents(cents) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getWalletStatusLabel(status) {
  const s = String(status || "").toLowerCase();

  if (s === "approved") return "Aprovado";
  if (s === "pending") return "Pendente";
  if (s === "cancelled" || s === "canceled") return "Cancelado";
  if (s === "rejected") return "Recusado";

  return status || "—";
}

async function loadWalletHistory() {
  const el = document.getElementById("profileWalletHistory");
  if (!el) return;

  el.innerHTML = `<div class="wallet-history-empty">Carregando histórico...</div>`;

  try {
    const res = await fetch(`${API_BASE}/wallet/history`, {
      method: "GET",
      credentials: "include",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      el.innerHTML = `<div class="wallet-history-empty">Não foi possível carregar o histórico.</div>`;
      return;
    }

    const transactions = Array.isArray(data.transactions)
      ? data.transactions
      : [];

    if (!transactions.length) {
      el.innerHTML = `<div class="wallet-history-empty">Nenhuma transação financeira ainda.</div>`;
      return;
    }

    el.innerHTML = transactions.map(t => {
      const status = String(t.status || "").toLowerCase();
      const category = String(t.category || "CHIPS").toUpperCase();
      const type = String(t.type || "").toUpperCase();

      const statusClass =
        status === "approved" || status === "completed" ? "approved" :
        status === "pending" ? "pending" :
        "other";

      let typeLabel = "Transação";
      let detailLabel = "";
      let valueLabel = "";

      // ===================================================
      // FICHAS
      // ===================================================
      if (category === "CHIPS") {
        typeLabel =
          type === "DEPOSIT" ? "Depósito PIX" :
          type === "WITHDRAW" ? "Saque" :
          t.type || "Transação";

        detailLabel =
          `${Number(t.chips_amount || 0).toLocaleString("pt-BR")} fichas`;

        valueLabel = formatMoneyFromCents(t.amount_cents);
      }

      // ===================================================
      // DINHEIRO REAL
      // ===================================================
      else if (category === "CASH") {
        typeLabel =
          type === "DEPOSIT" ? "Depósito" :
          type === "WITHDRAWAL" ? "Saque" :
          type === "COMPETITION_ENTRY" ? "Inscrição - Competição" :
          type === "COMPETITION_REENTRY" ? "Reentrada - Competição" :
          type === "COMPETITION_PRIZE" ? "Prêmio - Competição" :
          t.type || "Transação";

        const cashAmount = Number(t.cash_amount) || 0;

        valueLabel = Math.abs(cashAmount).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });

        if (type === "WITHDRAWAL" && status === "cancelled") {
          detailLabel = "Saque cancelado";
        } else {
          detailLabel =
            cashAmount > 0
              ? "Crédito em dinheiro"
              : cashAmount < 0
                ? "Débito em dinheiro"
                : "Movimentação em dinheiro";
        }
      }

      return `
        <div class="wallet-history-item">
          <div>
            <strong>${typeLabel}</strong>
            <span>${detailLabel}</span>
          </div>

          <div>
            <span class="wallet-status ${statusClass}">
              ${getWalletStatusLabel(t.status)}
            </span>

            <small>
              ${valueLabel} · ${formatDate(t.created_at)}
            </small>
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("Erro ao carregar histórico financeiro:", err);

    el.innerHTML =
      `<div class="wallet-history-empty">Erro ao carregar histórico financeiro.</div>`;
  }
}

async function saveAvatar() {
  const selectedAvatarUrl = AVATAR_LIST[currentAvatarIndex] || AVATAR_LIST[0];

  setMsg("Salvando avatar...");

  try {
    const res = await fetch(`${API_BASE}/auth/me/avatar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        avatarUrl: selectedAvatarUrl,
      }),
    });

    const data = await res.json().catch(() => null);

    if (res.status === 401) {
      setMsg("Sessão inválida. Faça login novamente.", true);
      setTimeout(() => {
        window.location.href = "./login.html";
      }, 900);
      return;
    }

    if (!res.ok || !data?.ok || !data?.user) {
      setMsg(data?.message || `Não foi possível salvar o avatar. (HTTP ${res.status})`, true);
      return;
    }

    saveLocalUser(data.user);
    updateMainAvatar(selectedAvatarUrl);
    setMsg("Avatar atualizado com sucesso.");
  } catch (err) {
    console.error("Erro ao salvar avatar:", err);
    setMsg(`Erro ao salvar avatar. (${err.message})`, true);
  }
}


async function requestWithdrawal() {
  const amountRaw =
    document.getElementById("withdrawAmount")?.value.trim() || "";

  const pixKeyType =
    document.getElementById("withdrawPixKeyType")?.value || "";

  const pixKey =
    document.getElementById("withdrawPixKey")?.value.trim() || "";

  const withdrawMsg = document.getElementById("withdrawMsg");
  const btnConfirmWithdraw = document.getElementById("btnConfirmWithdraw");

  // Aceita tanto 20,50 quanto 20.50
  const amount = Number(
    amountRaw
      .replace(/\s/g, "")
      .replace(",", ".")
  );

  if (!Number.isFinite(amount) || amount <= 0) {
    if (withdrawMsg) {
      withdrawMsg.textContent = "Informe um valor de saque válido.";
    }
    return;
  }

  if (!pixKeyType) {
    if (withdrawMsg) {
      withdrawMsg.textContent = "Selecione o tipo da chave PIX.";
    }
    return;
  }

  if (!pixKey) {
    if (withdrawMsg) {
      withdrawMsg.textContent = "Informe a chave PIX.";
    }
    return;
  }

  if (withdrawMsg) {
    withdrawMsg.textContent = "Enviando solicitação de saque...";
  }

  if (btnConfirmWithdraw) {
    btnConfirmWithdraw.disabled = true;
  }

  try {
    const res = await fetch(`${API_BASE}/wallet/withdraw`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        amount,
        pixKeyType,
        pixKey,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      if (withdrawMsg) {
        withdrawMsg.textContent =
          data?.error ||
          data?.message ||
          `Não foi possível solicitar o saque. (HTTP ${res.status})`;
      }
      return;
    }

    if (withdrawMsg) {
      withdrawMsg.textContent =
        "Solicitação de saque enviada com sucesso.";
    }

  } catch (err) {
    console.error("Erro ao solicitar saque:", err);

    if (withdrawMsg) {
      withdrawMsg.textContent =
        `Erro ao solicitar saque. (${err.message})`;
    }
  } finally {
    if (btnConfirmWithdraw) {
      btnConfirmWithdraw.disabled = false;
    }
  }
}


async function changePassword() {
  const currentPassword = document.getElementById("currentPassword")?.value || "";
  const newPassword = document.getElementById("newPassword")?.value || "";
  const confirmPassword = document.getElementById("confirmPassword")?.value || "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    setMsg("Preencha a senha atual, a nova senha e a confirmação.", true);
    return;
  }

  if (newPassword.length < 4) {
    setMsg("A nova senha deve ter pelo menos 4 caracteres.", true);
    return;
  }

  if (newPassword !== confirmPassword) {
    setMsg("A confirmação da nova senha não confere.", true);
    return;
  }

  setMsg("Alterando senha...");

  try {
    const res = await fetch(`${API_BASE}/auth/me/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmPassword,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      setMsg(data?.message || `Não foi possível alterar a senha. (HTTP ${res.status})`, true);
      return;
    }

    clearLocalAuth();
    setMsg("Senha alterada com sucesso. Faça login novamente.");

    setTimeout(() => {
      window.location.href = "./login.html";
    }, 1000);
  } catch (err) {
    console.error("Erro ao alterar senha:", err);
    setMsg(`Erro ao alterar senha. (${err.message})`, true);
  }
}

async function deleteAccount() {
  const currentPassword =
    document.getElementById("deleteAccountPassword")?.value || "";

  if (!currentPassword) {
    setMsg("Digite sua senha atual para confirmar a exclusão.", true);
    return;
  }

  const confirmed = window.confirm(
    "Tem certeza de que deseja excluir sua conta?\n\n" +
    "Esta ação é permanente e não poderá ser desfeita."
  );

  if (!confirmed) {
    return;
  }

  setMsg("Excluindo conta...");

  const button = document.getElementById("btnDeleteAccount");

  if (button) {
    button.disabled = true;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/me/delete-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        currentPassword,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      setMsg(
        data?.message ||
          `Não foi possível excluir a conta. (HTTP ${res.status})`,
        true
      );

      if (button) {
        button.disabled = false;
      }

      return;
    }

    clearLocalAuth();

    setMsg("Conta excluída com sucesso.");

    setTimeout(() => {
      window.location.href = "./login.html";
    }, 1200);
  } catch (err) {
    console.error("Erro ao excluir conta:", err);

    setMsg(
      `Erro ao excluir conta. (${err.message})`,
      true
    );

    if (button) {
      button.disabled = false;
    }
  }
}



function bindEvents() {
  document.getElementById("btnPrevAvatar")?.addEventListener("click", () => {
    currentAvatarIndex = (currentAvatarIndex - 1 + AVATAR_LIST.length) % AVATAR_LIST.length;
    updateCarouselUI();
  });

  document.getElementById("btnNextAvatar")?.addEventListener("click", () => {
    currentAvatarIndex = (currentAvatarIndex + 1) % AVATAR_LIST.length;
    updateCarouselUI();
  });

  document.getElementById("btnSaveAvatar")?.addEventListener("click", saveAvatar);
  document.getElementById("btnChangePassword")?.addEventListener("click", changePassword);
  document.getElementById("btnDeleteAccount")?.addEventListener("click", deleteAccount);

  /*document.getElementById("btnGoSettings")?.addEventListener("click", () => {
    alert("Configurações do perfil podem entrar aqui depois.");
  });*/

  document.getElementById("btnBackHome")?.addEventListener("click", () => {
    window.location.href = "./index.html";
  });

  const btnWithdrawCash = document.getElementById("btnWithdrawCash");
  const btnCancelWithdraw = document.getElementById("btnCancelWithdraw");
  const withdrawForm = document.getElementById("withdrawForm");

  if (btnWithdrawCash && withdrawForm) {
    btnWithdrawCash.onclick = () => {
      withdrawForm.style.display = "block";
      btnWithdrawCash.style.display = "none";
    };
  }

  if (btnCancelWithdraw && withdrawForm) {
    btnCancelWithdraw.onclick = () => {
      withdrawForm.style.display = "none";

      if (btnWithdrawCash) {
        btnWithdrawCash.style.display = "";
      }

      const withdrawAmount = document.getElementById("withdrawAmount");
      const withdrawPixKeyType = document.getElementById("withdrawPixKeyType");
      const withdrawPixKey = document.getElementById("withdrawPixKey");
      const withdrawMsg = document.getElementById("withdrawMsg");

      if (withdrawAmount) withdrawAmount.value = "";
      if (withdrawPixKeyType) withdrawPixKeyType.value = "";
      if (withdrawPixKey) withdrawPixKey.value = "";
      if (withdrawMsg) withdrawMsg.textContent = "";
    };
  }

  const btnConfirmWithdraw =
    document.getElementById("btnConfirmWithdraw");

  if (btnConfirmWithdraw) {
    btnConfirmWithdraw.onclick = requestWithdrawal;
  }


}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadProfile();
});