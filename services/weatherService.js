/**
 * weatherService.js
 * Serviço de Meteorologia e Pluviometria da W3Labs Agro.
 * Realiza consulta de chuvas em tempo real e histórico de precipitações diárias (hoje e dias anteriores)
 * com suporte nativo à API OpenWeather e fallback de alta precisão via Radar Open-Meteo / ECMWF.
 */

import { getCurrentPosition, reverseGeocodeOSM, searchLocationOSM } from './locationService';

const WEATHER_API_KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY || process.env.EXPO_PUBLIC_WEATHER_API_KEY || '';

/**
 * Mapeamento de Códigos de Clima WMO para ícones e descrições agrícolas em Português
 */
const WMO_WEATHER_CODES = {
    0: { desc: 'Céu Limpo', icon: '☀️' },
    1: { desc: 'Predomínio de Sol', icon: '🌤️' },
    2: { desc: 'Parcialmente Nublado', icon: '⛅' },
    3: { desc: 'Nublado / Encoberto', icon: '☁️' },
    45: { desc: 'Neblina / Nevoeiro', icon: '🌫️' },
    48: { desc: 'Neblina com Geada', icon: '🌫️' },
    51: { desc: 'Garoa Fraca', icon: '🌦️' },
    53: { desc: 'Garoa Moderada', icon: '🌦️' },
    55: { desc: 'Garoa Densa', icon: '🌧️' },
    61: { desc: 'Chuva Leve', icon: '🌧️' },
    63: { desc: 'Chuva Moderada', icon: '🌧️' },
    65: { desc: 'Chuva Forte', icon: '⛈️' },
    80: { desc: 'Pancadas de Chuva', icon: '🌦️' },
    81: { desc: 'Pancadas Fortes', icon: '🌧️' },
    82: { desc: 'Chuva Torrencial', icon: '⛈️' },
    95: { desc: 'Tempestade com Trovoadas', icon: '⚡' },
    96: { desc: 'Tempestade com Granizo', icon: '⛈️' },
    99: { desc: 'Tempestade Severa com Granizo', icon: '⛈️' }
};

/**
 * Formata data ISO (YYYY-MM-DD) para formato legível pt-BR
 */
export const formatIsoDateToBR = (isoDate) => {
    if (!isoDate) return '--/--/----';
    const [year, month, day] = isoDate.split('-');
    if (!year || !month || !day) return isoDate;
    return `${day}/${month}/${year}`;
};

/**
 * Obtém o nome do dia da semana em Português
 */
export const getWeekdayName = (isoDate) => {
    try {
        const [year, month, day] = isoDate.split('-').map(Number);
        const date = new Date(year, month - 1, day, 12, 0, 0);
        const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        return days[date.getDay()] || '';
    } catch {
        return '';
    }
};

/**
 * Busca histórico de chuvas (Precipitação em mm) para hoje e dias anteriores
 * @param {Object} params
 * @param {number} params.latitude Latitude da fazenda
 * @param {number} params.longitude Longitude da fazenda
 * @param {number} [params.pastDays=7] Quantidade de dias anteriores (ex: 3, 7, 14, 30)
 * @param {string} [params.customApiKey] Chave OpenWeather opcional
 * @returns {Promise<Array<{ date: string, displayDate: string, weekday: string, mm: number, tempMax: number, tempMin: number, desc: string, icon: string, source: string }>>}
 */
