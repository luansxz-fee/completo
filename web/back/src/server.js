const { env, validar } = require('./config/env');
const conectarBanco = require('./config/database');
const { criarApp } = require('./app');
const { iniciarAgendador, pararAgendador } = require('./services/lembreteService');
const { pushHabilitado } = require('./services/pushService');
const { escolherProvedor } = require('./services/emailService');
const mongoose = require('mongoose');

async function iniciar() {
  const problemas = validar();
  if (problemas.length) {
    console.error('Configuração inválida:\n - ' + problemas.join('\n - '));
    process.exit(1);
  }

  await conectarBanco();
  const app = criarApp();

  const servidor = app.listen(env.porta, '0.0.0.0', () => {
    console.log(`MedSync API rodando na porta ${env.porta} (${env.producao ? 'produção' : 'desenvolvimento'})`);
    console.log(`E-mail: ${escolherProvedor()} | Web Push: ${pushHabilitado() ? 'ativo' : 'desativado (sem chaves VAPID)'}`);
    if (env.producao && escolherProvedor() === 'console') {
      console.warn('ATENÇÃO: nenhum provedor de e-mail configurado — os códigos NÃO chegarão aos usuários.');
    }
    if (env.producao && escolherProvedor() === 'smtp') {
      console.warn('ATENÇÃO: o plano gratuito do Render bloqueia SMTP. Prefira BREVO_API_KEY (veja o README).');
    }
  });

  iniciarAgendador();

  const encerrar = async (sinal) => {
    console.log(`${sinal} recebido, encerrando...`);
    pararAgendador();
    servidor.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 8000).unref();
  };
  process.on('SIGTERM', () => encerrar('SIGTERM'));
  process.on('SIGINT', () => encerrar('SIGINT'));
}

iniciar().catch((erro) => {
  console.error('Falha ao iniciar o MedSync:', erro.message);
  process.exit(1);
});
