import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    MapPin,
    Navigation,
    Layers,
    Search,
    X,
    Check,
    ZoomIn,
    ZoomOut,
    LocateFixed,
    Maximize2,
    Minimize2,
    Compass,
    Sparkles
} from 'lucide-react-native';
import {
    getCurrentPosition,
    reverseGeocodeOSM,
    searchLocationOSM,
    parseCoordinates,
    formatCoordinates
} from '../services/locationService';

// Carregador dinâmico de Leaflet CDN para Web
const loadLeafletAssets = () => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            reject(new Error("Leaflet requer ambiente com window/DOM."));
            return;
        }

        if (window.L) {
            resolve(window.L);
            return;
        }

        // Adiciona CSS
        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }

        // Adiciona Script
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
            if (window.L) {
                resolve(window.L);
            } else {
                reject(new Error("Falha ao inicializar objeto global window.L"));
            }
        };
        script.onerror = () => reject(new Error("Erro ao carregar script do Leaflet."));
        document.head.appendChild(script);
    });
};

// Configurações de Camadas de Mapa Open-Source
const TILE_LAYERS = {
    satellite: {
        id: 'satellite',
        name: 'Satélite HD',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; Esri &mdash; Imagens Satelitais Agrícolas',
        maxZoom: 19
    },
    osm: {
        id: 'osm',
        name: 'OpenStreetMap',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    },
    topo: {
        id: 'topo',
        name: 'Topográfico / Relevo',
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: 'Map data: &copy; OSM contributors, SRTM | Map style: &copy; OpenTopoMap',
        maxZoom: 17
    }
};

/**
 * Componente de Mapa Open-Source com Leaflet, OpenStreetMap e Satélite Agrícola
 * 
 * Props:
 * - markers: Array<{ id, nome, cultura, area, coordenadas: string, cor?: string }>
 * - selectable: boolean (se permite clicar para selecionar um ponto GPS)
 * - initialCoordinates: string | { lat, lon }
 * - onSelectCoordinates: (coords: { lat, lon, formatted: string, address?: Object }) => void
 * - height: string (ex: '450px', '100%')
 * - className: string
 */
