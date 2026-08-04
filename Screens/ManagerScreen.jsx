import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ArrowLeft,
    MapPin,
    Warehouse,
    Tractor,
    PlusCircle,
    Grid,
    Search,
    Map,
    Pencil,
    Trash2,
    X,
    Package,
    AlertCircle,
    Truck,
    CheckCircle2,
    Compass,
    LocateFixed,
    Layers,
    Navigation
} from 'lucide-react-native';
import {
    collection,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import OpenSourceMap from '../components/OpenSourceMap';
import FarmMapModal from '../components/FarmMapModal';
import CoordinatePickerModal from '../components/CoordinatePickerModal';
import { getCurrentPosition, reverseGeocodeOSM } from '../services/locationService';

const parseMoeda = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleanStr = String(val).replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
};

const formatMoeda = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatNumero = (val, decimals = 2) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

// =========================================================================
// DEFAULT EXPORT: MANAGER SCREEN (Unificado com abas)
// =========================================================================

export default function ManagerScreen({ navigation, route }) {
    const initialTab = route?.params?.initialTab || 'talhoes';
    const [activeSection, setActiveSection] = useState(initialTab); // 'talhoes' | 'estoque' | 'maquinas'

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Top Global Bar for Section Switching */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => navigation?.goBack()}
                            className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
                            title="Voltar ao Painel"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Módulo Gerencial</span>
                            <h2 className="text-base font-black text-slate-800 tracking-tight leading-none">Gestão da Propriedade</h2>
                        </div>
                    </div>

                    {/* Section Switcher Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                        <button
                            onClick={() => setActiveSection('talhoes')}
                            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                                activeSection === 'talhoes' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <MapPin size={12} />
                            <span>Talhões</span>
                        </button>
                        <button
                            onClick={() => setActiveSection('estoque')}
                            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                                activeSection === 'estoque' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Warehouse size={12} />
                            <span>Almoxarifado & Estoque</span>
                        </button>
                        <button
                            onClick={() => setActiveSection('maquinas')}
                            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                                activeSection === 'maquinas' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Tractor size={12} />
                            <span>Inventário de Máquinas</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Active Content */}
            <div className="flex-1">
                {activeSection === 'talhoes' && <TalhoesListaScreen navigation={navigation} hideHeaderBack />}
                {activeSection === 'estoque' && <EstoqueGeralScreen navigation={navigation} hideHeaderBack />}
                {activeSection === 'maquinas' && <InventarioMaquinasScreen navigation={navigation} hideHeaderBack />}
            </div>
        </div>
    );
}

// =========================================================================
// 1. GESTÃO DE TALHÕES (TalhoesListaScreen)
// =========================================================================

