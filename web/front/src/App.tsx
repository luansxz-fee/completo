import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { AcessibilidadeProvider } from './context/AcessibilidadeContext';
import { PacienteProvider } from './context/PacienteContext';
import { MedProvider } from './context/MedContext';
import AppRouter from './components/AppRouter';
import BotaoAcessibilidade from './components/BotaoAcessibilidade';
import './index.css';
import './styles/extras.css';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AcessibilidadeProvider>
          <PacienteProvider>
            <MedProvider>
              <AppRouter />
              <BotaoAcessibilidade />
            </MedProvider>
          </PacienteProvider>
        </AcessibilidadeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
