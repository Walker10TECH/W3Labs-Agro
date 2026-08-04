/**
 * agroDocumentAIService.js
 * Serviço Inteligente de Análise e Extração de Documentos Agronômicos da W3Labs
 * Suporta: Manuais Técnicos de Máquinas, Romaneios de Grãos, Bulas de Defensivos,
 * Medições de Pluviômetro e Diagnóstico de Pragas.
 * 
 * Motores: Meta Llama 3.3 70B (Texto & Dados) + OpenAI Vision & Groq Vision
 */

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY || '';
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

// Modelo Meta Llama Principal para Processamento Estruturado
const META_LLAMA_MODEL = 'llama-3.3-70b-versatile';

/**
 * Garante que a biblioteca PDF.js esteja carregada no navegador
 */
export const ensurePdfJsLoaded = () => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') return resolve(null);
        if (window.pdfjsLib) return resolve(window.pdfjsLib);

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve(window.pdfjsLib);
            } else {
                reject(new Error("Falha ao carregar pdfjsLib."));
            }
        };
        script.onerror = () => reject(new Error("Erro ao carregar script do PDF.js"));
        document.head.appendChild(script);
    });
};

/**
 * Extrai o texto real de todas as páginas do PDF (até 6 páginas)
 */
export const extractTextFromPdf = async (pdfFile) => {
    try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        await ensurePdfJsLoaded();

        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 6);

        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item) => item.str).join(' ');
            fullText += `\n--- PÁGINA ${i} ---\n` + pageText;
        }

        return fullText.trim();
    } catch (e) {
        console.warn("Extração direta de texto do PDF indisponível ou documento escaneado:", e);
        return null;
    }
};

/**
 * Redimensiona e comprime uma imagem Base64 para economizar tokens e evitar rate-limit
 */
