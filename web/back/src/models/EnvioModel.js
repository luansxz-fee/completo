const mongoose = require('mongoose');

/**
 * Registro de notificações já enviadas. A chave única impede que o mesmo
 * lembrete seja enviado duas vezes (várias instâncias, reinício, cron + timer...).
 */
const envioSchema = new mongoose.Schema({
  chave: { type: String, required: true, unique: true },
  criado_em: { type: Date, default: Date.now, index: { expires: 60 * 60 * 24 * 4 } }, // some após 4 dias
});

const Envio = mongoose.model('EnvioNotificacao', envioSchema);

const EnvioModel = {
  /** true = é a primeira vez (pode enviar). false = já tinha sido enviado. */
  async reservar(chave) {
    try {
      await Envio.create({ chave });
      return true;
    } catch (erro) {
      if (erro?.code === 11000) return false;
      throw erro;
    }
  },

  /** Libera a chave caso o envio tenha falhado em todos os canais (para tentar de novo). */
  async liberar(chave) {
    await Envio.deleteOne({ chave });
  },
};

module.exports = EnvioModel;
