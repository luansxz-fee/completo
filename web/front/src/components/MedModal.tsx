import React, { useEffect, useId, useRef, useState } from 'react';
import { useMed } from '../context/useMed';
import { useAcessibilidade } from '../context/AcessibilidadeContext';
import { Medication } from '../types';
import { hojeLocal, somarDias } from '../utils/datas';
import Modal from './Modal';

interface Props {
  medication?: Medication;
  onClose: () => void;
}

export const CORES: { valor: string; nome: string; simbolo: string }[] = [
  { valor: '#2563EB', nome: 'Azul', simbolo: '●' },
  { valor: '#10B981', nome: 'Verde', simbolo: '▲' },
  { valor: '#F59E0B', nome: 'Laranja', simbolo: '■' },
  { valor: '#EF4444', nome: 'Vermelho', simbolo: '◆' },
  { valor: '#8B5CF6', nome: 'Roxo', simbolo: '★' },
  { valor: '#EC4899', nome: 'Rosa', simbolo: '♥' },
  { valor: '#06B6D4', nome: 'Ciano', simbolo: '✚' },
  { valor: '#84CC16', nome: 'Lima', simbolo: '☗' },
];
const ICONES = ['💊', '💉', '🩺', '❤️', '🧪', '🌡️', '🩹', '🫀', '🧠', '👁️', '🦷', '💪'];
const ICONES_NOME: Record<string, string> = { '💊': 'Comprimido', '💉': 'Injeção', '🩺': 'Estetoscópio', '❤️': 'Coração', '🧪': 'Frasco', '🌡️': 'Termômetro', '🩹': 'Curativo', '🫀': 'Órgão coração', '🧠': 'Cérebro', '👁️': 'Olho', '🦷': 'Dente', '💪': 'Força' };
const CATEGORIAS = ['Cardiovascular', 'Diabetes', 'Pressão', 'Vitaminas', 'Antibiótico', 'Dor/Febre', 'Digestivo', 'Sono', 'Outros'];
const UNIDADES = ['mg', 'mcg', 'g', 'ml', 'comprimido(s)', 'cápsula(s)', 'gota(s)', 'UI', '%', 'dose(s)'];

const FREQUENCIAS: { nome: string; horarios: string[] | null }[] = [
  { nome: 'Diário', horarios: ['08:00'] },
  { nome: '2x ao dia', horarios: ['08:00', '20:00'] },
  { nome: '3x ao dia', horarios: ['08:00', '14:00', '20:00'] },
  { nome: 'A cada 4 horas', horarios: ['06:00', '10:00', '14:00', '18:00', '22:00', '02:00'] },
  { nome: 'A cada 6 horas', horarios: ['06:00', '12:00', '18:00', '00:00'] },
  { nome: 'A cada 8 horas', horarios: ['06:00', '14:00', '22:00'] },
  { nome: 'A cada 12 horas', horarios: ['08:00', '20:00'] },
  { nome: 'Semanal', horarios: null },
  { nome: 'Quinzenal', horarios: null },
  { nome: 'Conforme necessário', horarios: null },
];

const DURACOES = [
  { rotulo: '7 dias', dias: 6 },
  { rotulo: '14 dias', dias: 13 },
  { rotulo: '30 dias', dias: 29 },
  { rotulo: '90 dias', dias: 89 },
];

type EstadoImagem = 'vazio' | 'carregando' | 'ok' | 'erro';
const ETAPAS = ['Básico', 'Horários e estoque', 'Imagem e detalhes'];

