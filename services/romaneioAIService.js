/**
 * romaneioAIService.js
 * Serviço de Inteligência Artificial da AgronomIA para leitura e extração
 * automática de dados de Romaneios de Grãos (Tickets de Pesagem) via Groq Cloud Vision & LLM.
 */

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Modelos do Groq
const VISION_MODEL_PRIMARY = 'qwen/qwen3.6-27b';
const VISION_MODEL_FALLBACK = 'qwen/qwen3.6-27b';

/**
 * Converte um arquivo (File/Blob) em Base64 Data URL
 */
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

/**
 * Carrega a biblioteca PDF.js dinamicamente se necessário e renderiza a primeira página do PDF em imagem Base64
 */
export const renderPdfFirstPageToBase64 = async (pdfFile) => {
    try {
        const arrayBuffer = await pdfFile.arrayBuffer();

        // Verifica se window.pdfjsLib já existe, caso contrário carrega via CDN dinâmico
        if (!window.pdfjsLib) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                script.onload = () => {
                    if (window.pdfjsLib) {
                        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                        resolve();
                    } else {
                        reject(new Error("Falha ao inicializar pdfjsLib."));
                    }
                };
                script.onerror = () => reject(new Error("Erro ao carregar script do PDF.js"));
                document.head.appendChild(script);
            });
        }

        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        // Renderiza com escala 2.0 para alta nitidez na visão da IA
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        await page.render(renderContext).promise;

        return canvas.toDataURL('image/jpeg', 0.92);
    } catch (error) {
        console.warn("Renderização via PDF.js falhou, tentando fallback:", error);
        throw error;
    }
};

/**
 * Prompt especialista de Agronomia para análise de Romaneios brasileiros
 */
const AGRONOMIA_ROMANEIO_PROMPT = `
Você é a AgronomIA, especialista de Inteligência Artificial da W3Labs em agronegócio e pesagem de grãos no Brasil.
Analise a imagem deste ROMANEIO DE GRÃOS / TICKET DE PESAGEM / COMPROVANTE DE ENTREGA DA SAFRA.

Extraia com máxima precisão os dados técnicos do romaneio e retorne ESTRITAMENTE um objeto JSON válido, sem texto antes ou depois, seguindo este formato exato:

{
  "cultura": "Soja" | "Milho" | "Trigo" | "Algodão" | "Café" | "Feijão" | "Arroz" | "Outro",
  "talhao": "string com o talhão, fazenda ou lote identificado (ex: Talhão 02) ou vazio se não houver",
  "pesoBrutoKg": number ou null,
  "taraKg": number ou null,
  "pesoLiquidoKg": number ou null,
  "pesoLiquidoFinalKg": number ou null,
  "pesoTotalKg": number ou null (o peso líquido principal da carga a ser computado),
  "pesoTotalSacas": number ou null (total em sacas de 60kg, calculado se não estiver explícito: pesoTotalKg / 60),
  "umidade": number ou null (em %, ex: 13.8),
  "impureza": number ou null (em %, ex: 1.0),
  "avariados": number ou null (em %, ex: 2.5),
  "quebrados": number ou null (em %, ex: 1.2),
  "descontosTotaisKg": number ou null (total de descontos em kg),
  "destino": "string com nome do armazém, silo, cooperativa ou comprador (ex: Coamo, Cargill, Bunge, Silo Sede)",
  "numeroRomaneio": "string com o número do romaneio, ticket ou documento (ex: 849201)",
  "placaVeiculo": "string com a placa do caminhão/veículo (ex: ABC-1234 ou ABC1D23) ou vazio",
  "motorista": "nome do motorista/transportador se identificado ou vazio",
  "dataColheita": "YYYY-MM-DD (data da pesagem/emissão no formato ano-mês-dia. Ex: 2025-03-15. Se só tiver dia/mês/ano brasileiro, converta)",
  "observacoes": "string resumida com os detalhes encontrados como: Ticket nº X, Placa Y, Descontos Z, etc.",
  "confianca": "alta" | "media" | "baixa"
}

Regras importantes:
1. Retorne APENAS o JSON puro. Não use delimitadores extras se puder, ou use bloco json puro.
2. Certifique-se de que os números sejam números puros no JSON (ex: 32450 e não "32.450 kg").
3. Se um campo não estiver visível ou não existir no romaneio, use null ou "" (string vazia).
4. O campo "pesoTotalKg" deve ser o Peso Líquido faturado/entregue. Se houver peso líquido e peso com descontos, priorize o peso final entregue líquido.
5. Calcule o peso em sacas dividindo o peso total por 60 caso não venha expresso em sacas.
`;

/**
 * Envia uma imagem (base64) para o Groq Vision e retorna os dados estruturados do Romaneio
 */
export const processRomaneioWithGroqVision = async (base64Image) => {
    if (!GROQ_API_KEY) {
        throw new Error("Chave da API do Groq (EXPO_PUBLIC_GROQ_API_KEY) não configurada no arquivo .env.");
    }

    // Prepara payload de Visão
    const payload = {
        model: VISION_MODEL_PRIMARY,
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: AGRONOMIA_ROMANEIO_PROMPT
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: base64Image
                        }
                    }
                ]
            }
        ],
        temperature: 0.1,
        max_tokens: 1024
    };

    let response;
    try {
        response = await fetch(GROQ_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        // Fallback de modelo se o modelo primário estiver indisponível
        if (!response.ok && response.status !== 401) {
            console.warn(`Groq Vision primário falhou (${response.status}), tentando fallback...`);
            payload.model = VISION_MODEL_FALLBACK;
            response = await fetch(GROQ_BASE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                },
                body: JSON.stringify(payload)
            });
        }

        if (!response.ok) {
            const errorJson = await response.json().catch(() => ({}));
            throw new Error(errorJson.error?.message || `Erro ${response.status}: Falha ao processar imagem no Groq.`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error("Resposta vazia da IA.");
        }

        return parseAiJsonResponse(content);
    } catch (err) {
        console.error("Erro no processamento de visão do Romaneio:", err);
        throw err;
    }
};

