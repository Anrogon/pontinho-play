/* =========================================================
   CLUBE PONTINHO — RECOMPENSAS
   Versão inicial visual/de teste

   IMPORTANTE:
   - ainda não altera saldo real;
   - ainda não consulta o servidor;
   - ainda não salva missões ou recompensas no banco.
========================================================= */

const API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3001/api"
    : "/api";

const REWARDS_INITIAL_DATA = {
  balance: 0,

  luckyCardsAvailable: 0,

  rankingPosition: 0,

  dailyLogin: {
    currentDay: 0,
    totalDays: 7,
    nextReward: 0
  },

  dailyMission: {
    current: 0,
    target: 3,
    reward: 100,
    completed: false,
    canClaim: false,
    rewardClaimed: false
  },

  weeklyMission: {
    current: 0,
    target: 25,
    reward: 1000,
    rewardClaimed: false
  },

  achievement: {
    current: 0,
    target: 5,
    reward: 500,
    label: "Ganhe 5 partidas"
  }
};


/* =========================================================
   CONFIGURAÇÃO DA CARTA DA SORTE
========================================================= */

const LUCKY_CARD_REWARDS = [
  {
    value: "2",
    reward: 200,
    weight: 14
  },
  {
    value: "3",
    reward: 300,
    weight: 13
  },
  {
    value: "4",
    reward: 400,
    weight: 12
  },
  {
    value: "5",
    reward: 500,
    weight: 11
  },
  {
    value: "6",
    reward: 600,
    weight: 10
  },
  {
    value: "7",
    reward: 700,
    weight: 9
  },
  {
    value: "8",
    reward: 800,
    weight: 8
  },
  {
    value: "9",
    reward: 900,
    weight: 7
  },
  {
    value: "10",
    reward: 1000,
    weight: 6
  },
  {
    value: "J",
    label: "Valete",
    reward: 1200,
    weight: 4
  },
  {
    value: "Q",
    label: "Dama",
    reward: 1400,
    weight: 3
  },
  {
    value: "K",
    label: "Rei",
    reward: 1600,
    weight: 2
  },
  {
    value: "A",
    label: "Ás",
    reward: 2000,
    weight: 1.5
  },
  {
    value: "JOKER",
    label: "Coringa",
    reward: 5000,
    weight: 0.5
  }
];

const CARD_SUITS = [
  {
    symbol: "♠",
    name: "Espadas",
    red: false
  },
  {
    symbol: "♣",
    name: "Paus",
    red: false
  },
  {
    symbol: "♥",
    name: "Copas",
    red: true
  },
  {
    symbol: "♦",
    name: "Ouros",
    red: true
  }
];


/* =========================================================
   ESTADO LOCAL DA TELA
========================================================= */

const rewardsState = {
  data: structuredClone(REWARDS_INITIAL_DATA),

  cardOptions: [],

  selectedCardIndex: null,

  selectionLocked: false,

  allCardsRevealed: false,

  testRewardReceived: false
};


/* =========================================================
   ELEMENTOS
========================================================= */

