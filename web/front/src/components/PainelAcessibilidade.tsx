import React from 'react';
import Modal from './Modal';
import Braille from './Braille';
import StatusDose from './StatusDose';
import { Daltonismo, useAcessibilidade } from '../context/AcessibilidadeContext';

interface Opcao<T> { valor: T; titulo: string; descricao: string }

const VISAO: Opcao<0 | 1 | 2 | 3>[] = [
  { valor: 0, titulo: 'Desligado', descricao: 'Aparência padrão.' },
  { valor: 1, titulo: 'Nível 1 · Conforto', descricao: 'Letras e botões maiores, espaçamento ampliado (o antigo Modo Idoso).' },
  { valor: 2, titulo: 'Nível 2 · Ampliado', descricao: 'Tudo do nível 1 + alto contraste e tela 15% maior.' },
  { valor: 3, titulo: 'Nível 3 · Máximo', descricao: 'Tela 35% maior, contraste máximo, foco bem grosso e menos elementos decorativos.' },
];

const DALTONISMO: Opcao<Daltonismo>[] = [
  { valor: 'nenhum', titulo: 'Desligado', descricao: 'Cores padrão.' },
  { valor: 'protanopia', titulo: 'Protanopia', descricao: 'Dificuldade com vermelho (vermelho parece escuro).' },
  { valor: 'deuteranopia', titulo: 'Deuteranopia', descricao: 'Dificuldade com verde (o tipo mais comum).' },
  { valor: 'tritanopia', titulo: 'Tritanopia', descricao: 'Dificuldade com azul e amarelo (mais raro).' },
  { valor: 'acromatopsia', titulo: 'Acromatopsia', descricao: 'Sem percepção de cores: tela em tons de cinza.' },
];

const GRAUS_DALT: Opcao<1 | 2 | 3>[] = [
  { valor: 1, titulo: 'Grau 1 · Paleta segura', descricao: 'Troca as cores que se confundem.' },
  { valor: 2, titulo: 'Grau 2 · + Símbolos', descricao: 'Coloca ✓ ✕ ! junto de cada cor de status.' },
  { valor: 3, titulo: 'Grau 3 · + Padrões', descricao: 'Também usa listras e rótulos escritos nas barras.' },
];

const LEITOR: Opcao<0 | 1 | 2 | 3>[] = [
  { valor: 0, titulo: 'Desligado', descricao: 'Sem ajustes extras.' },
  { valor: 1, titulo: 'Nível 1 · Leitor de tela e linha Braille', descricao: 'Rótulos completos, anúncios automáticos e atalhos de teclado. Compatível com NVDA, JAWS, VoiceOver e TalkBack, e com linhas Braille ligadas a eles.' },
  { valor: 2, titulo: 'Nível 2 · + Voz', descricao: 'Lê em voz alta os lembretes, avisos e botões “Ouvir”.' },
  { valor: 3, titulo: 'Nível 3 · + Braille na tela', descricao: 'Mostra o nome, a dose e o horário dos remédios também em Braille.' },
];

interface GrupoProps<T> {
  nome: string;
  opcoes: Opcao<T>[];
  valor: T;
  onChange: (v: T) => void;
}

