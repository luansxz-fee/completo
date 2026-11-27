import React from 'react';
import { useAcessibilidade } from '../context/AcessibilidadeContext';
import PainelAcessibilidade from './PainelAcessibilidade';

/** Botão flutuante presente em TODAS as telas (inclusive login e página inicial). */
export default function BotaoAcessibilidade() {
  const { painelAberto, abrirPainel } = useAcessibilidade();
  return (
    <>
      <button
        type="button"
        className="a11y-fab"
        onClick={abrirPainel}
        aria-label="Abrir opções de acessibilidade"
        aria-haspopup="dialog"
        title="Acessibilidade (Alt+Shift+0)"
      >
        <span aria-hidden="true">♿</span>
      </button>
      {painelAberto && <PainelAcessibilidade />}
    </>
  );
}
