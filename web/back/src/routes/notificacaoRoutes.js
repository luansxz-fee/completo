const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/NotificacaoController.js');
const autenticar = require('../middleware/auth.js');
const validar = require('../middleware/validate.js');
const limites = require('../middleware/limites.js');

router.get('/chave-publica', ctrl.chavePublica);

router.use(autenticar);

router.get('/status', ctrl.status);

router.post(
  '/inscrever',
  [
    body('subscription.endpoint').isURL({ protocols: ['https'], require_protocol: true }).withMessage('Endpoint inválido'),
    body('subscription.keys.p256dh').isString().notEmpty(),
    body('subscription.keys.auth').isString().notEmpty(),
    body('dispositivo').optional({ nullable: true }).isString().isLength({ max: 200 }),
  ],
  validar,
  ctrl.inscrever
);

router.post('/cancelar', [body('endpoint').isString().notEmpty()], validar, ctrl.cancelar);
router.post('/teste', limites.codigos, ctrl.teste);

module.exports = router;
