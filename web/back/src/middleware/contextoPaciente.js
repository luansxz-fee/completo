const mongoose = require('mongoose');
const VinculoModel = require('../models/VinculoModel');

/**
 * Permite que um cuidador atue "como" o paciente nas rotas de medicamentos e registros.
 *
 * O front envia o cabeçalho  X-Paciente-Id: <id do paciente>.
 *  - sem cabeçalho (ou o próprio id) → o usuário age sobre os próprios dados
 *  - com cabeçalho → exige vínculo ATIVO; leitura para qualquer permissão,
 *    escrita somente com permissão "gerenciar".
 *
 * Os controllers usam req.alvoId em vez de req.usuario.id.
 */
async function contextoPaciente(req, res, next) {
  try {
    const alvo = req.headers['x-paciente-id'];

    if (!alvo || alvo === req.usuario.id) {
      req.alvoId = req.usuario.id;
      req.alvoFuso = req.usuario.fusoHorario;
      req.ehCuidador = false;
      return next();
    }

    if (!mongoose.Types.ObjectId.isValid(alvo)) {
      return res.status(400).json({ sucesso: false, mensagem: 'Paciente inválido' });
    }

    const vinculo = await VinculoModel.buscarAtivo(alvo, req.usuario.id);
    if (!vinculo) {
      return res.status(403).json({ sucesso: false, mensagem: 'Você não tem acesso a este paciente.' });
    }

    const escrita = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (escrita && vinculo.permissao !== 'gerenciar') {
      return res.status(403).json({
        sucesso: false,
        mensagem: 'Seu acesso a este paciente é somente de visualização.',
      });
    }

    const UsuarioModel = require('../models/UserModel');
    const paciente = await UsuarioModel.buscarPorId(alvo);
    if (!paciente) {
      return res.status(404).json({ sucesso: false, mensagem: 'Paciente não encontrado' });
    }

    req.alvoId = alvo;
    req.alvoFuso = paciente.fuso_horario;
    req.alvoDoc = paciente;
    req.ehCuidador = true;
    req.permissaoCuidador = vinculo.permissao;
    next();
  } catch (erro) {
    next(erro);
  }
}

module.exports = contextoPaciente;
