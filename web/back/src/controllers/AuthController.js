const jwt = require('jsonwebtoken');

const UsuarioModel = require('../models/UserModel');
const CodigoModel = require('../models/CodigoModel');
const MedicamentoModel = require('../models/MedicationModel');
const RegistroDoseModel = require('../models/LogModel');
const VinculoModel = require('../models/VinculoModel');
const InscricaoPushModel = require('../models/InscricaoPushModel');
const email = require('../services/emailService');
const { env } = require('../config/env');

const senhaForte = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const MSG_SENHA =
  'A senha deve ter no mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.';

function gerarToken(usuario) {
  return jwt.sign({ id: usuario._id.toString(), email: usuario.email }, env.jwtSecret, {
    expiresIn: env.jwtExpira,
  });
}

/** Só devolve o código na resposta em desenvolvimento explícito. Nunca em produção. */
const exporCodigoDev = () =>
  process.env.NODE_ENV === 'development' && process.env.EXPOR_CODIGO_DEV === 'true';

/**
 * Gera e envia o código de verificação de e-mail, respeitando 60 s entre envios.
 * Devolve { enviado, espera, erro }.
 */
async function enviarVerificacao(usuario, { ignorarEspera = false } = {}) {
  const id = usuario._id.toString();
  const espera = ignorarEspera ? 0 : await CodigoModel.esperaParaReenvio(id, 'verificacao_email', 60);
  if (espera > 0) return { enviado: false, espera };

  const codigo = await CodigoModel.criar(id, 'verificacao_email');
  try {
    await email.enviarCodigoVerificacao(usuario.email, usuario.nome, codigo);
    return { enviado: true, espera: 60, codigoDev: exporCodigoDev() ? codigo : undefined };
  } catch (erro) {
    console.error('[AUTH] falha ao enviar e-mail de verificação:', erro.message);
    return { enviado: false, espera: 0, erro: true };
  }
}

function avatarValido(avatar) {
  if (avatar === null || avatar === '') return true;
  if (typeof avatar !== 'string') return false;
  if (/^https:\/\/[^\s]+$/i.test(avatar) && avatar.length <= 500) return true;
  return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(avatar) && avatar.length <= 400_000;
}

