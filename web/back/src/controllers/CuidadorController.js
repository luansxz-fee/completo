const UsuarioModel = require('../models/UserModel');
const VinculoModel = require('../models/VinculoModel');
const MedicamentoModel = require('../models/MedicationModel');
const RegistroDoseModel = require('../models/LogModel');
const email = require('../services/emailService');

async function nomesPorId(ids) {
  const unicos = [...new Set(ids.filter(Boolean).map(String))];
  const usuarios = await Promise.all(unicos.map((id) => UsuarioModel.buscarPorId(id)));
  const mapa = {};
  for (const u of usuarios) if (u) mapa[u._id.toString()] = UsuarioModel.formatarPublico(u);
  return mapa;
}

const CuidadorController = {
  /** Pessoas que ajudam EU (sou o paciente). */
  async meusCuidadores(req, res, next) {
    try {
      const vinculos = await VinculoModel.listarDoPaciente(req.usuarioId);
      const nomes = await nomesPorId(vinculos.map((v) => v.cuidador_id));
      return res.json({
        sucesso: true,
        dados: vinculos.map((v) => VinculoModel.formatar(v, { cuidador: v.cuidador_id ? nomes[v.cuidador_id.toString()] : undefined })),
      });
    } catch (erro) {
      next(erro);
    }
  },

  async convidar(req, res, next) {
    try {
      const emailConvidado = String(req.body.email).toLowerCase().trim();
      if (emailConvidado === req.usuario.email) {
        return res.status(400).json({ sucesso: false, mensagem: 'Você não pode convidar a si mesmo.' });
      }

      const { vinculo, jaExistia } = await VinculoModel.convidar(
        req.usuarioId,
        emailConvidado,
        req.body.permissao || 'visualizar',
        req.body.apelido
      );
      if (jaExistia) {
        return res.status(409).json({
          sucesso: false,
          mensagem: vinculo.status === 'ativo' ? 'Esta pessoa já é sua cuidadora.' : 'Já existe um convite pendente para este e-mail.',
        });
      }

      let emailEnviado = true;
      try {
        await email.enviarConviteCuidador(emailConvidado, { paciente: req.usuario.nome, permissao: vinculo.permissao });
      } catch (erro) {
        emailEnviado = false;
        console.error('[CUIDADORES] falha ao enviar convite:', erro.message);
      }

      return res.status(201).json({
        sucesso: true,
        mensagem: emailEnviado
          ? 'Convite enviado por e-mail.'
          : 'Convite criado, mas o e-mail não pôde ser enviado. Avise a pessoa para abrir o MedSync.',
        emailEnviado,
        dados: VinculoModel.formatar(vinculo),
      });
    } catch (erro) {
      next(erro);
    }
  },

  async atualizar(req, res, next) {
    try {
      const vinculo = await VinculoModel.buscarPorId(req.params.id);
      if (!vinculo || vinculo.paciente_id.toString() !== req.usuarioId) {
        return res.status(404).json({ sucesso: false, mensagem: 'Vínculo não encontrado' });
      }
      if (req.body.permissao) vinculo.permissao = req.body.permissao;
      if (req.body.apelido !== undefined) vinculo.apelido = req.body.apelido || null;
      await vinculo.save();
      return res.json({ sucesso: true, dados: VinculoModel.formatar(vinculo) });
    } catch (erro) {
      next(erro);
    }
  },

  /** O paciente remove o cuidador OU o cuidador deixa de ajudar. */
  async revogar(req, res, next) {
    try {
      const vinculo = await VinculoModel.buscarPorId(req.params.id);
      const souPaciente = vinculo && vinculo.paciente_id.toString() === req.usuarioId;
      const souCuidador =
        vinculo && (vinculo.cuidador_id?.toString() === req.usuarioId || vinculo.cuidador_email === req.usuario.email);
      if (!vinculo || (!souPaciente && !souCuidador)) {
        return res.status(404).json({ sucesso: false, mensagem: 'Vínculo não encontrado' });
      }
      vinculo.status = 'revogado';
      await vinculo.save();
      return res.json({ sucesso: true, mensagem: 'Vínculo encerrado.' });
    } catch (erro) {
      next(erro);
    }
  },

  /** Convites que EU recebi (sou o possível cuidador). */
  async convitesRecebidos(req, res, next) {
    try {
      const convites = await VinculoModel.convitesParaEmail(req.usuario.email);
      const nomes = await nomesPorId(convites.map((v) => v.paciente_id));
      return res.json({
        sucesso: true,
        dados: convites.map((v) => VinculoModel.formatar(v, { paciente: nomes[v.paciente_id.toString()] })),
      });
    } catch (erro) {
      next(erro);
    }
  },

  async responderConvite(req, res, next) {
    try {
      const aceitar = req.path.endsWith('/aceitar');
      const vinculo = await VinculoModel.buscarPorId(req.params.id);
      // Só o dono do e-mail convidado (já verificado pelo middleware) pode responder.
      if (!vinculo || vinculo.cuidador_email !== req.usuario.email || vinculo.status !== 'pendente') {
        return res.status(404).json({ sucesso: false, mensagem: 'Convite não encontrado' });
      }
      if (aceitar) {
        vinculo.status = 'ativo';
        vinculo.cuidador_id = req.usuarioId;
        vinculo.aceito_em = new Date();
      } else {
        vinculo.status = 'recusado';
      }
      await vinculo.save();
      return res.json({
        sucesso: true,
        mensagem: aceitar ? 'Convite aceito. Você já pode acompanhar este paciente.' : 'Convite recusado.',
        dados: VinculoModel.formatar(vinculo),
      });
    } catch (erro) {
      next(erro);
    }
  },

  /** Pessoas que EU ajudo (sou o cuidador). */
  async meusPacientes(req, res, next) {
    try {
      const vinculos = await VinculoModel.pacientesDoCuidador(req.usuarioId);
      const nomes = await nomesPorId(vinculos.map((v) => v.paciente_id));
      return res.json({
        sucesso: true,
        dados: vinculos.map((v) => VinculoModel.formatar(v, { paciente: nomes[v.paciente_id.toString()] })),
      });
    } catch (erro) {
      next(erro);
    }
  },

  /** Resumo rápido de um paciente (cartão do painel do cuidador). */
  async resumoPaciente(req, res, next) {
    try {
      const { pacienteId } = req.params;
      const vinculo = await VinculoModel.buscarAtivo(pacienteId, req.usuarioId);
      if (!vinculo) return res.status(403).json({ sucesso: false, mensagem: 'Você não tem acesso a este paciente.' });

      const paciente = await UsuarioModel.buscarPorId(pacienteId);
      if (!paciente) return res.status(404).json({ sucesso: false, mensagem: 'Paciente não encontrado' });

      const fuso = paciente.fuso_horario;
      const [meds, hoje, dias7, dias30] = await Promise.all([
        MedicamentoModel.listarPorUsuario(pacienteId),
        RegistroDoseModel.listarHoje(pacienteId, fuso),
        RegistroDoseModel.taxaAdesao(pacienteId, 7, fuso),
        RegistroDoseModel.taxaAdesao(pacienteId, 30, fuso),
      ]);
      const ativos = meds.filter((m) => m.ativo);

      return res.json({
        sucesso: true,
        dados: {
          paciente: UsuarioModel.formatarPublico(paciente),
          permissao: vinculo.permissao,
          medicamentosAtivos: ativos.length,
          estoqueBaixo: ativos.filter((m) => m.estoqueAtual <= 5).length,
          dosesHoje: {
            tomadas: hoje.filter((l) => l.situacao === 'tomada').length,
            perdidas: hoje.filter((l) => l.situacao === 'perdida').length,
            puladas: hoje.filter((l) => l.situacao === 'pulada').length,
          },
          adesao: { dias7, dias30 },
        },
      });
    } catch (erro) {
      next(erro);
    }
  },
};

module.exports = CuidadorController;
