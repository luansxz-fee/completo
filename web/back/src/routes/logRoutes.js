const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/LogController.js');
const autenticar = require('../middleware/auth.js');
const contextoPaciente = require('../middleware/contextoPaciente.js');
const validar = require('../middleware/validate.js');
const { normalizarSituacao } = require('../utils/situacao');

router.use(autenticar);
router.use(contextoPaciente);

router.get('/', ctrl.listar);
router.get('/hoje', ctrl.hoje);
router.get('/adesao', ctrl.adesao);

router.post(
  '/',
  [
    body('medicamentoId').isMongoId().withMessage('ID do medicamento inválido'),
    body('horarioAgendado').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Horário inválido, use HH:MM'),
    body('situacao')
      .custom((v) => !!normalizarSituacao(v))
      .withMessage('Situação inválida (tomada, perdida, pulada ou pendente)'),
    body('observacao').optional({ nullable: true }).isString().isLength({ max: 500 }),
  ],
  validar,
  ctrl.salvar
);

module.exports = router;