/**
 * Processa qualquer arquivo de Romaneio (Imagem ou PDF)
 * @param {File|Blob} file 
 * @returns {Promise<Object>} Dados do romaneio normalizados
 */
export const analyzeRomaneioFile = async (file) => {
    if (!file) throw new Error("Nenhum arquivo fornecido.");

    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
    let base64Image = null;

    if (isPdf) {
        try {
            base64Image = await renderPdfFirstPageToBase64(file);
        } catch (pdfErr) {
            console.warn("Não foi possível renderizar PDF em canvas, tentando leitura direta:", pdfErr);
            base64Image = await fileToBase64(file);
        }
    } else {
        base64Image = await fileToBase64(file);
    }

    const extracted = await processRomaneioWithGroqVision(base64Image);
    return normalizeRomaneioData(extracted);
};

/**
 * Limpa e extrai JSON da resposta da IA
 */
const parseAiJsonResponse = (text) => {
    try {
        // Tenta parse direto
        return JSON.parse(text);
    } catch {
        // Remove blocos ```json ... ``` ou ``` ... ```
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (jsonMatch && jsonMatch[1]) {
            try {
                return JSON.parse(jsonMatch[1]);
            } catch (e) {
                console.error("Falha ao parsear bloco JSON regex:", e);
            }
        }

        // Tenta encontrar o primeiro { e o último }
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const rawJson = text.substring(firstBrace, lastBrace + 1);
            return JSON.parse(rawJson);
        }

        throw new Error("Não foi possível interpretar os dados retornados pela IA.");
    }
};

/**
 * Normaliza e complementa os dados do Romaneio extraído
 */
export const normalizeRomaneioData = (raw) => {
    if (!raw || typeof raw !== 'object') return {};

    const cultura = raw.cultura || 'Soja';
    const talhao = raw.talhao || '';
    
    // Pesos
    let pesoTotalKg = parseFloat(raw.pesoTotalKg || raw.pesoLiquidoFinalKg || raw.pesoLiquidoKg || 0);
    let pesoTotalSacas = parseFloat(raw.pesoTotalSacas || 0);

    if (pesoTotalKg > 0 && (!pesoTotalSacas || pesoTotalSacas <= 0)) {
        pesoTotalSacas = parseFloat((pesoTotalKg / 60).toFixed(2));
    } else if (pesoTotalSacas > 0 && (!pesoTotalKg || pesoTotalKg <= 0)) {
        pesoTotalKg = parseFloat((pesoTotalSacas * 60).toFixed(0));
    }

    const umidade = raw.umidade !== null && raw.umidade !== undefined ? String(raw.umidade) : '14';
    const impureza = raw.impureza !== null && raw.impureza !== undefined ? String(raw.impureza) : '1';
    const destino = raw.destino || '';
    
    let dataColheita = raw.dataColheita || new Date().toISOString().split('T')[0];
    // Valida formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataColheita)) {
        try {
            const parsed = new Date(dataColheita);
            if (!isNaN(parsed.getTime())) {
                dataColheita = parsed.toISOString().split('T')[0];
            } else {
                dataColheita = new Date().toISOString().split('T')[0];
            }
        } catch {
            dataColheita = new Date().toISOString().split('T')[0];
        }
    }

    // Observações estruturadas
    const detalhes = [];
    if (raw.numeroRomaneio) detalhes.push(`Romaneio: ${raw.numeroRomaneio}`);
    if (raw.placaVeiculo) detalhes.push(`Placa: ${raw.placaVeiculo}`);
    if (raw.motorista) detalhes.push(`Motorista: ${raw.motorista}`);
    if (raw.descontosTotaisKg) detalhes.push(`Descontos: ${raw.descontosTotaisKg} kg`);
    if (raw.avariados) detalhes.push(`Avariados: ${raw.avariados}%`);
    if (raw.quebrados) detalhes.push(`Quebrados: ${raw.quebrados}%`);

    let observacoes = raw.observacoes || '';
    if (detalhes.length > 0 && !observacoes.includes(raw.numeroRomaneio || '---')) {
        observacoes = [observacoes, detalhes.join(' | ')].filter(Boolean).join('\n');
    }

    return {
        cultura,
        talhao,
        pesoTotalKg: pesoTotalKg > 0 ? String(pesoTotalKg) : '',
        pesoTotalSacas: pesoTotalSacas > 0 ? String(pesoTotalSacas) : '',
        pesoBrutoKg: raw.pesoBrutoKg ? String(raw.pesoBrutoKg) : '',
        taraKg: raw.taraKg ? String(raw.taraKg) : '',
        pesoLiquidoKg: raw.pesoLiquidoKg ? String(raw.pesoLiquidoKg) : '',
        umidade,
        impureza,
        destino,
        dataColheita,
        observacoes,
        numeroRomaneio: raw.numeroRomaneio || '',
        placaVeiculo: raw.placaVeiculo || '',
        motorista: raw.motorista || '',
        descontosTotaisKg: raw.descontosTotaisKg ? String(raw.descontosTotaisKg) : '',
        confianca: raw.confianca || 'alta',
        resumo: raw.resumo || ''
    };
};
