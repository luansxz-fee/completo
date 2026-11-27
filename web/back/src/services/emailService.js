/**
 * Envio de e-mails.
 *
 * Provedores (escolhidos por EMAIL_PROVIDER ou automaticamente pelas chaves):
 *   - brevo   : API HTTPS (BREVO_API_KEY)  → recomendado: 300 e-mails/dia grátis
 *               e permite remetente verificado (ex.: seu Gmail), sem domínio próprio.
 *   - resend  : API HTTPS (RESEND_API_KEY) → exige domínio verificado para enviar a terceiros.
 *   - smtp    : nodemailer (EMAIL_USUARIO / EMAIL_SENHA)
 *               ATENÇÃO: o plano gratuito do Render bloqueia as portas SMTP (25/465/587).
 *   - console : não envia; escreve no log (somente desenvolvimento/testes).
 */
const nodemailer = require('nodemailer');
const { env } = require('../config/env');

const ultimosEmails = []; // usado pelos testes automatizados

function escolherProvedor() {
  const explicito = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  if (['brevo', 'resend', 'smtp', 'console'].includes(explicito)) return explicito;
  if (process.env.BREVO_API_KEY) return 'brevo';
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.EMAIL_USUARIO && process.env.EMAIL_SENHA) return 'smtp';
  return 'console';
}

function emailConfigurado() {
  return escolherProvedor() !== 'console';
}

function remetente() {
  const bruto = process.env.EMAIL_REMETENTE || `MedSync <${process.env.EMAIL_USUARIO || 'nao-responda@medsync.app'}>`;
  const m = bruto.match(/^\s*(.*?)\s*<(.+?)>\s*$/);
  return m ? { nome: m[1].replace(/^"|"$/g, '') || 'MedSync', email: m[2] } : { nome: 'MedSync', email: bruto.trim() };
}

function escapar(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function enviarPorBrevo({ para, assunto, html, texto }) {
  const de = remetente();
  const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: de.nome, email: de.email },
      to: [{ email: para }],
      subject: assunto,
      htmlContent: html,
      textContent: texto,
    }),
  });
  if (!resposta.ok) {
    throw new Error(`Brevo respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 300)}`);
  }
  return resposta.json().catch(() => ({}));
}

async function enviarPorResend({ para, assunto, html, texto }) {
  const de = remetente();
  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: `${de.nome} <${de.email}>`, to: [para], subject: assunto, html, text: texto }),
  });
  if (!resposta.ok) {
    throw new Error(`Resend respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 300)}`);
  }
  return resposta.json().catch(() => ({}));
}

async function enviarPorSmtp({ para, assunto, html, texto }) {
  const de = remetente();
  const porta = parseInt(process.env.EMAIL_PORT || '587', 10);
  const transportador = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: porta,
    secure: process.env.EMAIL_SEGURO === 'true' || porta === 465,
    auth: { user: process.env.EMAIL_USUARIO, pass: process.env.EMAIL_SENHA },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return transportador.sendMail({
    from: `"${de.nome}" <${de.email}>`,
    to: para,
    subject: assunto,
    text: texto,
    html,
  });
}