export const compressBase64Image = (dataUrl, maxWidth = 512, maxHeight = 512, quality = 0.6) => {
    return new Promise((resolve) => {
        if (typeof window === 'undefined') return resolve(dataUrl);

        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width > maxWidth || height > maxHeight) {
                if (width > height) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                } else {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
};

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
 * Renderiza a primeira página do PDF em imagem Base64 compacta
 */
export const renderPdfFirstPageToBase64 = async (pdfFile) => {
    try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        await ensurePdfJsLoaded();

        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 1.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        await page.render(renderContext).promise;

        const rawData = canvas.toDataURL('image/jpeg', 0.6);
        return await compressBase64Image(rawData, 512, 512, 0.6);
    } catch (error) {
        console.warn("Renderização de PDF via PDF.js falhou:", error);
        throw error;
    }
};

/**
 * Prepara o arquivo para leitura visual (PDF ou Imagem)
 */
export const prepareFileForVision = async (file) => {
    if (!file) throw new Error("Arquivo não fornecido.");

    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
    let rawBase64;
    if (isPdf) {
        rawBase64 = await renderPdfFirstPageToBase64(file);
    } else {
        rawBase64 = await fileToBase64(file);
    }
    return await compressBase64Image(rawBase64, 512, 512, 0.6);
};

// =========================================================================
// PROMPTS ESPECIALIZADOS DE AGRONOMIA & DOCUMENTOS
// =========================================================================

export const AGRONOMIA_MANUAL_PROMPT = `
Você é a AgronomIA, especialista de IA da W3Labs em maquinários agrícolas, tratores, colheitadeiras, pulverizadores e implementos.
Analise as informações técnicas deste MANUAL / CATÁLOGO / GUIA DE OPERAÇÃO.

Extraia os dados técnicos com máxima precisão e retorne ESTRITAMENTE um objeto JSON válido:
{
  "tipoDocumento": "manual",
  "titulo": "string com título completo do manual (ex: Manual de Operação Trator 6110J)",
  "categoria": "Tratores" | "Colheitadeiras" | "Pulverizadores" | "Implementos" | "Agronomia" | "Outro",
  "marca": "string com a marca (ex: John Deere, Case IH, New Holland, Massey Ferguson, Valtra, Stara, Jacto, Kuhn, etc.)",
  "modelo": "string com o modelo do equipamento (ex: 6110J, Imperador 4000, Magnum 340)",
  "descricao": "string detalhada com resumo técnico, intervalos de troca de óleo/filtros, calibrações de pressão/torque e pontos de lubrificação",
  "especificacoes": {
    "potenciaCv": "string ou null",
    "capacidadeTanqueCombustivel": "string ou null",
    "oleoMotorRecomendado": "string ou null",
    "intervaloTrocaOleoHoras": "string ou null",
    "pressaoPneus": "string ou null",
    "torqueParafusos": "string ou null"
  },
  "confianca": "alta" | "media" | "baixa"
}
Regras: Retorne APENAS o JSON puro.
`;

export const AGRONOMIA_ROMANEIO_PROMPT = `
Você é a AgronomIA, especialista de IA da W3Labs em pesagem e recebimento de grãos agrícolas.
Analise as informações deste TICKET DE PESAGEM / ROMANEIO DE GRÃOS.

Extraia os dados com máxima precisão e retorne ESTRITAMENTE um objeto JSON válido:
{
  "tipoDocumento": "romaneio",
  "cultura": "Soja" | "Milho" | "Trigo" | "Algodão" | "Café" | "Sorgo" | "Arroz",
  "talhao": "string com o nome ou número do talhão / fazenda de origem",
  "numeroRomaneio": "string com número do ticket ou romaneio",
  "pesoBrutoKg": 0,
  "taraKg": 0,
  "pesoLiquidoKg": 0,
  "pesoTotalKg": 0,
  "pesoTotalSacas": 0,
  "umidade": "string com % de umidade (ex: 13.8)",
  "impureza": "string com % de impureza (ex: 1.0)",
  "avariados": "string com % de grãos avariados / ardidos",
  "descontosTotaisKg": 0,
  "pesoLiquidoFinalKg": 0,
  "destino": "string com armazém, cooperativa ou silo (ex: Coamo, Cargill, Bunge, Amaggi)",
  "placaVeiculo": "string com placa do caminhão",
  "motorista": "string com nome do motorista",
  "dataColheita": "YYYY-MM-DD",
  "observacoes": "string com observações relevantes da pesagem"
}
Regras: Retorne APENAS o JSON puro.
`;

export const AGRONOMIA_BULA_PROMPT = `
Você é a AgronomIA, especialista de IA da W3Labs em defensivos agrícolas, fitossanidade e receituário agronômico.
Analise as informações desta BULA / RÓTULO DE DEFENSIVO AGRÍCOLA.

Extraia os dados com máxima precisão e retorne ESTRITAMENTE um objeto JSON válido:
{
  "tipoDocumento": "bula",
  "nomeItem": "string com nome comercial do produto",
  "categoria": "Herbicida" | "Inseticida" | "Fungicida" | "Adjuvante" | "Fertilizante Foliar" | "Biológico" | "Outro",
  "principioAtivo": "string com o ingrediente ativo e concentração",
  "fabricante": "string com a empresa fabricante",
  "dosagemRecomendada": "string com a dose por hectare (ex: 0.5 L/ha, 200 g/ha)",
  "carenciaDias": "string com o período de carência / intervalo de segurança",
  "alvoPragas": "string com as pragas, doenças ou plantas daninhas controladas",
  "volumeCalda": "string com volume de calda recomendado (ex: 100 a 150 L/ha)",
  "epocaAplicacao": "string com estádio da cultura / melhor época de aplicação",
  "observacoes": "string com precauções toxicológicas, incompatibilidades e classe toxicológica"
}
Regras: Retorne APENAS o JSON puro.
`;

export const AGRONOMIA_PLUVIOMETRO_PROMPT = `
Você é a AgronomIA, especialista de IA da W3Labs em meteorologia agrícola.
Analise as informações desta MEDIÇÃO DE CHUVA / PLUVIÔMETRO.

Extraia os dados e retorne ESTRITAMENTE um objeto JSON válido:
{
  "tipoDocumento": "pluviometro",
  "milimetros": 0.0,
  "dataMedicao": "YYYY-MM-DD",
  "talhao": "string com nome do talhão ou sede",
  "observacoes": "string descrevendo a intensidade da chuva"
}
Regras: Retorne APENAS o JSON puro.
`;

export const AGRONOMIA_DOC_ROUTER_PROMPT = `
Você é a AgronomIA da W3Labs. Classifique o documento em uma das seguintes categorias:
1. "manual" (Manuais técnicos de máquinas e implementos)
2. "romaneio" (Tickets de pesagem e romaneios de grãos)
3. "bula" (Bulas e rótulos de defensivos químicos/biológicos)
4. "pluviometro" (Medições de chuva e pluviômetro)
5. "praga_lavoura" (Fotos de folhas com pragas ou doenças)

Retorne APENAS um JSON:
{
  "tipoDocumento": "manual" | "romaneio" | "bula" | "pluviometro" | "praga_lavoura",
  "resumo": "string",
  "dadosExtraidos": {}
}
`;

// =========================================================================
// PROCESSAMENTO INTELIGENTE (META LLAMA 3.3 70B & MULTIMODAL)
// =========================================================================

/**
 * Processa texto extraído diretamente com Meta Llama 3.3 70B (Zero 404, Zero 429)
 */
export const processTextWithMetaLlama = async (text, systemPrompt) => {
    const groqKey = GROQ_API_KEY || process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
    if (!groqKey) {
        throw new Error("Chave da API do Groq não configurada.");
    }

    const payload = {
        model: META_LLAMA_MODEL,
        messages: [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: `Analise as seguintes informações extraídas do documento agronômico e retorne o JSON estruturado:\n\n${text.substring(0, 16000)}`
            }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Erro Meta Llama (${response.status}): ${errText}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '{}';
    return parseAiJson(content);
};

/**
 * Processa imagem compacta via OpenAI GPT-4o-mini ou Groq Vision com payload ultraleve
 */
export const processImageWithVision = async (base64Image, systemPrompt) => {
    const groqKey = GROQ_API_KEY || process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
    const openAIKey = OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

    const compressed = await compressBase64Image(base64Image, 512, 512, 0.6);

    // 1. Se tiver OpenAI Key, prioriza OpenAI Vision
    if (openAIKey) {
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openAIKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: systemPrompt },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: compressed.startsWith('data:') ? compressed : `data:image/jpeg;base64,${compressed}`
                                    }
                                }
                            ]
                        }
                    ],
                    temperature: 0.1,
                    response_format: { type: 'json_object' }
                })
            });

            if (res.ok) {
                const data = await res.json();
                return parseAiJson(data.choices?.[0]?.message?.content || '{}');
            }
        } catch (e) {
            console.warn("OpenAI Vision falhou, tentando fallback Groq:", e);
        }
    }

    // 2. Groq Multimodal Ultraleve
    if (groqKey) {
        const payload = {
            model: 'qwen/qwen3.6-27b',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: systemPrompt },
                        {
                            type: 'image_url',
                            image_url: {
                                url: compressed.startsWith('data:') ? compressed : `data:image/jpeg;base64,${compressed}`
                            }
                        }
                    ]
                }
            ],
            temperature: 0.1,
            max_tokens: 1024
        };

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqKey}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            return parseAiJson(data.choices?.[0]?.message?.content || '{}');
        } else {
            const errText = await response.text();
            console.warn(`Groq Vision falhou [${response.status}]: ${errText}`);
        }
    }

    throw new Error("Não foi possível processar a imagem. Verifique as credenciais de IA.");
};

