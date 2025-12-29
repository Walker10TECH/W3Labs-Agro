import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { Animated } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location'; 
import { Audio } from 'expo-audio';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { Groq } from "groq-sdk";

import * as common from './Common'; // UI, estilos, hooks auxiliares
import { auth, db } from '../firebaseConfig';

// ---------------------------------------------------------------------
// 1️⃣ VARIÁVEIS DE AMBIENTE E CONSTANTES
// ---------------------------------------------------------------------
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;

const MODELS = {
  SMART: 'llama-3.3-70b-versatile', // Modelo de alta capacidade de raciocínio
  FAST: 'llama-3.1-8b-instant',     // Modelo de baixa latência
  WHISPER: 'whisper-large-v3'       // Modelo SOTA para transcrição de áudio
};

// Coleções monitoradas para contexto do usuário
const COLLECTIONS = [
  'propriedades', 'unidades', 'inventario', 'diesel', 'dieselEstoque',
  'manualCategorias', 'manualItems', 'plantios', 'pulverizacoes',
  'revisoes', 'estoqueGeral', 'pluviometro', 'porcentagens',
  'colheitas',
];

// ---------------------------------------------------------------------
// 2️⃣ COMPONENTE FAB (Botão Flutuante)
// ---------------------------------------------------------------------
export const ChatbotFAB = React.forwardRef(({ onPress }, ref) => (
    <common.TouchableOpacity
        ref={ref}
        style={common.styles.chatbotFab}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <common.MaterialCommunityIcons
            name="robot-happy-outline"
            size={32}
            color={common.theme.colors.textWhite}
        />
    </common.TouchableOpacity>
));

// ---------------------------------------------------------------------
// 3️⃣ UTILITÁRIOS
// ---------------------------------------------------------------------

/** * Sanitiza URLs para garantir segurança na renderização de imagens/links.
 */
function safeUrl (url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Simulação de busca na web (Mock).
 * Em produção, substituir por API real (Google Search API / Bing API).
 */
const fetchWebSearchResults = async (query) => {
  console.log(`[W3Labs Search Engine] Buscando: "${query}"`);
  
  // Simulação de latência de rede
  // await new Promise(r => setTimeout(r, 500)); 

  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('soja')) {
    return `
      - Cotação Soja Hoje (26/12/25): R$ 139,44 por saca de 60kg. [Fonte: Agrolink]
      - Indicador CEPEA/ESALQ (Porto de Paranaguá): R$ 135,55/saca.
      - Bolsa de Chicago (CBOT) Futuros Jan/26: US$ 1.060,88.
      - Notícias: Mercado influenciado pela demanda asiática e clima nos EUA.
    `;
  }
  if (lowerQuery.includes('milho')) {
    return `
      - Cotação Milho Hoje (26/12/25):
      - Indicador CEPEA/ESALQ (Campinas-SP): R$ 66,21 por saca de 60kg.
      - Preço em Luís Eduardo Magalhães-BA: R$ 61,51/saca.
      - Bolsa de Chicago (CBOT) Futuros Mar/26: US$ 449,38.
      - Notícias: Safra de inverno (safrinha) no Brasil é fator chave.
    `;
  }
  return "Não foi possível encontrar cotações exatas para o termo pesquisado neste momento.";
};

// ---------------------------------------------------------------------
// 4️⃣ COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------

const MODES = {
  WELCOME: 'welcome',
  OPTIONS: 'options',
  AI: 'ai',
};

