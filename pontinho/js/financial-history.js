const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:3001/api"
    : "/api";

const PAGE_LIMIT = 20;

let currentPage = 1;
let totalPages = 0;
let currentStartDate = "";
let currentEndDate = "";

// =========================================================
// FORMATAÇÃO
// =========================================================

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("pt-BR");
}

function formatMoneyFromCents(cents) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatCash(value) {
  return Math.abs(Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getStatusLabel(status) {
  const value = String(status || "").toLowerCase();

  if (value === "approved") return "Aprovado";
  if (value === "completed") return "Concluído";
  if (value === "pending") return "Pendente";

  if (
    value === "cancelled" ||
    value === "canceled"
  ) {
    return "Cancelado";
  }

  if (value === "rejected") return "Recusado";

  return status || "—";
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();

  if (
    value === "approved" ||
    value === "completed"
  ) {
    return "approved";
  }

  if (value === "pending") {
    return "pending";
  }

  if (
    value === "cancelled" ||
    value === "canceled"
  ) {
    return "cancelled";
  }

  return "";
}

// =========================================================
// OPERAÇÃO
// =========================================================

function getOperationLabel(transaction) {
  const category =
    String(transaction.category || "CHIPS").toUpperCase();

  const type =
    String(transaction.type || "").toUpperCase();

  if (category === "CASH") {
    if (type === "DEPOSIT") {
      return "Depósito";
    }

    if (type === "WITHDRAWAL") {
      return "Saque";
    }

    if (type === "COMPETITION_ENTRY") {
      return "Inscrição - Competição";
    }

    if (type === "COMPETITION_REENTRY") {
      return "Reentrada - Competição";
    }

    if (type === "COMPETITION_PRIZE") {
      return "Prêmio - Competição";
    }
  }

  if (category === "CHIPS") {
    if (type === "DEPOSIT") {
      return "Compra de fichas";
    }

    if (type === "WITHDRAW") {
      return "Resgate de fichas";
    }
  }

  return transaction.type || "Transação";
}

// =========================================================
// CATEGORIA
// =========================================================

function getCategoryLabel(transaction) {
  const category =
    String(transaction.category || "CHIPS").toUpperCase();

  if (category === "CASH") {
    return "Dinheiro";
  }

  if (category === "CHIPS") {
    return "Fichas";
  }

  return category || "—";
}

// =========================================================
// VALOR
// =========================================================

function getValueLabel(transaction) {
  const category =
    String(transaction.category || "CHIPS").toUpperCase();

  if (category === "CASH") {
    return formatCash(transaction.cash_amount);
  }

  return formatMoneyFromCents(transaction.amount_cents);
}

// =========================================================
// RENDERIZAÇÃO
// =========================================================

function renderTransactions(transactions) {
  const tbody =
    document.getElementById("financialHistoryTableBody");

  if (!tbody) return;

  if (!Array.isArray(transactions) || !transactions.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="financial-history-empty">
            Nenhuma movimentação financeira encontrada.
          </div>
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = transactions.map(transaction => {
    const statusClass =
      getStatusClass(transaction.status);

    return `
      <tr>
        <td>
          ${formatDate(transaction.created_at)}
        </td>

        <td>
          ${getOperationLabel(transaction)}
        </td>

        <td>
          ${getCategoryLabel(transaction)}
        </td>

        <td>
          ${getValueLabel(transaction)}
        </td>

        <td>
          <span class="financial-status ${statusClass}">
            ${getStatusLabel(transaction.status)}
          </span>
        </td>
      </tr>
    `;
  }).join("");
}

// =========================================================
// PAGINAÇÃO
// =========================================================

function renderPagination(pagination) {
  const previousButton =
    document.getElementById("btnFinancialPrevious");

  const nextButton =
    document.getElementById("btnFinancialNext");

  const pageInfo =
    document.getElementById("financialHistoryPageInfo");

  const summary =
    document.getElementById("financialHistorySummary");

  const page =
    Number(pagination?.page) || 1;

  const total =
    Number(pagination?.total) || 0;

  const pages =
    Number(pagination?.totalPages) || 0;

  currentPage = page;
  totalPages = pages;

  if (pageInfo) {
    pageInfo.textContent =
      pages > 0
        ? `Página ${page} de ${pages}`
        : "Página 0 de 0";
  }

  if (summary) {
    summary.textContent =
      total === 1
        ? "1 movimentação"
        : `${total.toLocaleString("pt-BR")} movimentações`;
  }

  if (previousButton) {
    previousButton.disabled =
      page <= 1 || pages === 0;
  }

  if (nextButton) {
    nextButton.disabled =
      pages === 0 || page >= pages;
  }
}

// =========================================================
// CARREGAR HISTÓRICO
// =========================================================

async function loadFinancialHistory(page = 1) {
  const tbody =
    document.getElementById("financialHistoryTableBody");

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="financial-history-empty">
            Carregando histórico financeiro...
          </div>
        </td>
      </tr>
    `;
  }

  try {
    const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT),
        });

        if (currentStartDate) {
        params.set("startDate", currentStartDate);
        }

        if (currentEndDate) {
        params.set("endDate", currentEndDate);
        }

        const res = await fetch(
        `${API_BASE}/wallet/history?${params.toString()}`,
        {
            method: "GET",
            credentials: "include",
        }
        );

    if (res.status === 401) {
      window.location.href = "./login.html";
      return;
    }

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      throw new Error(
        data?.message ||
        "Não foi possível carregar o histórico."
      );
    }

    renderTransactions(data.transactions);
    renderPagination(data.pagination);

  } catch (err) {
    console.error(
      "Erro ao carregar histórico financeiro:",
      err
    );

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="financial-history-empty">
              Não foi possível carregar o histórico financeiro.
            </div>
          </td>
        </tr>
      `;
    }
  }
}

// =========================================================
// EVENTOS
// =========================================================

function bindEvents() {
  const previousButton =
    document.getElementById("btnFinancialPrevious");

  const nextButton =
    document.getElementById("btnFinancialNext");

  const backButton =
    document.getElementById("btnFinancialBackProfile");

    const filterButton =
    document.getElementById("btnFinancialFilter");

    const clearFilterButton =
    document.getElementById("btnFinancialClearFilter");

    const startDateInput =
    document.getElementById("financialStartDate");

    const endDateInput =
    document.getElementById("financialEndDate");

  previousButton?.addEventListener("click", () => {
    if (currentPage <= 1) return;

    loadFinancialHistory(currentPage - 1);
  });

  nextButton?.addEventListener("click", () => {
    if (
      totalPages === 0 ||
      currentPage >= totalPages
    ) {
      return;
    }

    loadFinancialHistory(currentPage + 1);
  });

  backButton?.addEventListener("click", () => {
    window.location.href = "./profile.html";
  });

  filterButton?.addEventListener("click", () => {
  const startDate = startDateInput?.value || "";
  const endDate = endDateInput?.value || "";

  if (
    startDate &&
    endDate &&
    startDate > endDate
  ) {
    alert(
      "A data inicial não pode ser posterior à data final."
    );
    return;
  }

  currentStartDate = startDate;
  currentEndDate = endDate;

  loadFinancialHistory(1);
});

clearFilterButton?.addEventListener("click", () => {
  if (startDateInput) {
    startDateInput.value = "";
  }

  if (endDateInput) {
    endDateInput.value = "";
  }

  currentStartDate = "";
  currentEndDate = "";

  loadFinancialHistory(1);
});
}

// =========================================================
// INICIALIZAÇÃO
// =========================================================

bindEvents();
loadFinancialHistory(1);