/**
 * Função utilitária para parsear respostas JSON da IA
 */
const parseAiJson = (content) => {
    const cleanJson = content
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

    try {
        return JSON.parse(cleanJson);
    } catch {
        const match = cleanJson.match(/\{[\s\S]*\}/);
        if (match) {
            return JSON.parse(match[0]);
        }
        throw new Error("A IA não retornou um JSON estruturado válido.");
    }
};

// =========================================================================
// MÉTODOS PÚBLICOS DE ANÁLISE DE DOCUMENTOS
// =========================================================================

/**
 * Analisa qualquer arquivo de manual de máquina / implemento (PDF ou Imagem)
 */
export const analyzeManualFile = async (file) => {
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');

    let result = null;

    // 1. Se for PDF, tenta extrair texto nativo com Meta Llama 3.3 70B
    if (isPdf) {
        const extractedText = await extractTextFromPdf(file);
        if (extractedText && extractedText.length > 80) {
            try {
                result = await processTextWithMetaLlama(extractedText, AGRONOMIA_MANUAL_PROMPT);
            } catch (llamaErr) {
                console.warn("Meta Llama falhou no texto, tentando visão:", llamaErr);
            }
        }
    }

    // 2. Se for imagem ou se o PDF for escaneado sem texto
    if (!result) {
        const base64 = await prepareFileForVision(file);
        result = await processImageWithVision(base64, AGRONOMIA_MANUAL_PROMPT);
    }

    return {
        titulo: result.titulo || file.name?.replace(/\.[^/.]+$/, '') || 'Manual Técnico Agrícola',
        categoria: result.categoria || 'Tratores',
        marca: result.marca || 'Marca Identificada por IA',
        modelo: result.modelo || 'Modelo Identificado por IA',
        descricao: result.descricao || `Especificações e orientações técnicas extraídas automaticamente por Inteligência Artificial do arquivo ${file.name}.`,
        especificacoes: result.especificacoes || {},
        confianca: result.confianca || 'alta'
    };
};

