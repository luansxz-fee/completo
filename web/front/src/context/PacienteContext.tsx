import React, { createContext, useContext, useEffect, useState } from 'react';
import { definirPacienteAlvo } from '../services/api';
import { Permissao } from '../types';
import { useAuth } from './AuthContext';

export interface PacienteFoco {
  id: string;
  nome: string;
  permissao: Permissao;
}

interface PacienteContextType {
  /** null = estou vendo os MEUS dados */
  paciente: PacienteFoco | null;
  somenteLeitura: boolean;
  focar: (p: PacienteFoco | null) => void;
}

const PacienteContext = createContext<PacienteContextType>({ paciente: null, somenteLeitura: false, focar: () => {} });

/**
 * "Modo cuidador": ao focar um paciente, todas as chamadas de medicamentos/registros
 * passam a enviar X-Paciente-Id e o servidor valida o vínculo e a permissão.
 */
export function PacienteProvider({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  const [paciente, setPaciente] = useState<PacienteFoco | null>(null);
  useEffect(() => { if (!usuario) setPaciente(null); }, [usuario]);

  // Precisa ficar síncrono antes dos filhos (MedProvider) buscarem os dados.
  definirPacienteAlvo(paciente?.id ?? null);
  useEffect(() => () => definirPacienteAlvo(null), []);

  return (
    <PacienteContext.Provider
      value={{ paciente, somenteLeitura: !!paciente && paciente.permissao !== 'gerenciar', focar: setPaciente }}
    >
      {children}
    </PacienteContext.Provider>
  );
}

export const usePaciente = () => useContext(PacienteContext);