function getRewardsElements() {
  return {
    rewardsBalance:
      document.getElementById("rewardsBalance"),

    rewardsLuckyCards:
      document.getElementById("rewardsLuckyCards"),

    rewardsRankingPosition:
      document.getElementById("rewardsRankingPosition"),

    dailyLoginLabel:
      document.getElementById("dailyLoginLabel"),

    dailyLoginCounter:
      document.getElementById("dailyLoginCounter"),

    dailyLoginProgress:
      document.getElementById("dailyLoginProgress"),

    dailyLoginReward:
      document.getElementById("dailyLoginReward"),

    dailyMissionCounter:
      document.getElementById("dailyMissionCounter"),

    dailyMissionProgress:
      document.getElementById("dailyMissionProgress"),

    dailyMissionStatus:
      document.getElementById("dailyMissionStatus"),

    claimDailyMissionBtn:
      document.getElementById("claimDailyMissionBtn"),

    weeklyMissionCounter:
      document.getElementById("weeklyMissionCounter"),

    weeklyMissionProgress:
      document.getElementById("weeklyMissionProgress"),

    weeklyMissionStatus:
      document.getElementById("weeklyMissionStatus"),

    claimWeeklyMissionBtn:
      document.getElementById("claimWeeklyMissionBtn"),

    luckyCardCount:
      document.getElementById("luckyCardCount"),

    openLuckyCardBtn:
      document.getElementById("openLuckyCardBtn"),

    monthlyRankingPosition:
      document.getElementById("monthlyRankingPosition"),

    monthlyRankingReward:
      document.getElementById("monthlyRankingReward"),

    achievementLabel:
      document.getElementById("achievementLabel"),

    achievementCounter:
      document.getElementById("achievementCounter"),

    achievementProgress:
      document.getElementById("achievementProgress"),

    achievementReward:
      document.getElementById("achievementReward"),

    luckyCardModal:
      document.getElementById("luckyCardModal"),

    closeLuckyCardModalBtn:
      document.getElementById("closeLuckyCardModalBtn"),

    luckyCardChoices:
  document.getElementById("luckyCardChoices"),

    luckyCardDecks:
    Array.from(
        document.querySelectorAll(
        ".lucky-card-deck[data-card-index]"
        )
    ),

    luckyCardResult:
    document.getElementById("luckyCardResult"),

  };
}


/* =========================================================
   UTILITÁRIOS
========================================================= */

function formatChips(value) {
  const number = Number(value) || 0;

  return number.toLocaleString("pt-BR");
}

function clamp(value, min, max) {
  return Math.min(
    Math.max(Number(value) || 0, min),
    max
  );
}

function calculateProgress(current, target) {
  const safeTarget = Math.max(
    Number(target) || 1,
    1
  );

  const safeCurrent = clamp(
    current,
    0,
    safeTarget
  );

  return {
    current: safeCurrent,
    target: safeTarget,
    percentage:
      (safeCurrent / safeTarget) * 100
  };
}

function getStoredUser() {
  const possibleKeys = [
    "pontinhoAuthUser",
    "user",
    "authUser"
  ];

  for (const key of possibleKeys) {
    const raw = localStorage.getItem(key);

    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch (error) {
      console.warn(
        `[REWARDS] Não foi possível ler ${key}:`,
        error
      );
    }
  }

  return null;
}

function getUserBalance(user) {
  if (!user) {
    return rewardsState.data.balance;
  }

  const possibleValues = [
    user.chips,
    user.chipsBalance,
    user.balance,
    user.saldo,
    user.fichas
  ];

  for (const value of possibleValues) {
    const number = Number(value);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return rewardsState.data.balance;
}


/* =========================================================
   API DE RECOMPENSAS
========================================================= */

async function loadRewardsStatus() {
  const response = await fetch(
    `${API_BASE}/auth/rewards/status`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    }
  );

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    if (response.status === 401) {
      window.location.href = "./login.html";
      return false;
    }

    throw new Error(
      result?.message ||
      "Não foi possível carregar as recompensas."
    );
  }

  applyRewardsApiData(result.rewards);

  return true;
}


function applyRewardsApiData(apiRewards) {
  const login =
    apiRewards?.login || {};

  const daily =
    apiRewards?.daily || {};

  const weekly =
    apiRewards?.weekly || {};

  const luckyCard =
    apiRewards?.luckyCard || {};

  const achievements =
    apiRewards?.achievements || {};

  const loginRewards =
    Array.isArray(login.rewards)
      ? login.rewards
      : [];

  const nextLoginReward =
    loginRewards.find(
      item => item.completed !== true
    );

  rewardsState.data.balance =
    Number(apiRewards?.chipsBalance) || 0;

  rewardsState.data.luckyCardsAvailable =
    Number(luckyCard.available) || 0;

  rewardsState.data.dailyLogin = {
    currentDay:
      Number(login.streak) || 0,

    totalDays:
      Number(login.totalDays) || 7,

    nextReward:
      Number(nextLoginReward?.reward) || 0
  };

  rewardsState.data.dailyMission = {
    current:
      Number(daily.matches) || 0,

    target:
      Number(daily.goal) || 3,

    reward:
      Number(daily.reward) || 100,

    completed:
      daily.completed === true,

    canClaim:
      daily.canClaim === true,

    rewardClaimed:
      daily.rewardClaimed === true
  };

    rewardsState.data.weeklyMission = {
    current:
      Number(weekly.matches) || 0,

    target:
      Number(weekly.goal) || 25,

    reward:
      Number(weekly.reward) || 1000,

    completed:
      weekly.completed === true,

    canClaim:
      weekly.canClaim === true,

    rewardClaimed:
      weekly.rewardClaimed === true
  };

  rewardsState.data.achievement = {
    current:
      Number(
        achievements.matchesWon ??
        achievements.wins ??
        achievements.current
      ) || 0,

    target:
      Number(achievements.target) || 5,

    reward:
      Number(achievements.reward) || 500,

    label:
      achievements.label || "Ganhe 5 partidas"
  };

  renderRewardsPage();
}


