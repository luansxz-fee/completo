/**
 * Leitura e validação central das variáveis de ambiente.
 */
require('dotenv').config();

const producao = process.env.NODE_ENV === 'production';

function inteiro(nome, padrao) {
  const n = parseInt(process.env[nome] ?? '', 10);
  return Number.isFinite(n) ? n : padrao;
}

const env = {
  producao,
  porta: inteiro('PORT', 3001),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpira: process.env.JWT_EXPIRES_IN || '7d',
  bcryptRounds: inteiro('BCRYPT_ROUNDS', 12),
  frontendUrls: (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),

  // Lembretes
  schedulerAtivo: process.env.SCHEDULER_ATIVO !== 'false',
  cronSecret: process.env.CRON_SECRET || '',
  toleranciaPerdidaMin: inteiro('TOLERANCIA_PERDIDA_MIN', 120),
  alertaCuidadorMin: inteiro('ALERTA_CUIDADOR_MIN', 30),

  // Web Push
  vapidPublica: process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivada: process.env.VAPID_PRIVATE_KEY || '',
  vapidAssunto: process.env.VAPID_SUBJECT || 'mailto:contato@medsync.app',
};

function validar() {
  const problemas = [];
  if (!env.mongoUri) problemas.push('MONGODB_URI não definida.');
  if (!env.jwtSecret) problemas.push('JWT_SECRET não definida.');
  else if (env.jwtSecret.length < 32) {
    problemas.push('JWT_SECRET precisa ter pelo menos 32 caracteres.');
  }
  return problemas;
}

module.exports = { env, validar };
