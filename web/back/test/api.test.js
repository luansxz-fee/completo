/**
 * Testes de integração: sobem a API real contra um MongoDB (FerretDB/Mongo local)
 * e percorrem os fluxos principais. Execute com:  npm test
 * Requer MONGODB_URI_TEST (padrão: mongodb://127.0.0.1:27017/medsync_test).
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres';
process.env.EMAIL_PROVIDER = 'console';
process.env.BCRYPT_ROUNDS = '4';
process.env.CRON_SECRET = 'cron-teste';
process.env.FRONTEND_URL = 'http://localhost:5173';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { criarApp } = require('../src/app');
const email = require('../src/services/emailService');
const push = require('../src/services/pushService');
const lembretes = require('../src/services/lembreteService');
const { dataLocal, somarDias } = require('../src/utils/tempo');

const URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/medsync_test';
let servidor, base;

async function req(metodo, caminho, corpo, { token, paciente } = {}) {
  const r = await fetch(base + caminho, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(paciente ? { 'X-Paciente-Id': paciente } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

const ultimoCodigo = (para) => {
  const m = [...email.ultimosEmails].reverse().find((e) => e.para === para);
  return m?.texto.match(/\b(\d{6})\b/)?.[1] || m?.texto.match(/: ([A-Z2-9]{8})\b/)?.[1];
};

async function criarUsuario(nome, endereco) {
  const senha = 'Senha@123';
  let r = await req('POST', '/api/auth/registrar', { nome, email: endereco, senha });
  assert.equal(r.status, 201);
  r = await req('POST', '/api/auth/verificar-email', { email: endereco, codigo: ultimoCodigo(endereco) });
  assert.equal(r.status, 200);
  return { token: r.json.token, id: r.json.usuario.id, email: endereco, senha };
}

test.before(async () => {
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  // FerretDB (emulador usado nos testes) não suporta índices TTL; o MongoDB real suporta.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init().catch(() => {})));
  const RegistroDoseModel = require('../src/models/LogModel');
  await RegistroDoseModel.sincronizarIndices();
  servidor = criarApp().listen(0);
  base = `http://127.0.0.1:${servidor.address().port}`;
});

test.after(async () => {
  lembretes.pararAgendador();
  servidor.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('cadastro exige e-mail verificado e nunca devolve token antes disso', async () => {
  const e = 'ana@teste.com';
  let r = await req('POST', '/api/auth/registrar', { nome: 'Ana Souza', email: e, senha: 'Senha@123' });
  assert.equal(r.status, 201);
  assert.equal(r.json.requerVerificacao, true);
  assert.equal(r.json.token, undefined);
  assert.equal(r.json.codigoDesenvolvimento, undefined, 'código não pode vazar na resposta');

  // login antes de verificar → 403 e reenvia código
  r = await req('POST', '/api/auth/login', { email: e, senha: 'Senha@123' });
  assert.equal(r.status, 403);
  assert.equal(r.json.requerVerificacao, true);

  // código errado
  r = await req('POST', '/api/auth/verificar-email', { email: e, codigo: '000000' });
  assert.equal(r.status, 400);

  // código certo
  const codigo = ultimoCodigo(e);
  assert.match(codigo, /^\d{6}$/);
  r = await req('POST', '/api/auth/verificar-email', { email: e, codigo });
  assert.equal(r.status, 200);
  assert.ok(r.json.token);

  r = await req('POST', '/api/auth/login', { email: e, senha: 'Senha@123' });
  assert.equal(r.status, 200);
});

test('código de verificação bloqueia após 5 tentativas erradas', async () => {
  const e = 'bruto@teste.com';
  await req('POST', '/api/auth/registrar', { nome: 'Bruto Forca', email: e, senha: 'Senha@123' });
  const certo = ultimoCodigo(e);
  let ultimo;
  for (let i = 0; i < 5; i++) ultimo = await req('POST', '/api/auth/verificar-email', { email: e, codigo: certo === '111111' ? '222222' : '111111' });
  assert.equal(ultimo.status, 400);
  const r = await req('POST', '/api/auth/verificar-email', { email: e, codigo: certo });
  assert.equal(r.status, 429, 'depois de 5 erros nem o código certo vale');
});

test('recuperação de senha: código não vaza e funciona uma única vez', async () => {
  const u = await criarUsuario('Carlos Lima', 'carlos@teste.com');
  let r = await req('POST', '/api/auth/esqueci-senha', { email: u.email });
  assert.equal(r.status, 200);
  assert.equal(r.json.codigoDesenvolvimento, undefined);
  assert.equal(r.json.tokenDesenvolvimento, undefined);

  const cod = ultimoCodigo(u.email);
  r = await req('POST', '/api/auth/redefinir-senha', { token: cod, novaSenha: 'fraca' });
  assert.equal(r.status, 422);
  r = await req('POST', '/api/auth/redefinir-senha', { token: cod, novaSenha: 'Nova@12345' });
  assert.equal(r.status, 200);
  r = await req('POST', '/api/auth/redefinir-senha', { token: cod, novaSenha: 'Outra@12345' });
  assert.equal(r.status, 400, 'código já usado');
  r = await req('POST', '/api/auth/login', { email: u.email, senha: 'Nova@12345' });
  assert.equal(r.status, 200);

  // e-mail inexistente: resposta idêntica (sem enumeração)
  r = await req('POST', '/api/auth/esqueci-senha', { email: 'ninguem@teste.com' });
  assert.equal(r.status, 200);
});

test('GET /auth/eu repetido não é bloqueado pelo rate limit de login', async () => {
  const u = await criarUsuario('Dora Reis', 'dora@teste.com');
  for (let i = 0; i < 30; i++) {
    const r = await req('GET', '/api/auth/eu', null, { token: u.token });
    assert.equal(r.status, 200);
  }
});

test('medicamento + dose: status em qualquer grafia, estoque atômico, adesão', async () => {
  const u = await criarUsuario('Eva Dias', 'eva@teste.com');
  const hoje = dataLocal('America/Sao_Paulo');
  let r = await req('POST', '/api/medicamentos', {
    nome: 'Losartana', dosagem: '50', unidade: 'mg', frequencia: 'Diário',
    horarios: ['08:00', '20:00'], dataInicio: hoje, estoqueAtual: 10, estoqueMaximo: 30,
  }, { token: u.token });
  assert.equal(r.status, 201);
  const med = r.json.dados;

  // termino antes do início → 422
  r = await req('POST', '/api/medicamentos', {
    nome: 'X', dosagem: '1', unidade: 'mg', frequencia: 'Diário', horarios: ['08:00'],
    dataInicio: hoje, dataTermino: somarDias(hoje, -1),
  }, { token: u.token });
  assert.equal(r.status, 422);

  // o front antigo enviava TOMADO: precisa funcionar
  r = await req('POST', '/api/registros', { medicamentoId: med.id, horarioAgendado: '08:00', situacao: 'TOMADO' }, { token: u.token });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.dados.situacao, 'tomada');
  assert.equal(r.json.medicamento.estoqueAtual, 9);

  // repetir não desconta duas vezes
  r = await req('POST', '/api/registros', { medicamentoId: med.id, horarioAgendado: '08:00', situacao: 'tomada' }, { token: u.token });
  assert.equal(r.json.medicamento.estoqueAtual, 9);

  // desfazer devolve o comprimido
  r = await req('POST', '/api/registros', { medicamentoId: med.id, horarioAgendado: '08:00', situacao: 'pulada' }, { token: u.token });
  assert.equal(r.json.medicamento.estoqueAtual, 10);

  // horário que não existe no esquema
  r = await req('POST', '/api/registros', { medicamentoId: med.id, horarioAgendado: '09:30', situacao: 'tomada' }, { token: u.token });
  assert.equal(r.status, 422);

  r = await req('POST', '/api/registros', { medicamentoId: med.id, horarioAgendado: '20:00', situacao: 'tomada' }, { token: u.token });
  r = await req('GET', '/api/registros/adesao', null, { token: u.token });
  assert.equal(r.json.dados.dias7, 50); // 1 tomada, 1 pulada

  r = await req('GET', '/api/registros/hoje', null, { token: u.token });
  assert.equal(r.json.dados.length, 2);

  const outro = await criarUsuario('Fabio Nunes', 'fabio@teste.com');
  r = await req('GET', `/api/medicamentos/${med.id}`, null, { token: outro.token });
  assert.equal(r.status, 404, 'isolamento entre usuários');
  r = await req('GET', `/api/usuarios/${u.id}`, null, { token: outro.token });
  assert.equal(r.status, 403, 'não pode ler dados de outro usuário');
});

test('cuidador: convite, aceite, leitura, escrita conforme permissão e revogação', async () => {
  const paciente = await criarUsuario('Gil Paciente', 'gil@teste.com');
  const cuidador = await criarUsuario('Helena Cuida', 'helena@teste.com');
  const intruso = await criarUsuario('Ivo Intruso', 'ivo@teste.com');
  const hoje = dataLocal('America/Sao_Paulo');

  let r = await req('POST', '/api/medicamentos', {
    nome: 'Metformina', dosagem: '850', unidade: 'mg', frequencia: 'Diário', horarios: ['07:00'], dataInicio: hoje,
  }, { token: paciente.token });
  const med = r.json.dados;

  r = await req('POST', '/api/cuidadores/convidar', { email: cuidador.email, permissao: 'visualizar' }, { token: paciente.token });
  assert.equal(r.status, 201);
  const vinculoId = r.json.dados.id;
  assert.match(email.ultimosEmails.at(-1).assunto, /convidou/);

  // intruso não consegue aceitar convite alheio
  r = await req('POST', `/api/cuidadores/${vinculoId}/aceitar`, null, { token: intruso.token });
  assert.equal(r.status, 404);
  // sem aceitar, não tem acesso
  r = await req('GET', '/api/medicamentos', null, { token: cuidador.token, paciente: paciente.id });
  assert.equal(r.status, 403);

  r = await req('GET', '/api/cuidadores/convites', null, { token: cuidador.token });
  assert.equal(r.json.dados.length, 1);
  r = await req('POST', `/api/cuidadores/${vinculoId}/aceitar`, null, { token: cuidador.token });
  assert.equal(r.status, 200);

  // visualizar: lê, mas não escreve
  r = await req('GET', '/api/medicamentos', null, { token: cuidador.token, paciente: paciente.id });
  assert.equal(r.status, 200);
  assert.equal(r.json.dados.length, 1);
  r = await req('POST', '/api/registros', { medicamentoId: med.id, horarioAgendado: '07:00', situacao: 'tomada' }, { token: cuidador.token, paciente: paciente.id });
  assert.equal(r.status, 403);

  // intruso continua sem acesso
  r = await req('GET', '/api/medicamentos', null, { token: intruso.token, paciente: paciente.id });
  assert.equal(r.status, 403);

  // promove para gerenciar
  r = await req('PATCH', `/api/cuidadores/${vinculoId}`, { permissao: 'gerenciar' }, { token: paciente.token });
  assert.equal(r.status, 200);
  r = await req('POST', '/api/registros', { medicamentoId: med.id, horarioAgendado: '07:00', situacao: 'tomada' }, { token: cuidador.token, paciente: paciente.id });
  assert.equal(r.status, 200);
  assert.equal(r.json.dados.registradoPor, cuidador.id);

  r = await req('GET', `/api/cuidadores/pacientes/${paciente.id}/resumo`, null, { token: cuidador.token });
  assert.equal(r.json.dados.dosesHoje.tomadas, 1);

  // revoga
  r = await req('DELETE', `/api/cuidadores/${vinculoId}`, null, { token: paciente.token });
  assert.equal(r.status, 200);
  r = await req('GET', '/api/medicamentos', null, { token: cuidador.token, paciente: paciente.id });
  assert.equal(r.status, 403);
});

test('lembretes: avisa na hora, não repete, alerta cuidador e marca perdida', async () => {
  const entregas = [];
  push.definirEnviador(async (alvo, payload) => entregas.push({ alvo, payload }));

  const paciente = await criarUsuario('Jana Paciente', 'jana@teste.com');
  const cuidador = await criarUsuario('Kleber Cuida', 'kleber@teste.com');
  const ativo = async (u) => {
    const Insc = require('../src/models/InscricaoPushModel');
    await Insc.salvar(u.id, { endpoint: `https://push.exemplo/${u.id}`, keys: { p256dh: 'a', auth: 'b' } }, 'teste');
  };
  await ativo(paciente);
  await ativo(cuidador);

  const hoje = dataLocal('America/Sao_Paulo');
  let r = await req('POST', '/api/cuidadores/convidar', { email: cuidador.email, permissao: 'visualizar' }, { token: paciente.token });
  await req('POST', `/api/cuidadores/${r.json.dados.id}/aceitar`, null, { token: cuidador.token });

  r = await req('POST', '/api/medicamentos', {
    nome: 'Sinvastatina', dosagem: '20', unidade: 'mg', frequencia: 'Diário', horarios: ['10:00'], dataInicio: somarDias(hoje, -3),
  }, { token: paciente.token });
  const med = r.json.dados;

  // medicamento cadastrado "agora": dose de 10:00 só conta se 10:00 for DEPOIS do cadastro.
  // Simulamos o relógio num dia futuro para ter um horário claramente posterior ao cadastro.
  const dia = somarDias(hoje, 1);
  const instante = (hhmm) => new Date(`${dia}T${hhmm}:00-03:00`); // America/Sao_Paulo = UTC-3

  await lembretes.processar({ agora: instante('09:59') });
  assert.equal(entregas.filter((e) => e.alvo.endpoint.endsWith(paciente.id)).length, 0, 'antes da hora: nada');

  const a = await lembretes.processar({ agora: instante('10:01') });
  assert.ok(a.lembretes >= 1);
  const paraPaciente = entregas.filter((e) => e.alvo.endpoint.endsWith(paciente.id));
  assert.equal(paraPaciente.length, 1);
  assert.match(paraPaciente[0].payload.corpo, /Sinvastatina/);

  await lembretes.processar({ agora: instante('10:02') });
  assert.equal(entregas.filter((e) => e.alvo.endpoint.endsWith(paciente.id)).length, 1);

  await lembretes.processar({ agora: instante('10:16') });
  assert.equal(entregas.filter((e) => e.alvo.endpoint.endsWith(paciente.id)).length, 2, 'repetição após 15 min');

  await lembretes.processar({ agora: instante('10:31') });
  assert.equal(entregas.filter((e) => e.alvo.endpoint.endsWith(cuidador.id)).length, 1);
  await lembretes.processar({ agora: instante('10:32') });
  assert.equal(entregas.filter((e) => e.alvo.endpoint.endsWith(cuidador.id)).length, 1, 'cuidador é avisado uma vez só');

  // Se o usuário registra a dose, nada mais é enviado nem marcado como perdido
  const Log = require('../src/models/LogModel');
  await Log.salvar(paciente.id, med.id, '10:00', 'tomada', null, { dataDose: dia });
  await lembretes.processar({ agora: instante('12:05') });
  const logsJana = await Log.RegistroDose.find({ usuario_id: paciente.id, data_dose: dia }).lean();
  assert.equal(logsJana.length, 1);
  assert.equal(logsJana[0].situacao, 'tomada', 'dose registrada pelo usuário não é sobrescrita como perdida');

  push.definirEnviador(null);
});

test('dose esquecida vira "perdida" no servidor após a tolerância', async () => {
  const u = await criarUsuario('Lia Esquece', 'lia@teste.com');
  const hoje = dataLocal('America/Sao_Paulo');
  const r = await req('POST', '/api/medicamentos', {
    nome: 'Vitamina D', dosagem: '1', unidade: 'comprimido(s)', frequencia: 'Diário', horarios: ['06:00'], dataInicio: hoje, lembreteAtivo: false,
  }, { token: u.token });
  assert.equal(r.status, 201);
  const dia = somarDias(hoje, 1);
  const res = await lembretes.processar({ agora: new Date(`${dia}T08:30:00-03:00`) });
  assert.equal(res.perdidas, 1);
  const Log = require('../src/models/LogModel');
  const docs = await Log.RegistroDose.find({ usuario_id: u.id }).lean();
  assert.equal(docs[0].situacao, 'perdida');
  assert.equal(docs[0].automatico, true);
  assert.equal(docs[0].data_dose, dia);
});

test('fuso horário: às 22h de Brasília o "hoje" ainda é hoje', () => {
  const t = new Date('2026-11-26T01:30:00Z'); // 22:30 do dia 25 em Brasília
  assert.equal(dataLocal('America/Sao_Paulo', t), '2026-11-25');
  assert.equal(t.toISOString().split('T')[0], '2026-11-26'); // o bug antigo
});

test('endpoint de cron exige segredo', async () => {
  let r = await req('POST', '/api/interno/lembretes');
  assert.equal(r.status, 401);
  r = await req('GET', '/api/interno/lembretes?segredo=cron-teste');
  assert.equal(r.status, 200);
});

test('exclusão de conta apaga tudo', async () => {
  const u = await criarUsuario('Mara Sai', 'mara@teste.com');
  let r = await req('DELETE', '/api/auth/eu', { senha: 'errada' }, { token: u.token });
  assert.equal(r.status, 401);
  r = await req('DELETE', '/api/auth/eu', { senha: u.senha }, { token: u.token });
  assert.equal(r.status, 200);
  r = await req('POST', '/api/auth/login', { email: u.email, senha: u.senha });
  assert.equal(r.status, 401);
});
