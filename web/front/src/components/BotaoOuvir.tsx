import React from 'react';
import { useAcessibilidade } from '../context/AcessibilidadeContext';

/** Botão "Ouvir": aparece só quando a leitura em voz alta está ativada. */
export default function BotaoOuvir({ texto, rotulo = 'Ouvir' }: { texto: string; rotulo?: string }) {
  const { vozAtiva, vozDisponivel, falar } = useAcessibilidade();
  if (!vozAtiva || !vozDisponivel) return null;
  return (
    <button type="button" className="btn btn--ghost btn--xs btn-ouvir" onClick={() => falar(texto, true)} aria-label={`${rotulo}: ${texto}`}>
      <span aria-hidden="true">🔊</span> {rotulo}
    </button>
  );
}
