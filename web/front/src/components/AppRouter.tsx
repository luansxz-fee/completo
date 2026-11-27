import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAcessibilidade } from '../context/AcessibilidadeContext';
import LandingPage from '../pages/LandingPage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import VerifyEmailPage from '../pages/VerifyEmailPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import Dashboard from '../pages/Dashboard';
import MedicationsPage from '../pages/MedicationsPage';
import HistoryPage from '../pages/HistoryPage';
import ProfilePage from '../pages/ProfilePage';
import CaregiversPage from '../pages/CaregiversPage';
import Layout from './Layout';
import { registrarServiceWorker } from '../hooks/useNotificacoes';

export type Page =
  | 'landing' | 'login' | 'register' | 'verify-email' | 'forgot-password' | 'reset-password'
  | 'dashboard' | 'medications' | 'history' | 'caregivers' | 'profile';

const PUBLICAS: Page[] = ['landing', 'login', 'register', 'verify-email', 'forgot-password', 'reset-password'];
const PRIVADAS: Page[] = ['dashboard', 'medications', 'history', 'caregivers', 'profile'];
const TODAS = [...PUBLICAS, ...PRIVADAS];

export const TITULOS: Record<Page, string> = {
  landing: 'Início',
  login: 'Entrar',
  register: 'Criar conta',
  'verify-email': 'Confirmar e-mail',
  'forgot-password': 'Recuperar senha',
  'reset-password': 'Nova senha',
  dashboard: 'Hoje',
  medications: 'Medicamentos',
  history: 'Histórico',
  caregivers: 'Cuidadores',
  profile: 'Perfil e configurações',
};

const lerHash = (): Page => {
  const h = window.location.hash.replace('#', '').split('?')[0] as Page;
  return TODAS.includes(h) ? h : 'landing';
};

export default function AppRouter() {
  const { usuario, isLoading } = useAuth();
  const { anunciar } = useAcessibilidade();
  const [pagina, setPagina] = useState<Page>(lerHash);
  const [tokenRecuperacao, setTokenRecuperacao] = useState('');
  const [emailPendente, setEmailPendente] = useState(() => sessionStorage.getItem('medsync_verif_email') || '');
  const primeira = useRef(true);

  useEffect(() => { void registrarServiceWorker(); }, []);

  useEffect(() => {
    const aoMudar = () => setPagina(lerHash());
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);

  const navegar = useCallback((p: Page, dado?: string) => {
    if (p === 'reset-password' && dado) setTokenRecuperacao(dado);
    if (p === 'verify-email' && dado) {
      setEmailPendente(dado);
      sessionStorage.setItem('medsync_verif_email', dado);
    }
    if (window.location.hash !== `#${p}`) window.location.hash = p;
    else setPagina(p);
  }, []);

  // Página efetiva (protege rotas privadas e evita telas públicas para quem já entrou)
  const efetiva: Page = usuario
    ? PRIVADAS.includes(pagina) ? pagina : 'dashboard'
    : PUBLICAS.includes(pagina) ? pagina : 'login';

  // Acessibilidade de navegação: título da aba, foco no conteúdo e anúncio da nova tela.
  useEffect(() => {
    document.title = `${TITULOS[efetiva]} · MedSync`;
    if (primeira.current) { primeira.current = false; return; }
    const principal = document.getElementById('conteudo');
    principal?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
    anunciar(`Tela: ${TITULOS[efetiva]}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [efetiva]);

  if (isLoading) {
    return (
      <div className="loading-screen" role="status" aria-live="polite">
        <div className="loading-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <circle cx="24" cy="24" r="22" stroke="#2563EB" strokeWidth="2.5" fill="none" />
            <path d="M16 24h4l3-8 4 16 3-8h2" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>MedSync</span>
        </div>
        <div className="loading-spinner" aria-hidden="true" />
        <span className="sr-only">Carregando o MedSync…</span>
      </div>
    );
  }

  const Publica = () => {
    switch (efetiva) {
      case 'login': return <LoginPage navigate={navegar} />;
      case 'register': return <RegisterPage navigate={navegar} />;
      case 'verify-email': return <VerifyEmailPage navigate={navegar} email={emailPendente} />;
      case 'forgot-password': return <ForgotPasswordPage navigate={navegar} />;
      case 'reset-password': return <ResetPasswordPage navigate={navegar} token={tokenRecuperacao} />;
      default: return <LandingPage navigate={navegar} />;
    }
  };

  const conteudo = !usuario ? (
    <main id="conteudo" tabIndex={-1} className="publico-main">{Publica()}</main>
  ) : (
    <Layout page={efetiva} navigate={navegar}>
      {efetiva === 'medications' && <MedicationsPage />}
      {efetiva === 'history' && <HistoryPage />}
      {efetiva === 'caregivers' && <CaregiversPage navigate={navegar} />}
      {efetiva === 'profile' && <ProfilePage navigate={navegar} />}
      {efetiva === 'dashboard' && <Dashboard navigate={navegar} />}
    </Layout>
  );

  return (
    <>
      <a href="#conteudo" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('conteudo')?.focus(); }}>
        Pular para o conteúdo
      </a>
      {conteudo}
    </>
  );
}