export function TalhoesListaScreen({ navigation, hideHeaderBack }) {
    const [talhoes, setTalhoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [showFarmMapModal, setShowFarmMapModal] = useState(false);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'map'

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const q = query(collection(db, 'users', uid, 'talhoes'), orderBy('nome', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTalhoes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error(err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const stats = useMemo(() => {
        let areaTotalGeral = 0;
        let mapeadosCount = 0;
        talhoes.forEach(t => {
            areaTotalGeral += parseMoeda(t.areaTotal || t.area || 0);
            if (t.coordenadas) mapeadosCount++;
        });
        return {
            totalTalhoes: talhoes.length,
            mapeadosCount,
            areaTotalGeral
        };
    }, [talhoes]);

    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return talhoes.filter(t => 
            !searchQuery ||
            t.nome?.toLowerCase().includes(q) ||
            t.culturaAtual?.toLowerCase().includes(q) ||
            t.tipoSolo?.toLowerCase().includes(q)
        );
    }, [talhoes, searchQuery]);

    const handleDelete = async (id) => {
        if (!window.confirm("Deseja realmente excluir este talhão?")) return;
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        try {
            await deleteDoc(doc(db, 'users', uid, 'talhoes', id));
        } catch (err) {
            console.error(err);
            window.alert("Erro ao excluir talhão.");
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col px-4 py-6 sm:px-6 sm:py-8 font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    {!hideHeaderBack && (
                        <button
                            onClick={() => navigation?.goBack()}
                            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer shadow-sm"
                            title="Voltar"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Gestão de Talhões</h1>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                OpenStreetMap
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">Mapeamento georreferenciado, áreas cultiváveis e satélite agrícola</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFarmMapModal(true)}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
                        title="Ver mapa completo em tela cheia com satélite"
                    >
                        <Compass size={18} className="text-emerald-400" />
                        <span>Mapa da Propriedade</span>
                    </button>

                    <button
                        onClick={() => setModal({ visible: true, itemId: null })}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-950/10"
                    >
                        <PlusCircle size={18} />
                        <span>Novo Talhão</span>
                    </button>
                </div>
            </div>

            {/* Metric Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white shadow-lg shadow-emerald-950/10">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">Área Mapeada Total</span>
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                            <MapPin size={14} />
                        </div>
                    </div>
                    <div className="text-3xl font-black tracking-tight">{formatNumero(stats.areaTotalGeral)} <span className="text-sm font-semibold text-emerald-200">ha</span></div>
                    <div className="text-xs text-emerald-100 mt-1">Soma de todos os talhões cadastrados</div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Talhões Cadastrados</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Grid size={18} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{stats.totalTalhoes}</div>
                    <div className="text-xs text-slate-500 mt-1">Glebas ativas na propriedade</div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Com Localização GPS</span>
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                            <Compass size={18} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-teal-700">{stats.mapeadosCount} <span className="text-xs font-semibold text-slate-400">/ {stats.totalTalhoes}</span></div>
                    <div className="text-xs text-slate-500 mt-1">Georreferenciados no satélite</div>
                </div>
            </div>

            {/* Filter & View Switcher Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
                <div className="relative w-full sm:w-80">
                    <input
                        type="text"
                        placeholder="Buscar por nome, cultura, solo..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-sm"
                    />
                    <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                </div>

                {/* Switcher Cards vs Mapa */}
                <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto self-stretch sm:self-auto">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            viewMode === 'grid' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Grid size={14} />
                        <span>Cards ({filtered.length})</span>
                    </button>
                    <button
                        onClick={() => setViewMode('map')}
                        className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            viewMode === 'map' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Map size={14} />
                        <span>Mapa Satélite</span>
                    </button>
                </div>
            </div>

            {/* Content Display: Cards or Interactive Map */}
            <div className="flex-1">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
                        <span className="text-xs font-semibold text-slate-500">Carregando talhões...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                            <Map size={24} />
                        </div>
                        <h3 className="text-base font-bold text-slate-700">Nenhum talhão cadastrado</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                            Clique em "Novo Talhão" para mapear os lotes e talhões da sua propriedade rural.
                        </p>
                    </div>
                ) : viewMode === 'map' ? (
                    /* Mapa Interativo Integrado */
                    <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-bold text-slate-800">Visualização de Satélite dos Talhões</span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-semibold">
                                {filtered.filter(t => t.coordenadas).length} talhões com coordenadas no mapa
                            </span>
                        </div>
                        <OpenSourceMap
                            markers={filtered}
                            selectable={false}
                            height="540px"
                            className="rounded-2xl"
                        />
                    </div>
                ) : (
                    /* Cards Grid */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((item) => {
                            const area = parseMoeda(item.areaTotal || item.area || 0);

                            return (
                                <div
                                    key={item.id}
                                    className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                                    {item.culturaAtual || 'Livre / Pousio'}
                                                </span>
                                                <h3 className="text-base font-bold text-slate-800 mt-1">
                                                    {item.nome || 'Talhão sem nome'}
                                                </h3>
                                            </div>

                                            <span className="text-lg font-black text-emerald-700">
                                                {formatNumero(area)} ha
                                            </span>
                                        </div>

                                        <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mb-3">
                                            {item.tipoSolo && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Tipo de Solo:</span>
                                                    <span className="font-semibold">{item.tipoSolo}</span>
                                                </div>
                                            )}
                                            {item.coordenadas ? (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-400">GPS:</span>
                                                    <span className="font-semibold text-emerald-700 font-mono text-[11px] bg-emerald-50 px-2 py-0.5 rounded-md">
                                                        📍 {item.coordenadas}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                                                    <span>GPS:</span>
                                                    <span className="italic">Não georreferenciado</span>
                                                </div>
                                            )}
                                        </div>

                                        {item.observacoes && (
                                            <p className="text-xs text-slate-500 italic line-clamp-2">
                                                "{item.observacoes}"
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
                                        <button
                                            onClick={() => setShowFarmMapModal(true)}
                                            className="text-emerald-700 hover:text-emerald-800 text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer"
                                        >
                                            <Compass size={14} />
                                            <span>Ver no Mapa</span>
                                        </button>

                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setModal({ visible: true, itemId: item.id })}
                                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                                                title="Editar"
                                            >
                                                <Pencil size={15} />
                                                <span>Editar</span>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                                                title="Excluir"
                                            >
                                                <Trash2 size={15} />
                                                <span>Excluir</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal de Cadastro / Edição do Talhão */}
            {modal.visible && (
                <ModalAddOrEditTalhao
                    itemId={modal.itemId}
                    onClose={() => setModal({ visible: false, itemId: null })}
                />
            )}

            {/* Modal de Mapa Completo da Propriedade */}
            {showFarmMapModal && (
                <FarmMapModal
                    talhoes={talhoes}
                    onClose={() => setShowFarmMapModal(false)}
                />
            )}
        </div>
    );
}

function ModalAddOrEditTalhao({ itemId, onClose }) {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [nome, setNome] = useState('');
    const [areaTotal, setAreaTotal] = useState('');
    const [culturaAtual, setCulturaAtual] = useState('');
    const [tipoSolo, setTipoSolo] = useState('');
    const [coordenadas, setCoordenadas] = useState('');
    const [observacoes, setObservacoes] = useState('');

    const [gettingGps, setGettingGps] = useState(false);
    const [showCoordinatePicker, setShowCoordinatePicker] = useState(false);

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            try {
                const snap = await getDoc(doc(db, 'users', uid, 'talhoes', itemId));
                if (snap.exists()) {
                    const d = snap.data();
                    setNome(d.nome || '');
                    setAreaTotal(String(d.areaTotal || d.area || ''));
                    setCulturaAtual(d.culturaAtual || '');
                    setTipoSolo(d.tipoSolo || '');
                    setCoordenadas(d.coordenadas || '');
                    setObservacoes(d.observacoes || '');
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, [itemId]);

    // Captura GPS Atual via Geolocation API + OpenStreetMap Nominatim
    const handleGetGps = async () => {
        setGettingGps(true);
        try {
            const pos = await getCurrentPosition();
            const formatted = `${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}`;
            setCoordenadas(formatted);

            // Tenta obter dados do endereço / município
            const addr = await reverseGeocodeOSM(pos.latitude, pos.longitude);
            if (addr?.city && !observacoes.includes(addr.city)) {
                setObservacoes(prev => prev ? `${prev}\nRegião: ${addr.city} - ${addr.state}` : `Região: ${addr.city} - ${addr.state}`);
            }
        } catch (err) {
            window.alert(err.message || "Não foi possível obter coordenadas GPS.");
        } finally {
            setGettingGps(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const areaNum = parseMoeda(areaTotal);
        if (!nome.trim() || areaNum <= 0) {
            window.alert("Informe o nome do talhão e a área em hectares.");
            return;
        }

        setSaving(true);
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        try {
            const docId = itemId || doc(collection(db, 'users', uid, 'talhoes')).id;
            await setDoc(doc(db, 'users', uid, 'talhoes', docId), {
                id: docId,
                nome: nome.trim(),
                areaTotal: areaNum,
                culturaAtual: culturaAtual.trim(),
                tipoSolo: tipoSolo.trim(),
                coordenadas: coordenadas.trim(),
                observacoes: observacoes.trim(),
                atualizadoEm: new Date()
            }, { merge: true });

            onClose();
        } catch (err) {
            console.error(err);
            window.alert("Erro ao salvar talhão.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal">
                <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
                    <div>
                        <span className="font-bold text-base block">{itemId ? 'Editar Talhão' : 'Novo Talhão'}</span>
                        <span className="text-[11px] text-emerald-200">Cadastro Georreferenciado</span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg text-emerald-200 hover:text-white transition-colors cursor-pointer">
                        <X size={22} />
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Identificação / Nome *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Talhão 01 - Sede"
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Área Total (Hectares) *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: 75.5"
                                    value={areaTotal}
                                    onChange={(e) => setAreaTotal(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Cultura Atual
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Soja / Milho Safrinha"
                                    value={culturaAtual}
                                    onChange={(e) => setCulturaAtual(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Tipo de Solo
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Latossolo Vermelho / Argiloso"
                                    value={tipoSolo}
                                    onChange={(e) => setTipoSolo(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Coordenadas GPS com Ações de Mapa e GPS */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Coordenadas GPS (Lat, Lon)
                                </label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleGetGps}
                                        disabled={gettingGps}
                                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        <LocateFixed size={12} />
                                        <span>{gettingGps ? 'Buscando...' : 'GPS Atual'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowCoordinatePicker(true)}
                                        className="text-[11px] font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                        <MapPin size={12} />
                                        <span>Escolher no Mapa</span>
                                    </button>
                                </div>
                            </div>
                            <input
                                type="text"
                                placeholder="Ex: -15.7942, -47.8822"
                                value={coordenadas}
                                onChange={(e) => setCoordenadas(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                                Digite ou clique em "Escolher no Mapa" para posicionar visualmente sobre a foto de satélite da fazenda.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Observações
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Histórico de calagem, declividade, curva de nível..."
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 resize-none"
                            />
                        </div>

                        <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : 'Salvar Talhão'}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Modal Seletor de Coordenadas no Mapa */}
            {showCoordinatePicker && (
                <CoordinatePickerModal
                    initialCoordinates={coordenadas}
                    onConfirm={(newCoords, addr) => {
                        setCoordenadas(newCoords);
                        if (addr?.city && !observacoes.includes(addr.city)) {
                            setObservacoes(prev => prev ? `${prev}\nRegião: ${addr.city}` : `Região: ${addr.city}`);
                        }
                    }}
                    onClose={() => setShowCoordinatePicker(false)}
                />
            )}
        </div>
    );
}

// =========================================================================
// 2. GESTÃO DE ESTOQUE GERAL / ALMOXARIFADO (EstoqueGeralScreen)
// =========================================================================

export function EstoqueGeralScreen({ navigation, hideHeaderBack }) {
    const [estoque, setEstoque] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('todos');
    const [searchQuery, setSearchQuery] = useState('');
    const [modal, setModal] = useState({ visible: false, itemId: null });

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const q = query(collection(db, 'users', uid, 'estoqueGeral'), orderBy('nome', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setEstoque(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error(err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const stats = useMemo(() => {
        let valorTotalEstoque = 0;
        let alertasEstoqueBaixo = 0;

        estoque.forEach(item => {
            const qtd = parseMoeda(item.quantidade || 0);
            const val = parseMoeda(item.valorUnitario || 0);
            const min = parseMoeda(item.estoqueMinimo || 0);

            valorTotalEstoque += (qtd * val);
            if (min > 0 && qtd <= min) alertasEstoqueBaixo++;
        });

        return {
            totalItens: estoque.length,
            valorTotalEstoque,
            alertasEstoqueBaixo
        };
    }, [estoque]);

    const filtered = useMemo(() => {
        return estoque.filter(item => {
            const matchTab = activeTab === 'todos' ? true : item.tipo === activeTab;
            const q = searchQuery.toLowerCase();
            const matchSearch = 
                !searchQuery ||
                item.nome?.toLowerCase().includes(q) ||
                item.fabricante?.toLowerCase().includes(q) ||
                item.localizacao?.toLowerCase().includes(q);

            return matchTab && matchSearch;
        });
    }, [estoque, activeTab, searchQuery]);

    const handleDelete = async (id) => {
        if (!window.confirm("Deseja realmente excluir este item do almoxarifado?")) return;
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        try {
            await deleteDoc(doc(db, 'users', uid, 'estoqueGeral', id));
        } catch (err) {
            console.error(err);
            window.alert("Erro ao excluir item.");
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col px-4 py-6 sm:px-6 sm:py-8 font-sans">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    {!hideHeaderBack && (
                        <button
                            onClick={() => navigation?.goBack()}
                            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer shadow-sm"
                            title="Voltar"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Almoxarifado & Estoque</h1>
                        <p className="text-xs text-slate-500">Defensivos, fertilizantes, sementes e peças de reposição</p>
                    </div>
                </div>

                <button
                    onClick={() => setModal({ visible: true, itemId: null })}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-950/10"
                >
                    <PlusCircle size={18} />
                    <span>Novo Item</span>
                </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white shadow-lg shadow-emerald-950/10">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">Patrimônio em Estoque</span>
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                            <Warehouse size={14} />
                        </div>
                    </div>
                    <div className="text-3xl font-black tracking-tight">R$ {formatMoeda(stats.valorTotalEstoque)}</div>
                    <div className="text-xs text-emerald-100 mt-1">Valor acumulado de insumos armazenados</div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total de Itens</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Package size={14} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{stats.totalItens}</div>
                    <div className="text-xs text-slate-500 mt-1">SKUs cadastrados no barracão</div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Alerta de Reposição</span>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stats.alertasEstoqueBaixo > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
                            <AlertCircle size={18} />
                        </div>
                    </div>
                    <div className={`text-2xl font-black ${stats.alertasEstoqueBaixo > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {stats.alertasEstoqueBaixo}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Produtos abaixo do estoque mínimo</div>
                </div>
            </div>

            {/* Tabs & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
                <div className="flex rounded-xl bg-slate-200/80 p-1 w-full sm:w-auto overflow-x-auto">
                    {['todos', 'Defensivo', 'Fertilizante', 'Semente', 'Peça', 'Outro'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                activeTab === tab ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {tab === 'todos' ? 'Todos' : tab}
                        </button>
                    ))}
                </div>

                <div className="relative w-full sm:w-72">
                    <input
                        type="text"
                        placeholder="Buscar insumo, fabricante..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                    <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                </div>
            </div>

            {/* List */}
            <div className="flex-1">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
                        <span className="text-xs font-semibold text-slate-500">Carregando almoxarifado...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                            <Warehouse size={24} />
                        </div>
                        <h3 className="text-base font-bold text-slate-700">Nenhum insumo encontrado</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                            Cadastre novos produtos para gerenciar o saldo e alertas de reposição.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((item) => {
                            const qtd = parseMoeda(item.quantidade || 0);
                            const min = parseMoeda(item.estoqueMinimo || 0);
                            const isBaixo = min > 0 && qtd <= min;

                            return (
                                <div
                                    key={item.id}
                                    className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                                        isBaixo ? 'border-red-200 bg-red-50/20' : 'border-slate-200/80'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                                    {item.tipo || 'Insumo'}
                                                </span>
                                                <h3 className="text-base font-bold text-slate-800 mt-1">
                                                    {item.nome}
                                                </h3>
                                                {item.fabricante && (
                                                    <span className="text-xs text-slate-500 font-medium">
                                                        {item.fabricante}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-right">
                                                <span className={`text-lg font-black ${isBaixo ? 'text-red-600' : 'text-emerald-700'}`}>
                                                    {formatNumero(qtd)} {item.unidade || 'un'}
                                                </span>
                                                {isBaixo && (
                                                    <div className="text-[10px] font-bold text-red-600 uppercase">
                                                        Estoque Baixo!
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mb-3">
                                            {item.valorUnitario && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Preço Unitário:</span>
                                                    <span className="font-semibold">R$ {formatMoeda(item.valorUnitario)}</span>
                                                </div>
                                            )}
                                            {item.localizacao && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Localização / Galpão:</span>
                                                    <span className="font-semibold text-slate-700">{item.localizacao}</span>
                                                </div>
                                            )}
                                            {item.estoqueMinimo && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Estoque Mínimo:</span>
                                                    <span className="font-semibold text-slate-700">{item.estoqueMinimo} {item.unidade}</span>
                                                </div>
                                            )}
                                        </div>

                                        {item.observacoes && (
                                            <p className="text-xs text-slate-500 italic line-clamp-2">
                                                "{item.observacoes}"
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                                        <button
                                            onClick={() => setModal({ visible: true, itemId: item.id })}
                                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                                        >
                                            <Pencil size={16} />
                                            <span>Editar</span>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                                        >
                                            <Trash2 size={16} />
                                            <span>Excluir</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal Estoque */}
            {modal.visible && (
                <ModalAddOrEditEstoque
                    itemId={modal.itemId}
                    onClose={() => setModal({ visible: false, itemId: null })}
                />
            )}
        </div>
    );
}

function ModalAddOrEditEstoque({ itemId, onClose }) {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [nome, setNome] = useState('');
    const [tipo, setTipo] = useState('Defensivo');
    const [quantidade, setQuantidade] = useState('');
    const [unidade, setUnidade] = useState('L');
    const [valorUnitario, setValorUnitario] = useState('');
    const [estoqueMinimo, setEstoqueMinimo] = useState('');
    const [fabricante, setFabricante] = useState('');
    const [localizacao, setLocalizacao] = useState('');
    const [observacoes, setObservacoes] = useState('');

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            try {
                const snap = await getDoc(doc(db, 'users', uid, 'estoqueGeral', itemId));
                if (snap.exists()) {
                    const d = snap.data();
                    setNome(d.nome || '');
                    setTipo(d.tipo || 'Defensivo');
                    setQuantidade(String(d.quantidade || ''));
                    setUnidade(d.unidade || 'L');
                    setValorUnitario(String(d.valorUnitario || ''));
                    setEstoqueMinimo(String(d.estoqueMinimo || ''));
                    setFabricante(d.fabricante || '');
                    setLocalizacao(d.localizacao || '');
                    setObservacoes(d.observacoes || '');
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, [itemId]);

    const handleSave = async (e) => {
        e.preventDefault();
        const qtdNum = parseMoeda(quantidade);
        if (!nome.trim() || isNaN(qtdNum)) {
            window.alert("Informe o nome do item e a quantidade.");
            return;
        }

        setSaving(true);
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        try {
            const docId = itemId || doc(collection(db, 'users', uid, 'estoqueGeral')).id;
            await setDoc(doc(db, 'users', uid, 'estoqueGeral', docId), {
                id: docId,
                nome: nome.trim(),
                tipo,
                quantidade: qtdNum,
                unidade,
                valorUnitario: parseMoeda(valorUnitario),
                estoqueMinimo: parseMoeda(estoqueMinimo),
                fabricante: fabricante.trim(),
                localizacao: localizacao.trim(),
                observacoes: observacoes.trim(),
                atualizadoEm: new Date()
            }, { merge: true });

            onClose();
        } catch (err) {
            console.error(err);
            window.alert("Erro ao salvar item no almoxarifado.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal">
                <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
                    <span className="font-bold text-base">{itemId ? 'Editar Item do Estoque' : 'Novo Insumo / Item'}</span>
                    <button onClick={onClose} className="p-1 rounded-lg text-emerald-200 hover:text-white transition-colors cursor-pointer">
                        <X size={22} />
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Nome do Produto / Item *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Ureia Protegida"
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Categoria / Tipo
                                </label>
                                <select
                                    value={tipo}
                                    onChange={(e) => setTipo(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="Defensivo">Defensivo Agrícola</option>
                                    <option value="Fertilizante">Fertilizante / Adubo</option>
                                    <option value="Semente">Sementes</option>
                                    <option value="Peça">Peça de Reposição</option>
                                    <option value="Combustível">Combustível / Óleo</option>
                                    <option value="Insumo">Insumo Geral</option>
                                    <option value="Outro">Outro</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Quantidade Atual *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: 50"
                                    value={quantidade}
                                    onChange={(e) => setQuantidade(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Unidade de Medida
                                </label>
                                <select
                                    value={unidade}
                                    onChange={(e) => setUnidade(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="L">Litros (L)</option>
                                    <option value="kg">Quilos (Kg)</option>
                                    <option value="ton">Toneladas (Ton)</option>
                                    <option value="sc">Sacas (sc)</option>
                                    <option value="un">Unidades (un)</option>
                                    <option value="cx">Caixas (cx)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Valor Unitário (R$)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 145,00"
                                    value={valorUnitario}
                                    onChange={(e) => setValorUnitario(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Estoque Mínimo (Alerta)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 10"
                                    value={estoqueMinimo}
                                    onChange={(e) => setEstoqueMinimo(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Fabricante / Marca
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Bayer / Syngenta"
                                    value={fabricante}
                                    onChange={(e) => setFabricante(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Localização no Galpão
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Barracão 02 - Prateleira A"
                                    value={localizacao}
                                    onChange={(e) => setLocalizacao(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Observações
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Lote, data de validade, instruções de armazenagem..."
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 resize-none"
                            />
                        </div>

                        <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : 'Salvar Item'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// =========================================================================
// 3. GESTÃO DE MÁQUINAS E INVENTÁRIO (InventarioMaquinasScreen)
// =========================================================================

export function InventarioMaquinasScreen({ navigation, hideHeaderBack }) {
    const [maquinas, setMaquinas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [modal, setModal] = useState({ visible: false, itemId: null });

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const q = query(collection(db, 'users', uid, 'inventario'), orderBy('marca', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMaquinas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error(err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const stats = useMemo(() => {
        let valorTotalFrota = 0;
        let operacionais = 0;

        maquinas.forEach(m => {
            valorTotalFrota += parseMoeda(m.valorEstimado || 0);
            if (m.status !== 'Inativo' && m.status !== 'Em Manutenção') operacionais++;
        });

        return {
            totalMaquinas: maquinas.length,
            valorTotalFrota,
            operacionais
        };
    }, [maquinas]);

    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return maquinas.filter(m => 
            !searchQuery ||
            m.marca?.toLowerCase().includes(q) ||
            m.modelo?.toLowerCase().includes(q) ||
            m.tipo?.toLowerCase().includes(q) ||
            m.placaChassi?.toLowerCase().includes(q)
        );
    }, [maquinas, searchQuery]);

    const handleDelete = async (id) => {
        if (!window.confirm("Deseja realmente excluir esta máquina da frota?")) return;
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        try {
            await deleteDoc(doc(db, 'users', uid, 'inventario', id));
        } catch (err) {
            console.error(err);
            window.alert("Erro ao excluir máquina.");
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col px-4 py-6 sm:px-6 sm:py-8 font-sans">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    {!hideHeaderBack && (
                        <button
                            onClick={() => navigation?.goBack()}
                            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer shadow-sm"
                            title="Voltar"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Inventário de Máquinas</h1>
                        <p className="text-xs text-slate-500">Frota agrícola, implementos, tratores e caminhões</p>
                    </div>
                </div>

                <button
                    onClick={() => setModal({ visible: true, itemId: null })}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-950/10"
                >
                    <PlusCircle size={18} />
                    <span>Nova Máquina</span>
                </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white shadow-lg shadow-emerald-950/10">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">Patrimônio em Maquinário</span>
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                            <Tractor size={14} />
                        </div>
                    </div>
                    <div className="text-3xl font-black tracking-tight">R$ {formatMoeda(stats.valorTotalFrota)}</div>
                    <div className="text-xs text-emerald-100 mt-1">Valor estimado da frota total</div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Equipamentos Totais</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Truck size={18} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{stats.totalMaquinas}</div>
                    <div className="text-xs text-slate-500 mt-1">Tratores, colheitadeiras e implementos</div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Operacionais em Campo</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 size={18} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-emerald-700">{stats.operacionais}</div>
                    <div className="text-xs text-slate-500 mt-1">Ativos e disponíveis para trabalho</div>
                </div>
            </div>

            {/* Search */}
            <div className="mb-6">
                <div className="relative w-full sm:w-80">
                    <input
                        type="text"
                        placeholder="Buscar marca, modelo, chassi..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-sm"
                    />
                    <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                </div>
            </div>

            {/* List */}
            <div className="flex-1">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
                        <span className="text-xs font-semibold text-slate-500">Carregando frota...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                            <Tractor size={24} />
                        </div>
                        <h3 className="text-base font-bold text-slate-700">Nenhum equipamento cadastrado</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                            Clique em "Nova Máquina" para catalogar os veículos e implementos da fazenda.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((item) => {
                            const statusColor = 
                                item.status === 'Em Manutenção' ? 'bg-amber-100 text-amber-800' :
                                item.status === 'Inativo' ? 'bg-slate-200 text-slate-700' :
                                'bg-emerald-100 text-emerald-800';

                            return (
                                <div
                                    key={item.id}
                                    className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColor}`}>
                                                    {item.status || 'Ativo'}
                                                </span>
                                                <h3 className="text-base font-bold text-slate-800 mt-1">
                                                    {item.marca} {item.modelo}
                                                </h3>
                                                <div className="text-xs text-slate-500 font-medium">
                                                    {item.tipo} {item.ano ? `(${item.ano})` : ''}
                                                </div>
                                            </div>

                                            {item.valorEstimado && (
                                                <span className="text-sm font-black text-slate-800">
                                                    R$ {formatMoeda(item.valorEstimado)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mb-3">
                                            {item.horimetroKm && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Horímetro / KM:</span>
                                                    <span className="font-semibold">{item.horimetroKm} h/km</span>
                                                </div>
                                            )}
                                            {item.placaChassi && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Placa / Chassi:</span>
                                                    <span className="font-semibold text-slate-700">{item.placaChassi}</span>
                                                </div>
                                            )}
                                        </div>

                                        {item.observacoes && (
                                            <p className="text-xs text-slate-500 italic line-clamp-2">
                                                "{item.observacoes}"
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                                        <button
                                            onClick={() => setModal({ visible: true, itemId: item.id })}
                                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                                        >
                                            <Pencil size={16} />
                                            <span>Editar</span>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                                        >
                                            <Trash2 size={16} />
                                            <span>Excluir</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal Máquinas */}
            {modal.visible && (
                <ModalAddOrEditMaquina
                    itemId={modal.itemId}
                    onClose={() => setModal({ visible: false, itemId: null })}
                />
            )}
        </div>
    );
}

function ModalAddOrEditMaquina({ itemId, onClose }) {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');
    const [tipo, setTipo] = useState('Trator');
    const [ano, setAno] = useState('');
    const [horimetroKm, setHorimetroKm] = useState('');
    const [placaChassi, setPlacaChassi] = useState('');
    const [status, setStatus] = useState('Ativo');
    const [valorEstimado, setValorEstimado] = useState('');
    const [observacoes, setObservacoes] = useState('');

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            try {
                const snap = await getDoc(doc(db, 'users', uid, 'inventario', itemId));
                if (snap.exists()) {
                    const d = snap.data();
                    setMarca(d.marca || '');
                    setModelo(d.modelo || '');
                    setTipo(d.tipo || 'Trator');
                    setAno(String(d.ano || ''));
                    setHorimetroKm(String(d.horimetroKm || ''));
                    setPlacaChassi(d.placaChassi || '');
                    setStatus(d.status || 'Ativo');
                    setValorEstimado(String(d.valorEstimado || ''));
                    setObservacoes(d.observacoes || '');
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, [itemId]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!marca.trim() || !modelo.trim()) {
            window.alert("Informe a marca e o modelo do equipamento.");
            return;
        }

        setSaving(true);
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        try {
            const docId = itemId || doc(collection(db, 'users', uid, 'inventario')).id;
            await setDoc(doc(db, 'users', uid, 'inventario', docId), {
                id: docId,
                marca: marca.trim(),
                modelo: modelo.trim(),
                tipo,
                ano: ano.trim(),
                horimetroKm: horimetroKm.trim(),
                placaChassi: placaChassi.trim(),
                status,
                valorEstimado: parseMoeda(valorEstimado),
                observacoes: observacoes.trim(),
                atualizadoEm: new Date()
            }, { merge: true });

            onClose();
        } catch (err) {
            console.error(err);
            window.alert("Erro ao salvar máquina.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal">
                <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
                    <span className="font-bold text-base">{itemId ? 'Editar Equipamento' : 'Novo Equipamento / Máquina'}</span>
                    <button onClick={onClose} className="p-1 rounded-lg text-emerald-200 hover:text-white transition-colors cursor-pointer">
                        <X size={22} />
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Marca / Fabricante *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: John Deere / Massey Ferguson"
                                    value={marca}
                                    onChange={(e) => setMarca(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Modelo *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: 6110J / S790"
                                    value={modelo}
                                    onChange={(e) => setModelo(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Tipo de Maquinário
                                </label>
                                <select
                                    value={tipo}
                                    onChange={(e) => setTipo(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="Trator">Trator</option>
                                    <option value="Colheitadeira">Colheitadeira</option>
                                    <option value="Pulverizador">Pulverizador Autopropelido</option>
                                    <option value="Plantadeira">Plantadeira / Semeadeira</option>
                                    <option value="Caminhão">Caminhão / Bitrem</option>
                                    <option value="Implemento">Implemento (Grade, Subsolador...)</option>
                                    <option value="Utilitário">Veículo Utilitário / Picape</option>
                                    <option value="Outro">Outro</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Status Operacional
                                </label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="Ativo">Ativo / Operacional</option>
                                    <option value="Em Manutenção">Em Manutenção / Oficina</option>
                                    <option value="Inativo">Inativo / Desativado</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Ano de Fabricação
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 2022"
                                    value={ano}
                                    onChange={(e) => setAno(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Horímetro / KM
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 1450"
                                    value={horimetroKm}
                                    onChange={(e) => setHorimetroKm(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Placa / Chassi / Nº Série
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: ABC-1234 / 1HD..."
                                    value={placaChassi}
                                    onChange={(e) => setPlacaChassi(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Valor Estimado (R$)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 650000,00"
                                    value={valorEstimado}
                                    onChange={(e) => setValorEstimado(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Observações
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Acessórios, piloto automático, telemetria instalada..."
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 resize-none"
                            />
                        </div>

                        <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : 'Salvar Máquina'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
