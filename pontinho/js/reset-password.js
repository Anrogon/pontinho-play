
"use strict";

const API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3001/api"
    : "/api";

const form = document.getElementById("resetPasswordForm");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const submitButton = document.getElementById("btnResetSubmit");
const authMessage = document.getElementById("authMessage");

const params = new URLSearchParams(window.location.search);
const token = params.get("token");

if (!token) {
  authMessage.textContent =
    "O link de recuperação é inválido ou expirou. Solicite um novo link.";

  submitButton.disabled = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (!token) {
    authMessage.textContent =
      "O link de recuperação é inválido ou expirou. Solicite um novo link.";
    return;
  }

  if (newPassword.length < 8) {
    authMessage.textContent =
      "A nova senha deve ter pelo menos 8 caracteres.";
    return;
  }

  if (newPassword !== confirmPassword) {
    authMessage.textContent = "As senhas não coincidem.";
    return;
  }

  submitButton.disabled = true;
  authMessage.textContent = "Redefinindo sua senha...";

  try {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        newPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      authMessage.textContent =
        data.message || "Não foi possível redefinir sua senha.";
      return;
    }

    authMessage.textContent =
      data.message ||
      "Senha redefinida com sucesso! Você já pode acessar sua conta.";

    form.reset();
    submitButton.disabled = true;

    // Remove o token da barra de endereço após o uso.
    window.history.replaceState(
      null,
      "",
      window.location.pathname
    );
  } catch (error) {
    console.error("Erro ao redefinir senha:", error);

    authMessage.textContent =
      "Erro de conexão com o servidor. Tente novamente.";
  } finally {
    if (authMessage.textContent !==
      "Senha redefinida com sucesso! Você já pode acessar sua conta.") {
      submitButton.disabled = false;
    }
  }
});
