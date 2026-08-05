import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ArrowLeft,
    PlusCircle,
    MinusCircle,
    Fuel,
    ArrowDown,
    ArrowUp,
    Search,
    ShoppingCart,
    Gauge,
    User,
    Pencil,
    Trash2,
    X
} from 'lucide-react-native';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    writeBatch
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { usePropertyAuth } from '../context/PropertyContext';

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

const formatDate = (dateVal) => {
    if (!dateVal) return '--/--/----';
    const date = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
    if (isNaN(date.getTime())) return '--/--/----';
    return date.toLocaleDateString('pt-BR');
};

export default function DieselScreen({ navigation }) {
    const { effectiveUid, isAdmin, isMember } = usePropertyAuth();
    const [registros, setRegistros] = useState([]);
    const [maquinas, setMaquinas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('todos'); // 'todos' | 'entradas' | 'saidas'
    const [searchQuery, setSearchQuery] = useState('');

    const [modalEntrada, setModalEntrada] = useState({ visible: false, itemId: null });
    const [modalSaida, setModalSaida] = useState({ visible: false, itemId: null });

    // Fetch Registros de Diesel (Real-time)
    useEffect(() => {
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        const q = query(collection(db, 'users', uid, 'diesel'), orderBy('data', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setRegistros(list);
            setLoading(false);
        }, (error) => {
            console.error("Erro ao carregar registros de diesel:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [effectiveUid]);

    // Fetch Máquinas / Inventário
    useEffect(() => {
        const fetchMaquinas = async () => {
            const uid = effectiveUid || auth.currentUser?.uid;
            if (!uid) return;
            try {
                const snap = await getDocs(collection(db, 'users', uid, 'inventario'));
                setMaquinas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error("Erro ao buscar inventário:", err);
            }
        };
        fetchMaquinas();
    }, [effectiveUid]);

    // Métricas de Estoque e Consumo
    const stats = useMemo(() => {
        let totalEntradas = 0;
        let totalSaidas = 0;
        let custoTotalEntradas = 0;

        registros.forEach(r => {
            const qtd = parseMoeda(r.quantidadeLitros || r.litros || 0);
            if (r.tipo === 'entrada' || r.tipo === 'Entrada') {
                totalEntradas += qtd;
                custoTotalEntradas += parseMoeda(r.valorTotal || 0);
            } else {
                totalSaidas += qtd;
            }
        });

        const saldoAtual = totalEntradas - totalSaidas;
        return {
            saldoAtual: saldoAtual > 0 ? saldoAtual : 0,
            totalEntradas,
            totalSaidas,
            custoTotalEntradas
        };
    }, [registros]);

    // Filtragem de Lista
    const filteredRegistros = useMemo(() => {
        return registros.filter(item => {
            const matchTab = 
                activeTab === 'todos' ? true :
                activeTab === 'entradas' ? (item.tipo === 'entrada' || item.tipo === 'Entrada') :
                (item.tipo === 'saida' || item.tipo === 'Saida' || item.tipo === 'abastecimento');
            
            const q = searchQuery.toLowerCase();
            const matchSearch = 
                !searchQuery ||
                item.maquina?.toLowerCase().includes(q) ||
                item.fornecedor?.toLowerCase().includes(q) ||
                item.operador?.toLowerCase().includes(q) ||
                item.observacoes?.toLowerCase().includes(q);

            return matchTab && matchSearch;
        });
    }, [registros, activeTab, searchQuery]);

    const handleDelete = async (id) => {
        if (!isAdmin) return;
        if (!window.confirm("Deseja realmente excluir este registro de diesel?")) return;
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;
        try {
            await deleteDoc(doc(db, 'users', uid, 'diesel', id));
        } catch (error) {
            console.error("Erro ao deletar:", error);
            window.alert("Erro ao excluir registro.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col px-4 py-6 sm:px-6 sm:py-8">
                
                {/* Header Navigation */}
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
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Controle de Diesel</h1>
                            <p className="text-xs text-slate-500">Gestão de abastecimento, estoque e consumo</p>
                        </div>
                    </div>

                    {isAdmin ? (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setModalEntrada({ visible: true, itemId: null })}
                                className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-950/10"
                            >
                                <PlusCircle size={18} />
                                <span>Entrada (Compra)</span>
                            </button>
                            <button
                                onClick={() => setModalSaida({ visible: true, itemId: null })}
                                className="px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-950/10"
                            >
                                <MinusCircle size={18} />
                                <span>Abastecer</span>
                            </button>
                        </div>
                    ) : (
                        <div className="px-3 py-1.5 bg-slate-200/80 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-300">
                            <span>👤 Visualização</span>
                        </div>
                    )}
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-lg shadow-emerald-950/10">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">Estoque Atual Estimado</span>
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                <Fuel size={16} />
                            </div>
                        </div>
                        <div className="text-3xl font-black tracking-tight">{formatMoeda(stats.saldoAtual)} <span className="text-sm font-semibold text-emerald-200">L</span></div>
                        <div className="text-xs text-emerald-100 mt-1">Saldo calculado em tempo real</div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Recebido (Entradas)</span>
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <ArrowDown size={16} />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{formatMoeda(stats.totalEntradas)} <span className="text-sm font-semibold text-slate-500">L</span></div>
                        <div className="text-xs text-slate-500 mt-1">Total investido: R$ {formatMoeda(stats.custoTotalEntradas)}</div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Consumido (Saídas)</span>
                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                <ArrowUp size={16} />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{formatMoeda(stats.totalSaidas)} <span className="text-sm font-semibold text-slate-500">L</span></div>
                        <div className="text-xs text-slate-500 mt-1">Em máquinas e veículos da frota</div>
                    </div>
                </div>

                {/* Filters & Tabs */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
                    <div className="flex rounded-xl bg-slate-200/80 p-1 w-full sm:w-auto">
                        <button
                            onClick={() => setActiveTab('todos')}
                            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                activeTab === 'todos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Todos ({registros.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('entradas')}
                            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                activeTab === 'entradas' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Entradas
                        </button>
                        <button
                            onClick={() => setActiveTab('saidas')}
                            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                activeTab === 'saidas' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Abastecimentos
                        </button>
                    </div>

                    <div className="relative w-full sm:w-72">
                        <input
                            type="text"
                            placeholder="Buscar máquina, fornecedor..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                        />
                        <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                    </div>
                </div>

                {/* List of Records */}
                <div className="flex-1">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
                            <span className="text-xs font-semibold text-slate-500">Carregando movimentações de diesel...</span>
                        </div>
                    ) : filteredRegistros.length === 0 ? (
                        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                                <Fuel size={24} />
                            </div>
                            <h3 className="text-base font-bold text-slate-700">Nenhum registro encontrado</h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                Clique nos botões acima para registrar uma compra de diesel ou um abastecimento de máquina.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {filteredRegistros.map((item) => {
                                const isEntrada = item.tipo === 'entrada' || item.tipo === 'Entrada';
                                const qtd = parseMoeda(item.quantidadeLitros || item.litros || 0);

                                return (
                                    <div
                                        key={item.id}
                                        className="bg-white rounded-2xl border border-slate-200/80 p-4.5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-3 mb-2">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                                                        isEntrada ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                        {isEntrada ? <ShoppingCart size={18} /> : <Gauge size={18} />}
                                                    </div>
                                                    <div>
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                            isEntrada ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            {isEntrada ? 'Entrada (Compra)' : 'Abastecimento'}
                                                        </span>
                                                        <h4 className="text-sm font-bold text-slate-800 mt-0.5">
                                                            {isEntrada ? (item.fornecedor || 'Fornecedor não especificado') : (item.maquina || 'Máquina não especificada')}
                                                        </h4>
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <span className={`text-base font-black ${isEntrada ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                        {isEntrada ? '+' : '-'}{formatMoeda(qtd)} L
                                                    </span>
                                                    <div className="text-[11px] text-slate-400 font-medium">
                                                        {formatDate(item.data)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Details Badges */}
                                            <div className="flex flex-wrap gap-2 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                                                {item.operador && (
                                                    <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg">
                                                        <User size={13} className="text-slate-500" />
                                                        <span>{item.operador}</span>
                                                    </div>
                                                )}
                                                {item.horimetroKm && (
                                                    <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg">
                                                        <Gauge size={13} className="text-slate-500" />
                                                        <span>{item.horimetroKm} Horas/Km</span>
                                                    </div>
                                                )}
                                                {item.valorTotal && (
                                                    <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-1 rounded-lg font-semibold">
                                                        <span>R$ {formatMoeda(item.valorTotal)}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {item.observacoes && (
                                                <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded-lg italic">
                                                    "{item.observacoes}"
                                                </p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                                            {isAdmin ? (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            if (isEntrada) {
                                                                setModalEntrada({ visible: true, itemId: item.id });
                                                            } else {
                                                                setModalSaida({ visible: true, itemId: item.id });
                                                            }
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                                                        title="Editar"
                                                    >
                                                        <Pencil size={16} />
                                                        <span>Editar</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 size={16} />
                                                        <span>Excluir</span>
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 font-semibold">
                                                    Somente Leitura
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Modais de Entrada e Saída (Apenas Admin) */}
                {modalEntrada.visible && isAdmin && (
                    <ModalEntradaDiesel
                        itemId={modalEntrada.itemId}
                        effectiveUid={effectiveUid}
                        onClose={() => setModalEntrada({ visible: false, itemId: null })}
                    />
                )}

                {modalSaida.visible && isAdmin && (
                    <ModalSaidaDiesel
                        itemId={modalSaida.itemId}
                        maquinas={maquinas}
                        effectiveUid={effectiveUid}
                        onClose={() => setModalSaida({ visible: false, itemId: null })}
                    />
                )}

            </div>
        </div>
    );
}

// Modal de Registro de Entrada (Compra de Diesel)
function ModalEntradaDiesel({ itemId, effectiveUid, onClose }) {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [fornecedor, setFornecedor] = useState('');
    const [litros, setLitros] = useState('');
    const [valorTotal, setValorTotal] = useState('');
    const [data, setData] = useState(new Date().toISOString().split('T')[0]);
    const [observacoes, setObservacoes] = useState('');

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            const uid = effectiveUid || auth.currentUser?.uid;
            if (!uid) return;
            try {
                const snap = await getDoc(doc(db, 'users', uid, 'diesel', itemId));
                if (snap.exists()) {
                    const d = snap.data();
                    setFornecedor(d.fornecedor || '');
                    setLitros(String(d.quantidadeLitros || d.litros || ''));
                    setValorTotal(String(d.valorTotal || ''));
                    setData(d.data?.toDate ? d.data.toDate().toISOString().split('T')[0] : (d.data || new Date().toISOString().split('T')[0]));
                    setObservacoes(d.observacoes || '');
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        })();
    }, [itemId, effectiveUid]);

    const handleSave = async (e) => {
        e.preventDefault();
        const qtd = parseMoeda(litros);
        if (qtd <= 0) {
            window.alert("Informe uma quantidade válida de litros.");
            return;
        }

        setSaving(true);
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        try {
            const docId = itemId || doc(collection(db, 'users', uid, 'diesel')).id;
            await setDoc(doc(db, 'users', uid, 'diesel', docId), {
                id: docId,
                tipo: 'entrada',
                fornecedor: fornecedor.trim(),
                quantidadeLitros: qtd,
                valorTotal: parseMoeda(valorTotal),
                data: new Date(`${data}T12:00:00`),
                observacoes: observacoes.trim(),
                criadoEm: new Date()
            }, { merge: true });

            onClose();
        } catch (error) {
            console.error("Erro ao salvar:", error);
            window.alert("Erro ao salvar entrada de diesel.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal">
                <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShoppingCart size={18} />
                        <span className="font-bold text-base">{itemId ? 'Editar Entrada de Diesel' : 'Nova Entrada de Diesel'}</span>
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
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Fornecedor / Distribuidora *
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="Ex: Petrobras / Ipiranga"
                                value={fornecedor}
                                onChange={(e) => setFornecedor(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Quantidade (Litros) *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: 5000"
                                    value={litros}
                                    onChange={(e) => setLitros(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Valor Total (R$)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 28500,00"
                                    value={valorTotal}
                                    onChange={(e) => setValorTotal(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Data da Compra / Chegada *
                            </label>
                            <input
                                type="date"
                                required
                                value={data}
                                onChange={(e) => setData(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Observações
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Nota fiscal, tanque de destino..."
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white resize-none"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-emerald-950/10 disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : 'Salvar Entrada'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// Modal de Registro de Saída (Abastecimento de Máquinas)
function ModalSaidaDiesel({ itemId, maquinas, effectiveUid, onClose }) {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [maquina, setMaquina] = useState('');
    const [litros, setLitros] = useState('');
    const [horimetroKm, setHorimetroKm] = useState('');
    const [operador, setOperador] = useState('');
    const [data, setData] = useState(new Date().toISOString().split('T')[0]);
    const [observacoes, setObservacoes] = useState('');

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            const uid = effectiveUid || auth.currentUser?.uid;
            if (!uid) return;
            try {
                const snap = await getDoc(doc(db, 'users', uid, 'diesel', itemId));
                if (snap.exists()) {
                    const d = snap.data();
                    setMaquina(d.maquina || '');
                    setLitros(String(d.quantidadeLitros || d.litros || ''));
                    setHorimetroKm(String(d.horimetroKm || ''));
                    setOperador(d.operador || '');
                    setData(d.data?.toDate ? d.data.toDate().toISOString().split('T')[0] : (d.data || new Date().toISOString().split('T')[0]));
                    setObservacoes(d.observacoes || '');
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        })();
    }, [itemId, effectiveUid]);

    const handleSave = async (e) => {
        e.preventDefault();
        const qtd = parseMoeda(litros);
        if (qtd <= 0) {
            window.alert("Informe uma quantidade válida de litros.");
            return;
        }

        setSaving(true);
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        try {
            const docId = itemId || doc(collection(db, 'users', uid, 'diesel')).id;
            await setDoc(doc(db, 'users', uid, 'diesel', docId), {
                id: docId,
                tipo: 'saida',
                maquina: maquina.trim(),
                quantidadeLitros: qtd,
                horimetroKm: horimetroKm.trim(),
                operador: operador.trim(),
                data: new Date(`${data}T12:00:00`),
                observacoes: observacoes.trim(),
                criadoEm: new Date()
            }, { merge: true });

            onClose();
        } catch (error) {
            console.error("Erro ao salvar:", error);
            window.alert("Erro ao registrar abastecimento.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal">
                <div className="px-6 py-4 bg-amber-600 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Gauge size={18} />
                        <span className="font-bold text-base">{itemId ? 'Editar Abastecimento' : 'Novo Abastecimento'}</span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg text-amber-200 hover:text-white transition-colors cursor-pointer">
                        <X size={22} />
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Máquina / Veículo *
                            </label>
                            {maquinas.length > 0 ? (
                                <select
                                    required
                                    value={maquina}
                                    onChange={(e) => setMaquina(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white"
                                >
                                    <option value="">Selecione a máquina da frota</option>
                                    {maquinas.map((m) => (
                                        <option key={m.id} value={`${m.marca || ''} ${m.modelo || ''} (${m.tipo || 'Máquina'})`}>
                                            {m.marca} {m.modelo} - {m.tipo}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Trator John Deere 6110J"
                                    value={maquina}
                                    onChange={(e) => setMaquina(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white"
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Litros Abastecidos *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: 220"
                                    value={litros}
                                    onChange={(e) => setLitros(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Horímetro / KM
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 1450.5"
                                    value={horimetroKm}
                                    onChange={(e) => setHorimetroKm(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Operador / Motorista
                                </label>
                                <input
                                    type="text"
                                    placeholder="Nome do operador"
                                    value={operador}
                                    onChange={(e) => setOperador(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Data *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={data}
                                    onChange={(e) => setData(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Observações
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Finalidade, atividade realizada..."
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white resize-none"
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
                                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : 'Salvar Abastecimento'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
