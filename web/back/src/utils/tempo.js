/**
 * Utilitários de data/hora com fuso horário.
 *
 * Por que isto existe: o servidor roda em UTC. No Brasil (UTC-3), depois das
 * 21h o "hoje" do servidor já é "amanhã" para o usuário. Todas as regras de
 * "dose de hoje", "adesão" e "lembrete" usam o fuso do próprio usuário.
 */
const FUSO_PADRAO = 'America/Sao_Paulo';

function fusoValido(fuso) {
  if (typeof fuso !== 'string' || !fuso) return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}

function partes(data, fuso) {
  const formatador = new Intl.DateTimeFormat('en-CA', {
    timeZone: fusoValido(fuso) ? fuso : FUSO_PADRAO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const saida = {};
  for (const p of formatador.formatToParts(data)) saida[p.type] = p.value;
  return saida;
}

/** 'YYYY-MM-DD' no fuso informado. */
function dataLocal(fuso = FUSO_PADRAO, data = new Date()) {
  const p = partes(data, fuso);
  return `${p.year}-${p.month}-${p.day}`;
}

/** 'HH:MM' no fuso informado. */
function horaLocal(fuso = FUSO_PADRAO, data = new Date()) {
  const p = partes(data, fuso);
  return `${p.hour}:${p.minute}`;
}

function minutosDoDia(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

/** Soma (ou subtrai) dias de uma string 'YYYY-MM-DD'. */
function somarDias(dataStr, dias) {
  const d = new Date(`${dataStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Minutos decorridos desde um horário agendado (dataAlvo + hhmm),
 * considerando "agora" no fuso do usuário. Negativo = ainda no futuro.
 */
function minutosDesde(dataAlvo, hhmm, fuso, agora = new Date()) {
  const hoje = dataLocal(fuso, agora);
  const diasDiferenca = Math.round(
    (new Date(`${hoje}T00:00:00Z`) - new Date(`${dataAlvo}T00:00:00Z`)) / 86400000
  );
  const agoraMin = minutosDoDia(horaLocal(fuso, agora));
  return diasDiferenca * 1440 + agoraMin - minutosDoDia(hhmm);
}

module.exports = {
  FUSO_PADRAO,
  fusoValido,
  dataLocal,
  horaLocal,
  minutosDoDia,
  somarDias,
  minutosDesde,
};
