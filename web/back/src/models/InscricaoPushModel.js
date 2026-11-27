const mongoose = require('mongoose');

/** Inscrição Web Push (um navegador/dispositivo de um usuário). */
const inscricaoSchema = new mongoose.Schema(
  {
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    chaves: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    dispositivo: { type: String, default: null, maxlength: 200 },
  },
  { timestamps: { createdAt: 'criado_em', updatedAt: 'atualizado_em' } }
);

const Inscricao = mongoose.model('InscricaoPush', inscricaoSchema);

const InscricaoPushModel = {
  async salvar(usuarioId, { endpoint, keys }, dispositivo) {
    return Inscricao.findOneAndUpdate(
      { endpoint },
      {
        $set: {
          usuario_id: usuarioId, // se outro usuário usar o mesmo navegador, o endpoint muda de dono
          chaves: { p256dh: keys.p256dh, auth: keys.auth },
          dispositivo: dispositivo ? String(dispositivo).slice(0, 200) : null,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  },

  async listar(usuarioId) {
    return Inscricao.find({ usuario_id: usuarioId }).lean();
  },

  async remover(usuarioId, endpoint) {
    await Inscricao.deleteOne({ usuario_id: usuarioId, endpoint });
  },

  async removerPorEndpoint(endpoint) {
    await Inscricao.deleteOne({ endpoint });
  },

  async removerDoUsuario(usuarioId) {
    await Inscricao.deleteMany({ usuario_id: usuarioId });
  },
};

module.exports = InscricaoPushModel;
