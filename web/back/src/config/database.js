const mongoose = require('mongoose');
const { env } = require('./env');

async function conectarBanco() {
  if (!env.mongoUri) throw new Error('MONGODB_URI não foi definida.');

  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log('Conexão com o MongoDB estabelecida com sucesso!');

  // Garante que TODOS os índices (inclusive os únicos que evitam envios/doses duplicados)
  // existam antes de a API aceitar tráfego.
  await Promise.all(
    Object.values(mongoose.models).map((m) =>
      m.init().catch((erro) => console.error(`Aviso: índice de ${m.modelName}:`, erro.message))
    )
  );

  // Remove doses duplicadas antigas e cria o índice único.
  try {
    const RegistroDoseModel = require('../models/LogModel');
    const removidas = await RegistroDoseModel.sincronizarIndices();
    if (removidas) console.log(`Registros duplicados consolidados: ${removidas}`);
  } catch (erro) {
    console.error('Aviso: não foi possível sincronizar índices de registros:', erro.message);
  }
}

module.exports = conectarBanco;
