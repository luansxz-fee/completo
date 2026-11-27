/**
 * Agendador de lembretes.
 *
 * A cada minuto (ou quando um "cron" externo chamar /api/interno/lembretes):
 *   1. Para cada dose agendada que JÁ chegou e ainda NÃO foi registrada:
 *        0–14 min  → lembrete        (push + e-mail, conforme preferências)
 *        15–29 min → repetição
 *        ≥30 min   → alerta aos cuidadores
 *        ≥120 min  → marca a dose como "perdida" (no servidor)
 *   2. Cada notificação tem uma chave única: nunca é enviada duas vezes, mesmo
 *      com reinício, várias instâncias ou cron + timer ao mesmo tempo.
 *   3. É tolerante a atrasos: se o servidor "dormiu" (plano gratuito do Render)
 *      e acordou 5 minutos depois, o lembrete ainda sai.
 */
const { env } = require('../config/env');
const MedicamentoModel = require('../models/MedicationModel');
const RegistroDoseModel = require('../models/LogModel');
const EnvioModel = require('../models/EnvioModel');
const { Usuario } = require('../models/UserModel');
const notificacao = require('./notificacaoService');
const { dataLocal, somarDias, minutosDesde, FUSO_PADRAO } = require('../utils/tempo');

const JANELA_LEMBRETE_MIN = 15;
const JANELA_REPETICAO_MIN = 30;

let emExecucao = false;
let temporizador = null;

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const HORA = /^\d{2}:\d{2}$/;

async function processar({ agora = new Date() } = {}) {
  const resumo = { medicamentos: 0, lembretes: 0, repeticoes: 0, alertasCuidador: 0, perdidas: 0 };

  const meds = await MedicamentoModel.listarAtivosCru();
  resumo.medicamentos = meds.length;
  if (meds.length === 0) return resumo;

  const porUsuario = new Map();
  for (const m of meds) {
    const k = String(m.usuario_id);
    if (!porUsuario.has(k)) porUsuario.set(k, []);
    porUsuario.get(k).push(m);
  }

  const usuarios = await Usuario.find({ _id: { $in: [...porUsuario.keys()] } }).lean();

  for (const usuario of usuarios) {
    if (!usuario.email_verificado) continue; // conta ainda não confirmada: sem notificações
    try {
      await processarUsuario(usuario, porUsuario.get(String(usuario._id)), agora, resumo);
    } catch (erro) {
      console.error(`[LEMBRETES] usuário ${usuario._id}:`, erro.message);
    }
  }
  return resumo;
}

async function processarUsuario(usuario, meds, agora, resumo) {
  const fuso = usuario.fuso_horario || FUSO_PADRAO;
  const hoje = dataLocal(fuso, agora);
  const ontem = somarDias(hoje, -1);
  const datas = [ontem, hoje];

  const registrados = new Set(
    (await RegistroDoseModel.buscarDoses(usuario._id, datas)).filter((l) => l.situacao !== 'pendente').map(
      (l) => `${l.medicamento_id}|${l.data_dose}|${l.horario_agendado}`
    )
  );

  for (const dia of datas) {
    for (const med of meds) {
      const inicio = iso(med.data_inicio);
      const termino = iso(med.data_termino);
      if (inicio && dia < inicio) continue;
      if (termino && dia > termino) continue;

      const mudouEm = new Date(
        Math.max(
          new Date(med.criado_em || 0).getTime(),
          new Date(med.horarios_alterados_em || 0).getTime()
        )
      );

      for (const hora of med.horarios || []) {
        if (!HORA.test(hora)) continue;
        if (registrados.has(`${med._id}|${dia}|${hora}`)) continue;

        // Não cobra dose de um horário que já tinha passado quando o medicamento foi cadastrado/alterado.
        if (minutosDesde(dia, hora, fuso, mudouEm) >= 0) continue;

        const decorrido = minutosDesde(dia, hora, fuso, agora);
        if (decorrido < 0) continue; // ainda não chegou

        if (decorrido >= env.toleranciaPerdidaMin) {
          if (await RegistroDoseModel.marcarPerdidaSeAusente(usuario._id, med._id, hora, dia)) resumo.perdidas += 1;
          continue;
        }

        if (med.lembrete_ativo && decorrido < JANELA_REPETICAO_MIN) {
          const repeticao = decorrido >= JANELA_LEMBRETE_MIN;
          const chave = `${repeticao ? 'repeticao' : 'lembrete'}:${med._id}:${dia}:${hora}`;
          if (await EnvioModel.reservar(chave)) {
            const ok = await notificacao.lembrarDose(usuario, med, hora, dia, repeticao);
            if (ok) resumo[repeticao ? 'repeticoes' : 'lembretes'] += 1;
            else await EnvioModel.liberar(chave); // nenhum canal entregou: tenta no próximo ciclo
          }
        }

        if (decorrido >= env.alertaCuidadorMin) {
          resumo.alertasCuidador += await notificacao.alertarCuidadores(usuario, med, hora, dia, (c) =>
            EnvioModel.reservar(c)
          );
        }
      }
    }
  }
}

async function processarSeguro(opcoes) {
  if (emExecucao) return null;
  emExecucao = true;
  try {
    const resumo = await processar(opcoes);
    if (resumo.lembretes || resumo.repeticoes || resumo.alertasCuidador || resumo.perdidas) {
      console.log('[LEMBRETES]', JSON.stringify(resumo));
    }
    return resumo;
  } catch (erro) {
    console.error('[LEMBRETES] erro:', erro.message);
    return null;
  } finally {
    emExecucao = false;
  }
}

function iniciarAgendador() {
  if (!env.schedulerAtivo || temporizador) return;
  setTimeout(() => processarSeguro(), 5000).unref();
  temporizador = setInterval(() => processarSeguro(), 60 * 1000);
  temporizador.unref();
  console.log('Agendador de lembretes ativo (a cada 60 s).');
}

function pararAgendador() {
  if (temporizador) clearInterval(temporizador);
  temporizador = null;
}

module.exports = { processar, processarSeguro, iniciarAgendador, pararAgendador };
