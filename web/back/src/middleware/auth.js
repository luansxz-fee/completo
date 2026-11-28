const jwt = require('jsonwebtoken');
const UsuarioModel = require('../models/UserModel');
const { env } = require('../config/env');
const { verificacaoObrigatoria } = require('../services/emailService');

async function autenticar(req, res, next) {
  try {
    const cabecalho = req.headers.authorization;
    if (!cabecalho || !cabecalho.startsWith('Bearer ')) {
      return res.status(401).json({ sucesso: false, mensagem: 'Token não fornecido' });
    }
    const token = cabecalho.substring(7).trim();
    if (!token) {
      return res.status(401).json({ sucesso: false, mensagem: 'Token não fornecido' });
    }

    const decodificado = jwt.verify(token, env.jwtSecret);
    if (!decodificado?.id) {
      return res.status(401).json({ sucesso: false, mensagem: 'Token inválido' });
    }

    const usuario = await UsuarioModel.buscarPorId(decodificado.id);
    if (!usuario) {
      return res.status(401).json({ sucesso: false, mensagem: 'Usuário não encontrado' });
    }

    // Sessões antigas (de antes da verificação de e-mail) também precisam confirmar.
    if (!usuario.email_verificado && !verificacaoObrigatoria()) {
      await UsuarioModel.marcarEmailVerificado(usuario._id); // verificação dispensada: não trava a conta
      usuario.email_verificado = true;
    }
    if (!usuario.email_verificado) {
      return res.status(403).json({
        sucesso: false,
        codigo: 'EMAIL_NAO_VERIFICADO',
        requerVerificacao: true,
        email: usuario.email,
        mensagem: 'Confirme o seu e-mail para continuar.',
      });
    }

    req.usuarioId = usuario._id.toString();
    req.usuarioDoc = usuario;
    req.usuario = UsuarioModel.formatar(usuario);
    next();
  } catch (erro) {
    if (erro.name === 'TokenExpiredError') {
      return res.status(401).json({ sucesso: false, mensagem: 'Sessão expirada, faça login novamente' });
    }
    return res.status(401).json({ sucesso: false, mensagem: 'Token inválido' });
  }
}

module.exports = autenticar;