async function claimDailyMissionReward() {
  const elements = getRewardsElements();
  const button = elements.claimDailyMissionBtn;

  if (
    rewardsState.data.dailyMission.canClaim !== true ||
    rewardsState.data.dailyMission.rewardClaimed === true
  ) {
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Resgatando...";
  }

  try {
    const response = await fetch(
      `${API_BASE}/auth/rewards/claim-daily-mission`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        }
      }
    );

    const result =
      await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      throw new Error(
        result?.message ||
        "Não foi possível resgatar a recompensa."
      );
    }

    rewardsState.data.balance =
      Number(result.chipsBalance) ||
      rewardsState.data.balance;

    rewardsState.data.dailyMission = {
      current:
        Number(result.daily?.matches) || 0,

      target:
        Number(result.daily?.goal) || 3,

      reward:
        Number(result.daily?.reward) || 100,

      completed: true,
      canClaim: false,
      rewardClaimed: true
    };

    renderRewardsPage();

    window.alert(
      result.message ||
      "Recompensa recebida com sucesso!"
    );
  } catch (error) {
    console.error(
      "[REWARDS] Erro ao resgatar missão diária:",
      error
    );

    window.alert(
      error.message ||
      "Erro ao resgatar a recompensa."
    );

    await loadRewardsStatus().catch(() => {});
  }
}

async function claimWeeklyMissionReward() {
  const elements = getRewardsElements();
  const button = elements.claimWeeklyMissionBtn;

  if (
    rewardsState.data.weeklyMission.canClaim !== true ||
    rewardsState.data.weeklyMission.rewardClaimed === true
  ) {
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Resgatando...";
  }

  try {
    const response = await fetch(
      `${API_BASE}/auth/rewards/claim-weekly-mission`,
      {
        method: "POST",
        credentials: "include",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        }
      }
    );

    const result =
      await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      throw new Error(
        result?.message ||
        "Não foi possível resgatar a recompensa semanal."
      );
    }

    rewardsState.data.balance =
      Number(result.chipsBalance) ||
      rewardsState.data.balance;

    rewardsState.data.weeklyMission = {
      current:
        Number(result.weekly?.matches) || 0,

      target:
        Number(result.weekly?.goal) || 25,

      reward:
        Number(result.weekly?.reward) || 1000,

      completed: true,
      canClaim: false,
      rewardClaimed: true
    };

    renderRewardsPage();

    window.alert(
      result.message ||
      "Recompensa semanal recebida com sucesso!"
    );
  } catch (error) {
    console.error(
      "[REWARDS] Erro ao resgatar missão semanal:",
      error
    );

    window.alert(
      error.message ||
      "Erro ao resgatar a recompensa semanal."
    );

    await loadRewardsStatus().catch(() => {});
  }
}


/* =========================================================
   RENDERIZAÇÃO DA PÁGINA
========================================================= */

