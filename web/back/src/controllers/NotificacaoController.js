const InscricaoPushModel = require('../models/InscricaoPushModel');
const { pushHabilitado, chavePublica } = require('../services/pushService');
const notificacao = require('../services/notificacaoService');
const email = require('../services/emailService');

const NotificacaoController = {
  chavePublica(req, res) {
    res.json({ sucesso: true, habilitado: pushHabilitado(), chave: chavePublica() });
  },

  async status(req, res, next) {
    try {
      const inscricoes = await InscricaoPushModel.listar(req.usuarioId);
      res.json({
        sucesso: true,
        push: { servidorHabilitado: pushHabilitado(), dispositivos: inscricoes.length },
        email: { configurado: email.emailConfigurado(), provedor: email.escolherProvedor() },
        preferencias: req.usuario.notificacoes,
      });
    } catch (erro) {
      next(erro);
    }
  },

  async inscrever(req, res, next) {
    try {
      if (!pushHabilitado()) {
        return res.status(503).json({ sucesso: false, mensagem: 'Notificações push não estão habilitadas no servidor.' });
      }
      await InscricaoPushModel.salvar(req.usuarioId, req.body.subscription, req.body.dispositivo);
      res.status(201).json({ sucesso: true, mensagem: 'Dispositivo inscrito.' });
    } catch (erro) {
      next(erro);
    }
  },

  async cancelar(req, res, next) {
    try {
      await InscricaoPushModel.remover(req.usuarioId, req.body.endpoint);
      res.json({ sucesso: true });
    } catch (erro) {
      next(erro);
    }
  },

  async teste(req, res, next) {
    try {
      const { push } = await notificacao.enviarTeste(req.usuarioDoc);
      let emailEnviado = false;
      if (req.body?.incluirEmail) {
        try {
          await email.enviar({
            para: req.usuario.email,
            assunto: '✅ Teste de notificação do MedSync',
            texto: 'Se você recebeu este e-mail, os lembretes por e-mail estão funcionando.',
            html: '<p>Se você recebeu este e-mail, os lembretes por e-mail estão funcionando. ✅</p>',
          });
          emailEnviado = true;
        } catch (erro) {
          console.error('[NOTIFICACAO] teste e-mail:', erro.message);
        }
      }
      res.json({ sucesso: true, push, email: emailEnviado });
    } catch (erro) {
      next(erro);
    }
  },
};

module.exports = NotificacaoController;
