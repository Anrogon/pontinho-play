
"use strict";

const API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3001/api"
    : "/api";

const form = document.getElementById("forgotPasswordForm");
const emailInput = document.getElementById("forgotEmail");
const submitButton = document.getElementById("btnForgotSubmit");
const authMessage = document.getElementById("authMessage");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim().toLowerCase();

  if (!email) {
    authMessage.textContent = "Informe seu e-mail.";
    return;
  }

  submitButton.disabled = true;
  authMessage.textContent = "Enviando solicitação...";

  try {
    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      authMessage.textContent =
        data.message || "Não foi possível processar a solicitação.";
      return;
    }

    authMessage.textContent =
      data.message ||
      "Solicitação recebida! Confira sua caixa de entrada.";

    form.reset();
  } catch (error) {
    console.error("Erro ao solicitar recuperação de senha:", error);

    authMessage.textContent =
      "Erro de conexão com o servidor. Tente novamente.";
  } finally {
    submitButton.disabled = false;
  }
});
