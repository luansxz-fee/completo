const router = require('express').Router();
const crypto = require('crypto');
const { env } = require('../config/env');
const { processarSeguro } = require('../services/lembreteService');
const email = require('../services/emailService');
const push = require('../services/pushService');

/**
 * Gatilho externo do agendador. Use um serviço gratuito de "cron" (ex.: cron-job.org)
 * chamando esta URL a cada minuto. Isso também mantém o plano gratuito do Render
 * acordado e garante que os lembretes saiam no horário.
 *
 *   GET/POST /api/interno/lembretes     (cabeçalho  x-cron-secret: <CRON_SECRET>)
 *   GET      /api/interno/lembretes?segredo=<CRON_SECRET>   (para serviços que só fazem GET simples)
 */
function seguro(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

async function executar(req, res) {
  if (!env.cronSecret) {
    return res.status(503).json({ sucesso: false, mensagem: 'CRON_SECRET não configurado no servidor.' });
  }
  const enviado = req.headers['x-cron-secret'] || req.query.segredo || '';
  if (!seguro(enviado, env.cronSecret)) {
    return res.status(401).json({ sucesso: false, mensagem: 'Não autorizado' });
  }
  const resumo = await processarSeguro();
  return res.json({ sucesso: true, ocupado: resumo === null, resumo });
}

/**
 * Diagnóstico para quem administra o servidor (use o mesmo CRON_SECRET):
 *   GET /api/interno/diagnostico?segredo=...                   → estado do e-mail e do push
 *   GET /api/interno/diagnostico?segredo=...&enviarPara=a@b.c  → também envia um e-mail de teste
 */
async function diagnosticar(req, res) {
  if (!env.cronSecret) return res.status(503).json({ sucesso: false, mensagem: 'CRON_SECRET não configurado no servidor.' });
  const enviado = req.headers['x-cron-secret'] || req.query.segredo || '';
  if (!seguro(enviado, env.cronSecret)) return res.status(401).json({ sucesso: false, mensagem: 'Não autorizado' });

  const resposta = { sucesso: true, email: email.diagnostico(), push: { ativo: push.pushHabilitado() } };
  const para = String(req.query.enviarPara || '').trim();
  if (para) {
    try {
      await email.enviar({
        para,
        assunto: '✅ Teste do MedSync',
        texto: 'Se você recebeu este e-mail, o envio do MedSync está funcionando para qualquer endereço.',
        html: '<p>Se você recebeu este e-mail, o envio do MedSync está funcionando para qualquer endereço. ✅</p>',
      });
      resposta.testeEmail = { enviadoPara: para, ok: true };
    } catch (erro) {
      resposta.testeEmail = { enviadoPara: para, ok: false, erro: erro.message };
    }
  }
  return res.json(resposta);
}

router.get('/diagnostico', diagnosticar);
router.get('/lembretes', executar);
router.post('/lembretes', executar);

module.exports = router;
