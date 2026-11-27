import React, { useMemo, useState } from 'react';
import { useMed } from '../context/useMed';
import { usePaciente } from '../context/PacienteContext';
import { useAcessibilidade } from '../context/AcessibilidadeContext';
import StatusDose, { Estado } from '../components/StatusDose';
import { formatarDataBR, hojeLocal, somarDias } from '../utils/datas';

const corAdesao = (p: number | null) => (p === null ? 'var(--border)' : p >= 80 ? 'var(--success)' : p >= 50 ? 'var(--warning)' : 'var(--danger)');
const rotuloAdesao = (p: number | null) => (p === null ? 'sem dados' : p >= 80 ? 'ótima' : p >= 50 ? 'regular' : 'baixa');

function Anel({ valor, titulo }: { valor: number | null; titulo: string }) {
  const v = valor ?? 0;
  return (
    <div className="history-stat-card" style={{ borderTop: `3px solid ${corAdesao(valor)}` }}>
      <div className="history-stat-card__ring" role="img" aria-label={`${titulo}: ${valor === null ? 'sem dados' : valor + '%'} (${rotuloAdesao(valor)})`}>
        <svg viewBox="0 0 56 56" width="80" height="80" aria-hidden="true">
          <circle cx="28" cy="28" r="24" fill="none" stroke="var(--border)" strokeWidth="5" />
          <circle cx="28" cy="28" r="24" fill="none" stroke={corAdesao(valor)} strokeWidth="5" strokeDasharray={`${v * 1.508} 150.8`} strokeLinecap="round" transform="rotate(-90 28 28)" />
          <text x="28" y="33" textAnchor="middle" fontSize="11" fontWeight="800" fill="currentColor">{valor === null ? '—' : `${valor}%`}</text>
        </svg>
      </div>
      <span>{titulo}</span>
    </div>
  );
}

