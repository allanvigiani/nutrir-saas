import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { MessageCircle, X, RotateCcw, ArrowLeft, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { appFaqs, landingFaqs, type FaqModule } from '@/lib/support-faqs';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ActiveScreen = 'modules' | 'questions' | 'answer' | 'support' | 'finished';

interface ChatState {
  screen: ActiveScreen;
  selectedModuleId: string | null;
  selectedQuestionIdx: number | null;
  landingName: string | null;
  hasSeenWelcome: boolean;
}

// Fase transitória — não persistida
type Phase = 'typing' | 'name-input' | 'ready';

export interface SupportWidgetProps {
  context: 'app' | 'landing';
  userName?: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const WHATSAPP_URL = 'https://wa.me/5521971856414';
const EMAIL = 'contato.nutrirgestao@gmail.com';
const TYPING_DURATION_MS = 3000;

const DEFAULT_STATE: ChatState = {
  screen: 'modules',
  selectedModuleId: null,
  selectedQuestionIdx: null,
  landingName: null,
  hasSeenWelcome: false,
};

// ─── Helpers de localStorage ──────────────────────────────────────────────────

function storageKey(context: 'app' | 'landing') {
  return context === 'app' ? 'nutrir_support_chat_app' : 'nutrir_support_chat_landing';
}

function loadState(context: 'app' | 'landing'): ChatState {
  try {
    const raw = localStorage.getItem(storageKey(context));
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function persistState(context: 'app' | 'landing', state: ChatState) {
  try {
    localStorage.setItem(storageKey(context), JSON.stringify(state));
  } catch {
    // localStorage indisponível — ignora silenciosamente
  }
}

function clearPersistedState(context: 'app' | 'landing') {
  try {
    localStorage.removeItem(storageKey(context));
  } catch {
    // ignora
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function SupportWidget({ context, userName }: SupportWidgetProps) {
  const faqs = context === 'app' ? appFaqs : landingFaqs;

  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>(() =>
    loadState(context).hasSeenWelcome ? 'ready' : 'typing'
  );
  const [chatState, setChatState] = useState<ChatState>(() => loadState(context));
  const [nameInput, setNameInput] = useState('');
  const [sessionKey, setSessionKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Inicia fluxo quando o painel abre
  useEffect(() => {
    if (!isOpen) return;

    if (chatState.hasSeenWelcome) {
      setPhase('ready');
      return;
    }

    setPhase('typing');
    timerRef.current = setTimeout(() => {
      if (context === 'landing' && !userName) {
        setPhase('name-input');
      } else {
        const next: ChatState = { ...chatState, screen: 'modules', hasSeenWelcome: true };
        setChatState(next);
        persistState(context, next);
        setPhase('ready');
      }
    }, TYPING_DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen, sessionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Foca o input de nome quando aparece
  useEffect(() => {
    if (phase === 'name-input') {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [phase]);

  function navigate(updates: Partial<ChatState>) {
    const next = { ...chatState, ...updates };
    setChatState(next);
    persistState(context, next);
  }

  function handleOpen() {
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
  }

  function handleNewConversation() {
    if (timerRef.current) clearTimeout(timerRef.current);
    clearPersistedState(context);
    setChatState({ ...DEFAULT_STATE });
    setNameInput('');
    setPhase('typing');
    setSessionKey((k) => k + 1);
  }

  function handleNameSubmit() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    const next: ChatState = {
      ...chatState,
      landingName: trimmed,
      screen: 'modules',
      hasSeenWelcome: true,
    };
    setChatState(next);
    persistState(context, next);
    setPhase('ready');
  }

  function handleNameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleNameSubmit();
  }

  function handleResolved() {
    clearPersistedState(context);
    setChatState({ ...DEFAULT_STATE, screen: 'finished', hasSeenWelcome: true });
  }

  const displayName =
    userName || chatState.landingName || (context === 'app' ? 'nutricionista' : 'visitante');

  const selectedModule: FaqModule | undefined = faqs.find(
    (m) => m.id === chatState.selectedModuleId,
  );

  const selectedFaq =
    selectedModule && chatState.selectedQuestionIdx !== null
      ? selectedModule.faqs[chatState.selectedQuestionIdx]
      : null;

  return (
    <>
      {/* FAB */}
      <button
        onClick={handleOpen}
        aria-label="Abrir suporte"
        className={cn(
          'fixed bottom-5 right-5 z-50',
          'flex items-center justify-center',
          'w-[52px] h-[52px] rounded-full',
          'bg-green-600 text-white shadow-lg',
          'hover:bg-green-700 hover:shadow-xl hover:scale-105',
          'transition-all duration-200',
          isOpen && 'opacity-0 pointer-events-none',
        )}
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Painel */}
      <div
        className={cn(
          'fixed bottom-20 right-5 z-50',
          'w-80 max-h-[520px]',
          'flex flex-col',
          'bg-white rounded-2xl shadow-2xl border border-gray-100',
          'transition-all duration-300 origin-bottom-right',
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4 pointer-events-none',
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-green-600 rounded-t-2xl">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20 text-lg select-none">
            🤖
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">Suporte Nutrir</p>
            <p className="text-xs text-white/75">Resposta rápida · Online</p>
          </div>
          <button
            onClick={handleNewConversation}
            aria-label="Nova conversa"
            className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleClose}
            aria-label="Fechar"
            className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo — fase: digitando */}
        {phase === 'typing' && (
          <div className="flex-1 flex items-start gap-2.5 p-4">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-sm flex-shrink-0 mt-0.5">
              🤖
            </div>
            <div className="flex items-center gap-1 bg-slate-100 rounded-tl-sm rounded-r-2xl rounded-bl-2xl px-4 py-3">
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {/* Corpo — fase: input de nome (apenas landing) */}
        {phase === 'name-input' && (
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
            <div className="flex items-start gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-sm flex-shrink-0 mt-0.5">
                🤖
              </div>
              <div className="bg-slate-100 rounded-tl-sm rounded-r-2xl rounded-bl-2xl px-3.5 py-2.5 text-sm text-gray-800 leading-relaxed">
                Olá! 👋 Antes de começar, qual é o seu nome?
              </div>
            </div>
            <div className="flex gap-2">
              <input
                ref={nameInputRef}
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={handleNameKeyDown}
                placeholder="Seu nome..."
                maxLength={50}
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                onClick={handleNameSubmit}
                disabled={!nameInput.trim()}
                className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Enviar
              </button>
            </div>
          </div>
        )}

        {/* Corpo — fase: ready */}
        {phase === 'ready' && (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Mensagem de boas-vindas (sempre visível quando ready) */}
            <div className="flex items-start gap-2.5 px-4 pt-4 pb-2 flex-shrink-0">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-sm flex-shrink-0 mt-0.5">
                🤖
              </div>
              <div className="bg-slate-100 rounded-tl-sm rounded-r-2xl rounded-bl-2xl px-3.5 py-2.5 text-sm text-gray-800 leading-relaxed">
                Olá, <strong>{displayName}</strong>! 👋 Bem-vindo ao suporte do Nutrir. Como posso te ajudar hoje?
              </div>
            </div>

            {/* Tela: Módulos */}
            {chatState.screen === 'modules' && (
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
                  Escolha um tema:
                </p>
                <div className="flex flex-col gap-1.5">
                  {faqs.map((mod) => (
                    <button
                      key={mod.id}
                      onClick={() => navigate({ screen: 'questions', selectedModuleId: mod.id })}
                      className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl border border-green-200 bg-green-50 text-green-800 text-sm font-medium hover:bg-green-100 hover:border-green-300 transition-colors"
                    >
                      <span className="text-base">{mod.emoji}</span>
                      {mod.label}
                    </button>
                  ))}
                  <button
                    onClick={() => navigate({ screen: 'support' })}
                    className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 text-sm font-medium hover:bg-orange-100 hover:border-orange-300 transition-colors"
                  >
                    <span className="text-base">🙋</span>
                    Falar com suporte
                  </button>
                </div>
              </div>
            )}

            {/* Tela: Perguntas do módulo */}
            {chatState.screen === 'questions' && selectedModule && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <button
                  onClick={() => navigate({ screen: 'modules', selectedModuleId: null })}
                  className="flex items-center gap-1 px-4 py-2 text-xs text-green-700 font-medium hover:text-green-800 border-b border-gray-100 flex-shrink-0"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Voltar
                </button>
                <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
                  <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
                    {selectedModule.emoji} {selectedModule.label}:
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {selectedModule.faqs.map((faq, idx) => (
                      <button
                        key={idx}
                        onClick={() => navigate({ screen: 'answer', selectedQuestionIdx: idx })}
                        className="w-full text-left px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm hover:bg-gray-50 hover:border-gray-300 transition-colors"
                      >
                        {faq.question}
                      </button>
                    ))}
                    <button
                      onClick={() => navigate({ screen: 'support' })}
                      className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 text-sm font-medium hover:bg-orange-100 transition-colors"
                    >
                      <span className="text-base">🙋</span>
                      Nenhuma dessas — falar com suporte
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tela: Resposta */}
            {chatState.screen === 'answer' && selectedFaq && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <button
                  onClick={() => navigate({ screen: 'questions', selectedQuestionIdx: null })}
                  className="flex items-center gap-1 px-4 py-2 text-xs text-green-700 font-medium hover:text-green-800 border-b border-gray-100 flex-shrink-0"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Voltar
                </button>
                <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
                  <div className="flex items-start gap-2.5">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-sm flex-shrink-0 mt-0.5">
                      🤖
                    </div>
                    <div className="bg-green-50 border border-green-100 rounded-tl-sm rounded-r-2xl rounded-bl-2xl px-3.5 py-2.5 text-sm text-gray-800 leading-relaxed">
                      <p className="font-medium text-gray-900 mb-1.5">{selectedFaq.question}</p>
                      <p>{selectedFaq.answer}</p>
                    </div>
                  </div>
                  <div className="mt-4 ml-9">
                    <p className="text-xs text-gray-400 mb-2">Isso resolveu sua dúvida?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleResolved}
                        className="flex-1 py-2 rounded-xl border border-green-200 bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors"
                      >
                        ✅ Sim!
                      </button>
                      <button
                        onClick={() => navigate({ screen: 'support' })}
                        className="flex-1 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors"
                      >
                        ❌ Não
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tela: Suporte personalizado */}
            {chatState.screen === 'support' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <button
                  onClick={() => navigate({ screen: 'modules', selectedModuleId: null, selectedQuestionIdx: null })}
                  className="flex items-center gap-1 px-4 py-2 text-xs text-green-700 font-medium hover:text-green-800 border-b border-gray-100 flex-shrink-0"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Voltar
                </button>
                <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
                  <div className="flex items-start gap-2.5 mb-4">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-sm flex-shrink-0 mt-0.5">
                      🤖
                    </div>
                    <div className="bg-slate-100 rounded-tl-sm rounded-r-2xl rounded-bl-2xl px-3.5 py-2.5 text-sm text-gray-800 leading-relaxed">
                      Nossa equipe está pronta para te ajudar com questões mais específicas! 😊
                    </div>
                  </div>
                  <div className="flex flex-col gap-2.5 ml-9">
                    <a
                      href={WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 bg-[#25d366] rounded-xl hover:opacity-90 transition-opacity"
                    >
                      <span className="text-xl">📱</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">WhatsApp</p>
                        <p className="text-xs text-white/80">+55 21 97185-6414</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-white/70 flex-shrink-0" />
                    </a>
                    <a
                      href={`mailto:${EMAIL}`}
                      className="flex items-center gap-3 px-4 py-3 bg-white border border-green-200 rounded-xl hover:bg-green-50 transition-colors"
                    >
                      <span className="text-xl">✉️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-green-700">E-mail</p>
                        <p className="text-xs text-gray-500 truncate">{EMAIL}</p>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Tela: Conversa finalizada */}
            {chatState.screen === 'finished' && (
              <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-2xl">
                  🎉
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-900 mb-1">
                    Fico feliz em ter ajudado!
                  </p>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Se precisar de mais alguma coisa, estamos sempre por aqui. Bons atendimentos! 🌱
                  </p>
                </div>
                <button
                  onClick={() => navigate({ screen: 'modules', selectedModuleId: null, selectedQuestionIdx: null })}
                  className="text-xs text-green-600 hover:text-green-700 underline underline-offset-2 transition-colors"
                >
                  Tenho outra dúvida
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </>
  );
}
