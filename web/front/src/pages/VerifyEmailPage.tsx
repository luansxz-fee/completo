import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAcessibilidade } from '../context/AcessibilidadeContext';
import { Page } from '../components/AppRouter';
import AuthShell from '../components/AuthShell';

interface Props { navigate: (p: Page, dado?: string) => void; email: string }

export default function VerifyEmailPage({ navigate, email: emailInicial }: Props) {
  const { verificarEmail, reenviarVerificacao } = useAuth();
  const { avisar } = useAcessibilidade();
  const [email, setEmail] = useState(emailInicial);
  const [digitos, setDigitos] = useState<string[]>(Array(6).fill(''));
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [espera, setEspera] = useState(60);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const codigo = digitos.join('');

  useEffect(() => { refs.current[0]?.focus(); }, []);
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const confirmar = async (valor = codigo) => {
    if (valor.length !== 6 || !email) return;
    setCarregando(true);
    setErro('');
    const r = await verificarEmail(email, valor);
    setCarregando(false);
    if (!r.ok) {
      setErro(r.mensagem || 'Código inválido.');
      setDigitos(Array(6).fill(''));
      refs.current[0]?.focus();
      return;
    }
    // sucesso com sessão: o AuthContext já entrou; sem sessão (já verificado) → login
    avisar('E-mail confirmado! Bem-vindo ao MedSync.', 'sucesso');
    navigate('dashboard');
  };

  const mudar = (i: number, v: string) => {
    const so = v.replace(/\D/g, '');
    if (!so) { setDigitos((d) => d.map((x, k) => (k === i ? '' : x))); return; }
    const novo = [...digitos];
    so.slice(0, 6 - i).split('').forEach((c, k) => { novo[i + k] = c; });
    setDigitos(novo);
    refs.current[Math.min(i + so.length, 5)]?.focus();
    if (novo.every(Boolean)) void confirmar(novo.join(''));
  };

  const aoTeclar = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digitos[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  };

  const reenviar = async () => {
    setErro('');
    const r = await reenviarVerificacao(email);
    if (!r.ok) return setErro(r.mensagem || 'Não foi possível reenviar.');
    setEspera(r.espera && r.espera > 0 ? r.espera : 60);
    avisar('Enviamos um novo código. Confira também a caixa de spam.', 'sucesso');
  };

  return (
    <AuthShell titulo="Confirme o seu e-mail" subtitulo={email ? `Digite o código de 6 dígitos enviado para ${email}` : 'Digite o seu e-mail e o código recebido'} voltarPara="login" navigate={navigate}>
      <form className="auth-form" onSubmit={(e) => { e.preventDefault(); void confirmar(); }}>
        {!emailInicial && (
          <div className="form-group">
            <label htmlFor="ver-email">E-mail</label>
            <input id="ver-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
        )}

        <fieldset className="codigo-campos">
          <legend className="sr-only">Código de verificação de 6 dígitos</legend>
          {digitos.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              className={`codigo-campo ${erro ? 'input--error' : ''}`}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              pattern="[0-9]*"
              maxLength={6}
              value={d}
              aria-label={`Dígito ${i + 1} de 6`}
              onChange={(e) => mudar(i, e.target.value)}
              onKeyDown={(e) => aoTeclar(i, e)}
              onFocus={(e) => e.target.select()}
            />
          ))}
        </fieldset>

        {erro && <div className="form-error" role="alert">{erro}</div>}

        <button type="submit" className={`btn btn--primary btn--block ${carregando ? 'btn--loading' : ''}`} disabled={carregando || codigo.length !== 6}>
          {carregando ? 'Confirmando…' : 'Confirmar e entrar'}
        </button>
      </form>

      <p className="auth-form__footer">
        Não chegou? Veja o spam ou{' '}
        <button type="button" className="link-btn" onClick={() => void reenviar()} disabled={espera > 0}>
          {espera > 0 ? `reenviar em ${espera}s` : 'reenviar código'}
        </button>
      </p>
    </AuthShell>
  );
}
