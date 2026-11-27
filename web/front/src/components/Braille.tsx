import React from 'react';
import { useAcessibilidade } from '../context/AcessibilidadeContext';
import { paraBraille } from '../utils/braille';

/**
 * Mostra o texto em Braille (Unicode) quando o nível 3 do leitor está ativo.
 * É aria-hidden: leitores de tela e linhas Braille já recebem o texto normal.
 */
export default function Braille({ texto, bloco = false }: { texto: string; bloco?: boolean }) {
  const { brailleAtivo } = useAcessibilidade();
  if (!brailleAtivo || !texto) return null;
  const Tag = bloco ? 'div' : 'span';
  return (
    <Tag className={bloco ? 'braille braille--bloco' : 'braille'} aria-hidden="true" translate="no" lang="pt-BR">
      {paraBraille(texto)}
    </Tag>
  );
}
