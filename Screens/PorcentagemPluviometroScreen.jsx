import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    ArrowLeft,
    PlusCircle,
    ListTodo,
    CheckCheck,
    ChevronRight,
    CloudRain,
    X,
    Sparkles,
    UploadCloud,
    Pencil,
    Trash2,
    Radio,
    MapPin,
    RefreshCw,
    Check,
    CheckCircle2,
    Calendar,
    Download,
    Compass,
    Sun,
    Search,
    Info
} from 'lucide-react-native';
import {
    collection,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    writeBatch
} from 'firebase/firestore';
import { Chart } from 'react-google-charts';
import { auth, db } from '../firebaseConfig';
import { usePropertyAuth } from '../context/PropertyContext';
import { analyzePluviometroFile } from '../services/agroDocumentAIService';
import { fetchRainHistory, fetchRainForSpecificDate } from '../services/weatherService';
import { getCurrentPosition, reverseGeocodeOSM, searchLocationOSM } from '../services/locationService';

const parseMoeda = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleanStr = String(val).replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
};

const formatNumero = (val, decimals = 1) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const formatDate = (dateVal) => {
    if (!dateVal) return '--/--/----';
    const date = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
    if (isNaN(date.getTime())) return '--/--/----';
    return date.toLocaleDateString('pt-BR');
};

// =========================================================================
// 1. TELA DE ANDAMENTO DE ATIVIDADES (% DA SAFRA)
// =========================================================================

