import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

function chaveParaUint8(base64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(b64);
  const saida = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) saida[i] = bruto.charCodeAt(i);
  return saida;
}

export const suportaPush = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const ehIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const instalado = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;

export async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    console.error('Falha ao registrar o service worker', e);
    return null;
  }
}

export function useNotificacoes() {
  const [permissao, setPermissao] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [inscritoAqui, setInscritoAqui] = useState(false);
  const [servidorHabilitado, setServidorHabilitado] = useState<boolean | null>(null);
  const [emailConfigurado, setEmailConfigurado] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const atualizar = useCallback(async () => {
    try {
      const st = await api.notificacoes.status();
      setServidorHabilitado(!!st.push?.servidorHabilitado);
      setEmailConfigurado(!!st.email?.configurado);
    } catch {
      /* offline */
    }
    if (suportaPush()) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setInscritoAqui(!!sub);
      setPermissao(Notification.permission);
    }
  }, []);

  useEffect(() => { void atualizar(); }, [atualizar]);

  const ativar = useCallback(async (): Promise<string | null> => {
    if (!suportaPush()) {
      return ehIOS() && !instalado()
        ? 'No iPhone/iPad, toque em Compartilhar → “Adicionar à Tela de Início” e abra o MedSync por lá para receber notificações.'
        : 'Este navegador não suporta notificações push.';
    }
    setOcupado(true);
    try {
      const reg = (await registrarServiceWorker()) || (await navigator.serviceWorker.ready);
      const resultado = await Notification.requestPermission();
      setPermissao(resultado);
      if (resultado !== 'granted') return 'Permissão negada. Libere as notificações nas configurações do navegador para este site.';

      const { habilitado, chave } = await api.notificacoes.chavePublica();
      if (!habilitado || !chave) return 'O servidor ainda não tem as chaves de notificação (VAPID) configuradas.';

      const existente = await reg.pushManager.getSubscription();
      const sub = existente || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaUint8(chave) }));
      await api.notificacoes.inscrever(sub.toJSON(), navigator.userAgent.slice(0, 120));
      setInscritoAqui(true);
      return null;
    } catch (e: any) {
      return e?.message || 'Não foi possível ativar as notificações.';
    } finally {
      setOcupado(false);
      void atualizar();
    }
  }, [atualizar]);

  const desativar = useCallback(async () => {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api.notificacoes.cancelar(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }
      setInscritoAqui(false);
    } finally {
      setOcupado(false);
      void atualizar();
    }
  }, [atualizar]);

  return {
    suportado: suportaPush(),
    ios: ehIOS(),
    instalado: typeof window !== 'undefined' ? instalado() : false,
    permissao, inscritoAqui, servidorHabilitado, emailConfigurado, ocupado,
    ativar, desativar, atualizar,
  };
}
