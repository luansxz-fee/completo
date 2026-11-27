const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/CuidadorController.js');
const autenticar = require('../middleware/auth.js');
const validar = require('../middleware/validate.js');
const limites = require('../middleware/limites.js');

router.use(autenticar);

const permissao = body('permissao').optional().isIn(['visualizar', 'gerenciar']).withMessage('Permissão inválida');

// Eu como PACIENTE
router.get('/meus', ctrl.meusCuidadores);
router.post(
  '/convidar',
  limites.codigos,
  [
    body('email').isEmail().withMessage('E-mail inválido').bail().normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false, gmail_convert_googlemaildotcom: false }),
    permissao,
    body('apelido').optional({ nullable: true }).isString().isLength({ max: 60 }),
  ],
  validar,
  ctrl.convidar
);
router.patch('/:id', [permissao, body('apelido').optional({ nullable: true }).isString().isLength({ max: 60 })], validar, ctrl.atualizar);
router.delete('/:id', ctrl.revogar);

// Eu como CUIDADOR
router.get('/convites', ctrl.convitesRecebidos);
router.post('/:id/aceitar', ctrl.responderConvite);
router.post('/:id/recusar', ctrl.responderConvite);
router.get('/pacientes', ctrl.meusPacientes);
router.get('/pacientes/:pacienteId/resumo', ctrl.resumoPaciente);

module.exports = router;
