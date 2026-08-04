import React, { useState, useEffect, useMemo } from 'react';
import {
    ArrowLeft,
    PlusCircle,
    ListTodo,
    CheckCheck,
    ChevronRight,
    CloudRain,
    X
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
import { Chart } from 'react-google-charts';
import { auth, db } from '../firebaseConfig';

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
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ visible: false, itemId: null });

    useEffect(() => {
        const uid = auth.currentUser?.uid;
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
    }, []);

    // Dados para o Gráfico de Barras do Google Charts
    const chartData = useMemo(() => {
        if (!items || items.length === 0) return null;
        const header = ["Atividade", "Progresso (%)", { role: "style" }];
        const rows = items.map(item => [item.titulo, parseFloat(item.valor) || 0, '#16a34a']);
        return [header, ...rows];
    }, [items]);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col px-4 py-6 sm:px-6 sm:py-8">
                
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigation?.goBack()}
                            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer shadow-sm"
                            title="Voltar"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Andamento da Safra</h1>
                            <p className="text-xs text-slate-500">Progresso percentual de cada fase e atividade</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setModal({ visible: true, itemId: null })}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-950/10"
                    >
                        <PlusCircle size={18} />
                        <span>Nova Atividade</span>
                    </button>
                </div>

                {/* Chart Card */}
                {chartData && (
                    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm mb-6">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                            Visão Geral do Progresso
                        </h3>
                        <div className="w-full overflow-hidden rounded-2xl">
                            <Chart
                                chartType="BarChart"
                                width="100%"
                                height="240px"
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
                                Toque no botão "Nova Atividade" para acompanhar o progresso das operações da fazenda.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {items.map((item) => {
                                const prog = Math.min(100, Math.max(0, parseFloat(item.valor) || 0));

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setModal({ visible: true, itemId: item.id })}
                                        className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer flex flex-col justify-between group"
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
                                                        <h3 className="text-base font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
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
                                            <div className="flex items-center gap-1 text-emerald-600 group-hover:translate-x-1 transition-transform">
                                                <span>Editar</span>
                                                <ChevronRight size={14} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Modal de Andamento */}
                {modal.visible && (
                    <ModalAddOrEditPorcentagem
                        itemId={modal.itemId}
                        onClose={() => setModal({ visible: false, itemId: null })}
                    />
                )}

            </div>
        </div>
    );
}

// Modal de Andamento
function ModalAddOrEditPorcentagem({ itemId, onClose }) {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [titulo, setTitulo] = useState('');
    const [valor, setValor] = useState('');
    const [descricao, setDescricao] = useState('');

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            const uid = auth.currentUser?.uid;
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
    }, [itemId]);

    const handleSave = async (e) => {
        e.preventDefault();
        const v = parseMoeda(valor);
        if (!titulo.trim() || isNaN(v) || v < 0 || v > 100) {
            window.alert("Informe um título e uma porcentagem válida de 0 a 100%.");
            return;
        }

        setSaving(true);
        const uid = auth.currentUser?.uid;
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
        const uid = auth.currentUser?.uid;
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
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal">
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
                    <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
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
    const [medicoes, setMedicoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ visible: false, itemId: null });

    useEffect(() => {
        const uid = auth.currentUser?.uid;
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
    }, []);

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
        if (!window.confirm("Deseja realmente excluir esta medição de chuva?")) return;
        const uid = auth.currentUser?.uid;
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
            <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col px-4 py-6 sm:px-6 sm:py-8">
                
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigation?.goBack()}
                            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer shadow-sm"
                            title="Voltar"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Controle Pluviométrico</h1>
                            <p className="text-xs text-slate-500">Registro diário de precipitações e histórico de chuvas</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setModal({ visible: true, itemId: null })}
                        className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-sky-950/10"
                    >
                        <PlusCircle size={18} />
                        <span>Nova Medição</span>
                    </button>
                </div>

                {/* Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-600 to-blue-800 text-white shadow-lg shadow-sky-950/10">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-sky-200">Total Acumulado</span>
                        <div className="text-2xl sm:text-3xl font-black tracking-tight mt-1">{formatNumero(stats.totalMm)} <span className="text-xs font-semibold text-sky-200">mm</span></div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Média / Evento</span>
                        <div className="text-2xl font-black text-slate-800 mt-1">{formatNumero(stats.mediaMm)} <span className="text-xs font-semibold text-slate-500">mm</span></div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Maior Chuva</span>
                        <div className="text-2xl font-black text-sky-600 mt-1">{formatNumero(stats.maxMm)} <span className="text-xs font-semibold text-slate-500">mm</span></div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Registros</span>
                        <div className="text-2xl font-black text-slate-800 mt-1">{stats.count} <span className="text-xs font-semibold text-slate-500">dias</span></div>
                    </div>
                </div>

                {/* Rain Area Chart */}
                {chartData && (
                    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm mb-6">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                            Histórico de Precipitação Acumulada
                        </h3>
                        <div className="w-full overflow-hidden rounded-2xl">
                            <Chart
                                chartType="AreaChart"
                                width="100%"
                                height="240px"
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
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                Toque no botão "Nova Medição" para anotar o volume de chuva coletado no pluviômetro.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                            {medicoes.map((item) => {
                                const mm = parseMoeda(item.milimetros || 0);

                                return (
                                    <div
                                        key={item.id}
                                        className="bg-white rounded-2xl border border-slate-200/80 p-4.5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
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
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Modal Pluviômetro */}
                {modal.visible && (
                    <ModalAddOrEditPluviometro
                        itemId={modal.itemId}
                        onClose={() => setModal({ visible: false, itemId: null })}
                    />
                )}

            </div>
        </div>
    );
}

// Modal de Pluviômetro
function ModalAddOrEditPluviometro({ itemId, onClose }) {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [milimetros, setMilimetros] = useState('');
    const [talhao, setTalhao] = useState('');
    const [dataMedicao, setDataMedicao] = useState(new Date().toISOString().split('T')[0]);
    const [observacoes, setObservacoes] = useState('');

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            const uid = auth.currentUser?.uid;
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
    }, [itemId]);

    const handleSave = async (e) => {
        e.preventDefault();
        const mm = parseMoeda(milimetros);
        if (isNaN(mm) || mm < 0) {
            window.alert("Informe um volume de chuva válido em mm.");
            return;
        }

        setSaving(true);
        const uid = auth.currentUser?.uid;
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
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal">
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
                    <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
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
