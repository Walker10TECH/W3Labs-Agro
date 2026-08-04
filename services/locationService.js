/**
 * locationService.js
 * Serviço Open-Source de Geolocalização, Geocodificação e Mapas da W3Labs Agro.
 * Utiliza OpenStreetMap Nominatim (Open-Source), Geolocation API do Navegador e Open-Meteo.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const NOMINATIM_HEADERS = {
    'Accept': 'application/json',
    'User-Agent': 'W3LabsAgroApp/1.0 (contato@w3labs.com.br)'
};

/**
 * Obtém a posição geográfica atual do dispositivo (GPS)
 * @returns {Promise<{latitude: number, longitude: number, accuracy: number}>}
 */
export const getCurrentPosition = () => {
    return new Promise((resolve, reject) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            reject(new Error("Geolocalização não é suportada neste ambiente."));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy || 0,
                    altitude: position.coords.altitude || null
                });
            },
            (error) => {
                let msg = "Falha ao obter localização GPS.";
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        msg = "Permissão de localização negada pelo usuário.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        msg = "Sinal de localização GPS indisponível.";
                        break;
                    case error.TIMEOUT:
                        msg = "Tempo esgotado ao buscar localização GPS.";
                        break;
                }
                reject(new Error(msg));
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 30000
            }
        );
    });
};

/**
 * Realiza a geocodificação reversa usando a API Open-Source OpenStreetMap Nominatim
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<{city: string, state: string, country: string, district: string, road: string, fullAddress: string, raw: Object}>}
 */
export const reverseGeocodeOSM = async (latitude, longitude) => {
    try {
        const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=pt-BR`;
        const res = await fetch(url, { headers: NOMINATIM_HEADERS });
        
        if (!res.ok) {
            throw new Error(`Erro na API Nominatim: ${res.status}`);
        }

        const data = await res.json();
        const address = data.address || {};

        const city = address.city || address.town || address.village || address.municipality || address.county || address.suburb || 'Local Desconhecido';
        const state = address.state || address.region || '';
        const country = address.country || 'Brasil';
        const district = address.suburb || address.neighbourhood || address.quarter || '';
        const road = address.road || address.pedestrian || address.highway || '';
        const displayName = data.display_name || '';

        return {
            city,
            state,
            country,
            district,
            road,
            fullAddress: displayName,
            raw: data
        };
    } catch (error) {
        console.warn("Erro ao fazer geocodificação reversa no OSM:", error);
        return {
            city: 'Local Desconhecido',
            state: '',
            country: 'Brasil',
            district: '',
            road: '',
            fullAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            raw: null
        };
    }
};

/**
 * Busca endereços, fazendas ou cidades via OpenStreetMap Nominatim
 * @param {string} query 
 * @returns {Promise<Array<{name: string, lat: number, lon: number, displayName: string, type: string}>>}
 */
export const searchLocationOSM = async (query) => {
    if (!query || query.trim().length < 2) return [];

    try {
        const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=6&accept-language=pt-BR`;
        const res = await fetch(url, { headers: NOMINATIM_HEADERS });
        if (!res.ok) return [];

        const results = await res.json();
        return results.map(item => ({
            name: item.name || item.display_name.split(',')[0],
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            displayName: item.display_name,
            type: item.type || item.class || 'local'
        }));
    } catch (err) {
        console.error("Erro na busca de localização OSM:", err);
        return [];
    }
};

/**
 * Analisa e extrai coordenadas a partir de uma string ou formato flexível
 * Ex: "-15.7942, -47.8822" ou "Lat: -15.7942 Lon: -47.8822"
 * @param {string} str 
 * @returns {{lat: number, lon: number}|null}
 */
export const parseCoordinates = (str) => {
    if (!str || typeof str !== 'string') return null;

    // Remove caracteres extras exceto números, sinais, pontos e vírgulas
    const parts = str.split(/[,;\s]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            return { lat, lon };
        }
    }

    // Tenta regex para capturar números decimais com sinal
    const match = str.match(/(-?\d+\.\d+)[^\d-]+(-?\d+\.\d+)/);
    if (match) {
        const lat = parseFloat(match[1]);
        const lon = parseFloat(match[2]);
        if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            return { lat, lon };
        }
    }

    return null;
};

/**
 * Formata coordenadas em texto padronizado
 * @param {number} lat 
 * @param {number} lon 
 * @param {number} decimals 
 * @returns {string}
 */
export const formatCoordinates = (lat, lon, decimals = 6) => {
    if (typeof lat !== 'number' || typeof lon !== 'number') return '';
    return `${lat.toFixed(decimals)}, ${lon.toFixed(decimals)}`;
};

/**
 * Tabela de códigos climáticos WMO (Open-Meteo) em Português
 */
const WMO_CODE_MAP = {
    0: { desc: 'Céu Limpo / Ensolarado', icon: '☀️' },
    1: { desc: 'Predomínio de Sol', icon: '🌤️' },
    2: { desc: 'Parcialmente Nublado', icon: '⛅' },
    3: { desc: 'Nublado / Encoberto', icon: '☁️' },
    45: { desc: 'Nevoeiro / Neblina', icon: '🌫️' },
    48: { desc: 'Nevoeiro com Geada', icon: '🌫️' },
    51: { desc: 'Garoa Leve', icon: '🌦️' },
    53: { desc: 'Garoa Moderada', icon: '🌦️' },
    55: { desc: 'Garoa Intensa', icon: '🌧️' },
    61: { desc: 'Chuva Fraca', icon: '🌧️' },
    63: { desc: 'Chuva Moderada', icon: '🌧️' },
    65: { desc: 'Chuva Forte', icon: '⛈️' },
    71: { desc: 'Queda de Neve Fraca', icon: '🌨️' },
    73: { desc: 'Queda de Neve Moderada', icon: '🌨️' },
    75: { desc: 'Queda de Neve Intensa', icon: '❄️' },
    80: { desc: 'Pancadas de Chuva Leve', icon: '🌦️' },
    81: { desc: 'Pancadas de Chuva Moderadas', icon: '🌧️' },
    82: { desc: 'Pancadas de Chuva Violentas', icon: '⛈️' },
    95: { desc: 'Tempestade com Trovoadas', icon: '⚡' },
    96: { desc: 'Tempestade com Granizo Leve', icon: '⛈️' },
    99: { desc: 'Tempestade Severa com Granizo', icon: '⛈️' }
};

/**
 * Consulta clima em tempo real via Open-Meteo (Open-Source e Gratuito)
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<Object>}
 */
export const fetchOpenMeteoWeather = async (latitude, longitude) => {
    try {
        const url = `${OPEN_METEO_BASE}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Falha na API Open-Meteo.");

        const data = await res.json();
        const cur = data.current || {};
        const wmo = WMO_CODE_MAP[cur.weather_code] || { desc: 'Tempo Estável', icon: '🌤️' };

        return {
            temp: Math.round(cur.temperature_2m ?? 0),
            tempApparent: Math.round(cur.apparent_temperature ?? 0),
            humidity: cur.relative_humidity_2m ?? 0,
            windSpeed: Math.round(cur.wind_speed_10m ?? 0),
            windDirection: cur.wind_direction_10m ?? 0,
            precipitation: cur.precipitation ?? 0,
            desc: wmo.desc,
            icon: wmo.icon,
            isDay: cur.is_day === 1
        };
    } catch (err) {
        console.error("Erro ao buscar clima Open-Meteo:", err);
        return null;
    }
};
