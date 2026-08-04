import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ArrowLeft,
    PlusCircle,
    Wrench,
    CheckCircle2,
    Clock,
    Search,
    Pencil,
    Trash2,
    X,
    Plus
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

export default function RevisoesScreen({ navigation }) {
    const [revisoes, setRevisoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('todas'); // 'todas' | 'Agendada' | 'Em andamento' | 'Concluída'
    const [searchQuery, setSearchQuery] = useState('');
    const [modal, setModal] = useState({ visible: false, itemId: null });

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const q = query(collection(db, 'users', uid, 'revisoes'), orderBy('dataRevisao', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRevisoes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error(err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Estatísticas Rápidas
    const stats = useMemo(() => {
        let custoTotal = 0;
        let concluidas = 0;
        let emAndamento = 0;

        revisoes.forEach(r => {
            custoTotal += parseMoeda(r.valorTotal || 0);
            if (r.status === 'Concluída' || r.status === 'Concluida') concluidas++;
            if (r.status === 'Em andamento' || r.status === 'Agendada') emAndamento++;
        });

        return {
            custoTotal,
            concluidas,
            emAndamento,
            totalRevisoes: revisoes.length
        };
    }, [revisoes]);

    const filtered = useMemo(() => {
        return revisoes.filter(r => {
            const matchTab = activeTab === 'todas' ? true : r.status === activeTab;
            const q = searchQuery.toLowerCase();
            const matchSearch = 
                !searchQuery ||
                r.maquina?.toLowerCase().includes(q) ||
                r.tipo?.toLowerCase().includes(q) ||
                r.mecanico?.toLowerCase().includes(q) ||
                r.observacoes?.toLowerCase().includes(q);

            return matchTab && matchSearch;
        });
    }, [revisoes, activeTab, searchQuery]);

    const handleDelete = async (id) => {
        if (!window.confirm("Deseja realmente excluir este registro de revisão?")) return;
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        try {
            await deleteDoc(doc(db, 'users', uid, 'revisoes', id));
        } catch (err) {
            console.error(err);
            window.alert("Erro ao excluir revisão.");
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
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Manutenção de Frotas</h1>
                            <p className="text-xs text-slate-500">Revisões preventivas, corretivas e custos com peças</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setModal({ visible: true, itemId: null })}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-950/10"
                    >
                        <PlusCircle size={18} />
                        <span>Nova Revisão</span>
                    </button>
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-800 text-white shadow-lg shadow-blue-950/10">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-blue-200">Investimento em Manutenção</span>
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                <Wrench size={16} />
                            </div>
                        </div>
                        <div className="text-3xl font-black tracking-tight">R$ {formatMoeda(stats.custoTotal)}</div>
                        <div className="text-xs text-blue-100 mt-1">Peças + Mão de obra acumulados</div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Revisões Realizadas</span>
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <CheckCircle2 size={18} />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{stats.concluidas}</div>
                        <div className="text-xs text-slate-500 mt-1">Manutenções finalizadas com sucesso</div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Agendadas / Em Oficina</span>
                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                <Clock size={18} />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{stats.emAndamento}</div>
                        <div className="text-xs text-slate-500 mt-1">Em atendimento no momento</div>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
                    <div className="flex rounded-xl bg-slate-200/80 p-1 w-full sm:w-auto overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('todas')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                activeTab === 'todas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Todas ({revisoes.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('Agendada')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                activeTab === 'Agendada' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Agendadas
                        </button>
                        <button
                            onClick={() => setActiveTab('Em andamento')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                activeTab === 'Em andamento' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Em Andamento
                        </button>
                        <button
                            onClick={() => setActiveTab('Concluída')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                activeTab === 'Concluída' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Concluídas
                        </button>
                    </div>

                    <div className="relative w-full sm:w-72">
                        <input
                            type="text"
                            placeholder="Buscar máquina, serviço..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                        />
                        <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                    </div>
                </div>

                {/* List of Revisões */}
                <div className="flex-1">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
                            <span className="text-xs font-semibold text-slate-500">Carregando revisões...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                                <Wrench size={24} />
                            </div>
                            <h3 className="text-base font-bold text-slate-700">Nenhuma revisão cadastrada</h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                Clique no botão "Nova Revisão" para registrar a manutenção preventiva ou corretiva de um maquinário.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filtered.map((item) => {
                                const statusColor = 
                                    item.status === 'Concluída' ? 'bg-emerald-100 text-emerald-800' :
                                    item.status === 'Em andamento' ? 'bg-amber-100 text-amber-800' :
                                    'bg-blue-100 text-blue-800';

                                return (
                                    <div
                                        key={item.id}
                                        className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColor}`}>
                                                            {item.status || 'Agendada'}
                                                        </span>
                                                        <span className="text-xs font-semibold text-slate-500">
                                                            {item.tipo || 'Preventiva'}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-base font-bold text-slate-800 mt-1">
                                                        {item.maquina || 'Máquina não especificada'}
                                                    </h3>
                                                </div>

                                                <div className="text-right">
                                                    <span className="text-lg font-black text-slate-900">
                                                        R$ {formatMoeda(item.valorTotal)}
                                                    </span>
                                                    <div className="text-[11px] text-slate-400 font-medium">
                                                        {formatDate(item.dataRevisao)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Details Badges */}
                                            <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mb-3">
                                                {item.horimetroKm && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Horímetro / KM Atual:</span>
                                                        <span className="font-semibold">{item.horimetroKm} h/km</span>
                                                    </div>
                                                )}
                                                {item.proximaRevisao && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Próxima Revisão:</span>
                                                        <span className="font-semibold text-blue-700">{item.proximaRevisao} h/km</span>
                                                    </div>
                                                )}
                                                {item.mecanico && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Oficina / Mecânico:</span>
                                                        <span className="font-semibold">{item.mecanico}</span>
                                                    </div>
                                                )}
                                                {item.pecas && item.pecas.length > 0 && (
                                                    <div className="pt-1.5 border-t border-slate-200/60">
                                                        <span className="text-[11px] font-bold text-slate-500 block mb-1">Peças Substituídas:</span>
                                                        <div className="space-y-0.5">
                                                            {item.pecas.map((p, idx) => (
                                                                <div key={idx} className="flex justify-between text-[11px]">
                                                                    <span>• {p.nome} (x{p.quantidade})</span>
                                                                    <span className="font-semibold">R$ {formatMoeda(p.subtotal || p.valorUnitario * p.quantidade)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
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

                {/* Modal Revisão */}
                {modal.visible && (
                    <ModalAddOrEditRevisao
                        itemId={modal.itemId}
                        onClose={() => setModal({ visible: false, itemId: null })}
                    />
                )}

            </div>
        </div>
    );
}

// Modal de Revisão
function ModalAddOrEditRevisao({ itemId, onClose }) {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [maquinasList, setMaquinasList] = useState([]);
    const [pecasEstoque, setPecasEstoque] = useState([]);

    const [maquina, setMaquina] = useState('');
    const [tipo, setTipo] = useState('Preventiva');
    const [status, setStatus] = useState('Concluída');
    const [horimetroKm, setHorimetroKm] = useState('');
    const [proximaRevisao, setProximaRevisao] = useState('');
    const [mecanico, setMecanico] = useState('');
    const [valorMaoDeObra, setValorMaoDeObra] = useState('');
    const [dataRevisao, setDataRevisao] = useState(new Date().toISOString().split('T')[0]);
    const [observacoes, setObservacoes] = useState('');
    const [pecas, setPecas] = useState([]); // [{ id, nome, quantidade, valorUnitario, subtotal, estoqueItemId }]

    // Sub-form para adicionar peça
    const [tempPecaNome, setTempPecaNome] = useState('');
    const [tempPecaQtd, setTempPecaQtd] = useState('1');
    const [tempPecaValor, setTempPecaValor] = useState('');
    const [tempStockId, setTempStockId] = useState('');

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        (async () => {
            try {
                const maqSnap = await getDocs(collection(db, 'users', uid, 'inventario'));
                setMaquinasList(maqSnap.docs.map(d => ({ id: d.id, ...d.data() })));

                const estSnap = await getDocs(collection(db, 'users', uid, 'estoqueGeral'));
                setPecasEstoque(estSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.tipo === 'Peça' || i.tipo === 'Insumo'));
            } catch (e) {
                console.error(e);
            }
        })();

        if (itemId) {
            (async () => {
                try {
                    const snap = await getDoc(doc(db, 'users', uid, 'revisoes', itemId));
                    if (snap.exists()) {
                        const d = snap.data();
                        setMaquina(d.maquina || '');
                        setTipo(d.tipo || 'Preventiva');
                        setStatus(d.status || 'Concluída');
                        setHorimetroKm(String(d.horimetroKm || ''));
                        setProximaRevisao(String(d.proximaRevisao || ''));
                        setMecanico(d.mecanico || '');
                        setValorMaoDeObra(String(d.valorMaoDeObra || ''));
                        setDataRevisao(d.dataRevisao?.toDate ? d.dataRevisao.toDate().toISOString().split('T')[0] : (d.dataRevisao || new Date().toISOString().split('T')[0]));
                        setObservacoes(d.observacoes || '');
                        setPecas(d.pecas || []);
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoading(false);
                }
            })();
        }
    }, [itemId]);

    // Cálculo do total geral
    const valorTotalCalculado = useMemo(() => {
        const mob = parseMoeda(valorMaoDeObra);
        const totalPecas = pecas.reduce((acc, p) => acc + parseMoeda(p.subtotal || (p.valorUnitario * p.quantidade)), 0);
        return mob + totalPecas;
    }, [valorMaoDeObra, pecas]);

    const handleAddPeca = () => {
        const q = parseMoeda(tempPecaQtd);
        const v = parseMoeda(tempPecaValor);
        if (!tempPecaNome.trim() || q <= 0) {
            window.alert("Informe o nome da peça e uma quantidade válida.");
            return;
        }

        const novaPeca = {
            id: Date.now().toString(),
            nome: tempPecaNome.trim(),
            quantidade: q,
            valorUnitario: v,
            subtotal: q * v,
            estoqueItemId: tempStockId || null
        };

        setPecas([...pecas, novaPeca]);
        setTempPecaNome('');
        setTempPecaQtd('1');
        setTempPecaValor('');
        setTempStockId('');
    };

    const handleRemovePeca = (id) => {
        setPecas(pecas.filter(p => p.id !== id));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!maquina.trim()) {
            window.alert("Por favor, selecione ou informe a máquina revisada.");
            return;
        }

        setSaving(true);
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        try {
            const docId = itemId || doc(collection(db, 'users', uid, 'revisoes')).id;
            await setDoc(doc(db, 'users', uid, 'revisoes', docId), {
                id: docId,
                maquina: maquina.trim(),
                tipo,
                status,
                horimetroKm: horimetroKm.trim(),
                proximaRevisao: proximaRevisao.trim(),
                mecanico: mecanico.trim(),
                valorMaoDeObra: parseMoeda(valorMaoDeObra),
                pecas,
                valorTotal: valorTotalCalculado,
                dataRevisao: new Date(`${dataRevisao}T12:00:00`),
                observacoes: observacoes.trim(),
                atualizadoEm: new Date()
            }, { merge: true });

            onClose();
        } catch (err) {
            console.error(err);
            window.alert("Erro ao salvar revisão.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal">
                <div className="px-6 py-4 bg-blue-700 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Wrench size={18} />
                        <span className="font-bold text-base">{itemId ? 'Editar Manutenção' : 'Nova Revisão de Frota'}</span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg text-blue-200 hover:text-white transition-colors cursor-pointer">
                        <X size={22} />
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Máquina / Equipamento *
                            </label>
                            {maquinasList.length > 0 ? (
                                <select
                                    required
                                    value={maquina}
                                    onChange={(e) => setMaquina(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                                >
                                    <option value="">Selecione da frota</option>
                                    {maquinasList.map(m => (
                                        <option key={m.id} value={`${m.marca} ${m.modelo} (${m.tipo})`}>
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
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Tipo de Revisão
                                </label>
                                <select
                                    value={tipo}
                                    onChange={(e) => setTipo(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                                >
                                    <option value="Preventiva">Preventiva (Periódica)</option>
                                    <option value="Corretiva">Corretiva (Reparo / Quebra)</option>
                                    <option value="Preditiva">Preditiva / Diagnóstico</option>
                                    <option value="Troca de Óleo / Filtros">Troca de Óleo / Filtros</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Status
                                </label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                                >
                                    <option value="Concluída">Concluída</option>
                                    <option value="Em andamento">Em andamento</option>
                                    <option value="Agendada">Agendada</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Horímetro / KM Atual
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 1850"
                                    value={horimetroKm}
                                    onChange={(e) => setHorimetroKm(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Próxima Revisão (h/km)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 2100"
                                    value={proximaRevisao}
                                    onChange={(e) => setProximaRevisao(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* Peças Trocadas Card */}
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                            <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Peças e Componentes Trocados
                            </span>

                            {/* Lista de Peças Já Adicionadas */}
                            {pecas.length > 0 && (
                                <div className="space-y-1.5">
                                    {pecas.map(p => (
                                        <div key={p.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                                            <div>
                                                <span className="font-bold text-slate-800">{p.nome}</span>
                                                <span className="text-slate-500 ml-2">(x{p.quantidade} un - R$ {formatMoeda(p.valorUnitario)})</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-slate-900">R$ {formatMoeda(p.subtotal)}</span>
                                                <button type="button" onClick={() => handleRemovePeca(p.id)} className="text-red-500 hover:text-red-700 cursor-pointer">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Adicionar Nova Peça Form */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200">
                                <div className="sm:col-span-2">
                                    {pecasEstoque.length > 0 && (
                                        <select
                                            value={tempStockId}
                                            onChange={(e) => {
                                                setTempStockId(e.target.value);
                                                const sel = pecasEstoque.find(pe => pe.id === e.target.value);
                                                if (sel) {
                                                    setTempPecaNome(sel.nome);
                                                    if (sel.valorUnitario) setTempPecaValor(String(sel.valorUnitario));
                                                }
                                            }}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 mb-1"
                                        >
                                            <option value="">Selecione Peça do Estoque</option>
                                            {pecasEstoque.map(pe => (
                                                <option key={pe.id} value={pe.id}>{pe.nome} (Saldo: {pe.quantidade})</option>
                                            ))}
                                        </select>
                                    )}
                                    <input
                                        type="text"
                                        placeholder="Nome da peça (ex: Filtro de Óleo)"
                                        value={tempPecaNome}
                                        onChange={(e) => setTempPecaNome(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        placeholder="Qtd (ex: 2)"
                                        value={tempPecaQtd}
                                        onChange={(e) => setTempPecaQtd(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                                    />
                                </div>
                                <div className="flex gap-1">
                                    <input
                                        type="text"
                                        placeholder="Valor un (R$)"
                                        value={tempPecaValor}
                                        onChange={(e) => setTempPecaValor(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddPeca}
                                        className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                                        title="Adicionar Peça"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Mão de Obra e Total */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Mão de Obra (R$)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 850,00"
                                    value={valorMaoDeObra}
                                    onChange={(e) => setValorMaoDeObra(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Custo Total Calculado
                                </label>
                                <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black text-blue-700 flex items-center">
                                    R$ {formatMoeda(valorTotalCalculado)}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Mecânico / Oficina
                                </label>
                                <input
                                    type="text"
                                    placeholder="Nome do mecânico ou empresa"
                                    value={mecanico}
                                    onChange={(e) => setMecanico(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Data da Manutenção *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={dataRevisao}
                                    onChange={(e) => setDataRevisao(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Laudo Técnico / Observações
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Serviços realizados, testes, garantia das peças..."
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 resize-none"
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
                                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : 'Salvar Manutenção'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
