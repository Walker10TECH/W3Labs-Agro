import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ArrowLeft,
    PlusCircle,
    Droplets,
    CheckCircle2,
    FlaskConical,
    Search,
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

const parseMoeda = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleanStr = String(val).replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
};

const formatNumero = (val, decimals = 2) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const formatDate = (dateVal) => {
    if (!dateVal) return '--/--/----';
    const date = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
    if (isNaN(date.getTime())) return '--/--/----';
    return date.toLocaleDateString('pt-BR');
};

export default function PulverizacaoListaScreen({ navigation }) {
    const [pulverizacoes, setPulverizacoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [modal, setModal] = useState({ visible: false, itemId: null });

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const q = query(collection(db, 'users', uid, 'pulverizacoes'), orderBy('dataAplicacao', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPulverizacoes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error(err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Estatísticas Rápidas
    const stats = useMemo(() => {
        let areaTotal = 0;
        let qtdTotalDefensivos = 0;

        pulverizacoes.forEach(p => {
            areaTotal += parseMoeda(p.areaTalhao || 0);
            qtdTotalDefensivos += parseMoeda(p.quantidadeUtilizada || 0);
        });

        return {
            totalAplicacoes: pulverizacoes.length,
            areaTotal,
            qtdTotalDefensivos
        };
    }, [pulverizacoes]);

    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return pulverizacoes.filter(p => 
            !searchQuery ||
            p.talhao?.toLowerCase().includes(q) ||
            p.produto?.toLowerCase().includes(q) ||
            p.cultura?.toLowerCase().includes(q) ||
            p.tipoAplicacao?.toLowerCase().includes(q) ||
            p.operador?.toLowerCase().includes(q)
        );
    }, [pulverizacoes, searchQuery]);

    const handleDelete = async (id, item) => {
        if (!window.confirm("Deseja realmente excluir este registro de pulverização?")) return;
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        try {
            const batch = writeBatch(db);
            // Estorna quantidade de defensivo no estoque caso vinculado
            if (item.estoqueItemId && item.quantidadeUtilizada > 0) {
                const stockRef = doc(db, 'users', uid, 'estoqueGeral', item.estoqueItemId);
                const stockDoc = await getDoc(stockRef);
                if (stockDoc.exists()) {
                    const currentQtd = stockDoc.data().quantidade || 0;
                    batch.update(stockRef, { quantidade: currentQtd + item.quantidadeUtilizada });
                }
            }

            batch.delete(doc(db, 'users', uid, 'pulverizacoes', id));
            await batch.commit();
        } catch (err) {
            console.error(err);
            window.alert("Erro ao excluir pulverização.");
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
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Pulverização & Defensivos</h1>
                            <p className="text-xs text-slate-500">Controle de calda, defensivos aplicados e meteorologia</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setModal({ visible: true, itemId: null })}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-950/10"
                    >
                        <PlusCircle size={18} />
                        <span>Nova Aplicação</span>
                    </button>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-800 text-white shadow-lg shadow-emerald-950/10">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">Área Total Aplicada</span>
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                <Droplets size={16} />
                            </div>
                        </div>
                        <div className="text-3xl font-black tracking-tight">{formatNumero(stats.areaTotal)} <span className="text-sm font-semibold text-emerald-200">ha</span></div>
                        <div className="text-xs text-emerald-100 mt-1">Soma de cobertura de defensivos</div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Aplicações Realizadas</span>
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <CheckCircle2 size={18} />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{stats.totalAplicacoes}</div>
                        <div className="text-xs text-slate-500 mt-1">Registros no histórico</div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total de Insumos</span>
                            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                                <FlaskConical size={16} />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{formatNumero(stats.qtdTotalDefensivos)} <span className="text-sm font-semibold text-slate-500">L / Kg</span></div>
                        <div className="text-xs text-slate-500 mt-1">Volume total dosado</div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="mb-6">
                    <div className="relative w-full sm:w-80">
                        <input
                            type="text"
                            placeholder="Buscar produto, talhão, tipo, operador..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-sm"
                        />
                        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                </div>

                {/* List of Applications */}
                <div className="flex-1">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
                            <span className="text-xs font-semibold text-slate-500">Carregando pulverizações...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                                <Droplets size={24} />
                            </div>
                            <h3 className="text-base font-bold text-slate-700">Nenhuma pulverização registrada</h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                Clique no botão "Nova Aplicação" para registrar defensivos aplicados em campo.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filtered.map((item) => {
                                const area = parseMoeda(item.areaTalhao || 0);
                                const dose = parseMoeda(item.dose || 0);
                                const qtd = parseMoeda(item.quantidadeUtilizada || 0);

                                return (
                                    <div
                                        key={item.id}
                                        className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2 mb-3">
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                                        {item.tipoAplicacao || 'Defensivo'}
                                                    </span>
                                                    <h3 className="text-base font-bold text-slate-800 mt-1">
                                                        {item.produto || 'Produto'}
                                                    </h3>
                                                    <div className="text-xs text-slate-500 font-medium">
                                                        {item.talhao} ({item.cultura})
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <span className="text-sm font-black text-emerald-700">
                                                        {formatNumero(qtd)} {item.unidadeDose?.split('/')[0] || 'L'}
                                                    </span>
                                                    <div className="text-[11px] text-slate-400">
                                                        {formatDate(item.dataAplicacao)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Technical Details */}
                                            <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mb-3">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Área Aplicada:</span>
                                                    <span className="font-semibold">{formatNumero(area)} ha</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Dose Recomendada:</span>
                                                    <span className="font-semibold">{formatNumero(dose)} {item.unidadeDose || 'L/ha'}</span>
                                                </div>
                                                {item.operador && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Operador:</span>
                                                        <span className="font-semibold">{item.operador}</span>
                                                    </div>
                                                )}
                                                {/* Climate data badge */}
                                                {(item.temperatura || item.umidade || item.velocidadeVento) && (
                                                    <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
                                                        {item.temperatura && <span>🌡️ {item.temperatura}°C</span>}
                                                        {item.umidade && <span>💧 {item.umidade}%</span>}
                                                        {item.velocidadeVento && <span>💨 {item.velocidadeVento} km/h</span>}
                                                    </div>
                                                )}
                                            </div>

                                            {item.observacoes && (
                                                <p className="text-xs text-slate-500 italic line-clamp-2">
                                                    "{item.observacoes}"
                                                </p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                                            <button
                                                onClick={() => setModal({ visible: true, itemId: item.id })}
                                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                                            >
                                                <Pencil size={16} />
                                                <span>Editar</span>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id, item)}
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

                {/* Modal Pulverização */}
                {modal.visible && (
                    <ModalAddOrEditPulverizacao
                        itemId={modal.itemId}
                        onClose={() => setModal({ visible: false, itemId: null })}
                    />
                )}

            </div>
        </div>
    );
}

// Modal de Pulverização
function ModalAddOrEditPulverizacao({ itemId, onClose }) {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [talhoesList, setTalhoesList] = useState([]);
    const [estoqueDefensivos, setEstoqueDefensivos] = useState([]);
    const [maquinasList, setMaquinasList] = useState([]);
    const [originalItem, setOriginalItem] = useState(null);

    const [status, setStatus] = useState('Realizado');
    const [tipoAplicacao, setTipoAplicacao] = useState('Herbicida');
    const [cultura, setCultura] = useState('Soja');
    const [talhao, setTalhao] = useState('');
    const [areaTalhao, setAreaTalhao] = useState('');
    const [estoqueItemId, setEstoqueItemId] = useState('');
    const [produto, setProduto] = useState('');
    const [dose, setDose] = useState('');
    const [unidadeDose, setUnidadeDose] = useState('L/ha');
    const [quantidadeUtilizada, setQuantidadeUtilizada] = useState('');
    const [equipamentoId, setEquipamentoId] = useState('');
    const [operador, setOperador] = useState('');
    const [temperatura, setTemperatura] = useState('');
    const [umidade, setUmidade] = useState('');
    const [velocidadeVento, setVelocidadeVento] = useState('');
    const [dataAplicacao, setDataAplicacao] = useState(new Date().toISOString().split('T')[0]);
    const [observacoes, setObservacoes] = useState('');

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        (async () => {
            try {
                const talhoesSnap = await getDocs(collection(db, 'users', uid, 'talhoes'));
                setTalhoesList(talhoesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

                const estoqueSnap = await getDocs(collection(db, 'users', uid, 'estoqueGeral'));
                const defs = estoqueSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .filter(i => i.tipo === 'Defensivo' || i.tipo === 'Fertilizante' || i.tipo === 'Insumo');
                setEstoqueDefensivos(defs);

                const maquinasSnap = await getDocs(collection(db, 'users', uid, 'inventario'));
                setMaquinasList(maquinasSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) {
                console.error(e);
            }
        })();

        if (itemId) {
            (async () => {
                try {
                    const snap = await getDoc(doc(db, 'users', uid, 'pulverizacoes', itemId));
                    if (snap.exists()) {
                        const d = snap.data();
                        setOriginalItem(d);
                        setStatus(d.status || 'Realizado');
                        setTipoAplicacao(d.tipoAplicacao || 'Herbicida');
                        setCultura(d.cultura || 'Soja');
                        setTalhao(d.talhao || '');
                        setAreaTalhao(String(d.areaTalhao || ''));
                        setEstoqueItemId(d.estoqueItemId || '');
                        setProduto(d.produto || '');
                        setDose(String(d.dose || ''));
                        setUnidadeDose(d.unidadeDose || 'L/ha');
                        setQuantidadeUtilizada(String(d.quantidadeUtilizada || ''));
                        setEquipamentoId(d.equipamentoId || '');
                        setOperador(d.operador || '');
                        setTemperatura(String(d.temperatura || ''));
                        setUmidade(String(d.umidade || ''));
                        setVelocidadeVento(String(d.velocidadeVento || ''));
                        setDataAplicacao(d.dataAplicacao?.toDate ? d.dataAplicacao.toDate().toISOString().split('T')[0] : (d.dataAplicacao || new Date().toISOString().split('T')[0]));
                        setObservacoes(d.observacoes || '');
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoading(false);
                }
            })();
        }
    }, [itemId]);

    // Recalcula quantidade total automaticamente quando área ou dose mudam
    useEffect(() => {
        const a = parseMoeda(areaTalhao);
        const d = parseMoeda(dose);
        if (a > 0 && d > 0) {
            setQuantidadeUtilizada((a * d).toFixed(2));
        }
    }, [areaTalhao, dose]);

    const handleSelectProduto = (stockId) => {
        setEstoqueItemId(stockId);
        const item = estoqueDefensivos.find(e => e.id === stockId);
        if (item) {
            setProduto(item.nome);
            if (item.unidade) {
                setUnidadeDose(`${item.unidade}/ha`);
            }
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const areaNum = parseMoeda(areaTalhao);
        const qtdNum = parseMoeda(quantidadeUtilizada);

        if (!produto.trim() || !talhao.trim() || areaNum <= 0 || qtdNum <= 0) {
            window.alert("Por favor, preencha o produto, talhão, área e quantidade utilizada.");
            return;
        }

        setSaving(true);
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        try {
            const batch = writeBatch(db);

            // Sincronização atômica de estoque
            const originalQtd = originalItem ? parseMoeda(originalItem.quantidadeUtilizada) : 0;
            const originalStockId = originalItem?.estoqueItemId;

            if (originalStockId && originalStockId !== estoqueItemId && originalQtd > 0) {
                const prevStockRef = doc(db, 'users', uid, 'estoqueGeral', originalStockId);
                const prevSnap = await getDoc(prevStockRef);
                if (prevSnap.exists()) {
                    batch.update(prevStockRef, { quantidade: (prevSnap.data().quantidade || 0) + originalQtd });
                }
            }

            if (estoqueItemId && qtdNum > 0) {
                const stockRef = doc(db, 'users', uid, 'estoqueGeral', estoqueItemId);
                const stockSnap = await getDoc(stockRef);
                if (stockSnap.exists()) {
                    const currentStock = stockSnap.data().quantidade || 0;
                    const deduction = originalStockId === estoqueItemId ? (qtdNum - originalQtd) : qtdNum;
                    batch.update(stockRef, { quantidade: Math.max(0, currentStock - deduction) });
                }
            }

            const docId = itemId || doc(collection(db, 'users', uid, 'pulverizacoes')).id;
            const docRef = doc(db, 'users', uid, 'pulverizacoes', docId);

            batch.set(docRef, {
                id: docId,
                status,
                tipoAplicacao,
                cultura,
                talhao: talhao.trim(),
                areaTalhao: areaNum,
                estoqueItemId,
                produto: produto.trim(),
                dose: parseMoeda(dose),
                unidadeDose,
                quantidadeUtilizada: qtdNum,
                equipamentoId,
                operador: operador.trim(),
                temperatura: parseMoeda(temperatura),
                umidade: parseMoeda(umidade),
                velocidadeVento: parseMoeda(velocidadeVento),
                dataAplicacao: new Date(`${dataAplicacao}T12:00:00`),
                observacoes: observacoes.trim(),
                atualizadoEm: new Date()
            }, { merge: true });

            await batch.commit();
            onClose();
        } catch (err) {
            console.error(err);
            window.alert("Erro ao salvar pulverização.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal">
                <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Droplets size={18} />
                        <span className="font-bold text-base">{itemId ? 'Editar Aplicação' : 'Nova Pulverização'}</span>
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
                                    Tipo de Aplicação *
                                </label>
                                <select
                                    value={tipoAplicacao}
                                    onChange={(e) => setTipoAplicacao(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="Herbicida">Herbicida (Dessecação / Pós)</option>
                                    <option value="Inseticida">Inseticida (Lagartas / Percevejos)</option>
                                    <option value="Fungicida">Fungicida (Ferrugem / Manchas)</option>
                                    <option value="Fertilizante Foliar">Fertilizante Foliar / Nutrição</option>
                                    <option value="Biológico">Biológico / Inóculo</option>
                                    <option value="Adjuvante">Adjuvante / Óleo</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Cultura *
                                </label>
                                <select
                                    value={cultura}
                                    onChange={(e) => setCultura(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="Soja">Soja</option>
                                    <option value="Milho">Milho</option>
                                    <option value="Trigo">Trigo</option>
                                    <option value="Algodão">Algodão</option>
                                    <option value="Café">Café</option>
                                    <option value="Outro">Outro</option>
                                </select>
                            </div>
                        </div>

                        {/* Defensivo Seleção */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Produto / Defensivo *
                            </label>
                            {estoqueDefensivos.length > 0 ? (
                                <select
                                    value={estoqueItemId}
                                    onChange={(e) => handleSelectProduto(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 mb-2"
                                >
                                    <option value="">Selecione do Estoque (Baixa Automática)</option>
                                    {estoqueDefensivos.map(d => (
                                        <option key={d.id} value={d.id}>
                                            {d.nome} (Saldo: {d.quantidade} {d.unidade || 'L'})
                                        </option>
                                    ))}
                                </select>
                            ) : null}
                            <input
                                type="text"
                                required
                                placeholder="Nome do produto (ex: Glifosato 480)"
                                value={produto}
                                onChange={(e) => setProduto(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Talhão / Área *
                                </label>
                                {talhoesList.length > 0 ? (
                                    <select
                                        required
                                        value={talhao}
                                        onChange={(e) => {
                                            setTalhao(e.target.value);
                                            const sel = talhoesList.find(t => t.nome === e.target.value);
                                            if (sel && sel.areaTotal) setAreaTalhao(String(sel.areaTotal));
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value="">Selecione o talhão</option>
                                        {talhoesList.map(t => (
                                            <option key={t.id} value={t.nome}>{t.nome} ({t.areaTotal} ha)</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Talhão 01"
                                        value={talhao}
                                        onChange={(e) => setTalhao(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Área do Talhão (ha) *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: 50"
                                    value={areaTalhao}
                                    onChange={(e) => setAreaTalhao(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Dose por Hectare *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: 2.5"
                                    value={dose}
                                    onChange={(e) => setDose(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Total Utilizado ({unidadeDose?.split('/')[0] || 'L'})
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: 125"
                                    value={quantidadeUtilizada}
                                    onChange={(e) => setQuantidadeUtilizada(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-emerald-700 font-bold focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Equipamento e Operador */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Pulverizador / Máquina
                                </label>
                                {maquinasList.length > 0 ? (
                                    <select
                                        value={equipamentoId}
                                        onChange={(e) => setEquipamentoId(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value="">Selecione o equipamento</option>
                                        {maquinasList.map(m => (
                                            <option key={m.id} value={m.id}>{m.marca} {m.modelo} ({m.tipo})</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="Ex: Uniport 3030"
                                        value={equipamentoId}
                                        onChange={(e) => setEquipamentoId(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Operador
                                </label>
                                <input
                                    type="text"
                                    placeholder="Nome do operador"
                                    value={operador}
                                    onChange={(e) => setOperador(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Clima no momento */}
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Condições Meteorológicas no Momento
                            </span>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[10px] text-slate-500">Temperatura (°C)</label>
                                    <input
                                        type="text"
                                        placeholder="24"
                                        value={temperatura}
                                        onChange={(e) => setTemperatura(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500">Umidade (%)</label>
                                    <input
                                        type="text"
                                        placeholder="65"
                                        value={umidade}
                                        onChange={(e) => setUmidade(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500">Vento (km/h)</label>
                                    <input
                                        type="text"
                                        placeholder="8"
                                        value={velocidadeVento}
                                        onChange={(e) => setVelocidadeVento(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Data da Aplicação *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={dataAplicacao}
                                    onChange={(e) => setDataAplicacao(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Status
                                </label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="Realizado">Realizado</option>
                                    <option value="Planejado">Planejado</option>
                                    <option value="Cancelado">Cancelado</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Observações Técnicas
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Bicos utilizados, volume de calda (L/ha), alvos biológicos..."
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
                                {saving ? 'Salvando...' : 'Salvar Aplicação'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