function renderRewardsPage() {
  const elements = getRewardsElements();
  const data = rewardsState.data;

  if (elements.rewardsBalance) {
    elements.rewardsBalance.textContent =
      `${formatChips(data.balance)} fichas`;
  }

  renderLuckyCardSummary(elements, data);
  renderRanking(elements, data);
  renderDailyLogin(elements, data.dailyLogin);
  renderDailyMission(elements, data.dailyMission);
  renderWeeklyMission(elements, data.weeklyMission);
  renderAchievement(elements, data.achievement);
}

function renderLuckyCardSummary(elements, data) {
  const amount = Math.max(
    Number(data.luckyCardsAvailable) || 0,
    0
  );

  if (elements.rewardsLuckyCards) {
    elements.rewardsLuckyCards.textContent =
      String(amount);
  }

  if (elements.luckyCardCount) {
    if (amount === 0) {
      elements.luckyCardCount.textContent =
        "🎴 Nenhuma carta disponível";
    } else if (amount === 1) {
      elements.luckyCardCount.textContent =
        "🎴 1 carta disponível";
    } else {
      elements.luckyCardCount.textContent =
        `🎴 ${amount} cartas disponíveis`;
    }
  }

  if (elements.openLuckyCardBtn) {
    elements.openLuckyCardBtn.disabled =
      amount <= 0;

    elements.openLuckyCardBtn.textContent =
      amount > 0
        ? "Virar carta"
        : "Nenhuma carta disponível";
  }
}

function renderRanking(elements, data) {
  const position =
    Number(data.rankingPosition) || 0;

  if (elements.rewardsRankingPosition) {
    elements.rewardsRankingPosition.textContent =
      position > 0
        ? `${position}º lugar`
        : "—";
  }

  if (elements.monthlyRankingPosition) {
    elements.monthlyRankingPosition.textContent =
      position > 0
        ? `Sua posição: ${position}º lugar`
        : "Sua posição: —";
  }

  if (elements.monthlyRankingReward) {
    elements.monthlyRankingReward.textContent =
      getRankingRewardLabel(position);
  }
}

function getRankingRewardLabel(position) {
  if (position <= 0) {
    return "Jogue partidas para entrar no ranking.";
  }

  if (position === 1) {
    return "Prêmio atual: 20.000 fichas";
  }

  if (position === 2) {
    return "Prêmio atual: 15.000 fichas";
  }

  if (position === 3) {
    return "Prêmio atual: 10.000 fichas";
  }

  if (position <= 10) {
    return "Prêmio atual: 5.000 fichas";
  }

  if (position <= 50) {
    return "Prêmio atual: 2.000 fichas";
  }

  if (position <= 100) {
    return "Prêmio atual: Carta da Sorte";
  }

  return "Suba no ranking para conquistar um prêmio.";
}

function renderDailyLogin(elements, loginData) {
  const progress = calculateProgress(
    loginData.currentDay,
    loginData.totalDays
  );

  if (elements.dailyLoginLabel) {
    elements.dailyLoginLabel.textContent =
      `Dia ${progress.current} de ${progress.target}`;
  }

  if (elements.dailyLoginCounter) {
    elements.dailyLoginCounter.textContent =
      `${progress.current}/${progress.target}`;
  }

  if (elements.dailyLoginProgress) {
    elements.dailyLoginProgress.style.width =
      `${progress.percentage}%`;

    updateProgressAccessibility(
      elements.dailyLoginProgress,
      progress
    );
  }

  if (elements.dailyLoginReward) {
    const nextReward =
      Number(loginData.nextReward) || 0;

    elements.dailyLoginReward.textContent =
      progress.current >= progress.target
        ? "Próxima recompensa: Carta da Sorte"
        : `Próxima recompensa: ${formatChips(nextReward)} fichas`;
  }
}

