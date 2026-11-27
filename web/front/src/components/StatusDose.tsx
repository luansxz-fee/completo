import React from 'react';
import { useAcessibilidade } from '../context/AcessibilidadeContext';

export type Estado = 'taken' | 'skipped' | 'missed' | 'late' | 'pending';

const INFO: Record<Estado, { simbolo: string; texto: string; classe: string }> = {
  taken: { simbolo: '✓', texto: 'Tomado', classe: 'badge--success' },
  skipped: { simbolo: '—', texto: 'Pulado', classe: 'badge--warning' },
  missed: { simbolo: '✕', texto: 'Perdido', classe: 'badge--danger' },
  late: { simbolo: '!', texto: 'Atrasado', classe: 'badge--danger' },
  pending: { simbolo: '⏳', texto: 'Pendente', classe: 'badge--muted' },
};

export const rotuloEstado = (e: Estado) => INFO[e].texto;

/**
 * Selo de status. Nunca depende só da cor: sempre tem símbolo + palavra
 * (requisito para daltonismo) e o rótulo completo para leitores de tela.
 */
export default function StatusDose({ estado }: { estado: Estado }) {
  const i = INFO[estado];
  const { daltonico, prefs } = useAcessibilidade();
  return (
    <span className={`badge ${i.classe} status-dose`} data-estado={estado} role="img" aria-label={`Situação: ${i.texto}`}>
      <span aria-hidden="true">{i.simbolo} {i.texto}</span>
      {daltonico && prefs.daltonismoGrau >= 3 && <span className="status-dose__padrao" aria-hidden="true" />}
    </span>
  );
}

/** Pontinho/símbolo de status para listas compactas (semana, legendas). */
export function PontoStatus({ pct }: { pct: number }) {
  const { daltonico, prefs } = useAcessibilidade();
  const nivel = pct < 0 ? 'vazio' : pct >= 80 ? 'bom' : pct >= 50 ? 'medio' : 'ruim';
  const simbolo = nivel === 'bom' ? '✓' : nivel === 'medio' ? '!' : nivel === 'ruim' ? '✕' : '·';
  const mostrar = daltonico && prefs.daltonismoGrau >= 2;
  return (
    <span className={`ponto-status ponto-status--${nivel}`} aria-hidden="true">
      {(mostrar || nivel === 'vazio') && simbolo}
    </span>
  );
}
