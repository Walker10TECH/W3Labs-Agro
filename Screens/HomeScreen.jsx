import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Droplets,
    Wind,
    CloudRain,
    LogOut,
    Bot,
    ArrowLeft,
    Settings,
    Trash2,
    X,
    Paperclip,
    Send,
    MessageSquare,
    Zap,
    TrendingUp,
    Archive,
    Gauge,
    MapPin,
    SprayCan,
    Sprout,
    Wheat,
    Wrench,
    Fuel,
    Warehouse,
    Percent,
    Sliders,
    BookOpen,
    Compass,
    Map
} from 'lucide-react-native';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { auth, db, signOut } from '../firebaseConfig';
import FarmMapModal from '../components/FarmMapModal';
import { getCurrentPosition, reverseGeocodeOSM, fetchOpenMeteoWeather } from '../services/locationService';

const CONFIG = {
    GROQ_API_KEY: process.env.EXPO_PUBLIC_GROQ_API_KEY || '',
    WEATHER_API_KEY: process.env.EXPO_PUBLIC_WEATHER_API_KEY || '',
    MAX_TOOL_LOOPS: 5,
};

const MODES = {
    WELCOME: 'welcome',
    OPTIONS: 'options',
    AI: 'ai',
};

const APPROVED_MODELS = [
    {
        id: 'openai/gpt-oss-120b',
        name: 'W3Labs Web Search (Compound)',
        desc: 'Acesso à internet em tempo real via Groq. Respostas mais completas.',
        provider: 'groq'
    },
];