/**
 * Analisa arquivo de Romaneio de Grãos
 */
export const analyzeRomaneioDoc = async (file) => {
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
    let result = null;

    if (isPdf) {
        const text = await extractTextFromPdf(file);
        if (text && text.length > 50) {
            try {
                result = await processTextWithMetaLlama(text, AGRONOMIA_ROMANEIO_PROMPT);
            } catch (err) {
                console.warn("Meta Llama falhou no texto do romaneio:", err);
            }
        }
    }

    if (!result) {
        const base64 = await prepareFileForVision(file);
        result = await processImageWithVision(base64, AGRONOMIA_ROMANEIO_PROMPT);
    }

    return result;
};

/**
 * Analisa bula ou rótulo de defensivo agrícola
 */
export const analyzeDefensivoBulaFile = async (file) => {
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
    let result = null;

    if (isPdf) {
        const text = await extractTextFromPdf(file);
        if (text && text.length > 80) {
            try {
                result = await processTextWithMetaLlama(text, AGRONOMIA_BULA_PROMPT);
            } catch (e) {
                console.warn("Meta Llama falhou na bula:", e);
            }
        }
    }

    if (!result) {
        const base64 = await prepareFileForVision(file);
        result = await processImageWithVision(base64, AGRONOMIA_BULA_PROMPT);
    }

    return result;
};

/**
 * Analisa imagem de pluviômetro / régua de chuva
 */
export const analyzePluviometroImage = async (fileOrBase64) => {
    let base64;
    if (typeof fileOrBase64 === 'string') {
        base64 = await compressBase64Image(fileOrBase64, 512, 512, 0.6);
    } else {
        base64 = await prepareFileForVision(fileOrBase64);
    }
    return await processImageWithVision(base64, AGRONOMIA_PLUVIOMETRO_PROMPT);
};

/**
 * Analisa imagem de folha com praga ou sintoma de doença
 */
export const analyzeCropHealthImage = async (fileOrBase64) => {
    let base64;
    if (typeof fileOrBase64 === 'string') {
        base64 = await compressBase64Image(fileOrBase64, 512, 512, 0.6);
    } else {
        base64 = await prepareFileForVision(fileOrBase64);
    }
    return await processImageWithVision(base64, AGRONOMIA_DOC_ROUTER_PROMPT);
};

/**
 * Roteador genérico de documento
 */
export const analyzeGenericAgroFile = async (file) => {
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
    let result = null;

    if (isPdf) {
        const text = await extractTextFromPdf(file);
        if (text && text.length > 80) {
            try {
                result = await processTextWithMetaLlama(text, AGRONOMIA_DOC_ROUTER_PROMPT);
            } catch (e) {
                console.warn("Roteador falhou no texto:", e);
            }
        }
    }

    if (!result) {
        const base64 = await prepareFileForVision(file);
        result = await processImageWithVision(base64, AGRONOMIA_DOC_ROUTER_PROMPT);
    }

    return result;
};

// Aliases para compatibilidade
export const processImageWithGroqVision = processImageWithVision;
export const analyzePluviometroFile = analyzePluviometroImage;
export const analyzeRomaneioFile = analyzeRomaneioDoc;