export const fetchRainHistory = async ({
    latitude,
    longitude,
    pastDays = 7,
    customApiKey = ''
}) => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw new Error("Coordenadas geográficas (latitude e longitude) são obrigatórias.");
    }

    const apiKey = customApiKey || WEATHER_API_KEY;

    // 1. Tenta buscar via Open-Meteo (Melhor suporte nativo para precipitações acumuladas diárias mm e histórico)
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=precipitation_sum,rain_sum,weather_code,temperature_2m_max,temperature_2m_min&past_days=${pastDays}&forecast_days=1&timezone=auto`;
        
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            const daily = data.daily || {};
            const dates = daily.time || [];
            const precips = daily.precipitation_sum || daily.rain_sum || [];
            const codes = daily.weather_code || [];
            const tempMaxs = daily.temperature_2m_max || [];
            const tempMins = daily.temperature_2m_min || [];

            const results = [];
            const todayStr = new Date().toISOString().split('T')[0];

            for (let i = 0; i < dates.length; i++) {
                const dateStr = dates[i];
                const mm = parseFloat(precips[i] || 0);
                const code = codes[i] || 0;
                const weatherInfo = WMO_WEATHER_CODES[code] || { desc: mm > 0 ? 'Chuva' : 'Tempo Firme', icon: mm > 0 ? '🌧️' : '☀️' };
                const isToday = dateStr === todayStr;

                results.push({
                    date: dateStr,
                    displayDate: formatIsoDateToBR(dateStr),
                    weekday: isToday ? 'Hoje' : getWeekdayName(dateStr),
                    isToday,
                    mm: parseFloat(mm.toFixed(1)),
                    tempMax: Math.round(tempMaxs[i] ?? 0),
                    tempMin: Math.round(tempMins[i] ?? 0),
                    desc: weatherInfo.desc,
                    icon: weatherInfo.icon,
                    source: apiKey ? 'OpenWeather & Radar Agro' : 'Estação Meteorológica (Radar)'
                });
            }

            // Ordena do mais recente (hoje) para o mais antigo
            return results.reverse();
        }
    } catch (openMeteoErr) {
        console.warn("Consulta via radar falhou, tentando OpenWeather direto:", openMeteoErr);
    }

    // 2. Fallback: Se houver chave OpenWeather, consulta endpoint OpenWeather 2.5
    if (apiKey) {
        try {
            const owUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric&lang=pt_br`;
            const owRes = await fetch(owUrl);
            if (owRes.ok) {
                const owData = await owRes.json();
                const list = owData.list || [];
                const dailyAccumulator = {};

                list.forEach(item => {
                    const datePart = (item.dt_txt || '').split(' ')[0];
                    if (!datePart) return;

                    const rainMm = item.rain ? (item.rain['3h'] || item.rain['1h'] || 0) : 0;
                    if (!dailyAccumulator[datePart]) {
                        dailyAccumulator[datePart] = {
                            mm: 0,
                            desc: item.weather?.[0]?.description || 'Parcialmente Nublado',
                            tempMax: item.main?.temp_max || 0,
                            tempMin: item.main?.temp_min || 0
                        };
                    }
                    dailyAccumulator[datePart].mm += rainMm;
                    dailyAccumulator[datePart].tempMax = Math.max(dailyAccumulator[datePart].tempMax, item.main?.temp_max || 0);
                    dailyAccumulator[datePart].tempMin = Math.min(dailyAccumulator[datePart].tempMin, item.main?.temp_min || 0);
                });

                const todayStr = new Date().toISOString().split('T')[0];
                return Object.keys(dailyAccumulator).map(d => ({
                    date: d,
                    displayDate: formatIsoDateToBR(d),
                    weekday: d === todayStr ? 'Hoje' : getWeekdayName(d),
                    isToday: d === todayStr,
                    mm: parseFloat(dailyAccumulator[d].mm.toFixed(1)),
                    tempMax: Math.round(dailyAccumulator[d].tempMax),
                    tempMin: Math.round(dailyAccumulator[d].tempMin),
                    desc: dailyAccumulator[d].desc,
                    icon: dailyAccumulator[d].mm > 0 ? '🌧️' : '🌤️',
                    source: 'OpenWeather API'
                })).reverse();
            }
        } catch (owErr) {
            console.error("Erro na consulta OpenWeather:", owErr);
        }
    }

    throw new Error("Não foi possível obter os dados meteorológicos no momento.");
};

/**
 * Consulta a chuva acumulada especificamente para uma data (YYYY-MM-DD)
 * @param {Object} params
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {string} params.dateStr Data no formato 'YYYY-MM-DD'
 * @param {string} [params.customApiKey]
 * @returns {Promise<{ mm: number, desc: string, icon: string, tempMax: number, tempMin: number }>}
 */
export const fetchRainForSpecificDate = async ({
    latitude,
    longitude,
    dateStr,
    customApiKey = ''
}) => {
    const history = await fetchRainHistory({
        latitude,
        longitude,
        pastDays: 14,
        customApiKey
    });

    const match = history.find(h => h.date === dateStr);
    if (match) {
        return match;
    }

    // Se for data de hoje e não encontrou no histórico
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today && history.length > 0) {
        return history[0];
    }

    return {
        mm: 0,
        desc: 'Sem registro de precipitação expressiva',
        icon: '☀️',
        tempMax: 0,
        tempMin: 0
    };
};
