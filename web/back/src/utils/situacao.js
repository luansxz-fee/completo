/**
 * Situações de dose aceitas pela API (forma canônica, no feminino).
 * Aceitamos também as formas antigas usadas pelo front/app
 * (TOMADO, PULADO, PERDIDO, taken, skipped, missed) e normalizamos.
 */
const SITUACOES = ['tomada', 'perdida', 'pulada', 'pendente'];

const MAPA = {
  tomada: 'tomada',
  tomado: 'tomada',
  taken: 'tomada',
  concluido: 'tomada',
  perdida: 'perdida',
  perdido: 'perdida',
  missed: 'perdida',
  atrasado: 'perdida',
  pulada: 'pulada',
  pulado: 'pulada',
  skipped: 'pulada',
  pendente: 'pendente',
  pending: 'pendente',
};

function normalizarSituacao(valor) {
  const chave = String(valor ?? '').trim().toLowerCase();
  return MAPA[chave] || null;
}

module.exports = { SITUACOES, normalizarSituacao };
