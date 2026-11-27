export interface PreferenciasNotificacao {
  push: boolean;
  emailLembretes: boolean;
  emailCuidador: boolean;
}

export interface User {
  id: string;
  nome: string;
  /** alias de `nome` (mantido por compatibilidade) */
  name: string;
  email: string;
  avatar?: string | null;
  emailVerificado?: boolean;
  fusoHorario?: string;
  notificacoes?: PreferenciasNotificacao;
  acessibilidade?: unknown;
  criadoEm?: string;
  createdAt?: string;
}

export interface Medication {
  id: string;
  _id?: string;
  name: string;
  dosage: string;
  unit: string;
  frequency: string;
  times: string[];
  stock: number;
  stockMax?: number;
  active: boolean;
  color?: string;
  category?: string;
  icon?: string;
  imageUrl?: string;
  prescribedBy?: string;
  crm?: string;
  startDate?: string;
  endDate?: string;
  reminderEnabled?: boolean;
  instructions?: string;
  sideEffects?: string;
}

export type DoseStatus = 'taken' | 'skipped' | 'missed' | 'pending';

export interface DoseLog {
  id: string;
  medicationId: string;
  scheduledTime: string;
  status: DoseStatus;
  date: string;
  notes?: string;
  takenAt?: string;
  automatic?: boolean;
  registeredBy?: string | null;
}

export interface TodayMedicationItem {
  medication: Medication;
  scheduledTime: string;
  log?: DoseLog;
  /** status calculado: sem registro e horário passado = "late" (atrasada) */
  state: 'taken' | 'skipped' | 'missed' | 'late' | 'pending';
}

export type Permissao = 'visualizar' | 'gerenciar';

export interface Vinculo {
  id: string;
  pacienteId: string;
  cuidadorId: string | null;
  cuidadorEmail: string;
  apelido: string | null;
  status: 'pendente' | 'ativo' | 'recusado' | 'revogado';
  permissao: Permissao;
  criadoEm?: string;
  aceitoEm?: string | null;
  paciente?: { id: string; nome: string; avatar?: string | null };
  cuidador?: { id: string; nome: string; avatar?: string | null };
}

export interface ResumoPaciente {
  paciente: { id: string; nome: string; avatar?: string | null };
  permissao: Permissao;
  medicamentosAtivos: number;
  estoqueBaixo: number;
  dosesHoje: { tomadas: number; perdidas: number; puladas: number };
  adesao: { dias7: number | null; dias30: number | null };
}
