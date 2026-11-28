import { useEffect, useState } from 'react';

/**
 * Instalação do site como app (PWA). O Chrome/Edge/Android avisam que podem instalar
 * por um evento que dispara cedo: o ouvinte precisa existir desde o carregamento do módulo.
 */
let eventoInstalacao: any = null;
const ouvintes = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalacao = e;
    ouvintes.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    eventoInstalacao = null;
    ouvintes.forEach((f) => f());
  });
}

export const jaInstalado = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);

export const ehIOS = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

export function usePwa() {
  const [, forcar] = useState(0);
  useEffect(() => {
    const f = () => forcar((n) => n + 1);
    ouvintes.add(f);
    return () => { ouvintes.delete(f); };
  }, []);

  return {
    podeInstalar: !!eventoInstalacao && !jaInstalado(),
    instalado: jaInstalado(),
    ios: ehIOS(),
    instalar: async (): Promise<boolean> => {
      if (!eventoInstalacao) return false;
      eventoInstalacao.prompt();
      const r = await eventoInstalacao.userChoice;
      eventoInstalacao = null;
      ouvintes.forEach((f) => f());
      return r?.outcome === 'accepted';
    },
  };
}
