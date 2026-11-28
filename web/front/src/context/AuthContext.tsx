import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { api, ApiError, CHAVE_TOKEN, EVENTO_SESSAO_INVALIDA } from '../services/api';
import { fusoDoNavegador } from '../utils/datas';
import { desinscreverEsteDispositivo } from '../hooks/useNotificacoes';

const CHAVE_SESSAO = 'medsync_sessao';
const CHAVE_USUARIO = 'medsync_usuario'; // lida pelo MedContext

export interface ResultadoAuth {
  ok: boolean;
  /** conta existe mas o e-mail ainda não foi confirmado */
  requerVerificacao?: boolean;
  email?: string;
  mensagem?: string;
  /** false = a conta foi criada, mas o servidor não conseguiu enviar o e-mail */
  emailEnviado?: boolean;
  espera?: number;
  codigoDesenvolvimento?: string;
}

interface AuthContextType {
  usuario: User | null;
  user: User | null;
  isLoading: boolean;
  login: (email: string, senha: string) => Promise<ResultadoAuth>;
  registrar: (nome: string, email: string, senha: string) => Promise<ResultadoAuth>;
  verificarEmail: (email: string, codigo: string) => Promise<ResultadoAuth>;
  reenviarVerificacao: (email: string) => Promise<ResultadoAuth>;
  sair: () => void;
  atualizarUsuario: (dados: Record<string, unknown>) => Promise<void>;
  alterarSenha: (atual: string, nova: string) => Promise<void>;
  excluirConta: (senha: string) => Promise<void>;
  solicitarRecuperacaoSenha: (email: string) => Promise<ResultadoAuth>;
  redefinirSenha: (codigo: string, novaSenha: string) => Promise<ResultadoAuth>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

function normalizar(bruto: any): User {
  const nome = bruto?.nome ?? bruto?.name ?? '';
  return { ...bruto, id: String(bruto?.id ?? bruto?._id ?? ''), nome, name: nome, createdAt: bruto?.criadoEm ?? bruto?.createdAt };
}

function guardarSessao(u: User) {
  const json = JSON.stringify(u);
  localStorage.setItem(CHAVE_SESSAO, json);
  localStorage.setItem(CHAVE_USUARIO, json);
}

function limparSessao() {
  [CHAVE_TOKEN, CHAVE_SESSAO, CHAVE_USUARIO].forEach((k) => localStorage.removeItem(k));
}

function resultadoDeErro(erro: unknown): ResultadoAuth {
  if (erro instanceof ApiError) {
    return {
      ok: false,
      mensagem: erro.message,
      requerVerificacao: !!erro.dados?.requerVerificacao,
      email: erro.dados?.email,
      emailEnviado: erro.dados?.emailEnviado,
      espera: erro.dados?.espera,
      codigoDesenvolvimento: erro.dados?.codigoDesenvolvimento,
    };
  }
  return { ok: false, mensagem: 'Não foi possível concluir. Tente novamente.' };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const limpar = useCallback(() => {
    limparSessao();
    setUsuario(null);
  }, []);

  /** Sair de verdade: antes, tira este aparelho das notificações da conta. */
  const sair = useCallback(() => {
    const espera = new Promise<void>((r) => setTimeout(r, 1500));
    void Promise.race([desinscreverEsteDispositivo(), espera]).finally(limpar);
  }, [limpar]);

  // Restaura a sessão confirmando com o servidor.
  useEffect(() => {
    const token = localStorage.getItem(CHAVE_TOKEN);
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const salvo = localStorage.getItem(CHAVE_SESSAO);
      if (salvo) setUsuario(normalizar(JSON.parse(salvo)));
    } catch {
      /* ignora cache corrompido */
    }

    api.auth
      .eu()
      .then((res) => {
        const u = normalizar(res.usuario);
        guardarSessao(u);
        setUsuario(u);
        // mantém o fuso do servidor alinhado com o do aparelho (lembretes no horário certo)
        const fuso = fusoDoNavegador();
        if (u.fusoHorario && u.fusoHorario !== fuso) api.auth.atualizarEu({ fusoHorario: fuso }).catch(() => {});
      })
      .catch((erro) => {
        if (erro instanceof ApiError && erro.status === 0) return; // offline: mantém o cache
        limpar();
      })
      .finally(() => setIsLoading(false));
  }, [limpar]);