function Grupo<T extends string | number>({ nome, opcoes, valor, onChange }: GrupoProps<T>) {
  return (
    <div className="a11y-opcoes" role="radiogroup" aria-label={nome}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <label key={String(o.valor)} className={`a11y-opcao ${ativo ? 'a11y-opcao--ativa' : ''}`}>
            <input
              type="radio"
              name={nome}
              checked={ativo}
              onChange={() => onChange(o.valor)}
              className="a11y-opcao__radio"
            />
            <span className="a11y-opcao__marca" aria-hidden="true">{ativo ? '●' : '○'}</span>
            <span className="a11y-opcao__texto">
              <strong>{o.titulo}</strong>
              <small>{o.descricao}</small>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export default function PainelAcessibilidade() {
  const { prefs, definir, restaurar, fecharPainel, falar, vozDisponivel, avisar, daltonico } = useAcessibilidade();

  return (
    <Modal
      titulo="Acessibilidade"
      subtitulo="As mudanças valem na hora e ficam salvas na sua conta."
      icone={<div className="modal__header-icon" aria-hidden="true">♿</div>}
      onClose={fecharPainel}
      rodape={
        <>
          <button type="button" className="btn btn--ghost" onClick={() => { restaurar(); avisar('Acessibilidade restaurada ao padrão.', 'info'); }}>
            Restaurar padrão
          </button>
          <button type="button" className="btn btn--primary" onClick={fecharPainel}>Concluir</button>
        </>
      }
    >
      <div className="a11y-painel">
        <section aria-labelledby="a11y-visao">
          <h3 id="a11y-visao"><span aria-hidden="true">👁️</span> Visão e conforto de leitura</h3>
          <Grupo nome="Visão" opcoes={VISAO} valor={prefs.visao} onChange={(v) => definir({ visao: v })} />
        </section>

        <section aria-labelledby="a11y-dalt">
          <h3 id="a11y-dalt"><span aria-hidden="true">🎨</span> Daltonismo</h3>
          <Grupo nome="Tipo de daltonismo" opcoes={DALTONISMO} valor={prefs.daltonismo} onChange={(v) => definir({ daltonismo: v, daltonismoGrau: v === 'acromatopsia' ? (Math.max(2, prefs.daltonismoGrau) as 2 | 3) : prefs.daltonismoGrau })} />
          {daltonico && (
            <>
              <h4>Grau de reforço</h4>
              <Grupo nome="Grau de reforço para daltonismo" opcoes={GRAUS_DALT} valor={prefs.daltonismoGrau} onChange={(v) => definir({ daltonismoGrau: v })} />
              <div className="a11y-previa" aria-label="Pré-visualização dos status">
                <StatusDose estado="taken" />
                <StatusDose estado="pending" />
                <StatusDose estado="skipped" />
                <StatusDose estado="missed" />
              </div>
            </>
          )}
        </section>

        <section aria-labelledby="a11y-leitor">
          <h3 id="a11y-leitor"><span aria-hidden="true">⠃</span> Leitor de tela, voz e Braille</h3>
          <Grupo nome="Leitor de tela e Braille" opcoes={LEITOR} valor={prefs.leitor} onChange={(v) => definir({ leitor: v })} />

          {prefs.leitor >= 2 && (
            <div className="form-group a11y-voz">
              <label htmlFor="a11y-velocidade">Velocidade da voz: {prefs.velocidadeVoz.toFixed(1)}×</label>
              <input
                id="a11y-velocidade"
                type="range"
                min={0.5}
                max={1.5}
                step={0.1}
                value={prefs.velocidadeVoz}
                onChange={(e) => definir({ velocidadeVoz: Number(e.target.value) })}
              />
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => (vozDisponivel ? falar('Olá! Esta é a voz do MedSync. Está boa para você?', true) : avisar('Seu navegador não tem voz sintetizada.', 'erro'))}
              >
                <span aria-hidden="true">🔊</span> Testar voz
              </button>
            </div>
          )}

          {prefs.leitor >= 3 && (
            <div className="a11y-previa a11y-previa--braille">
              <span>Losartana 50 mg às 08:00</span>
              <Braille texto="Losartana 50 mg às 08:00" bloco />
              <small>Braille grau 1 (Grafia Braille para a Língua Portuguesa). Quem usa linha Braille com leitor de tela recebe o texto normal, e a linha faz a conversão.</small>
            </div>
          )}
        </section>

        <section aria-labelledby="a11y-extra">
          <h3 id="a11y-extra"><span aria-hidden="true">🎞️</span> Movimento</h3>
          <label className="a11y-linha">
            <input
              type="checkbox"
              checked={prefs.movimentoReduzido}
              onChange={(e) => definir({ movimentoReduzido: e.target.checked })}
            />
            <span>Reduzir animações e transições</span>
          </label>
        </section>

        <p className="form-hint">
          Atalho: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>0</kbd> abre este painel em qualquer tela.
        </p>
      </div>
    </Modal>
  );
}
