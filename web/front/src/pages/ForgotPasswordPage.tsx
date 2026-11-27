import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Page } from '../components/AppRouter';
import AuthShell from '../components/AuthShell';

interface Props { navigate: (p: Page, dado?: string) => void }

export default function ForgotPasswordPage({ navigate }: Props) {
  const { solicitarRecuperacaoSenha } = useAuth();
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErro('Informe um e-mail válido.');
    setCarregando(true);
    setErro('');
    const r = await solicitarRecuperacaoSenha(email);
    setCarregando(false);
    if (!r.ok) return setErro(r.mensagem || 'Não foi possível enviar.');
    setEnviado(true);
  };

  if (enviado) {
    return (
      <AuthShell titulo="Confira o seu e-mail" subtitulo="Se o endereço estiver cadastrado, enviamos um código de 8 caracteres (vale por 1 hora)." voltarPara="login" navigate={navigate}>
        <div className="form-success" role="status">Código enviado para <strong>{email}</strong>. Olhe também o spam.</div>
        <button type="button" className="btn btn--primary btn--block" onClick={() => navigate('reset-password')}>Já tenho o código</button>
      </AuthShell>
    );
  }

  return (
    <AuthShell titulo="Recuperar senha" subtitulo="Informe o e-mail da sua conta" voltarPara="login" navigate={navigate}>
      <form className="auth-form" onSubmit={enviar} noValidate>
        <div className="form-group">
          <label htmlFor="rec-email">E-mail</label>
          <input id="rec-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="seu@email.com" />
        </div>
        {erro && <div className="form-error" role="alert">{erro}</div>}
        <button type="submit" className={`btn btn--primary btn--block ${carregando ? 'btn--loading' : ''}`} disabled={carregando}>
          {carregando ? 'Enviando…' : 'Enviar código'}
        </button>
      </form>
    </AuthShell>
  );
}
