import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAcessibilidade } from '../context/AcessibilidadeContext';
import { useNotificacoes } from '../hooks/useNotificacoes';
import { api } from '../services/api';
import Interruptor from './Interruptor';

export default function NotificacoesCard() {
  const { usuario, atualizarUsuario } = useAuth();
  const { avisar } = useAcessibilidade();
  const n = useNotificacoes();
  const [testando, setTestando] = useState(false);
  const prefs = usuario?.notificacoes || { push: true, emailLembretes: true, emailCuidador: true };

  const mudar = async (campo: 'push' | 'emailLembretes' | 'emailCuidador', valor: boolean) => {
    try {
      await atualizarUsuario({ notificacoes: { [campo]: valor } });
      avisar('Preferência salva.', 'sucesso');
    } catch {
      avisar('Não foi possível salvar a preferência.', 'erro');
    }
  };

  const ativar = async () => {
    const problema = await n.ativar();
    if (problema) avisar(problema, 'erro');
    else avisar('Notificações ativadas neste dispositivo.', 'sucesso');
  };

  const testar = async () => {
    setTestando(true);
    try {
      const r = await api.notificacoes.teste(true);
      if (r.push > 0 || r.email) {
        avisar(`Teste enviado${r.push ? ' (notificação)' : ''}${r.email ? ' e e-mail' : ''}. Confira!`, 'sucesso');
      } else {
        avisar('Nada foi entregue. Ative as notificações neste dispositivo ou confira o e-mail do servidor.', 'erro');
      }
    } catch (e: any) {
      avisar(e?.message || 'Falha no teste.', 'erro');
    } finally {
      setTestando(false);
    }
  };

  const estadoPush = !n.suportado
    ? n.ios && !n.instalado
      ? 'No iPhone/iPad é preciso instalar: Compartilhar → “Adicionar à Tela de Início”.'
      : 'Este navegador não suporta notificações push.'
    : n.permissao === 'denied'
    ? 'Bloqueadas no navegador. Libere nas configurações do site.'
    : n.inscritoAqui
    ? 'Ativas neste dispositivo.'
    : 'Ainda não ativadas neste dispositivo.';

  return (
    <div className="card" style={{ width: '100%' }}>
      <h2 className="card-section-title" id="titulo-notif">Notificações e lembretes</h2>
      <p className="form-hint">
        O MedSync avisa no horário de cada dose, repete se você ainda não tiver registrado e, se houver cuidadores,
        avisa eles quando a dose atrasar.
      </p>

      <div className="profile-items" role="group" aria-labelledby="titulo-notif">
        <div className="profile-item">
          <div className="profile-item__left">
            <span className="profile-item__icon" aria-hidden="true">🔔</span>
            <div>
              <strong>Notificações neste dispositivo</strong>
              <p>{estadoPush}</p>
            </div>
          </div>
          {n.suportado && (
            n.inscritoAqui ? (
              <button type="button" className="btn btn--outline btn--sm" onClick={() => void n.desativar()} disabled={n.ocupado}>Desativar</button>
            ) : (
              <button type="button" className="btn btn--primary btn--sm" onClick={() => void ativar()} disabled={n.ocupado || n.permissao === 'denied'}>
                {n.ocupado ? 'Ativando…' : 'Ativar'}
              </button>
            )
          )}
        </div>

        {n.servidorHabilitado === false && (
          <div className="form-warn" role="alert">
            O servidor ainda não tem as chaves de push (VAPID) configuradas — veja o README. Lembretes por e-mail continuam valendo.
          </div>
        )}

        <div className="profile-item">
          <div className="profile-item__left">
            <span className="profile-item__icon" aria-hidden="true">📲</span>
            <div><strong>Receber notificações push</strong><p>Em todos os dispositivos ativados</p></div>
          </div>
          <Interruptor ligado={prefs.push} onChange={(v) => void mudar('push', v)} rotulo="Receber notificações push" />
        </div>

        <div className="profile-item">
          <div className="profile-item__left">
            <span className="profile-item__icon" aria-hidden="true">✉️</span>
            <div><strong>Lembretes por e-mail</strong><p>Um e-mail na hora de cada dose ({usuario?.email})</p></div>
          </div>
          <Interruptor ligado={prefs.emailLembretes} onChange={(v) => void mudar('emailLembretes', v)} rotulo="Receber lembretes por e-mail" />
        </div>

        <div className="profile-item">
          <div className="profile-item__left">
            <span className="profile-item__icon" aria-hidden="true">🤝</span>
            <div><strong>Alertas de quem eu ajudo, por e-mail</strong><p>Quando um paciente seu atrasar uma dose</p></div>
          </div>
          <Interruptor ligado={prefs.emailCuidador} onChange={(v) => void mudar('emailCuidador', v)} rotulo="Receber alertas de pacientes por e-mail" />
        </div>

        <div className="profile-item">
          <div className="profile-item__left">
            <span className="profile-item__icon" aria-hidden="true">🧪</span>
            <div><strong>Enviar um teste agora</strong><p>Confirma se a notificação e o e-mail estão chegando</p></div>
          </div>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => void testar()} disabled={testando}>
            {testando ? 'Enviando…' : 'Testar'}
          </button>
        </div>
      </div>
    </div>
  );
}
