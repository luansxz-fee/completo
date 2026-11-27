import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DoseLog, DoseStatus, Medication, TodayMedicationItem } from '../types';
import { api, ApiError } from '../services/api';
import { agoraEmMinutos, hojeLocal, minutosDoDia } from '../utils/datas';
import { useAuth } from './AuthContext';
import { usePaciente } from './PacienteContext';
import { useAcessibilidade } from './AcessibilidadeContext';

export interface MedContextData {
  medications: Medication[];
  logs: DoseLog[];
  loading: boolean;
  adherence: { dias7: number | null; dias30: number | null };
  addMedication: (data: Omit<Medication, 'id'>) => Promise<void>;
  updateMedication: (id: string, data: Partial<Medication>) => Promise<void>;
  toggleMedication: (id: string) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  logDose: (medicationId: string, time: string, status: DoseStatus, notes?: string) => Promise<void>;
  getTodayMedications: () => TodayMedicationItem[];
  getAdherenceRate: (days: number) => number | null;
  fetchMedications: () => Promise<void>;
}

export const MedContext = createContext<MedContextData>({} as MedContextData);

/* ------------------------------------------------------------------ */
/* Conversões API <-> front                                            */
/* ------------------------------------------------------------------ */
const normalizarHora = (t?: unknown) => String(t ?? '').trim().slice(0, 5);

const SITUACAO_PARA_STATUS: Record<string, DoseStatus> = {
  tomada: 'taken', tomado: 'taken', taken: 'taken',
  perdida: 'missed', perdido: 'missed', missed: 'missed',
  pulada: 'skipped', pulado: 'skipped', skipped: 'skipped',
  pendente: 'pending', pending: 'pending',
};
const STATUS_PARA_SITUACAO: Record<DoseStatus, string> = {
  taken: 'tomada', missed: 'perdida', skipped: 'pulada', pending: 'pendente',
};

export function formatarMed(item: any): Medication {
  const id = String(item.id || item._id || '').trim();
  return {
    id,
    _id: id,
    name: item.nome ?? '',
    dosage: item.dosagem ?? '',
    unit: item.unidade || 'mg',
    frequency: item.frequencia || 'Diário',
    times: Array.isArray(item.horarios) ? item.horarios.map(normalizarHora) : [],
    stock: Number(item.estoqueAtual ?? 0),
    stockMax: Number(item.estoqueMaximo ?? 30),
    active: item.ativo ?? true,
    color: item.cor || '#2563EB',
    category: item.categoria || 'Outros',
    icon: item.icone || '💊',
    imageUrl: item.urlImagem || undefined,
    prescribedBy: item.medicoPrescritor || undefined,
    crm: item.crm || undefined,
    startDate: item.dataInicio || hojeLocal(),
    endDate: item.dataTermino || undefined,
    reminderEnabled: item.lembreteAtivo ?? true,
    instructions: item.instrucoes || undefined,
    sideEffects: item.efeitosColaterais || undefined,
  };
}

export function formatarLog(l: any): DoseLog {
  return {
    id: String(l.id || l._id || ''),
    medicationId: String(l.medicamentoId || ''),
    scheduledTime: normalizarHora(l.horarioAgendado),
    status: SITUACAO_PARA_STATUS[String(l.situacao || '').toLowerCase()] || 'pending',
    date: String(l.dataDose || '').slice(0, 10),
    notes: l.observacao || undefined,
    takenAt: l.tomadoEm || undefined,
    automatic: !!l.automatico,
    registeredBy: l.registradoPor || null,
  };
}

