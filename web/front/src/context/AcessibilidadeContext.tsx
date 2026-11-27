import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

/**
 * Três trilhas independentes de acessibilidade, cada uma com graus:
 *
 *  VISÃO (baixa visão / idosos)
 *    0 Desligado
 *    1 Conforto      → letras e botões maiores (o antigo "Modo Idoso")
 *    2 Ampliado      → + alto contraste e zoom 115%
 *    3 Máximo        → + zoom 135%, contraste máximo, interface simplificada e foco grosso
 *
 *  DALTONISMO (tipo + grau de reforço)
 *    tipo: protanopia | deuteranopia | tritanopia | acromatopsia
 *    1 Paleta segura → cores que não se confundem
 *    2 + Símbolos    → ✓ ✕ ! junto de toda cor de status
 *    3 + Padrões     → listras/texturas e rótulos escritos em barras e legendas
 *
 *  LEITOR DE TELA / BRAILLE
 *    0 Desligado
 *    1 Leitor de tela → rótulos completos, anúncios (aria-live) e atalhos de teclado
 *    2 + Voz          → lê em voz alta lembretes, resumos e ações
 *    3 + Braille      → mostra Braille (Unicode) nos dados principais; ideal para
 *                       aprender/conferir e para uso com linha Braille via leitor de tela
 */
export type Daltonismo = 'nenhum' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'acromatopsia';

export interface PrefsAcessibilidade {
  visao: 0 | 1 | 2 | 3;
  daltonismo: Daltonismo;
  daltonismoGrau: 1 | 2 | 3;
  leitor: 0 | 1 | 2 | 3;
  movimentoReduzido: boolean;
  velocidadeVoz: number;
  /** carimbo (ms) da última alteração feita pela pessoa */
  atualizadoEm?: number;
}

export const PADRAO: PrefsAcessibilidade = {
  visao: 0,
  daltonismo: 'nenhum',
  daltonismoGrau: 1,
  leitor: 0,
  movimentoReduzido: false,
  velocidadeVoz: 1,
};

const CHAVE = 'medsync_acessibilidade';

function carregarLocal(): PrefsAcessibilidade {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return { ...PADRAO, ...JSON.parse(bruto) };
  } catch {
    /* ignora */
  }
  // migração: quem usava o antigo "Modo Idoso" continua com o mesmo conforto
  if (localStorage.getItem('medsync_modo') === 'idoso') return { ...PADRAO, visao: 1 };
  return { ...PADRAO, movimentoReduzido: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false };
}

type TipoAviso = 'sucesso' | 'erro' | 'info';
interface Aviso { id: number; texto: string; tipo: TipoAviso }

interface AcessibilidadeContextType {
  prefs: PrefsAcessibilidade;
  definir: (parcial: Partial<PrefsAcessibilidade>) => void;
  restaurar: () => void;
  /** atalhos derivados */
  modoIdoso: boolean;
  altoContraste: boolean;
  leitorAtivo: boolean;
  vozAtiva: boolean;
  brailleAtivo: boolean;
  daltonico: boolean;
  /** Mostra um aviso, anuncia para leitores de tela e (se a voz estiver ligada) fala. */
  avisar: (texto: string, tipo?: TipoAviso) => void;
  /** Anuncia só para leitores de tela / voz (sem aviso visual). Usado ao trocar de tela. */
  anunciar: (texto: string) => void;
  falar: (texto: string, forcar?: boolean) => void;
  pararFala: () => void;
  vozDisponivel: boolean;
  abrirPainel: () => void;
  fecharPainel: () => void;
  painelAberto: boolean;
}

const Ctx = createContext<AcessibilidadeContextType>({} as AcessibilidadeContextType);