export default function OpenSourceMap({
    markers = [],
    selectable = false,
    initialCoordinates = null,
    onSelectCoordinates = null,
    height = '420px',
    className = ''
}) {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const tileLayerRef = useRef(null);
    const markersGroupRef = useRef(null);
    const selectedMarkerRef = useRef(null);
    const userLocationMarkerRef = useRef(null);

    const [mapReady, setMapReady] = useState(false);
    const [mapError, setMapError] = useState(null);
    const [activeLayer, setActiveLayer] = useState('satellite');
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [locatingUser, setLocatingUser] = useState(false);
    const [addressInfo, setAddressInfo] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [showLayerMenu, setShowLayerMenu] = useState(false);

    // Inicializa Mapa Leaflet
    useEffect(() => {
        let isMounted = true;

        (async () => {
            try {
                const L = await loadLeafletAssets();
                if (!isMounted || !mapContainerRef.current) return;

                // Se já houver instância, remove para recriar de forma limpa
                if (mapInstanceRef.current) {
                    mapInstanceRef.current.remove();
                    mapInstanceRef.current = null;
                }

                // Determina centro inicial
                let defaultCenter = [-15.7942, -47.8822]; // Brasília / Centro-Oeste
                let defaultZoom = 5;

                // Se houver coordenadas iniciais
                const parsedInitial = typeof initialCoordinates === 'string' 
                    ? parseCoordinates(initialCoordinates) 
                    : initialCoordinates;

                if (parsedInitial && parsedInitial.lat && parsedInitial.lon) {
                    defaultCenter = [parsedInitial.lat, parsedInitial.lon];
                    defaultZoom = 15;
                } else if (markers.length > 0) {
                    // Pega primeiro marcador válido
                    for (const m of markers) {
                        const p = parseCoordinates(m.coordenadas);
                        if (p) {
                            defaultCenter = [p.lat, p.lon];
                            defaultZoom = 14;
                            break;
                        }
                    }
                }

                const map = L.map(mapContainerRef.current, {
                    center: defaultCenter,
                    zoom: defaultZoom,
                    zoomControl: false // Criamos controles personalizados estilizados
                });

                // Camada base
                const currentTileConfig = TILE_LAYERS[activeLayer] || TILE_LAYERS.satellite;
                const tileLayer = L.tileLayer(currentTileConfig.url, {
                    attribution: currentTileConfig.attribution,
                    maxZoom: currentTileConfig.maxZoom
                }).addTo(map);

                tileLayerRef.current = tileLayer;

                // Grupo para marcadores
                const markersGroup = L.featureGroup().addTo(map);
                markersGroupRef.current = markersGroup;

                // Evento de clique para seleção de coordenadas
                if (selectable) {
                    map.on('click', async (e) => {
                        const { lat, lng } = e.latlng;
                        handlePointSelected(lat, lng, L, map);
                    });
                }

                mapInstanceRef.current = map;
                setMapReady(true);

                // Se tinha ponto inicial pré-definido, plota o marcador de seleção
                if (parsedInitial && parsedInitial.lat && parsedInitial.lon && selectable) {
                    handlePointSelected(parsedInitial.lat, parsedInitial.lon, L, map);
                }

            } catch (err) {
                console.error("Erro ao inicializar mapa Leaflet:", err);
                if (isMounted) setMapError(err.message || "Não foi possível carregar o mapa.");
            }
        })();

        return () => {
            isMounted = false;
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Atualiza a Camada de Mapa quando o usuário troca (Satélite / OSM / Topo)
    useEffect(() => {
        if (!mapInstanceRef.current || !window.L) return;
        const L = window.L;
        const config = TILE_LAYERS[activeLayer] || TILE_LAYERS.satellite;

        if (tileLayerRef.current) {
            mapInstanceRef.current.removeLayer(tileLayerRef.current);
        }

        tileLayerRef.current = L.tileLayer(config.url, {
            attribution: config.attribution,
            maxZoom: config.maxZoom
        }).addTo(mapInstanceRef.current);
    }, [activeLayer]);

    // Trata seleção de ponto no mapa
    const handlePointSelected = async (lat, lng, L = window.L, map = mapInstanceRef.current) => {
        if (!L || !map) return;

        const coords = { lat, lon: lng, formatted: formatCoordinates(lat, lng) };
        setSelectedPoint(coords);

        // Remove marcador anterior de seleção se houver
        if (selectedMarkerRef.current) {
            map.removeLayer(selectedMarkerRef.current);
        }

        // Ícone moderno estilizado de Pin do Talhão
        const customPinHtml = `
            <div style="
                background: linear-gradient(135deg, #10b981, #059669);
                width: 34px;
                height: 34px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                border: 3px solid white;
                box-shadow: 0 4px 14px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <div style="
                    width: 10px;
                    height: 10px;
                    background: white;
                    border-radius: 50%;
                    transform: rotate(45deg);
                "></div>
            </div>
        `;

        const pinIcon = L.divIcon({
            html: customPinHtml,
            className: 'custom-leaflet-pin',
            iconSize: [34, 34],
            iconAnchor: [17, 34],
            popupAnchor: [0, -34]
        });

        const newMarker = L.marker([lat, lng], {
            icon: pinIcon,
            draggable: true
        }).addTo(map);

        newMarker.on('dragend', (ev) => {
            const pos = ev.target.getLatLng();
            handlePointSelected(pos.lat, pos.lng, L, map);
        });

        selectedMarkerRef.current = newMarker;

        // Geocodificação reversa via OpenStreetMap Nominatim
        const addr = await reverseGeocodeOSM(lat, lng);
        setAddressInfo(addr);

        const popupContent = `
            <div style="font-family: sans-serif; min-width: 180px; padding: 2px;">
                <div style="font-weight: 800; font-size: 13px; color: #065f46; margin-bottom: 2px;">📍 Ponto Selecionado</div>
                <div style="font-size: 11px; color: #374151; font-weight: 600;">${coords.formatted}</div>
                <div style="font-size: 10px; color: #6b7280; margin-top: 4px; border-top: 1px solid #e5e7eb; padding-top: 4px;">
                    ${addr.city ? `${addr.city}, ${addr.state || addr.country}` : 'Local no mapa'}
                </div>
            </div>
        `;
        newMarker.bindPopup(popupContent).openPopup();

        if (onSelectCoordinates) {
            onSelectCoordinates({ ...coords, address: addr });
        }
    };

    // Renderiza todos os marcadores de Talhões
    useEffect(() => {
        if (!mapInstanceRef.current || !window.L || !markersGroupRef.current) return;
        const L = window.L;
        const markersGroup = markersGroupRef.current;
        markersGroup.clearLayers();

        const validBounds = [];

        markers.forEach((item) => {
            const parsed = parseCoordinates(item.coordenadas);
            if (!parsed) return;

            validBounds.push([parsed.lat, parsed.lon]);

            const cultureBadge = item.cultura || item.culturaAtual || 'Talhão';
            const areaBadge = item.area || item.areaTotal ? `${item.area || item.areaTotal} ha` : '';

            // Cor baseada na cultura
            const cor = item.cor || (
                cultureBadge.toLowerCase().includes('soja') ? '#10b981' :
                cultureBadge.toLowerCase().includes('milho') ? '#f59e0b' :
                cultureBadge.toLowerCase().includes('trigo') ? '#eab308' :
                cultureBadge.toLowerCase().includes('algod') ? '#06b6d4' : '#059669'
            );

            const markerHtml = `
                <div style="
                    background: ${cor};
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-family: sans-serif;
                    font-size: 11px;
                    font-weight: 800;
                    border: 2px solid white;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.35);
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    white-space: nowrap;
                ">
                    <span>🌱 ${item.nome || 'Talhão'}</span>
                    ${areaBadge ? `<span style="background: rgba(0,0,0,0.25); padding: 1px 4px; border-radius: 6px; font-size: 9px;">${areaBadge}</span>` : ''}
                </div>
            `;

            const icon = L.divIcon({
                html: markerHtml,
                className: 'custom-talhao-badge',
                iconSize: [100, 30],
                iconAnchor: [50, 15]
            });

            const m = L.marker([parsed.lat, parsed.lon], { icon }).addTo(markersGroup);

            const popupContent = `
                <div style="font-family: sans-serif; min-width: 200px; padding: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: 900; font-size: 14px; color: #111827;">${item.nome || 'Talhão'}</span>
                        <span style="font-size: 10px; font-weight: 700; background: #ecfdf5; color: #047857; padding: 2px 6px; border-radius: 8px;">${cultureBadge}</span>
                    </div>
                    <div style="font-size: 12px; color: #047857; font-weight: 800; margin-bottom: 6px;">
                        Área: ${areaBadge || 'Não informada'}
                    </div>
                    ${item.tipoSolo ? `<div style="font-size: 11px; color: #4b5563;">Solo: <b>${item.tipoSolo}</b></div>` : ''}
                    <div style="font-size: 10px; color: #6b7280; margin-top: 6px; border-top: 1px solid #e5e7eb; padding-top: 4px;">
                        📍 GPS: ${formatCoordinates(parsed.lat, parsed.lon)}
                    </div>
                </div>
            `;
            m.bindPopup(popupContent);
        });

        // Se houver múltiplos marcadores, ajusta o zoom para enquadrar todos
        if (validBounds.length > 0 && !selectedPoint) {
            try {
                if (validBounds.length === 1) {
                    mapInstanceRef.current.setView(validBounds[0], 15);
                } else {
                    mapInstanceRef.current.fitBounds(validBounds, { padding: [40, 40], maxZoom: 16 });
                }
            } catch (e) {
                // Ignore bounds error if container is small
            }
        }
    }, [markers, mapReady]);

    // Localizar Usuário via GPS
    const handleLocateMe = async () => {
        setLocatingUser(true);
        try {
            const pos = await getCurrentPosition();
            if (mapInstanceRef.current && window.L) {
                const L = window.L;
                const map = mapInstanceRef.current;

                map.setView([pos.latitude, pos.longitude], 16, { animate: true });

                // Remove marcador anterior de usuário
                if (userLocationMarkerRef.current) {
                    map.removeLayer(userLocationMarkerRef.current);
                }

                // Cria indicador de precisão e ponto
                const userIconHtml = `
                    <div style="
                        width: 20px;
                        height: 20px;
                        background: #3b82f6;
                        border-radius: 50%;
                        border: 3px solid white;
                        box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.35);
                    "></div>
                `;

                const userIcon = L.divIcon({
                    html: userIconHtml,
                    className: 'user-gps-pulse',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });

                const userMarker = L.marker([pos.latitude, pos.longitude], { icon: userIcon }).addTo(map);
                userMarker.bindPopup(`<b>Sua Localização GPS</b><br>Precisão: ~${Math.round(pos.accuracy)}m`).openPopup();
                userLocationMarkerRef.current = userMarker;

                if (selectable) {
                    handlePointSelected(pos.latitude, pos.longitude, L, map);
                }
            }
        } catch (err) {
            alert(err.message || "Não foi possível obter a sua localização GPS.");
        } finally {
            setLocatingUser(false);
        }
    };

    // Busca de Endereço / Local via OpenStreetMap Nominatim
    const handleSearch = async (e) => {
        e?.preventDefault();
        if (!searchQuery.trim()) return;

        setSearching(true);
        try {
            // Verifica se o usuário digitou coordenadas diretas
            const parsed = parseCoordinates(searchQuery);
            if (parsed && mapInstanceRef.current && window.L) {
                mapInstanceRef.current.setView([parsed.lat, parsed.lon], 16, { animate: true });
                if (selectable) {
                    handlePointSelected(parsed.lat, parsed.lon, window.L, mapInstanceRef.current);
                }
                setShowSearchDropdown(false);
                setSearching(false);
                return;
            }

            const results = await searchLocationOSM(searchQuery);
            setSearchResults(results);
            setShowSearchDropdown(results.length > 0);
        } catch (err) {
            console.error(err);
        } finally {
            setSearching(false);
        }
    };

    const handleSelectSearchResult = (item) => {
        if (!mapInstanceRef.current || !window.L) return;
        mapInstanceRef.current.setView([item.lat, item.lon], 15, { animate: true });

        if (selectable) {
            handlePointSelected(item.lat, item.lon, window.L, mapInstanceRef.current);
        }

        setShowSearchDropdown(false);
        setSearchQuery(item.name || item.displayName.split(',')[0]);
    };

    const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
    const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

    return (
        <div className={`relative w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200 bg-slate-900 flex flex-col ${className}`} style={{ height }}>
            
            {/* Top Search & Controls Bar */}
            <div className="absolute top-3 left-3 right-3 z-[400] flex items-center gap-2 pointer-events-none">
                
                {/* Search Bar */}
                <div className="relative flex-1 max-w-sm pointer-events-auto">
                    <form onSubmit={handleSearch} className="relative flex items-center">
                        <input
                            type="text"
                            placeholder="Buscar cidade, fazenda ou coordenadas GPS..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => searchResults.length > 0 && setShowSearchDropdown(true)}
                            className="w-full bg-white/95 backdrop-blur-md text-slate-800 text-xs font-semibold pl-8 pr-8 py-2 rounded-xl shadow-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <div className="absolute left-2.5 text-slate-400">
                            <Search size={14} />
                        </div>
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearchDropdown(false); }}
                                className="absolute right-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </form>

                    {/* Autocomplete Results Dropdown */}
                    {showSearchDropdown && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-h-48 overflow-y-auto z-[500] animate-fadeIn">
                            {searchResults.map((item, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSelectSearchResult(item)}
                                    className="w-full px-3 py-2 text-left hover:bg-emerald-50 border-b border-slate-100 last:border-0 flex items-start gap-2 cursor-pointer transition-colors"
                                >
                                    <MapPin size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                        <div className="text-xs font-bold text-slate-800 line-clamp-1">{item.name}</div>
                                        <div className="text-[10px] text-slate-500 line-clamp-1">{item.displayName}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Layer Switcher Button */}
                <div className="relative pointer-events-auto">
                    <button
                        type="button"
                        onClick={() => setShowLayerMenu(prev => !prev)}
                        className="p-2 rounded-xl bg-white/95 backdrop-blur-md text-slate-700 hover:text-emerald-700 shadow-lg border border-slate-200 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                        title="Trocar Camada do Mapa"
                    >
                        <Layers size={16} />
                        <span className="hidden sm:inline">{TILE_LAYERS[activeLayer]?.name}</span>
                    </button>

                    {showLayerMenu && (
                        <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 z-[500] animate-fadeIn">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">Camadas Open-Source</div>
                            {Object.values(TILE_LAYERS).map(layer => (
                                <button
                                    key={layer.id}
                                    type="button"
                                    onClick={() => { setActiveLayer(layer.id); setShowLayerMenu(false); }}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                                        activeLayer === layer.id ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                                    }`}
                                >
                                    <span>{layer.name}</span>
                                    {activeLayer === layer.id && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Map Zoom & Location Controls */}
            <div className="absolute right-3 bottom-8 z-[400] flex flex-col gap-1.5 pointer-events-auto">
                <button
                    type="button"
                    onClick={handleLocateMe}
                    disabled={locatingUser}
                    className="p-2.5 rounded-xl bg-white/95 backdrop-blur-md text-slate-800 hover:text-emerald-700 hover:bg-white shadow-lg border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
                    title="Minha Localização GPS"
                >
                    {locatingUser ? (
                        <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <LocateFixed size={18} />
                    )}
                </button>
                <button
                    type="button"
                    onClick={handleZoomIn}
                    className="p-2.5 rounded-xl bg-white/95 backdrop-blur-md text-slate-800 hover:bg-white shadow-lg border border-slate-200 transition-all cursor-pointer"
                    title="Aproximar"
                >
                    <ZoomIn size={18} />
                </button>
                <button
                    type="button"
                    onClick={handleZoomOut}
                    className="p-2.5 rounded-xl bg-white/95 backdrop-blur-md text-slate-800 hover:bg-white shadow-lg border border-slate-200 transition-all cursor-pointer"
                    title="Afastar"
                >
                    <ZoomOut size={18} />
                </button>
            </div>

            {/* Bottom Tip / Selected Point Banner */}
            {selectable && (
                <div className="absolute left-3 bottom-3 z-[400] pointer-events-auto max-w-sm">
                    {selectedPoint ? (
                        <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-lg border border-emerald-300 text-xs flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                <Check size={14} />
                            </div>
                            <div>
                                <div className="font-bold text-emerald-950">GPS: {selectedPoint.formatted}</div>
                                <div className="text-[10px] text-slate-500 line-clamp-1">{addressInfo?.city || 'Clique no mapa para alterar o ponto'}</div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-md">
                            <MapPin size={13} className="text-emerald-400" />
                            <span>Clique no mapa ou busque para marcar o talhão</span>
                        </div>
                    )}
                </div>
            )}

            {/* DOM Container for Leaflet */}
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Erro ou Loading Fallback */}
            {mapError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white p-4 text-center">
                    <MapPin size={32} className="text-red-400 mb-2" />
                    <span className="text-sm font-bold">Erro ao carregar mapa</span>
                    <span className="text-xs text-slate-400 mt-1">{mapError}</span>
                </div>
            )}
        </div>
    );
}