export default function HistoryPage() {
  const { logs, medications, getAdherenceRate, adherence } = useMed();
  const { paciente } = usePaciente();
  const { avisar, daltonico, prefs } = useAcessibilidade();
  const [dias, setDias] = useState(7);
  const [filtro, setFiltro] = useState<'all' | 'taken' | 'missed' | 'skipped'>('all');

  const a7 = adherence.dias7 ?? getAdherenceRate(7);
  const a30 = adherence.dias30 ?? getAdherenceRate(30);

  const filtrados = useMemo(() => {
    const corte = somarDias(hojeLocal(), -dias);
    return logs
      .filter((l) => l.status !== 'pending' && l.date >= corte && (filtro === 'all' || l.status === filtro))
      .sort((a, b) => b.date.localeCompare(a.date) || b.scheduledTime.localeCompare(a.scheduledTime));
  }, [logs, dias, filtro]);

  const porDia = useMemo(() => {
    const mapa: Record<string, typeof filtrados> = {};
    filtrados.forEach((l) => { (mapa[l.date] = mapa[l.date] || []).push(l); });
    return Object.entries(mapa).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtrados]);

  const cont = {
    taken: filtrados.filter((l) => l.status === 'taken').length,
    missed: filtrados.filter((l) => l.status === 'missed').length,
    skipped: filtrados.filter((l) => l.status === 'skipped').length,
    total: filtrados.length,
  };

  const med = (id: string) => medications.find((m) => m.id === id);
  const nomeDia = (d: string) => {
    const hoje = hojeLocal();
    if (d === hoje) return 'Hoje';
    if (d === somarDias(hoje, -1)) return 'Ontem';
    return new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const exportarCsv = () => {
    const rotulos: Record<string, string> = { taken: 'Tomada', missed: 'Perdida', skipped: 'Pulada', pending: 'Pendente' };
    const linhas = [['Data', 'Horário', 'Medicamento', 'Dosagem', 'Situação', 'Observação']];
    filtrados.forEach((l) => {
      const m = med(l.medicationId);
      linhas.push([formatarDataBR(l.date), l.scheduledTime, m?.name || 'Removido', m ? `${m.dosage} ${m.unit}` : '', rotulos[l.status], l.notes || '']);
    });
    const csv = '\ufeff' + linhas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `medsync-historico-${hojeLocal()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    avisar('Histórico exportado. Você pode levar para a consulta.', 'sucesso');
  };

  return (
    <div className="history-page">
      <div className="page-header">
        <div>
          <h2 className="page-header__titulo">Histórico{paciente ? ` de ${paciente.nome}` : ''}</h2>
          <p className="text-muted">Acompanhe a adesão ao tratamento</p>
        </div>
        <div className="page-header__actions">
          <div className="filter-tabs" role="group" aria-label="Período">
            {[7, 14, 30, 90].map((d) => (
              <button key={d} type="button" className={`tab-btn ${dias === d ? 'tab-btn--active' : ''}`} aria-pressed={dias === d} onClick={() => setDias(d)}>{d} dias</button>
            ))}
          </div>
          <div className="filter-tabs" role="group" aria-label="Situação">
            {([['all', 'Todos'], ['taken', '✓ Tomadas'], ['missed', '✕ Perdidas'], ['skipped', '— Puladas']] as const).map(([v, l]) => (
              <button key={v} type="button" className={`tab-btn ${filtro === v ? 'tab-btn--active' : ''}`} aria-pressed={filtro === v} onClick={() => setFiltro(v)}>{l}</button>
            ))}
          </div>
          <button type="button" className="btn btn--outline btn--sm" onClick={exportarCsv} disabled={!filtrados.length}><span aria-hidden="true">⬇️</span> Exportar CSV</button>
        </div>
      </div>

      <div className="history-stats-row">
        <Anel valor={a7} titulo="Adesão 7 dias" />
        <Anel valor={a30} titulo="Adesão 30 dias" />
        <dl className="history-counters">
          <div className="history-counter history-counter--green"><dt>Tomadas</dt><dd>{cont.taken}</dd></div>
          <div className="history-counter history-counter--red"><dt>Perdidas</dt><dd>{cont.missed}</dd></div>
          <div className="history-counter history-counter--yellow"><dt>Puladas</dt><dd>{cont.skipped}</dd></div>
          <div className="history-counter history-counter--gray"><dt>Total</dt><dd>{cont.total}</dd></div>
        </dl>
      </div>

      {porDia.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" aria-hidden="true">📋</div>
          <h3>Nenhum registro neste período</h3>
          <p>Registre doses na tela “Hoje” para ver o histórico aqui.</p>
        </div>
      ) : (
        <div className="history-list">
          {porDia.map(([data, doDia]) => {
            const tomadas = doDia.filter((l) => l.status === 'taken').length;
            const p = Math.round((tomadas / doDia.length) * 100);
            return (
              <section key={data} className="history-day" aria-label={`${nomeDia(data)}: ${tomadas} de ${doDia.length} doses tomadas`}>
                <div className="history-day__header">
                  <h3 className="history-day__date">{nomeDia(data)}</h3>
                  <div className="history-day__right">
                    <div className="history-day__bar" aria-hidden="true"><div className="history-day__bar-fill" style={{ width: `${p}%`, background: corAdesao(p) }} /></div>
                    <span className="history-day__pct" style={{ color: corAdesao(p) }}>
                      {tomadas}/{doDia.length}{daltonico && prefs.daltonismoGrau >= 3 ? ` · ${rotuloAdesao(p)}` : ''}
                    </span>
                  </div>
                </div>
                <ul className="history-day__logs">
                  {doDia.map((l) => {
                    const m = med(l.medicationId);
                    return (
                      <li key={l.id} className="history-log">
                        <div className="history-log__dot" style={{ background: m?.color || '#6B7280' }} aria-hidden="true" />
                        <div className="history-log__info">
                          <span className="history-log__name">{m?.name || 'Medicamento removido'}</span>
                          <span className="text-muted">{m ? `${m.dosage} ${m.unit} · ` : ''}{l.scheduledTime}</span>
                          {l.notes && <span className="med-item__note"><span aria-hidden="true">💬</span> {l.notes}</span>}
                          {l.automatic && <span className="med-item__note">Marcada como perdida automaticamente</span>}
                          {l.registeredBy && <span className="med-item__note">Registrado por um cuidador</span>}
                        </div>
                        <StatusDose estado={l.status as Estado} />
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
