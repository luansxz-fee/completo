const UsuarioModel = require('../models/UserModel');
const VinculoModel = require('../models/VinculoModel');

const UsuarioController = {
  /**
   * Dados de um usuário. Antes, qualquer pessoa logada podia consultar qualquer id
   * (vazando nome e e-mail). Agora: o próprio usuário recebe tudo; quem tem vínculo
   * ativo (cuidador ⇄ paciente) recebe apenas nome e avatar.
   */
  async buscarPorId(req, res, next) {
    try {
      const { id } = req.params;
      if (id === req.usuarioId) {
        return res.json({ sucesso: true, usuario: req.usuario });
      }

      const relacionados =
        (await VinculoModel.buscarAtivo(id, req.usuarioId)) || (await VinculoModel.buscarAtivo(req.usuarioId, id));
      if (!relacionados) {
        return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado' });
      }

      const usuario = await UsuarioModel.buscarPorId(id);
      if (!usuario) return res.status(404).json({ sucesso: false, mensagem: 'Usuário não encontrado' });
      return res.json({ sucesso: true, usuario: UsuarioModel.formatarPublico(usuario) });
    } catch (erro) {
      next(erro);
    }
  },
};

module.exports = UsuarioController;
