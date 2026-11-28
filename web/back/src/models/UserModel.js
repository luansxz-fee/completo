const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { env } = require('../config/env');
const { FUSO_PADRAO, fusoValido } = require('../utils/tempo');

const usuarioSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    senha: { type: String, required: true },
    avatar: { type: String, default: null },

    // Verificação real de e-mail (código de 6 dígitos enviado por e-mail).
    email_verificado: { type: Boolean, default: false },
    email_verificado_em: { type: Date, default: null },

    fuso_horario: { type: String, default: FUSO_PADRAO },

    notificacoes: {
      push: { type: Boolean, default: true },
      email_lembretes: { type: Boolean, default: true },
      email_cuidador: { type: Boolean, default: true },
    },

    // Preferências de acessibilidade sincronizadas entre dispositivos.
    acessibilidade: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: 'criado_em', updatedAt: 'atualizado_em' } }
);

const Usuario = mongoose.model('Usuario', usuarioSchema);

/** Aceita somente chaves/valores conhecidos (evita lixo e payload gigante). */
function sanitizarAcessibilidade(a) {
  if (!a || typeof a !== 'object') return null;
  const intEm = (v, min, max, padrao) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : padrao;
  };
  const dalt = ['nenhum', 'protanopia', 'deuteranopia', 'tritanopia', 'acromatopsia'];
  return {
    visao: intEm(a.visao, 0, 3, 0),
    daltonismo: dalt.includes(a.daltonismo) ? a.daltonismo : 'nenhum',
    daltonismoGrau: intEm(a.daltonismoGrau, 1, 3, 1),
    leitor: intEm(a.leitor, 0, 3, 0),
    movimentoReduzido: !!a.movimentoReduzido,
    velocidadeVoz: Math.min(1.5, Math.max(0.5, Number(a.velocidadeVoz) || 1)),
    // carimbo (ms) da última alteração: o app mantém a versão mais recente entre aparelho e conta
    atualizadoEm: Number.isFinite(Number(a.atualizadoEm)) ? Math.max(0, Number(a.atualizadoEm)) : 0,
  };
}

const UsuarioModel = {
  Usuario,
  sanitizarAcessibilidade,

  async buscarPorEmail(email) {
    if (!email) return null;
    return Usuario.findOne({ email: String(email).toLowerCase().trim() });
  },

  async buscarPorId(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    return Usuario.findById(id);
  },

  async hash(senha) {
    return bcrypt.hash(senha, env.bcryptRounds);
  },

  async criar({ nome, email, senha, fusoHorario }) {
    const novo = new Usuario({
      nome: nome.trim(),
      email: email.toLowerCase().trim(),
      senha: await this.hash(senha),
      fuso_horario: fusoValido(fusoHorario) ? fusoHorario : FUSO_PADRAO,
    });
    return novo.save();
  },

  async atualizar(id, { nome, avatar, fusoHorario, notificacoes, acessibilidade }) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const campos = {};
    if (nome !== undefined) campos.nome = String(nome).trim();
    if (avatar !== undefined) campos.avatar = avatar;
    if (fusoHorario !== undefined && fusoValido(fusoHorario)) campos.fuso_horario = fusoHorario;
    if (notificacoes && typeof notificacoes === 'object') {
      for (const k of ['push', 'email_lembretes', 'email_cuidador']) {
        if (typeof notificacoes[k] === 'boolean') campos[`notificacoes.${k}`] = notificacoes[k];
      }
    }
    if (acessibilidade !== undefined) campos.acessibilidade = sanitizarAcessibilidade(acessibilidade);

    if (Object.keys(campos).length === 0) return Usuario.findById(id);
    return Usuario.findByIdAndUpdate(id, { $set: campos }, { returnDocument: 'after', runValidators: true });
  },

  async alterarSenha(id, novaSenha) {
    if (!mongoose.Types.ObjectId.isValid(id)) return;
    await Usuario.findByIdAndUpdate(id, { senha: await this.hash(novaSenha) });
  },

  async redefinirSenhaNaoVerificado(id, nome, novaSenha) {
    await Usuario.findByIdAndUpdate(id, { nome: nome.trim(), senha: await this.hash(novaSenha) });
  },

  async marcarEmailVerificado(id) {
    return Usuario.findByIdAndUpdate(
      id,
      { $set: { email_verificado: true, email_verificado_em: new Date() } },
      { returnDocument: 'after' }
    );
  },

  verificarSenha(textoPlano, hash) {
    return bcrypt.compare(textoPlano, hash);
  },

  async excluir(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return;
    await Usuario.deleteOne({ _id: id });
  },

  formatar(u) {
    if (!u) return null;
    const n = u.notificacoes || {};
    return {
      id: u._id ? u._id.toString() : u.id,
      nome: u.nome,
      email: u.email,
      avatar: u.avatar || null,
      emailVerificado: !!u.email_verificado,
      fusoHorario: u.fuso_horario || FUSO_PADRAO,
      notificacoes: {
        push: n.push !== false,
        emailLembretes: n.email_lembretes !== false,
        emailCuidador: n.email_cuidador !== false,
      },
      acessibilidade: u.acessibilidade || null,
      criadoEm: u.criado_em,
    };
  },

  /** Versão pública mínima (para quem NÃO é o próprio usuário). */
  formatarPublico(u) {
    if (!u) return null;
    return { id: u._id.toString(), nome: u.nome, avatar: u.avatar || null };
  },
};

module.exports = UsuarioModel;
