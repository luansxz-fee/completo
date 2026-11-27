import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAcessibilidade } from '../context/AcessibilidadeContext';
import { usePaciente } from '../context/PacienteContext';
import { useLembretesLocais } from '../hooks/useLembretesLocais';
import { Page, TITULOS } from './AppRouter';
import Logo from './Logo';

interface LayoutProps {
  children: React.ReactNode;
  page: Page;
  navigate: (p: Page) => void;
}

const ITENS: { chave: Page; rotulo: string; icone: string }[] = [
  { chave: 'dashboard', rotulo: 'Hoje', icone: '⊞' },
  { chave: 'medications', rotulo: 'Medicamentos', icone: '💊' },
  { chave: 'history', rotulo: 'Histórico', icone: '📋' },
  { chave: 'caregivers', rotulo: 'Cuidadores', icone: '🤝' },
  { chave: 'profile', rotulo: 'Perfil', icone: '👤' },
];

export default function Layout({ children, page, navigate }: LayoutProps) {
  const { usuario, sair } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { prefs, abrirPainel, leitorAtivo } = useAcessibilidade();
  const { paciente, somenteLeitura, focar } = usePaciente();
  const [menuAberto, setMenuAberto] = useState(false);

  useLembretesLocais();

  // Atalhos: Alt+Shift+1..5 navegam entre as telas.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (!(e.altKey && e.shiftKey)) return;
      const n = Number(e.code.replace('Digit', ''));
      if (n >= 1 && n <= ITENS.length) {
        e.preventDefault();
        navigate(ITENS[n - 1].chave);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [navigate]);

  useEffect(() => {
    if (!menuAberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && setMenuAberto(false);
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [menuAberto]);

  const inicial = usuario?.nome?.charAt(0).toUpperCase();

  return (
    <div className="app-layout">
      <aside className={`sidebar ${menuAberto ? 'sidebar--open' : ''}`} aria-label="Menu lateral">
        <div className="sidebar__header">
          <Logo size="sm" />
          <button type="button" className="sidebar__close mobile-only" onClick={() => setMenuAberto(false)} aria-label="Fechar menu">
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Principal">
          {ITENS.map((item, i) => (
            <button
              type="button"
              key={item.chave}
              className={`sidebar__item ${page === item.chave ? 'sidebar__item--active' : ''}`}
              aria-current={page === item.chave ? 'page' : undefined}
              title={leitorAtivo ? `Atalho: Alt+Shift+${i + 1}` : undefined}
              onClick={() => { navigate(item.chave); setMenuAberto(false); }}
            >
              <span className="sidebar__icon" aria-hidden="true">{item.icone}</span>
              <span>{item.rotulo}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          {prefs.visao > 0 && <div className="sidebar__modo-badge">Acessibilidade: visão nível {prefs.visao}</div>}
          <button type="button" className="sidebar__theme-btn" onClick={abrirPainel}>
            <span aria-hidden="true">♿</span> Acessibilidade
          </button>
          <button type="button" className="sidebar__theme-btn" onClick={toggleTheme}>
            <span aria-hidden="true">{theme === 'light' ? '🌙' : '☀️'}</span> {theme === 'light' ? 'Tema escuro' : 'Tema claro'}
          </button>
          <div className="sidebar__user">
            <div className="sidebar__avatar" aria-hidden="true">{inicial}</div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">{usuario?.nome}</span>
              <span className="sidebar__user-email">{usuario?.email}</span>
            </div>
          </div>
          <button type="button" className="sidebar__logout" onClick={sair}>Sair</button>
        </div>
      </aside>

      {menuAberto && <div className="overlay" onClick={() => setMenuAberto(false)} aria-hidden="true" />}

      <div className="main-content">
        <header className="topbar">
          <button type="button" className="topbar__menu mobile-only" onClick={() => setMenuAberto(true)} aria-label="Abrir menu" aria-expanded={menuAberto}>
            <span aria-hidden="true">☰</span>
          </button>
          <div className="topbar__title" aria-hidden="true">{TITULOS[page]}</div>
          <div className="topbar__actions">
            <button type="button" className="topbar__theme desktop-only" onClick={toggleTheme} aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}>
              <span aria-hidden="true">{theme === 'light' ? '🌙' : '☀️'}</span>
            </button>
            <button type="button" className="topbar__avatar" onClick={() => navigate('profile')} aria-label="Abrir meu perfil">
              <span aria-hidden="true">{inicial}</span>
            </button>
          </div>
        </header>

        {paciente && (
          <div className="banner-paciente" role="status">
            <span>
              <span aria-hidden="true">🤝</span> Você está {somenteLeitura ? 'acompanhando' : 'cuidando de'} <strong>{paciente.nome}</strong>
              {somenteLeitura && ' (somente leitura)'}
            </span>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => { focar(null); navigate('caregivers'); }}>
              Voltar aos meus dados
            </button>
          </div>
        )}

        <main id="conteudo" tabIndex={-1} className="page-content">
          <h1 className="sr-only">{TITULOS[page]}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}