function paraPayload(med: Partial<Medication>) {
  return {
    nome: med.name,
    dosagem: med.dosage,
    unidade: med.unit || 'mg',
    frequencia: med.frequency || 'Diário',
    horarios: med.times || [],
    dataInicio: med.startDate || hojeLocal(),
    dataTermino: med.endDate || null,
    cor: med.color || '#2563EB',
    icone: med.icon || '💊',
    categoria: med.category || 'Outros',
    estoqueAtual: Number(med.stock ?? 0),
    estoqueMaximo: Number(med.stockMax ?? 30),
    lembreteAtivo: med.reminderEnabled ?? true,
    ativo: med.active ?? true,
    urlImagem: med.imageUrl || null,
    medicoPrescritor: med.prescribedBy || null,
    crm: med.crm || null,
    instrucoes: med.instructions || null,
    efeitosColaterais: med.sideEffects || null,
  };
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */
export const MedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { usuario } = useAuth();
  const { paciente, somenteLeitura } = usePaciente();
  const { avisar } = useAcessibilidade();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [adherence, setAdherence] = useState<{ dias7: number | null; dias30: number | null }>({ dias7: null, dias30: null });
  const [, forcarRelogio] = useState(0);
  const geracao = useRef(0); // descarta respostas de uma carga antiga (troca de paciente)

  const chaveContexto = `${usuario?.id ?? ''}|${paciente?.id ?? ''}`;

  const fetchMedications = useCallback(async () => {
    if (!usuario) return;
    const minha = ++geracao.current;
    try {
      const [meds, regs, ad] = await Promise.all([
        api.medicamentos.listar(),
        api.registros.listar(),
        api.registros.adesao().catch(() => null),
      ]);
      if (minha !== geracao.current) return;
      setMedications((meds.dados || []).map(formatarMed));
      setLogs((regs.dados || []).map(formatarLog));
      if (ad?.dados) setAdherence({ dias7: ad.dados.dias7, dias30: ad.dados.dias30 });
    } catch (erro) {
      if (!(erro instanceof ApiError && erro.status === 401)) console.error('Erro ao carregar dados:', erro);
    } finally {
      if (minha === geracao.current) setLoading(false);
    }
  }, [usuario]);

  // Recarrega ao entrar, ao trocar de paciente e a cada minuto / ao voltar para a aba.
  useEffect(() => {
    setMedications([]);
    setLogs([]);
    setAdherence({ dias7: null, dias30: null });
    if (!usuario) return;
    setLoading(true);
    void fetchMedications();
    const ciclo = setInterval(() => {
      forcarRelogio((n) => n + 1); // atualiza "atrasada"/"próximas"
      if (document.visibilityState === 'visible') void fetchMedications();
    }, 60_000);
    const aoVoltar = () => document.visibilityState === 'visible' && void fetchMedications();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      clearInterval(ciclo);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveContexto]);

  const exigirEscrita = () => {
    if (somenteLeitura) throw new Error('Seu acesso a este paciente é somente de visualização.');
  };

  const addMedication: MedContextData['addMedication'] = async (dados) => {
    exigirEscrita();
    const res = await api.medicamentos.criar(paraPayload(dados));
    setMedications((prev) => [formatarMed(res.dados), ...prev]);
  };

  const updateMedication: MedContextData['updateMedication'] = async (id, dados) => {
    exigirEscrita();
    const atual = medications.find((m) => m.id === id);
    const res = await api.medicamentos.atualizar(id, paraPayload({ ...(atual as Medication), ...dados }));
    const novo = formatarMed(res.dados);
    setMedications((prev) => prev.map((m) => (m.id === id ? novo : m)));
  };

  const toggleMedication: MedContextData['toggleMedication'] = async (id) => {
    exigirEscrita();
    const res = await api.medicamentos.alternar(id);
    const novo = formatarMed(res.dados);
    setMedications((prev) => prev.map((m) => (m.id === id ? novo : m)));
  };

  const deleteMedication: MedContextData['deleteMedication'] = async (id) => {
    exigirEscrita();
    await api.medicamentos.excluir(id);
    setMedications((prev) => prev.filter((m) => m.id !== id));
    setLogs((prev) => prev.filter((l) => l.medicationId !== id));
  };

  const logDose: MedContextData['logDose'] = async (medicationId, time, status, notes) => {
    exigirEscrita();
    const hora = normalizarHora(time);
    const hoje = hojeLocal();
    const antes = logs;

    // Atualização otimista: a tela responde na hora; o servidor confirma em seguida.
    const otimista: DoseLog = {
      id: `tmp-${Date.now()}`, medicationId, scheduledTime: hora, status, date: hoje, notes,
    };
    setLogs((prev) => [
      otimista,
      ...prev.filter((l) => !(l.medicationId === medicationId && l.scheduledTime === hora && l.date === hoje)),
    ]);

    try {
      const res = await api.registros.salvar(medicationId, hora, STATUS_PARA_SITUACAO[status], notes);
      const real = formatarLog(res.dados);
      setLogs((prev) => prev.map((l) => (l.id === otimista.id ? real : l)));
      // O estoque é descontado no SERVIDOR; só espelhamos o valor devolvido.
      if (res.medicamento) {
        const med = formatarMed(res.medicamento);
        setMedications((prev) => prev.map((m) => (m.id === med.id ? med : m)));
      }
      void api.registros.adesao().then((r) => setAdherence({ dias7: r.dados.dias7, dias30: r.dados.dias30 })).catch(() => {});
    } catch (erro) {
      setLogs(antes); // desfaz
      avisar(erro instanceof Error ? erro.message : 'Não foi possível registrar a dose.', 'erro');
      throw erro;
    }
  };

  const getTodayMedications = (): TodayMedicationItem[] => {
    const hoje = hojeLocal();
    const agora = agoraEmMinutos();
    const itens: TodayMedicationItem[] = [];

    for (const med of medications) {
      if (!med.active) continue;
      if (med.startDate && hoje < med.startDate.slice(0, 10)) continue;
      if (med.endDate && hoje > med.endDate.slice(0, 10)) continue;
      for (const hora of med.times) {
        const log = logs.find((l) => l.medicationId === med.id && l.scheduledTime === hora && l.date === hoje);
        let state: TodayMedicationItem['state'] = 'pending';
        if (log && log.status !== 'pending') state = log.status;
        else if (minutosDoDia(hora) < agora) state = 'late';
        itens.push({ medication: med, scheduledTime: hora, log, state });
      }
    }
    return itens.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  };

  /** Adesão local = tomadas / (tomadas + perdidas + puladas). Sem dados → null. */
  const getAdherenceRate = (days: number): number | null => {
    const desde = new Date();
    desde.setDate(desde.getDate() - (days - 1));
    const limite = hojeLocal(desde);
    const janela = logs.filter((l) => l.date >= limite && l.status !== 'pending');
    if (janela.length === 0) return null;
    return Math.round((janela.filter((l) => l.status === 'taken').length / janela.length) * 100);
  };

  const valor = useMemo<MedContextData>(
    () => ({
      medications, logs, loading, adherence,
      addMedication, updateMedication, toggleMedication, deleteMedication, logDose,
      getTodayMedications, getAdherenceRate, fetchMedications,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [medications, logs, loading, adherence, somenteLeitura]
  );

  return <MedContext.Provider value={valor}>{children}</MedContext.Provider>;
};

export { useMed } from './useMed';
