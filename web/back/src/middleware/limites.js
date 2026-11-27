const rateLimit = require('express-rate-limit');

/**
 * Limitadores específicos por rota sensível.
 * (Antes, TODO o /api/auth dividia 20 requisições/15 min, incluindo o GET /auth/eu
 * chamado a cada carregamento de página — o usuário era bloqueado só de recarregar.)
 */
function criarLimitador({ janelaMin, max, mensagem, chave }) {
  return rateLimit({
    windowMs: janelaMin * 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 10000 : max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: chave,
    message: { sucesso: false, mensagem },
  });
}

const porIp = (req) => req.ip;
const porIpEEmail = (req) => `${req.ip}|${String(req.body?.email || '').toLowerCase()}`;

module.exports = {
  geral: criarLimitador({
    janelaMin: 15,
    max: 600,
    mensagem: 'Muitas requisições. Tente novamente em alguns minutos.',
    chave: porIp,
  }),
  login: criarLimitador({
    janelaMin: 15,
    max: 10,
    mensagem: 'Muitas tentativas de login. Aguarde 15 minutos.',
    chave: porIpEEmail,
  }),
  cadastro: criarLimitador({
    janelaMin: 60,
    max: 10,
    mensagem: 'Muitos cadastros deste endereço. Tente novamente mais tarde.',
    chave: porIp,
  }),
  codigos: criarLimitador({
    janelaMin: 15,
    max: 10,
    mensagem: 'Muitas tentativas. Aguarde 15 minutos.',
    chave: porIpEEmail,
  }),
};
