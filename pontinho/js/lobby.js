/*import { state, socket } from "./app.js";





export function renderTablesScreen() {
  const grid = document.getElementById("tablesGrid");
  if (!grid) return;

  grid.innerHTML = "";

  let selected = { tableId: null, seat: null };
  const positions = ["pos1", "pos2", "pos3", "pos4", "pos5", "pos6"];

  TABLES.forEach((t) => {
    const card = document.createElement("div");
    card.className = "table-card";
    card.dataset.tableId = t.id;

    const liveTable = window.state?.tables?.[t.id] || {};

    const seatedCount = Array.isArray(liveTable.seats)
      ? liveTable.seats.filter(Boolean).length
      : 0;

    const maxSeats = Number(liveTable.maxSeats) || 6;
    const minPlayersToStart = Number(liveTable.minPlayersToStart) || 2;
    const startAt = Number(liveTable.startAt) || 0;
    console.log("[LOBBY TABLE]", t.id, {
      seatedCount,
      maxSeats,
      minPlayersToStart,
      startAt,
      started: liveTable.started
    });

 let countdownHtml = "";

const shouldShowTimer =
  liveTable.started !== true &&
  seatedCount >= minPlayersToStart &&
  Number(startAt) > 0;

if (shouldShowTimer) {
  countdownHtml = `
    <div class="table-start-wrap" data-start-at="${startAt}">
      <div class="table-start-bar">
        <div class="table-start-bar-fill"></div>
      </div>
    </div>
  `;
}

if (t.id === "S1") {
  console.log("[COUNTDOWN CHECK]", {
    tableId: t.id,
    started: liveTable.started,
    seatedCount,
    minPlayersToStart,
    startAt,
    shouldShowTimer,
    countdownHtml
  });
}

    card.innerHTML = `
      <div class="table-title">${t.name}</div>

      <div class="table-visual">
        <img src="./assets/image/mesa-pts.png" alt="${t.name}" onerror="this.style.display='none'">

        <div class="table-center-info">
          <div class="table-players-count">${seatedCount}/${maxSeats}</div>
          ${countdownHtml}
        </div>

        <div class="seats-overlay" data-table="${t.id}"></div>
      </div>

      <div class="table-value">Aposta: ${formatBR(t.buyIn)}</div>
      <div class="table-hint">Clique em um assento vazio para entrar</div>

      <div class="table-actions">
        <button class="secondary" data-watch="${t.id}">Assistir</button>
      </div>
    `;



    const seatsEl = card.querySelector(".seats-overlay");

    for (let s = 1; s <= 6; s++) {
      const seatEl = document.createElement("div");
      seatEl.className = `seat ${positions[s - 1]}`;
      seatEl.dataset.seat = s;

      const player = liveTable.seats?.[s - 1] || null;

      if (player) {
        const inicial = (player.name?.[0] || "?").toUpperCase();
        const avatarUrl = player.avatarUrl || player.avatar || null;

        seatEl.innerHTML = avatarUrl
          ? `<img class="seat-avatar-img" src="${avatarUrl}" alt="${player.name || "Jogador"}">`
          : `<span class="seat-avatar-fallback">${inicial}</span>`;

        seatEl.classList.add("occupied");
        seatEl.title = player.name || `Jogador ${s}`;
      } else {
        seatEl.innerHTML = `<span class="seat-empty-number">${s}</span>`;
        seatEl.classList.add("empty");
        seatEl.title = `Assento ${s}`;
      }

seatEl.onclick = () => {
  if (!socket || socket.readyState !== 1) {
    alert("WS ainda não conectou. Atualize a página.");
    return;
  }

  const nome = document.getElementById("player-name")?.value?.trim() || "Anônimo";
  const avatarUrl = localStorage.getItem("pontinhoAvatarUrl") || "https://i.pravatar.cc/80?img=3";
  const reconnectToken = localStorage.getItem(`buraco_reconnect_${t.id}_${s}`);

  // ✅ se eu já estou sentado nesse assento, saio dele
  if (state.room?.id === t.id && state.mySeat === s) {
    socket.send(JSON.stringify({
      type: "leaveTable",
      payload: { tableId: t.id }
    }));

    if (window.state?.tables?.[t.id]?.seats) {
      window.state.tables[t.id].seats[s - 1] = null;
    }

    state.mySeat = null;
    state.room = null;
    state.spectator = false;

    renderTablesScreen();
    return;
  }

  // ✅ se o assento está ocupado, só tenta reconectar se eu tiver token salvo dele
  if (player) {
    if (!reconnectToken) return;

    state.room = { id: t.id, buyIn: t.buyIn };

    socket.send(JSON.stringify({
      type: "joinTable",
      payload: {
        tableId: t.id,
        seat: s,
        mode: "player",
        name: nome,
        reconnectToken,
        avatarUrl
      }
    }));

    return;
  }

  // ✅ assento vazio: entra normalmente
  state.room = { id: t.id, buyIn: t.buyIn };

  socket.send(JSON.stringify({
    type: "joinTable",
    payload: {
      tableId: t.id,
      seat: s,
      mode: "player",
      name: nome,
      reconnectToken,
      avatarUrl
    }
  }));
};

      seatsEl.appendChild(seatEl);
    }


const playBtn = card.querySelector(`[data-play="${t.id}"]`);
if (playBtn) {
  playBtn.onclick = () => {
    alert("Clique diretamente em um assento vazio para entrar na mesa.");
  };
}

    card.querySelector(`[data-watch="${t.id}"]`).onclick = () => {
      if (!socket || socket.readyState !== 1) {
        alert("WS ainda não conectou. Atualize a página.");
        return;
      }

      const nome = document.getElementById("player-name")?.value?.trim() || "Anônimo";
      state.room = { id: t.id, buyIn: t.buyIn };

      socket.send(JSON.stringify({
        type: "joinTable",
        payload: { tableId: t.id, mode: "spectator", name: nome }
      }));
    };

    grid.appendChild(card);
  });

  updateLobbyCountdowns();
}


*/