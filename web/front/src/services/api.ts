const URL_BASE: string =
  (import.meta as any).env?.VITE_API_URL || 'https://certo-fb4t.onrender.com';

export const CHAVE_TOKEN = 'medsync_token';

/** Paciente em foco (modo cuidador). Enviado em X-Paciente-Id nas rotas de dados. */
let pacienteAlvo: string | null = null;
export function definirPacienteAlvo(id: string | null) {
  pacienteAlvo = id;
}

export class ApiError extends Error {
  status: number;
  dados: any;
  constructor(mensagem: string, status: number, dados: any) {
    super(mensagem);
    this.status = status;
    this.dados = dados;
  }
}

/** Sessão inválida/expirada: o AuthContext escuta isto e volta para o login. */
export const EVENTO_SESSAO_INVALIDA = 'medsync:sessao-invalida';

async function requisicao<T>(
  metodo: string,
  caminho: string,
  corpo?: unknown,
  { autenticado = true, comPaciente = false }: { autenticado?: boolean; comPaciente?: boolean } = {}
): Promise<T> {
  const cabecalhos: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(CHAVE_TOKEN);
  if (autenticado && token) cabecalhos.Authorization = `Bearer ${token}`;
  if (comPaciente && pacienteAlvo) cabecalhos['X-Paciente-Id'] = pacienteAlvo;

  let resposta: Response;
  try {
    resposta = await fetch(`${URL_BASE}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ApiError('Sem conexão com o servidor. Verifique a internet e tente de novo.', 0, null);
  }

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    if (resposta.status === 401 && autenticado) {
      window.dispatchEvent(new CustomEvent(EVENTO_SESSAO_INVALIDA));
    }
    const detalhe = Array.isArray(dados?.erros) && dados.erros.length
      ? ' ' + dados.erros.map((e: any) => (typeof e === 'string' ? e : e.mensagem)).join(' ')
      : '';
    throw new ApiError((dados?.mensagem || `Erro ${resposta.status}`) + (typeof dados?.mensagem === 'string' && detalhe ? '' : detalhe), resposta.status, dados);
  }
  return dados as T;
}

const SEM_AUTH = { autenticado: false };
const COM_PACIENTE = { comPaciente: true };

export const api = {
  auth: {
    registrar: (nome: string, email: string, senha: string, fusoHorario?: string) =>
      requisicao<any>('POST', '/auth/registrar', { nome, email, senha, fusoHorario }, SEM_AUTH),
    verificarEmail: (email: string, codigo: string) =>
      requisicao<any>('POST', '/auth/verificar-email', { email, codigo }, SEM_AUTH),
    reenviarVerificacao: (email: string) =>
      requisicao<any>('POST', '/auth/reenviar-verificacao', { email }, SEM_AUTH),
    login: (email: string, senha: string, fusoHorario?: string) =>
      requisicao<any>('POST', '/auth/login', { email, senha, fusoHorario }, SEM_AUTH),
    eu: () => requisicao<any>('GET', '/auth/eu'),
    atualizarEu: (dados: Record<string, unknown>) => requisicao<any>('PUT', '/auth/eu', dados),
    alterarSenha: (senhaAtual: string, novaSenha: string) =>
      requisicao<any>('POST', '/auth/alterar-senha', { senhaAtual, novaSenha }),
    excluirConta: (senha: string) => requisicao<any>('DELETE', '/auth/eu', { senha }),
    esqueciSenha: (email: string) => requisicao<any>('POST', '/auth/esqueci-senha', { email }, SEM_AUTH),
    redefinirSenha: (token: string, novaSenha: string) =>
      requisicao<any>('POST', '/auth/redefinir-senha', { token, novaSenha }, SEM_AUTH),
  },

  medicamentos: {
    listar: () => requisicao<{ dados: any[] }>('GET', '/medicamentos', undefined, COM_PACIENTE),
    criar: (dados: any) => requisicao<{ dados: any }>('POST', '/medicamentos', dados, COM_PACIENTE),
    atualizar: (id: string, dados: any) =>
      requisicao<{ dados: any }>('PUT', `/medicamentos/${id}`, dados, COM_PACIENTE),
    excluir: (id: string) => requisicao<any>('DELETE', `/medicamentos/${id}`, undefined, COM_PACIENTE),
    alternar: (id: string) => requisicao<{ dados: any }>('PATCH', `/medicamentos/${id}/alternar`, undefined, COM_PACIENTE),
  },

  registros: {
    listar: (dias?: number) =>
      requisicao<{ dados: any[] }>('GET', `/registros${dias ? `?dias=${dias}` : ''}`, undefined, COM_PACIENTE),
    adesao: () =>
      requisicao<{ dados: { dias7: number | null; dias30: number | null } }>('GET', '/registros/adesao', undefined, COM_PACIENTE),
    salvar: (medicamentoId: string, horarioAgendado: string, situacao: string, observacao?: string) =>
      requisicao<{ dados: any; medicamento: any }>(
        'POST',
        '/registros',
        { medicamentoId, horarioAgendado, situacao, observacao },
        COM_PACIENTE
      ),
  },

  cuidadores: {
    meus: () => requisicao<{ dados: any[] }>('GET', '/cuidadores/meus'),
    convidar: (email: string, permissao: string, apelido?: string) =>
      requisicao<any>('POST', '/cuidadores/convidar', { email, permissao, apelido }),
    atualizar: (id: string, dados: { permissao?: string; apelido?: string }) =>
      requisicao<any>('PATCH', `/cuidadores/${id}`, dados),
    revogar: (id: string) => requisicao<any>('DELETE', `/cuidadores/${id}`),
    convites: () => requisicao<{ dados: any[] }>('GET', '/cuidadores/convites'),
    aceitar: (id: string) => requisicao<any>('POST', `/cuidadores/${id}/aceitar`),
    recusar: (id: string) => requisicao<any>('POST', `/cuidadores/${id}/recusar`),
    pacientes: () => requisicao<{ dados: any[] }>('GET', '/cuidadores/pacientes'),
    resumo: (pacienteId: string) => requisicao<{ dados: any }>('GET', `/cuidadores/pacientes/${pacienteId}/resumo`),
  },

  notificacoes: {
    chavePublica: () =>
      requisicao<{ habilitado: boolean; chave: string | null }>('GET', '/notificacoes/chave-publica', undefined, SEM_AUTH),
    status: () => requisicao<any>('GET', '/notificacoes/status'),
    inscrever: (subscription: unknown, dispositivo?: string) =>
      requisicao<any>('POST', '/notificacoes/inscrever', { subscription, dispositivo }),
    cancelar: (endpoint: string) => requisicao<any>('POST', '/notificacoes/cancelar', { endpoint }),
    teste: (incluirEmail = false) => requisicao<any>('POST', '/notificacoes/teste', { incluirEmail }),
  },
};