function renderDailyMission(elements, missionData) {
  const progress = calculateProgress(
    missionData.current,
    missionData.target
  );

  if (elements.dailyMissionCounter) {
    elements.dailyMissionCounter.textContent =
      `${progress.current}/${progress.target}`;
  }

  if (elements.dailyMissionProgress) {
    elements.dailyMissionProgress.style.width =
      `${progress.percentage}%`;

    updateProgressAccessibility(
      elements.dailyMissionProgress,
      progress
    );
  }

  const completed =
    missionData.completed === true ||
    progress.current >= progress.target;

  const claimed =
    missionData.rewardClaimed === true;

  const canClaim =
    missionData.canClaim === true &&
    claimed !== true;

  if (elements.dailyMissionStatus) {
    if (claimed) {
      elements.dailyMissionStatus.textContent =
        "Missão concluída. Recompensa resgatada.";
    } else if (canClaim) {
      elements.dailyMissionStatus.textContent =
        "Missão concluída. Sua recompensa está disponível.";
    } else {
      const missing = Math.max(
        progress.target - progress.current,
        0
      );

      elements.dailyMissionStatus.textContent =
        missing === 1
          ? "Falta 1 partida para completar a missão."
          : `Faltam ${missing} partidas para completar a missão.`;
    }
  }

  if (elements.claimDailyMissionBtn) {
    elements.claimDailyMissionBtn.disabled =
      !canClaim;

    if (claimed) {
      elements.claimDailyMissionBtn.textContent =
        "Recompensa resgatada";
    } else if (canClaim) {
      elements.claimDailyMissionBtn.textContent =
        `Resgatar ${formatChips(
          missionData.reward
        )} fichas`;
    } else if (completed) {
      elements.claimDailyMissionBtn.textContent =
        "Recompensa indisponível";
    } else {
      elements.claimDailyMissionBtn.textContent =
        `Complete ${progress.target} partidas`;
    }
  }
}


function renderWeeklyMission(elements, missionData) {
  const progress = calculateProgress(
    missionData.current,
    missionData.target
  );

  if (elements.weeklyMissionCounter) {
    elements.weeklyMissionCounter.textContent =
      `${progress.current}/${progress.target}`;
  }

  if (elements.weeklyMissionProgress) {
    elements.weeklyMissionProgress.style.width =
      `${progress.percentage}%`;

    updateProgressAccessibility(
      elements.weeklyMissionProgress,
      progress
    );
  }

  const completed =
    missionData.completed === true ||
    progress.current >= progress.target;

  const claimed =
    missionData.rewardClaimed === true;

  const canClaim =
    missionData.canClaim === true &&
    claimed !== true;

  if (elements.weeklyMissionStatus) {
    if (claimed) {
      elements.weeklyMissionStatus.textContent =
        "Missão concluída. Recompensa resgatada.";
    } else if (canClaim) {
      elements.weeklyMissionStatus.textContent =
        "Missão concluída. Sua recompensa está disponível.";
    } else {
      const missing = Math.max(
        progress.target - progress.current,
        0
      );

      elements.weeklyMissionStatus.textContent =
        missing === 1
          ? "Falta 1 partida para completar a missão semanal."
          : `Faltam ${missing} partidas para completar a missão semanal.`;
    }
  }

  if (elements.claimWeeklyMissionBtn) {
    elements.claimWeeklyMissionBtn.disabled =
      !canClaim;

    if (claimed) {
      elements.claimWeeklyMissionBtn.textContent =
        "Recompensa resgatada";
    } else if (canClaim) {
      elements.claimWeeklyMissionBtn.textContent =
        `Resgatar ${formatChips(
          missionData.reward
        )} fichas`;
    } else if (completed) {
      elements.claimWeeklyMissionBtn.textContent =
        "Recompensa indisponível";
    } else {
      elements.claimWeeklyMissionBtn.textContent =
        `Complete ${progress.target} partidas`;
    }
  }
}

function renderAchievement(elements, achievementData) {
  const progress = calculateProgress(
    achievementData.current,
    achievementData.target
  );

  if (elements.achievementLabel) {
    elements.achievementLabel.textContent =
      achievementData.label ||
      `Ganhe ${progress.target} partidas`;
  }

  if (elements.achievementCounter) {
    elements.achievementCounter.textContent =
      `${progress.current}/${progress.target}`;
  }

  if (elements.achievementProgress) {
    elements.achievementProgress.style.width =
      `${progress.percentage}%`;

    updateProgressAccessibility(
      elements.achievementProgress,
      progress
    );
  }

  if (elements.achievementReward) {
    elements.achievementReward.textContent =
      `Recompensa: ${formatChips(
        achievementData.reward
      )} fichas`;
  }
}

