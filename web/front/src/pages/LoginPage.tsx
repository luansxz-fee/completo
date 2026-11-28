import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Page } from '../components/AppRouter';
import AuthShell from '../components/AuthShell';

interface Props { navigate: (p: Page, dado?: string) => void }

export default function LoginPage({ navigate }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mostrar, setMostrar] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !senha) { setErro('Preencha o e-mail e a senha.'); return; }
    setCarregando(true);
    setErro('');
    const r = await login(email, senha);
    setCarregando(false);
    if (r.ok) return;
    if (r.requerVerificacao) {
      if (r.emailEnviado === false) sessionStorage.setItem('medsync_verif_falha', '1');
      navigate('verify-email', r.email || email);
      return;
    }
    setErro(r.mensagem || 'E-mail ou senha incorretos.');
  };

  return (
    <AuthShell titulo="Bem-vindo de volta" subtitulo="Entre com a sua conta MedSync" navigate={navigate}>
      <form className="auth-form" onSubmit={enviar} noValidate>
        <div className="form-group">
          <label htmlFor="login-email">E-mail</label>
          <input id="login-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
            className={erro ? 'input--error' : ''} autoComplete="email" inputMode="email" aria-invalid={!!erro} aria-describedby={erro ? 'login-erro' : undefined} />
        </div>

        <div className="form-group">
          <label htmlFor="login-senha">
            Senha
            <button type="button" className="form-group__link" onClick={() => navigate('forgot-password')}>Esqueceu a senha?</button>
          </label>
          <div className="input-wrap">
            <input id="login-senha" type={mostrar ? 'text' : 'password'} placeholder="••••••••" value={senha} onChange={(e) => setSenha(e.target.value)}
              className={erro ? 'input--error' : ''} autoComplete="current-password" aria-invalid={!!erro} />
            <button type="button" className="input-eye" onClick={() => setMostrar(!mostrar)} aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={mostrar}>
              <span aria-hidden="true">{mostrar ? '🙈' : '👁️'}</span>
            </button>
          </div>
        </div>

        {erro && <div id="login-erro" className="form-error" role="alert">{erro}</div>}

        <button type="submit" className={`btn btn--primary btn--block ${carregando ? 'btn--loading' : ''}`} disabled={carregando}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="auth-form__footer">
        Não tem uma conta?{' '}
        <button type="button" className="link-btn" onClick={() => navigate('register')}>Cadastre-se grátis</button>
      </p>
    </AuthShell>
  );
}