class GroqService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.groq.com/openai/v1/chat/completions';
    }

    async chat(payload) {
        if (!this.apiKey) throw new Error("Chave da API do Groq (GROQ_API_KEY) não está configurada.");
        try {
            const response = await fetch(this.baseURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Erro ${response.status}: Falha ao contatar GroqCloud`);
            }
            return await response.json();
        } catch (error) {
            console.error('Groq Service Error:', error);
            throw error;
        }
    }
}

const groqService = new GroqService(CONFIG.GROQ_API_KEY);

const TOOLS_DEFINITION = [
    {
        type: 'function',
        function: {
            name: 'get_farm_data',
            description: 'Busca registros técnicos internos da fazenda no banco de dados (Firebase).',
            parameters: {
                type: 'object',
                required: ['topic'],
                properties: {
                    topic: {
                        type: 'string',
                        description: 'Setor para consulta.',
                        enum: ['colheitas', 'diesel', 'plantios', 'pulverizacoes', 'pluviometro', 'estoqueGeral', 'inventario', 'revisoes']
                    },
                },
            },
        },
    },
];

const TOOLS_IMPLEMENTATION = {
    get_farm_data: async ({ topic }) => {
        const userUid = auth?.currentUser?.uid;
        if (!userUid) return JSON.stringify({ error: "Usuário não autenticado." });
        const schemaMap = {
            colheitas: { orderBy: 'dataColheita' },
            diesel: { orderBy: 'data' },
            plantios: { orderBy: 'dataPlantio' },
            pulverizacoes: { orderBy: 'dataAplicacao' },
            pluviometro: { orderBy: 'dataMedicao' },
            estoqueGeral: { orderBy: null },
            inventario: { orderBy: 'dataAquisicao' },
            revisoes: { orderBy: 'dataRevisao' },
        };
        if (!schemaMap[topic]) return JSON.stringify({ error: `Tópico '${topic}' inválido.` });
        try {
            const config = schemaMap[topic];
            const colRef = collection(db, 'users', userUid, topic);
            let q = config.orderBy ? query(colRef, orderBy(config.orderBy, 'desc'), limit(5)) : query(colRef, limit(5));
            const snapshot = await getDocs(q);
            if (snapshot.empty) return JSON.stringify({ info: `Sem dados para: ${topic}` });
            const data = snapshot.docs.map(doc => {
                const raw = doc.data();
                const normalized = {};
                Object.keys(raw).forEach(key => {
                    if (raw[key]?.toDate) {
                        normalized[key] = raw[key].toDate().toISOString().split('T')[0];
                    } else {
                        normalized[key] = raw[key];
                    }
                });
                return normalized;
            });
            return JSON.stringify(data);
        } catch (e) {
            return JSON.stringify({ error: `Erro DB: ${e.message}` });
        }
    },
};

const SimpleMarkdown = ({ text, isSystem }) => {
    const formatText = (content) => {
        if (!content) return "";
        let html = content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-emerald-400">$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em class="italic text-slate-300">$1</em>');
        html = html.replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-300">$1</code>');
        html = html.replace(/\n/g, '<br/>');
        return html;
    };
    return (
        <span 
            className={`leading-relaxed ${
                isSystem 
                    ? 'text-[11px] italic text-slate-400' 
                    : 'text-[13px] text-slate-100'
            }`}
            dangerouslySetInnerHTML={{ __html: formatText(text) }} 
        />
    );
};

const SettingsModal = ({ visible, onClose, currentModel, onSelectModel, location, onRequestLocation, locationLoading }) => {
    if (!visible) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-modal flex flex-col max-h-[90vh]" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1a2744 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                            <Settings size={16} className="text-white" />
                        </div>
                        <span className="font-bold text-base text-white">Configurações da IA</span>
                    </div>
                    <button className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                    <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Motor de Inferência</div>
                        {APPROVED_MODELS.map((model) => (
                            <button 
                                key={model.id} 
                                className="w-full p-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer"
                                style={{
                                    background: currentModel === model.id ? 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.1))' : 'rgba(255,255,255,0.04)',
                                    border: currentModel === model.id ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.07)',
                                }}
                                onClick={() => onSelectModel(model.id)}
                            >
                                <div className="flex-1 pr-3">
                                    <div className={`font-bold text-sm ${currentModel === model.id ? 'text-emerald-400' : 'text-slate-200'}`}>{model.name}</div>
                                    <div className="text-xs text-slate-500 mt-1">{model.desc}</div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${currentModel === model.id ? 'border-emerald-500' : 'border-slate-600'}`}>
                                    {currentModel === model.id && <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />}
                                </div>
                            </button>
                        ))}
                    </div>

                    <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Localização GPS</div>
                        <button 
                            className="w-full p-4 rounded-xl flex items-center gap-3 transition-all text-left cursor-pointer"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                            onClick={onRequestLocation} 
                            disabled={locationLoading}
                        >
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                                <MapPin size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-slate-200">Localização Atual</div>
                                <div className="text-xs text-slate-500 truncate mt-0.5">
                                    {locationLoading ? 'Buscando sinal GPS...' : location ? `${location.city || 'N/A'}, ${location.region || 'N/A'} — ${location.country || 'BR'}` : 'Toque para obter localização'}
                                </div>
                            </div>
                            {locationLoading 
                                ? <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                : <div className="text-emerald-400 opacity-60"><MapPin size={14} /></div>
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const WelcomeView = React.memo(({ onModeChange }) => (
    <div className="flex-1 flex flex-col justify-center items-center p-8 text-center animate-fadeIn">
        {/* Logo animado */}
        <div className="relative mb-6">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl" style={{ background: 'linear-gradient(135deg,#10b981 0%,#065f46 100%)' }}>
                <Bot size={48} className="text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 border-2 border-[#0f172a] flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white animate-ping" />
            </div>
        </div>

        <h3 className="text-2xl font-black text-white tracking-tight">AgronomIA</h3>
        <p className="text-sm text-slate-400 mt-1.5 max-w-[220px] leading-relaxed">Assistente agrícola inteligente · Groq Engine</p>

        <div className="w-full mt-8 space-y-2.5">
            <button 
                className="w-full p-4 rounded-2xl flex items-center gap-4 text-left transition-all group cursor-pointer"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
                onClick={() => onModeChange(MODES.AI)}
            >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/30 transition-colors">
                    <MessageSquare size={20} />
                </div>
                <div className="flex-1 text-left">
                    <div className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">Fazer uma pergunta</div>
                    <div className="text-xs text-slate-500 mt-0.5">Chat livre com a IA</div>
                </div>
                <div className="text-slate-600"><Zap size={16} /></div>
            </button>
            <button 
                className="w-full p-4 rounded-2xl flex items-center gap-4 text-left transition-all group cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                onClick={() => onModeChange(MODES.OPTIONS)}
            >
                <div className="w-10 h-10 rounded-xl bg-white/10 text-slate-300 flex items-center justify-center flex-shrink-0 group-hover:bg-white/20 transition-colors">
                    <TrendingUp size={20} />
                </div>
                <div className="flex-1 text-left">
                    <div className="text-sm font-bold text-white group-hover:text-slate-200 transition-colors">Consultas rápidas</div>
                    <div className="text-xs text-slate-500 mt-0.5">Cotações, relatórios e análises</div>
                </div>
                <div className="text-slate-600"><Zap size={16} /></div>
            </button>
        </div>
    </div>
));

const OptionsView = React.memo(({ onOptionSelect }) => {
    const analysisOptions = [
        { label: 'Cotação Soja', desc: 'Preço hoje', query: 'Qual a cotação da soja hoje?', icon: TrendingUp, color: '#10b981' },
        { label: 'Histórico Chuva', desc: 'Pluviometria', query: 'Relatório do meu histórico de chuva', icon: CloudRain, color: '#3b82f6' },
        { label: 'Estoque', desc: 'Análise geral', query: 'Análise do meu estoque geral', icon: Archive, color: '#f59e0b' },
        { label: 'Diesel', desc: 'Consumo', query: 'Análise do consumo de diesel', icon: Gauge, color: '#ef4444' },
    ];
    return (
        <div className="p-5 overflow-y-auto animate-fadeIn flex-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4">Consultas Prontas</div>
            <div className="grid grid-cols-2 gap-3">
                {analysisOptions.map(item => (
                    <button 
                        key={item.label} 
                        className="p-4 rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer hover:scale-[1.03] active:scale-95"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                        onClick={() => onOptionSelect(item.query)}
                    >
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-lg" style={{ background: `${item.color}22`, border: `1px solid ${item.color}44` }}>
                            <item.icon size={24} style={{ color: item.color }} />
                        </div>
                        <span className="text-xs font-bold text-white">{item.label}</span>
                        <span className="text-[11px] text-slate-500 mt-0.5">{item.desc}</span>
                    </button>
                ))}
            </div>
        </div>
    );
});

const AgronomiaChatbot = ({ onClose }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeModel, setActiveModel] = useState(APPROVED_MODELS[0].id);
    const [attachedFile, setAttachedFile] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [location, setLocation] = useState(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [chatMode, setChatMode] = useState(MODES.WELCOME);
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (chatMode === MODES.AI) {
            scrollToBottom();
        }
    }, [messages, chatMode]);

    const requestLocation = useCallback(async () => {
        setLocationLoading(true);
        try {
            const pos = await getCurrentPosition();
            const addr = await reverseGeocodeOSM(pos.latitude, pos.longitude);
            setLocation({
                city: addr.city || 'Local Desconhecido',
                region: addr.state || '',
                country: addr.country || 'Brasil',
                latitude: pos.latitude,
                longitude: pos.longitude
            });
        } catch (error) {
            console.warn("GPS/Geocoding OSM Info:", error?.message);
        } finally {
            setLocationLoading(false);
        }
    }, []);

    useEffect(() => {
        requestLocation();
    }, [requestLocation]);

    const systemPrompt = useMemo(() => `
        Você é a AgronomIA, Especialista Sênior da W3Labs.
        Localização do Usuário: ${location ? `${location.city}, ${location.country}` : 'Não disponível'}.
        
        Diretrizes:
        1. Seja breve, técnico e direto.
        2. Use as FERRAMENTAS disponíveis para consultar dados da conta do usuário.
        3. Formate suas respostas usando Markdown limpo.
    `, [location]);

    const handleSend = useCallback(async (manualQuery = null) => {
        const text = (manualQuery || inputText).trim();
        if (loading || (!text && !attachedFile)) return;

        if (manualQuery) setChatMode(MODES.AI);

        const userMsg = { id: Date.now().toString(), role: 'user', sender: 'user', text: text, fileData: attachedFile };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInputText('');
        setAttachedFile(null);
        setLoading(true);

        try {
            const botId = Date.now() + '_bot';
            setMessages(prev => [...prev, { id: botId, role: 'assistant', sender: 'bot', text: '' }]);

            let apiMessages = [
                { role: 'system', content: systemPrompt },
                ...newHistory.map(m => ({
                    role: m.role,
                    content: m.text,
                    ...(m.tool_calls && { tool_calls: m.tool_calls }),
                    ...(m.tool_call_id && { tool_call_id: m.tool_call_id, name: m.name })
                }))
            ];

            let keepGenerating = true;
            let loopCount = 0;
            let currentText = '';

            while (keepGenerating && loopCount < CONFIG.MAX_TOOL_LOOPS) {
                loopCount++;
                const response = await groqService.chat({
                    model: activeModel, messages: apiMessages, tools: TOOLS_DEFINITION, tool_choice: 'auto', temperature: 0.3
                });
                const choice = response.choices[0];
                const msg = choice.message;

                if (msg.executed_tools && msg.executed_tools.length > 0) {
                    setMessages(prev => [...prev, { id: Date.now() + '_sys_web_' + Math.random(), role: 'system', sender: 'system', text: `🌐 Fontes consultadas na web com sucesso.` }]);
                }

                if (msg.content) {
                    currentText += msg.content;
                    setMessages(prev => prev.map(m => m.id === botId ? {
                        ...m, text: currentText, usage: { duration: response.usage.total_time?.toFixed(2) || 0, tokens: response.usage.total_tokens }
                    } : m));
                }

                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    apiMessages.push(msg);
                    for (const call of msg.tool_calls) {
                        const fnName = call.function.name;
                        const fnArgs = JSON.parse(call.function.arguments);

                        setMessages(prev => [...prev, { id: Date.now() + '_sys_' + Math.random(), role: 'system', sender: 'system', text: `⚙️ Consultando banco da fazenda: ${fnName}...` }]);

                        let result = JSON.stringify({ error: "Ferramenta falhou ou não implementada" });
                        if (TOOLS_IMPLEMENTATION[fnName]) result = await TOOLS_IMPLEMENTATION[fnName](fnArgs);

                        apiMessages.push({ role: 'tool', tool_call_id: call.id, name: fnName, content: result });
                    }
                } else {
                    keepGenerating = false;
                }
            }
        } catch (error) {
            console.error("Erro AgronomIA:", error);
            setMessages(prev => [...prev, { id: Date.now() + '_err', role: 'assistant', sender: 'bot', text: `⚠️ **Erro de Comunicação**\nNão foi possível processar via GroqCloud.\n${error.message}`, isError: true }]);
        } finally {
            setLoading(false);
        }
    }, [inputText, attachedFile, loading, messages, activeModel, systemPrompt]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) setAttachedFile(file);
    };

    const handleClearChat = () => {
        setMessages([]);
        setChatMode(MODES.WELCOME);
    };

    return (
        <div
            className="w-full sm:max-w-[420px] flex flex-col overflow-hidden animate-modal"
            style={{
                height: 'min(680px, 90vh)',
                background: 'linear-gradient(160deg, #0f172a 0%, #0d1f3c 50%, #0a1628 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '1.75rem',
                boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(16,185,129,0.12)',
            }}
        >
            {/* Header premium */}
            <div className="flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {chatMode !== MODES.WELCOME && (
                            <button
                                onClick={() => setChatMode(MODES.WELCOME)}
                                className="w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
                            >
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <div className="flex items-center gap-2.5">
                            <div className="relative">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                                    <Bot size={20} className="text-white" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2" style={{ borderColor: '#0f172a' }} />
                            </div>
                            <div>
                                <div className="font-black text-sm text-white tracking-wide">AgronomIA</div>
                                <div className="text-[11px] text-slate-500">
                                    {location ? `📍 ${location.city}` : 'W3Labs · Groq Engine'}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowSettings(true)}
                            className="w-8 h-8 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
                            title="Configurações"
                        >
                            <Settings size={17} />
                        </button>
                        {messages.length > 0 && chatMode === MODES.AI && (
                            <button
                                onClick={handleClearChat}
                                className="w-8 h-8 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center transition-all cursor-pointer"
                                title="Limpar Conversa"
                            >
                                <Trash2 size={17} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
                            title="Fechar"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {chatMode === MODES.WELCOME && <WelcomeView onModeChange={setChatMode} />}
                {chatMode === MODES.OPTIONS && <OptionsView onOptionSelect={(q) => handleSend(q)} />}

                {chatMode === MODES.AI && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
                            {messages.map((item) => (
                                <div
                                    key={item.id}
                                    className={`flex ${
                                        item.sender === 'user' ? 'justify-end' :
                                        item.sender === 'system' ? 'justify-center' : 'justify-start'
                                    }`}
                                >
                                    <div
                                        className={`${
                                            item.sender === 'user'
                                                ? 'max-w-[82%] px-4 py-3 rounded-2xl rounded-br-md'
                                                : item.sender === 'system'
                                                ? 'px-4 py-1.5 rounded-full text-center'
                                                : 'max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-md'
                                        }`}
                                        style={{
                                            background: item.sender === 'user'
                                                ? 'linear-gradient(135deg,#10b981,#059669)'
                                                : item.sender === 'system'
                                                ? 'rgba(255,255,255,0.05)'
                                                : 'rgba(255,255,255,0.07)',
                                            border: item.sender === 'system' ? '1px solid rgba(255,255,255,0.07)' :
                                                    item.sender !== 'user' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                                            boxShadow: item.sender === 'user' ? '0 4px 16px rgba(16,185,129,0.3)' : 'none',
                                        }}
                                    >
                                        {item.fileData && (
                                            <div className="flex items-center gap-1.5 mb-2 pb-2 text-xs font-medium text-white/60" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                <Paperclip size={14} />
                                                <span className="truncate">{item.fileData.name}</span>
                                            </div>
                                        )}
                                        <SimpleMarkdown text={item.text || ' '} isSystem={item.sender === 'system'} />
                                        {item.usage && (
                                            <div className="text-[10px] text-slate-600 mt-2 text-right">
                                                ⚡ {item.usage.duration}s · {item.usage.tokens} tokens
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="px-4 py-3 rounded-2xl rounded-bl-md" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input Footer */}
                        <div className="flex-shrink-0 p-3 flex items-end gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                                    attachedFile ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300 hover:bg-white/10'
                                }`}
                                title="Anexar Arquivo"
                            >
                                <Paperclip size={20} />
                            </button>
                            <textarea
                                className="flex-1 rounded-2xl px-4 py-2.5 text-sm resize-none focus:outline-none"
                                style={{
                                    background: 'rgba(255,255,255,0.07)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: '#f1f5f9',
                                    minHeight: '42px',
                                    maxHeight: '96px',
                                }}
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder={attachedFile ? `📎 ${attachedFile.name}` : 'Pergunte à AgronomIA...'}
                                disabled={loading}
                                rows={1}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={loading || (!inputText.trim() && !attachedFile)}
                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all cursor-pointer disabled:opacity-40"
                                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Send size={17} className="text-white" />
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <SettingsModal
                visible={showSettings}
                onClose={() => setShowSettings(false)}
                currentModel={activeModel}
                location={location}
                locationLoading={locationLoading}
                onRequestLocation={requestLocation}
                onSelectModel={(m) => { setActiveModel(m); setShowSettings(false); }}
            />
        </div>
    );
};

export default function Dashboard({ navigation }) {
    const [weather, setWeather] = useState({ temp: '--', desc: 'Buscando clima...', humidity: '--', wind: '--', rain: '--' });
    const [location, setLocation] = useState(null);
    const [isChatbotOpen, setIsChatbotOpen] = useState(false);
    const [showFarmMap, setShowFarmMap] = useState(false);
    const [talhoesList, setTalhoesList] = useState([]);
    const userName = auth.currentUser?.displayName || "Produtor";

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
            window.alert("Não foi possível sair. Tente novamente.");
        }
    };

    // Carrega talhões para o visualizador de mapas
    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        (async () => {
            try {
                const snap = await getDocs(query(collection(db, 'users', uid, 'talhoes'), orderBy('nome', 'asc')));
                setTalhoesList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) {
                console.error("Erro ao carregar talhões no dashboard:", e);
            }
        })();
    }, []);

    // Busca Clima e Localização via Open-Source APIs (OpenStreetMap + Open-Meteo)
    useEffect(() => {
        (async () => {
            try {
                const pos = await getCurrentPosition();
                
                // Geocodificação OpenStreetMap Nominatim
                const addr = await reverseGeocodeOSM(pos.latitude, pos.longitude);
                if (addr?.city) {
                    setLocation({
                        city: addr.city,
                        region: addr.state || addr.country
                    });
                }

                // Clima em tempo real Open-Meteo (Open-Source)
                const meteo = await fetchOpenMeteoWeather(pos.latitude, pos.longitude);
                if (meteo) {
                    setWeather({
                        temp: meteo.temp,
                        desc: meteo.desc,
                        humidity: meteo.humidity,
                        wind: meteo.windSpeed,
                        rain: meteo.precipitation
                    });
                }
            } catch (error) {
                console.warn("Clima Open-Meteo / GPS:", error);
                setWeather({ temp: '--', desc: 'Clima da Fazenda', humidity: '--', wind: '--', rain: '--' });
            }
        })();
    }, []);

    const gridItems = [
        { id: 1, title: 'Pulverização', subtitle: 'Aplicações & Calda', icon: SprayCan, screen: 'Pulverizacao', color: 'from-emerald-500 to-green-600' },
        { id: 2, title: 'Plantio', subtitle: 'Variedades & Área', icon: Sprout, screen: 'Plantios', color: 'from-green-600 to-emerald-700' },
        { id: 3, title: 'Colheita', subtitle: 'Produtividade (sc/ha)', icon: Wheat, screen: 'Colheitas', color: 'from-amber-500 to-yellow-600' },
        { id: 4, title: 'Revisões', subtitle: 'Manutenção de Frota', icon: Wrench, screen: 'Revisoes', color: 'from-blue-500 to-indigo-600' },
        { id: 5, title: 'Diesel', subtitle: 'Estoque & Consumo', icon: Fuel, screen: 'Diesel', color: 'from-red-500 to-orange-600' },
        { id: 6, title: 'Estoque', subtitle: 'Insumos & Peças', icon: Warehouse, screen: 'Manager', params: { initialTab: 'estoque' }, color: 'from-teal-500 to-emerald-600' },
        { id: 7, title: 'Pluviômetro', subtitle: 'Histórico de Chuvas', icon: CloudRain, screen: 'Pluviometro', color: 'from-sky-500 to-blue-600' },
        { id: 8, title: '% Andamento', subtitle: 'Etapas da Safra', icon: Percent, screen: 'Andamento', color: 'from-violet-500 to-purple-600' },
        { id: 9, title: 'Gerenciador', subtitle: 'Máquinas & Talhões', icon: Sliders, screen: 'Manager', params: { initialTab: 'talhoes' }, color: 'from-slate-600 to-slate-800' },
        { id: 10, title: 'Manuais', subtitle: 'Documentos & PDFs', icon: BookOpen, screen: 'Manuais', color: 'from-cyan-600 to-teal-700' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col px-4 py-6 sm:px-6 sm:py-8">
                
                {/* Top Header Card */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-green-600 text-white p-6 sm:p-8 shadow-xl shadow-emerald-950/20 mb-8">
                    {/* Background Pattern Elements */}
                    <div className="absolute -right-10 -bottom-10 w-60 h-60 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                    <div className="absolute right-40 -top-10 w-40 h-40 rounded-full bg-emerald-400/20 blur-xl pointer-events-none" />

                    <div className="relative z-10">
                        {/* Top bar */}
                        <div className="flex items-center justify-between pb-6 border-b border-white/15">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Painel Principal</div>
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">Olá, {userName} 👋</h1>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={handleLogout} 
                                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all cursor-pointer flex items-center gap-2 text-sm font-medium"
                                    title="Sair da Conta"
                                >
                                    <LogOut size={18} />
                                    <span className="hidden sm:inline">Sair</span>
                                </button>
                            </div>
                        </div>

                        {/* Weather Widget */}
                        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <span className="text-5xl sm:text-6xl font-black tracking-tight">{weather.temp}°C</span>
                                <div>
                                    <div className="text-base font-semibold capitalize text-white/95">{weather.desc}</div>
                                    <div className="text-xs text-emerald-200 mt-0.5">
                                        {location ? `📍 ${location.city || ''}, ${location.region || ''}` : 'Clima da Fazenda'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap justify-center">
                                {/* Weather Indicators Pill */}
                                <div className="flex items-center gap-3 sm:gap-4 bg-black/20 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
                                    <div className="flex items-center gap-1.5">
                                        <Droplets size={16} className="text-sky-300" />
                                        <span className="text-xs font-bold">{weather.humidity}%</span>
                                    </div>
                                    <div className="w-px h-4 bg-white/20" />
                                    <div className="flex items-center gap-1.5">
                                        <Wind size={14} className="text-emerald-300" />
                                        <span className="text-xs font-bold">{weather.wind} km/h</span>
                                    </div>
                                    <div className="w-px h-4 bg-white/20" />
                                    <div className="flex items-center gap-1.5">
                                        <CloudRain size={14} className="text-blue-300" />
                                        <span className="text-xs font-bold">{weather.rain} mm</span>
                                    </div>
                                </div>

                                {/* Quick Action: Ver Mapa */}
                                <button
                                    type="button"
                                    onClick={() => setShowFarmMap(true)}
                                    className="p-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-white/15 shadow-md"
                                    title="Visualizar Mapa da Fazenda e Talhões"
                                >
                                    <Compass size={16} className="text-emerald-300" />
                                    <span>Ver Mapa</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dashboard Grid Modules */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-800">Módulos da Fazenda</h2>
                        <span className="text-xs font-medium text-slate-500">10 ferramentas disponíveis</span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                        {gridItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => item.screen ? navigation?.navigate?.(item.screen, item.params) : window.alert('Tela em construção.')}
                                className="group relative bg-white hover:bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col items-center text-center cursor-pointer overflow-hidden"
                            >
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} text-white flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform`}>
                                    <item.icon size={22} />
                                </div>
                                <span className="font-bold text-xs sm:text-sm text-slate-800 group-hover:text-emerald-700 transition-colors truncate w-full">
                                    {item.title}
                                </span>
                                <span className="text-[11px] text-slate-500 mt-0.5 truncate w-full">
                                    {item.subtitle}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Floating Action Button (FAB) — AgronomIA */}
                {!isChatbotOpen && (
                    <div className="fixed right-6 bottom-6 z-40 flex flex-col items-end gap-3">
                        {/* Label tooltip */}
                        <div
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-white pointer-events-none"
                            style={{
                                background: 'rgba(15,23,42,0.9)',
                                border: '1px solid rgba(16,185,129,0.25)',
                                backdropFilter: 'blur(12px)',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                            }}
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="tracking-wide">AgronomIA Online</span>
                        </div>

                        {/* FAB Button */}
                        <button
                            onClick={() => setIsChatbotOpen(true)}
                            className="w-16 h-16 rounded-2xl text-white flex items-center justify-center cursor-pointer group transition-all hover:scale-110 active:scale-95"
                            title="Abrir AgronomIA"
                            style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                boxShadow: '0 8px 32px rgba(16,185,129,0.5), 0 0 0 1px rgba(16,185,129,0.2)',
                            }}
                        >
                            <Bot size={32} className="group-hover:rotate-12 transition-transform duration-300" />
                            {/* Ping indicator */}
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center">
                                <span className="w-2 h-2 rounded-full bg-amber-200 animate-ping" />
                            </span>
                        </button>
                    </div>
                )}

                {/* Chatbot Modal — slide-up on mobile, centered on desktop */}
                {isChatbotOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-end sm:items-end sm:justify-end p-0 sm:p-6 animate-fadeIn"
                        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
                        onClick={(e) => { if (e.target === e.currentTarget) setIsChatbotOpen(false); }}
                    >
                        {/* Slide-up on mobile: full-width, partial height; floating on desktop */}
                        <div className="w-full sm:w-auto">
                            <AgronomiaChatbot onClose={() => setIsChatbotOpen(false)} />
                        </div>
                    </div>
                )}

                {/* Farm Map Modal */}
                {showFarmMap && (
                    <FarmMapModal
                        talhoes={talhoesList}
                        onClose={() => setShowFarmMap(false)}
                    />
                )}

            </div>
        </div>
    );
}
