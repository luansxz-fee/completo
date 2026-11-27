/**
 * Orquestra os canais (push + e-mail) respeitando as preferências do usuário.
 */
const { enviarParaUsuario } = require('./pushService');
const email = require('./emailService');
const VinculoModel = require('../models/VinculoModel');
const { Usuario } = require('../models/UserModel');

const prefs = (u) => ({
  push: u.notificacoes?.push !== false,
  emailLembretes: u.notificacoes?.email_lembretes !== false,
  emailCuidador: u.notificacoes?.email_cuidador !== false,
});

/**
 * @param usuario  documento (lean ou não) do destinatário
 * @param mensagem { titulo, corpo, url, tag, tipo }
 * @param canalEmail { ativo: boolean, enviar: () => Promise }  (opcional)
 * @returns true se ao menos um canal entregou
 */
async function entregar(usuario, mensagem, canalEmail) {
  let entregue = false;
  const p = prefs(usuario);

  if (p.push) {
    try {
      if ((await enviarParaUsuario(usuario._id, mensagem)) > 0) entregue = true;
    } catch (erro) {
      console.error('[NOTIFICACAO] push:', erro.message);
    }
  }

  if (canalEmail?.ativo && usuario.email_verificado) {
    try {
      await canalEmail.enviar();
      entregue = true;
    } catch (erro) {
      console.error('[NOTIFICACAO] e-mail:', erro.message);
    }
  }
  return entregue;
}

async function lembrarDose(usuario, med, hora, dia, repeticao) {
  const mensagem = {
    titulo: repeticao ? '⏰ Ainda não registrou a dose' : '💊 Hora do medicamento',
    corpo: `${med.nome} — ${med.dosagem} ${med.unidade} às ${hora}`,
    url: '/#dashboard',
    tag: `dose-${med._id}-${dia}-${hora}`,
    tipo: 'lembrete',
  };
  return entregar(usuario, mensagem, {
    ativo: prefs(usuario).emailLembretes,
    enviar: () =>
      email.enviarLembreteDose(usuario.email, usuario.nome, {
        medicamento: med.nome,
        dosagem: `${med.dosagem} ${med.unidade}`,
        horario: hora,
        repeticao,
      }),
  });
}

/** Avisa os cuidadores ativos de que a dose do paciente não foi confirmada. */
async function alertarCuidadores(paciente, med, hora, dia, reservar) {
  const vinculos = await VinculoModel.cuidadoresAtivos(paciente._id);
  let enviados = 0;
  for (const v of vinculos) {
    const cuidador = await Usuario.findById(v.cuidador_id).lean();
    if (!cuidador || !cuidador.email_verificado) continue;
    if (!(await reservar(`atraso:${med._id}:${dia}:${hora}:${cuidador._id}`))) continue;

    const mensagem = {
      titulo: `⚠️ ${paciente.nome.split(' ')[0]} não confirmou a dose`,
      corpo: `${med.nome} das ${hora} ainda não foi registrada.`,
      url: '/#cuidadores',
      tag: `atraso-${med._id}-${dia}-${hora}`,
      tipo: 'atraso',
    };
    const ok = await entregar(cuidador, mensagem, {
      ativo: prefs(cuidador).emailCuidador,
      enviar: () =>
        email.enviarAlertaCuidador(cuidador.email, cuidador.nome, {
          paciente: paciente.nome,
          medicamento: med.nome,
          horario: hora,
        }),
    });
    if (ok) enviados += 1;
  }
  return enviados;
}

async function avisarEstoqueBaixo(usuarioId, med) {
  const usuario = await Usuario.findById(usuarioId).lean();
  if (!usuario) return false;
  return entregar(
    usuario,
    {
      titulo: '📦 Estoque baixo',
      corpo: `Restam ${med.estoqueAtual} unidade(s) de ${med.nome}.`,
      url: '/#medications',
      tag: `estoque-${med.id}`,
      tipo: 'estoque',
    },
    {
      ativo: prefs(usuario).emailLembretes,
      enviar: () => email.enviarEstoqueBaixo(usuario.email, usuario.nome, { medicamento: med.nome, restante: med.estoqueAtual }),
    }
  );
}

async function enviarTeste(usuario) {
  const doc = usuario.toObject ? usuario.toObject() : usuario;
  const mensagem = {
    titulo: '✅ Notificações funcionando',
    corpo: 'Este é um teste do MedSync. Se você está vendo isto, os lembretes vão chegar.',
    url: '/#profile',
    tag: 'teste',
    tipo: 'teste',
  };
  const push = await enviarParaUsuario(doc._id, mensagem);
  return { push };
}

module.exports = { entregar, lembrarDose, alertarCuidadores, avisarEstoqueBaixo, enviarTeste };