function updateProgressAccessibility(
  fillElement,
  progress
) {
  const progressBar =
    fillElement.closest(
      '[role="progressbar"]'
    );

  if (!progressBar) {
    return;
  }

  progressBar.setAttribute(
    "aria-valuemin",
    "0"
  );

  progressBar.setAttribute(
    "aria-valuemax",
    String(progress.target)
  );

  progressBar.setAttribute(
    "aria-valuenow",
    String(progress.current)
  );
}


/* =========================================================
   SORTEIO DA CARTA
========================================================= */

function drawWeightedLuckyCard() {
  const totalWeight =
    LUCKY_CARD_REWARDS.reduce(
      (total, card) =>
        total + Number(card.weight || 0),
      0
    );

  let random =
    Math.random() * totalWeight;

  for (const card of LUCKY_CARD_REWARDS) {
    random -= Number(card.weight || 0);

    if (random <= 0) {
      return createDrawnCard(card);
    }
  }

  return createDrawnCard(
    LUCKY_CARD_REWARDS[0]
  );
}

function createDrawnCard(cardReward) {
  if (cardReward.value === "JOKER") {
    return {
      ...cardReward,
      suit: null,
      isJoker: true,
      isRed: false,
      displayValue: "🃏",
      fullName: "Coringa"
    };
  }

  const suit =
    CARD_SUITS[
      Math.floor(
        Math.random() * CARD_SUITS.length
      )
    ];

  return {
    ...cardReward,
    suit,
    isJoker: false,
    isRed: suit.red,
    displayValue: cardReward.value,
    fullName:
      `${cardReward.label || cardReward.value} de ${suit.name}`
  };
}


/* =========================================================
   MODAL DA CARTA
========================================================= */

/* =========================================================
   MODAL DAS TRÊS CARTAS
========================================================= */

function openLuckyCardModal() {
  const elements = getRewardsElements();

  if (
    rewardsState.data.luckyCardsAvailable <= 0
  ) {
    return;
  }

  resetLuckyCardModal();

  /*
   * Na versão definitiva estas três cartas serão
   * geradas e registradas pelo servidor.
   */
  rewardsState.cardOptions = [
    drawWeightedLuckyCard(),
    drawWeightedLuckyCard(),
    drawWeightedLuckyCard()
  ];

  prepareLuckyCardFaces(elements);

  elements.luckyCardModal?.classList.remove(
    "hidden"
  );

  document.body.style.overflow = "hidden";
}


function closeLuckyCardModal() {
  const elements = getRewardsElements();

  /*
   * Depois que o jogador escolheu, só permitimos fechar
   * quando as três cartas já tiverem sido reveladas.
   */
  if (
    rewardsState.selectionLocked &&
    !rewardsState.allCardsRevealed
  ) {
    return;
  }

  elements.luckyCardModal?.classList.add(
    "hidden"
  );

  document.body.style.overflow = "";

  resetLuckyCardModal();
}


function resetLuckyCardModal() {
  const elements = getRewardsElements();

  rewardsState.cardOptions = [];
  rewardsState.selectedCardIndex = null;
  rewardsState.selectionLocked = false;
  rewardsState.allCardsRevealed = false;
  rewardsState.testRewardReceived = false;

  elements.luckyCardDecks.forEach((deck) => {
    deck.classList.remove(
      "is-revealed",
      "is-selected",
      "is-not-selected"
    );

    deck.disabled = false;

    const front =
      deck.querySelector(".lucky-card-front");

    const value =
      deck.querySelector(".lucky-card-value");

    const suit =
      deck.querySelector(".lucky-card-suit");

    front?.classList.remove(
      "is-red",
      "is-joker"
    );

    if (value) {
      value.textContent = "A";
    }

    if (suit) {
      suit.textContent = "♠";
    }
  });

  if (elements.luckyCardResult) {
  elements.luckyCardResult.innerHTML = "";

  elements.luckyCardResult.classList.remove(
    "is-jackpot",
    "is-best-choice"
  );
}
}


