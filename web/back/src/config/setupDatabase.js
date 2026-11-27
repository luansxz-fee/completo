const mongoose = require('mongoose');
const { env, validar } = require('./env');

require('../models/UserModel');
require('../models/CodigoModel');
require('../models/MedicationModel');
const RegistroDoseModel = require('../models/LogModel');
require('../models/VinculoModel');
require('../models/InscricaoPushModel');
require('../models/EnvioModel');

async function configurar() {
  console.log('MedSync - Configuração do banco de dados (MongoDB)');
  const problemas = validar();
  if (problemas.length) {
    console.error('Erro:\n - ' + problemas.join('\n - '));
    process.exit(1);
  }
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 15000 });
    console.log('Conexão estabelecida.');
    const removidas = await RegistroDoseModel.sincronizarIndices();
    console.log(`Registros duplicados consolidados: ${removidas}`);
    await mongoose.syncIndexes();
    console.log('Índices sincronizados.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (erro) {
    console.error('Erro ao configurar o MongoDB:', erro.message);
    process.exit(1);
  }
}

configurar();
