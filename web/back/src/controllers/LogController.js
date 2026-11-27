const RegistroDoseModel = require('../models/LogModel');
const MedicamentoModel = require('../models/MedicationModel');
const notificacao = require('../services/notificacaoService');
const { normalizarSituacao } = require('../utils/situacao');

const LIMITE_ESTOQUE_BAIXO = 5;

const RegistroDoseController = {
  async listar(req, res, next) {
    try {
      const dias = parseInt(req.query.dias, 10) || null;
      const registros = await RegistroDoseModel.listarPorUsuario(req.alvoId, { dias, fuso: req.alvoFuso });
      return res.json({ sucesso: true, dados: registros });
    } catch (erro) {
      next(erro);
    }
  },

  async hoje(req, res, next) {
    try {
      const registros = await RegistroDoseModel.listarHoje(req.alvoId, req.alvoFuso);
      return res.json({ sucesso: true, dados: registros });
    } catch (erro) {
      next(erro);
    }
  },

  async adesao(req, res, next) {
    try {
      const [dias7, dias30] = await Promise.all([
        RegistroDoseModel.taxaAdesao(req.alvoId, 7, req.alvoFuso),
        RegistroDoseModel.taxaAdesao(req.alvoId, 30, req.alvoFuso),
      ]);
      return res.json({ sucesso: true, dados: { dias7, dias30 } });
    } catch (erro) {
      next(erro);
    }
  },

  async salvar(req, res, next) {
    try {
      const { medicamentoId, horarioAgendado, observacao } = req.body;
      const situacao = normalizarSituacao(req.body.situacao);

      const medicamento = await MedicamentoModel.buscarUm(medicamentoId, req.alvoId);
      if (!medicamento) {
        return res.status(404).json({ sucesso: false, mensagem: 'Medicamento não encontrado' });
      }
      if (!medicamento.horarios.includes(horarioAgendado)) {
        return res.status(422).json({
          sucesso: false,
          mensagem: 'Este horário não faz parte do esquema do medicamento.',
        });
      }

      const resultado = await RegistroDoseModel.salvar(
        req.alvoId,
        medicamentoId,
        horarioAgendado,
        situacao,
        observacao || null,
        { fuso: req.alvoFuso, registradoPor: req.ehCuidador ? req.usuario.id : null }
      );

      // O estoque é ajustado AQUI (de forma atômica), não no navegador.
      let medAtualizado = medicamento;
      if (resultado.deltaEstoque !== 0) {
        medAtualizado = (await MedicamentoModel.ajustarEstoque(medicamentoId, req.alvoId, resultado.deltaEstoque)) || medicamento;

        const cruzou =
          resultado.deltaEstoque < 0 &&
          medicamento.estoqueAtual > LIMITE_ESTOQUE_BAIXO &&
          medAtualizado.estoqueAtual <= LIMITE_ESTOQUE_BAIXO;
        if (cruzou) notificacao.avisarEstoqueBaixo(req.alvoId, medAtualizado).catch(() => {});
      }

      return res.json({
        sucesso: true,
        mensagem: 'Dose registrada',
        dados: resultado.registro,
        medicamento: medAtualizado,
      });
    } catch (erro) {
      next(erro);
    }
  },
};

module.exports = RegistroDoseController;
