/**
 * Web Push (VAPID). Funciona em Chrome/Edge/Firefox/Android e, no iOS 16.4+,
 * para sites instalados na Tela de Início (PWA).
 */
const webpush = require('web-push');
const { env } = require('../config/env');
const InscricaoPushModel = require('../models/InscricaoPushModel');

let configurado = false;
let enviador = null; // permite trocar nos testes

function pushHabilitado() {
  return !!(env.vapidPublica && env.vapidPrivada);
}

function configurar() {
  if (configurado || !pushHabilitado()) return;
  webpush.setVapidDetails(env.vapidAssunto, env.vapidPublica, env.vapidPrivada);
  configurado = true;
}

function definirEnviador(fn) {
  enviador = fn;
}

/** Envia para todos os dispositivos do usuário. Devolve quantos receberam. */
async function enviarParaUsuario(usuarioId, payload) {
  if (!pushHabilitado() && !enviador) return 0;
  configurar();

  const inscricoes = await InscricaoPushModel.listar(usuarioId);
  let entregues = 0;

  await Promise.all(
    inscricoes.map(async (i) => {
      const alvo = { endpoint: i.endpoint, keys: { p256dh: i.chaves.p256dh, auth: i.chaves.auth } };
      try {
        if (enviador) await enviador(alvo, payload);
        else await webpush.sendNotification(alvo, JSON.stringify(payload), { TTL: 60 * 60, urgency: 'high' });
        entregues += 1;
      } catch (erro) {
        if (erro.statusCode === 404 || erro.statusCode === 410) {
          await InscricaoPushModel.removerPorEndpoint(i.endpoint); // inscrição expirada
        } else {
          console.error('[PUSH] falha:', erro.statusCode || '', erro.message);
        }
      }
    })
  );
  return entregues;
}

module.exports = { pushHabilitado, enviarParaUsuario, definirEnviador };
