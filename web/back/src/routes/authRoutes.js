const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/AuthController.js');
const autenticar = require('../middleware/auth.js');
const validar = require('../middleware/validate.js');
const limites = require('../middleware/limites.js');

const emailCampo = (campo = 'email') =>
  body(campo)
    .isEmail()
    .withMessage('E-mail inválido')
    .bail()
    .normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false, gmail_convert_googlemaildotcom: false });

const validarSenhaForte = (campo) =>
  body(campo)
    .isString()
    .withMessage('Senha inválida')
    .bail()
    .isLength({ min: 8, max: 128 })
    .withMessage('A senha deve ter entre 8 e 128 caracteres')
    .matches(/[a-z]/)
    .withMessage('A senha deve conter uma letra minúscula')
    .matches(/[A-Z]/)
    .withMessage('A senha deve conter uma letra maiúscula')
    .matches(/\d/)
    .withMessage('A senha deve conter um número')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('A senha deve conter um caractere especial');

router.post(
  '/registrar',
  limites.cadastro,
  [
    body('nome').isString().trim().notEmpty().withMessage('Nome é obrigatório').isLength({ min: 2, max: 100 }).withMessage('Nome deve ter de 2 a 100 caracteres'),
    emailCampo(),
    validarSenhaForte('senha'),
    body('fusoHorario').optional({ nullable: true }).isString().isLength({ max: 64 }),
  ],
  validar,
  ctrl.registrar
);

router.post(
  '/verificar-email',
  limites.codigos,
  [emailCampo(), body('codigo').trim().matches(/^\d{6}$/).withMessage('O código tem 6 dígitos')],
  validar,
  ctrl.verificarEmail
);

router.post('/reenviar-verificacao', limites.codigos, [emailCampo()], validar, ctrl.reenviarVerificacao);

router.post(
  '/login',
  limites.login,
  [emailCampo(), body('senha').isString().notEmpty().withMessage('Senha é obrigatória'), body('fusoHorario').optional({ nullable: true }).isString().isLength({ max: 64 })],
  validar,
  ctrl.login
);

router.post('/esqueci-senha', limites.codigos, [emailCampo()], validar, ctrl.esqueciSenha);

router.post(
  '/redefinir-senha',
  limites.codigos,
  [body('token').isString().trim().notEmpty().withMessage('Código é obrigatório').isLength({ max: 32 }), validarSenhaForte('novaSenha')],
  validar,
  ctrl.redefinirSenha
);

// Rotas autenticadas (sem limitador severo: o front chama /eu a cada carregamento)
router.get('/eu', autenticar, ctrl.meusDados);

router.put(
  '/eu',
  autenticar,
  [
    body('nome').optional().isString().trim().isLength({ min: 2, max: 100 }),
    body('fusoHorario').optional().isString().isLength({ max: 64 }),
    body('notificacoes').optional().isObject(),
    body('acessibilidade').optional({ nullable: true }).isObject(),
  ],
  validar,
  ctrl.atualizarMeusDados
);

router.post(
  '/alterar-senha',
  autenticar,
  limites.codigos,
  [body('senhaAtual').isString().notEmpty().withMessage('Informe a senha atual'), validarSenhaForte('novaSenha')],
  validar,
  ctrl.alterarSenha
);

router.delete(
  '/eu',
  autenticar,
  limites.codigos,
  [body('senha').isString().notEmpty().withMessage('Informe a senha para confirmar')],
  validar,
  ctrl.excluirConta
);

module.exports = router;