export const AgronomiaChatbot = ({ onClose }) => {
  // ---------------------------------------------------------------------
  // 5️⃣ ESTADOS E REFS
  // ---------------------------------------------------------------------
  const [loadingChat, setLoadingChat]     = useState(false);
  const [loadingAudio, setLoadingAudio]   = useState(false);
  const [isRecording, setIsRecording]     = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  
  const [inputText, setInputText] = useState('');
  const [messages,  setMessages]  = useState([]);
  const [attachedFile, setAttachedFile] = useState(null);
  const [chatMode,  setChatMode]  = useState(MODES.WELCOME);
  
  const [groqModel, setGroqModel] = useState(MODELS.SMART); 
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [location, setLocation] = useState(null); 
  
  const flatListRef        = useRef(null);
  const abortControllerRef = useRef(null);
  const recordingRef       = useRef(null);
  const scaleAnim          = useRef(new Animated.Value(1)).current;

  // Palavras-chave para roteamento de contexto no Firestore
  const analysisKeywords = useMemo(() => ({
    colheita:        'colheitas',
    pulveriza:       'pulverizacoes',
    diesel:          'diesel',
    abastecimento:   'diesel',
    plantio:         'plantios',
    revis:           'revisoes',
    pluviom:         'pluviometro',
    chuva:           'pluviometro',
    estoque:         'estoqueGeral',
    peças:           ['estoqueGeral', 'revisoes'],
    equipamento:     'inventario',
    trator:          'inventario',
    colheitadeira:   'inventario',
    relatório:       'all',
    'análise completa': 'all',
    'analise meus dados': 'all',
  }), []);

  const commodityKeywords = useMemo(() => [
    'cotação', 'preço', 'soja', 'milho', 'trigo', 'dólar',
  ], []);

  // ---------------------------------------------------------------------
  // 6️⃣ PROMPT DO SISTEMA (Engineering & Persona)
  // ---------------------------------------------------------------------
  const systemInstruction = useMemo(() => `
Você é a **AgronomIA**, uma assistente virtual especialista em agronegócio, integrada a um aplicativo de gestão agrícola da W3Labs. Sua missão é fornecer insights precisos e práticos.

**REGRAS FUNDAMENTAIS (JSON MODE):**
1.  **Formato de Saída**: OBRIGATORIAMENTE um JSON válido. Estrutura: \`{"reply": "Texto em Markdown.", "chartUrl": "URL_DO_GRAFICO_OU_NULL"}\`.
2.  **Análise de Dados**: Baseie-se ESTRITAMENTE na seção "**DADOS DO SISTEMA**" se fornecida. Calcule médias e totais.
3.  **Cotações**: Use a seção "**DADOS DE BUSCA WEB**" para preços. Cite fontes.
4.  **Gráficos**: Gere URLs da Google Charts API para visualizações (tipo 'p' pizza, 'bvs' barras).
5.  **Limitações**: Não invente dados ausentes. Não execute código arbitrário.
6.  **Tom**: Profissional, direto, especialista.

Exemplo de resposta JSON:
{
  "reply": "**Resumo da Safra**:\\nA produtividade média foi de 60 sc/ha.",
  "chartUrl": "https://chart.googleapis.com/chart?cht=p&chs=300x150&chd=t:60,40&chl=Soja|Milho"
}
`.trim(), []);

  // ---------------------------------------------------------------------
  // 7️⃣ FUNÇÕES DE ÁUDIO (Gravação + Whisper)
  // ---------------------------------------------------------------------

  useEffect(() => {
    if (isRecording) {
        Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 1.15, duration: 400, useNativeDriver: common.Platform.OS !== 'web' }),
                Animated.timing(scaleAnim, { toValue: 1, duration: 400, useNativeDriver: common.Platform.OS !== 'web' }),
            ])
        ).start();
    } else {
        scaleAnim.stopAnimation();
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: common.Platform.OS !== 'web' }).start();
    }
  }, [isRecording, scaleAnim]);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === 'granted') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
            Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        
        recordingRef.current = recording;
        await recording.startAsync();
        setIsRecording(true);
      } else {
        common.Alert.alert("Permissão necessária", "Acesso ao microfone negado.");
      }
    } catch (err) {
      console.error('[Audio Error] Start:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    
    setIsRecording(false);
    setLoadingAudio(true);
    
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (uri) {
        await transcribeAudio(uri);
      }
    } catch (error) {
      console.error('[Audio Error] Stop:', error);
      common.Alert.alert("Erro", "Falha ao processar áudio.");
    } finally {
      setLoadingAudio(false);
      recordingRef.current = null;
    }
  };

  const transcribeAudio = async (audioUri) => {
    try {
      const formData = new FormData();
      formData.append('model', MODELS.WHISPER);
      formData.append('file', {
        uri: audioUri,
        name: 'audio.m4a', 
        type: 'audio/m4a', 
      });

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Falha na resposta da API Whisper');

      const data = await response.json();
      if (data.text) {
        handleSend(data.text);
      }
    } catch (error) {
      console.error('[Whisper Error]:', error);
      common.Alert.alert("Erro", "Não foi possível transcrever o áudio.");
    }
  };

  // ---------------------------------------------------------------------
  // 8️⃣ CONTEXTO E DADOS (Location + Firestore + Files)
  // ---------------------------------------------------------------------

  const requestLocation = useCallback(async () => {
    setLoadingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        common.Alert.alert('Permissão Negada', 'Localização necessária para cotações regionais.');
        return null;
      }
      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      return currentLocation;
    } catch (error) {
      console.error("[GPS Error]:", error);
      return null;
    } finally {
      setLoadingLocation(false);
    }
  }, []);

  const clearLocation = useCallback(() => {
    setLocation(null);
    common.Alert.alert('Info', 'Dados de localização removidos.');
  }, []);

  const initializeChat = useCallback(() => {
    if (!GROQ_API_KEY) {
      setMessages([{ id: 'err-key', text: '⚠️ SISTEMA: API Key da Groq não configurada.', sender: 'bot' }]);
    }
  }, []);
  
  const buildContextualPrompt = useCallback(async (userMessage) => {
    let prompt = userMessage;
    const lower = userMessage.toLowerCase();
    const userUid = auth.currentUser?.uid;

    // 1. Contexto de Arquivo
    if (attachedFile) {
      try {
           const fileContent = await FileSystem.readAsStringAsync(attachedFile.uri, { encoding: FileSystem.EncodingType.UTF8 });
           prompt = `Arquivo anexo "${attachedFile.name}":\n\n${fileContent}\n\nPergunta do usuário sobre o arquivo: ${userMessage}`;
      } catch (err) { 
           console.warn("[File Read Error]:", err);
           prompt = `(Erro na leitura do anexo "${attachedFile.name}"). ${userMessage}`;
      }
    } 
    // 2. Contexto de Cotações (Web Search Mock)
    else if (commodityKeywords.some(kw => lower.includes(kw))) {
      const searchResults = await fetchWebSearchResults(userMessage);
      prompt += `\n\n**DADOS DE BUSCA WEB (Cotações):**\n${searchResults}`;
    }

    // 3. Contexto de Banco de Dados (Firestore)
    const collectionsToAnalyze = new Set();
    let isGenericQuery = false;

    for (const keyword in analysisKeywords) {
        if (lower.includes(keyword)) {
            const collectionOrFlag = analysisKeywords[keyword];
            if (collectionOrFlag === 'all') {
                isGenericQuery = true;
                break; 
            }
            if (Array.isArray(collectionOrFlag)) {
                collectionOrFlag.forEach(col => collectionsToAnalyze.add(col));
            } else {
                collectionsToAnalyze.add(collectionOrFlag);
            }
        }
    }
    
    if (userUid && !isGenericQuery && collectionsToAnalyze.size > 0) {
      const dataContext = {};

      await Promise.all(Array.from(collectionsToAnalyze).map(async (col) => {
          try {
            // Limite de 10 docs recentes para economizar tokens e leitura
            const q = query(collection(db, 'users', userUid, col), orderBy('criadoEm', 'desc'), limit(10));
            const snap = await getDocs(q);
            if (!snap.empty) {
              dataContext[col] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
          } catch (e) {
            // Falha silenciosa em coleções inexistentes ou sem permissão
          }
      }));

      if (Object.keys(dataContext).length) {
        prompt += `\n\n**DADOS DO SISTEMA (Firestore JSON):**\n${JSON.stringify(dataContext)}`;
      } else {
        prompt += '\n\n(Nenhum dado recente encontrado no sistema para esta análise).';
      }
    } else if (isGenericQuery) {
        prompt += '\n\n(Usuário solicitou análise genérica. Solicite especificidade).';
    }
    return prompt;
  }, [analysisKeywords, commodityKeywords, attachedFile, location]);

  // ---------------------------------------------------------------------
  // 9️⃣ INTERAÇÃO COM GROQ SDK
  // ---------------------------------------------------------------------
  const getGroqResponse = useCallback(async (userMessage) => {
    abortControllerRef.current?.abort();
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    const contextualPrompt = await buildContextualPrompt(userMessage);
    
    const apiMessages = [
        { role: 'system', content: systemInstruction },
        ...messages.filter(m => m.id !== 'err-key').map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text 
        })),
        { role: 'user', content: contextualPrompt }
    ];

    try {
      const groq = new Groq({
          apiKey: GROQ_API_KEY,
          dangerouslyAllowBrowser: true // Habilitado para Expo Client-Side (Cuidado em Produção Web)
      });

      const completion = await groq.chat.completions.create({
          messages: apiMessages,
          model: groqModel,
          temperature: 0.5,
          response_format: { type: "json_object" }, // Força saída JSON
      }, { 
          signal: abortCtrl.signal 
      });

      return completion.choices[0]?.message?.content || "";

    } catch (e) {
      if (e.name === 'AbortError') return null;
      console.error('[Groq API Error]:', e);
      throw new Error('Falha na comunicação com a IA. Tente novamente.');
    }
  }, [buildContextualPrompt, messages, systemInstruction, groqModel]);

  // ---------------------------------------------------------------------
  // 🔟 HANDLERS DE UI
  // ---------------------------------------------------------------------
  const validateUserMessage = useCallback((msg) => {
    const trimmed = msg.trim();
    if (!trimmed || trimmed.length > 5000) return false;
    return true;
  }, []);

  const handleSend = useCallback(async (customMessage) => {
    const messageText = (customMessage ?? inputText).trim();
    
    if (loadingChat || (!validateUserMessage(messageText) && !attachedFile)) return;

    if (commodityKeywords.some(kw => messageText.toLowerCase().includes(kw)) && !location) {
      requestLocation();
    }

    const userMsg = { id: Date.now().toString(), text: messageText, sender: 'user', attachedFile };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setAttachedFile(null);
    setLoadingChat(true);
    setMessages(prev => [...prev, { id: 'typing-indicator', sender: 'bot', type: 'typing' }]);

    try {      
      const responseRaw = await getGroqResponse(messageText);
      
      setMessages(prev => prev.filter(m => m.id !== 'typing-indicator'));

      if (responseRaw === null) { 
        setLoadingChat(false); 
        return;
      }

      let parsed = {};
      try {
        parsed = JSON.parse(responseRaw);
      } catch (jsonErr) {
        console.warn("Falha no parse JSON da IA, fallback para raw string:", jsonErr);
        parsed = { reply: responseRaw, chartUrl: null };
      }

      const botMsg = { 
          id: Date.now().toString() + '-bot', 
          text: parsed.reply || "Recebi os dados, mas não consegui processar a resposta textual.", 
          sender: 'bot', 
          chartUrl: safeUrl(parsed.chartUrl) 
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== 'typing-indicator'));
      const errorMsg = { id: Date.now().toString() + 'err', text: err.message || "Erro desconhecido.", sender: 'bot' };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoadingChat(false);
    }
  }, [inputText, loadingChat, getGroqResponse, attachedFile, requestLocation, commodityKeywords, location, validateUserMessage]);

  const handleAttachFile = useCallback(async () => {
    try {
      const result = await common.DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/csv', 'text/plain', 'text/xml'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled) setAttachedFile(result.assets[0]);
    } catch (error) {
      common.Alert.alert('Erro', 'Falha ao anexar arquivo.');
    }
  }, []);

  const handleClearChat = useCallback(() => {
    common.Alert.alert(
      'Limpar Histórico',
      'Deseja realmente apagar toda a conversa?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: () => {
             setMessages([]); 
             setChatMode(MODES.WELCOME);
        }}
      ]
    );
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(timer);
  }, [messages, loadingChat]);

  useEffect(() => {
    initializeChat();
    return () => abortControllerRef.current?.abort();
  }, [initializeChat]);

  // ---------------------------------------------------------------------
  // 1️⃣1️⃣ SUB-COMPONENTES UI
  // ---------------------------------------------------------------------

  const MessageItem = React.memo(({ item }) => {
    if (item.type === 'typing') {
        return (
            <common.View style={common.styles.typingBubble}>
                <common.ActivityIndicator size="small" color={common.theme.colors.primary} />
            </common.View>
        );
    }

    return (
        <common.View style={[
            common.styles.messageBubble,
            item.sender === 'user' ? common.styles.userMessage : common.styles.botMessage
        ]}>
            {item.attachedFile && (
                <common.View style={common.styles.attachedFileBubble}>
                    <common.Icon name="document-text-outline" size={18} color={common.theme.colors.secondaryText} />
                    <common.Text style={common.styles.attachedFileText} numberOfLines={1}>{item.attachedFile.name}</common.Text>
                </common.View>
            )}
            <common.MarkdownDisplay style={{
                body: item.sender === 'user'
                    ? common.styles.userMessageText
                    : { ...common.styles.botMessageText, color: common.theme.colors.textBlack }
            }}>
                {item.text}
            </common.MarkdownDisplay>
            {item.chartUrl && (
                <common.Image source={{ uri: item.chartUrl }} style={common.styles.chartImage} />
            )}
        </common.View>
    );
  });

  const SettingsView = React.memo(({ isVisible, onClose }) => {
      if (!isVisible) return null;
      return (
          <common.View style={common.styles.settingsContainer}>
              <common.View style={common.styles.settingsHeader}>
                  <common.Text style={common.styles.settingsTitle}>Configurações</common.Text>
                  <common.TouchableOpacity onPress={onClose}>
                      <common.Icon name="close" size={24} color="#666" />
                  </common.TouchableOpacity>
              </common.View>

              <common.View style={common.styles.settingsSection}>
                  <common.Text style={common.styles.formLabel}>Modelo de IA</common.Text>
                  <common.Picker selectedValue={groqModel} onValueChange={setGroqModel}>
                      <common.Picker.Item label="Llama 3.3 70B (Versátil)" value={MODELS.SMART} />
                      <common.Picker.Item label="Llama 3.1 8B (Instantâneo)" value={MODELS.FAST} />
                  </common.Picker>
              </common.View>

              <common.View style={common.styles.settingsSection}>
                  <common.Text style={common.styles.formLabel}>Localização</common.Text>
                  <common.Text style={common.styles.locationText}>
                      {location ? `Lat: ${location.coords.latitude.toFixed(2)}, Lon: ${location.coords.longitude.toFixed(2)}` : "Não definida"}
                  </common.Text>
                  <common.View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <common.TouchableOpacity 
                          style={[common.styles.formButton, { flex: 1, backgroundColor: common.theme.colors.secondary }]} 
                          onPress={requestLocation}
                          disabled={loadingLocation}
                      >
                          {loadingLocation ? <common.ActivityIndicator color="#fff"/> : <common.Text style={common.styles.buttonText}>Atualizar GPS</common.Text>}
                      </common.TouchableOpacity>
                      {location && (
                          <common.TouchableOpacity 
                              style={[common.styles.formButton, { flex: 1, backgroundColor: common.theme.colors.error }]} 
                              onPress={clearLocation}
                          >
                              <common.Text style={common.styles.buttonText}>Limpar</common.Text>
                          </common.TouchableOpacity>
                      )}
                  </common.View>
              </common.View>
          </common.View>
      );
  });
  
  const WelcomeView = React.memo(({ onModeChange }) => (
    <common.View style={common.styles.chatbotWelcomeContainer}>
        <common.View style={{ alignItems: 'center', width: '100%' }}>
            <common.MaterialCommunityIcons name="robot-happy-outline" size={64} color={common.theme.colors.primary} />
            <common.Text style={common.styles.chatbotWelcomeTitle}>Olá! Sou a AgronomIA</common.Text>
            <common.Text style={common.styles.chatbotWelcomeSubtitle}>Sua assistente para o agronegócio. Como posso ajudar hoje?</common.Text>
        </common.View>
        <common.View style={{width: '100%', marginTop: 32}}>
            <common.TouchableOpacity style={common.styles.chatbotPromptCard} onPress={() => onModeChange(MODES.AI)}>
                <common.Text style={common.styles.chatbotPromptCardText}>Fazer uma pergunta por texto ou voz</common.Text>
                <common.Icon name="chatbubbles-outline" size={24} color={common.theme.colors.primary} />
            </common.TouchableOpacity>
            <common.TouchableOpacity style={common.styles.chatbotPromptCard} onPress={() => onModeChange(MODES.OPTIONS)}>
                <common.Text style={common.styles.chatbotPromptCardText}>Ver ações rápidas</common.Text>
                <common.Icon name="flash-outline" size={24} color={common.theme.colors.primary} />
            </common.TouchableOpacity>
        </common.View>
    </common.View>
  ));

  const OptionsView = React.memo(({ onOptionSelect }) => {
    const analysisOptions = useMemo(() => [
      { label: 'Cotação Soja',  query: 'Qual a cotação da soja hoje?', icon: 'trending-up-outline' },
      { label: 'Histórico Chuva', query: 'Relatório do meu histórico de chuva', icon: 'rainy-outline' },
      { label: 'Estoque', query: 'Análise do meu estoque geral', icon: 'archive-outline' },
      { label: 'Consumo Diesel', query: 'Análise do consumo de diesel', icon: 'speedometer-outline' },
    ], []);
J
    const helpOptions = useMemo(() => [
      { label: 'Adicionar Plantio', query: 'Como faço para registrar um novo plantio?', icon: 'add-circle-outline' },
      { label: 'Adicionar Colheita', query: 'Como registro uma colheita?', icon: 'add-circle-outline' },
      { label: 'Registrar Chuva', query: 'Como registro a medição do pluviômetro?', icon: 'add-circle-outline' },
      { label: 'Calendário Agrícola', query: 'Qual o calendário agrícola recomendado para minha região?', icon: 'calendar-outline' },
      { label: 'Segurança no Campo', query: 'Quais são as normas de segurança para operadores de máquinas agrícolas?', icon: 'shield-checkmark-outline' },
      { label: 'Nutrição de Plantas', query: 'Quais os principais nutrientes para o desenvolvimento da soja?', icon: 'nutrition-outline' },
      { label: 'Mercado Agrícola', query: 'Quais as tendências atuais do mercado agrícola?', icon: 'analytics-outline' },
    ], []);

    return (
        <common.ScrollView contentContainerStyle={{ padding: 10 }}>
            <common.Text style={common.styles.formSectionTitle}>Análises Rápidas</common.Text>
            <common.View style={common.styles.quickOptionsGrid}>
                {analysisOptions.map(item => (
                    <common.TouchableOpacity key={item.label} style={common.styles.chatbotQuickOption} onPress={() => onOptionSelect(item.query)}>
                        <common.Icon name={item.icon} size={28} color={common.theme.colors.primary} />
                        <common.Text style={common.styles.chatbotQuickOptionText}>{item.label}</common.Text>
                    </common.TouchableOpacity>
                ))}
            </common.View>
            <common.Text style={common.styles.formSectionTitle}>Ajuda e Dicas</common.Text>
            <common.View style={common.styles.quickOptionsGrid}>
                {helpOptions.map(item => (
                    <common.TouchableOpacity key={item.label} style={common.styles.chatbotQuickOption} onPress={() => onOptionSelect(item.query)}>
                        <common.Icon name={item.icon} size={28} color={common.theme.colors.primary} />
                        <common.Text style={common.styles.chatbotQuickOptionText}>{item.label}</common.Text>
                    </common.TouchableOpacity>
                ))}
            </common.View>
        </common.ScrollView>
    );
  });

  // ---------------------------------------------------------------------
  // 1️⃣2️⃣ RENDER PRINCIPAL
  // ---------------------------------------------------------------------
  return (
    <common.KeyboardAvoidingView behavior={common.Platform.OS === 'ios' ? 'padding' : 'height'} style={common.styles.chatbotPopupContainer}>
      {/* HEADER */}
      <common.View style={common.styles.chatbotHeader}>
        <common.View style={common.styles.chatbotHeaderLeft}>
          {chatMode !== MODES.WELCOME && (
            <common.TouchableOpacity onPress={() => setChatMode(MODES.WELCOME)} style={{ marginRight: 8 }}>
              <common.Icon name="arrow-back" size={24} color={common.theme.colors.secondaryText} />
            </common.TouchableOpacity>
          )}
          <common.Text style={common.styles.chatbotTitle}>
             AgronomIA {isRecording && <common.Text style={{color: 'red', fontSize: 12}}>● Gravando...</common.Text>}
          </common.Text>
        </common.View>
        <common.View style={common.styles.chatbotHeaderRight}>
            <common.TouchableOpacity onPress={() => setIsSettingsVisible(true)} style={{ marginRight: 15 }}>
                <common.Icon name="settings-outline" size={22} color={common.theme.colors.secondaryText} />
            </common.TouchableOpacity>
            {messages.length > 0 && chatMode === MODES.AI && (
              <common.TouchableOpacity onPress={handleClearChat} style={{ marginRight: 15 }}>
                  <common.Icon name="trash-outline" size={22} color={common.theme.colors.secondaryText} />
              </common.TouchableOpacity>
            )}
            <common.TouchableOpacity onPress={onClose}>
                <common.Icon name="close" size={24} color={common.theme.colors.secondaryText} />
            </common.TouchableOpacity>
        </common.View>
      </common.View>

      {/* VIEWS */}
      {chatMode === MODES.WELCOME && <WelcomeView onModeChange={setChatMode} />}
      {chatMode === MODES.OPTIONS && <OptionsView onOptionSelect={(q) => { setChatMode(MODES.AI); handleSend(q); }} />}
      
      {chatMode === MODES.AI && (
          <>
            <common.FlatList
              ref={flatListRef}
              data={messages}
              renderItem={({ item }) => <MessageItem item={item} />}
              keyExtractor={(item) => item.id}
              style={common.styles.chatContainer}
              contentContainerStyle={{ paddingBottom: 10 }}
            />
            
            <common.View style={common.styles.chatInputContainer}>
              {attachedFile && (
                  <common.View style={common.styles.attachmentPreview}>
                      <common.Icon name="document-text" size={20} color={common.theme.colors.primary} />
                      <common.Text style={common.styles.attachmentPreviewText} numberOfLines={1}>{attachedFile.name}</common.Text>
                      <common.TouchableOpacity onPress={() => setAttachedFile(null)}>
                          <common.Icon name="close-circle" size={22} color="#666" />
                      </common.TouchableOpacity>
                  </common.View>
              )}

              <common.TouchableOpacity style={common.styles.chatIconButton} onPress={handleAttachFile} disabled={loadingChat || isRecording}>
                <common.Icon name="attach" size={24} color={common.theme.colors.secondaryText} />
              </common.TouchableOpacity>
              
              <common.TextInput
                style={common.styles.chatInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder={isRecording ? "Gravando áudio..." : attachedFile ? "Comente o arquivo..." : "Digite ou segure o mic..."}
                onSubmitEditing={() => handleSend()}
                multiline
                editable={!loadingChat && !isRecording && !loadingAudio}
              />
              
              {(inputText.trim().length > 0 || attachedFile) ? (
                  <common.TouchableOpacity style={common.styles.chatbotSendButton} onPress={() => handleSend()} disabled={loadingChat}>
                    <common.Icon name="send" size={22} color="white" />
                  </common.TouchableOpacity>
              ) : (
                  <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                    <common.TouchableOpacity 
                      style={[common.styles.chatbotSendButton, isRecording && { backgroundColor: 'red' }]} 
                      onPressIn={startRecording}
                      onPressOut={stopRecording}
                      disabled={loadingChat || loadingAudio}
                    >
                      {loadingAudio ? <common.ActivityIndicator color="white" size="small"/> : <common.Icon name={isRecording ? "mic-off" : "mic"} size={22} color="white" />}
                    </common.TouchableOpacity>
                  </Animated.View>
              )}
            </common.View>
          </>
      )}
      
      <SettingsView isVisible={isSettingsVisible} onClose={() => setIsSettingsVisible(false)} />
    </common.KeyboardAvoidingView>
  );
};