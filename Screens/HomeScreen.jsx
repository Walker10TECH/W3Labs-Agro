import React, { useEffect, useState } from 'react';
import {
    Droplets,
    Wind,
    CloudRain,
    LogOut,
    SprayCan,
    Sprout,
    Wheat,
    Wrench,
    Fuel,
    Warehouse,
    Percent,
    Sliders,
    BookOpen,
    Compass
} from 'lucide-react-native';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { auth, db, signOut } from '../firebaseConfig';
import FarmMapModal from '../components/FarmMapModal';
import AgronomiaChatbot from '../components/AgronomiaChatbot';
import { getCurrentPosition, reverseGeocodeOSM, fetchOpenMeteoWeather } from '../services/locationService';

export default function Dashboard({ navigation }) {
    const [weather, setWeather] = useState({ temp: '--', desc: 'Buscando clima...', humidity: '--', wind: '--', rain: '--' });
    const [location, setLocation] = useState(null);
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
                                className={`group relative bg-white hover:bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col items-center text-center cursor-pointer overflow-hidden ${
                                    item.id === 9 ? 'md:col-start-2 lg:col-start-auto' : ''
                                } ${
                                    item.id === 10 ? 'col-start-2 md:col-start-auto lg:col-start-auto' : ''
                                }`}
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

                {/* Farm Map Modal */}
                {showFarmMap && (
                    <FarmMapModal
                        talhoes={talhoesList}
                        onClose={() => setShowFarmMap(false)}
                    />
                )}

                {/* Assistente Inteligente AgronomIA - Ícone Permanente Flutuante e Janela Multimodal Completa */}
                <AgronomiaChatbot
                    permanent={true}
                    userName={userName}
                />

            </div>
        </div>
    );
}
