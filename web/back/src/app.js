const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');

const { env } = require('./config/env');
const limites = require('./middleware/limites');
const { tratarErro, rotaNaoEncontrada } = require('./middleware/errorHandler');

const rotasAuth = require('./routes/authRoutes');
const rotasUsuarios = require('./routes/usuarioRoutes');
const rotasMedicamentos = require('./routes/medicationRoutes');
const rotasRegistros = require('./routes/logRoutes');
const rotasCuidadores = require('./routes/cuidadorRoutes');
const rotasNotificacoes = require('./routes/notificacaoRoutes');
const rotasInternas = require('./routes/internoRoutes');
const emailService = require('./services/emailService');
const pushService = require('./services/pushService');

function origemPermitida(origem) {
  if (!origem) return true; // app mobile, curl, health checks
  if (env.frontendUrls.includes(origem.replace(/\/$/, ''))) return true;
  if (!env.producao && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem)) return true;
  return false;
}

function criarApp() {
  const app = express();

  // Atrás do proxy do Render/Vercel: sem isso o rate limit enxerga o IP do proxy
  // (todos os usuários dividiriam o mesmo limite).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: (origem, cb) => cb(null, origemPermitida(origem)),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Paciente-Id'],
      maxAge: 86400,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use('/api', limites.geral);

  app.get('/api/health', (req, res) => {
    const bancoOk = mongoose.connection.readyState === 1;
    res.status(bancoOk ? 200 : 503).json({
      sucesso: bancoOk,
      servico: 'MedSync API',
      versao: '2.0.0',
      horario: new Date().toISOString(),
      banco: bancoOk ? 'conectado' : 'desconectado',
      email: emailService.escolherProvedor(),
      verificacaoEmail: emailService.verificacaoObrigatoria() ? 'obrigatoria' : 'dispensada',
      push: pushService.pushHabilitado() ? 'ativo' : 'inativo',
    });
  });

  app.use('/api/auth', rotasAuth);
  app.use('/api/usuarios', rotasUsuarios);
  app.use('/api/medicamentos', rotasMedicamentos);
  app.use('/api/registros', rotasRegistros);
  app.use('/api/cuidadores', rotasCuidadores);
  app.use('/api/notificacoes', rotasNotificacoes);
  app.use('/api/interno', rotasInternas);

  app.use(rotaNaoEncontrada);
  app.use(tratarErro);
  return app;
}

module.exports = { criarApp };
