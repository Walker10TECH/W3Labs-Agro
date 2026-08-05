import {
    ArrowUpRight,
    BookOpen,
    Bot,
    Camera,
    Check,
    ChevronDown,
    CloudRain,
    Copy,
    Cpu,
    ExternalLink,
    Eye,
    FileText,
    FlaskConical,
    Globe,
    MapPin,
    Maximize2,
    Mic,
    MicOff,
    Minimize2,
    Navigation,
    Paperclip,
    RefreshCw,
    Send,
    Settings,
    SlidersHorizontal,
    Sparkles,
    Sprout,
    Trash2,
    TrendingUp,
    Volume2,
    VolumeX,
    X,
    Zap
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { prepareFileForVision } from '../services/agroDocumentAIService';
import {
    BRAZILIAN_AGRO_REGIONS,
    buildSearchSettings,
    compressImageFile,
    FARM_TOOLS_DEFINITION,
    FARM_TOOLS_IMPLEMENTATION,
    GROQ_MODELS,
    groqClient,
    SEARCH_SCOPES,
    speakTextNative,
    stopNativeSpeech,
    WEB_SEARCH_PRESETS
} from '../services/groqService';
import { getCurrentPosition, reverseGeocodeOSM } from '../services/locationService';
import PdfViewerModal from './PdfViewerModal';

// Modos visuais do assistente
const CHAT_MODES = {
    WELCOME: 'welcome',
    CHAT: 'chat',
    OPTIONS: 'options',
    CAMERA: 'camera',
};

// Renderizador semântico avançado de Markdown compatível com .agronomia-markdown
const SimpleMarkdown = React.memo(({ text, isSystem }) => {
    const formattedHtml = useMemo(() => {
        if (!text) return '';
        let str = text;

        // Sanitização básica contra scripts
        str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

        // 1. Code blocks (```lang ... ```)
        const codeBlocks = [];
        str = str.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
            const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
            const cleanCode = code
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            const headerLang = lang || 'código';
            codeBlocks.push(
                `<div class="agronomia-code-block"><div class="agronomia-code-header"><span>${headerLang}</span></div><pre><code>${cleanCode}</code></pre></div>`
            );
            return placeholder;
        });

        // 2. Inline code (`code`)
        str = str.replace(/`([^`]+)`/g, '<code>$1</code>');

        // 3. Cabeçalhos (# a ####)
        str = str.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
        str = str.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        str = str.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        str = str.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // 4. Blockquotes (> texto)
        str = str.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

        // 5. Negrito e Itálico
        str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        str = str.replace(/\*(.*?)\*/g, '<em>$1</em>');
        str = str.replace(/_([^_]+)_/g, '<em>$1</em>');

        // 6. Links [texto](url)
        str = str.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        // 7. Divisores horizontais
        str = str.replace(/^(?:---|\*\*\*|___)$/gim, '<hr/>');

        // 8. Tabelas simples em Markdown (| cel | cel |) com wrapper responsivo
        const lines = str.split('\n');
        let inTable = false;
        let tableHtml = '';
        const parsedLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('|') && line.endsWith('|')) {
                const cells = line.split('|').slice(1, -1).map(c => c.trim());
                if (!inTable) {
                    inTable = true;
                    tableHtml = '<div class="agronomia-table-wrapper"><table><thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
                    if (i + 1 < lines.length && lines[i + 1].includes('---')) {
                        i++; // pula linha divisora
                    }
                } else {
                    tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
                }
            } else {
                if (inTable) {
                    tableHtml += '</tbody></table></div>';
                    parsedLines.push(tableHtml);
                    inTable = false;
                    tableHtml = '';
                }
                parsedLines.push(lines[i]);
            }
        }
        if (inTable) {
            tableHtml += '</tbody></table></div>';
            parsedLines.push(tableHtml);
        }
        str = parsedLines.join('\n');

        // 9. Listas com marcadores (- ou *)
        str = str.replace(/^\s*[-*]\s+(.*$)/gim, '<ul><li>$1</li></ul>');
        str = str.replace(/<\/ul>\s*<ul>/g, ''); // Junta tags <ul> adjacentes

        // 10. Listas numeradas (1. 2. )
        str = str.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<ol><li>$1</li></ol>');
        str = str.replace(/<\/ol>\s*<ol>/g, ''); // Junta tags <ol> adjacentes

        // 11. Quebras de linha
        str = str.replace(/\n\n/g, '<p></p>');
        str = str.replace(/\n/g, '<br/>');

        // Restaura blocos de código
        codeBlocks.forEach((block, idx) => {
            str = str.replace(`__CODE_BLOCK_${idx}__`, block);
        });

        return str;
    }, [text]);

    return (
        <div
            className={`agronomia-markdown ${isSystem ? 'opacity-75 italic text-xs' : ''}`}
            dangerouslySetInnerHTML={{ __html: formattedHtml }}
        />
    );
});

export default function AgronomiaChatbot({
    permanent = true,
    initialOpen = false,
    onCloseExternal,
    userName = 'Produtor'
}) {
    // Estados principais
    const [isOpen, setIsOpen] = useState(initialOpen);
    const [isMaximized, setIsMaximized] = useState(false);
    const [chatMode, setChatMode] = useState(CHAT_MODES.WELCOME);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);

    // Configurações de Modelos e Busca Web Regional / Nacional
    const [selectedModelId, setSelectedModelId] = useState('groq/compound');
    const [webSearchEnabled, setWebSearchEnabled] = useState(true);
    const [showSearchRibbon, setShowSearchRibbon] = useState(false); // Oculto por padrão para interface limpa
    const [searchScope, setSearchScope] = useState('nacional'); // 'nacional', 'regional', 'global'
    const [selectedState, setSelectedState] = useState('AUTO'); // 'AUTO' ou UF (ex: 'PR', 'MT', 'RS')
    const [searchPreset, setSearchPreset] = useState('all');
    const [customDomains, setCustomDomains] = useState('');
    const [excludeDomains, setExcludeDomains] = useState('');
    const [showStateDropdown, setShowStateDropdown] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [activeTabCategory, setActiveTabCategory] = useState('groq');

    // Mídias: Imagens e Visão
    const [attachedImages, setAttachedImages] = useState([]); // [{ url, base64, name, rawFile, isPdf }]
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [facingMode, setFacingMode] = useState('environment'); // 'user' ou 'environment'

    // Visualizador de PDF Embutido
    const [pdfViewer, setPdfViewer] = useState({
        visible: false,
        fileSource: null,
        title: '',
        subtitle: '',
        badgeText: 'PDF'
    });

    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [playingMessageId, setPlayingMessageId] = useState(null);
    const [autoSpeak, setAutoSpeak] = useState(false);
    const [copiedMessageId, setCopiedMessageId] = useState(null);

    // Copia texto da mensagem para o clipboard
    const handleCopyMessage = (msgId, text) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            setCopiedMessageId(msgId);
            setTimeout(() => setCopiedMessageId(null), 2000);
        }
    };

    // Localização GPS
    const [location, setLocation] = useState(null);
    const [locationLoading, setLocationLoading] = useState(false);

    // Refs
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const videoRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);

    // Modelo ativo detalhado
    const currentModelInfo = useMemo(() => {
        return GROQ_MODELS.find(m => m.id === selectedModelId) || GROQ_MODELS[0];
    }, [selectedModelId]);

    // Rola para a última mensagem
    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }, []);

    useEffect(() => {
        if (isOpen && chatMode === CHAT_MODES.CHAT) {
            scrollToBottom();
        }
    }, [messages, isOpen, chatMode, scrollToBottom]);

    // Carrega localização GPS do usuário
    const fetchLocation = useCallback(async () => {
        setLocationLoading(true);
        try {
            const pos = await getCurrentPosition();
            const addr = await reverseGeocodeOSM(pos.latitude, pos.longitude);
            setLocation({
                city: addr.city || 'Região Agrícola',
                region: addr.state || '',
                country: addr.country || 'Brasil',
                latitude: pos.latitude,
                longitude: pos.longitude
            });
        } catch (err) {
            console.warn("GPS/Geocoding AgronomIA:", err?.message);
        } finally {
            setLocationLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLocation();
    }, [fetchLocation]);

    // Prompt de Sistema dinâmico com contextualização Regional e Nacional
    const systemPrompt = useMemo(() => {
        let regionalContext = '';
        if (searchScope === 'regional') {
            let effectiveUf = selectedState;
            if (effectiveUf === 'AUTO' && location?.region) {
                const found = Object.entries(BRAZILIAN_AGRO_REGIONS).find(([uf, data]) =>
                    location.region.toLowerCase().includes(data.name.toLowerCase()) ||
                    location.region.toUpperCase().includes(uf)
                );
                if (found) effectiveUf = found[0];
            }
            if (effectiveUf === 'AUTO') effectiveUf = 'PR'; // Padrão Brasil Sul/Centro
            const regionData = BRAZILIAN_AGRO_REGIONS[effectiveUf] || BRAZILIAN_AGRO_REGIONS['PR'];
            regionalContext = `
ESCOPO DE PESQUISA & ATUAÇÃO ATIVO: 📍 REGIONAL (${regionData.name} - ${regionData.uf})
- Principais Órgãos e Institutos Locais: ${regionData.institutes}
- Polos Agrícolas e Macrorregiões: ${regionData.hubs}
- Diretriz: Ao responder e pesquisar dados do agro, priorize o contexto, cotações de balcão/disponível, vazio sanitário e informativos técnicos do Estado de ${regionData.name} (${regionData.uf}).`;
        } else if (searchScope === 'nacional') {
            regionalContext = `
ESCOPO DE PESQUISA & ATUAÇÃO ATIVO: 🇧🇷 NACIONAL (Brasil Geral)
- Órgãos e Fontes de Referência: CEPEA/ESALQ, B3 Agro, CONAB (Acompanhamento da Safra), MAPA, Embrapa e portais nacionais do agronegócio.
- Diretriz: Priorize cotações e indicadores médios nacionais, relatórios consolidados de safra e normas federais brasileiras.`;
        } else {
            regionalContext = `
ESCOPO DE PESQUISA & ATUAÇÃO ATIVO: 🌐 GLOBAL (Internacional)
- Fontes de Referência: Bolsa de Chicago (CBOT), Relatórios WASDE/USDA, Mercados Internacionais de Grãos, Fertilizantes e Câmbio.`;
        }

        return `
Você é a **AgronomIA**, a inteligência artificial especialista da W3Labs em agronegócio, maquinários agrícolas, defensivos, colheita e gestão de fazendas de alta performance.
Usuário atual: ${userName}.
Localização da Fazenda: ${location ? `${location.city}, ${location.region} - ${location.country}` : 'Brasil'}.
${regionalContext}

SEUS SUPERPODERES E FERRAMENTAS DO BANCO DE DADOS (FARM TOOLS):
Você tem acesso direto de LEITURA e ESCRITA ao banco de dados oficial da fazenda através de chamadas de função (Function Calling):
1. **🌧️ Pluviômetro / Medições de Chuva**:
   - Para registrar chuva: execute \`add_pluviometro\` informando os milímetros (ex: 35.5), data e talhão/local.
   - Para consultar: execute \`get_farm_data\` com topic="pluviometro".
2. **🚜 Manuais de Máquinas e Implementos**:
   - Para cadastrar manuais: execute \`add_manual\` com título, categoria, marca, modelo e especificações técnicas extraídas (torques, calibrações, intervalos de troca de óleo e filtros).
   - Para consultar: execute \`get_farm_data\` com topic="manuais".
3. **📄 Romaneios de Carga e Tickets de Pesagem**:
   - Para registrar colheita/romaneio: execute \`add_romaneio\` com cultura, peso em kg, sacas, umidade, impureza, placa, talhão e armazém de destino.
   - Para consultar: execute \`get_farm_data\` com topic="colheitas".
4. **🧪 Bulas e Rótulos de Defensivos / Insumos**:
   - Para cadastrar produto no estoque a partir de bula/rótulo: execute \`add_defensivo_bula\` com nome, princípio ativo, dosagem recomendada, carência em dias e alvos.
   - Para consultar: execute \`get_farm_data\` com topic="estoqueGeral".
5. **⛽ Diesel e Abastecimentos**:
   - Para registrar abastecimento: execute \`add_diesel_abastecimento\` com veículo, litros, horímetro e data.
   - Para consultar: execute \`get_farm_data\` com topic="diesel".
6. **🔧 Revisões e Manutenções Preventivas**:
   - Para cadastrar manutenção: execute \`add_revisao_maquina\` com máquina, tipo de revisão, horímetro e descrição.
   - Para consultar: execute \`get_farm_data\` com topic="revisoes".
7. **🌱 Pulverizações e Aplicações em Talhão**:
   - Para registrar aplicação: execute \`add_pulverizacao\` com talhão, produto, dose/ha e área.
   - Para consultar: execute \`get_farm_data\` com topic="pulverizacoes".

DIRETRIZES DE ATENDIMENTO:
- Quando o produtor enviar uma foto ou PDF (de manual de máquina, romaneio de grãos, bula de defensivo, foto de pluviômetro ou anotação de chuva) ou solicitar qualquer cadastro, analise detalhadamente com visão computacional, execute a ferramenta de gravação correspondente e apresente uma confirmação elegante com os dados cadastrados em formato Markdown organizado com tabelas ou tópicos.
- Seja sempre altamente técnico, prático, encorajador e preciso nas recomendações agronômicas e de engenharia agrícola.
- Ao pesquisar na internet (Web Search), integre as informações mais recentes do mercado e clima com fontes confiáveis e cite o contexto regional ou nacional apropriado.
`;
    }, [userName, location, searchScope, selectedState]);

    // ==========================================
    // FLUXO DE ENVIO DE MENSAGENS E INFERÊNCIA
    // ==========================================
    const handleSendMessage = useCallback(async (textOverride = null) => {
        const text = (textOverride !== null ? textOverride : inputText).trim();
        if (loading || (!text && attachedImages.length === 0)) return;

        setChatMode(CHAT_MODES.CHAT);
        setInputText('');

        const userImages = [...attachedImages];
        setAttachedImages([]);

        const userMsg = {
            id: Date.now().toString(),
            role: 'user',
            sender: 'user',
            text: text,
            images: userImages,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setLoading(true);

        const botMsgId = Date.now() + '_bot';
        setMessages(prev => [
            ...prev,
            {
                id: botMsgId,
                role: 'assistant',
                sender: 'bot',
                text: '',
                reasoning: '',
                sources: [],
                visitedPages: [],
                modelUsed: selectedModelId,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
        ]);

        try {
            // Se houver imagens anexadas e o modelo atual não for de visão, alterna automaticamente para o motor multimodal ativo
            let effectiveModel = selectedModelId;
            if (userImages.length > 0 && !currentModelInfo.supportsVision) {
                effectiveModel = 'qwen/qwen3.6-27b';
            }

            // Constrói payload dinâmico e inteligente de busca web regional / nacional
            let searchSettings = undefined;
            if (webSearchEnabled && currentModelInfo.supportsWebSearch) {
                searchSettings = buildSearchSettings({
                    scope: searchScope,
                    selectedState,
                    preset: searchPreset,
                    customDomains,
                    excludeDomains,
                    location
                });
            }

            // Formatação de mensagens da API mantendo o histórico enxuto
            // Limita aos últimos 4 turnos (2 pares user/bot) para evitar 413 payload too large
            const recentHistory = newHistory.slice(-4);
            let lastImageIndex = -1;
            for (let i = recentHistory.length - 1; i >= 0; i--) {
                if (recentHistory[i].images && recentHistory[i].images.length > 0) {
                    lastImageIndex = i;
                    break;
                }
            }

            let apiMessages = [
                { role: 'system', content: systemPrompt }
            ];

            for (let idx = 0; idx < recentHistory.length; idx++) {
                const m = recentHistory[idx];
                if (m.images && m.images.length > 0) {
                    if (idx === lastImageIndex) {
                        // Envia a imagem do turno atual ultra-comprimida (<100KB)
                        const processedImages = [];
                        for (const img of m.images) {
                            let imgUrl = img.base64 || img.url;
                            // Comprime SEMPRE que tiver dado de imagem (qualquer data: URL)
                            if (typeof imgUrl === 'string' && imgUrl.startsWith('data:')) {
                                try {
                                    imgUrl = await compressImageFile(imgUrl, { maxWidth: 512, maxHeight: 512, quality: 0.45 });
                                } catch (err) {
                                    console.warn("Erro ao comprimir imagem no envio:", err);
                                }
                            }
                            processedImages.push({
                                type: 'image_url',
                                image_url: { url: imgUrl }
                            });
                        }

                        const content = [
                            { type: 'text', text: m.text || 'Analise a imagem em anexo:' },
                            ...processedImages
                        ];
                        apiMessages.push({ role: m.role, content });
                    } else {
                        // Turnos históricos anteriores enviam apenas referência textual leve
                        const summary = m.images.map(img => `[Imagem: ${img.name || 'foto'}]`).join(' ');
                        apiMessages.push({
                            role: m.role,
                            content: m.text ? `${m.text} ${summary}` : summary
                        });
                    }
                } else {
                    apiMessages.push({
                        role: m.role,
                        content: m.text,
                        ...(m.tool_calls && { tool_calls: m.tool_calls }),
                        ...(m.tool_call_id && { tool_call_id: m.tool_call_id, name: m.name })
                    });
                }
            }

            // Loop de execução de ferramentas (Tools)
            let keepGenerating = true;
            let loopCount = 0;
            let accumulatedText = '';
            let accumulatedReasoning = '';
            let accumulatedSources = [];
            let accumulatedVisitedPages = [];

            while (keepGenerating && loopCount < 5) {
                loopCount++;

                const effectiveModelMeta = GROQ_MODELS.find(m => m.id === effectiveModel);
                const shouldPassTools = effectiveModelMeta?.supportsCustomTools;

                const response = await groqClient.chat({
                    model: effectiveModel,
                    messages: apiMessages,
                    tools: shouldPassTools ? FARM_TOOLS_DEFINITION : undefined,
                    tool_choice: shouldPassTools ? 'auto' : undefined,
                    search_settings: searchSettings,
                    temperature: 0.3
                });

                const choice = response.choices?.[0];
                const msg = choice?.message;

                if (!msg) throw new Error("Resposta vazia da GroqCloud.");

                // Captura raciocínio (reasoning)
                if (msg.reasoning) {
                    accumulatedReasoning += (accumulatedReasoning ? '\n\n' : '') + msg.reasoning;
                }

                // Captura ferramentas executadas (search, visit e web tools)
                if (msg.executed_tools && msg.executed_tools.length > 0) {
                    msg.executed_tools.forEach(tool => {
                        // 1. Resultados de Busca Tavily/Groq
                        if (tool.search_results?.results) {
                            accumulatedSources.push(...tool.search_results.results);
                        }

                        // 2. Visita nativa de Websites (Groq visit tool)
                        if (tool.type === 'visit' || tool.visit_results || tool.visited_page || (tool.arguments && typeof tool.arguments === 'string' && tool.arguments.includes('http'))) {
                            let pageUrl = '';
                            try {
                                const parsedArgs = typeof tool.arguments === 'string' ? JSON.parse(tool.arguments) : tool.arguments;
                                pageUrl = parsedArgs?.url || '';
                            } catch (e) {
                                pageUrl = tool.url || '';
                            }

                            if (pageUrl || tool.page_title) {
                                accumulatedVisitedPages.push({
                                    url: pageUrl,
                                    title: tool.page_title || tool.title || pageUrl,
                                    snippet: tool.output || tool.content || tool.snippet || ''
                                });
                            }
                        }
                    });
                }

                if (msg.content) {
                    accumulatedText += msg.content;
                }

                // Atualiza mensagem no estado
                setMessages(prev => prev.map(m => m.id === botMsgId ? {
                    ...m,
                    text: accumulatedText,
                    reasoning: accumulatedReasoning,
                    sources: accumulatedSources,
                    visitedPages: accumulatedVisitedPages,
                    usage: response.usage ? {
                        duration: response.usage.total_time?.toFixed(2) || '0.35',
                        tokens: response.usage.total_tokens || 0
                    } : null
                } : m));

                // Processa chamadas de ferramentas de banco de dados se houver
                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    apiMessages.push(msg);
                    for (const call of msg.tool_calls) {
                        const fnName = call.function.name;
                        let fnArgs = {};
                        try { fnArgs = JSON.parse(call.function.arguments); } catch (e) {}

                        let toolResult = JSON.stringify({ error: `Ferramenta '${fnName}' falhou.` });
                        if (FARM_TOOLS_IMPLEMENTATION[fnName]) {
                            toolResult = await FARM_TOOLS_IMPLEMENTATION[fnName](fnArgs);
                        }

                        apiMessages.push({
                            role: 'tool',
                            tool_call_id: call.id,
                            name: fnName,
                            content: toolResult
                        });
                    }
                } else {
                    keepGenerating = false;
                }
            }

            // Auto-speak opcional
            if (autoSpeak && accumulatedText) {
                speakTextNative(accumulatedText);
            }

        } catch (error) {
            console.error("Erro no processamento da AgronomIA:", error);
            const displayMessage = error.friendlyMessage
                || (error.message?.includes('413') || error.message?.toLowerCase().includes('too large')
                    ? '⚠️ Mensagem ou imagem muito grande. Tente enviar uma imagem menor ou inicie uma nova conversa para limpar o histórico.'
                    : `⚠️ **Falha de Comunicação com o Motor Groq**\n${error.message || 'Verifique sua conexão ou a chave de API.'}`);
            setMessages(prev => prev.map(m => m.id === botMsgId ? {
                ...m,
                text: displayMessage,
                isError: true
            } : m));
        } finally {
            setLoading(false);
        }
    }, [inputText, loading, attachedImages, messages, selectedModelId, currentModelInfo, webSearchEnabled, searchScope, selectedState, searchPreset, customDomains, excludeDomains, location, systemPrompt, autoSpeak]);

    // ==========================================
    // GRAVAÇÃO E TRANSCRIÇÃO DE VOZ (WHISPER)
    // ==========================================
    const startAudioRecording = async () => {
        try {
            if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
                window.alert("Seu navegador não suporta captura de microfone.");
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            audioChunksRef.current = [];

            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());

                // Transcrição via Groq Whisper API
                setLoading(true);
                try {
                    const result = await groqClient.transcribeAudio({
                        audioBlob,
                        model: 'whisper-large-v3-turbo',
                        language: 'pt'
                    });
                    if (result?.text) {
                        setInputText(prev => (prev ? `${prev} ${result.text}` : result.text));
                    }
                } catch (err) {
                    console.error("Erro na transcrição Whisper:", err);
                    window.alert("Não foi possível transcrever o áudio via Groq Whisper: " + err.message);
                } finally {
                    setLoading(false);
                }
            };

            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error("Erro ao acessar microfone:", error);
            window.alert("Permissão de microfone necessária para gravação de voz.");
        }
    };

    const stopAudioRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(recordingTimerRef.current);
        }
    };

    // ==========================================
    // RECONHECIMENTO DE IMAGEM & CÂMERA AO VIVO
    // ==========================================
    const startCamera = async () => {
        try {
            setIsCameraActive(true);
            setChatMode(CHAT_MODES.CAMERA);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: facingMode },
                audio: false
            });
            mediaStreamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Erro ao acessar câmera:", err);
            window.alert("Não foi possível acessar a câmera do dispositivo.");
            setIsCameraActive(false);
            setChatMode(CHAT_MODES.CHAT);
        }
    };

    const stopCamera = () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        setIsCameraActive(false);
        setChatMode(CHAT_MODES.CHAT);
    };

    const capturePhotoFromCamera = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        let w = video.videoWidth || 640;
        let h = video.videoHeight || 480;
        const maxDim = 1024;
        if (w > maxDim || h > maxDim) {
            if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
            } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
            }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, w, h);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);

        setAttachedImages(prev => [
            ...prev,
            {
                url: base64,
                base64,
                name: `Foto_${new Date().toLocaleTimeString().replace(/:/g, '-')}.jpg`
            }
        ]);
        stopCamera();
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        for (const file of files) {
            try {
                const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
                let base64Data = '';
                if (isPdf) {
                    base64Data = await prepareFileForVision(file);
                } else {
                    base64Data = await compressImageFile(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.8 });
                }

                setAttachedImages(prev => [
                    ...prev,
                    {
                        url: base64Data,
                        base64: base64Data,
                        name: file.name,
                        isPdf: isPdf,
                        rawFile: file
                    }
                ]);
            } catch (err) {
                console.warn("Erro ao processar arquivo:", err);
                window.alert("Não foi possível carregar o arquivo: " + (err.message || 'Erro desconhecido'));
            }
        }
        if (e.target) e.target.value = '';
    };

    // ==========================================
    // TEXT-TO-SPEECH (REPRODUÇÃO DE ÁUDIO)
    // ==========================================
    const handleToggleSpeech = (msgId, text) => {
        if (playingMessageId === msgId) {
            stopNativeSpeech();
            setPlayingMessageId(null);
        } else {
            stopNativeSpeech();
            setPlayingMessageId(msgId);
            speakTextNative(text, {
                onEnd: () => setPlayingMessageId(null),
                onError: () => setPlayingMessageId(null)
            });
        }
    };

    // Consultas prontas da fazenda (Quadrados de Opções - Estilo Google Gemini)
    const quickPrompts = [
        {
            id: 'chuva',
            label: 'Adicionar Chuva',
            desc: 'Lançar no pluviômetro da fazenda',
            query: 'Quero registrar uma chuva',
            icon: CloudRain,
            color: '#0284c7',
            bgColor: 'rgba(2, 132, 199, 0.15)'
        },
        {
            id: 'manual',
            label: 'Cadastrar Manual',
            desc: 'Tratores, implementos & colheitadeiras',
            query: 'Cadastrar manual técnico',
            icon: BookOpen,
            color: '#10b981',
            bgColor: 'rgba(16, 185, 129, 0.15)'
        },
        {
            id: 'romaneio',
            label: 'Cadastrar Romaneio',
            desc: 'Ticket de pesagem de colheita',
            query: 'Registrar romaneio',
            icon: FileText,
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.15)'
        },
        {
            id: 'bula',
            label: 'Análise de Bula',
            desc: 'Defensivos, dosagens e carência',
            query: 'Analisar bula',
            icon: FlaskConical,
            color: '#a855f7',
            bgColor: 'rgba(168, 85, 247, 0.15)'
        },
        {
            id: 'cotacao',
            label: 'Cotação de Grãos',
            desc: 'Soja & Milho na sua região',
            query: 'Qual a cotação atual da soja e milho na minha localidade hoje?',
            icon: TrendingUp,
            color: '#34d399',
            bgColor: 'rgba(52, 211, 153, 0.15)'
        },
        {
            id: 'pragas',
            label: 'Diagnóstico de Lavoura',
            desc: 'Pragas, doenças e fitossanidade',
            query: 'Quais os principais sintomas e manejo',
            icon: Sprout,
            color: '#38bdf8',
            bgColor: 'rgba(56, 189, 248, 0.15)'
        },
    ];

    // ==========================================
    // RENDERIZAÇÃO: WIDGET PERMANENTE OU JANELA
    // ==========================================
    return (
        <>
            {/* ÍCONE FLUTUANTE PERMANENTE NO CANTO INFERIOR DIREITO */}
            {permanent && !isOpen && (
                <div className="fixed right-4 bottom-4 sm:right-5 sm:bottom-5 z-40 select-none animate-fadeIn">
                    {/* Botão FAB Principal 3D */}
                    <button
                        onClick={() => setIsOpen(true)}
                        className="agronomia-fab-button w-14 h-14 sm:w-16 sm:h-16 rounded-2xl text-white flex items-center justify-center cursor-pointer group relative shadow-xl"
                        title="Abrir Assistente Inteligente AgronomIA"
                    >
                        <Bot size={28} className="group-hover:rotate-12 transition-transform duration-300 sm:w-8 sm:h-8" />
                        {/* Indicador de status online */}
                        <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-400 border-2 border-slate-900 flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        </span>
                    </button>
                </div>
            )}

            {/* JANELA / MODAL EXPANDIDO DA AGRONOMIA (ESTILO GOOGLE GEMINI) */}
            {isOpen && (
                <div
                    className={`agronomia-chat-window fixed z-50 transition-all duration-300 flex flex-col ${
                        isMaximized
                            ? 'inset-3 sm:inset-6 rounded-3xl'
                            : 'bottom-4 right-4 left-4 sm:left-auto sm:w-[470px] h-[680px] max-h-[92vh] rounded-3xl'
                    } overflow-hidden animate-modal`}
                >
                    {/* CABEÇALHO CLEAN & MODERNO */}
                    <div className="agronomia-chat-header flex-shrink-0 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-400 via-emerald-600 to-teal-700 shadow-md">
                                    <Bot size={18} className="text-white" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <h2 className="font-black text-sm text-white tracking-wide truncate">AgronomIA</h2>
                                    <button
                                        onClick={() => setShowSettingsModal(true)}
                                        className="agronomia-model-pill text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer truncate max-w-[170px]"
                                        title="Clique para alterar o Modelo de IA ou Pesquisa"
                                    >
                                        <Sparkles size={10} className="text-emerald-400 shrink-0" />
                                        <span className="truncate">{currentModelInfo.name}</span>
                                    </button>
                                </div>
                                {location && (
                                    <div className="text-[10px] text-emerald-400 flex items-center gap-1 truncate">
                                        <MapPin size={9} />
                                        <span className="truncate">{location.city}, {location.state}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Botões de Ação do Topo */}
                        <div className="flex items-center gap-1 shrink-0">
                            {/* Toggle de Busca Web */}
                            <button
                                onClick={() => {
                                    setWebSearchEnabled(prev => !prev);
                                }}
                                className={`p-2 rounded-xl transition-all cursor-pointer ${
                                    webSearchEnabled
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                                        : 'text-slate-500 hover:text-white hover:bg-white/10'
                                }`}
                                title={webSearchEnabled ? "Busca Web Ativada" : "Busca Web Desativada"}
                            >
                                <Globe size={15} />
                            </button>

                            {/* Botão para Exibir/Ocultar Filtros de Busca (Oculto por padrão) */}
                            {webSearchEnabled && (
                                <button
                                    onClick={() => setShowSearchRibbon(prev => !prev)}
                                    className={`p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                                        showSearchRibbon
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                                            : 'text-slate-400 hover:text-white hover:bg-white/10'
                                    }`}
                                    title={showSearchRibbon ? "Ocultar Filtros de Busca" : "Exibir Âmbito e Filtros de Busca"}
                                >
                                    <SlidersHorizontal size={14} />
                                </button>
                            )}

                            {/* Configurações de Modelos */}
                            <button
                                onClick={() => setShowSettingsModal(true)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                                title="Seletor de Modelos & Configurações"
                            >
                                <Settings size={15} />
                            </button>

                            {/* Limpar Conversa */}
                            {messages.length > 0 && (
                                <button
                                    onClick={() => { setMessages([]); setChatMode(CHAT_MODES.WELCOME); stopNativeSpeech(); }}
                                    className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all cursor-pointer"
                                    title="Limpar Conversa"
                                >
                                    <Trash2 size={15} />
                                </button>
                            )}

                            {/* Maximizar / Restaurar */}
                            <button
                                onClick={() => setIsMaximized(prev => !prev)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer hidden sm:block"
                                title={isMaximized ? "Restaurar Tamanho" : "Maximizar"}
                            >
                                {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                            </button>

                            {/* Fechar (Minimiza de volta ao ícone permanente) */}
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    stopCamera();
                                    stopNativeSpeech();
                                    if (onCloseExternal) onCloseExternal();
                                }}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                                title="Minimizar para o ícone flutuante"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* BARRA DINÂMICA DE ÂMBITO DA BUSCA WEB (NACIONAL / REGIONAL / GLOBAL) - OCULTA POR PADRÃO */}
                    {webSearchEnabled && showSearchRibbon && (
                        <div className="px-3 sm:px-4 py-2 border-b border-white/10 bg-black/50 backdrop-blur-md flex flex-col gap-2 shrink-0 select-none animate-fadeIn">
                            <div className="flex items-center justify-between gap-2">
                                {/* Seletor de Escopo: Nacional / Regional / Global */}
                                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                                    {Object.values(SEARCH_SCOPES).map((s) => {
                                        const isActive = searchScope === s.id;
                                        return (
                                            <button
                                                key={s.id}
                                                onClick={() => {
                                                    setSearchScope(s.id);
                                                    if (s.id !== 'regional') setShowStateDropdown(false);
                                                }}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                                    isActive
                                                        ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-950/40'
                                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                                }`}
                                                title={s.desc || s.label}
                                            >
                                                <span>{s.flag || s.icon || '🌐'}</span>
                                                <span>{s.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Seletor de Estado / Hub Regional se modo Regional ativo */}
                                {searchScope === 'regional' && (
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowStateDropdown(prev => !prev)}
                                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all flex items-center gap-1 cursor-pointer"
                                            title="Clique para trocar o Estado/Região da busca"
                                        >
                                            <MapPin size={12} />
                                            <span>
                                                {selectedState === 'AUTO'
                                                    ? (location?.region ? `📍 ${location.region}` : '📍 GPS Auto')
                                                    : `📍 ${selectedState} (${BRAZILIAN_AGRO_REGIONS[selectedState]?.name || selectedState})`}
                                            </span>
                                            <ChevronDown size={12} />
                                        </button>

                                        {/* Dropdown de Estados */}
                                        {showStateDropdown && (
                                            <div className="absolute right-0 top-full mt-1 w-64 bg-slate-900/95 border border-emerald-500/30 rounded-2xl p-2 shadow-2xl z-50 backdrop-blur-xl max-h-60 overflow-y-auto">
                                                <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                                                    Selecione o Estado Agrícola
                                                </div>
                                                <button
                                                    onClick={() => { setSelectedState('AUTO'); setShowStateDropdown(false); }}
                                                    className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between mb-1 ${
                                                        selectedState === 'AUTO' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-300 hover:bg-white/10'
                                                    }`}
                                                >
                                                    <span className="flex items-center gap-1.5">
                                                        <Navigation size={12} className="text-emerald-400" />
                                                        <span>GPS Automático ({location?.city || 'Brasil'})</span>
                                                    </span>
                                                    {selectedState === 'AUTO' && <Check size={12} className="text-emerald-400" />}
                                                </button>

                                                {Object.entries(BRAZILIAN_AGRO_REGIONS).map(([uf, data]) => (
                                                    <button
                                                        key={uf}
                                                        onClick={() => { setSelectedState(uf); setShowStateDropdown(false); }}
                                                        className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold transition-all flex items-center justify-between ${
                                                            selectedState === uf ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold' : 'text-slate-300 hover:bg-white/10'
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="text-white font-bold">{data.name} ({uf})</div>
                                                            <div className="text-[9px] text-slate-400 truncate max-w-[180px]">{data.hubs}</div>
                                                        </div>
                                                        {selectedState === uf && <Check size={12} className="text-amber-400" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    {/* Badge do Modelo Ativo */}
                                    <div className="text-[10px] text-slate-400 hidden sm:flex items-center gap-1.5 font-mono">
                                        <Zap size={11} className="text-emerald-400" />
                                        <span>{currentModelInfo.badge}</span>
                                    </div>
                                    <button
                                        onClick={() => setShowSearchRibbon(false)}
                                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                                        title="Ocultar barra de filtros"
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                            </div>

                            {/* Pílulas de Filtro de Tópico Rápido */}
                            <div className="flex items-center gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                                {WEB_SEARCH_PRESETS.map(preset => {
                                    const isSelected = searchPreset === preset.id;
                                    return (
                                        <button
                                            key={preset.id}
                                            onClick={() => setSearchPreset(preset.id)}
                                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                                                isSelected
                                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-200 bg-white/5 border border-white/5'
                                            }`}
                                            title={preset.desc}
                                        >
                                            <span>{preset.icon}</span>
                                            <span>{preset.shortLabel || preset.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* CORPO CENTRAL DO CHAT */}
                    <div className="flex-1 flex flex-col overflow-hidden relative">

                        {/* MODO 1: TELA DE BOAS-VINDAS (ESTILO GOOGLE GEMINI) */}
                        {chatMode === CHAT_MODES.WELCOME && (
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col justify-center items-center text-center agronomia-gemini-welcome space-y-4" style={{ scrollbarWidth: 'thin' }}>
                                {/* Avatar Sparkle Central */}
                                <div className="relative my-1">
                                    <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-3xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 flex items-center justify-center shadow-xl shadow-emerald-950/50">
                                        <Bot size={34} className="text-white" />
                                    </div>
                                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 border-2 border-slate-900 flex items-center justify-center shadow-md">
                                        <Sparkles size={12} className="text-slate-950" />
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xl sm:text-2xl font-black tracking-tight agronomia-gemini-greeting">
                                        Olá, {userName}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1 max-w-xs sm:max-w-sm leading-relaxed">
                                        Como posso apoiar a sua gestão e produção agrícola hoje?
                                    </p>
                                </div>

                                {/* Grade de Quadrados de Opções (Google Gemini Style) */}
                                <div className="agronomia-gemini-grid max-w-md mt-2">
                                    {quickPrompts.map((p) => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleSendMessage(p.query)}
                                            className="agronomia-gemini-card group"
                                        >
                                            <div>
                                                <div
                                                    className="agronomia-gemini-card-icon"
                                                    style={{ background: p.bgColor }}
                                                >
                                                    <p.icon size={18} style={{ color: p.color }} />
                                                </div>
                                                <div className="agronomia-gemini-card-title">
                                                    {p.label}
                                                </div>
                                                <div className="agronomia-gemini-card-desc">
                                                    {p.desc}
                                                </div>
                                            </div>
                                            <ArrowUpRight size={15} className="agronomia-gemini-card-arrow" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* MODO 2: CÂMERA AO VIVO */}
                        {chatMode === CHAT_MODES.CAMERA && (
                            <div className="flex-1 flex flex-col bg-black relative">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-6">
                                    <button
                                        onClick={stopCamera}
                                        className="p-3 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 cursor-pointer"
                                    >
                                        <X size={20} />
                                    </button>
                                    <button
                                        onClick={capturePhotoFromCamera}
                                        className="w-16 h-16 rounded-full bg-emerald-500 border-4 border-white text-white flex items-center justify-center cursor-pointer shadow-2xl hover:scale-105 active:scale-95"
                                        title="Capturar Foto"
                                    >
                                        <Camera size={26} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
                                            stopCamera();
                                            setTimeout(startCamera, 200);
                                        }}
                                        className="p-3 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 cursor-pointer"
                                        title="Alternar Câmera"
                                    >
                                        <RefreshCw size={20} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* MODO 3: HISTÓRICO DE MENSAGENS (ESTILO GEMINI & MARKDOWN) */}
                        {chatMode === CHAT_MODES.CHAT && (
                            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>
                                {messages.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`flex flex-col ${item.sender === 'user' ? 'items-end' : 'items-start'}`}
                                    >
                                        <div
                                            className={`max-w-[92%] sm:max-w-[88%] p-4 relative ${
                                                item.sender === 'user'
                                                    ? 'agronomia-msg-user'
                                                    : item.isError
                                                    ? 'agronomia-msg-error'
                                                    : 'agronomia-msg-bot'
                                            }`}
                                        >
                                            {/* Imagens e PDFs anexados pelo usuário */}
                                            {item.images && item.images.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    {item.images.map((img, idx) => {
                                                        if (img.isPdf || (img.name && img.name.toLowerCase().endsWith('.pdf'))) {
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    onClick={() => setPdfViewer({
                                                                        visible: true,
                                                                        fileSource: img.rawFile || img.url || img.base64,
                                                                        title: img.name || 'Documento PDF',
                                                                        subtitle: 'Anexo de Consulta Agronômica',
                                                                        badgeText: 'PDF'
                                                                    })}
                                                                    className="px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                                                                >
                                                                    <div className="w-7 h-7 rounded-lg bg-red-500/30 flex items-center justify-center text-red-300 font-bold text-xs">
                                                                        <FileText size={16} />
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-bold text-white truncate max-w-[140px]">{img.name || 'Documento.pdf'}</span>
                                                                        <span className="text-[10px] text-red-300 flex items-center gap-1 font-semibold">
                                                                            <Eye size={11} />
                                                                            <span>Clique para Visualizar</span>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <img
                                                                key={idx}
                                                                src={img.url || img.base64}
                                                                alt="Anexo Agronômico"
                                                                className="w-24 h-24 object-cover rounded-xl border border-white/20 shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Raciocínio (Reasoning) recolhível */}
                                            {item.reasoning && (
                                                <details className="mb-3 p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-slate-400">
                                                    <summary className="cursor-pointer font-bold text-emerald-400 flex items-center gap-1.5 select-none">
                                                        <Cpu size={14} />
                                                        <span>Raciocínio & Ferramentas Internas</span>
                                                    </summary>
                                                    <div className="mt-2 pt-2 border-t border-white/10 text-[11px] font-mono whitespace-pre-wrap">
                                                        {item.reasoning}
                                                    </div>
                                                </details>
                                            )}

                                            {/* Conteúdo principal formatado via Markdown-CSS */}
                                            <SimpleMarkdown text={item.text} isSystem={item.sender === 'system'} />

                                                {/* Páginas Web Visitadas em Tempo Real (Groq Visit Tool) */}
                                                {item.visitedPages && item.visitedPages.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-white/10">
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1 mb-2">
                                                            <Compass size={12} />
                                                            <span>Páginas Analisadas na Íntegra (Visit Tool):</span>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            {item.visitedPages.map((page, pIdx) => (
                                                                <a
                                                                    key={pIdx}
                                                                    href={page.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-2.5 rounded-xl bg-cyan-950/30 hover:bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-between gap-2 transition-all group"
                                                                >
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="text-[11px] font-bold text-cyan-200 group-hover:text-cyan-100 truncate flex items-center gap-1.5">
                                                                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-[9px] text-cyan-300 border border-cyan-500/30">Visita Completa</span>
                                                                            <span>{page.title || page.url}</span>
                                                                        </div>
                                                                        {page.snippet && (
                                                                            <div className="text-[10px] text-slate-300 line-clamp-1 mt-0.5 font-sans">
                                                                                {page.snippet}
                                                                            </div>
                                                                        )}
                                                                        <div className="text-[9px] text-cyan-400/70 truncate mt-0.5">
                                                                            {page.url}
                                                                        </div>
                                                                    </div>
                                                                    <ArrowUpRight size={13} className="text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Fontes Web e Citações (Tavily/Groq) */}
                                                {item.sources && item.sources.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-white/10">
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1 mb-2">
                                                            <Globe size={12} />
                                                            <span>Fontes Consultadas na Web ({item.sources.length}):</span>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                            {item.sources.slice(0, 6).map((src, sIdx) => (
                                                                <a
                                                                    key={sIdx}
                                                                    href={src.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-2 rounded-xl bg-black/30 hover:bg-black/50 border border-white/5 hover:border-emerald-500/30 flex items-center justify-between gap-2 transition-all group"
                                                                >
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="text-[11px] font-bold text-white group-hover:text-emerald-300 truncate">
                                                                            {src.title || src.url}
                                                                        </div>
                                                                        <div className="text-[9px] text-slate-400 truncate mt-0.5">
                                                                            {src.url.replace(/^https?:\/\//, '').split('/')[0]}
                                                                        </div>
                                                                    </div>
                                                                    <ExternalLink size={12} className="text-slate-500 group-hover:text-emerald-400 shrink-0" />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                            {/* Ações da Mensagem: Copiar, Ouvir por Voz (TTS) e Métricas */}
                                            {item.sender === 'bot' && !item.isError && (
                                                <div className="agronomia-msg-actions">
                                                    {/* Botão Copiar */}
                                                    <button
                                                        onClick={() => handleCopyMessage(item.id, item.text)}
                                                        className="agronomia-action-btn"
                                                        title="Copiar resposta formatada"
                                                    >
                                                        {copiedMessageId === item.id ? (
                                                            <>
                                                                <Check size={12} className="text-emerald-400" />
                                                                <span className="text-emerald-400 font-bold">Copiado!</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy size={12} />
                                                                <span>Copiar</span>
                                                            </>
                                                        )}
                                                    </button>

                                                    {/* Botão Ouvir Resposta */}
                                                    <button
                                                        onClick={() => handleToggleSpeech(item.id, item.text)}
                                                        className={`agronomia-action-btn ${playingMessageId === item.id ? 'active' : ''}`}
                                                        title={playingMessageId === item.id ? "Pausar leitura em voz" : "Ouvir resposta (TTS)"}
                                                    >
                                                        {playingMessageId === item.id ? <VolumeX size={12} /> : <Volume2 size={12} />}
                                                        <span>{playingMessageId === item.id ? 'Ouvindo...' : 'Ouvir'}</span>
                                                    </button>

                                                    {/* Telemetria e Tempo de Resposta */}
                                                    {item.usage && (
                                                        <span className="text-[10px] font-mono text-slate-500 ml-auto hidden sm:inline">
                                                            ⚡ {item.usage.duration}s · {item.usage.tokens} tokens
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-slate-500 ml-auto sm:ml-2">
                                                        {item.timestamp}
                                                    </span>
                                                </div>
                                            )}

                                            {item.sender === 'user' && (
                                                <div className="mt-1 text-right text-[10px] text-emerald-100/70">
                                                    {item.timestamp}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {loading && (
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shrink-0 shadow-md">
                                            <Bot size={16} />
                                        </div>
                                        <div className="agronomia-msg-bot p-3.5 flex items-center gap-2.5">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                            <span className="text-xs text-slate-300 font-medium">AgronomIA analisando...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>
                        )}
                    </div>

                    {/* PRÉ-VISUALIZAÇÃO DE IMAGENS E DOCUMENTOS ANEXADOS */}
                    {attachedImages.length > 0 && (
                        <div className="flex-shrink-0 px-4 py-2.5 bg-black/40 border-t border-white/10 flex items-center gap-3 overflow-x-auto">
                            {attachedImages.map((img, idx) => (
                                <div key={idx} className="relative group shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10">
                                    {img.isPdf ? (
                                        <button
                                            type="button"
                                            onClick={() => setPdfViewer({
                                                visible: true,
                                                fileSource: img.rawFile || img.url || img.base64,
                                                title: img.name || 'Documento PDF',
                                                subtitle: 'Prévia de Anexo',
                                                badgeText: 'PDF'
                                            })}
                                            className="w-9 h-9 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 flex items-center justify-center text-red-400 font-bold text-[10px] cursor-pointer transition-colors"
                                            title="Clique para Visualizar PDF"
                                        >
                                            <Eye size={16} />
                                        </button>
                                    ) : (
                                        <img
                                            src={img.url || img.base64}
                                            alt="Preview"
                                            className="w-9 h-9 rounded-lg object-cover border border-emerald-500/50"
                                        />
                                    )}
                                    <div className="flex flex-col max-w-[100px]">
                                        <span className="text-[11px] text-white font-medium truncate">{img.name || 'Arquivo'}</span>
                                        <span className="text-[9px] text-emerald-400 font-semibold">{img.isPdf ? 'Documento PDF' : 'Foto / Imagem'}</span>
                                    </div>
                                    <button
                                        onClick={() => setAttachedImages(prev => prev.filter((_, i) => i !== idx))}
                                        className="w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center text-[11px] cursor-pointer ml-1"
                                        title="Remover"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                            <span className="text-[11px] text-emerald-400 font-semibold shrink-0">
                                Pronto para análise com IA 🚜
                            </span>
                        </div>
                    )}

                    {/* BARRA DE ENTRADA FLUTUANTE (CÁPSULA GOOGLE GEMINI) */}
                    <div className="agronomia-input-container flex-shrink-0 p-3">
                        {isRecording ? (
                            /* Interface de Gravação de Voz */
                            <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-300">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                                    <span className="font-bold text-xs">Gravando áudio... {recordingTime}s</span>
                                    <span className="text-[11px] text-slate-400 hidden sm:inline">Fale sua dúvida agrícola</span>
                                </div>
                                <button
                                    onClick={stopAudioRecording}
                                    className="px-3 py-1 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                                >
                                    <MicOff size={14} />
                                    <span>Concluir</span>
                                </button>
                            </div>
                        ) : (
                            /* Cápsula de Entrada Padrão */
                            <div className="agronomia-input-capsule">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*,.pdf"
                                    multiple
                                    onChange={handleFileUpload}
                                />

                                {/* Botão Anexar Arquivo */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0"
                                    title="Anexar Foto de Folha, Praga ou Romaneio"
                                >
                                    <Paperclip size={18} />
                                </button>

                                {/* Botão Câmera Ao Vivo */}
                                <button
                                    onClick={startCamera}
                                    className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-white/10 transition-all cursor-pointer shrink-0"
                                    title="Tirar Foto com a Câmera"
                                >
                                    <Camera size={18} />
                                </button>

                                {/* Botão Microfone / Gravação Whisper */}
                                <button
                                    onClick={startAudioRecording}
                                    className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-white/10 transition-all cursor-pointer shrink-0"
                                    title="Falar por Voz (Groq Whisper)"
                                >
                                    <Mic size={18} />
                                </button>

                                {/* Campo de Texto */}
                                <textarea
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    placeholder={
                                        attachedImages.length > 0
                                            ? "Instrução para análise da foto..."
                                            : webSearchEnabled
                                            ? "Pergunte ou pesquise na web (ex: cotação soja hoje)..."
                                            : "Pergunte à AgronomIA..."
                                    }
                                    rows={1}
                                    className="agronomia-textarea flex-1 max-h-24"
                                    style={{ minHeight: '36px' }}
                                />

                                {/* Botão Circular Enviar (Gemini Style) */}
                                <button
                                    onClick={() => handleSendMessage()}
                                    disabled={loading || (!inputText.trim() && attachedImages.length === 0)}
                                    className="agronomia-send-btn shrink-0"
                                    title="Enviar mensagem"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL DE SELEÇÃO DE MODELOS & CONFIGURAÇÕES AVANÇADAS */}
            {showSettingsModal && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowSettingsModal(false); }}
                >
                    <div
                        className="w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-modal"
                        style={{
                            background: 'linear-gradient(145deg, #0f172a 0%, #172554 100%)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                        }}
                    >
                        {/* Topo do Modal */}
                        <div className="px-6 py-4 flex items-center justify-between border-b border-white/10 bg-black/30">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                    <Settings size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-white">Central de Motores GroqCloud</h3>
                                    <p className="text-xs text-slate-400">Escolha o modelo de IA e configure as opções de busca e voz</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowSettingsModal(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Abas de Categorias de Modelos */}
                        <div className="flex px-6 pt-4 gap-2 border-b border-white/10 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                            {[
                                { id: 'groq', label: '🚀 Groq Compound (Agente + Web)' },
                                { id: 'meta', label: '🦙 Meta Llama (70B & 8B)' },
                                { id: 'vision', label: '👁️ Multimodal & Visão' },
                                { id: 'audio', label: '🎙️ Whisper (Voz)' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTabCategory(tab.id)}
                                    className={`px-3.5 py-2 font-bold text-xs rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${
                                        activeTabCategory === tab.id
                                            ? 'bg-white/10 text-emerald-400 border-b-2 border-emerald-400'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Lista de Modelos da Categoria Selecionada */}
                        <div className="p-6 overflow-y-auto space-y-3 flex-1">
                            {GROQ_MODELS
                                .filter(m => m.category === activeTabCategory)
                                .map((model) => (
                                    <div
                                        key={model.id}
                                        onClick={() => {
                                            if (model.category !== 'audio') {
                                                setSelectedModelId(model.id);
                                            }
                                        }}
                                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-4 ${
                                            selectedModelId === model.id
                                                ? 'bg-emerald-500/15 border-emerald-500/50 shadow-md shadow-emerald-950/20'
                                                : 'bg-white/5 border-white/5 hover:bg-white/10'
                                        }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-sm text-white">{model.name}</span>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                    {model.badge}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    ⚡ {model.speed}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{model.desc}</p>
                                            <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-3">
                                                <span>Contexto: {model.contextWindow}</span>
                                                <span>Max Output: {model.maxCompletion}</span>
                                            </div>
                                        </div>
                                        <div className="shrink-0 pt-1">
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                selectedModelId === model.id ? 'border-emerald-400 bg-emerald-500' : 'border-slate-600'
                                            }`}>
                                                {selectedModelId === model.id && <Check size={12} className="text-white" />}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                            {/* Opções extras para Busca Web (Groq Compound & Modelos com Web Search) */}
                            {(activeTabCategory === 'groq' || currentModelInfo.supportsWebSearch) && (
                                <div className="mt-6 p-4 rounded-2xl bg-black/40 border border-white/10 space-y-4">
                                    <div className="font-bold text-xs text-white flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <Globe size={14} className="text-emerald-400" />
                                            <span>Configurações & Filtros de Busca Web (Tavily/Groq)</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-lg">
                                            {searchScope === 'regional' ? 'Âmbito Regional' : searchScope === 'global' ? 'Âmbito Global' : 'Âmbito Nacional'}
                                        </span>
                                    </div>

                                    {/* Âmbito da Busca */}
                                    <div>
                                        <label className="text-[11px] text-slate-300 block mb-1.5 font-semibold">
                                            Âmbito da Pesquisa:
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {Object.values(SEARCH_SCOPES).map(s => (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => setSearchScope(s.id)}
                                                    className={`p-2 rounded-xl text-xs font-bold transition-all text-center border flex flex-col items-center gap-1 ${
                                                        searchScope === s.id
                                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md'
                                                            : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                                                    }`}
                                                >
                                                    <span className="text-base">{s.flag || '🌐'}</span>
                                                    <span>{s.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Seletor de Estado se Âmbito for Regional */}
                                    {searchScope === 'regional' && (
                                        <div>
                                            <label className="text-[11px] text-slate-300 block mb-1.5 font-semibold">
                                                Estado Agrícola de Referência:
                                            </label>
                                            <select
                                                value={selectedState}
                                                onChange={(e) => setSelectedState(e.target.value)}
                                                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold focus:outline-none"
                                            >
                                                <option value="AUTO">GPS Automático ({location?.region || location?.city || 'Brasil'})</option>
                                                {Object.entries(BRAZILIAN_AGRO_REGIONS).map(([uf, data]) => (
                                                    <option key={uf} value={uf}>
                                                        {data.name} ({uf}) - Polos: {data.hubs}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Filtro Temático de Pesquisa */}
                                    <div>
                                        <label className="text-[11px] text-slate-300 block mb-1.5 font-semibold">
                                            Filtro Temático Rápido:
                                        </label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {WEB_SEARCH_PRESETS.map(p => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => setSearchPreset(p.id)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                                                        searchPreset === p.id
                                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                                            : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                                                    }`}
                                                >
                                                    <span>{p.icon}</span>
                                                    <span>{p.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-1 border-t border-white/5">
                                        <div>
                                            <label className="text-[11px] text-slate-300 block mb-1">
                                                Incluir Domínios Específicos (separados por vírgula):
                                            </label>
                                            <input
                                                type="text"
                                                value={customDomains}
                                                onChange={(e) => setCustomDomains(e.target.value)}
                                                placeholder="Ex: noticiasagricolas.com.br, embrapa.br, cepea.esalq.usp.br"
                                                className="w-full px-3.5 py-2 rounded-xl bg-white/10 border border-white/15 text-white text-xs focus:outline-none focus:border-emerald-400"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] text-slate-300 block mb-1">
                                                Excluir Domínios Indesejados (separados por vírgula):
                                            </label>
                                            <input
                                                type="text"
                                                value={excludeDomains}
                                                onChange={(e) => setExcludeDomains(e.target.value)}
                                                placeholder="Ex: wikipedia.org, pinterest.com"
                                                className="w-full px-3.5 py-2 rounded-xl bg-white/10 border border-white/15 text-white text-xs focus:outline-none focus:border-emerald-400"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Rodapé do Modal */}
                        <div className="px-6 py-4 border-t border-white/10 bg-black/30 flex items-center justify-between">
                            <div className="text-xs text-slate-400">
                                Modelo selecionado: <span className="text-emerald-400 font-bold">{currentModelInfo.name}</span>
                            </div>
                            <button
                                onClick={() => setShowSettingsModal(false)}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow-md"
                            >
                                Salvar e Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Visualização de PDF */}
            <PdfViewerModal
                visible={pdfViewer.visible}
                fileSource={pdfViewer.fileSource}
                title={pdfViewer.title}
                subtitle={pdfViewer.subtitle}
                badgeText={pdfViewer.badgeText}
                onClose={() => setPdfViewer({ visible: false, fileSource: null, title: '', subtitle: '', badgeText: 'PDF' })}
            />
        </>
    );
}
