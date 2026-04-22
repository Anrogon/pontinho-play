import { state } from "./state.js";


export function finalizeMatchIfNeeded() {
  if (!state.partidaEncerrada) return;
  if (state.matchFinalized) return;

  const winner = state.players?.find(p => String(p.id) === String(state.vencedor));
  if (!winner) {
    state.matchFinalized = true;
    return;
  }

  // garante números
  winner.chips = Number(winner.chips) || 0;
  state.matchPot = Number(state.matchPot) || 0;

  const rakePct = Number(state.houseRakePct);
  const pct = Number.isFinite(rakePct) ? Math.max(0, Math.min(0.5, rakePct)) : 0.05;

  // casa tira % do pote final (o que estiver acumulado no pot agora)
  const house = Math.floor(state.matchPot * pct);
  const payout = Math.max(0, state.matchPot - house);

  // paga o vencedor e zera pote
  winner.chips += payout;

  state.houseTake = house;
  state.winnerPayout = payout;

  // lucro líquido (se você tiver chipsStart salvo)
  const start = Number(winner.chipsStart);
  if (Number.isFinite(start)) {
    state.winnerNet = winner.chips - start;
  } else {
    state.winnerNet = payout; // fallback
  }

  state.matchPot = 0;
  state.matchFinalized = true;

  console.log("🏆 FINALIZADO:", { winner: winner.name, payout, house });
}


export function guardiaoRodadaEncerrada() {
  if (state.rodadaEncerrada) {
    console.log("⛔ rodada encerrada — ação bloqueada");
    return false;
  }
  return true;
}

export function validaBatida(jogador) {
  // 🛡️ blindagem
  if (!jogador || !Array.isArray(jogador.jogosBaixados)) return false;

  // ✅ só pode bater se ficou sem cartas na mão
  if (jogador.hand.length !== 0) return false;

  for (const jogo of jogador.jogosBaixados) {
    const cartas = jogo.cards || [];

    const coringas = cartas.filter(c => c && c.isJoker);
    const reais = cartas.filter(c => c && !c.isJoker);

    // =========================
    // REGRA 9 — 2 coringas + 1 carta (qualquer tipo)
    // =========================
    if (reais.length === 1 && coringas.length === 2) {
      continue; // válido SOMENTE porque é batida
    }

    // =========================
    // SEQUÊNCIA
    // =========================
    if (jogo.type === "SEQUENCIA") {
      // ❌ sequência só de coringa nunca é válida
      if (reais.length === 0) return false;

      // ✅ qualquer quantidade de coringa é permitida na batida
      continue;
    }

    // =========================
    // TRINCA — PONTINHO CLÁSSICO (3 naipes permitidos; pode repetir dentro deles)
    // =========================
    if (jogo.type === "TRINCA") {
      // na batida, trinca não pode ser só coringa
      if (reais.length < 3) return false;

      const valor = reais[0].valor;
      for (const c of reais) {
        if (c.valor !== valor) return false;
      }

      // ✅ Naipes permitidos (preferencialmente os 3 naipes "iniciais" salvos)
      // Se não existir, deduz pelos primeiros 3 naipes distintos vistos na trinca.
      let allowed = Array.isArray(jogo.allowedSuits) ? jogo.allowedSuits : null;

      if (!allowed) {
        const uniq = [];
        for (const c of reais) {
          if (!uniq.includes(c.naipe)) uniq.push(c.naipe);
          if (uniq.length === 3) break;
        }
        allowed = uniq;
      }

      // Pontinho clássico exige exatamente 3 naipes permitidos
      if (!Array.isArray(allowed) || allowed.length !== 3) return false;

      // ✅ não pode aparecer naipe fora dos permitidos (bloqueia o 4º naipe)
      for (const c of reais) {
        if (!allowed.includes(c.naipe)) return false;
      }

      // ✅ trinca não permite coringa na batida (se você quiser permitir, a gente muda)
      if (coringas.length > 0) return false;

      continue;
    }

    // tipo desconhecido => inválido
    return false;
  }

  return true;
}


