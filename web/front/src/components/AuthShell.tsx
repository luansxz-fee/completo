import React from 'react';
import Logo from './Logo';
import { useTheme } from '../context/ThemeContext';
import { Page } from './AppRouter';

interface Props {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  voltarPara?: Page;
  navigate: (p: Page) => void;
}

/** Moldura comum das telas de autenticação. */
export default function AuthShell({ titulo, subtitulo, children, voltarPara = 'landing', navigate }: Props) {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="auth-page">
      <div className="auth-page__left" aria-hidden="true">
        <div className="auth-page__brand">
          <Logo size="lg" variant="white" />
          <p>Sua saúde organizada, sua vida simplificada.</p>
        </div>
        <div className="auth-page__illustration">
          <div className="auth-orb auth-orb--1" />
          <div className="auth-orb auth-orb--2" />
        </div>
      </div>

      <div className="auth-page__right">
        <div className="auth-page__theme">
          <button type="button" className="btn btn--ghost btn--icon" onClick={toggleTheme} aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}>
            <span aria-hidden="true">{theme === 'light' ? '🌙' : '☀️'}</span>
          </button>
        </div>
        <div className="auth-form-wrap">
          <div className="auth-form__header">
            <h1>{titulo}</h1>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          {children}
          <button type="button" className="auth-back" onClick={() => navigate(voltarPara)}>
            {voltarPara === 'login' ? 'Voltar ao login' : 'Voltar ao início'}
          </button>
        </div>
      </div>
    </div>
  );
}