export default function MedModal({ medication, onClose }: Props) {
  const { addMedication, updateMedication } = useMed();
  const { avisar, daltonico, prefs } = useAcessibilidade();
  const editando = !!medication;
  const uid = useId();

  const [nome, setNome] = useState(medication?.name || '');
  const [dosagem, setDosagem] = useState(medication?.dosage || '');
  const [unidade, setUnidade] = useState(medication?.unit || 'mg');
  const [frequencia, setFrequencia] = useState(medication?.frequency || 'Diário');
  const [horarios, setHorarios] = useState<string[]>(medication?.times?.length ? medication.times : ['08:00']);
  const [inicio, setInicio] = useState((medication?.startDate || hojeLocal()).slice(0, 10));
  const [termino, setTermino] = useState((medication?.endDate || '').slice(0, 10));
  const [instrucoes, setInstrucoes] = useState(medication?.instructions || '');
  const [cor, setCor] = useState(medication?.color || CORES[0].valor);
  const [icone, setIcone] = useState(medication?.icon || ICONES[0]);
  const [categoria, setCategoria] = useState(medication?.category || 'Outros');
  const [estoque, setEstoque] = useState(medication?.stock ?? 30);
  const [estoqueMax, setEstoqueMax] = useState(medication?.stockMax ?? 30);
  const [lembrete, setLembrete] = useState(medication?.reminderEnabled ?? true);
  const [medico, setMedico] = useState(medication?.prescribedBy || '');
  const [crm, setCrm] = useState(medication?.crm || '');
  const [efeitos, setEfeitos] = useState(medication?.sideEffects || '');
  const [imagem, setImagem] = useState(medication?.imageUrl || '');
  const [estadoImg, setEstadoImg] = useState<EstadoImagem>(() => (medication?.imageUrl ? 'carregando' : 'vazio'));
  const [erros, setErros] = useState<Record<string, string>>({});
  const [etapa, setEtapa] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const adiar = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const url = imagem.trim();
    if (!url) { setEstadoImg('vazio'); return; }
    setEstadoImg('carregando');
    if (adiar.current) clearTimeout(adiar.current);
    adiar.current = setTimeout(() => {
      const img = new Image();
      img.onload = () => setEstadoImg('ok');
      img.onerror = () => setEstadoImg('erro');
      img.src = url;
    }, 600);
    return () => { if (adiar.current) clearTimeout(adiar.current); };
  }, [imagem]);

  const validar = (ate: number) => {
    const e: Record<string, string> = {};
    if (ate >= 1) {
      if (!nome.trim()) e.nome = 'Informe o nome do medicamento.';
      if (!dosagem.trim()) e.dosagem = 'Informe a dosagem.';
    }
    if (ate >= 2) {
      if (horarios.length === 0 || horarios.some((h) => !h)) e.horarios = 'Informe todos os horários.';
      else if (new Set(horarios).size !== horarios.length) e.horarios = 'Há horários repetidos.';
      if (!inicio) e.inicio = 'Informe a data de início.';
      if (termino && termino < inicio) e.termino = 'O término deve ser igual ou depois do início.';
      if (estoque > estoqueMax) e.estoque = 'O estoque atual não pode passar da capacidade.';
    }
    setErros(e);
    if (Object.keys(e).length) avisar(Object.values(e)[0], 'erro');
    return Object.keys(e).length === 0;
  };

  const salvar = async () => {
    if (!validar(2)) return;
    setSalvando(true);
    const dados = {
      name: nome.trim(), dosage: dosagem.trim(), unit: unidade, frequency: frequencia,
      times: [...horarios].sort(), startDate: inicio, endDate: termino || undefined,
      instructions: instrucoes.trim() || undefined, color: cor, icon: icone, category: categoria,
      stock: estoque, stockMax: estoqueMax, reminderEnabled: lembrete, active: medication?.active ?? true,
      imageUrl: estadoImg === 'ok' && imagem.trim() ? imagem.trim() : undefined,
      prescribedBy: medico.trim() || undefined, crm: crm.trim() || undefined, sideEffects: efeitos.trim() || undefined,
    };
    try {
      if (editando && medication) await updateMedication(medication.id, dados);
      else await addMedication(dados);
      avisar(editando ? 'Medicamento atualizado.' : 'Medicamento adicionado.', 'sucesso');
      onClose();
    } catch (erro) {
      setErros((p) => ({ ...p, envio: erro instanceof Error ? erro.message : 'Não foi possível salvar o medicamento.' }));
    } finally {
      setSalvando(false);
    }
  };

  const escolherFrequencia = (f: (typeof FREQUENCIAS)[number]) => {
    setFrequencia(f.nome);
    if (f.horarios && !editando) setHorarios(f.horarios);
  };

  const pct = Math.min(100, Math.round((estoque / Math.max(1, estoqueMax)) * 100));
  const nivel = pct < 20 ? 'critico' : pct < 50 ? 'baixo' : 'ok';
  const rotuloNivel = nivel === 'critico' ? 'Crítico' : nivel === 'baixo' ? 'Baixo' : 'Adequado';
  const corNivel = nivel === 'critico' ? 'var(--danger)' : nivel === 'baixo' ? 'var(--warning)' : 'var(--success)';

  const campoErro = (k: string) => (erros[k] ? { 'aria-invalid': true as const, 'aria-describedby': `${uid}-${k}-erro` } : {});
  const msg = (k: string) => erros[k] && <span id={`${uid}-${k}-erro`} className="form-error-msg" role="alert">{erros[k]}</span>;

  const secaoImagem = (
    <div className="form-group">
      <label htmlFor={`${uid}-img`}>Imagem do medicamento (opcional)</label>
      <div className="image-url-row">
        <input id={`${uid}-img`} type="url" inputMode="url" placeholder="https://… (.jpg, .png, .webp)" value={imagem} onChange={(e) => setImagem(e.target.value)} />
        {imagem && <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => setImagem('')}>Remover</button>}
      </div>
      <p className="form-hint">Cole o endereço direto de uma imagem. A pré-visualização carrega sozinha.</p>
      <div aria-live="polite">
        {estadoImg === 'carregando' && imagem && <div className="img-status img-status--loading"><span className="img-spinner" aria-hidden="true" /> Carregando imagem…</div>}
        {estadoImg === 'erro' && <div className="img-status img-status--error"><span aria-hidden="true">⚠️</span> A imagem não carregou. Confira o endereço.</div>}
        {estadoImg === 'ok' && <span className="img-status img-status--ok"><span aria-hidden="true">✓</span> Imagem carregada</span>}
      </div>
      {estadoImg === 'ok' && <div className="image-preview"><img src={imagem} alt={`Foto de ${nome || 'medicamento'}`} /></div>}
    </div>
  );

  return (
    <Modal
      titulo={editando ? 'Editar medicamento' : 'Novo medicamento'}
      subtitulo={`Etapa ${etapa} de 3 · ${ETAPAS[etapa - 1]}`}
      icone={
        estadoImg === 'ok' && imagem
          ? <img src={imagem} alt="" className="modal__header-img" />
          : <div className="modal__header-icon" style={{ background: cor + '22', color: cor }} aria-hidden="true">{icone}</div>
      }
      onClose={onClose}
      topo={
        <ol className="steps-indicator" aria-label="Etapas">
          {[1, 2, 3].map((s) => (
            <li key={s} className={`step-dot ${etapa >= s ? 'step-dot--active' : ''} ${etapa === s ? 'step-dot--current' : ''}`} aria-current={etapa === s ? 'step' : undefined}>
              <span aria-hidden="true">{etapa > s ? '✓' : s}</span>
              <small className="step-dot__label">{ETAPAS[s - 1]}</small>
            </li>
          ))}
        </ol>
      }
      rodape={
        <>
          <button type="button" className="btn btn--ghost" onClick={etapa === 1 ? onClose : () => setEtapa(etapa - 1)}>
            {etapa === 1 ? 'Cancelar' : '← Voltar'}
          </button>
          {etapa < 3 ? (
            <button type="button" className="btn btn--primary" onClick={() => { if (validar(etapa)) setEtapa(etapa + 1); }}>Próximo →</button>
          ) : (
            <button type="button" className={`btn btn--primary ${salvando ? 'btn--loading' : ''}`} disabled={salvando} onClick={() => void salvar()}>
              <span aria-hidden="true">✓</span> {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Adicionar medicamento'}
            </button>
          )}
        </>
      }
    >
      {etapa === 1 && (
        <div className="modal-step">
          <div className="form-group">
            <label htmlFor={`${uid}-nome`}>Nome do medicamento *</label>
            <input id={`${uid}-nome`} data-autofocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Losartana" className={erros.nome ? 'input--error' : ''} maxLength={100} {...campoErro('nome')} />
            {msg('nome')}
          </div>

          <div className="form-row form-row--3">
            <div className="form-group">
              <label htmlFor={`${uid}-dose`}>Dosagem *</label>
              <input id={`${uid}-dose`} value={dosagem} onChange={(e) => setDosagem(e.target.value)} placeholder="50" inputMode="decimal" className={erros.dosagem ? 'input--error' : ''} {...campoErro('dosagem')} />
              {msg('dosagem')}
            </div>
            <div className="form-group">
              <label htmlFor={`${uid}-un`}>Unidade</label>
              <select id={`${uid}-un`} value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                {UNIDADES.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor={`${uid}-cat`}>Categoria</label>
              <select id={`${uid}-cat`} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor={`${uid}-ins`}>Instruções de uso</label>
            <textarea id={`${uid}-ins`} rows={2} value={instrucoes} onChange={(e) => setInstrucoes(e.target.value)} placeholder="Ex.: tomar em jejum, com um copo de água" maxLength={500} />
          </div>

          <fieldset className="form-group form-fieldset">
            <legend>Ícone</legend>
            <div className="icon-picker" role="radiogroup" aria-label="Ícone">
              {ICONES.map((ic) => (
                <button key={ic} type="button" role="radio" aria-checked={icone === ic} aria-label={ICONES_NOME[ic] || ic} className={`icon-option ${icone === ic ? 'icon-option--selected' : ''}`} onClick={() => setIcone(ic)}>
                  <span aria-hidden="true">{ic}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="form-group form-fieldset">
            <legend>Cor de identificação</legend>
            <div className="color-picker" role="radiogroup" aria-label="Cor">
              {CORES.map((c) => (
                <button key={c.valor} type="button" role="radio" aria-checked={cor === c.valor} aria-label={c.nome} title={c.nome}
                  className={`color-option ${cor === c.valor ? 'color-option--selected' : ''}`} style={{ background: c.valor }} onClick={() => setCor(c.valor)}>
                  <span aria-hidden="true" className="color-option__sym">{cor === c.valor ? '✓' : daltonico && prefs.daltonismoGrau >= 2 ? c.simbolo : ''}</span>
                </button>
              ))}
            </div>
            <p className="form-hint">Cor selecionada: <strong>{CORES.find((c) => c.valor === cor)?.nome}</strong></p>
          </fieldset>
        </div>
      )}

      {etapa === 2 && (
        <div className="modal-step">
          <fieldset className="form-group form-fieldset">
            <legend>Frequência</legend>
            <div className="freq-options" role="radiogroup" aria-label="Frequência">
              {FREQUENCIAS.map((f) => (
                <button key={f.nome} type="button" role="radio" aria-checked={frequencia === f.nome} className={`freq-option ${frequencia === f.nome ? 'freq-option--selected' : ''}`} onClick={() => escolherFrequencia(f)}>
                  {f.nome}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="form-group form-fieldset">
            <legend>Horários *</legend>
            {horarios.map((h, i) => (
              <div key={i} className="time-row">
                <label className="time-row__label" htmlFor={`${uid}-h${i}`}>Dose {i + 1}</label>
                <input id={`${uid}-h${i}`} type="time" value={h} onChange={(e) => setHorarios(horarios.map((x, k) => (k === i ? e.target.value : x)))} />
                {horarios.length > 1 && (
                  <button type="button" className="btn btn--danger-ghost btn--xs" onClick={() => setHorarios(horarios.filter((_, k) => k !== i))} aria-label={`Remover dose ${i + 1}`}>
                    <span aria-hidden="true">✕</span>
                  </button>
                )}
              </div>
            ))}
            {msg('horarios')}
            <button type="button" className="btn btn--outline btn--sm" style={{ marginTop: 6 }} onClick={() => setHorarios([...horarios, '12:00'])}>+ Adicionar horário</button>
          </fieldset>

          {/* ✔ Correção: duas colunas fluidas, que viram uma só em telas estreitas (nada mais fica uma sobre a outra) */}
          <fieldset className="form-group form-fieldset">
            <legend>Período do tratamento</legend>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor={`${uid}-ini`}>Data de início *</label>
                <input id={`${uid}-ini`} type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); if (termino && e.target.value > termino) setTermino(''); }} className={erros.inicio ? 'input--error' : ''} {...campoErro('inicio')} />
                {msg('inicio')}
              </div>
              <div className="form-group">
                <label htmlFor={`${uid}-fim`}>Data de término</label>
                <input id={`${uid}-fim`} type="date" value={termino} min={inicio || undefined} onChange={(e) => setTermino(e.target.value)} className={erros.termino ? 'input--error' : ''} {...campoErro('termino')} />
                {msg('termino')}
              </div>
            </div>
            <div className="chips" role="group" aria-label="Duração rápida">
              <span className="chips__titulo">Duração rápida:</span>
              {DURACOES.map((d) => (
                <button key={d.rotulo} type="button" className="chip" onClick={() => setTermino(somarDias(inicio || hojeLocal(), d.dias))}>{d.rotulo}</button>
              ))}
              <button type="button" className={`chip ${!termino ? 'chip--ativo' : ''}`} onClick={() => setTermino('')} aria-pressed={!termino}>Uso contínuo</button>
            </div>
          </fieldset>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor={`${uid}-est`}>Estoque atual</label>
              <div className="stock-input">
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setEstoque(Math.max(0, estoque - 1))} aria-label="Diminuir estoque"><span aria-hidden="true">−</span></button>
                <input id={`${uid}-est`} type="number" min={0} value={estoque} onChange={(e) => setEstoque(Math.max(0, Number(e.target.value) || 0))} {...campoErro('estoque')} />
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setEstoque(estoque + 1)} aria-label="Aumentar estoque"><span aria-hidden="true">+</span></button>
              </div>
              {msg('estoque')}
            </div>
            <div className="form-group">
              <label htmlFor={`${uid}-max`}>Capacidade da caixa</label>
              <div className="stock-input">
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setEstoqueMax(Math.max(1, estoqueMax - 1))} aria-label="Diminuir capacidade"><span aria-hidden="true">−</span></button>
                <input id={`${uid}-max`} type="number" min={1} value={estoqueMax} onChange={(e) => setEstoqueMax(Math.max(1, Number(e.target.value) || 1))} />
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setEstoqueMax(estoqueMax + 1)} aria-label="Aumentar capacidade"><span aria-hidden="true">+</span></button>
              </div>
            </div>
          </div>

          <div className="stock-bar-preview">
            <div className="stock-bar-preview__label"><span>Nível do estoque: <strong>{rotuloNivel}</strong></span><span>{estoque}/{estoqueMax} ({pct}%)</span></div>
            <div className="stock-bar-preview__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Estoque ${rotuloNivel}, ${pct}%`}>
              <div className={`stock-bar-preview__fill stock-fill--${nivel}`} style={{ width: `${pct}%`, background: corNivel }} />
            </div>
            {nivel === 'critico' && estoque > 0 && <p className="form-warn"><span aria-hidden="true">⚠️</span> Estoque crítico! Lembre-se de repor.</p>}
          </div>
        </div>
      )}

      {etapa === 3 && (
        <div className="modal-step">
          {secaoImagem}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor={`${uid}-med`}>Médico(a) prescritor(a)</label>
              <input id={`${uid}-med`} value={medico} onChange={(e) => setMedico(e.target.value)} placeholder="Dra. Ana Lima" />
            </div>
            <div className="form-group">
              <label htmlFor={`${uid}-crm`}>CRM</label>
              <input id={`${uid}-crm`} value={crm} onChange={(e) => setCrm(e.target.value)} placeholder="CRM/SP 123456" />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor={`${uid}-ef`}>Efeitos colaterais a observar</label>
            <textarea id={`${uid}-ef`} rows={2} value={efeitos} onChange={(e) => setEfeitos(e.target.value)} maxLength={500} />
          </div>
          <div className="form-group">
            <div className="toggle-label">
              <span id={`${uid}-lemb`}>Lembretes ativados</span>
              <button type="button" role="switch" aria-checked={lembrete} aria-labelledby={`${uid}-lemb`} className={`toggle ${lembrete ? 'toggle--on' : ''}`} onClick={() => setLembrete(!lembrete)}><span aria-hidden="true" /></button>
            </div>
            <p className="form-hint">Avisa no horário de cada dose (notificação e e-mail, conforme o seu Perfil).</p>
          </div>

          <div className="med-preview-card" aria-label="Pré-visualização">
            <div className="med-preview-card__accent" style={{ background: cor }} aria-hidden="true" />
            {estadoImg === 'ok' && imagem
              ? <img src={imagem} alt="" className="med-preview-card__img" />
              : <div className="med-preview-card__icon" style={{ background: cor + '22', color: cor }} aria-hidden="true">{icone}</div>}
            <div className="med-preview-card__info">
              <strong>{nome || 'Nome do medicamento'}</strong>
              <span>{dosagem || '—'} {unidade} · {frequencia}</span>
              <span>{[...horarios].sort().join(' · ')}</span>
            </div>
            <div className="med-preview-card__stock">
              <span>{estoque} un.</span>
              <div className="stock-track" style={{ width: 60, marginTop: 4 }}><div className="stock-track__fill" style={{ width: `${pct}%`, background: corNivel }} /></div>
            </div>
          </div>

          {erros.envio && <div className="form-error" role="alert">{erros.envio}</div>}
        </div>
      )}
    </Modal>
  );
}
