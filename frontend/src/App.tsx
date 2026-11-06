import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { apiConfigurationError, ApiError, apiRequest } from './lib/api';
import { canvasState, isCompleted, mergeAssignments, synchronizeCanvas, workStatusLabel } from './lib/canvas-sync';
import {
  createAssignment, demoAssignments, formatDueDate, httpsUrl, isAssignment, localDateTime,
  readLocalAssignments, STATUS_LABELS, STORAGE_KEY,
} from './lib/model';
import type { Assignment, AssignmentStatus, CanvasAssignment, Course, Health, LocalAssignmentsRead } from './lib/model';

type StorageFault = { kind: 'invalid' | 'unavailable' | 'write-blocked'; raw: string | null };

type IconName = 'grid' | 'canvas' | 'link' | 'plus' | 'arrow' | 'check' | 'clock' | 'close' | 'logout' | 'search';
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    canvas: <><path d="M4 4h16v16H4zM8 9h8M8 13h8M8 17h4" /><path d="M8 2v4M16 2v4" /></>,
    link: <><path d="m10 13 4-4M8 16l-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0M16 8l1-1a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    logout: <><path d="M10 4H4v16h6M8 12h13m-4-4 4 4-4 4" /></>,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} aria-labelledby="modal-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="modal-heading"><h2 id="modal-title">{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar janela"><Icon name="close" /></button></div>
    {children}
  </dialog>;
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : 'Não foi possível concluir a operação.'; }

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [initialLocalState] = useState<LocalAssignmentsRead>(() => {
    if (supabase) return { kind: 'valid', assignments: [] };
    try { return readLocalAssignments(localStorage); }
    catch { return { kind: 'unavailable' }; }
  });
  const [storageFault, setStorageFault] = useState<StorageFault | null>(() => initialLocalState.kind === 'invalid'
    ? { kind: 'invalid', raw: initialLocalState.raw }
    : initialLocalState.kind === 'unavailable' ? { kind: 'unavailable', raw: null } : null);
  const [assignments, setAssignments] = useState<Assignment[]>(() => initialLocalState.kind === 'valid'
    ? initialLocalState.assignments : initialLocalState.kind === 'missing' ? demoAssignments() : []);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthFailed, setHealthFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<AssignmentStatus | 'all' | 'pending' | 'completed'>(supabase ? 'pending' : 'all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'individual' | 'group'>('all');
  const [loadedOwnerId, setLoadedOwnerId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [syncWarning, setSyncWarning] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const syncRun = useRef<{ owner: string } | null>(null);
  const lastSyncTime = useRef(0);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Assignment | null>(null);
  const [showCanvas, setShowCanvas] = useState(false);
  const [submission, setSubmission] = useState<Assignment | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const localMode = !supabase;

  useEffect(() => {
    let active = true;
    apiRequest<Health>('/api/health', null).then((data) => { if (active) setHealth(data); }).catch(() => { if (active) setHealthFailed(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data, error: authError }) => {
      if (active) { setSession(data.session); setAuthLoading(false); if (authError) setError('Sua sessão não pôde ser carregada. Entre novamente.'); }
    }).catch(() => { if (active) { setError('Falha ao conectar ao Supabase. Confira a configuração.'); setAuthLoading(false); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { if (active) { setSession(next); setAuthLoading(false); } });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !session) { if (supabase) setAssignments([]); setLoadedOwnerId(null); return; }
    let active = true;
    setLoadedOwnerId(null);
    setLoading(true);
    supabase.from('assignments').select('*').order('created_at', { ascending: false }).then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setError('Não foi possível carregar os trabalhos. Confira a conexão e a migração do banco.');
      else if (data?.every(isAssignment)) { setAssignments(data); setLoadedOwnerId(session.user.id); }
      else setError('O banco retornou trabalhos em um formato inesperado.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [session?.user.id]);

  useEffect(() => {
    syncRun.current = null;
    setSyncing(false); setSyncWarning(''); setLastSyncedAt(null);
    lastSyncTime.current = 0;
    return () => { syncRun.current = null; };
  }, [session?.user.id]);

  async function syncCanvas() {
    const currentSession = sessionRef.current;
    if (!supabase || !currentSession || !health?.canvasConfigured || loadedOwnerId !== currentSession.user.id
      || syncRun.current?.owner === currentSession.user.id) return;
    const run = { owner: currentSession.user.id };
    syncRun.current = run;
    lastSyncTime.current = Date.now();
    const isCurrent = () => syncRun.current === run && sessionRef.current?.user.id === run.owner;
    setSyncing(true); setSyncWarning(''); setSyncProgress('Consultando suas disciplinas…');
    try {
      const result = await synchronizeCanvas(currentSession, supabase, {
        isCurrent,
        onRows: rows => { if (isCurrent()) setAssignments(current => mergeAssignments(current, rows)); },
        onProgress: (done, total) => { if (isCurrent()) setSyncProgress(`Atualizando disciplinas: ${done} de ${total}`); },
      });
      if (isCurrent()) {
        if (result.failedCourses) setSyncWarning(`Não foi possível consultar ${result.failedCourses} disciplina(s). Os dados anteriores foram preservados.`);
        else setLastSyncedAt(result.syncedAt);
      }
    } catch (cause) {
      if (isCurrent()) setSyncWarning(errorMessage(cause));
    } finally {
      if (isCurrent()) { syncRun.current = null; setSyncing(false); }
    }
  }

  useEffect(() => {
    if (!session || !health?.canvasConfigured || loadedOwnerId !== session.user.id) return;
    void syncCanvas();
    const interval = window.setInterval(() => { if (!document.hidden) void syncCanvas(); }, 5 * 60_000);
    const onVisible = () => { if (!document.hidden && Date.now() - lastSyncTime.current >= 60_000) void syncCanvas(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [session?.user.id, health?.canvasConfigured, loadedOwnerId]);

  useEffect(() => {
    if (localMode && !storageFault) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments)); }
      catch {
        let raw: string | null = null;
        try { raw = localStorage.getItem(STORAGE_KEY); } catch { /* Access may be blocked entirely. */ }
        setStorageFault({ kind: 'write-blocked', raw });
        setNotice('');
      }
    }
  }, [assignments, localMode, storageFault]);

  const completed = assignments.filter(isCompleted);
  const groupDelivered = completed.filter(task => canvasState(task)?.groupAssignment && canvasState(task)?.state === 'submitted').length;
  const pending = assignments.filter((task) => !isCompleted(task));
  const overdue = pending.filter(task => task.due_at && Date.parse(task.due_at) < Date.now()).length;
  const next = [...pending].filter(task => task.due_at && Date.parse(task.due_at) >= Date.now()).sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))[0];
  const visible = assignments.filter((task) => (filter === 'all' || (filter === 'pending' ? !isCompleted(task) : filter === 'completed' ? isCompleted(task) : task.status === filter))
    && (courseFilter === 'all' || task.course_name === courseFilter)
    && (scopeFilter === 'all' || (scopeFilter === 'group' ? canvasState(task)?.groupAssignment === true : canvasState(task)?.groupAssignment !== true))
    && `${task.title} ${task.course_name}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
    .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999') || a.title.localeCompare(b.title, 'pt-BR'));
  const grouped = new Map<string, Assignment[]>();
  for (const task of visible) grouped.set(task.course_name, [...(grouped.get(task.course_name) ?? []), task]);
  const courseNames = [...new Set(assignments.map(task => task.course_name))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  async function persist(task: Assignment) {
    const latest = assignments.find(item => item.id === task.id);
    const row = { ...task, ...(latest?.canvas_sync ? { canvas_sync: latest.canvas_sync } : {}), updated_at: new Date().toISOString(), ...(session ? { user_id: session.user.id } : {}) };
    if (supabase) {
      if (!session) throw new Error('Entre na sua conta para salvar.');
      const { error: saveError } = await supabase.from('assignments').upsert(row);
      if (saveError) throw new Error('Não foi possível salvar o trabalho no Supabase. Tente novamente.');
    }
    setAssignments((current) => current.some((item) => item.id === row.id) ? current.map((item) => item.id === row.id ? row : item) : [row, ...current]);
  }

  async function saveEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    if (!editor.title.trim() || !editor.course_name.trim()) { setError('Preencha o título e a disciplina.'); return; }
    if (editor.project_url && !httpsUrl(editor.project_url)) { setError('Use um link HTTPS completo, sem usuário ou senha na URL.'); return; }
    setBusy(true); setError('');
    try { await persist({ ...editor, title: editor.title.trim(), course_name: editor.course_name.trim(), project_url: editor.project_url.trim() }); setEditor(null); setNotice(localMode ? storageFault ? 'Trabalho mantido somente nesta sessão. O armazenamento original continua preservado.' : 'Trabalho salvo neste navegador.' : 'Trabalho salvo na sua conta.'); }
    catch (saveError) { setError(errorMessage(saveError)); }
    finally { setBusy(false); }
  }

  async function removeTask(task: Assignment) {
    if (busy || !window.confirm(`Excluir “${task.title}” deste organizador? Isso não exclui nada do Canvas.`)) return;
    setBusy(true); setError('');
    try {
      if (supabase) {
        const { error: deleteError } = await supabase.from('assignments').delete().eq('id', task.id);
        if (deleteError) throw new Error('Não foi possível excluir o trabalho.');
      }
      setAssignments((current) => current.filter((item) => item.id !== task.id)); setEditor(null); setNotice('Trabalho removido do organizador.');
    } catch (deleteError) { setError(errorMessage(deleteError)); }
    finally { setBusy(false); }
  }

  async function submitToCanvas() {
    if (!submission || !confirmed || busy || !session || !health?.submissionsEnabled) return;
    setBusy(true); setError(''); setNotice('');
    let sent = false;
    try {
      const result = await apiRequest<{ submitted: boolean }>('/api/canvas/submissions', session, { method: 'POST', body: JSON.stringify({ courseId: submission.canvas_course_id, assignmentId: submission.canvas_assignment_id, url: submission.project_url, confirm: true }) }, 60_000);
      if (result?.submitted !== true) throw new ApiError('A API não confirmou a entrega.', 'SUBMISSION_UNKNOWN');
      sent = true;
      await persist({ ...submission, status: 'submitted' });
      setNotice('O Canvas confirmou o envio do link. Confira o recibo na página da atividade.'); setSubmission(null);
    } catch (submitError) {
      const uncertain = submitError instanceof ApiError && submitError.code === 'SUBMISSION_UNKNOWN';
      setError(sent
        ? 'O Canvas confirmou o envio, mas não foi possível atualizar o organizador. Confira o recibo no Canvas antes de tentar novamente.'
        : uncertain || !(submitError instanceof ApiError)
          ? 'Resultado da entrega não confirmado. Confira o recibo diretamente no Canvas antes de tentar um novo envio.'
          : `${errorMessage(submitError)} O envio não foi confirmado; confira o recibo no Canvas antes de tentar um novo envio.`);
      setSubmission(null);
      setConfirmed(false);
    } finally { setBusy(false); }
  }

  function exportTasks() {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), assignments }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'campusflow-trabalhos.json'; anchor.click(); URL.revokeObjectURL(url);
  }

  function downloadOriginalStorage() {
    if (storageFault?.raw === null || storageFault?.raw === undefined) return;
    const blob = new Blob([storageFault.raw], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'campusflow-dados-originais.txt'; anchor.click(); URL.revokeObjectURL(url);
  }

  function resetLocalStorage() {
    if (!window.confirm('Substituir o armazenamento local pelos trabalhos abertos nesta sessão? Baixe os dados originais antes de continuar se quiser preservá-los fora do navegador.')) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
      setStorageFault(null); setNotice('Armazenamento local reiniciado com os trabalhos desta sessão.');
    } catch {
      setError('O navegador continua impedindo a gravação. Seus dados originais não foram substituídos. Exporte os trabalhos desta sessão antes de sair.');
    }
  }

  const submissionAllowed = (task: Assignment) => Boolean(session && health?.submissionsEnabled && task.canvas_course_id && task.canvas_assignment_id && httpsUrl(task.project_url) && !isCompleted(task));
  const editorSaved = Boolean(editor && assignments.some((task) => task.id === editor.id && JSON.stringify(task) === JSON.stringify(editor)));

  return <div className="app-shell">
    <aside className="sidebar">
      <a href="#inicio" className="brand" aria-label="CampusFlow, início"><span className="brand-symbol">c<span>.</span></span><span>Campus<span className="brand-light">Flow</span><small>SEU SEMESTRE, EM ORDEM</small></span></a>
      <div className="workspace-label">ESPAÇO PESSOAL <span>01</span></div>
      <nav aria-label="Navegação principal">
        <button className="nav-item active" onClick={() => { document.getElementById('trabalhos')?.scrollIntoView({ behavior: 'smooth' }); }}><Icon name="grid" />Meus trabalhos<span className="nav-count">{assignments.length}</span></button>
        <button className="nav-item" onClick={() => setShowCanvas(true)}><Icon name="canvas" />Integração Canvas<Icon name="arrow" size={16} /></button>
        <button className="nav-item" onClick={exportTasks}><Icon name="link" />Exportar organização</button>
      </nav>
      <div className="sidebar-note"><span className="little-star">✳</span><h3>Uma entrega de cada vez.</h3><p>Organize o trabalho, publique seu projeto e leve o link até o Canvas.</p><span className="note-rule" /></div>
      <div className="sidebar-footer"><span className="avatar">{session?.user.email?.[0]?.toUpperCase() ?? 'EU'}</span><div><strong>{session?.user.email?.split('@')[0] ?? 'Meu espaço'}</strong><small>{localMode ? 'Dados neste navegador' : session ? 'Conta conectada' : 'Entre para sincronizar'}</small></div>{session && <button className="icon-button logout" aria-label="Sair da conta" onClick={() => { supabase?.auth.signOut().then(({ error: logoutError }) => { if (logoutError) setError('Não foi possível sair. Tente novamente.'); }); }}><Icon name="logout" size={18} /></button>}</div>
    </aside>

    <main id="inicio" className="main-content">
      <header className="topbar"><span>SEU PAINEL ACADÊMICO</span><div className="environment-badge"><span className={`status-dot ${localMode ? 'amber' : ''}`} />{localMode ? 'Modo local' : 'Supabase configurado'}</div></header>
      <section className="welcome"><div><div className="eyebrow">MAIS FOCO NO QUE VOCÊ CRIA</div><h1>Seu próximo trabalho.<br /><em>Um passo mais perto.</em></h1><p>Do primeiro rascunho ao link da entrega.<br className="desktop-break" /> Tudo o que precisa de atenção, em um só lugar.</p></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-card art-back" /><div className="art-card art-front"><span className="art-line" /><span className="art-line short" /><div className="art-code">&lt;/&gt;</div><span className="art-chip"><Icon name="check" size={14} />feito por você</span></div><div className="art-spark">✳</div></div></section>

      {localMode && <div className="mode-notice"><span className="status-dot amber" /><p><strong>Seu ambiente está em modo local.</strong> Os dados ficam neste navegador. Os trabalhos iniciais são exemplos fictícios; Supabase e Canvas precisam ser conectados para sincronizar e entregar.</p></div>}
      {apiConfigurationError && <div className="feedback feedback-error" role="alert">{apiConfigurationError}</div>}
      {localMode && storageFault && <section className="storage-recovery" aria-label="Recuperação do armazenamento local" role="status"><div><strong>{storageFault.kind === 'invalid' ? 'Dados locais preservados para recuperação.' : 'O armazenamento local está indisponível.'}</strong><p>{storageFault.kind === 'invalid'
        ? 'Os dados existentes não puderam ser lidos e continuam intactos. Não foram substituídos por exemplos. Você pode trabalhar nesta sessão, mas as alterações não serão gravadas sobre o original.'
        : 'O navegador bloqueou o acesso ou não permitiu gravar os dados. Nenhum original será substituído. Novos trabalhos ficam somente nesta sessão; exporte uma cópia antes de sair.'}</p></div><div className="recovery-actions">{storageFault.raw !== null && <button className="button button-secondary" onClick={downloadOriginalStorage}>Baixar dados originais</button>}<button className="button button-secondary" onClick={exportTasks}>Exportar trabalhos desta sessão</button><button className="button button-secondary" onClick={resetLocalStorage}>Reiniciar armazenamento local</button></div></section>}
      {error && <div className="feedback feedback-error" role="alert"><span>{error}</span><button className="icon-button" onClick={() => setError('')} aria-label="Fechar mensagem de erro"><Icon name="close" size={16} /></button></div>}
      {notice && <div className="feedback feedback-success" role="status"><span>{notice}</span><button className="icon-button" onClick={() => setNotice('')} aria-label="Fechar aviso"><Icon name="close" size={16} /></button></div>}

      {authLoading ? <p className="loading" role="status">Carregando sua sessão…</p> : supabase && !session ? <Login onError={setError} /> : <>
        <section className="stats-grid" aria-label="Resumo dos trabalhos">
          <article className="stat-card"><div className="stat-top"><span>PENDENTES</span><Icon name="grid" size={18} /></div><strong>{String(pending.length).padStart(2, '0')}</strong><p>Atividades que precisam de atenção</p></article>
          <article className="stat-card"><div className="stat-top"><span>CONCLUÍDOS</span><Icon name="check" size={18} /></div><strong>{String(completed.length).padStart(2, '0')}</strong><p>{groupDelivered} entregas em grupo</p></article>
          <article className="stat-card stat-next"><div className="stat-top"><span>PRÓXIMO PRAZO</span><Icon name="clock" size={18} /></div><strong className="stat-date">{next ? formatDueDate(next.due_at) : pending.length ? 'Sem prazo futuro' : 'Tudo em dia'}</strong><p>{next?.title ?? (overdue ? `${overdue} atividade(s) em atraso` : pending.length ? 'Atividades sem prazo definido' : 'Nenhuma atividade pendente')}</p></article>
        </section>
        <section id="trabalhos" className="tasks-section">
          <div className="section-heading"><div><span className="eyebrow">SEU FLUXO DE TRABALHO</span><h2>Meus trabalhos <span>{assignments.length}</span></h2></div><button className="button button-primary" onClick={() => { setError(''); setEditor(createAssignment()); }}><Icon name="plus" size={18} />Novo trabalho</button></div>
          {session && <div className="canvas-sync-bar"><div role="status"><strong>{syncing ? syncProgress : lastSyncedAt ? 'Atividades atualizadas com o Canvas' : 'Suas atividades do Canvas, automaticamente'}</strong><p>{health?.canvasConfigured ? 'Atualização ao entrar e a cada 5 minutos. Anotações e links são preservados.' : 'Exibindo as atividades salvas. A atualização do Canvas precisa da API conectada.'}</p></div><button className="button button-secondary" disabled={syncing || !health?.canvasConfigured || loadedOwnerId !== session.user.id} onClick={() => void syncCanvas()}>{syncing ? 'Atualizando…' : 'Atualizar Canvas'}</button></div>}
          {syncWarning && <p className="sync-warning" role="alert">{syncWarning}</p>}
          <div className="list-toolbar"><div className="tabs" role="group" aria-label="Filtrar trabalhos por status">{(['pending', 'completed', 'all', 'in_progress', 'ready'] as const).map(status => <button key={status} className={filter === status ? 'selected' : ''} aria-pressed={filter === status} onClick={() => setFilter(status)}>{status === 'pending' ? 'Pendentes' : status === 'completed' ? 'Concluídos' : status === 'all' ? 'Todos' : status === 'ready' ? 'Prontos' : STATUS_LABELS[status]}</button>)}</div><label className="search"><Icon name="search" size={17} /><input aria-label="Buscar por trabalho ou disciplina" placeholder="Buscar trabalho…" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
          <div className="work-filters"><label>Disciplina<select aria-label="Filtrar por disciplina" value={courseFilter} onChange={event => setCourseFilter(event.target.value)}><option value="all">Todas as disciplinas</option>{courseNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label>Tipo de atividade<select aria-label="Filtrar por tipo de atividade" value={scopeFilter} onChange={event => setScopeFilter(event.target.value as typeof scopeFilter)}><option value="all">Individuais e em grupo</option><option value="individual">Individuais</option><option value="group">Em grupo</option></select></label><span className="visible-count">{visible.length} atividade(s)</span></div>
          {loading ? <p className="empty-state" role="status">Carregando seus trabalhos…</p> : visible.length === 0 ? <div className="empty-state"><Icon name="grid" size={28} /><h3>{assignments.length ? 'Nenhum trabalho nesta busca' : syncing ? 'Buscando suas atividades no Canvas' : 'Seu próximo projeto começa aqui'}</h3><p>{assignments.length ? 'Tente outra disciplina, tipo ou filtro.' : health?.canvasConfigured ? 'Suas atividades aparecerão aqui automaticamente.' : 'Adicione um trabalho ou conecte o Canvas.'}</p></div> : <div className="course-groups">{[...grouped].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([course, tasks]) => <section className="course-group" aria-label={`Trabalhos de ${course}`} key={course}><header><h3>{course}</h3><span>{tasks.length}</span></header><div className="task-list">{tasks.map((task, index) => <article key={task.id} className="task-row"><div className={`task-icon task-icon-${index % 3}`}><span>{task.course_name.slice(0, 2).toUpperCase()}</span></div><div className="task-info"><p>{task.canvas_assignment_id ? 'CANVAS' : 'TRABALHO PESSOAL'}{canvasState(task)?.groupAssignment && <span className="group-tag">Em grupo</span>}</p><button className="task-title" onClick={() => { setError(''); setEditor({ ...task }); }}>{task.title}</button><div className="task-meta"><span><Icon name="clock" size={13} />{formatDueDate(task.due_at)}</span>{task.project_url && httpsUrl(task.project_url) && <a href={task.project_url} target="_blank" rel="noreferrer"><Icon name="link" size={13} />Abrir projeto</a>}</div></div><span className={`task-status status-${isCompleted(task) ? 'submitted' : task.status === 'submitted' ? 'draft' : task.status}`}><i />{workStatusLabel(task)}</span><button className="task-open icon-button" aria-label={`Editar ${task.title}`} onClick={() => { setError(''); setEditor({ ...task }); }}><Icon name="arrow" size={20} /></button></article>)}</div></section>)}</div>}
        </section>
      </>}
      <footer className="main-footer"><span>Organização para abrir espaço para o que importa.</span><span>CAMPUSFLOW <span className="footer-dot">·</span> FEITO PARA O SEU DIA A DIA</span></footer>
    </main>

    {editor && <Modal title={assignments.some((task) => task.id === editor.id) ? 'Editar trabalho' : 'Novo trabalho'} onClose={() => { if (!busy) setEditor(null); }}><form onSubmit={saveEditor} className="form-stack"><label>Título do trabalho<input required maxLength={200} readOnly={Boolean(canvasState(editor))} value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} placeholder="O que você vai criar?" autoFocus /></label><label>Disciplina<input required maxLength={200} readOnly={Boolean(canvasState(editor))} value={editor.course_name} onChange={(event) => setEditor({ ...editor, course_name: event.target.value })} placeholder="Nome da disciplina" /></label><div className="form-columns"><label>Prazo<input type="datetime-local" readOnly={Boolean(canvasState(editor))} value={localDateTime(editor.due_at)} onChange={(event) => setEditor({ ...editor, due_at: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label><label>Status<select disabled={Boolean(canvasState(editor) && isCompleted(editor))} value={editor.status} onChange={(event) => setEditor({ ...editor, status: event.target.value as AssignmentStatus })}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option value={value} key={value} disabled={Boolean(canvasState(editor) && !isCompleted(editor) && value === 'submitted')}>{label}</option>)}</select></label></div><label>Link do projeto publicado<input type="url" value={editor.project_url} onChange={(event) => setEditor({ ...editor, project_url: event.target.value })} placeholder="https://seu-projeto.netlify.app" /></label><label>Anotações<textarea rows={3} maxLength={10_000} value={editor.notes} onChange={(event) => setEditor({ ...editor, notes: event.target.value })} placeholder="Requisitos, próximos passos e lembretes…" /></label><p className="form-help">{canvasState(editor) && 'Os dados e a conclusão da atividade vêm do Canvas, incluindo entregas em grupo. Suas anotações e links são preservados. ' }Alterar o status aqui não envia o trabalho ao Canvas. O envio é uma ação separada e exige confirmação.</p>{error && <p className="inline-error" role="alert">{error}</p>}<div className="form-actions">{!editor.canvas_assignment_id && assignments.some((task) => task.id === editor.id) && <button className="button button-danger" type="button" disabled={busy} onClick={() => void removeTask(editor)}>Excluir</button>}<button className="button button-secondary" type="button" disabled={busy} onClick={() => setEditor(null)}>Cancelar</button><button className="button button-primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar trabalho'}</button></div>{editor.canvas_assignment_id && <div className="canvas-delivery"><p>Entregue o link deste projeto na atividade vinculada.</p>{editor.canvas_html_url && httpsUrl(editor.canvas_html_url) && <a href={editor.canvas_html_url} target="_blank" rel="noreferrer">Abrir atividade no Canvas ↗</a>}<button className="button button-secondary" type="button" disabled={busy || !submissionAllowed(editor) || !editorSaved} onClick={() => { setSubmission({ ...editor }); setConfirmed(false); setEditor(null); }}>Revisar envio ao Canvas</button>{(!submissionAllowed(editor) || !editorSaved) && <small>Para enviar: entre na conta, habilite a integração, salve um link HTTPS e use uma atividade ainda não marcada como entregue.</small>}</div>}</form></Modal>}
    {showCanvas && <CanvasModal session={session} health={health} healthFailed={healthFailed} assignments={assignments} onClose={() => setShowCanvas(false)} />}
    {submission && <Modal title="Revisar entrega no Canvas" onClose={() => { if (!busy) setSubmission(null); }}><div className="form-stack"><p>Esta ação enviará o link abaixo para uma atividade real no Canvas.</p><div className="delivery-summary"><strong>{submission.title}</strong><span>{submission.course_name}</span><a href={submission.project_url} target="_blank" rel="noreferrer">{submission.project_url}</a></div><label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Conferi o link, a disciplina e a atividade. Confirmo o envio deste trabalho ao Canvas.</label>{error && <p className="inline-error" role="alert">{error}</p>}<div className="form-actions"><button className="button button-secondary" disabled={busy} onClick={() => setSubmission(null)}>Voltar</button><button className="button button-primary" disabled={!confirmed || busy} onClick={() => void submitToCanvas()}>{busy ? 'Enviando…' : 'Confirmar e enviar link'}</button></div></div></Modal>}
  </div>;
}

function Login({ onError }: { onError: (message: string) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || busy) return; setBusy(true); onError('');
    try { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) onError('Não foi possível entrar. Confira o e-mail, a senha e a configuração da sua conta.'); }
    catch { onError('Não foi possível conectar ao serviço de autenticação.'); }
    finally { setBusy(false); }
  }
  return <section className="login-panel"><div><span className="eyebrow">SEU ESPAÇO, SINCRONIZADO</span><h2>Entre para continuar.</h2><p>Acesse com sua conta configurada no Supabase. Seus trabalhos ficam associados somente a você.</p><p>Sua sessão fica salva neste navegador. Use “Sair da conta” para encerrar o acesso neste dispositivo.</p></div><form onSubmit={login} className="form-stack"><label>E-mail<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Senha<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button button-primary" disabled={busy}>{busy ? 'Entrando…' : 'Entrar no meu espaço'}<Icon name="arrow" size={18} /></button></form></section>;
}

function CanvasModal({ session, health, healthFailed, assignments, onClose }: {
  session: Session | null; health: Health | null; healthFailed: boolean; assignments: Assignment[];
  onClose: () => void;
}) {
  const [courses, setCourses] = useState<Course[]>([]); const [courseId, setCourseId] = useState('');
  const [tasks, setTasks] = useState<CanvasAssignment[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    if (!session || !health?.canvasConfigured) return;
    let active = true; setBusy(true);
    apiRequest<{ courses: Course[] }>('/api/canvas/courses', session).then((data) => { if (active) setCourses(data.courses); }).catch((cause) => { if (active) setError(errorMessage(cause)); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [session, health]);
  async function selectCourse(id: string) {
    setCourseId(id); setTasks([]); setError(''); if (!id) return; setBusy(true);
    try { const data = await apiRequest<{ assignments: CanvasAssignment[] }>(`/api/canvas/assignments?courseId=${encodeURIComponent(id)}`, session); setTasks(data.assignments); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  const connected = Boolean(session && health?.canvasConfigured);
  return <Modal title="Conectar sua rotina ao Canvas" onClose={() => { if (!busy) onClose(); }} wide><div className="form-stack"><p>As atividades aparecem automaticamente em Meus trabalhos. Esta consulta não envia nenhum trabalho.</p><div className="integration-checklist"><span><i className={session ? 'check-dot' : 'pending-dot'} />Conta Supabase {session ? 'conectada' : 'não conectada'}</span><span><i className={health?.canvasConfigured ? 'check-dot' : 'pending-dot'} />Canvas {health?.canvasConfigured ? 'configurado na API' : 'aguardando configuração'}</span><span><i className={health?.submissionsEnabled ? 'check-dot' : 'pending-dot'} />Envios {health?.submissionsEnabled ? 'habilitados com confirmação' : 'desabilitados'}</span></div>{healthFailed && <p className="inline-error">A API não respondeu. Inicie o backend Java e confira a configuração da conexão.</p>}{!connected && <p className="form-help">Configure o Supabase e a URL e credencial do Canvas no servidor. O token do Canvas nunca é solicitado ou armazenado nesta tela.</p>}{error && <p className="inline-error" role="alert">{error}</p>}{connected && <><label>Disciplina no Canvas<select value={courseId} onChange={(event) => void selectCourse(event.target.value)} disabled={busy}><option value="">Selecione uma disciplina</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>{busy && <p role="status">Consultando o Canvas…</p>}{!busy && courses.length === 0 && <p>Nenhuma disciplina ativa foi encontrada para esta conta.</p>}{!busy && courseId && tasks.length === 0 && <p>Nenhuma atividade encontrada nesta disciplina.</p>}<div className="import-list">{tasks.map((task) => {
    const imported = assignments.some((row) => row.canvas_assignment_id === task.id && row.canvas_course_id === task.courseId);
    return <article key={task.id}><div><strong>{task.name}</strong><small>{formatDueDate(task.dueAt)}{task.completionState === 'submitted' ? task.groupAssignment ? ' · entregue em grupo' : ' · entregue no Canvas' : task.completionState === 'graded' ? ' · avaliada sem envio online' : task.completionState === 'excused' ? ' · dispensada' : ' · pendente'}</small></div><small>{imported ? 'No seu organizador' : 'Sincronização automática'}</small></article>;
  })}</div></>}</div></Modal>;
}
