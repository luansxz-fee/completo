const mongoose = require('mongoose');
const { dataLocal, somarDias, FUSO_PADRAO } = require('../utils/tempo');

const registroDoseSchema = new mongoose.Schema(
  {
    medicamento_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicamento', required: true },
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    horario_agendado: { type: String, required: true },
    tomado_em: { type: Date, default: null },
    situacao: { type: String, required: true, enum: ['tomada', 'perdida', 'pulada', 'pendente'] },
    data_dose: { type: String, required: true }, // 'YYYY-MM-DD' no fuso do usuário
    observacao: { type: String, default: null },
    registrado_por: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
    automatico: { type: Boolean, default: false }, // true = marcada como perdida pelo servidor
  },
  { timestamps: { createdAt: 'criado_em', updatedAt: 'atualizado_em' } }
);

registroDoseSchema.index({ usuario_id: 1, data_dose: -1 });
// Uma única linha por dose agendada (impede duplicidade mesmo com concorrência).
registroDoseSchema.index(
  { usuario_id: 1, medicamento_id: 1, data_dose: 1, horario_agendado: 1 },
  { unique: true, name: 'dose_unica' }
);

const RegistroDose = mongoose.model('RegistroDose', registroDoseSchema);

const RegistroDoseModel = {
  RegistroDose,

  formatar(doc) {
    if (!doc) return null;
    return {
      id: doc._id.toString(),
      medicamentoId: doc.medicamento_id.toString(),
      usuarioId: doc.usuario_id.toString(),
      horarioAgendado: doc.horario_agendado,
      tomadoEm: doc.tomado_em ? new Date(doc.tomado_em).toISOString() : null,
      situacao: doc.situacao,
      dataDose: doc.data_dose,
      observacao: doc.observacao || null,
      registradoPor: doc.registrado_por ? doc.registrado_por.toString() : null,
      automatico: !!doc.automatico,
      criadoEm: doc.criado_em instanceof Date ? doc.criado_em.toISOString() : doc.criado_em,
    };
  },

  /**
   * Remove duplicatas antigas (de antes do índice único) mantendo a mais recente.
   * Roda na inicialização; é idempotente.
   */
  async sincronizarIndices() {
    const grupos = await RegistroDose.aggregate([
      {
        $group: {
          _id: {
            u: '$usuario_id',
            m: '$medicamento_id',
            d: '$data_dose',
            h: '$horario_agendado',
          },
          total: { $sum: 1 },
        },
      },
      { $match: { total: { $gt: 1 } } },
    ]);

    for (const grupo of grupos) {
      const docs = await RegistroDose.find({
        usuario_id: grupo._id.u,
        medicamento_id: grupo._id.m,
        data_dose: grupo._id.d,
        horario_agendado: grupo._id.h,
      })
        .sort({ atualizado_em: -1 })
        .select('_id')
        .lean();
      await RegistroDose.deleteMany({ _id: { $in: docs.slice(1).map((x) => x._id) } });
    }
    const duplicadas = grupos;
    await RegistroDose.createIndexes();
    return duplicadas.length;
  },

  async listarPorUsuario(usuarioId, { dias, fuso = FUSO_PADRAO } = {}) {
    if (!mongoose.Types.ObjectId.isValid(usuarioId)) return [];
    const filtro = { usuario_id: usuarioId };
    const n = Number(dias);
    if (Number.isFinite(n) && n > 0) {
      filtro.data_dose = { $gte: somarDias(dataLocal(fuso), -n) };
    }
    const docs = await RegistroDose.find(filtro)
      .sort({ data_dose: -1, horario_agendado: -1 })
      .limit(5000);
    return docs.map((d) => this.formatar(d));
  },

  async listarHoje(usuarioId, fuso = FUSO_PADRAO) {
    if (!mongoose.Types.ObjectId.isValid(usuarioId)) return [];
    const docs = await RegistroDose.find({
      usuario_id: usuarioId,
      data_dose: dataLocal(fuso),
    }).sort({ horario_agendado: 1 });
    return docs.map((d) => this.formatar(d));
  },

  async buscarDoses(usuarioId, datas) {
    if (!mongoose.Types.ObjectId.isValid(usuarioId)) return [];
    return RegistroDose.find({ usuario_id: usuarioId, data_dose: { $in: datas } }).lean();
  },

  /**
   * Cria ou atualiza o registro de UMA dose.
   * Devolve { registro, deltaEstoque }: -1 quando passa a "tomada", +1 quando
   * deixa de ser "tomada". O controller aplica o delta no estoque (no servidor,
   * e não no navegador, para não duplicar).
   */
  async salvar(
    usuarioId,
    medicamentoId,
    horarioAgendado,
    situacao,
    observacao = null,
    { fuso = FUSO_PADRAO, dataDose, registradoPor = null, automatico = false } = {}
  ) {
    if (
      !mongoose.Types.ObjectId.isValid(usuarioId) ||
      !mongoose.Types.ObjectId.isValid(medicamentoId)
    ) {
      return null;
    }

    const dia = dataDose || dataLocal(fuso);
    const filtro = {
      usuario_id: usuarioId,
      medicamento_id: medicamentoId,
      data_dose: dia,
      horario_agendado: horarioAgendado,
    };

    const anterior = await RegistroDose.findOne(filtro).lean();
    const estavaTomada = anterior?.situacao === 'tomada';
    const ficaTomada = situacao === 'tomada';

    const dados = {
      situacao,
      tomado_em: ficaTomada ? (estavaTomada && anterior.tomado_em ? anterior.tomado_em : new Date()) : null,
      observacao,
      registrado_por: registradoPor,
      automatico,
    };

    const executar = () =>
      RegistroDose.findOneAndUpdate(
        filtro,
        { $set: dados },
        { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
      );

    let registro;
    try {
      registro = await executar();
    } catch (erro) {
      if (erro?.code === 11000) registro = await executar(); // corrida: tenta de novo
      else throw erro;
    }

    const deltaEstoque = ficaTomada && !estavaTomada ? -1 : !ficaTomada && estavaTomada ? 1 : 0;
    return { registro: this.formatar(registro), deltaEstoque };
  },

  /**
   * Marcação automática de dose perdida. Usa $setOnInsert: se o usuário
   * registrou a dose no meio tempo, NADA é sobrescrito. true = criou.
   */
  async marcarPerdidaSeAusente(usuarioId, medicamentoId, horarioAgendado, dataDose) {
    try {
      const filtroDose = {
        usuario_id: usuarioId,
        medicamento_id: medicamentoId,
        data_dose: dataDose,
        horario_agendado: horarioAgendado,
      };
      // dose desfeita pelo usuário (pendente) e que passou da tolerância → perdida
      const virou = await RegistroDose.updateOne(
        { ...filtroDose, situacao: 'pendente' },
        { $set: { situacao: 'perdida', automatico: true } }
      );
      if ((virou.modifiedCount || 0) > 0) return true;

      const r = await RegistroDose.updateOne(
        filtroDose,
        { $setOnInsert: { situacao: 'perdida', tomado_em: null, observacao: null, automatico: true } },
        { upsert: true }
      );
      return (r.upsertedCount || 0) > 0;
    } catch (erro) {
      if (erro?.code === 11000) return false;
      throw erro;
    }
  },

  /**
   * Adesão = tomadas / (tomadas + perdidas + puladas) na janela.
   * Doses ainda pendentes não contam. Sem dados → null (a tela mostra "—",
   * em vez de fingir 100%).
   */
  async taxaAdesao(usuarioId, dias = 7, fuso = FUSO_PADRAO) {
    if (!mongoose.Types.ObjectId.isValid(usuarioId)) return null;
    const n = Number(dias);
    if (!Number.isFinite(n) || n <= 0) return null;

    const desde = somarDias(dataLocal(fuso), -(n - 1));
    const base = { usuario_id: usuarioId, data_dose: { $gte: desde } };

    const [tomadas, perdidas, puladas] = await Promise.all([
      RegistroDose.countDocuments({ ...base, situacao: 'tomada' }),
      RegistroDose.countDocuments({ ...base, situacao: 'perdida' }),
      RegistroDose.countDocuments({ ...base, situacao: 'pulada' }),
    ]);
    const total = tomadas + perdidas + puladas;
    if (total === 0) return null;
    return Math.round((tomadas / total) * 100);
  },

  async excluirPorMedicamento(medicamentoId, usuarioId) {
    if (
      !mongoose.Types.ObjectId.isValid(medicamentoId) ||
      !mongoose.Types.ObjectId.isValid(usuarioId)
    ) {
      return;
    }
    await RegistroDose.deleteMany({ medicamento_id: medicamentoId, usuario_id: usuarioId });
  },

  async excluirPorUsuario(usuarioId) {
    if (!mongoose.Types.ObjectId.isValid(usuarioId)) return;
    await RegistroDose.deleteMany({ usuario_id: usuarioId });
  },
};

module.exports = RegistroDoseModel;
