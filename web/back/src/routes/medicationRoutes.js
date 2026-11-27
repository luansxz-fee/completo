const router = require('express').Router();
const { body } = require('express-validator');

const ctrl = require('../controllers/MedicationController.js');
const autenticar = require('../middleware/auth.js');
const contextoPaciente = require('../middleware/contextoPaciente.js');
const validar = require('../middleware/validate.js');

router.use(autenticar);
router.use(contextoPaciente);

const validacoesMedicamento = [
  body('nome')
    .trim()
    .notEmpty()
    .withMessage('Nome do medicamento e obrigatorio'),

  body('dosagem')
    .trim()
    .notEmpty()
    .withMessage('Dosagem e obrigatoria'),

  body('unidade')
    .trim()
    .notEmpty()
    .withMessage('Unidade e obrigatoria'),

  body('frequencia')
    .trim()
    .notEmpty()
    .withMessage('Frequencia e obrigatoria'),

  body('horarios')
    .isArray({ min: 1 })
    .withMessage('Informe ao menos um horario'),

  body('horarios.*')
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('Horario invalido, use HH:MM'),

  body('dataInicio')
    .isDate()
    .withMessage('Data de inicio invalida'),

  body('dataTermino')
    .optional({ nullable: true, checkFalsy: true })
    .isDate()
    .withMessage('Data de termino invalida')
    .bail()
    .custom((termino, { req }) => {
      if (req.body.dataInicio && termino < req.body.dataInicio) {
        throw new Error('A data de termino deve ser igual ou posterior a data de inicio');
      }
      return true;
    }),

  body('cor')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Cor invalida'),

  body('estoqueAtual')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Estoque invalido'),

  body('estoqueMaximo')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Capacidade invalida')
    .bail()
    .custom((max, { req }) => {
      if (req.body.estoqueAtual !== undefined && Number(req.body.estoqueAtual) > Number(max)) {
        throw new Error('O estoque atual nao pode ser maior que a capacidade');
      }
      return true;
    }),

  body('medicoPrescritor')
    .optional({ nullable: true })
    .isString()
    .withMessage('Nome do medico invalido'),

  body('crm')
    .optional({ nullable: true })
    .isString()
    .withMessage('CRM invalido'),

  body('urlImagem')
    .optional({ nullable: true })
    .custom((val) => {
      if (!val || val === '') return true;

      try {
        new URL(val);
        return true;
      } catch {
        throw new Error('URL da imagem invalida');
      }
    }),
];

router.get('/', ctrl.listar);
router.get('/:id', ctrl.buscar);

router.post(
  '/',
  validacoesMedicamento,
  validar,
  ctrl.criar
);

router.put(
  '/:id',
  validacoesMedicamento,
  validar,
  ctrl.atualizar
);

router.patch('/:id/alternar', ctrl.alternarAtivo);

router.delete('/:id', ctrl.excluir);

module.exports = router;