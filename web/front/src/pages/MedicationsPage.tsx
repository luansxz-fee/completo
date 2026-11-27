import React, { useState } from 'react';
import { useMed } from '../context/useMed';
import { usePaciente } from '../context/PacienteContext';
import { useAcessibilidade } from '../context/AcessibilidadeContext';
import { Medication } from '../types';
import MedModal from '../components/MedModal';
import Modal from '../components/Modal';
import Braille from '../components/Braille';
import BotaoOuvir from '../components/BotaoOuvir';
import Interruptor from '../components/Interruptor';
import { formatarDataBR } from '../utils/datas';

const nivelEstoque = (pct: number) => (pct < 20 ? 'critico' : pct < 50 ? 'baixo' : 'ok');
const rotuloNivel = { critico: 'Crítico', baixo: 'Baixo', ok: 'Adequado' } as const;
const corNivel = { critico: 'var(--danger)', baixo: 'var(--warning)', ok: 'var(--success)' } as const;

function BarraEstoque({ med, pequena }: { med: Medication; pequena?: boolean }) {
  const { daltonico, prefs } = useAcessibilidade();
  const pct = Math.min(100, Math.round((med.stock / Math.max(1, med.stockMax || 30)) * 100));
  const n = nivelEstoque(pct);
  return (
    <div className="med-card__stock">
      <div className="med-card__stock-label">
        <span>Estoque</span>
        <span>
          {med.stock}/{med.stockMax} un.
          {(daltonico && prefs.daltonismoGrau >= 3) || n !== 'ok' ? <strong className="rotulo-nivel"> · {rotuloNivel[n]}</strong> : null}
        </span>
      </div>
      <div className={`stock-track ${pequena ? 'stock-track--sm' : ''}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Estoque de ${med.name}: ${rotuloNivel[n]}, ${med.stock} de ${med.stockMax}`}>
        <div className={`stock-track__fill stock-fill--${n}`} style={{ width: `${pct}%`, background: corNivel[n] }} />
      </div>
    </div>
  );
}

