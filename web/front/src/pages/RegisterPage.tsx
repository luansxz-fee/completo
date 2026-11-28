import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Page } from '../components/AppRouter';
import AuthShell from '../components/AuthShell';
import ForcaSenha, { senhaForte } from '../components/ForcaSenha';

interface Props { navigate: (p: Page, dado?: string) => void }

export default function RegisterPage({ navigate }: Props) {
  const { registrar } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (nome.trim().length < 2) return setErro('Informe o seu nome.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErro('Informe um e-mail válido.');
    if (!senhaForte(senha)) return setErro('A senha ainda não atende a todos os requisitos.');
    if (senha !== confirmar) return setErro('As senhas não conferem.');
    if (!aceite) return setErro('É preciso aceitar os termos para criar a conta.');

    setCarregando(true);
    const r = await registrar(nome, email, senha);
    setCarregando(false);
    if (!r.ok) return setErro(r.mensagem || 'Não foi possível criar a conta.');
    if (!r.requerVerificacao) return; // já entrou (servidor sem verificação)
    if (r.emailEnviado === false) sessionStorage.setItem('medsync_verif_falha', '1');
    navigate('verify-email', r.email || email);
  };

  return (
    <AuthShell titulo="Crie sua conta" subtitulo="Enviaremos um código para confirmar o seu e-mail" navigate={navigate}>
      <form className="auth-form" onSubmit={enviar} noValidate>
        <div className="form-group">
          <label htmlFor="reg-nome">Nome completo</label>
          <input id="reg-nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" placeholder="Maria da Silva" />
        </div>
        <div className="form-group">
          <label htmlFor="reg-email">E-mail</label>
          <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="seu@email.com" />
        </div>
        <div className="form-group">
          <label htmlFor="reg-senha">Senha</label>
          <div className="input-wrap">
            <input id="reg-senha" type={mostrar ? 'text' : 'password'} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" aria-describedby="reg-regras" />
            <button type="button" className="input-eye" onClick={() => setMostrar(!mostrar)} aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={mostrar}>
              <span aria-hidden="true">{mostrar ? '🙈' : '👁️'}</span>
            </button>
          </div>
          <ForcaSenha senha={senha} id="reg-regras" />
        </div>
        <div className="form-group">
          <label htmlFor="reg-conf">Confirmar senha</label>
          <input id="reg-conf" type={mostrar ? 'text' : 'password'} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" />
        </div>

        <label className="a11y-linha">
          <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
          <span>Concordo em guardar meus dados de saúde no MedSync para receber lembretes. Posso excluir tudo quando quiser em Perfil.</span>
        </label>

        {erro && <div className="form-error" role="alert">{erro}</div>}

        <button type="submit" className={`btn btn--primary btn--block ${carregando ? 'btn--loading' : ''}`} disabled={carregando}>
          {carregando ? 'Criando conta…' : 'Criar conta'}
        </button>
      </form>
      <p className="auth-form__footer">
        Já tem conta? <button type="button" className="link-btn" onClick={() => navigate('login')}>Entrar</button>
      </p>
    </AuthShell>
  );
}