export function AcessibilidadeProvider({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  const [prefs, setPrefs] = useState<PrefsAcessibilidade>(carregarLocal);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [anuncio, setAnuncio] = useState('');
  const [painelAberto, setPainelAberto] = useState(false);
  const idUsuarioSincronizado = useRef<string | null>(null);
  const adiarSync = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vozDisponivel = typeof window !== 'undefined' && 'speechSynthesis' in window;

  /* Aplica as preferências no <html>: o CSS reage a estes atributos. */
  useEffect(() => {
    const r = document.documentElement;
    r.setAttribute('data-visao', String(prefs.visao));
    if (prefs.visao >= 1) r.setAttribute('data-modo', 'idoso'); // reutiliza o CSS do antigo Modo Idoso
    else r.removeAttribute('data-modo');
    r.setAttribute('data-contraste', prefs.visao >= 2 ? 'alto' : 'normal');
    r.setAttribute('data-daltonismo', prefs.daltonismo);
    r.setAttribute('data-dalt-grau', String(prefs.daltonismoGrau));
    r.setAttribute('data-leitor', String(prefs.leitor));
    r.setAttribute('data-movimento', prefs.movimentoReduzido ? 'reduzido' : 'normal');
    localStorage.setItem(CHAVE, JSON.stringify(prefs));
  }, [prefs]);

  /* Ao entrar: vale a versão MAIS RECENTE entre este aparelho e a conta
     (assim o ajuste feito na tela de login não é apagado, e um aparelho novo herda o da conta). */
  useEffect(() => {
    if (!usuario) {
      idUsuarioSincronizado.current = null;
      return;
    }
    if (idUsuarioSincronizado.current === usuario.id) return;
    idUsuarioSincronizado.current = usuario.id;
    const remoto = usuario.acessibilidade as Partial<PrefsAcessibilidade> | null | undefined;
    const temRemoto = !!remoto && typeof remoto === 'object';
    if (temRemoto && (remoto!.atualizadoEm ?? 0) >= (prefs.atualizadoEm ?? 0)) setPrefs({ ...PADRAO, ...remoto });
    else if (prefs.atualizadoEm) api.auth.atualizarEu({ acessibilidade: prefs }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  const definir = useCallback(
    (parcial: Partial<PrefsAcessibilidade>) => {
      setPrefs((anterior) => {
        const novo = { ...anterior, ...parcial, atualizadoEm: Date.now() };
        if (usuario) {
          if (adiarSync.current) clearTimeout(adiarSync.current);
          adiarSync.current = setTimeout(() => {
            api.auth.atualizarEu({ acessibilidade: novo }).catch(() => {});
          }, 800);
        }
        return novo;
      });
    },
    [usuario]
  );

  const restaurar = useCallback(() => definir({ ...PADRAO }), [definir]);

  /* ---------- voz ---------- */
  const pararFala = useCallback(() => {
    if (vozDisponivel) window.speechSynthesis.cancel();
  }, [vozDisponivel]);

  const falar = useCallback(
    (texto: string, forcar = false) => {
      if (!vozDisponivel || (!forcar && prefs.leitor < 2)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      u.rate = prefs.velocidadeVoz;
      const voz = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('pt-br'));
      if (voz) u.voice = voz;
      window.speechSynthesis.speak(u);
    },
    [prefs.leitor, prefs.velocidadeVoz, vozDisponivel]
  );

  /* ---------- avisos (toast + aria-live + voz) ---------- */
  const proximoId = useRef(1);
  const avisar = useCallback(
    (texto: string, tipo: TipoAviso = 'info') => {
      const id = proximoId.current++;
      setAvisos((a) => [...a.slice(-2), { id, texto, tipo }]);
      setAnuncio('');
      setTimeout(() => setAnuncio(texto), 30); // força releitura mesmo se o texto se repetir
      if (prefs.leitor >= 2) falar(texto);
      setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), prefs.visao >= 1 ? 9000 : 5000);
    },
    [falar, prefs.leitor, prefs.visao]
  );

  const anunciar = useCallback(
    (texto: string) => {
      setAnuncio('');
      setTimeout(() => setAnuncio(texto), 30);
      if (prefs.leitor >= 2) falar(texto);
    },
    [falar, prefs.leitor]
  );

  /* ---------- atalhos de teclado (Alt+Shift+0) abre o painel ---------- */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === 'Digit0') {
        e.preventDefault();
        setPainelAberto((v) => !v);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  const valor = useMemo<AcessibilidadeContextType>(
    () => ({
      prefs,
      definir,
      restaurar,
      modoIdoso: prefs.visao >= 1,
      altoContraste: prefs.visao >= 2,
      leitorAtivo: prefs.leitor >= 1,
      vozAtiva: prefs.leitor >= 2,
      brailleAtivo: prefs.leitor >= 3,
      daltonico: prefs.daltonismo !== 'nenhum',
      avisar,
      anunciar,
      falar,
      pararFala,
      vozDisponivel,
      abrirPainel: () => setPainelAberto(true),
      fecharPainel: () => setPainelAberto(false),
      painelAberto,
    }),
    [prefs, definir, restaurar, avisar, anunciar, falar, pararFala, vozDisponivel, painelAberto]
  );

  return (
    <Ctx.Provider value={valor}>
      {children}

      {/* Região viva: leitores de tela e linhas Braille anunciam o texto assim que muda. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{anuncio}</div>

      <div className="toast-stack" aria-hidden="true">
        {avisos.map((a) => (
          <div key={a.id} className={`toast toast--${a.tipo === 'erro' ? 'error' : a.tipo === 'sucesso' ? 'success' : 'info'}`}>
            <span className="toast__sym">{a.tipo === 'erro' ? '✕' : a.tipo === 'sucesso' ? '✓' : 'ℹ'}</span> {a.texto}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useAcessibilidade = () => useContext(Ctx);
