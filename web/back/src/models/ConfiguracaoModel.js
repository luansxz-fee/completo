const mongoose = require('mongoose');

/** Pares chave/valor guardados no banco (ex.: chaves VAPID geradas automaticamente). */
const configuracaoSchema = new mongoose.Schema(
  {
    chave: { type: String, required: true, unique: true },
    valor: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: 'criado_em', updatedAt: 'atualizado_em' } }
);

const Configuracao = mongoose.model('Configuracao', configuracaoSchema);

const ConfiguracaoModel = {
  async obter(chave) {
    const doc = await Configuracao.findOne({ chave }).lean();
    return doc ? doc.valor : null;
  },

  /**
   * Devolve o valor guardado; se não existir, grava `criar()` e devolve.
   * Seguro com várias instâncias subindo juntas: só uma grava, as outras leem a mesma.
   */
  async obterOuCriar(chave, criar) {
    const existente = await this.obter(chave);
    if (existente) return existente;
    try {
      await Configuracao.create({ chave, valor: criar() });
    } catch (erro) {
      if (erro?.code !== 11000) throw erro;
    }
    return this.obter(chave);
  },
};

module.exports = ConfiguracaoModel;
