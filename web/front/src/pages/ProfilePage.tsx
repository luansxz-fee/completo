import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMed } from '../context/useMed';
import { useTheme } from '../context/ThemeContext';
import { useAcessibilidade } from '../context/AcessibilidadeContext';
import { Page } from '../components/AppRouter';
import Modal from '../components/Modal';
import NotificacoesCard from '../components/NotificacoesCard';
import Interruptor from '../components/Interruptor';
import ForcaSenha, { senhaForte } from '../components/ForcaSenha';
import { api } from '../services/api';

interface Props { navigate: (p: Page) => void }

const NOMES_VISAO = ['Desligado', 'Nível 1 · Conforto', 'Nível 2 · Ampliado', 'Nível 3 · Máximo'];
const NOMES_LEITOR = ['Desligado', 'Nível 1 · Leitor de tela', 'Nível 2 · + Voz', 'Nível 3 · + Braille'];
const NOMES_DALT: Record<string, string> = { nenhum: 'Desligado', protanopia: 'Protanopia', deuteranopia: 'Deuteranopia', tritanopia: 'Tritanopia', acromatopsia: 'Acromatopsia' };

export default function ProfilePage({ navigate }: Props) {
  const { usuario, sair, atualizarUsuario, alterarSenha, excluirConta } = useAuth();
  const { medications, logs, adherence, getAdherenceRate } = useMed();
  const { theme, toggleTheme } = useTheme();
  const { prefs, abrirPainel, avisar } = useAcessibilidade();

  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(usuario?.nome || '');
  const [modalSenha, setModalSenha] = useState(false);
  const [modalExcluir, setModalExcluir] = useState(false);
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const a7 = adherence.dias7 ?? getAdherenceRate(7);
  const desde = usuario?.criadoEm || usuario?.createdAt;

  const salvarNome = async () => {
    if (nome.trim().length < 2) return avisar('Digite um nome com pelo menos 2 letras.', 'erro');
    try {
      await atualizarUsuario({ nome: nome.trim() });
      setEditando(false);
      avisar('Nome atualizado.', 'sucesso');
    } catch (e: any) {
      avisar(e?.message || 'Não foi possível salvar.', 'erro');
    }
  };

  const trocarSenha = async () => {
    setErro('');
    if (!senhaForte(nova)) return setErro('A nova senha ainda não atende a todos os requisitos.');
    setOcupado(true);
    try {
      await alterarSenha(atual, nova);
      setModalSenha(false); setAtual(''); setNova('');
      avisar('Senha alterada com sucesso.', 'sucesso');
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível alterar a senha.');
    } finally { setOcupado(false); }
  };

  const apagarConta = async () => {
    setErro('');
    setOcupado(true);
    try {
      await excluirConta(atual);
      navigate('landing');
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível excluir a conta.');
      setOcupado(false);
    }
  };

  const baixarDados = async () => {
    try {
      const [meds, regs] = await Promise.all([api.medicamentos.listar(), api.registros.listar()]);
      const blob = new Blob([JSON.stringify({ exportadoEm: new Date().toISOString(), usuario: { nome: usuario?.nome, email: usuario?.email }, medicamentos: meds.dados, registros: regs.dados }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'medsync-meus-dados.json'; a.click();
      URL.revokeObjectURL(url);
      avisar('Seus dados foram baixados.', 'sucesso');
    } catch {
      avisar('Não foi possível baixar os dados.', 'erro');
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-hero">
        <div className="profile-hero__bg" aria-hidden="true" />
        <div className="profile-hero__content">
          <div className="profile-avatar-lg" aria-hidden="true">{usuario?.nome?.charAt(0).toUpperCase()}</div>
          <div className="profile-hero__info">
            {editando ? (
              <div className="profile-edit-row">
                <label htmlFor="perfil-nome" className="sr-only">Nome</label>
                <input id="perfil-nome" type="text" className="profile-name-input" value={nome} onChange={(e) => setNome(e.target.value)} data-autofocus autoFocus />
                <button type="button" className="btn btn--primary btn--sm" onClick={() => void salvarNome()}>Salvar</button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setEditando(false); setNome(usuario?.nome || ''); }}>Cancelar</button>
              </div>
            ) : (
              <div className="profile-name-row">
                <h2 className="profile-name">{usuario?.nome}</h2>
                <button type="button" className="btn btn--ghost btn--xs" onClick={() => setEditando(true)} aria-label="Editar nome"><span aria-hidden="true">✏️</span></button>
              </div>
            )}
            <p className="profile-email">{usuario?.email} {usuario?.emailVerificado && <span className="badge badge--success"><span aria-hidden="true">✓</span> verificado</span>}</p>
            {desde && <p className="profile-joined">Membro desde {new Date(desde).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>}
          </div>
        </div>
      </div>

      <dl className="profile-stats-grid">
        <div className="profile-stat-card profile-stat-card--blue"><dt>Medicamentos</dt><dd>{medications.length}</dd></div>
        <div className="profile-stat-card profile-stat-card--green"><dt>Doses tomadas</dt><dd>{logs.filter((l) => l.status === 'taken').length}</dd></div>
        <div className="profile-stat-card profile-stat-card--red"><dt>Doses perdidas</dt><dd>{logs.filter((l) => l.status === 'missed').length}</dd></div>
        <div className="profile-stat-card profile-stat-card--purple"><dt>Adesão 7 dias</dt><dd>{a7 === null ? '—' : `${a7}%`}</dd></div>
      </dl>

      <div className="profile-sections">
        <section className="card acessibilidade-card" aria-labelledby="titulo-acess">
          <div className="acessibilidade-header">
            <div className="acessibilidade-icon" aria-hidden="true">♿</div>
            <div className="acessibilidade-info">
              <h2 className="card-section-title" id="titulo-acess">Acessibilidade</h2>
              <p>Ajustes para baixa visão, daltonismo, leitores de tela, voz e Braille. Cada um tem graus, e vale em todos os seus dispositivos.</p>
            </div>
          </div>
          <dl className="acess-resumo">
            <div><dt>Visão</dt><dd>{NOMES_VISAO[prefs.visao]}</dd></div>
            <div><dt>Daltonismo</dt><dd>{NOMES_DALT[prefs.daltonismo]}{prefs.daltonismo !== 'nenhum' ? ` · grau ${prefs.daltonismoGrau}` : ''}</dd></div>
            <div><dt>Leitor / Braille</dt><dd>{NOMES_LEITOR[prefs.leitor]}</dd></div>
          </dl>
          <button type="button" className="btn btn--primary" onClick={abrirPainel}>Personalizar acessibilidade</button>
        </section>

        <NotificacoesCard />

        <section className="card" aria-labelledby="titulo-conta">
          <h2 className="card-section-title" id="titulo-conta">Conta</h2>
          <div className="profile-items">
            <div className="profile-item">
              <div className="profile-item__left"><span className="profile-item__icon" aria-hidden="true">📧</span><div><strong>E-mail</strong><p>{usuario?.email}</p></div></div>
            </div>
            <div className="profile-item">
              <div className="profile-item__left"><span className="profile-item__icon" aria-hidden="true">🔑</span><div><strong>Senha</strong><p>Altere quando quiser</p></div></div>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => { setErro(''); setModalSenha(true); }}>Alterar</button>
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="titulo-pref">
          <h2 className="card-section-title" id="titulo-pref">Aparência</h2>
          <div className="profile-items">
            <div className="profile-item">
              <div className="profile-item__left"><span className="profile-item__icon" aria-hidden="true">{theme === 'light' ? '🌙' : '☀️'}</span><div><strong>Tema escuro</strong><p>Descansa a vista à noite</p></div></div>
              <Interruptor ligado={theme === 'dark'} onChange={toggleTheme} rotulo="Tema escuro" />
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="titulo-dados">
          <h2 className="card-section-title" id="titulo-dados">Seus dados</h2>
          <div className="profile-items">
            <div className="profile-item">
              <div className="profile-item__left"><span className="profile-item__icon" aria-hidden="true">📦</span><div><strong>Baixar meus dados</strong><p>Arquivo com medicamentos e histórico (JSON)</p></div></div>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => void baixarDados()}>Baixar</button>
            </div>
            <div className="profile-item">
              <div className="profile-item__left"><span className="profile-item__icon" aria-hidden="true">🚪</span><div><strong>Sair da conta</strong><p>Encerra a sessão neste dispositivo</p></div></div>
              <button type="button" className="btn btn--outline btn--sm" onClick={sair}>Sair</button>
            </div>
            <div className="profile-item profile-item--perigo">
              <div className="profile-item__left"><span className="profile-item__icon" aria-hidden="true">🗑️</span><div><strong>Excluir minha conta</strong><p>Apaga tudo de forma definitiva (LGPD)</p></div></div>
              <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => { setErro(''); setAtual(''); setModalExcluir(true); }}>Excluir</button>
            </div>
          </div>
        </section>
      </div>

      {modalSenha && (
        <Modal titulo="Alterar senha" tamanho="sm" onClose={() => setModalSenha(false)}
          rodape={<><button type="button" className="btn btn--ghost" onClick={() => setModalSenha(false)}>Cancelar</button><button type="button" className="btn btn--primary" disabled={ocupado} onClick={() => void trocarSenha()}>{ocupado ? 'Salvando…' : 'Alterar senha'}</button></>}>
          <div className="form-group"><label htmlFor="sn-atual">Senha atual</label><input id="sn-atual" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} /></div>
          <div className="form-group"><label htmlFor="sn-nova">Nova senha</label><input id="sn-nova" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} aria-describedby="sn-regras" /><ForcaSenha senha={nova} id="sn-regras" /></div>
          {erro && <div className="form-error" role="alert">{erro}</div>}
        </Modal>
      )}

      {modalExcluir && (
        <Modal titulo="Excluir conta" tamanho="sm" onClose={() => setModalExcluir(false)}
          rodape={<><button type="button" className="btn btn--ghost" onClick={() => setModalExcluir(false)}>Cancelar</button><button type="button" className="btn btn--danger" disabled={ocupado || !atual} onClick={() => void apagarConta()}>{ocupado ? 'Excluindo…' : 'Excluir tudo'}</button></>}>
          <p>Isso apaga <strong>definitivamente</strong> sua conta, seus medicamentos, o histórico e os vínculos com cuidadores. Não dá para desfazer.</p>
          <div className="form-group"><label htmlFor="ex-senha">Digite a sua senha para confirmar</label><input id="ex-senha" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} /></div>
          {erro && <div className="form-error" role="alert">{erro}</div>}
        </Modal>
      )}
    </div>
  );
}