export function PorcentagemListaScreen({ navigation }) {
    const { effectiveUid, isAdmin, isMember } = usePropertyAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ visible: false, itemId: null });

    useEffect(() => {
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        const q = query(collection(db, 'users', uid, 'porcentagens'), orderBy('dataAtualizacao', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error(err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [effectiveUid]);

    // Dados para o Gráfico de Barras do Google Charts
    const chartData = useMemo(() => {
        if (!items || items.length === 0) return null;
        const header = ["Atividade", "Progresso (%)", { role: "style" }];
        const rows = items.map(item => [item.titulo, parseFloat(item.valor) || 0, '#16a34a']);
        return [header, ...rows];
    }, [items]);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <div className="screen-wrapper w-full max-w-6xl mx-auto flex-1 flex flex-col px-4 py-6 sm:px-6 sm:py-8">
                
                {/* Header */}
                <div className="screen-header flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigation?.goBack()}
                            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer shadow-sm shrink-0"
                            title="Voltar"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="screen-title text-2xl font-black text-slate-800 tracking-tight">Andamento da Safra</h1>
                            <p className="text-xs text-slate-500">Progresso percentual de cada fase e atividade</p>
                        </div>
                    </div>

                    <div className="screen-header-actions flex items-center gap-2">
                        {isAdmin ? (
                            <button
                                onClick={() => setModal({ visible: true, itemId: null })}
                                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-950/10"
                            >
                                <PlusCircle size={18} />
                                <span>Nova Atividade</span>
                            </button>
                        ) : (
                            <div className="px-3 py-1.5 bg-slate-200/80 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-300">
                                <span>👤 Visualização</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Chart Card */}
                {chartData && (
                    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm mb-6">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                            Visão Geral do Progresso
                        </h3>
                        <div className="chart-wrapper w-full overflow-hidden rounded-2xl">
                            <Chart
                                chartType="BarChart"
                                width="100%"
                                height="100%"
                                data={chartData}
                                options={{
                                    chartArea: { width: "70%", height: '75%' },
                                    hAxis: { minValue: 0, maxValue: 100, title: 'Concluído (%)' },
                                    legend: { position: "none" },
                                    backgroundColor: 'transparent'
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* List of Activities */}
                <div className="flex-1">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
                            <span className="text-xs font-semibold text-slate-500">Carregando andamento...</span>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                                <ListTodo size={24} />
                            </div>
                            <h3 className="text-base font-bold text-slate-700">Nenhuma atividade cadastrada</h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                {isAdmin ? 'Toque no botão "Nova Atividade" para acompanhar o progresso das operações da fazenda.' : 'Nenhuma atividade registrada.'}
                            </p>
                        </div>
                    ) : (
                        <div className="cards-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {items.map((item) => {
                                const prog = Math.min(100, Math.max(0, parseFloat(item.valor) || 0));

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => isAdmin && setModal({ visible: true, itemId: item.id })}
                                        className={`bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm transition-all flex flex-col justify-between group ${
                                            isAdmin ? 'hover:shadow-md hover:border-emerald-300 cursor-pointer' : ''
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                                                        prog === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {prog === 100 ? (
                                                            <CheckCheck size={20} />
                                                        ) : (
                                                            <span>{prog.toFixed(0)}%</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h3 className={`text-base font-bold text-slate-800 ${isAdmin ? 'group-hover:text-emerald-700' : ''} transition-colors`}>
                                                            {item.titulo || 'Atividade'}
                                                        </h3>
                                                        <span className="text-[11px] text-slate-400">
                                                            Atualizado em {formatDate(item.dataAtualizacao)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden mb-2">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                        prog >= 100 ? 'bg-emerald-600' : prog >= 50 ? 'bg-emerald-500' : 'bg-amber-500'
                                                    }`}
                                                    style={{ width: `${prog}%` }}
                                                />
                                            </div>

                                            {item.descricao && (
                                                <p className="text-xs text-slate-500 italic mt-2 line-clamp-2">
                                                    "{item.descricao}"
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500">
                                            <span className={prog === 100 ? 'text-emerald-600 font-bold' : 'text-slate-500'}>
                                                {prog === 100 ? 'Concluído' : `${(100 - prog).toFixed(0)}% restante`}
                                            </span>
                                            {isAdmin && (
                                                <div className="flex items-center gap-1 text-emerald-600 group-hover:translate-x-1 transition-transform">
                                                    <span>Editar</span>
                                                    <ChevronRight size={14} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Modal de Andamento */}
                {modal.visible && isAdmin && (
                    <ModalAddOrEditPorcentagem
                        itemId={modal.itemId}
                        effectiveUid={effectiveUid}
                        onClose={() => setModal({ visible: false, itemId: null })}
                    />
                )}

            </div>
        </div>
    );
}

// Modal de Andamento
function ModalAddOrEditPorcentagem({ itemId, onClose, effectiveUid }) {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [titulo, setTitulo] = useState('');
    const [valor, setValor] = useState('');
    const [descricao, setDescricao] = useState('');

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            const uid = effectiveUid || auth.currentUser?.uid;
            if (!uid) return;
            try {
                const snap = await getDoc(doc(db, 'users', uid, 'porcentagens', itemId));
                if (snap.exists()) {
                    const d = snap.data();
                    setTitulo(d.titulo || '');
                    setValor(String(d.valor || ''));
                    setDescricao(d.descricao || '');
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, [itemId, effectiveUid]);

    const handleSave = async (e) => {
        e.preventDefault();
        const v = parseMoeda(valor);
        if (!titulo.trim() || isNaN(v) || v < 0 || v > 100) {
            window.alert("Informe um título e uma porcentagem válida de 0 a 100%.");
            return;
        }

        setSaving(true);
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        try {
            const docId = itemId || doc(collection(db, 'users', uid, 'porcentagens')).id;
            await setDoc(doc(db, 'users', uid, 'porcentagens', docId), {
                id: docId,
                titulo: titulo.trim(),
                valor: v,
                descricao: descricao.trim(),
                dataAtualizacao: new Date()
            }, { merge: true });

            onClose();
        } catch (err) {
            console.error(err);
            window.alert("Erro ao salvar andamento.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Deseja realmente excluir esta atividade?")) return;
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;
        try {
            await deleteDoc(doc(db, 'users', uid, 'porcentagens', itemId));
            onClose();
        } catch (err) {
            console.error(err);
            window.alert("Erro ao excluir.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="modal-container w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal">
                <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
                    <span className="font-bold text-base">{itemId ? 'Editar Atividade' : 'Nova Atividade'}</span>
                    <button onClick={onClose} className="p-1 rounded-lg text-emerald-200 hover:text-white transition-colors cursor-pointer">
                        <X size={22} />
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="modal-body p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Nome da Atividade *
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="Ex: Plantio de Soja (Safra 24/25)"
                                value={titulo}
                                onChange={(e) => setTitulo(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Progresso Concluído (%) *
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                required
                                placeholder="0 a 100"
                                value={valor}
                                onChange={(e) => setValor(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 text-lg font-bold text-emerald-700"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Observações
                            </label>
                            <textarea
                                rows={3}
                                placeholder="Detalhes, previsões, maquinários alocados..."
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 resize-none"
                            />
                        </div>

                        <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                            {itemId ? (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="px-3.5 py-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                                >
                                    <Trash2 size={16} />
                                    <span>Excluir</span>
                                </button>
                            ) : <div />}

                            <div className="flex items-center gap-3">
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
                                    {saving ? 'Salvando...' : 'Salvar Atividade'}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// =========================================================================
// 2. TELA DE ÍNDICE PLUVIOMÉTRICO (PluviometroListaScreen)
// =========================================================================

export function PluviometroListaScreen({ navigation }) {
    const { effectiveUid, isAdmin, isMember } = usePropertyAuth();
    const [medicoes, setMedicoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [syncModalVisible, setSyncModalVisible] = useState(false);

    useEffect(() => {
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        const q = query(collection(db, 'users', uid, 'pluviometro'), orderBy('dataMedicao', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMedicoes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error(err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [effectiveUid]);

    // Estatísticas de Chuva
    const stats = useMemo(() => {
        let totalMm = 0;
        let maxMm = 0;

        medicoes.forEach(m => {
            const mm = parseMoeda(m.milimetros || 0);
            totalMm += mm;
            if (mm > maxMm) maxMm = mm;
        });

        const count = medicoes.length;
        const mediaMm = count > 0 ? totalMm / count : 0;

        return {
            totalMm,
            maxMm,
            mediaMm,
            count
        };
    }, [medicoes]);

    // Dados para o Gráfico de Área do Histórico de Chuvas
    const chartData = useMemo(() => {
        if (!medicoes || medicoes.length < 2) return null;
        const sortedAsc = [...medicoes].reverse();
        return [
            ['Data', 'Chuva (mm)'],
            ...sortedAsc.map(item => {
                const dateStr = formatDate(item.dataMedicao);
                return [dateStr, parseFloat(item.milimetros) || 0];
            })
        ];
    }, [medicoes]);

    const handleDelete = async (id) => {
        if (!isAdmin) return;
        if (!window.confirm("Deseja realmente excluir esta medição de chuva?")) return;
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;
        try {
            await deleteDoc(doc(db, 'users', uid, 'pluviometro', id));
        } catch (err) {
            console.error(err);
            window.alert("Erro ao excluir medição.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <div className="screen-wrapper w-full max-w-6xl mx-auto flex-1 flex flex-col px-4 py-6 sm:px-6 sm:py-8">
                
                {/* Header */}
                <div className="screen-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigation?.goBack()}
                            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer shadow-sm shrink-0"
                            title="Voltar"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="screen-title text-2xl font-black text-slate-800 tracking-tight">Controle Pluviométrico</h1>
                            <p className="text-xs text-slate-500">Registro diário de precipitações e histórico de chuvas</p>
                        </div>
                    </div>

                    <div className="screen-header-actions flex items-center gap-2.5 flex-wrap">
                        {isAdmin ? (
                            <>
                                {/* Botão Sincronizar via OpenWeather / Estação */}
                                <button
                                    onClick={() => setSyncModalVisible(true)}
                                    className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-sky-950/15"
                                    title="Consultar chuvas de hoje e dias anteriores via OpenWeather & Radar"
                                >
                                    <Radio size={16} className="animate-pulse" />
                                    <span>Consultar Chuvas (OpenWeather)</span>
                                </button>

                                <button
                                    onClick={() => setModal({ visible: true, itemId: null })}
                                    className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-sky-950/10"
                                >
                                    <PlusCircle size={18} />
                                    <span>Nova Medição</span>
                                </button>
                            </>
                        ) : (
                            <div className="px-3 py-1.5 bg-slate-200/80 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-300">
                                <span>👤 Visualização</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Metric Cards */}
                <div className="metric-grid grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
                    <div className="metric-card p-4 rounded-2xl bg-gradient-to-br from-sky-600 to-blue-800 text-white shadow-lg shadow-sky-950/10">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-sky-200">Total Acumulado</span>
                        <div className="stat-value text-2xl sm:text-3xl font-black tracking-tight mt-1">{formatNumero(stats.totalMm)} <span className="text-xs font-semibold text-sky-200">mm</span></div>
                    </div>

                    <div className="metric-card p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Média / Evento</span>
                        <div className="stat-value text-2xl font-black text-slate-800 mt-1">{formatNumero(stats.mediaMm)} <span className="text-xs font-semibold text-slate-500">mm</span></div>
                    </div>

                    <div className="metric-card p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Maior Chuva</span>
                        <div className="stat-value text-2xl font-black text-sky-600 mt-1">{formatNumero(stats.maxMm)} <span className="text-xs font-semibold text-slate-500">mm</span></div>
                    </div>

                    <div className="metric-card p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Registros</span>
                        <div className="stat-value text-2xl font-black text-slate-800 mt-1">{stats.count} <span className="text-xs font-semibold text-slate-500">dias</span></div>
                    </div>
                </div>

                {/* Rain Area Chart */}
                {chartData && (
                    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm mb-6">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                            Histórico de Precipitação Acumulada
                        </h3>
                        <div className="chart-wrapper w-full overflow-hidden rounded-2xl">
                            <Chart
                                chartType="AreaChart"
                                width="100%"
                                height="100%"
                                data={chartData}
                                options={{
                                    hAxis: { textStyle: { color: '#64748b', fontSize: 11 } },
                                    vAxis: { minValue: 0, title: 'mm' },
                                    legend: { position: 'none' },
                                    colors: ['#0284c7'],
                                    chartArea: { width: '85%', height: '70%' },
                                    backgroundColor: 'transparent'
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* List of Rain Measurements */}
                <div className="flex-1">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mb-3" />
                            <span className="text-xs font-semibold text-slate-500">Carregando medições...</span>
                        </div>
                    ) : medicoes.length === 0 ? (
                        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                                <CloudRain size={24} />
                            </div>
                            <h3 className="text-base font-bold text-slate-700">Nenhuma medição registrada</h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto mb-4">
                                {isAdmin ? 'Você pode registrar a chuva manualmente ou puxar o histórico de hoje e dias anteriores via OpenWeather.' : 'Nenhuma medição de chuva encontrada.'}
                            </p>
                            {isAdmin && (
                                <button
                                    onClick={() => setSyncModalVisible(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                                >
                                    <Radio size={15} />
                                    <span>Consultar Chuvas Recentes via API</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="cards-grid rain-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                            {medicoes.map((item) => {
                                const mm = parseMoeda(item.milimetros || 0);

                                return (
                                    <div
                                        key={item.id}
                                        className="data-card bg-white rounded-2xl border border-slate-200/80 p-4.5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                                                        <CloudRain size={18} />
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-800">
                                                            {formatDate(item.dataMedicao)}
                                                        </span>
                                                        <div className="text-[11px] text-slate-400">
                                                            {item.talhao || 'Pluviômetro Sede'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <span className="text-xl font-black text-sky-600">
                                                    {formatNumero(mm)} mm
                                                </span>
                                            </div>

                                            {item.observacoes && (
                                                <p className="text-xs text-slate-500 italic mt-2 bg-slate-50 p-2 rounded-lg">
                                                    "{item.observacoes}"
                                                </p>
                                            )}
                                        </div>

                                        {isAdmin && (
                                            <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-slate-100">
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
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Modal Pluviômetro Manual / IA */}
                {modal.visible && isAdmin && (
                    <ModalAddOrEditPluviometro
                        itemId={modal.itemId}
                        effectiveUid={effectiveUid}
                        onClose={() => setModal({ visible: false, itemId: null })}
                    />
                )}

                {/* Modal Sincronização OpenWeather de Chuvas */}
                {syncModalVisible && isAdmin && (
                    <ModalOpenWeatherRainSync
                        existingRecords={medicoes}
                        effectiveUid={effectiveUid}
                        onClose={() => setSyncModalVisible(false)}
                    />
                )}

            </div>
        </div>
    );
}

// =========================================================================
// 3. MODAL DE MEDIÇÃO INDIVIDUAL (MANUAL / IA / OPENWEATHER)
// =========================================================================

function ModalAddOrEditPluviometro({ itemId, onClose, effectiveUid }) {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [aiLoading, setAiLoading] = useState(false);
    const [weatherLoading, setWeatherLoading] = useState(false);
    const fileInputRef = useRef(null);

    const [milimetros, setMilimetros] = useState('');
    const [talhao, setTalhao] = useState('');
    const [dataMedicao, setDataMedicao] = useState(new Date().toISOString().split('T')[0]);
    const [observacoes, setObservacoes] = useState('');

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            const uid = effectiveUid || auth.currentUser?.uid;
            if (!uid) return;
            try {
                const snap = await getDoc(doc(db, 'users', uid, 'pluviometro', itemId));
                if (snap.exists()) {
                    const d = snap.data();
                    setMilimetros(String(d.milimetros || ''));
                    setTalhao(d.talhao || '');
                    setDataMedicao(d.dataMedicao?.toDate ? d.dataMedicao.toDate().toISOString().split('T')[0] : (d.dataMedicao || new Date().toISOString().split('T')[0]));
                    setObservacoes(d.observacoes || '');
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, [itemId, effectiveUid]);

    const handleAiFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setAiLoading(true);
        try {
            const extracted = await analyzePluviometroFile(file);
            if (extracted.milimetros !== undefined && extracted.milimetros !== null) {
                setMilimetros(String(extracted.milimetros));
            }
            if (extracted.talhao) setTalhao(extracted.talhao);
            if (extracted.dataMedicao) setDataMedicao(extracted.dataMedicao);
            if (extracted.observacoes) setObservacoes(extracted.observacoes);
        } catch (err) {
            console.error("Erro na extração de chuva com IA:", err);
            window.alert("Não foi possível analisar a imagem de chuva: " + (err.message || "Erro desconhecido"));
        } finally {
            setAiLoading(false);
            if (e.target) e.target.value = '';
        }
    };

    // Consulta chuva da data selecionada via OpenWeather / Radar
    const handleFetchWeatherForDate = async () => {
        setWeatherLoading(true);
        try {
            let lat = -15.7942;
            let lon = -47.8822;

            try {
                const pos = await getCurrentPosition();
                lat = pos.latitude;
                lon = pos.longitude;
            } catch (gpsErr) {
                console.warn("GPS indisponível, usando localização de referência:", gpsErr);
            }

            const rainData = await fetchRainForSpecificDate({
                latitude: lat,
                longitude: lon,
                dateStr: dataMedicao
            });

            if (rainData && rainData.mm !== undefined) {
                setMilimetros(String(rainData.mm));
                if (!observacoes) {
                    setObservacoes(`Chuva registrada via OpenWeather / Estação Meteorológica (${rainData.desc || 'Precipitação'})`);
                }
                if (!talhao) {
                    setTalhao('Estação Meteorológica');
                }
            } else {
                window.alert("Não foram encontrados dados de precipitação para esta data.");
            }
        } catch (err) {
            console.error("Erro ao puxar dados de chuva da API:", err);
            window.alert("Erro ao consultar clima: " + (err.message || "Tente novamente."));
        } finally {
            setWeatherLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const mm = parseMoeda(milimetros);
        if (isNaN(mm) || mm < 0) {
            window.alert("Informe um volume de chuva válido em mm.");
            return;
        }

        setSaving(true);
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        try {
            const docId = itemId || doc(collection(db, 'users', uid, 'pluviometro')).id;
            await setDoc(doc(db, 'users', uid, 'pluviometro', docId), {
                id: docId,
                milimetros: mm,
                talhao: talhao.trim() || 'Sede',
                dataMedicao: new Date(`${dataMedicao}T12:00:00`),
                observacoes: observacoes.trim(),
                atualizadoEm: new Date()
            }, { merge: true });

            onClose();
        } catch (err) {
            console.error(err);
            window.alert("Erro ao salvar medição.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="modal-container w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal">
                <div className="px-6 py-4 bg-sky-700 text-white flex items-center justify-between">
                    <span className="font-bold text-base">{itemId ? 'Editar Medição de Chuva' : 'Nova Medição de Chuva'}</span>
                    <button onClick={onClose} className="p-1 rounded-lg text-sky-200 hover:text-white transition-colors cursor-pointer">
                        <X size={22} />
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="modal-body p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                        
                        {/* Opções de Leitura Rápida: IA ou OpenWeather */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* Leitura com Foto / IA */}
                            <div className="p-3 rounded-2xl bg-sky-50/80 border border-sky-200 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
                                        <Sparkles size={14} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-bold text-sky-900">Leitura Foto / IA</span>
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*,.pdf"
                                    onChange={handleAiFileUpload}
                                />
                                <button
                                    type="button"
                                    disabled={aiLoading}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                    {aiLoading ? (
                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <UploadCloud size={13} />
                                            <span>Foto</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Puxar via OpenWeather API */}
                            <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                                        <Radio size={14} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-bold text-blue-900">OpenWeather</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    disabled={weatherLoading}
                                    onClick={handleFetchWeatherForDate}
                                    className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                    title="Puxar chuva registrada na data selecionada"
                                >
                                    {weatherLoading ? (
                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <RefreshCw size={13} />
                                            <span>Puxar</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Precipitação (mm) *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: 24.5"
                                    value={milimetros}
                                    onChange={(e) => setMilimetros(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-lg font-bold text-sky-600 focus:outline-none focus:border-sky-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Data da Chuva *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={dataMedicao}
                                    onChange={(e) => setDataMedicao(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Ponto de Coleta / Talhão
                            </label>
                            <input
                                type="text"
                                placeholder="Ex: Pluviômetro Sede / Talhão 05"
                                value={talhao}
                                onChange={(e) => setTalhao(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Observações do Tempo
                            </label>
                            <textarea
                                rows={3}
                                placeholder="Chuva mansa, granizo, vento forte..."
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500 resize-none"
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
                                className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : 'Salvar Medição'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// =========================================================================
// 4. MODAL DE CONSULTA & SINCRONIZAÇÃO OPENWEATHER (HOJE E DIAS ANTERIORES)
// =========================================================================

function ModalOpenWeatherRainSync({ existingRecords = [], onClose, effectiveUid }) {
    const [pastDays, setPastDays] = useState(7);
    const [loading, setLoading] = useState(true);
    const [importingId, setImportingId] = useState(null);
    const [importingAll, setImportingAll] = useState(false);
    const [rainHistory, setRainHistory] = useState([]);
    const [customApiKey, setCustomApiKey] = useState('');
    const [showKeyInput, setShowKeyInput] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchingCity, setSearchingCity] = useState(false);
    const [searchResults, setSearchResults] = useState([]);

    const [location, setLocation] = useState({
        lat: -15.7942,
        lon: -47.8822,
        name: 'Detectando localização...',
        detected: false
    });

    // Mapeamento de datas que já foram registradas no Firestore do usuário
    const existingDatesSet = useMemo(() => {
        const set = new Set();
        existingRecords.forEach(r => {
            if (!r.dataMedicao) return;
            const dateStr = r.dataMedicao?.toDate ? r.dataMedicao.toDate().toISOString().split('T')[0] : String(r.dataMedicao).split('T')[0];
            if (dateStr) set.add(dateStr);
        });
        return set;
    }, [existingRecords]);

    // Detecção inicial de GPS e busca de histórico
    useEffect(() => {
        let isMounted = true;

        (async () => {
            setLoading(true);
            let currentLat = -15.7942;
            let currentLon = -47.8822;
            let locName = 'Brasília / Região Central';

            try {
                const pos = await getCurrentPosition();
                currentLat = pos.latitude;
                currentLon = pos.longitude;
                const geo = await reverseGeocodeOSM(currentLat, currentLon);
                locName = `${geo.city || 'Fazenda'}${geo.state ? ' - ' + geo.state : ''}`;
            } catch (posErr) {
                console.warn("GPS não concedido ou indisponível:", posErr);
                locName = 'Localização GPS Padrão';
            }

            if (!isMounted) return;

            setLocation({
                lat: currentLat,
                lon: currentLon,
                name: locName,
                detected: true
            });

            try {
                const history = await fetchRainHistory({
                    latitude: currentLat,
                    longitude: currentLon,
                    pastDays: pastDays,
                    customApiKey
                });
                if (isMounted) setRainHistory(history);
            } catch (err) {
                console.error("Erro ao carregar histórico de chuva:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, []);

    // Atualiza consulta ao alterar dias ou localização
    const handleRefresh = async (overrideLat, overrideLon, overrideDays, overrideKey) => {
        setLoading(true);
        const lat = overrideLat !== undefined ? overrideLat : location.lat;
        const lon = overrideLon !== undefined ? overrideLon : location.lon;
        const days = overrideDays !== undefined ? overrideDays : pastDays;
        const key = overrideKey !== undefined ? overrideKey : customApiKey;

        try {
            const history = await fetchRainHistory({
                latitude: lat,
                longitude: lon,
                pastDays: days,
                customApiKey: key
            });
            setRainHistory(history);
        } catch (err) {
            console.error("Erro ao atualizar chuva:", err);
            window.alert("Erro ao consultar OpenWeather: " + (err.message || "Tente novamente."));
        } finally {
            setLoading(false);
        }
    };

    // Buscar cidade por texto
    const handleSearchCity = async (e) => {
        e?.preventDefault();
        if (!searchQuery.trim()) return;

        setSearchingCity(true);
        try {
            const results = await searchLocationOSM(searchQuery.trim());
            setSearchResults(results);
        } catch (err) {
            console.error("Erro na busca de cidade:", err);
        } finally {
            setSearchingCity(false);
        }
    };

    const handleSelectCity = (res) => {
        setLocation({
            lat: res.lat,
            lon: res.lon,
            name: res.displayName.split(',').slice(0, 2).join(','),
            detected: true
        });
        setSearchResults([]);
        setSearchQuery('');
        handleRefresh(res.lat, res.lon, pastDays, customApiKey);
    };

    // Importa um dia específico para o Firestore
    const handleImportDay = async (dayItem) => {
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        setImportingId(dayItem.date);
        try {
            const docId = doc(collection(db, 'users', uid, 'pluviometro')).id;
            await setDoc(doc(db, 'users', uid, 'pluviometro', docId), {
                id: docId,
                milimetros: dayItem.mm,
                talhao: `Estação OpenWeather (${location.name || 'Fazenda'})`,
                dataMedicao: new Date(`${dayItem.date}T12:00:00`),
                observacoes: `Chuva ${dayItem.desc} • ${dayItem.mm} mm (Importado via OpenWeather API / Radar)`,
                atualizadoEm: new Date(),
                fonte: 'OpenWeather'
            });
        } catch (err) {
            console.error("Erro ao importar medição:", err);
            window.alert("Erro ao importar medição.");
        } finally {
            setImportingId(null);
        }
    };

    // Importa em lote todos os dias que tiveram chuva (mm > 0) e que não foram importados ainda
    const handleImportAllRainyDays = async () => {
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        const toImport = rainHistory.filter(item => item.mm > 0 && !existingDatesSet.has(item.date));
        if (toImport.length === 0) {
            window.alert("Nenhum dia novo com chuva para importar no período selecionado.");
            return;
        }

        if (!window.confirm(`Deseja importar ${toImport.length} registro(s) de chuva diretamente para o Pluviômetro?`)) return;

        setImportingAll(true);
        try {
            const batch = writeBatch(db);
            toImport.forEach(item => {
                const docRef = doc(collection(db, 'users', uid, 'pluviometro'));
                batch.set(docRef, {
                    id: docRef.id,
                    milimetros: item.mm,
                    talhao: `Estação OpenWeather (${location.name || 'Fazenda'})`,
                    dataMedicao: new Date(`${item.date}T12:00:00`),
                    observacoes: `Chuva ${item.desc} • ${item.mm} mm (Importado via OpenWeather API / Radar)`,
                    atualizadoEm: new Date(),
                    fonte: 'OpenWeather'
                });
            });

            await batch.commit();
            window.alert(`✅ ${toImport.length} registros de chuva importados com sucesso!`);
        } catch (err) {
            console.error("Erro ao importar em lote:", err);
            window.alert("Erro ao salvar dados no Firestore.");
        } finally {
            setImportingAll(false);
        }
    };

    // Estatística do período
    const totalAccumulatedMm = useMemo(() => {
        return rainHistory.reduce((acc, curr) => acc + (curr.mm || 0), 0);
    }, [rainHistory]);

    const rainyDaysCount = useMemo(() => {
        return rainHistory.filter(i => i.mm > 0).length;
    }, [rainHistory]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm animate-fadeIn">
            <div className="modal-wide-container w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4.5 bg-gradient-to-r from-sky-700 via-blue-700 to-indigo-800 text-white flex items-center justify-between shrink-0 shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-sky-200">
                            <Radio size={20} className="animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                                Medição de Chuvas • OpenWeather
                            </h2>
                            <p className="text-xs text-sky-200">Precipitações de hoje e dias anteriores por radar meteorológico</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-sky-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                        <X size={22} />
                    </button>
                </div>

                <div className="modal-body p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
                    
                    {/* Barra de Localização e Filtro de Dias */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                <MapPin size={16} className="text-sky-600 shrink-0" />
                                <span className="font-bold text-slate-900">{location.name}</span>
                                <span className="text-slate-400 text-[11px]">({location.lat.toFixed(2)}, {location.lon.toFixed(2)})</span>
                            </div>

                            {/* Seletor de Período (3, 7, 14, 30 dias) */}
                            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                                {[3, 7, 14, 30].map((d) => (
                                    <button
                                        key={d}
                                        onClick={() => {
                                            setPastDays(d);
                                            handleRefresh(location.lat, location.lon, d, customApiKey);
                                        }}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                            pastDays === d
                                                ? 'bg-sky-600 text-white shadow-sm'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        {d} dias
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Busca de Município / Coordenadas */}
                        <div className="flex items-center gap-2">
                            <form onSubmit={handleSearchCity} className="flex-1 relative">
                                <input
                                    type="text"
                                    placeholder="Buscar município ou fazenda (ex: Sorriso, MT)..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                                />
                                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                            </form>

                            <button
                                onClick={handleSearchCity}
                                disabled={searchingCity}
                                className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                            >
                                {searchingCity ? 'Buscando...' : 'Buscar'}
                            </button>

                            <button
                                onClick={() => handleRefresh()}
                                disabled={loading}
                                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                                title="Atualizar dados"
                            >
                                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        {/* Resultados da busca de município */}
                        {searchResults.length > 0 && (
                            <div className="bg-white rounded-xl border border-slate-200 p-2 space-y-1 shadow-sm max-h-36 overflow-y-auto">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Selecione o local:</span>
                                {searchResults.map((r, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSelectCity(r)}
                                        className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-sky-50 text-xs font-medium text-slate-700 flex items-center justify-between cursor-pointer"
                                    >
                                        <span className="truncate">{r.displayName}</span>
                                        <span className="text-[10px] text-sky-600 font-bold ml-2">Selecionar</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Resumo de Precipitação do Período */}
                    <div className="sync-stats-grid grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-sky-500/10 to-blue-500/10 border border-sky-500/20">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800">Acumulado ({pastDays}d)</span>
                            <div className="text-xl sm:text-2xl font-black text-sky-600 mt-0.5">
                                {totalAccumulatedMm.toFixed(1)} <span className="text-xs font-semibold text-slate-500">mm</span>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dias com Chuva</span>
                            <div className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5">
                                {rainyDaysCount} <span className="text-xs font-semibold text-slate-500">de {rainHistory.length}</span>
                            </div>
                        </div>

                        <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                            <button
                                onClick={handleImportAllRainyDays}
                                disabled={importingAll || loading || rainyDaysCount === 0}
                                className="w-full h-full min-h-[42px] px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                            >
                                {importingAll ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Importando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Download size={14} />
                                        <span>Importar Todos com Chuva</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Lista Diária de Medições de Chuva */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between px-1">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Histórico Diário de Precipitação
                            </h4>
                            <span className="text-[11px] text-slate-400">
                                Fonte: OpenWeather & Radar ECMWF
                            </span>
                        </div>

                        {loading ? (
                            <div className="py-12 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-200">
                                <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mb-2" />
                                <span className="text-xs font-semibold text-slate-500">Consultando estações meteorológicas...</span>
                            </div>
                        ) : rainHistory.length === 0 ? (
                            <div className="py-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs">
                                Nenhum registro climático encontrado para este local.
                            </div>
                        ) : (
                            <div className="rain-day-list space-y-2 max-h-72 overflow-y-auto pr-1">
                                {rainHistory.map((item) => {
                                    const isSaved = existingDatesSet.has(item.date);
                                    const isImporting = importingId === item.date;

                                    return (
                                        <div
                                            key={item.date}
                                            className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                                item.mm > 0
                                                    ? 'bg-sky-50/60 border-sky-200'
                                                    : 'bg-white border-slate-200'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${
                                                    item.mm > 0 ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {item.icon || (item.mm > 0 ? '🌧️' : '☀️')}
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-900">
                                                            {item.displayDate}
                                                        </span>
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                                            item.isToday
                                                                ? 'bg-sky-600 text-white'
                                                                : 'bg-slate-200 text-slate-700'
                                                        }`}>
                                                            {item.weekday}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                                        <span>{item.desc}</span>
                                                        {item.tempMax > 0 && (
                                                            <span>• {item.tempMin}° / {item.tempMax}°C</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <div className={`text-base font-black ${
                                                        item.mm > 0 ? 'text-sky-600' : 'text-slate-400'
                                                    }`}>
                                                        {item.mm.toFixed(1)} mm
                                                    </div>
                                                </div>

                                                {isSaved ? (
                                                    <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                                                        <CheckCircle2 size={13} />
                                                        <span className="hidden sm:inline">No Pluviômetro</span>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleImportDay(item)}
                                                        disabled={isImporting}
                                                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-sky-700 border border-sky-300 text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                        title="Adicionar ao meu Pluviômetro"
                                                    >
                                                        {isImporting ? (
                                                            <div className="w-3 h-3 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <>
                                                                <PlusCircle size={13} />
                                                                <span>Importar</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Chave Personalizada da OpenWeather (Opcional) */}
                    <div className="pt-2 border-t border-slate-100">
                        <button
                            onClick={() => setShowKeyInput(!showKeyInput)}
                            className="text-[11px] font-semibold text-slate-500 hover:text-sky-700 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                            <Info size={13} />
                            <span>{showKeyInput ? 'Ocultar chave personalizada OpenWeather' : 'Configurar Chave OpenWeather personalizada (Opcional)'}</span>
                        </button>

                        {showKeyInput && (
                            <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                <label className="block text-[11px] font-bold text-slate-700">
                                    Chave API OpenWeather (API Key):
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="password"
                                        placeholder="Ex: 8a7b9c..."
                                        value={customApiKey}
                                        onChange={(e) => setCustomApiKey(e.target.value)}
                                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-sky-500"
                                    />
                                    <button
                                        onClick={() => handleRefresh(location.lat, location.lon, pastDays, customApiKey)}
                                        className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all cursor-pointer"
                                    >
                                        Aplicar
                                    </button>
                                </div>
                                <span className="text-[10px] text-slate-400 block">
                                    Se não informada, o sistema utiliza o radar meteorológico global de alta precisão automaticamente.
                                </span>
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                        Fechar
                    </button>
                </div>

            </div>
        </div>
    );
}
