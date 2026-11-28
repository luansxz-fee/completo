/**
 * Web Push (VAPID). Funciona em Chrome/Edge/Firefox/Android e, no iOS 16.4+,
 * para sites instalados na Tela de Início (PWA).
 *
 * As chaves VAPID são GERADAS AUTOMATICAMENTE na primeira inicialização e guardadas
 * no banco: ninguém precisa rodar comando nem editar variáveis de ambiente.
 * (Se VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY existirem no ambiente, elas têm prioridade.)
 */
const webpush = require('web-push');
const { env } = require('../config/env');
const InscricaoPushModel = require('../models/InscricaoPushModel');
const ConfiguracaoModel = require('../models/ConfiguracaoModel');

let chaves = null; // { publica, privada }
let configurado = false;
let enviador = null; // permite trocar nos testes

async function iniciar() {
  if (env.vapidPublica && env.vapidPrivada) {
    chaves = { publica: env.vapidPublica, privada: env.vapidPrivada, origem: 'ambiente' };
  } else {
    const salvo = await ConfiguracaoModel.obterOuCriar('vapid', () => {
      const par = webpush.generateVAPIDKeys();
      return { publica: par.publicKey, privada: par.privateKey };
    });
    chaves = { publica: salvo.publica, privada: salvo.privada, origem: 'banco' };
  }
  configurado = false;
  return chaves.origem;
}

function pushHabilitado() {
  return !!chaves;
}

function chavePublica() {
  return chaves ? chaves.publica : null;
}

function configurar() {
  if (configurado || !chaves) return;
  webpush.setVapidDetails(env.vapidAssunto, chaves.publica, chaves.privada);
  configurado = true;
}

function definirEnviador(fn) {
  enviador = fn;
}

/** Envia para todos os dispositivos do usuário. Devolve quantos receberam. */
async function enviarParaUsuario(usuarioId, payload) {
  if (!chaves && !enviador) return 0;
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
        // 404/410: inscrição expirada · 401/403: inscrita com outra chave VAPID → descartar;
        // o site se inscreve de novo sozinho na próxima visita.
        if ([401, 403, 404, 410].includes(erro.statusCode)) {
          await InscricaoPushModel.removerPorEndpoint(i.endpoint);
        } else {
          console.error('[PUSH] falha:', erro.statusCode || '', erro.message);
        }
      }
    })
  );
  return entregues;
}

module.exports = { iniciar, pushHabilitado, chavePublica, enviarParaUsuario, definirEnviador };
