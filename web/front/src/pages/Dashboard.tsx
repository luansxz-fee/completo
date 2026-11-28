import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMed } from '../context/useMed';
import { usePaciente } from '../context/PacienteContext';
import { useAcessibilidade } from '../context/AcessibilidadeContext';
import { Page } from '../components/AppRouter';
import MedModal from '../components/MedModal';
import Modal from '../components/Modal';
import Braille from '../components/Braille';
import BannerNotificacoes from '../components/BannerNotificacoes';
import BotaoOuvir from '../components/BotaoOuvir';
import StatusDose, { PontoStatus, Estado } from '../components/StatusDose';
import { hojeLocal } from '../utils/datas';

interface Props { navigate: (p: Page) => void }

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

export default function Dashboard({ navigate }: Props) {
  const { usuario } = useAuth();
  const { paciente, somenteLeitura } = usePaciente();
  const { falar, vozAtiva, prefs } = useAcessibilidade();
  const { getTodayMedications, getAdherenceRate, medications, logs, logDose, adherence, loading } = useMed();
  const [adicionando, setAdicionando] = useState(false);
  const [nota, setNota] = useState<{ id: string; hora: string; nome: string } | null>(null);
  const [textoNota, setTextoNota] = useState('');

  const hoje = getTodayMedications();
  const a7 = adherence.dias7 ?? getAdherenceRate(7);
  const a30 = adherence.dias30 ?? getAdherenceRate(30);

  const proximas = hoje.filter((t) => t.state === 'pending');
  const atrasadas = hoje.filter((t) => t.state === 'late');
  const tomadas = hoje.filter((t) => t.state === 'taken').length;
  const ativos = medications.filter((m) => m.active).length;
  const baixos = medications.filter((m) => m.active && m.stock <= 5).length;

  const agora = new Date();
  const saudacao = agora.getHours() < 12 ? 'Bom dia' : agora.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const nomeFoco = paciente ? paciente.nome : usuario?.nome?.split(' ')[0];

  const semana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const dia = hojeLocal(d);
    const doDia = logs.filter((l) => l.date === dia && l.status !== 'pending');
    const t = doDia.filter((l) => l.status === 'taken').length;
    return { rotulo: DIAS[d.getDay()], hoje: i === 6, pct: doDia.length ? Math.round((t / doDia.length) * 100) : -1 };
  });

  const resumoFalado = () => {
    const partes = [`${saudacao}, ${nomeFoco}.`, `Hoje você tem ${hoje.length} dose${hoje.length === 1 ? '' : 's'}; ${tomadas} já ${tomadas === 1 ? 'foi tomada' : 'foram tomadas'}.`];
    if (atrasadas.length) partes.push(`Atrasadas: ${atrasadas.map((t) => `${t.medication.name} das ${t.scheduledTime}`).join(', ')}.`);
    if (proximas.length) partes.push(`Próxima: ${proximas[0].medication.name} às ${proximas[0].scheduledTime}.`);
    if (!atrasadas.length && !proximas.length && hoje.length) partes.push('Tudo em dia.');
    if (baixos) partes.push(`${baixos} medicamento${baixos === 1 ? '' : 's'} com estoque baixo.`);
    falar(partes.join(' '), true);
  };

  const registrar = (id: string, hora: string, status: 'taken' | 'skipped' | 'pending', observacao?: string) =>
    logDose(id, hora, status, observacao).catch(() => {});

  const estadoStat = a7 !== null && a7 < 50 ? 'orange' : 'green';

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div>
          <h2 className="dashboard__titulo">{saudacao}, {nomeFoco}! <span aria-hidden="true">👋</span></h2>
          <p className="dashboard__date">{agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="dashboard__acoes">
          {(vozAtiva || prefs.leitor >= 1) && (
            <button type="button" className="btn btn--outline" onClick={resumoFalado}><span aria-hidden="true">🔊</span> Ouvir resumo do dia</button>
          )}
          {!somenteLeitura && (
            <button type="button" className="btn btn--primary" onClick={() => setAdicionando(true)}>
              <span aria-hidden="true">+</span> Adicionar medicamento
            </button>
          )}
        </div>
      </div>

      {!paciente && <BannerNotificacoes />}

      {atrasadas.length > 0 && (
        <div className="aviso-atraso" role="alert">
          <strong><span aria-hidden="true">⚠️</span> {atrasadas.length} dose{atrasadas.length > 1 ? 's' : ''} atrasada{atrasadas.length > 1 ? 's' : ''}:</strong>{' '}
          {atrasadas.map((t) => `${t.medication.name} (${t.scheduledTime})`).join(', ')}. Ainda dá tempo de registrar abaixo.
        </div>
      )}

      <div className="stats-row" role="list" aria-label="Resumo">
        <div className="stat-card stat-card--blue" role="listitem">
          <div className="stat-card__icon" aria-hidden="true">💊</div>
          <div className="stat-card__value">{tomadas}/{hoje.length}</div>
          <div className="stat-card__label">Doses hoje</div>
          {hoje.length > 0 && <div className="stat-card__bar"><div className="stat-card__bar-fill" style={{ width: `${(tomadas / hoje.length) * 100}%`, background: '#fff' }} /></div>}
        </div>
        <div className={`stat-card stat-card--${estadoStat}`} role="listitem">
          <div className="stat-card__icon" aria-hidden="true">📈</div>
          <div className="stat-card__value">{pct(a7)}</div>
          <div className="stat-card__label">Adesão 7 dias</div>
          <div className="stat-card__bar"><div className="stat-card__bar-fill" style={{ width: `${a7 ?? 0}%`, background: '#fff' }} /></div>
        </div>
        <div className="stat-card stat-card--purple" role="listitem">
          <div className="stat-card__icon" aria-hidden="true">🗂️</div>
          <div className="stat-card__value">{ativos}</div>
          <div className="stat-card__label">Medicamentos ativos</div>
        </div>
        <div className={`stat-card ${baixos > 0 ? 'stat-card--orange' : 'stat-card--teal'}`} role="listitem">
          <div className="stat-card__icon" aria-hidden="true">{baixos > 0 ? '⚠️' : '✅'}</div>
          <div className="stat-card__value">{baixos > 0 ? baixos : pct(a30)}</div>
          <div className="stat-card__label">{baixos > 0 ? 'Estoque baixo' : 'Adesão 30 dias'}</div>
        </div>
      </div>

      <div className="dashboard__grid">
        <section className="card" aria-labelledby="h-hoje">
          <div className="card__header">
            <h2 id="h-hoje">Medicamentos de hoje</h2>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('medications')}>Ver todos <span aria-hidden="true">→</span></button>
          </div>

          {loading && hoje.length === 0 ? (
            <p className="text-muted" role="status">Carregando…</p>
          ) : hoje.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon" aria-hidden="true">💊</div>
              <p>Nenhum medicamento ativo para hoje.</p>
              {!somenteLeitura && <button type="button" className="btn btn--outline btn--sm" onClick={() => setAdicionando(true)}>+ Adicionar agora</button>}
            </div>
          ) : (
            <ul className="med-list" aria-label="Doses de hoje">
              {hoje.map(({ medication, log, scheduledTime, state }) => {
                const resolvido = state === 'taken' || state === 'skipped' || state === 'missed';
                const descricao = `${medication.name}, ${medication.dosage} ${medication.unit}, às ${scheduledTime}`;
                return (
                  <li key={`${medication.id}-${scheduledTime}`} className={`med-item ${state === 'taken' ? 'med-item--taken' : ''} ${state === 'late' ? 'med-item--late' : ''}`} aria-label={descricao}>
                    {medication.imageUrl ? (
                      <img src={medication.imageUrl} alt="" className="med-item__img" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="med-item__color" style={{ background: medication.color }} aria-hidden="true" />
                    )}
                    <div className="med-item__info">
                      <span className="med-item__name">{medication.name}</span>
                      <span className="med-item__detail">{medication.dosage} {medication.unit} • {scheduledTime}</span>
                      <Braille texto={`${medication.name} ${medication.dosage} ${medication.unit} ${scheduledTime}`} />
                      {log?.notes && <span className="med-item__note"><span aria-hidden="true">💬</span> {log.notes}</span>}
                      {log?.registeredBy && <span className="med-item__note">Registrado por um cuidador</span>}
                      {log?.automatic && state === 'missed' && <span className="med-item__note">Marcada como perdida automaticamente</span>}
                    </div>
                    <div className="med-item__actions">
                      <BotaoOuvir texto={`${descricao}. Situação: ${state === 'taken' ? 'tomado' : state === 'late' ? 'atrasado' : state === 'missed' ? 'perdido' : state === 'skipped' ? 'pulado' : 'pendente'}`} />
                      {resolvido ? (
                        <>
                          <StatusDose estado={state as Estado} />
                          {!somenteLeitura && (
                            <button type="button" className="btn btn--ghost btn--xs" onClick={() => void registrar(medication.id, scheduledTime, 'pending')} aria-label={`Desfazer registro de ${descricao}`}>Desfazer</button>
                          )}
                        </>
                      ) : (
                        <>
                          {state === 'late' && <StatusDose estado="late" />}
                          {!somenteLeitura && (
                            <div className="med-item__btn-group">
                              <button type="button" className="btn btn--success btn--xs" onClick={() => setNota({ id: medication.id, hora: scheduledTime, nome: medication.name })} aria-label={`Registrar que tomou ${descricao}`}>
                                <span aria-hidden="true">✓</span> Tomar
                              </button>
                              <button type="button" className="btn btn--ghost btn--xs" onClick={() => void registrar(medication.id, scheduledTime, 'skipped')} aria-label={`Pular ${descricao}`}>Pular</button>
                            </div>
                          )}
                          {somenteLeitura && state === 'pending' && <StatusDose estado="pending" />}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="dashboard__right">
          <section className="card" aria-labelledby="h-prox">
            <div className="card__header"><h2 id="h-prox">Próximas doses</h2></div>
            {proximas.length === 0 ? (
              <p className="text-muted" style={{ fontSize: 13 }}>Nenhuma dose a caminho hoje. <span aria-hidden="true">🎉</span></p>
            ) : (
              <ul className="upcoming-list">
                {proximas.map(({ medication, scheduledTime }) => (
                  <li key={`${medication.id}-${scheduledTime}`} className="upcoming-item">
                    <div className="upcoming-item__dot" style={{ background: medication.color }} aria-hidden="true" />
                    <div className="upcoming-item__info"><span>{medication.name}</span><span className="text-muted">{medication.dosage} {medication.unit}</span></div>
                    <span className="upcoming-item__time">{scheduledTime}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="h-sem">
            <div className="card__header"><h2 id="h-sem">Adesão da semana</h2></div>
            <ul className="week-overview">
              {semana.map((d, i) => (
                <li key={i} className={`week-day ${d.hoje ? 'week-day--today' : ''}`} aria-label={`${d.rotulo}: ${d.pct >= 0 ? d.pct + '% das doses tomadas' : 'sem registros'}`}>
                  <span className="week-day__label" aria-hidden="true">{d.rotulo}</span>
                  <PontoStatus pct={d.pct} />
                  {d.pct >= 0 && <span className="week-day__pct" aria-hidden="true">{d.pct}%</span>}
                </li>
              ))}
            </ul>
          </section>

          <section className="card" aria-labelledby="h-res">
            <div className="card__header"><h2 id="h-res">Resumo geral</h2></div>
            <dl className="quick-stats">
              <div className="quick-stat"><dt>Total de registros</dt><dd>{logs.filter((l) => l.status !== 'pending').length}</dd></div>
              <div className="quick-stat"><dt>Doses tomadas</dt><dd className="t-success">{logs.filter((l) => l.status === 'taken').length}</dd></div>
              <div className="quick-stat"><dt>Doses puladas</dt><dd className="t-warning">{logs.filter((l) => l.status === 'skipped').length}</dd></div>
              <div className="quick-stat"><dt>Doses perdidas</dt><dd className="t-danger">{logs.filter((l) => l.status === 'missed').length}</dd></div>
              <div className="quick-stat"><dt>Adesão 30 dias</dt><dd className="t-brand">{pct(a30)}</dd></div>
            </dl>
          </section>
        </div>
      </div>

      {nota && (
        <Modal
          titulo="Registrar dose"
          subtitulo={`${nota.nome} às ${nota.hora}`}
          tamanho="sm"
          onClose={() => { setNota(null); setTextoNota(''); }}
          rodape={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => { void registrar(nota.id, nota.hora, 'taken'); setNota(null); setTextoNota(''); }}>Registrar sem nota</button>
              <button type="button" className="btn btn--success" onClick={() => { void registrar(nota.id, nota.hora, 'taken', textoNota.trim() || undefined); setNota(null); setTextoNota(''); }}>
                <span aria-hidden="true">✓</span> Confirmar
              </button>
            </>
          }
        >
          <div className="form-group">
            <label htmlFor="nota-dose">Observação (opcional)</label>
            <textarea id="nota-dose" data-autofocus placeholder="Ex.: tomei com leite, senti tontura leve…" value={textoNota} onChange={(e) => setTextoNota(e.target.value)} rows={3} maxLength={500} />
          </div>
        </Modal>
      )}

      {adicionando && <MedModal onClose={() => setAdicionando(false)} />}
    </div>
  );
}
