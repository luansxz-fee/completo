import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAcessibilidade } from '../context/AcessibilidadeContext';
import { usePaciente } from '../context/PacienteContext';
import { Page } from '../components/AppRouter';
import Modal from '../components/Modal';
import { Permissao, ResumoPaciente, Vinculo } from '../types';

interface Props { navigate: (p: Page) => void }

const ROTULO_PERMISSAO: Record<Permissao, string> = {
  visualizar: 'Só acompanhar',
  gerenciar: 'Acompanhar e ajudar',
};

export default function CaregiversPage({ navigate }: Props) {
  const { avisar } = useAcessibilidade();
  const { focar } = usePaciente();
  const [aba, setAba] = useState<'ajudam' | 'ajudo'>('ajudam');
  const [meus, setMeus] = useState<Vinculo[]>([]);
  const [convites, setConvites] = useState<Vinculo[]>([]);
  const [pacientes, setPacientes] = useState<Vinculo[]>([]);
  const [resumos, setResumos] = useState<Record<string, ResumoPaciente>>({});
  const [carregando, setCarregando] = useState(true);

  const [email, setEmail] = useState('');
  const [permissao, setPermissao] = useState<Permissao>('visualizar');
  const [apelido, setApelido] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [remover, setRemover] = useState<{ v: Vinculo; deixar: boolean } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [m, c, p] = await Promise.all([api.cuidadores.meus(), api.cuidadores.convites(), api.cuidadores.pacientes()]);
      setMeus(m.dados);
      setConvites(c.dados);
      setPacientes(p.dados);
      const r = await Promise.all(p.dados.map((v: Vinculo) => api.cuidadores.resumo(v.pacienteId).then((x) => x.dados).catch(() => null)));
      const mapa: Record<string, ResumoPaciente> = {};
      r.forEach((x) => { if (x) mapa[x.paciente.id] = x; });
      setResumos(mapa);
    } catch (e: any) {
      avisar(e?.message || 'Não foi possível carregar os cuidadores.', 'erro');
    } finally {
      setCarregando(false);
    }
  }, [avisar]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { if (convites.length > 0) setAba('ajudo'); }, [convites.length]);

  const convidar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return avisar('Digite um e-mail válido.', 'erro');
    setEnviando(true);
    try {
      const r = await api.cuidadores.convidar(email.trim(), permissao, apelido.trim() || undefined);
      avisar(r.mensagem || 'Convite enviado.', r.emailEnviado ? 'sucesso' : 'info');
      setEmail(''); setApelido('');
      await carregar();
    } catch (err: any) {
      avisar(err?.message || 'Não foi possível convidar.', 'erro');
    } finally { setEnviando(false); }
  };

  const responder = async (v: Vinculo, aceitar: boolean) => {
    try {
      await (aceitar ? api.cuidadores.aceitar(v.id) : api.cuidadores.recusar(v.id));
      avisar(aceitar ? 'Convite aceito.' : 'Convite recusado.', 'sucesso');
      await carregar();
    } catch (err: any) { avisar(err?.message || 'Não foi possível responder.', 'erro'); }
  };

  const mudarPermissao = async (v: Vinculo, nova: Permissao) => {
    try {
      await api.cuidadores.atualizar(v.id, { permissao: nova });
      avisar('Permissão atualizada.', 'sucesso');
      await carregar();
    } catch (err: any) { avisar(err?.message || 'Não foi possível atualizar.', 'erro'); }
  };

  const confirmarRemocao = async () => {
    if (!remover) return;
    try {
      await api.cuidadores.revogar(remover.v.id);
      avisar(remover.deixar ? 'Você deixou de acompanhar este paciente.' : 'Cuidador removido.', 'sucesso');
      await carregar();
    } catch (err: any) { avisar(err?.message || 'Não foi possível remover.', 'erro'); }
    setRemover(null);
  };

  const abrirPainel = (v: Vinculo) => {
    if (!v.paciente) return;
    focar({ id: v.pacienteId, nome: v.paciente.nome, permissao: v.permissao });
    navigate('dashboard');
  };

  return (
    <div className="caregivers-page">
      <div className="page-header">
        <div>
          <h2 className="page-header__titulo">Cuidadores</h2>
          <p className="text-muted">Quem ajuda você a não esquecer — e quem você ajuda.</p>
        </div>
      </div>

      <div className="filter-tabs" role="tablist" aria-label="Cuidadores">
        <button type="button" role="tab" id="aba-ajudam" aria-selected={aba === 'ajudam'} aria-controls="painel-ajudam" className={`tab-btn ${aba === 'ajudam' ? 'tab-btn--active' : ''}`} onClick={() => setAba('ajudam')}>
          Quem me ajuda ({meus.length})
        </button>
        <button type="button" role="tab" id="aba-ajudo" aria-selected={aba === 'ajudo'} aria-controls="painel-ajudo" className={`tab-btn ${aba === 'ajudo' ? 'tab-btn--active' : ''}`} onClick={() => setAba('ajudo')}>
          Quem eu ajudo ({pacientes.length}){convites.length > 0 && <span className="badge badge--danger" style={{ marginLeft: 6 }}>{convites.length} convite{convites.length > 1 ? 's' : ''}</span>}
        </button>
      </div>

      {carregando && <p className="text-muted" role="status">Carregando…</p>}

      {aba === 'ajudam' && (
        <div id="painel-ajudam" role="tabpanel" aria-labelledby="aba-ajudam" className="cuid-coluna">
          <section className="card" aria-labelledby="h-convidar">
            <h3 id="h-convidar" className="card-section-title">Convidar um cuidador</h3>
            <p className="form-hint">A pessoa recebe um e-mail e precisa ter (ou criar) uma conta MedSync com este mesmo e-mail. Ela recebe um alerta quando você atrasar uma dose.</p>
            <form onSubmit={convidar} className="cuid-form" noValidate>
              <div className="form-group">
                <label htmlFor="cuid-email">E-mail do cuidador</label>
                <input id="cuid-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="filha@email.com" autoComplete="off" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="cuid-apelido">Como você a chama (opcional)</label>
                  <input id="cuid-apelido" type="text" value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Minha filha Ana" maxLength={60} />
                </div>
                <div className="form-group">
                  <label htmlFor="cuid-perm">O que ela pode fazer</label>
                  <select id="cuid-perm" value={permissao} onChange={(e) => setPermissao(e.target.value as Permissao)}>
                    <option value="visualizar">{ROTULO_PERMISSAO.visualizar} (só ver)</option>
                    <option value="gerenciar">{ROTULO_PERMISSAO.gerenciar} (registrar doses e editar)</option>
                  </select>
                </div>
              </div>
              <button type="submit" className={`btn btn--primary ${enviando ? 'btn--loading' : ''}`} disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar convite'}</button>
            </form>
          </section>

          <section className="card" aria-labelledby="h-lista-cuid">
            <h3 id="h-lista-cuid" className="card-section-title">Meus cuidadores</h3>
            {meus.length === 0 ? (
              <p className="text-muted">Você ainda não convidou ninguém.</p>
            ) : (
              <ul className="cuid-lista">
                {meus.map((v) => (
                  <li key={v.id} className="cuid-item">
                    <div className="cuid-item__avatar" aria-hidden="true">{(v.cuidador?.nome || v.cuidadorEmail).charAt(0).toUpperCase()}</div>
                    <div className="cuid-item__info">
                      <strong>{v.apelido || v.cuidador?.nome || v.cuidadorEmail}</strong>
                      <span className="text-muted">{v.cuidadorEmail}</span>
                      <span className={`badge ${v.status === 'ativo' ? 'badge--success' : 'badge--warning'}`}>
                        <span aria-hidden="true">{v.status === 'ativo' ? '✓' : '⏳'}</span> {v.status === 'ativo' ? 'Ativo' : 'Convite pendente'}
                      </span>
                    </div>
                    <div className="cuid-item__acoes">
                      <label className="sr-only" htmlFor={`perm-${v.id}`}>Permissão de {v.apelido || v.cuidadorEmail}</label>
                      <select id={`perm-${v.id}`} value={v.permissao} onChange={(e) => void mudarPermissao(v, e.target.value as Permissao)}>
                        <option value="visualizar">{ROTULO_PERMISSAO.visualizar}</option>
                        <option value="gerenciar">{ROTULO_PERMISSAO.gerenciar}</option>
                      </select>
                      <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => setRemover({ v, deixar: false })} aria-label={`Remover ${v.apelido || v.cuidadorEmail}`}>Remover</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {aba === 'ajudo' && (
        <div id="painel-ajudo" role="tabpanel" aria-labelledby="aba-ajudo" className="cuid-coluna">
          {convites.length > 0 && (
            <section className="card card--destaque" aria-labelledby="h-convites" role="region">
              <h3 id="h-convites" className="card-section-title">Convites recebidos</h3>
              <ul className="cuid-lista">
                {convites.map((v) => (
                  <li key={v.id} className="cuid-item">
                    <div className="cuid-item__avatar" aria-hidden="true">{(v.paciente?.nome || '?').charAt(0).toUpperCase()}</div>
                    <div className="cuid-item__info">
                      <strong>{v.paciente?.nome}</strong>
                      <span className="text-muted">quer que você {v.permissao === 'gerenciar' ? 'acompanhe e ajude' : 'acompanhe'}</span>
                    </div>
                    <div className="cuid-item__acoes">
                      <button type="button" className="btn btn--success btn--sm" onClick={() => void responder(v, true)}><span aria-hidden="true">✓</span> Aceitar</button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => void responder(v, false)}>Recusar</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="h-pacientes">
            <h3 id="h-pacientes" className="card-section-title">Pessoas que eu ajudo</h3>
            {pacientes.length === 0 ? (
              <div className="card"><p className="text-muted">Você ainda não acompanha ninguém. Quando alguém convidar o seu e-mail, o convite aparece aqui.</p></div>
            ) : (
              <ul className="cuid-grid">
                {pacientes.map((v) => {
                  const r = resumos[v.pacienteId];
                  return (
                    <li key={v.id} className="card cuid-paciente">
                      <div className="cuid-item">
                        <div className="cuid-item__avatar" aria-hidden="true">{(v.paciente?.nome || '?').charAt(0).toUpperCase()}</div>
                        <div className="cuid-item__info">
                          <strong>{v.paciente?.nome}</strong>
                          <span className="badge badge--neutral">{ROTULO_PERMISSAO[v.permissao]}</span>
                        </div>
                      </div>
                      {r ? (
                        <dl className="cuid-resumo">
                          <div><dt>Hoje</dt><dd>{r.dosesHoje.tomadas} tomadas · {r.dosesHoje.perdidas} perdidas · {r.dosesHoje.puladas} puladas</dd></div>
                          <div><dt>Adesão 7 dias</dt><dd>{r.adesao.dias7 === null ? '—' : `${r.adesao.dias7}%`}</dd></div>
                          <div><dt>Medicamentos</dt><dd>{r.medicamentosAtivos} ativos{r.estoqueBaixo > 0 ? ` · ${r.estoqueBaixo} com estoque baixo` : ''}</dd></div>
                        </dl>
                      ) : <p className="text-muted">Carregando resumo…</p>}
                      <div className="cuid-item__acoes">
                        <button type="button" className="btn btn--primary btn--sm" onClick={() => abrirPainel(v)}>Abrir painel</button>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRemover({ v, deixar: true })}>Deixar de ajudar</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {remover && (
        <Modal titulo={remover.deixar ? 'Deixar de ajudar?' : 'Remover cuidador?'} tamanho="sm" onClose={() => setRemover(null)}
          rodape={<><button type="button" className="btn btn--ghost" onClick={() => setRemover(null)}>Cancelar</button><button type="button" className="btn btn--danger" onClick={() => void confirmarRemocao()}>{remover.deixar ? 'Deixar de ajudar' : 'Remover'}</button></>}>
          <p>{remover.deixar
            ? `Você deixará de ver os medicamentos de ${remover.v.paciente?.nome} e de receber os alertas dele(a).`
            : `${remover.v.apelido || remover.v.cuidadorEmail} perderá o acesso aos seus medicamentos e não receberá mais alertas.`}</p>
        </Modal>
      )}
    </div>
  );
}
