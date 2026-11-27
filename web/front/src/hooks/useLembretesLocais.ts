import { useEffect, useRef } from 'react';
import { useMed } from '../context/useMed';
import { useAcessibilidade } from '../context/AcessibilidadeContext';
import { usePaciente } from '../context/PacienteContext';
import { agoraEmMinutos, hojeLocal, minutosDoDia } from '../utils/datas';

/**
 * Lembretes "de dentro do app": enquanto o MedSync está aberto (aba ou app instalado),
 * avisa na hora certa com aviso na tela, notificação do sistema e voz (se ativada).
 * Fora do app, quem avisa é o servidor (push + e-mail).
 */
export function useLembretesLocais() {
  const { getTodayMedications } = useMed();
  const { avisar, falar } = useAcessibilidade();
  const { paciente } = usePaciente();
  const itens = useRef(getTodayMedications);
  itens.current = getTodayMedications;

  useEffect(() => {
    if (paciente) return; // em modo cuidador não avisamos como se fossem as nossas doses

    const checar = async () => {
      const agora = agoraEmMinutos();
      const hoje = hojeLocal();
      for (const item of itens.current()) {
        if (!item.medication.reminderEnabled || (item.log && item.log.status !== 'pending')) continue;
        const diff = agora - minutosDoDia(item.scheduledTime);
        if (diff < 0 || diff > 5) continue; // só dispara na janela de 5 min
        const chave = `medsync_lembrete_${hoje}_${item.medication.id}_${item.scheduledTime}`;
        if (sessionStorage.getItem(chave)) continue;
        sessionStorage.setItem(chave, '1');

        const texto = `Hora de tomar ${item.medication.name}, ${item.medication.dosage} ${item.medication.unit}, às ${item.scheduledTime}.`;
        avisar(texto, 'info');
        falar(texto);

        if ('Notification' in window && Notification.permission === 'granted') {
          const reg = await navigator.serviceWorker?.getRegistration();
          const opcoes: NotificationOptions = {
            body: `${item.medication.name} — ${item.medication.dosage} ${item.medication.unit} às ${item.scheduledTime}`,
            tag: `dose-${item.medication.id}-${hoje}-${item.scheduledTime}`,
            icon: '/icon-192.png',
          };
          if (reg) await reg.showNotification('💊 Hora do medicamento', opcoes);
          else new Notification('💊 Hora do medicamento', opcoes);
        }
      }
    };

    void checar();
    const t = setInterval(() => void checar(), 20_000);
    return () => clearInterval(t);
  }, [paciente, avisar, falar]);
}
