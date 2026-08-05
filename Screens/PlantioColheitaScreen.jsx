import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    ArrowLeft,
    PlusCircle,
    Layers,
    Sprout,
    Leaf,
    Search,
    Pencil,
    Trash2,
    X,
    Sparkles,
    ScanLine,
    TrendingUp,
    Package,
    Tractor,
    Receipt,
    Camera,
    SwitchCamera,
    Images,
    FileText,
    AlertCircle,
    CheckCircle2,
    Eye
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
    orderBy
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { usePropertyAuth } from '../context/PropertyContext';
import { analyzeRomaneioFile, processRomaneioWithGroqVision } from '../services/romaneioAIService';
import PdfViewerModal from '../components/PdfViewerModal';

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

// =========================================================================
// 1. TELA DE PLANTIOS (PlantiosScreen)
// =========================================================================

export function PlantiosScreen({ navigation }) {
    const { effectiveUid, isAdmin, isMember } = usePropertyAuth();
    const [plantios, setPlantios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [modal, setModal] = useState({ visible: false, itemId: null });

    useEffect(() => {
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        const q = query(collection(db, 'users', uid, 'plantios'), orderBy('dataPlantio', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPlantios(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error(err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [effectiveUid]);

    // Estatísticas de Plantio
    const stats = useMemo(() => {
        let areaTotal = 0;
        const culturasSet = new Set();

        plantios.forEach(p => {
            areaTotal += parseMoeda(p.area || p.areaPlantada || 0);
            if (p.cultura) culturasSet.add(p.cultura.trim());
        });

        return {
            areaTotal,
            totalPlantios: plantios.length,
            culturasCount: culturasSet.size
        };
    }, [plantios]);

    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return plantios.filter(p => 
            !searchQuery ||
            p.cultura?.toLowerCase().includes(q) ||
            p.variedade?.toLowerCase().includes(q) ||
            p.talhao?.toLowerCase().includes(q) ||
            p.status?.toLowerCase().includes(q)
        );
    }, [plantios, searchQuery]);

    const handleDelete = async (id) => {
        if (!isAdmin) return;
        if (!window.confirm("Deseja realmente excluir este registro de plantio?")) return;
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;
        try {
            await deleteDoc(doc(db, 'users', uid, 'plantios', id));
        } catch (err) {
            console.error(err);
            window.alert("Erro ao excluir plantio.");
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
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Controle de Plantio</h1>
                            <p className="text-xs text-slate-500">Acompanhamento de safras, talhões e sementes</p>
                        </div>
                    </div>

                    {isAdmin ? (
                        <button
                            onClick={() => setModal({ visible: true, itemId: null })}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-950/10"
                        >
                            <PlusCircle size={18} />
                            <span>Novo Plantio</span>
                        </button>
                    ) : (
                        <div className="px-3 py-1.5 bg-slate-200/80 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-300">
                            <span>👤 Visualização</span>
                        </div>
                    )}
                </div>

                {/* Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-800 text-white shadow-lg shadow-emerald-950/10">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-green-200">Área Total Plantada</span>
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                <Sprout size={16} />
                            </div>
                        </div>
                        <div className="text-3xl font-black tracking-tight">{formatNumero(stats.areaTotal)} <span className="text-sm font-semibold text-emerald-200">ha</span></div>
                        <div className="text-xs text-emerald-100 mt-1">Soma de todos os talhões semeados</div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Talhões em Andamento</span>
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <Layers size={16} />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{stats.totalPlantios}</div>
                        <div className="text-xs text-slate-500 mt-1">Registros de semeadura ativos</div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Culturas Distintas</span>
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <Leaf size={16} />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{stats.culturasCount}</div>
                        <div className="text-xs text-slate-500 mt-1">Variedades em cultivo na fazenda</div>
                    </div>
                </div>

                {/* Filter */}
                <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="relative w-full sm:w-80">
                        <input
                            type="text"
                            placeholder="Buscar por cultura, talhão, variedade..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-sm"
                        />
                        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                </div>

                {/* List of Plantios */}
                <div className="flex-1">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
                            <span className="text-xs font-semibold text-slate-500">Carregando dados de plantio...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                                <Sprout size={28} />
                            </div>
                            <h3 className="text-base font-bold text-slate-700">Nenhum plantio cadastrado</h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                {isAdmin ? 'Clique no botão "Novo Plantio" para registrar a semeadura de um talhão.' : 'Nenhum registro encontrado.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filtered.map((item) => {
                                const area = parseMoeda(item.area || item.areaPlantada || 0);

                                return (
                                    <div
                                        key={item.id}
                                        className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2 mb-3">
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                                        {item.cultura || 'Cultura'}
                                                    </span>
                                                    <h3 className="text-base font-bold text-slate-800 mt-1">
                                                        {item.talhao || 'Talhão sem nome'}
                                                    </h3>
                                                    {item.variedade && (
                                                        <div className="text-xs text-slate-500 font-medium">
                                                            Variedade: {item.variedade}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="text-right">
                                                    <span className="text-lg font-black text-emerald-700">
                                                        {formatNumero(area)} ha
                                                    </span>
                                                    <div className="text-[11px] text-slate-400">
                                                        {formatDate(item.dataPlantio)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Details */}
                                            <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mb-3">
                                                {item.populacaoSementes && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Densidade/População:</span>
                                                        <span className="font-semibold">{item.populacaoSementes} sem/ha</span>
                                                    </div>
                                                )}
                                                {item.espacamento && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Espaçamento:</span>
                                                        <span className="font-semibold">{item.espacamento} cm</span>
                                                    </div>
                                                )}
                                                {item.status && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Fase Fenológica:</span>
                                                        <span className="font-semibold text-emerald-700">{item.status}</span>
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
                                        {isAdmin && (
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
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Modal Plantio */}
                {modal.visible && isAdmin && (
                    <ModalAddOrEditPlantio
                        itemId={modal.itemId}
                        effectiveUid={effectiveUid}
                        onClose={() => setModal({ visible: false, itemId: null })}
                    />
                )}

            </div>
        </div>
    );
}

// Modal de Plantio
function ModalAddOrEditPlantio({ itemId, effectiveUid, onClose }) {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [talhoesList, setTalhoesList] = useState([]);

    const [cultura, setCultura] = useState('Soja');
    const [variedade, setVariedade] = useState('');
    const [talhao, setTalhao] = useState('');
    const [area, setArea] = useState('');
    const [populacaoSementes, setPopulacaoSementes] = useState('');
    const [espacamento, setEspacamento] = useState('45');
    const [status, setStatus] = useState('Germinação');
    const [dataPlantio, setDataPlantio] = useState(new Date().toISOString().split('T')[0]);
    const [observacoes, setObservacoes] = useState('');

    useEffect(() => {
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        // Fetch talhoes
        (async () => {
            try {
                const snap = await getDocs(collection(db, 'users', uid, 'talhoes'));
                setTalhoesList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) {
                console.error(e);
            }
        })();

        // Fetch item se for edição
        if (itemId) {
            (async () => {
                try {
                    const snap = await getDoc(doc(db, 'users', uid, 'plantios', itemId));
                    if (snap.exists()) {
                        const d = snap.data();
                        setCultura(d.cultura || 'Soja');
                        setVariedade(d.variedade || '');
                        setTalhao(d.talhao || '');
                        setArea(String(d.area || d.areaPlantada || ''));
                        setPopulacaoSementes(String(d.populacaoSementes || ''));
                        setEspacamento(String(d.espacamento || ''));
                        setStatus(d.status || 'Germinação');
                        setDataPlantio(d.dataPlantio?.toDate ? d.dataPlantio.toDate().toISOString().split('T')[0] : (d.dataPlantio || new Date().toISOString().split('T')[0]));
                        setObservacoes(d.observacoes || '');
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoading(false);
                }
            })();
        }
    }, [itemId, effectiveUid]);

    const handleSave = async (e) => {
        e.preventDefault();
        const areaNum = parseMoeda(area);
        if (!talhao.trim() || areaNum <= 0) {
            window.alert("Informe o talhão e uma área válida.");
            return;
        }

        setSaving(true);
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        try {
            const docId = itemId || doc(collection(db, 'users', uid, 'plantios')).id;
            await setDoc(doc(db, 'users', uid, 'plantios', docId), {
                id: docId,
                cultura,
                variedade: variedade.trim(),
                talhao: talhao.trim(),
                area: areaNum,
                populacaoSementes: populacaoSementes.trim(),
                espacamento: espacamento.trim(),
                status,
                dataPlantio: new Date(`${dataPlantio}T12:00:00`),
                observacoes: observacoes.trim(),
                atualizadoEm: new Date()
            }, { merge: true });

            onClose();
        } catch (err) {
            console.error(err);
            window.alert("Erro ao salvar dados de plantio.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal">
                <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sprout size={18} />
                        <span className="font-bold text-base">{itemId ? 'Editar Plantio' : 'Novo Plantio'}</span>
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
                                    <option value="Cana-de-açúcar">Cana-de-açúcar</option>
                                    <option value="Feijão">Feijão</option>
                                    <option value="Arroz">Arroz</option>
                                    <option value="Outro">Outro</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Variedade / Híbrido
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Monsoy 6410 IPRO"
                                    value={variedade}
                                    onChange={(e) => setVariedade(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
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
                                            if (sel && sel.areaTotal) setArea(String(sel.areaTotal));
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
                                        placeholder="Ex: Talhão 04 (Sede)"
                                        value={talhao}
                                        onChange={(e) => setTalhao(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Área Plantada (ha) *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: 120"
                                    value={area}
                                    onChange={(e) => setArea(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    População (sem/ha)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 280.000"
                                    value={populacaoSementes}
                                    onChange={(e) => setPopulacaoSementes(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Espaçamento (cm)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 45"
                                    value={espacamento}
                                    onChange={(e) => setEspacamento(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Fase Fenológica
                                </label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="Germinação">Germinação / Emergência (VE)</option>
                                    <option value="Vegetativo">Desenvolvimento Vegetativo (V)</option>
                                    <option value="Floração">Floração (R1-R2)</option>
                                    <option value="Enchimento de Grãos">Enchimento de Grãos (R3-R5)</option>
                                    <option value="Maturação">Maturação Fisiológica (R6-R8)</option>
                                    <option value="Pronto para Colheita">Pronto para Colheita</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Data de Plantio *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={dataPlantio}
                                    onChange={(e) => setDataPlantio(e.target.value)}
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
                                placeholder="Condições do solo, adubação de base no sulco..."
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
                                {saving ? 'Salvando...' : 'Salvar Plantio'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// =========================================================================
// 2. TELA DE COLHEITAS (ColheitasScreen)
// =========================================================================

export function ColheitasScreen({ navigation }) {
    const { effectiveUid, isAdmin, isMember } = usePropertyAuth();
    const [colheitas, setColheitas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [modal, setModal] = useState({ visible: false, itemId: null, startScanner: false });

    useEffect(() => {
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        const q = query(collection(db, 'users', uid, 'colheitas'), orderBy('dataColheita', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setColheitas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error(err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [effectiveUid]);

    // Estatísticas de Colheita
    const stats = useMemo(() => {
        let totalSacas = 0;
        let totalArea = 0;

        colheitas.forEach(c => {
            const area = parseMoeda(c.areaColhida || c.area || 0);
            const pesoKg = parseMoeda(c.pesoTotalKg || 0);
            const sacas = c.pesoTotalSacas ? parseMoeda(c.pesoTotalSacas) : (pesoKg > 0 ? pesoKg / 60 : 0);

            totalArea += area;
            totalSacas += sacas;
        });

        const produtividadeMedia = totalArea > 0 ? totalSacas / totalArea : 0;

        return {
            totalSacas,
            totalArea,
            produtividadeMedia
        };
    }, [colheitas]);

    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return colheitas.filter(c => 
            !searchQuery ||
            c.cultura?.toLowerCase().includes(q) ||
            c.talhao?.toLowerCase().includes(q) ||
            c.destino?.toLowerCase().includes(q) ||
            c.numeroRomaneio?.toLowerCase().includes(q) ||
            c.placaVeiculo?.toLowerCase().includes(q)
        );
    }, [colheitas, searchQuery]);

    const handleDelete = async (id) => {
        if (!isAdmin) return;
        if (!window.confirm("Deseja realmente excluir este registro de colheita?")) return;
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;
        try {
            await deleteDoc(doc(db, 'users', uid, 'colheitas', id));
        } catch (err) {
            console.error(err);
            window.alert("Erro ao excluir colheita.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col px-4 py-6 sm:px-6 sm:py-8">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigation?.goBack()}
                            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer shadow-sm"
                            title="Voltar"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Controle de Colheita</h1>
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1">
                                    <Sparkles size={12} className="text-amber-600" />
                                    IA Romaneios
                                </span>
                            </div>
                            <p className="text-xs text-slate-500">Produtividade, pesagem, romaneios com IA e armazenagem</p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {isAdmin ? (
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => setModal({ visible: true, itemId: null, startScanner: true })}
                                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-950/15"
                                title="Escanear Romaneio por Câmera ou PDF usando a IA AgronomIA / Groq"
                            >
                                <ScanLine size={18} />
                                <span>Ler Romaneio (IA)</span>
                            </button>

                            <button
                                onClick={() => setModal({ visible: true, itemId: null, startScanner: false })}
                                className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                            >
                                <PlusCircle size={18} />
                                <span>Nova Colheita</span>
                            </button>
                        </div>
                    ) : (
                        <div className="px-3 py-1.5 bg-slate-200/80 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-300">
                            <span>👤 Visualização</span>
                        </div>
                    )}
                </div>

                {/* Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-600 to-yellow-700 text-white shadow-lg shadow-amber-950/10">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-200">Produtividade Média</span>
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                <TrendingUp size={16} />
                            </div>
                        </div>
                        <div className="text-3xl font-black tracking-tight">{formatNumero(stats.produtividadeMedia, 1)} <span className="text-sm font-semibold text-amber-200">sc/ha</span></div>
                        <div className="text-xs text-amber-100 mt-1">Média consolidada da safra</div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Produção Total</span>
                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                <Package size={16} />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{formatNumero(stats.totalSacas, 0)} <span className="text-sm font-semibold text-slate-500">sc</span></div>
                        <div className="text-xs text-slate-500 mt-1">Sacas de grãos colhidas</div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Área Colhida Total</span>
                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                <Tractor size={16} />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{formatNumero(stats.totalArea)} <span className="text-sm font-semibold text-slate-500">ha</span></div>
                        <div className="text-xs text-slate-500 mt-1">Hectares concluídos</div>
                    </div>
                </div>

                {/* Filter */}
                <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="relative w-full sm:w-80">
                        <input
                            type="text"
                            placeholder="Buscar por cultura, talhão, romaneio..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 shadow-sm"
                        />
                        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                </div>

                {/* List of Colheitas */}
                <div className="flex-1">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mb-3" />
                            <span className="text-xs font-semibold text-slate-500">Carregando dados de colheita...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                                <Tractor size={28} />
                            </div>
                            <h3 className="text-base font-bold text-slate-700">Nenhuma colheita registrada</h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto mb-4">
                                {isAdmin ? 'Lance manualmente ou use o Leitor de Romaneio com IA para importar os tickets de pesagem.' : 'Nenhum registro de colheita encontrado.'}
                            </p>
                            {isAdmin && (
                                <button
                                    onClick={() => setModal({ visible: true, itemId: null, startScanner: true })}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                                >
                                    <ScanLine size={16} />
                                    <span>Escanear Primeiro Romaneio com IA</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filtered.map((item) => {
                                const area = parseMoeda(item.areaColhida || item.area || 0);
                                const pesoKg = parseMoeda(item.pesoTotalKg || 0);
                                const sacas = item.pesoTotalSacas ? parseMoeda(item.pesoTotalSacas) : (pesoKg > 0 ? pesoKg / 60 : 0);
                                const prod = area > 0 ? sacas / area : 0;

                                return (
                                    <div
                                        key={item.id}
                                        className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2 mb-3">
                                                <div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                                            {item.cultura || 'Cultura'}
                                                        </span>
                                                        {item.numeroRomaneio && (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 flex items-center gap-1">
                                                                <Receipt size={11} />
                                                                #{item.numeroRomaneio}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-base font-bold text-slate-800 mt-1.5">
                                                        {item.talhao || 'Talhão não informado'}
                                                    </h3>
                                                </div>

                                                <div className="text-right">
                                                    <span className="text-lg font-black text-amber-600">
                                                        {formatNumero(prod, 1)} sc/ha
                                                    </span>
                                                    <div className="text-[11px] text-slate-400">
                                                        {formatDate(item.dataColheita)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Details Badges */}
                                            <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mb-3">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Área Colhida:</span>
                                                    <span className="font-semibold">{formatNumero(area)} ha</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Produção Líquida:</span>
                                                    <span className="font-semibold text-amber-800">{formatNumero(sacas, 1)} sc ({formatNumero(pesoKg, 0)} kg)</span>
                                                </div>
                                                {(item.umidade || item.impureza) && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Classificação:</span>
                                                        <span className="font-semibold text-slate-700">
                                                            {item.umidade ? `Umid: ${item.umidade}%` : ''} {item.impureza ? `| Imp: ${item.impureza}%` : ''}
                                                        </span>
                                                    </div>
                                                )}
                                                {item.placaVeiculo && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Caminhão / Placa:</span>
                                                        <span className="font-semibold text-slate-700">{item.placaVeiculo}</span>
                                                    </div>
                                                )}
                                                {item.destino && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Destino / Silo:</span>
                                                        <span className="font-semibold text-slate-700">{item.destino}</span>
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
                                        {isAdmin && (
                                            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                                                <button
                                                    onClick={() => setModal({ visible: true, itemId: item.id, startScanner: false })}
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

                {/* Modal Colheita com Scanner IA */}
                {modal.visible && isAdmin && (
                    <ModalAddOrEditColheita
                        itemId={modal.itemId}
                        startScanner={modal.startScanner}
                        effectiveUid={effectiveUid}
                        onClose={() => setModal({ visible: false, itemId: null, startScanner: false })}
                    />
                )}

            </div>
        </div>
    );
}

// =========================================================================
// Componente de Câmera ao Vivo para Romaneio
// =========================================================================
function LiveCameraModal({ onCapture, onClose }) {
    const videoRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
    const [cameraError, setCameraError] = useState(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const fallbackInputRef = useRef(null);

    const startCamera = useCallback(async (mode) => {
        try {
            setCameraError(null);
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
            }
            if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Acesso direto à câmera não suportado neste navegador. Use o botão abaixo para tirar foto.");
            }
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: mode },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            });
            setStream(newStream);
            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
                videoRef.current.play().catch(() => {});
            }
        } catch (err) {
            console.warn("Erro ao iniciar câmera ao vivo:", err);
            setCameraError(err.message || "Não foi possível abrir o streaming da câmera.");
        }
    }, [stream]);

    useEffect(() => {
        startCamera(facingMode);
        return () => {
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
            }
        };
    }, [facingMode]);

    const handleCapture = () => {
        if (!videoRef.current) return;
        setIsCapturing(true);
        try {
            const video = videoRef.current;
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.92);
            
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
            }
            onCapture(base64);
        } catch (e) {
            console.error("Erro na captura de frame da câmera:", e);
            alert("Erro ao capturar imagem da câmera.");
        } finally {
            setIsCapturing(false);
        }
    };

    const handleFallbackFile = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (stream) stream.getTracks().forEach(t => t.stop());
            onCapture(file);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
            <div className="w-full max-w-lg bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col">
                {/* Header */}
                <div className="px-5 py-3.5 bg-slate-800/90 flex items-center justify-between border-b border-slate-700 text-white">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-bold text-sm">Câmera • Leitor de Romaneio IA</span>
                    </div>
                    <button 
                        onClick={() => { 
                            if (stream) stream.getTracks().forEach(t => t.stop()); 
                            onClose(); 
                        }} 
                        className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Viewfinder */}
                <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
                    {cameraError ? (
                        <div className="p-6 text-center text-slate-300 space-y-3">
                            <Camera size={44} className="mx-auto text-amber-400" />
                            <p className="text-xs sm:text-sm font-semibold">{cameraError}</p>
                            <input
                                ref={fallbackInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={handleFallbackFile}
                            />
                            <button
                                type="button"
                                onClick={() => fallbackInputRef.current?.click()}
                                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
                            >
                                Tirar Foto com App de Câmera
                            </button>
                        </div>
                    ) : (
                        <>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />
                            {/* Reticle / Guia de Romaneio */}
                            <div className="absolute inset-5 border-2 border-dashed border-amber-400/80 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                                <div className="flex justify-between items-center text-[10px] font-bold text-amber-300 uppercase tracking-widest bg-black/60 px-2.5 py-1 rounded backdrop-blur-sm self-start">
                                    Enquadre o Ticket de Pesagem
                                </div>
                                <div className="text-center text-[11px] text-amber-200 font-medium bg-black/60 py-1.5 px-3 rounded-lg backdrop-blur-sm self-center">
                                    Mantenha o Romaneio nítido e iluminado
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Controls Footer */}
                <div className="p-4 bg-slate-800/90 border-t border-slate-700 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                        className="p-3 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                        title="Alternar Câmera"
                    >
                        <SwitchCamera size={20} />
                        <span className="hidden sm:inline">Girar</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleCapture}
                        disabled={!!cameraError || isCapturing}
                        className="flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                        <Camera size={20} />
                        <span>{isCapturing ? 'Lendo com IA...' : 'Capturar Romaneio'}</span>
                    </button>

                    <input
                        ref={fallbackInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleFallbackFile}
                    />
                    <button
                        type="button"
                        onClick={() => fallbackInputRef.current?.click()}
                        className="p-3 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white transition-all cursor-pointer"
                        title="Tirar foto usando app nativo"
                    >
                        <Images size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// =========================================================================
// Modal de Adicionar / Editar Colheita com Leitor IA AgronomIA
// =========================================================================
function ModalAddOrEditColheita({ itemId, onClose, startScanner = false, effectiveUid }) {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [talhoesList, setTalhoesList] = useState([]);

    // Campos principais
    const [cultura, setCultura] = useState('Soja');
    const [talhao, setTalhao] = useState('');
    const [areaColhida, setAreaColhida] = useState('');
    const [pesoTotalKg, setPesoTotalKg] = useState('');
    const [pesoTotalSacas, setPesoTotalSacas] = useState('');
    const [umidade, setUmidade] = useState('14');
    const [impureza, setImpureza] = useState('1');
    const [destino, setDestino] = useState('');
    const [dataColheita, setDataColheita] = useState(new Date().toISOString().split('T')[0]);
    const [observacoes, setObservacoes] = useState('');
    
    // Campos adicionais de Romaneio
    const [numeroRomaneio, setNumeroRomaneio] = useState('');
    const [placaVeiculo, setPlacaVeiculo] = useState('');

    // Estados do Scanner com IA (Groq / AgronomIA)
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [analyzingAi, setAnalyzingAi] = useState(false);
    const [aiResult, setAiResult] = useState(null);
    const [aiError, setAiError] = useState(null);
    const [selectedFileName, setSelectedFileName] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const [pdfPreviewSource, setPdfPreviewSource] = useState(null);
    const [showPdfViewer, setShowPdfViewer] = useState(false);

    const pdfInputRef = useRef(null);
    const imageInputRef = useRef(null);

    useEffect(() => {
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        // Fetch talhoes
        (async () => {
            try {
                const snap = await getDocs(collection(db, 'users', uid, 'talhoes'));
                setTalhoesList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) {
                console.error(e);
            }
        })();

        // Fetch item para edição
        if (itemId) {
            (async () => {
                try {
                    const snap = await getDoc(doc(db, 'users', uid, 'colheitas', itemId));
                    if (snap.exists()) {
                        const d = snap.data();
                        setCultura(d.cultura || 'Soja');
                        setTalhao(d.talhao || '');
                        setAreaColhida(String(d.areaColhida || d.area || ''));
                        setPesoTotalKg(String(d.pesoTotalKg || ''));
                        setPesoTotalSacas(String(d.pesoTotalSacas || ''));
                        setUmidade(String(d.umidade || ''));
                        setImpureza(String(d.impureza || ''));
                        setDestino(d.destino || '');
                        setDataColheita(d.dataColheita?.toDate ? d.dataColheita.toDate().toISOString().split('T')[0] : (d.dataColheita || new Date().toISOString().split('T')[0]));
                        setObservacoes(d.observacoes || '');
                        setNumeroRomaneio(d.numeroRomaneio || '');
                        setPlacaVeiculo(d.placaVeiculo || '');
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoading(false);
                }
            })();
        }
    }, [itemId, effectiveUid]);

    // Dispara processamento do arquivo ou imagem da câmera com Groq Vision
    const handleProcessRomaneio = async (fileOrBase64, fileName = '') => {
        setAnalyzingAi(true);
        setAiError(null);
        setAiResult(null);
        setSelectedFileName(fileName || (typeof fileOrBase64 === 'string' ? 'Foto da Câmera' : fileOrBase64?.name || 'Arquivo'));

        try {
            let extractedData;
            if (typeof fileOrBase64 === 'string') {
                // Base64 direto da Câmera
                extractedData = await processRomaneioWithGroqVision(fileOrBase64);
            } else {
                // Arquivo PDF ou Imagem
                extractedData = await analyzeRomaneioFile(fileOrBase64);
            }

            if (!extractedData) {
                throw new Error("Não foi possível ler as informações do documento.");
            }

            setAiResult(extractedData);

            // Preenchimento automático nos estados do formulário
            if (extractedData.cultura) setCultura(extractedData.cultura);
            if (extractedData.talhao) {
                setTalhao(extractedData.talhao);
                // Procura se tem talhão correspondente para preencher área automaticamente
                const matchTalhao = talhoesList.find(t => t.nome?.toLowerCase() === extractedData.talhao?.toLowerCase());
                if (matchTalhao && matchTalhao.areaTotal) {
                    setAreaColhida(String(matchTalhao.areaTotal));
                }
            }
            if (extractedData.pesoTotalKg) setPesoTotalKg(extractedData.pesoTotalKg);
            if (extractedData.pesoTotalSacas) setPesoTotalSacas(extractedData.pesoTotalSacas);
            if (extractedData.umidade) setUmidade(extractedData.umidade);
            if (extractedData.impureza) setImpureza(extractedData.impureza);
            if (extractedData.destino) setDestino(extractedData.destino);
            if (extractedData.dataColheita) setDataColheita(extractedData.dataColheita);
            if (extractedData.numeroRomaneio) setNumeroRomaneio(extractedData.numeroRomaneio);
            if (extractedData.placaVeiculo) setPlacaVeiculo(extractedData.placaVeiculo);

            if (extractedData.observacoes) {
                setObservacoes(prev => {
                    if (!prev) return extractedData.observacoes;
                    if (prev.includes(extractedData.numeroRomaneio || '@@@')) return prev;
                    return `${prev}\n${extractedData.observacoes}`;
                });
            }
        } catch (err) {
            console.error("Erro na leitura do Romaneio via IA:", err);
            setAiError(err.message || "Falha na análise do romaneio pela IA.");
        } finally {
            setAnalyzingAi(false);
        }
    };

    // Manipulação de arquivos
    const handlePdfSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setPdfPreviewSource(file);
            handleProcessRomaneio(file, file.name);
        }
    };

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) handleProcessRomaneio(file, file.name);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) handleProcessRomaneio(file, file.name);
    };

    // Atualiza sacas automaticamente se peso em kg for digitado
    const handleKgChange = (val) => {
        setPesoTotalKg(val);
        const kg = parseMoeda(val);
        if (kg > 0) {
            setPesoTotalSacas((kg / 60).toFixed(2));
        }
    };

    const handleSacasChange = (val) => {
        setPesoTotalSacas(val);
        const sc = parseMoeda(val);
        if (sc > 0) {
            setPesoTotalKg((sc * 60).toFixed(0));
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const areaNum = parseMoeda(areaColhida);
        const kgNum = parseMoeda(pesoTotalKg);
        const sacasNum = parseMoeda(pesoTotalSacas);

        if (!talhao.trim() || areaNum <= 0 || (kgNum <= 0 && sacasNum <= 0)) {
            window.alert("Informe o talhão, a área colhida e o peso ou sacas colhidas.");
            return;
        }

        setSaving(true);
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        try {
            const docId = itemId || doc(collection(db, 'users', uid, 'colheitas')).id;
            await setDoc(doc(db, 'users', uid, 'colheitas', docId), {
                id: docId,
                cultura,
                talhao: talhao.trim(),
                areaColhida: areaNum,
                pesoTotalKg: kgNum,
                pesoTotalSacas: sacasNum > 0 ? sacasNum : kgNum / 60,
                umidade: parseMoeda(umidade),
                impureza: parseMoeda(impureza),
                destino: destino.trim(),
                dataColheita: new Date(`${dataColheita}T12:00:00`),
                observacoes: observacoes.trim(),
                numeroRomaneio: numeroRomaneio.trim(),
                placaVeiculo: placaVeiculo.trim(),
                atualizadoEm: new Date()
            }, { merge: true });

            onClose();
        } catch (err) {
            console.error(err);
            window.alert("Erro ao salvar colheita.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-yellow-600 text-white flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                            <Tractor size={16} />
                        </div>
                        <div>
                            <span className="font-black text-base tracking-tight block">
                                {itemId ? 'Editar Registro de Colheita' : 'Nova Colheita & Romaneio'}
                            </span>
                            <span className="text-[11px] text-amber-100 block">
                                AgronomIA + Reconhecimento de Ticket por Visão Groq
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-xl text-amber-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
                        <X size={22} />
                    </button>
                </div>

                {loading ? (
                    <div className="p-16 flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mb-3" />
                        <span className="text-xs font-semibold text-slate-500">Carregando dados...</span>
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
                        
                        {/* ========================================================================= */}
                        {/* BANNER DO SCANNER DE ROMANEIO (IA AGRONOMIA + GROQ) */}
                        {/* ========================================================================= */}
                        <div 
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={handleDrop}
                            className={`p-4 rounded-2xl border transition-all ${
                                isDragOver 
                                    ? 'border-amber-500 bg-amber-50/80 scale-[1.01]' 
                                    : 'border-amber-200/90 bg-gradient-to-br from-amber-50/60 to-yellow-50/40'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs shadow-sm">
                                        <Sparkles size={13} />
                                    </div>
                                    <span className="text-xs font-black text-amber-900 tracking-tight">
                                        Importar Romaneio com AgronomIA
                                    </span>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-800">
                                    Groq Vision
                                </span>
                            </div>

                            <p className="text-[11px] text-slate-600 mb-3">
                                Tire uma foto do ticket de pesagem, selecione um arquivo PDF ou envie uma foto. A IA extrai todos os pesos, umidade e dados automaticamente.
                            </p>

                            {/* Inputs de arquivo ocultos */}
                            <input
                                ref={pdfInputRef}
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                onChange={handlePdfSelect}
                            />
                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageSelect}
                            />

                            {/* Botões de Ação do Scanner */}
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCameraModal(true)}
                                    disabled={analyzingAi}
                                    className="p-2.5 rounded-xl bg-white hover:bg-amber-100/60 border border-amber-200 text-slate-800 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                                >
                                    <Camera size={20} className="text-amber-600" />
                                    <span>Câmera</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => pdfInputRef.current?.click()}
                                    disabled={analyzingAi}
                                    className="p-2.5 rounded-xl bg-white hover:bg-amber-100/60 border border-amber-200 text-slate-800 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                                >
                                    <FileText size={20} className="text-red-500" />
                                    <span>Arquivo PDF</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => imageInputRef.current?.click()}
                                    disabled={analyzingAi}
                                    className="p-2.5 rounded-xl bg-white hover:bg-amber-100/60 border border-amber-200 text-slate-800 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                                >
                                    <Images size={20} className="text-emerald-600" />
                                    <span>Foto / Galeria</span>
                                </button>
                            </div>

                            {/* Botão de Visualização Rápida do PDF Anexado */}
                            {pdfPreviewSource && (
                                <div className="mt-2.5 flex items-center justify-between p-2 rounded-xl bg-amber-100/60 border border-amber-300">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText size={15} className="text-red-600 shrink-0" />
                                        <span className="text-xs font-bold text-amber-900 truncate">
                                            {pdfPreviewSource.name || 'Romaneio.pdf'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowPdfViewer(true)}
                                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                                    >
                                        <Eye size={13} />
                                        <span>Visualizar PDF</span>
                                    </button>
                                </div>
                            )}

                            {/* Estado de Processamento da IA */}
                            {analyzingAi && (
                                <div className="mt-3 p-3.5 bg-amber-500/10 border border-amber-300 rounded-xl flex items-center gap-3 animate-pulse">
                                    <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-amber-900">AgronomIA analisando Romaneio...</div>
                                        <div className="text-[10px] text-amber-700">Lendo ticket via Groq Cloud Vision ({selectedFileName})</div>
                                    </div>
                                </div>
                            )}

                            {/* Erro da IA */}
                            {aiError && (
                                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-xs">
                                    <AlertCircle size={16} className="shrink-0 text-red-500 mt-0.5" />
                                    <div className="flex-1">
                                        <span className="font-bold">Aviso:</span> {aiError}
                                    </div>
                                </div>
                            )}

                            {/* Sucesso na Extração */}
                            {aiResult && (
                                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 animate-fadeIn">
                                    <div className="flex items-center justify-between text-emerald-800 font-bold text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <CheckCircle2 size={16} className="text-emerald-600" />
                                            <span>Romaneio Lido com Sucesso!</span>
                                        </div>
                                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                                            Auto-preenchido
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-emerald-900 grid grid-cols-2 gap-x-2 gap-y-1 pt-1 border-t border-emerald-200/60">
                                        <div><span className="text-emerald-700">Ticket:</span> {aiResult.numeroRomaneio || '--'}</div>
                                        <div><span className="text-emerald-700">Placa:</span> {aiResult.placaVeiculo || '--'}</div>
                                        <div><span className="text-emerald-700">Peso Líquido:</span> {aiResult.pesoTotalKg ? `${aiResult.pesoTotalKg} kg` : '--'}</div>
                                        <div><span className="text-emerald-700">Sacas:</span> {aiResult.pesoTotalSacas ? `${aiResult.pesoTotalSacas} sc` : '--'}</div>
                                        <div><span className="text-emerald-700">Umidade:</span> {aiResult.umidade ? `${aiResult.umidade}%` : '--'}</div>
                                        <div><span className="text-emerald-700">Armazém:</span> {aiResult.destino || '--'}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ========================================================================= */}
                        {/* CAMPOS DO FORMULÁRIO */}
                        {/* ========================================================================= */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Cultura *
                                </label>
                                <select
                                    value={cultura}
                                    onChange={(e) => setCultura(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 font-semibold"
                                >
                                    <option value="Soja">Soja</option>
                                    <option value="Milho">Milho</option>
                                    <option value="Trigo">Trigo</option>
                                    <option value="Algodão">Algodão</option>
                                    <option value="Café">Café</option>
                                    <option value="Cana-de-açúcar">Cana-de-açúcar</option>
                                    <option value="Feijão">Feijão</option>
                                    <option value="Arroz">Arroz</option>
                                    <option value="Sorgo">Sorgo</option>
                                    <option value="Girassol">Girassol</option>
                                    <option value="Outro">Outro</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Talhão Colhido *
                                </label>
                                {talhoesList.length > 0 ? (
                                    <select
                                        required
                                        value={talhao}
                                        onChange={(e) => {
                                            setTalhao(e.target.value);
                                            const sel = talhoesList.find(t => t.nome === e.target.value);
                                            if (sel && sel.areaTotal) setAreaColhida(String(sel.areaTotal));
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500"
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
                                        placeholder="Ex: Talhão 02"
                                        value={talhao}
                                        onChange={(e) => setTalhao(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Área Colhida (ha) *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: 85"
                                    value={areaColhida}
                                    onChange={(e) => setAreaColhida(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Nº do Romaneio / Ticket
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 849201"
                                    value={numeroRomaneio}
                                    onChange={(e) => setNumeroRomaneio(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Peso Líquido Total (Kg) *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: 382500"
                                    value={pesoTotalKg}
                                    onChange={(e) => handleKgChange(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Total em Sacas (sc 60kg)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 6375"
                                    value={pesoTotalSacas}
                                    onChange={(e) => handleSacasChange(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 font-bold text-amber-700"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Umidade (%)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 13.8"
                                    value={umidade}
                                    onChange={(e) => setUmidade(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Impureza (%)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 1.0"
                                    value={impureza}
                                    onChange={(e) => setImpureza(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Placa do Caminhão
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: ABC-1D23"
                                    value={placaVeiculo}
                                    onChange={(e) => setPlacaVeiculo(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Destino / Armazém
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Silo Próprio / Coamo"
                                    value={destino}
                                    onChange={(e) => setDestino(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Data da Colheita / Pesagem *
                            </label>
                            <input
                                type="date"
                                required
                                value={dataColheita}
                                onChange={(e) => setDataColheita(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Observações do Romaneio / Colheita
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Condições da colheita, descontos, motorista..."
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 resize-none"
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
                                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Salvando...</span>
                                    </>
                                ) : (
                                    <span>Salvar Colheita</span>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Modal de Câmera ao Vivo */}
            {showCameraModal && (
                <LiveCameraModal
                    onCapture={(capturedBase64OrFile) => {
                        setShowCameraModal(false);
                        handleProcessRomaneio(capturedBase64OrFile, 'Foto da Câmera');
                    }}
                    onClose={() => setShowCameraModal(false)}
                />
            )}

            {/* Modal de Visualização de PDF do Romaneio */}
            <PdfViewerModal
                visible={showPdfViewer}
                fileSource={pdfPreviewSource}
                title="Romaneio / Ticket de Pesagem"
                subtitle={talhao ? `Talhão: ${talhao}` : 'Documento de Colheita'}
                badgeText="Romaneio PDF"
                onClose={() => setShowPdfViewer(false)}
            />
        </div>
    );
}