async function enviar({ para, assunto, html, texto }) {
  const provedor = escolherProvedor();
  const msg = { para, assunto, html, texto };

  if (provedor === 'console') {
    ultimosEmails.push({ ...msg, em: new Date() });
    if (ultimosEmails.length > 50) ultimosEmails.shift();
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[E-MAIL/console] Para: ${para} | Assunto: ${assunto}\n${texto}\n`);
    }
    return { provedor };
  }

  if (provedor === 'brevo') await enviarPorBrevo(msg);
  else if (provedor === 'resend') await enviarPorResend(msg);
  else await enviarPorSmtp(msg);

  console.log(`[E-MAIL/${provedor}] enviado para ${para}: ${assunto}`);
  return { provedor };
}

/* ---------------------------------------------------------------- *
 * Layout comum dos e-mails
 * ---------------------------------------------------------------- */
function layout({ titulo, introducao, codigo, rodapeCodigo, botao, extra }) {
  const blocoCodigo = codigo
    ? `<div style="background:#EFF6FF;border:2px dashed #2563EB;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
         <div style="font-size:36px;font-weight:800;color:#1D4ED8;letter-spacing:0.25em;font-family:monospace;">${escapar(codigo)}</div>
         <div style="font-size:12px;color:#64748B;margin-top:8px;">${escapar(rodapeCodigo || '')}</div>
       </div>`
    : '';
  const blocoBotao = botao
    ? `<p style="text-align:center;margin:0 0 24px;"><a href="${escapar(botao.url)}" style="background:#2563EB;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;display:inline-block;">${escapar(botao.texto)}</a></p>`
    : '';
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapar(titulo)}</title></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
<tr><td style="background:#1D4ED8;padding:28px 40px;text-align:center;"><span style="font-size:24px;font-weight:800;color:#fff;">MedSync</span></td></tr>
<tr><td style="padding:36px 40px 16px;">
<h1 style="margin:0 0 12px;font-size:20px;color:#0F172A;">${escapar(titulo)}</h1>
<p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.6;">${introducao}</p>
${blocoCodigo}${blocoBotao}${extra || ''}
<hr style="border:none;border-top:1px solid #E2E8F0;margin:8px 0 20px;">
<p style="margin:0;color:#94A3B8;font-size:12px;text-align:center;line-height:1.6;">Este e-mail foi enviado automaticamente pelo MedSync. Não responda a esta mensagem.</p>
</td></tr></table></td></tr></table></body></html>`;
}

const primeiroNome = (nome) => escapar(String(nome || '').trim().split(' ')[0] || 'olá');

/* ---------------------------------------------------------------- *
 * E-mails do sistema
 * ---------------------------------------------------------------- */
async function enviarCodigoVerificacao(destino, nome, codigo) {
  return enviar({
    para: destino,
    assunto: `${codigo} é o seu código de verificação do MedSync`,
    html: layout({
      titulo: 'Confirme o seu e-mail',
      introducao: `Olá, ${primeiroNome(nome)}! Para ativar a sua conta, digite o código abaixo no MedSync.`,
      codigo,
      rodapeCodigo: 'Válido por 15 minutos',
    }),
    texto: `Olá, ${String(nome).split(' ')[0]}!\n\nSeu código de verificação do MedSync é: ${codigo}\nEle vale por 15 minutos.\n\nSe você não criou uma conta, ignore este e-mail.`,
  });
}

async function enviarEmailRecuperacao(destino, nome, codigo) {
  return enviar({
    para: destino,
    assunto: `Código de recuperação de senha do MedSync: ${codigo}`,
    html: layout({
      titulo: 'Recuperação de senha',
      introducao: `Olá, ${primeiroNome(nome)}. Recebemos um pedido para redefinir a senha da sua conta. Use o código abaixo para criar uma nova senha. Se não foi você, ignore este e-mail: sua senha continua a mesma.`,
      codigo,
      rodapeCodigo: 'Válido por 1 hora',
    }),
    texto: `Olá, ${String(nome).split(' ')[0]}.\n\nSeu código de recuperação de senha é: ${codigo}\nEle vale por 1 hora.\n\nSe não foi você, ignore este e-mail.`,
  });
}

async function enviarLembreteDose(destino, nome, { medicamento, dosagem, horario, repeticao }) {
  const titulo = repeticao ? 'Você ainda não registrou a dose' : 'Hora do seu medicamento';
  return enviar({
    para: destino,
    assunto: `${repeticao ? '⏰ Lembrando: ' : '💊 '}${medicamento} às ${horario}`,
    html: layout({
      titulo,
      introducao: `Olá, ${primeiroNome(nome)}. É hora de tomar <strong>${escapar(medicamento)}</strong> (${escapar(dosagem)}), agendado para as <strong>${escapar(horario)}</strong>. Depois de tomar, registre no MedSync.`,
      botao: { texto: 'Abrir o MedSync', url: env.frontendUrls[0] },
    }),
    texto: `Olá, ${String(nome).split(' ')[0]}. Hora de tomar ${medicamento} (${dosagem}) — ${horario}. Registre no MedSync: ${env.frontendUrls[0]}`,
  });
}

async function enviarAlertaCuidador(destino, nomeCuidador, { paciente, medicamento, horario }) {
  return enviar({
    para: destino,
    assunto: `⚠️ ${paciente} ainda não registrou ${medicamento} (${horario})`,
    html: layout({
      titulo: 'Dose não confirmada',
      introducao: `Olá, ${primeiroNome(nomeCuidador)}. <strong>${escapar(paciente)}</strong> ainda não confirmou a dose de <strong>${escapar(medicamento)}</strong> das <strong>${escapar(horario)}</strong>. Vale conferir se está tudo bem.`,
      botao: { texto: 'Abrir o MedSync', url: env.frontendUrls[0] },
    }),
    texto: `${paciente} ainda não confirmou ${medicamento} das ${horario}. Abra o MedSync: ${env.frontendUrls[0]}`,
  });
}

async function enviarConviteCuidador(destino, { paciente, permissao }) {
  const acao = permissao === 'gerenciar' ? 'acompanhar e ajudar a gerenciar' : 'acompanhar';
  return enviar({
    para: destino,
    assunto: `${paciente} convidou você para ajudar no MedSync`,
    html: layout({
      titulo: 'Você recebeu um convite',
      introducao: `<strong>${escapar(paciente)}</strong> convidou você para ${acao} os medicamentos dela(e) no MedSync. Entre (ou crie uma conta com este e-mail) e aceite o convite na página <strong>Cuidadores</strong>.`,
      botao: { texto: 'Abrir o MedSync', url: env.frontendUrls[0] },
    }),
    texto: `${paciente} convidou você para ${acao} os medicamentos no MedSync. Acesse ${env.frontendUrls[0]} e aceite o convite na página Cuidadores.`,
  });
}

async function enviarEstoqueBaixo(destino, nome, { medicamento, restante }) {
  return enviar({
    para: destino,
    assunto: `📦 Estoque baixo: ${medicamento}`,
    html: layout({
      titulo: 'Estoque baixo',
      introducao: `Olá, ${primeiroNome(nome)}. Restam apenas <strong>${escapar(restante)}</strong> unidade(s) de <strong>${escapar(medicamento)}</strong>. Lembre-se de repor.`,
      botao: { texto: 'Abrir o MedSync', url: env.frontendUrls[0] },
    }),
    texto: `Restam ${restante} unidade(s) de ${medicamento}. Lembre-se de repor.`,
  });
}

module.exports = {
  enviar,
  emailConfigurado,
  escolherProvedor,
  ultimosEmails,
  enviarCodigoVerificacao,
  enviarEmailRecuperacao,
  enviarLembreteDose,
  enviarAlertaCuidador,
  enviarConviteCuidador,
  enviarEstoqueBaixo,
};