const AuthController = {
  async registrar(req, res, next) {
    try {
      const { nome, email: emailBruto, senha, fusoHorario } = req.body;

      if (typeof senha !== 'string' || !senhaForte.test(senha)) {
        return res.status(400).json({ sucesso: false, mensagem: MSG_SENHA });
      }

      let usuario = await UsuarioModel.buscarPorEmail(emailBruto);

      if (usuario?.email_verificado) {
        return res.status(409).json({ sucesso: false, mensagem: 'Este e-mail já está cadastrado.' });
      }

      if (usuario) {
        // Cadastro abandonado (e-mail nunca confirmado): permite recomeçar.
        await UsuarioModel.redefinirSenhaNaoVerificado(usuario._id, nome, senha);
        usuario = await UsuarioModel.buscarPorId(usuario._id);
      } else {
        usuario = await UsuarioModel.criar({ nome, email: emailBruto, senha, fusoHorario });
      }

      const envio = await enviarVerificacao(usuario, { ignorarEspera: true });

      return res.status(201).json({
        sucesso: true,
        requerVerificacao: true,
        email: usuario.email,
        emailEnviado: envio.enviado,
        mensagem: envio.enviado
          ? 'Enviamos um código de 6 dígitos para o seu e-mail.'
          : 'Conta criada, mas não conseguimos enviar o e-mail agora. Toque em "Reenviar código".',
        ...(envio.codigoDev ? { codigoDesenvolvimento: envio.codigoDev } : {}),
      });
    } catch (erro) {
      next(erro);
    }
  },

  async verificarEmail(req, res, next) {
    try {
      const { email: emailBruto, codigo } = req.body;
      const usuario = await UsuarioModel.buscarPorEmail(emailBruto);

      if (!usuario) {
        return res.status(400).json({ sucesso: false, mensagem: 'Código inválido ou expirado.' });
      }

      if (usuario.email_verificado) {
        return res.status(200).json({
          sucesso: true,
          jaVerificado: true,
          mensagem: 'Este e-mail já foi confirmado. Faça login.',
        });
      }

      const r = await CodigoModel.validarVerificacao(usuario._id, String(codigo).trim());
      if (!r.ok) {
        if (r.motivo === 'bloqueado') {
          return res.status(429).json({
            sucesso: false,
            mensagem: 'Muitas tentativas incorretas. Solicite um novo código.',
          });
        }
        if (r.motivo === 'invalido') {
          return res.status(400).json({
            sucesso: false,
            mensagem: `Código incorreto. Restam ${r.restantes} tentativa(s).`,
            tentativasRestantes: r.restantes,
          });
        }
        return res.status(400).json({ sucesso: false, mensagem: 'Código expirado. Solicite um novo.' });
      }

      const atualizado = await UsuarioModel.marcarEmailVerificado(usuario._id);
      return res.json({
        sucesso: true,
        mensagem: 'E-mail confirmado com sucesso!',
        token: gerarToken(atualizado),
        usuario: UsuarioModel.formatar(atualizado),
      });
    } catch (erro) {
      next(erro);
    }
  },

  async reenviarVerificacao(req, res, next) {
    try {
      const usuario = await UsuarioModel.buscarPorEmail(req.body.email);
      let espera = 60;
      let enviado = true;
      let codigoDev;

      // Resposta sempre genérica para não revelar quais e-mails existem.
      if (usuario && !usuario.email_verificado) {
        const r = await enviarVerificacao(usuario);
        espera = r.espera;
        enviado = r.enviado || r.espera > 0;
        codigoDev = r.codigoDev;
        if (r.erro) {
          return res.status(503).json({
            sucesso: false,
            mensagem: 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.',
          });
        }
      }
      return res.json({
        sucesso: true,
        espera,
        mensagem: enviado ? 'Se o e-mail estiver pendente de confirmação, enviamos um novo código.' : 'Aguarde para reenviar.',
        ...(codigoDev ? { codigoDesenvolvimento: codigoDev } : {}),
      });
    } catch (erro) {
      next(erro);
    }
  },

  async login(req, res, next) {
    try {
      const { email: emailBruto, senha, fusoHorario } = req.body;
      const usuario = await UsuarioModel.buscarPorEmail(emailBruto);

      if (!usuario || !(await UsuarioModel.verificarSenha(senha, usuario.senha))) {
        return res.status(401).json({ sucesso: false, mensagem: 'E-mail ou senha incorretos' });
      }

      if (!usuario.email_verificado) {
        const envio = await enviarVerificacao(usuario);
        return res.status(403).json({
          sucesso: false,
          codigo: 'EMAIL_NAO_VERIFICADO',
          requerVerificacao: true,
          email: usuario.email,
          emailEnviado: envio.enviado,
          espera: envio.espera,
          mensagem: 'Confirme o seu e-mail para entrar. Enviamos um código para a sua caixa de entrada.',
          ...(envio.codigoDev ? { codigoDesenvolvimento: envio.codigoDev } : {}),
        });
      }

      let atual = usuario;
      if (fusoHorario && fusoHorario !== usuario.fuso_horario) {
        atual = (await UsuarioModel.atualizar(usuario._id, { fusoHorario })) || usuario;
      }

      return res.json({
        sucesso: true,
        mensagem: 'Login realizado com sucesso',
        token: gerarToken(atual),
        usuario: UsuarioModel.formatar(atual),
      });
    } catch (erro) {
      next(erro);
    }
  },

  async meusDados(req, res) {
    return res.json({ sucesso: true, usuario: req.usuario });
  },

  async atualizarMeusDados(req, res, next) {
    try {
      const { nome, avatar, fusoHorario, notificacoes, acessibilidade } = req.body;
      const dados = {};

      if (nome !== undefined) {
        if (typeof nome !== 'string' || nome.trim().length < 2 || nome.trim().length > 100) {
          return res.status(400).json({ sucesso: false, mensagem: 'Nome inválido' });
        }
        dados.nome = nome.trim();
      }
      if (avatar !== undefined) {
        if (!avatarValido(avatar)) {
          return res.status(400).json({ sucesso: false, mensagem: 'Imagem inválida (use PNG, JPG ou WebP até ~300 KB).' });
        }
        dados.avatar = avatar || null;
      }
      if (fusoHorario !== undefined) dados.fusoHorario = fusoHorario;
      if (notificacoes !== undefined) {
        dados.notificacoes = {
          push: notificacoes?.push,
          email_lembretes: notificacoes?.emailLembretes,
          email_cuidador: notificacoes?.emailCuidador,
        };
      }
      if (acessibilidade !== undefined) dados.acessibilidade = acessibilidade;

      if (Object.keys(dados).length === 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'Nenhum dado para atualizar' });
      }

      const atualizado = await UsuarioModel.atualizar(req.usuarioId, dados);
      if (!atualizado) return res.status(404).json({ sucesso: false, mensagem: 'Usuário não encontrado' });

      return res.json({
        sucesso: true,
        mensagem: 'Perfil atualizado com sucesso',
        usuario: UsuarioModel.formatar(atualizado),
      });
    } catch (erro) {
      next(erro);
    }
  },

  async alterarSenha(req, res, next) {
    try {
      const { senhaAtual, novaSenha } = req.body;
      if (!senhaForte.test(novaSenha)) return res.status(400).json({ sucesso: false, mensagem: MSG_SENHA });

      if (!(await UsuarioModel.verificarSenha(senhaAtual, req.usuarioDoc.senha))) {
        return res.status(401).json({ sucesso: false, mensagem: 'A senha atual está incorreta.' });
      }
      await UsuarioModel.alterarSenha(req.usuarioId, novaSenha);
      return res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso' });
    } catch (erro) {
      next(erro);
    }
  },

  /** Direito de exclusão (LGPD): apaga a conta e TODOS os dados associados. */
  async excluirConta(req, res, next) {
    try {
      if (!(await UsuarioModel.verificarSenha(req.body.senha, req.usuarioDoc.senha))) {
        return res.status(401).json({ sucesso: false, mensagem: 'Senha incorreta.' });
      }
      const id = req.usuarioId;
      await Promise.all([
        MedicamentoModel.excluirPorUsuario(id),
        RegistroDoseModel.excluirPorUsuario(id),
        VinculoModel.excluirDoUsuario(id),
        InscricaoPushModel.removerDoUsuario(id),
        CodigoModel.apagarDoUsuario(id),
      ]);
      await UsuarioModel.excluir(id);
      return res.json({ sucesso: true, mensagem: 'Conta e dados excluídos.' });
    } catch (erro) {
      next(erro);
    }
  },

  async esqueciSenha(req, res, next) {
    try {
      const usuario = await UsuarioModel.buscarPorEmail(req.body.email);
      const generica = {
        sucesso: true,
        mensagem: 'Se o e-mail estiver cadastrado, você receberá o código em instantes.',
      };

      if (!usuario) return res.json(generica);

      const id = usuario._id.toString();
      const espera = await CodigoModel.esperaParaReenvio(id, 'recuperacao_senha', 60);
      if (espera > 0) return res.json({ ...generica, espera });

      const codigo = await CodigoModel.criar(id, 'recuperacao_senha');
      try {
        await email.enviarEmailRecuperacao(usuario.email, usuario.nome, codigo);
      } catch (erroEmail) {
        console.error('[AUTH] falha ao enviar e-mail de recuperação:', erroEmail.message);
        return res.status(503).json({
          sucesso: false,
          mensagem: 'Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.',
        });
      }

      return res.json({ ...generica, espera: 60, ...(exporCodigoDev() ? { codigoDesenvolvimento: codigo } : {}) });
    } catch (erro) {
      next(erro);
    }
  },

  async redefinirSenha(req, res, next) {
    try {
      const { token, novaSenha } = req.body;
      if (typeof novaSenha !== 'string' || !senhaForte.test(novaSenha)) {
        return res.status(400).json({ sucesso: false, mensagem: MSG_SENHA });
      }

      const registro = await CodigoModel.buscarRecuperacaoValida(token);
      if (!registro) {
        return res.status(400).json({ sucesso: false, mensagem: 'Código inválido ou expirado' });
      }

      const usuario = await UsuarioModel.buscarPorId(registro.usuario_id);
      if (!usuario) return res.status(404).json({ sucesso: false, mensagem: 'Usuário não encontrado' });

      await UsuarioModel.alterarSenha(usuario._id, novaSenha);
      // Quem recebeu o código no e-mail provou que é o dono: confirma o e-mail também.
      if (!usuario.email_verificado) await UsuarioModel.marcarEmailVerificado(usuario._id);
      await CodigoModel.consumir(registro);

      return res.json({ sucesso: true, mensagem: 'Senha redefinida com sucesso' });
    } catch (erro) {
      next(erro);
    }
  },
};

module.exports = AuthController;
