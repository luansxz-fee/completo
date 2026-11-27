const crypto = require('crypto');
const mongoose = require('mongoose');
const { env } = require('../config/env');

/**
 * Códigos de uso único (verificação de e-mail e recuperação de senha).
 * O código NUNCA é guardado em texto puro: só o HMAC-SHA256 dele.
 */
const codigoSchema = new mongoose.Schema(
  {
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    tipo: { type: String, enum: ['verificacao_email', 'recuperacao_senha'], required: true },
    codigo_hash: { type: String, required: true, index: true },
    expira_em: { type: Date, required: true, index: { expires: 0 } }, // TTL: o Mongo apaga sozinho
    tentativas: { type: Number, default: 0 },
    utilizado: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'criado_em', updatedAt: 'atualizado_em' } }
);

const Codigo = mongoose.model('Codigo', codigoSchema);

const MAX_TENTATIVAS = 5;
const VALIDADE_MIN = { verificacao_email: 15, recuperacao_senha: 60 };
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I

function hash(codigo) {
  return crypto
    .createHmac('sha256', env.jwtSecret || 'dev')
    .update(String(codigo).trim().toUpperCase())
    .digest('hex');
}

function iguais(a, b) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

const CodigoModel = {
  MAX_TENTATIVAS,

  gerarNumerico() {
    return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  },

  gerarAlfanumerico() {
    return Array.from({ length: 8 }, () => ALFABETO[crypto.randomInt(0, ALFABETO.length)]).join('');
  },

  /** Cria um novo código (apaga os anteriores do mesmo tipo) e devolve o texto puro. */
  async criar(usuarioId, tipo) {
    await Codigo.deleteMany({ usuario_id: usuarioId, tipo });
    const codigo = tipo === 'verificacao_email' ? this.gerarNumerico() : this.gerarAlfanumerico();
    await Codigo.create({
      usuario_id: usuarioId,
      tipo,
      codigo_hash: hash(codigo),
      expira_em: new Date(Date.now() + VALIDADE_MIN[tipo] * 60 * 1000),
    });
    return codigo;
  },

  /** Segundos que faltam para poder reenviar (0 = pode enviar agora). */
  async esperaParaReenvio(usuarioId, tipo, cooldownSeg = 60) {
    const ultimo = await Codigo.findOne({ usuario_id: usuarioId, tipo }).sort({ criado_em: -1 }).lean();
    if (!ultimo) return 0;
    const decorrido = (Date.now() - new Date(ultimo.criado_em).getTime()) / 1000;
    return Math.max(0, Math.ceil(cooldownSeg - decorrido));
  },

  /** Verificação de e-mail: o usuário é conhecido, o código tem poucos dígitos → limita tentativas. */
  async validarVerificacao(usuarioId, codigo) {
    const doc = await Codigo.findOne({
      usuario_id: usuarioId,
      tipo: 'verificacao_email',
      utilizado: false,
      expira_em: { $gt: new Date() },
    });
    if (!doc) return { ok: false, motivo: 'expirado' };
    if (doc.tentativas >= MAX_TENTATIVAS) return { ok: false, motivo: 'bloqueado' };

    if (!iguais(doc.codigo_hash, hash(codigo))) {
      doc.tentativas += 1;
      await doc.save();
      return { ok: false, motivo: 'invalido', restantes: Math.max(0, MAX_TENTATIVAS - doc.tentativas) };
    }
    doc.utilizado = true;
    await doc.save();
    return { ok: true };
  },

  /** Recuperação de senha: devolve o id do usuário dono do código válido. */
  async buscarRecuperacaoValida(codigo) {
    if (!codigo) return null;
    const doc = await Codigo.findOne({
      tipo: 'recuperacao_senha',
      codigo_hash: hash(codigo),
      utilizado: false,
      expira_em: { $gt: new Date() },
    });
    return doc || null;
  },

  async consumir(doc) {
    doc.utilizado = true;
    await doc.save();
  },

  async apagarDoUsuario(usuarioId) {
    await Codigo.deleteMany({ usuario_id: usuarioId });
  },
};

module.exports = CodigoModel;
