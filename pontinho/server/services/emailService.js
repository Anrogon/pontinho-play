
"use strict";

const nodemailer = require("nodemailer");


const APP_BASE_URL = (
  process.env.APP_BASE_URL || "http://localhost:3001"
).replace(/\/+$/, "");

const FRONTEND_BASE_URL = (
  process.env.FRONTEND_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");


const SMTP_FROM =
  process.env.SMTP_FROM ||
  "Pontinho Play <suporte@pontinhoplay.com.br>";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT || 587) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

function emailTemplate({ title, message, buttonText, buttonUrl }) {
  const safeUrl = escapeHtml(buttonUrl);

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:24px;background:#f3f5f8;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:#173b70;color:#ffffff;padding:24px;text-align:center;">
          <h1 style="margin:0;font-size:26px;">Pontinho Play</h1>
        </div>

        <div style="padding:28px;color:#263238;line-height:1.6;">
          <h2 style="margin-top:0;">${escapeHtml(title)}</h2>

          <p>${escapeHtml(message)}</p>

          <div style="text-align:center;margin:30px 0;">
            <a href="${safeUrl}"
               style="display:inline-block;background:#1769aa;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:8px;font-weight:bold;">
              ${escapeHtml(buttonText)}
            </a>
          </div>

          <p style="font-size:13px;color:#667085;">
            Se o botão não funcionar, copie e cole este endereço no navegador:
          </p>

          <p style="font-size:12px;overflow-wrap:anywhere;">
            <a href="${safeUrl}">${safeUrl}</a>
          </p>

          <p style="font-size:13px;color:#667085;">
            Se você não solicitou esta mensagem, pode ignorá-la.
          </p>
        </div>

        <div style="background:#f8fafc;padding:16px;text-align:center;color:#667085;font-size:12px;">
          © Pontinho Play
        </div>
      </div>
    </body>
    </html>
  `;
}

async function sendVerificationEmail({ to, username, token }) {
  const verificationUrl =
    `${APP_BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  return transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: "Pontinho Play — Confirme seu e-mail",
    text: [
      `Olá, ${username || "jogador"}!`,
      "",
      "Confirme seu endereço de e-mail para ativar sua conta no Pontinho Play.",
      "",
      verificationUrl,
      "",
      "Este link é válido por 24 horas.",
      "Se você não realizou esse cadastro, ignore esta mensagem.",
    ].join("\n"),
    html: emailTemplate({
      title: "Confirme seu e-mail",
      message:
        `Olá, ${username || "jogador"}! ` +
        "Clique no botão abaixo para confirmar seu e-mail e ativar sua conta. " +
        "O link é válido por 24 horas.",
      buttonText: "Confirmar meu e-mail",
      buttonUrl: verificationUrl,
    }),
  });
}

async function sendPasswordResetEmail({ to, username, token }) {
  
  const resetUrl =
    `${FRONTEND_BASE_URL}/reset-password.html?token=${encodeURIComponent(token)}`;


  return transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: "Pontinho Play — Recuperação de senha",
    text: [
      `Olá, ${username || "jogador"}!`,
      "",
      "Recebemos uma solicitação para redefinir sua senha no Pontinho Play.",
      "",
      resetUrl,
      "",
      "Se você não solicitou a redefinição, ignore esta mensagem.",
    ].join("\n"),
    html: emailTemplate({
      title: "Recuperação de senha",
      message:
        `Olá, ${username || "jogador"}! ` +
        "Recebemos uma solicitação para redefinir sua senha. " +
        "Clique no botão abaixo para escolher uma nova senha.",
      buttonText: "Redefinir minha senha",
      buttonUrl: resetUrl,
    }),
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
