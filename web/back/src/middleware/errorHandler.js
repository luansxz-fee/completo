const { env } = require('../config/env');

function tratarErro(erro, req, res, next) { // eslint-disable-line no-unused-vars
  if (process.env.NODE_ENV !== 'test') {
    console.error(`${new Date().toISOString()} ERRO ${req.method} ${req.originalUrl}:`, erro.message);
    if (!env.producao) console.error(erro.stack);
  }

  if (erro.type === 'entity.too.large') {
    return res.status(413).json({ sucesso: false, mensagem: 'Conteúdo grande demais.' });
  }
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ sucesso: false, mensagem: 'JSON inválido.' });
  }
  if (erro.name === 'CastError') {
    return res.status(400).json({ sucesso: false, mensagem: `Formato de ID inválido para o campo: ${erro.path}` });
  }
  if (erro.name === 'ValidationError') {
    const mensagens = Object.values(erro.errors || {}).map((e) => e.message);
    return res.status(422).json({ sucesso: false, mensagem: 'Dados inválidos fornecidos', erros: mensagens });
  }
  if (erro.code === 11000) {
    const campo = Object.keys(erro.keyPattern || {})[0] || 'campo';
    return res.status(409).json({ sucesso: false, mensagem: `Já existe um registro cadastrado com este ${campo}.` });
  }

  const status = erro.status || 500;
  // Em produção nunca devolvemos detalhes internos de erros 500.
  const mensagem = status >= 500 && env.producao ? 'Erro interno do servidor' : erro.message || 'Erro interno do servidor';
  return res.status(status).json({ sucesso: false, mensagem });
}

function rotaNaoEncontrada(req, res) {
  res.status(404).json({ sucesso: false, mensagem: `Rota não encontrada: ${req.originalUrl}` });
}

module.exports = { tratarErro, rotaNaoEncontrada };