export default function MedicationsPage() {
  const { medications, toggleMedication, deleteMedication, loading } = useMed();
  const { somenteLeitura } = usePaciente();
  const { avisar } = useAcessibilidade();
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Medication | undefined>();
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('Todos');
  const [excluir, setExcluir] = useState<Medication | null>(null);
  const [visual, setVisual] = useState<'grade' | 'lista'>('grade');
  const [detalhe, setDetalhe] = useState<Medication | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const categorias = ['Todos', ...Array.from(new Set(medications.map((m) => m.category || 'Outros')))];
  const filtrados = medications.filter(
    (m) => (categoria === 'Todos' || m.category === categoria) && m.name.toLowerCase().includes(busca.toLowerCase())
  );

  const alternar = async (m: Medication) => {
    setOcupado(m.id);
    try {
      await toggleMedication(m.id);
      avisar(`${m.name} ${m.active ? 'desativado' : 'ativado'}.`, 'sucesso');
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível alterar.', 'erro');
    } finally {
      setOcupado(null);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    try {
      await deleteMedication(excluir.id);
      avisar(`${excluir.name} excluído.`, 'sucesso');
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível excluir.', 'erro');
    }
    setExcluir(null);
  };

  const abrirEdicao = (m: Medication) => { setEditando(m); setModal(true); };
  const resumo = (m: Medication) => `${m.name}, ${m.dosage} ${m.unit}, ${m.frequency}, horários ${m.times.join(', ')}. ${m.active ? 'Ativo' : 'Inativo'}.`;

  return (
    <div className="medications-page">
      <div className="page-header">
        <div>
          <h2 className="page-header__titulo">Medicamentos</h2>
          <p className="text-muted">{medications.length} cadastrado{medications.length === 1 ? '' : 's'} · {medications.filter((m) => m.active).length} ativo{medications.filter((m) => m.active).length === 1 ? '' : 's'}</p>
        </div>
        <div className="page-header__actions">
          <div className="seg" role="group" aria-label="Modo de exibição">
            <button type="button" className={`btn btn--ghost btn--sm ${visual === 'grade' ? 'btn--active' : ''}`} aria-pressed={visual === 'grade'} onClick={() => setVisual('grade')}><span aria-hidden="true">⊞</span> Grade</button>
            <button type="button" className={`btn btn--ghost btn--sm ${visual === 'lista' ? 'btn--active' : ''}`} aria-pressed={visual === 'lista'} onClick={() => setVisual('lista')}><span aria-hidden="true">☰</span> Lista</button>
          </div>
          {!somenteLeitura && (
            <button type="button" className="btn btn--primary" onClick={() => { setEditando(undefined); setModal(true); }}>
              <span aria-hidden="true">+</span> Novo medicamento
            </button>
          )}
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <label htmlFor="busca-med" className="sr-only">Buscar medicamento</label>
          <span aria-hidden="true">🔍</span>
          <input id="busca-med" type="search" placeholder="Buscar medicamento…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="category-tabs" role="group" aria-label="Filtrar por categoria">
          {categorias.map((c) => (
            <button key={c} type="button" className={`tab-btn ${categoria === c ? 'tab-btn--active' : ''}`} aria-pressed={categoria === c} onClick={() => setCategoria(c)}>{c}</button>
          ))}
        </div>
      </div>

      {loading && medications.length === 0 ? (
        <p className="text-muted" role="status">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" aria-hidden="true">💊</div>
          <p>{busca ? 'Nenhum medicamento encontrado.' : 'Nenhum medicamento cadastrado ainda.'}</p>
          {!busca && !somenteLeitura && <button type="button" className="btn btn--primary" onClick={() => setModal(true)}>+ Adicionar medicamento</button>}
        </div>
      ) : visual === 'grade' ? (
        <ul className="med-grid">
          {filtrados.map((med) => (
            <li key={med.id} className={`med-card ${!med.active ? 'med-card--inactive' : ''}`} aria-label={resumo(med)}>
              <div className="med-card__visual" style={{ borderBottom: `3px solid ${med.color}` }}>
                {med.imageUrl ? (
                  <img src={med.imageUrl} alt="" className="med-card__img" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="med-card__icon-big" style={{ background: med.color + '18', color: med.color }} aria-hidden="true">{med.icon}</div>
                )}
                {!somenteLeitura && (
                  <div className="med-card__toggle-abs">
                    <Interruptor ligado={med.active} desabilitado={ocupado === med.id} onChange={() => void alternar(med)} rotulo={med.active ? `Desativar ${med.name}` : `Ativar ${med.name}`} />
                  </div>
                )}
              </div>
              <div className="med-card__body">
                <div className="med-card__badges">
                  <span className="badge badge--neutral">{med.category}</span>
                  {!med.active && <span className="badge badge--muted">Inativo</span>}
                  {med.stock <= 5 && med.active && <span className="badge badge--danger"><span aria-hidden="true">⚠️</span> Estoque baixo</span>}
                </div>
                <h3 className="med-card__name">{med.name}</h3>
                <Braille texto={med.name} />
                <p className="med-card__dosage">{med.dosage} {med.unit} · {med.frequency}</p>
                {med.prescribedBy && <p className="med-card__doctor"><span aria-hidden="true">👨‍⚕️</span> {med.prescribedBy}</p>}
                {med.crm && <p className="med-card__doctor">CRM: {med.crm}</p>}
                <div className="med-card__times" aria-label="Horários">{med.times.map((t) => <span key={t} className="time-chip">{t}</span>)}</div>
                <BarraEstoque med={med} />
              </div>
              <div className="med-card__actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDetalhe(med)} aria-label={`Ver detalhes de ${med.name}`}><span aria-hidden="true">👁️</span> Ver</button>
                {!somenteLeitura && <button type="button" className="btn btn--outline btn--sm" onClick={() => abrirEdicao(med)} aria-label={`Editar ${med.name}`}><span aria-hidden="true">✏️</span> Editar</button>}
                {!somenteLeitura && <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => setExcluir(med)} aria-label={`Excluir ${med.name}`}><span aria-hidden="true">🗑️</span></button>}
                <BotaoOuvir texto={resumo(med)} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="med-list-view">
          {filtrados.map((med) => (
            <li key={med.id} className={`med-list-item ${!med.active ? 'med-list-item--inactive' : ''}`} aria-label={resumo(med)}>
              <div className="med-list-item__accent" style={{ background: med.color }} aria-hidden="true" />
              {med.imageUrl ? (
                <img src={med.imageUrl} alt="" className="med-list-item__img" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="med-list-item__icon" style={{ background: med.color + '22', color: med.color }} aria-hidden="true">{med.icon}</div>
              )}
              <div className="med-list-item__info">
                <div className="med-list-item__top">
                  <strong>{med.name}</strong>
                  <span className="badge badge--neutral">{med.category}</span>
                  {!med.active && <span className="badge badge--muted">Inativo</span>}
                </div>
                <span className="text-muted">{med.dosage} {med.unit} · {med.frequency} · {med.times.join(', ')}</span>
                <Braille texto={`${med.name} ${med.dosage} ${med.unit}`} />
              </div>
              <div className="med-list-item__stock"><BarraEstoque med={med} pequena /></div>
              <div className="med-list-item__actions">
                {!somenteLeitura && <Interruptor ligado={med.active} desabilitado={ocupado === med.id} onChange={() => void alternar(med)} rotulo={med.active ? `Desativar ${med.name}` : `Ativar ${med.name}`} />}
                <button type="button" className="btn btn--ghost btn--xs" onClick={() => setDetalhe(med)} aria-label={`Ver detalhes de ${med.name}`}><span aria-hidden="true">👁️</span></button>
                {!somenteLeitura && <button type="button" className="btn btn--outline btn--xs" onClick={() => abrirEdicao(med)} aria-label={`Editar ${med.name}`}><span aria-hidden="true">✏️</span></button>}
                {!somenteLeitura && <button type="button" className="btn btn--danger-ghost btn--xs" onClick={() => setExcluir(med)} aria-label={`Excluir ${med.name}`}><span aria-hidden="true">🗑️</span></button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal && <MedModal medication={editando} onClose={() => { setModal(false); setEditando(undefined); }} />}

      {excluir && (
        <Modal
          titulo="Excluir medicamento?"
          tamanho="sm"
          onClose={() => setExcluir(null)}
          rodape={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setExcluir(null)} data-autofocus>Cancelar</button>
              <button type="button" className="btn btn--danger" onClick={() => void confirmarExclusao()}>Excluir</button>
            </>
          }
        >
          <p>Isso apaga <strong>{excluir.name}</strong> e todo o histórico de doses dele. Não dá para desfazer.</p>
          <p className="form-hint">Se só quer pausar, use o interruptor “Desativar”.</p>
        </Modal>
      )}

      {detalhe && (
        <Modal
          titulo={detalhe.name}
          subtitulo={`${detalhe.dosage} ${detalhe.unit} · ${detalhe.frequency}`}
          onClose={() => setDetalhe(null)}
          icone={detalhe.imageUrl
            ? <img src={detalhe.imageUrl} alt="" className="modal__header-img" />
            : <div className="modal__header-icon" style={{ background: detalhe.color + '22', color: detalhe.color }} aria-hidden="true">{detalhe.icon}</div>}
          rodape={<button type="button" className="btn btn--primary" onClick={() => setDetalhe(null)}>Fechar</button>}
        >
          <dl className="detalhes">
            <div><dt>Categoria</dt><dd>{detalhe.category}</dd></div>
            <div><dt>Horários</dt><dd>{detalhe.times.join(', ')}</dd></div>
            <div><dt>Período</dt><dd>{formatarDataBR(detalhe.startDate)} {detalhe.endDate ? `até ${formatarDataBR(detalhe.endDate)}` : '· uso contínuo'}</dd></div>
            <div><dt>Estoque</dt><dd>{detalhe.stock} de {detalhe.stockMax} unidades</dd></div>
            <div><dt>Lembretes</dt><dd>{detalhe.reminderEnabled ? 'Ativados' : 'Desativados'}</dd></div>
            {detalhe.prescribedBy && <div><dt>Prescrito por</dt><dd>{detalhe.prescribedBy}{detalhe.crm ? ` (${detalhe.crm})` : ''}</dd></div>}
            {detalhe.instructions && <div><dt>Instruções</dt><dd>{detalhe.instructions}</dd></div>}
            {detalhe.sideEffects && <div><dt>Efeitos colaterais</dt><dd>{detalhe.sideEffects}</dd></div>}
          </dl>
          <Braille bloco texto={`${detalhe.name} ${detalhe.dosage} ${detalhe.unit}`} />
        </Modal>
      )}
    </div>
  );
}