export function maoPermiteBatida(mao) {
  if (!Array.isArray(mao)) return false;
  if (mao.length < 3) return false;

  const coringas = mao.filter(c => c.isJoker);
  const reais = mao.filter(c => !c.isJoker);

  // =============================
  // REGRA 9 (detecção, não validação)
  // 2 coringas + 1 carta real
  // =============================
  if (coringas.length >= 2 && reais.length >= 1) {
    return true;
  }

  return false;
}

// =============================
// PONTUAÇÃO — PONTINHO
// =============================
export function cardPoints(card) {
  if (!card) return 0;

  if (card.isJoker) return 20; // você disse que já ajustou coringa; se quiser, mude aqui
  if (card.valor === "A") return 15;
  if (card.valor === "J" || card.valor === "Q" || card.valor === "K") return 10;

  const n = Number(card.valor);
  return Number.isFinite(n) ? n : 0;
}

export function handPoints(hand) {
  if (!Array.isArray(hand)) return 0;
  return hand.reduce((sum, c) => sum + cardPoints(c), 0);
}

export function applyRoundScoring(winnerId = state.players?.[state.currentPlayer]?.id) {
  console.log("🧾 applyRoundScoring() + fichas (Estilo 2)");

  // ✅ matchPot é o pote único da partida (antes + rebuys)
  // Ele NÃO deve receber os pontos das rodadas.
  if (typeof state.matchPot !== "number") state.matchPot = 0;

  // total que os perdedores pagam AO VENCEDOR nesta rodada
  let totalPaidToWinner = 0;

  // 1) Pontuação e "ponto vira ficha" (perdedores pagam direto pro vencedor)
  for (const pl of state.players) {
    if (pl.eliminated) continue;

    const pts = handPoints(pl.hand);

    if (typeof pl.totalPoints !== "number") pl.totalPoints = 0;
    if (!Array.isArray(pl.roundPoints)) pl.roundPoints = [];

    pl.totalPoints += pts;
    pl.roundPoints.push(pts);

    // ✅ ponto vira ficha (exceto vencedor)
    if (pl.id !== winnerId) {
      pl.chips = Number(pl.chips) || 0;

      const loss = Math.max(0, pts);           // 1 ponto = 1 ficha
      const paid = Math.min(pl.chips, loss);   // não deixa negativo

      pl.chips -= paid;

      // ✅ vai para o vencedor da rodada (NÃO para o matchPot)
      totalPaidToWinner += paid;
    }

    if (pl.totalPoints > 100) {
      pl.eliminated = true;
      console.log(`☠️ ${pl.name} eliminado (>${100})`);
    }
  }

  // ✅ vencedor recebe o total pago nesta rodada
  const winner = state.players.find(x => x.id === winnerId);
  if (winner && !winner.eliminated) {
    winner.chips = Number(winner.chips) || 0;
    winner.chips += totalPaidToWinner;
    state.lastWinnerId = winnerId;
  }

  // 2) elimina por ficar sem fichas (antes de decidir fim)
  for (const pl of state.players) {
    if (!pl.eliminated && (Number(pl.chips) || 0) <= 0) {
      pl.eliminated = true;
      console.log(`💸 ${pl.name} eliminado (sem fichas)`);
    }
  }

  // 3) verifica fim da partida ANTES de pagar o pote final (matchPot)
  const ativos = state.players.filter(pl => !pl.eliminated);

  if (ativos.length <= 1) {
    // ✅ acabou: define vencedor e paga com rake
    state.partidaEncerrada = true;
    state.vencedor = ativos.length === 1 ? ativos[0].id : null;

    // ✅ bloqueia qualquer janela/pendência de rebuy
    state.rebuyDecisionUntil = 0;
    for (const pl of state.players) {
      pl.pendingRebuy = false;
      pl.rebuyDeclined = true;
    }

    // ✅ paga o pote final (deve usar matchPot dentro do finalizeMatchIfNeeded)
    finalizeMatchIfNeeded();

    return;
  }
}
/*
  // 4) não acabou: vencedor recebe o pote inteiro da rodada
  const winner = state.players.find(x => x.id === winnerId);
  if (winner && !winner.eliminated) {
    winner.chips = Number(winner.chips) || 0;
    winner.chips += state.matchPot;
    state.lastWinnerId = winnerId;
  }

  // 5) zera pote no final da rodada normal
  state.matchPot = 0;
  */