  useEffect(() => {
    const aoInvalidar = () => limpar(); // sessão já inválida: não há o que avisar ao servidor
    window.addEventListener(EVENTO_SESSAO_INVALIDA, aoInvalidar);
    return () => window.removeEventListener(EVENTO_SESSAO_INVALIDA, aoInvalidar);
  }, [limpar]);

  const concluirLogin = (res: any): ResultadoAuth => {
    const u = normalizar(res.usuario);
    localStorage.setItem(CHAVE_TOKEN, res.token);
    guardarSessao(u);
    setUsuario(u);
    return { ok: true };
  };

  const login: AuthContextType['login'] = async (email, senha) => {
    try {
      return concluirLogin(await api.auth.login(email.trim(), senha, fusoDoNavegador()));
    } catch (erro) {
      return resultadoDeErro(erro);
    }
  };

  const registrar: AuthContextType['registrar'] = async (nome, email, senha) => {
    try {
      const res = await api.auth.registrar(nome.trim(), email.trim(), senha, fusoDoNavegador());
      if (res.token) return concluirLogin(res); // servidor sem verificação de e-mail: já entra
      return {
        ok: true,
        requerVerificacao: true,
        email: res.email,
        emailEnviado: res.emailEnviado,
        mensagem: res.mensagem,
        codigoDesenvolvimento: res.codigoDesenvolvimento,
      };
    } catch (erro) {
      return resultadoDeErro(erro);
    }
  };

  const verificarEmail: AuthContextType['verificarEmail'] = async (email, codigo) => {
    try {
      const res = await api.auth.verificarEmail(email, codigo);
      if (res.token) return concluirLogin(res);
      return { ok: true, mensagem: res.mensagem };
    } catch (erro) {
      return resultadoDeErro(erro);
    }
  };

  const reenviarVerificacao: AuthContextType['reenviarVerificacao'] = async (email) => {
    try {
      const res = await api.auth.reenviarVerificacao(email);
      return { ok: true, espera: res.espera, mensagem: res.mensagem, codigoDesenvolvimento: res.codigoDesenvolvimento };
    } catch (erro) {
      return resultadoDeErro(erro);
    }
  };

  const atualizarUsuario: AuthContextType['atualizarUsuario'] = async (dados) => {
    const res = await api.auth.atualizarEu(dados);
    const u = normalizar(res.usuario);
    guardarSessao(u);
    setUsuario(u);
  };

  const alterarSenha: AuthContextType['alterarSenha'] = async (atual, nova) => {
    await api.auth.alterarSenha(atual, nova);
  };

  const excluirConta: AuthContextType['excluirConta'] = async (senha) => {
    await api.auth.excluirConta(senha);
    sair();
  };

  const solicitarRecuperacaoSenha: AuthContextType['solicitarRecuperacaoSenha'] = async (email) => {
    try {
      const res = await api.auth.esqueciSenha(email.trim());
      return { ok: true, espera: res.espera, mensagem: res.mensagem, codigoDesenvolvimento: res.codigoDesenvolvimento };
    } catch (erro) {
      return resultadoDeErro(erro);
    }
  };

  const redefinirSenha: AuthContextType['redefinirSenha'] = async (codigo, novaSenha) => {
    try {
      await api.auth.redefinirSenha(codigo.trim().toUpperCase(), novaSenha);
      return { ok: true };
    } catch (erro) {
      return resultadoDeErro(erro);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        user: usuario,
        isLoading,
        login,
        registrar,
        verificarEmail,
        reenviarVerificacao,
        sair,
        atualizarUsuario,
        alterarSenha,
        excluirConta,
        solicitarRecuperacaoSenha,
        redefinirSenha,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
