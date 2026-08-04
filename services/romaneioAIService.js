import { extractTextFromPdf, prepareFileForVision, processTextWithMetaLlama, processImageWithVision, AGRONOMIA_ROMANEIO_PROMPT } from './agroDocumentAIService';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

/**
 * Processa qualquer arquivo de Romaneio (Imagem ou PDF)
 * @param {File|Blob} file 
 * @returns {Promise<Object>} Dados do romaneio normalizados
 */
export const analyzeRomaneioFile = async (file) => {
    if (!file) throw new Error("Nenhum arquivo fornecido.");

    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
    let extracted = null;

    if (isPdf) {
        const text = await extractTextFromPdf(file);
        if (text && text.length > 50) {
            try {
                extracted = await processTextWithMetaLlama(text, AGRONOMIA_ROMANEIO_PROMPT);
            } catch (err) {
                console.warn("Processamento de texto do romaneio falhou, tentando visão:", err);
            }
        }
    }

    if (!extracted) {
        const base64Image = await prepareFileForVision(file);
        extracted = await processImageWithVision(base64Image, AGRONOMIA_ROMANEIO_PROMPT);
    }

    return normalizeRomaneioData(extracted);
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

    return {
        cultura,
        talhao,
        numeroRomaneio: raw.numeroRomaneio || `ROM-${Math.floor(100000 + Math.random() * 900000)}`,
        pesoBrutoKg: parseFloat(raw.pesoBrutoKg || 0),
        taraKg: parseFloat(raw.taraKg || 0),
        pesoLiquidoKg: parseFloat(raw.pesoLiquidoKg || pesoTotalKg),
        pesoTotalKg,
        pesoTotalSacas,
        umidade,
        impureza,
        avariados: raw.avariados !== null && raw.avariados !== undefined ? String(raw.avariados) : '0',
        descontosTotaisKg: parseFloat(raw.descontosTotaisKg || 0),
        pesoLiquidoFinalKg: parseFloat(raw.pesoLiquidoFinalKg || pesoTotalKg),
        destino,
        placaVeiculo: raw.placaVeiculo || '',
        motorista: raw.motorista || '',
        dataColheita,
        observacoes: raw.observacoes || 'Extraído via IA AgronomIA W3Labs'
    };
};