/* =========================================================
   PREPARAR AS FACES DAS CARTAS
========================================================= */

function prepareLuckyCardFaces(elements) {
  elements.luckyCardDecks.forEach(
    (deck, index) => {
      const card =
        rewardsState.cardOptions[index];

      renderLuckyCardFace(deck, card);
    }
  );
}


function renderLuckyCardFace(deck, card) {
  if (!deck || !card) {
    return;
  }

  const front =
    deck.querySelector(".lucky-card-front");

  const value =
    deck.querySelector(".lucky-card-value");

  const suit =
    deck.querySelector(".lucky-card-suit");

  front?.classList.remove(
    "is-red",
    "is-joker"
  );

  if (card.isJoker) {
    front?.classList.add("is-joker");

    if (value) {
      value.textContent = "🃏";
    }

    if (suit) {
      suit.textContent = "";
    }

    return;
  }

  if (card.isRed) {
    front?.classList.add("is-red");
  }

  if (value) {
    value.textContent =
      card.displayValue;
  }

  if (suit) {
    suit.textContent =
      card.suit?.symbol || "";
  }
}


/* =========================================================
   ESCOLHA DO JOGADOR
========================================================= */

function selectLuckyCard(event) {
  const selectedDeck =
    event.currentTarget;

  if (
    rewardsState.selectionLocked ||
    !selectedDeck
  ) {
    return;
  }

  const selectedIndex =
    Number(selectedDeck.dataset.cardIndex);

  const selectedCard =
    rewardsState.cardOptions[selectedIndex];

  if (!selectedCard) {
    return;
  }

  const elements = getRewardsElements();

  rewardsState.selectionLocked = true;
  rewardsState.selectedCardIndex =
    selectedIndex;

  /*
   * Bloqueia todas as cartas para impedir dois cliques.
   */
  elements.luckyCardDecks.forEach(
    (deck, index) => {
      deck.disabled = true;

      if (index === selectedIndex) {
        deck.classList.add("is-selected");
      }
    }
  );

  /*
   * Primeiro vira somente a carta escolhida.
   */
  selectedDeck.classList.add(
    "is-revealed"
  );

  window.setTimeout(() => {
    renderSelectedCardResult(
      elements,
      selectedCard
    );

    applyVisualTestReward(
      selectedCard
    );
  }, 740);

  /*
   * Depois de o jogador ver seu prêmio,
   * as outras duas cartas são reveladas.
   */
  window.setTimeout(() => {
    revealRemainingCards(
      elements,
      selectedIndex
    );
  }, 1950);
}


function renderSelectedCardResult(
  elements,
  card
) {
  if (
    !elements.luckyCardResult ||
    !card
  ) {
    return;
  }

  const cardTitle =
    card.isJoker
      ? "CORINGA!"
      : card.fullName;

  elements.luckyCardResult.innerHTML = `
    <div>Você escolheu: ${cardTitle}</div>

    <div
      style="
        margin-top:5px;
        font-size:25px;
      "
    >
      +${formatChips(card.reward)} fichas
    </div>
  `;
}


/* =========================================================
   REVELAR AS OUTRAS DUAS
========================================================= */

function revealRemainingCards(
  elements,
  selectedIndex
) {
  elements.luckyCardDecks.forEach(
    (deck, index) => {
      if (index === selectedIndex) {
        return;
      }

      deck.classList.add(
        "is-revealed",
        "is-not-selected"
      );
    }
  );

  rewardsState.allCardsRevealed = true;

  window.setTimeout(() => {
    showFinalComparison(
      elements,
      selectedIndex
    );

  }, 760);
}


