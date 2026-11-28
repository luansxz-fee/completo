import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAcessibilidade } from '../context/AcessibilidadeContext';
import { Page } from '../components/AppRouter';
import AuthShell from '../components/AuthShell';
import ForcaSenha, { senhaForte } from '../components/ForcaSenha';

interface Props { navigate: (p: Page) => void; token: string }

export default function ResetPasswordPage({ navigate, token }: Props) {
  const { redefinirSenha } = useAuth();
  const { avisar } = useAcessibilidade();
  const [codigo, setCodigo] = useState(token || '');
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (codigo.trim().length < 8) return setErro('Digite o código de 8 caracteres do e-mail.');
    if (!senhaForte(senha)) return setErro('A senha ainda não atende a todos os requisitos.');
    if (senha !== conf) return setErro('As senhas não conferem.');
    setCarregando(true);
    const r = await redefinirSenha(codigo, senha);
    setCarregando(false);
    if (!r.ok) return setErro(r.mensagem || 'Código inválido ou expirado.');
    avisar('Senha redefinida! Entre com a nova senha.', 'sucesso');
    navigate('login');
  };

  return (
    <AuthShell titulo="Criar nova senha" subtitulo="Use o código que enviamos por e-mail" voltarPara="login" navigate={navigate}>
      <form className="auth-form" onSubmit={enviar} noValidate>
        <div className="form-group">
          <label htmlFor="res-codigo">Código do e-mail</label>
          <input id="res-codigo" type="text" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={8} autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} className="input--codigo" placeholder="ABCD2345" />
        </div>
        <div className="form-group">
          <label htmlFor="res-senha">Nova senha</label>
          <div className="input-wrap">
            <input id="res-senha" type={mostrar ? 'text' : 'password'} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" aria-describedby="res-regras" />
            <button type="button" className="input-eye" onClick={() => setMostrar(!mostrar)} aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={mostrar}>
              <span aria-hidden="true">{mostrar ? '🙈' : '👁️'}</span>
            </button>
          </div>
          <ForcaSenha senha={senha} id="res-regras" />
        </div>
        <div className="form-group">
          <label htmlFor="res-conf">Confirmar nova senha</label>
          <input id="res-conf" type={mostrar ? 'text' : 'password'} value={conf} onChange={(e) => setConf(e.target.value)} autoComplete="new-password" />
        </div>
        {erro && <div className="form-error" role="alert">{erro}</div>}
        <button type="submit" className={`btn btn--primary btn--block ${carregando ? 'btn--loading' : ''}`} disabled={carregando}>
          {carregando ? 'Salvando…' : 'Redefinir senha'}
        </button>
      </form>
    </AuthShell>
  );
}
