const mongoose = require('mongoose');

/**
 * Vínculo paciente ⇄ cuidador ("ajudante").
 *
 * O paciente convida pelo e-mail. O convite só pode ser aceito por uma conta
 * cujo e-mail JÁ foi verificado e é exatamente o e-mail convidado.
 *
 * permissao:
 *  - 'visualizar': vê medicamentos, doses e adesão e recebe alertas
 *  - 'gerenciar' : além disso registra doses e edita medicamentos
 */
const vinculoSchema = new mongoose.Schema(
  {
    paciente_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    cuidador_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null, index: true },
    cuidador_email: { type: String, required: true, lowercase: true, trim: true, index: true },
    apelido: { type: String, default: null, trim: true, maxlength: 60 },
    status: {
      type: String,
      enum: ['pendente', 'ativo', 'recusado', 'revogado'],
      default: 'pendente',
    },
    permissao: { type: String, enum: ['visualizar', 'gerenciar'], default: 'visualizar' },
    aceito_em: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'criado_em', updatedAt: 'atualizado_em' } }
);

vinculoSchema.index({ paciente_id: 1, cuidador_email: 1 }, { unique: true });

const Vinculo = mongoose.model('Vinculo', vinculoSchema);

const ehId = (id) => mongoose.Types.ObjectId.isValid(id);

const VinculoModel = {
  Vinculo,

  formatar(v, { paciente, cuidador } = {}) {
    return {
      id: v._id.toString(),
      pacienteId: v.paciente_id.toString(),
      cuidadorId: v.cuidador_id ? v.cuidador_id.toString() : null,
      cuidadorEmail: v.cuidador_email,
      apelido: v.apelido || null,
      status: v.status,
      permissao: v.permissao,
      criadoEm: v.criado_em,
      aceitoEm: v.aceito_em,
      paciente: paciente || undefined,
      cuidador: cuidador || undefined,
    };
  },

  async convidar(pacienteId, email, permissao, apelido) {
    const existente = await Vinculo.findOne({ paciente_id: pacienteId, cuidador_email: email });
    if (existente) {
      if (existente.status === 'ativo' || existente.status === 'pendente') {
        return { vinculo: existente, jaExistia: true };
      }
      // recusado/revogado: reabre como novo convite
      existente.status = 'pendente';
      existente.cuidador_id = null;
      existente.aceito_em = null;
      existente.permissao = permissao;
      existente.apelido = apelido || null;
      await existente.save();
      return { vinculo: existente, jaExistia: false };
    }
    const vinculo = await Vinculo.create({
      paciente_id: pacienteId,
      cuidador_email: email,
      permissao,
      apelido: apelido || null,
    });
    return { vinculo, jaExistia: false };
  },

  async listarDoPaciente(pacienteId) {
    return Vinculo.find({ paciente_id: pacienteId, status: { $in: ['pendente', 'ativo'] } })
      .sort({ criado_em: -1 })
      .lean();
  },

  async convitesParaEmail(email) {
    return Vinculo.find({ cuidador_email: email, status: 'pendente' }).sort({ criado_em: -1 }).lean();
  },

  async pacientesDoCuidador(cuidadorId) {
    return Vinculo.find({ cuidador_id: cuidadorId, status: 'ativo' }).sort({ aceito_em: -1 }).lean();
  },

  async buscarAtivo(pacienteId, cuidadorId) {
    if (!ehId(pacienteId) || !ehId(cuidadorId)) return null;
    return Vinculo.findOne({ paciente_id: pacienteId, cuidador_id: cuidadorId, status: 'ativo' }).lean();
  },

  async cuidadoresAtivos(pacienteId) {
    return Vinculo.find({ paciente_id: pacienteId, status: 'ativo', cuidador_id: { $ne: null } }).lean();
  },

  async buscarPorId(id) {
    if (!ehId(id)) return null;
    return Vinculo.findById(id);
  },

  async excluirDoUsuario(usuarioId) {
    if (!ehId(usuarioId)) return;
    await Vinculo.deleteMany({ $or: [{ paciente_id: usuarioId }, { cuidador_id: usuarioId }] });
  },
};

module.exports = VinculoModel;