function showFinalComparison(
  elements,
  selectedIndex
) {
  const selectedCard =
    rewardsState.cardOptions[
      selectedIndex
    ];

  if (
    !elements.luckyCardResult ||
    !selectedCard
  ) {
    return;
  }

  const rewards =
    rewardsState.cardOptions.map(
      (card) => Number(card.reward) || 0
    );

  const highestReward =
    Math.max(...rewards);

  const selectedReward =
    Number(selectedCard.reward) || 0;

  const foundHighestPrize =
    selectedReward === highestReward;

  const cardName =
    selectedCard.isJoker
      ? "Coringa"
      : selectedCard.fullName;

  let title = "🎉 Parabéns!";
  let message =
    "As outras cartas também foram reveladas.";
  let resultClass = "";

  if (selectedCard.isJoker) {
    title = "🃏 CORINGA!";
    message =
      "Você encontrou o prêmio máximo da Carta da Sorte.";
    resultClass = "is-jackpot";
  } else if (foundHighestPrize) {
    message =
      "Excelente escolha! Você encontrou o maior prêmio.";
    resultClass = "is-best-choice";
  } else {
    message =
      "Você recebeu a recompensa da carta escolhida.";
  }

  elements.luckyCardResult.classList.remove(
    "is-jackpot",
    "is-best-choice"
  );

  if (resultClass) {
    elements.luckyCardResult.classList.add(
      resultClass
    );
  }

  elements.luckyCardResult.innerHTML = `
    <div class="lucky-result-title">
      ${title}
    </div>

    <div class="lucky-result-card-name">
      Você virou:
      <strong>${cardName}</strong>
    </div>

    <div class="lucky-result-label">
      Recompensa
    </div>

    <div class="lucky-result-amount">
      +${formatChips(selectedReward)} fichas
    </div>

    <div class="lucky-result-message">
      ${message}
    </div>

    <div class="lucky-result-demo">
      Demonstração visual — saldo real não alterado.
    </div>
  `;
}


/* =========================================================
   RECOMPENSA VISUAL DE TESTE
========================================================= */

function applyVisualTestReward(card) {
  if (
    !card ||
    rewardsState.testRewardReceived
  ) {
    return;
  }

  rewardsState.testRewardReceived = true;

  /*
   * Somente demonstração visual.
   * Não altera saldo, banco ou servidor.
   */
  rewardsState.data.luckyCardsAvailable =
    Math.max(
      Number(
        rewardsState.data
          .luckyCardsAvailable
      ) - 1,
      0
    );

  renderRewardsPage();
}


/* =========================================================
   EVENTOS
========================================================= */

function bindRewardsEvents() {
  const elements = getRewardsElements();

  elements.claimDailyMissionBtn?.addEventListener(
    "click",
    claimDailyMissionReward
  );

  elements.claimWeeklyMissionBtn?.addEventListener(
    "click",
    claimWeeklyMissionReward
  );

  /* Abre o modal */
  elements.openLuckyCardBtn?.addEventListener(
    "click",
    openLuckyCardModal
  );

  /* Fecha pelo X */
  elements.closeLuckyCardModalBtn?.addEventListener(
    "click",
    closeLuckyCardModal
  );

  /* Liga o clique às três cartas */
  elements.luckyCardDecks.forEach((deck) => {
    deck.addEventListener(
      "click",
      selectLuckyCard
    );
  });

  /* Fecha ao clicar no fundo escuro */
  elements.luckyCardModal?.addEventListener(
    "click",
    (event) => {
      if (event.target === elements.luckyCardModal) {
        closeLuckyCardModal();
      }
    }
  );

  /* Fecha com a tecla Esc */
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (
        elements.luckyCardModal?.classList.contains(
          "hidden"
        )
      ) {
        return;
      }

      closeLuckyCardModal();
    }
  );
}


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

async function initRewardsPage() {
  console.log(
    "[REWARDS] Página de recompensas carregada."
  );

  bindRewardsEvents();
  renderRewardsPage();

  try {
    await loadRewardsStatus();

    console.log(
      "[REWARDS] Dados reais carregados com sucesso."
    );
  } catch (error) {
    console.error(
      "[REWARDS] Erro ao carregar dados reais:",
      error
    );

    const elements = getRewardsElements();

    if (elements.dailyMissionStatus) {
      elements.dailyMissionStatus.textContent =
        "Não foi possível carregar as recompensas.";
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initRewardsPage,
    { once: true }
  );
} else {
  initRewardsPage();
}