import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    setDoc
} from 'firebase/firestore';
import {
    ArrowLeft,
    BookOpen,
    Eye,
    FileText,
    Pencil,
    PlusCircle,
    Search,
    Sparkles,
    Tag,
    Trash2,
    UploadCloud,
    X
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import PdfViewerModal from '../components/PdfViewerModal';
import { auth, db, INITIAL_MANUAL_CATEGORIES, seedInitialFirestoreData } from '../firebaseConfig';
import { analyzeManualFile, fileToBase64 } from '../services/agroDocumentAIService';
import { usePropertyAuth } from '../context/PropertyContext';

const DEFAULT_MARCAS = INITIAL_MANUAL_CATEGORIES.map(c => c.nome);

export default function ManuaisScreen({ navigation }) {
    const { effectiveUid, isAdmin, isMember } = usePropertyAuth();
    const [manuais, setManuais] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('todos'); // 'todos' | 'Tratores' | 'Colheitadeiras' | 'Pulverizadores' | 'Implementos' | 'Agronomia'
    const [selectedMarca, setSelectedMarca] = useState('todas');
    const [marcasList, setMarcasList] = useState(DEFAULT_MARCAS);
    const [searchQuery, setSearchQuery] = useState('');
    const [modal, setModal] = useState({ visible: false, itemId: null });

    // Estado do Visualizador de PDF Embutido
    const [pdfViewer, setPdfViewer] = useState({
        visible: false,
        fileSource: null,
        title: '',
        subtitle: '',
        badgeText: 'Manual PDF'
    });

    useEffect(() => {
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        // Escuta a coleção de manuais
        const qManuais = query(collection(db, 'users', uid, 'manuais'), orderBy('titulo', 'asc'));
        const unsubManuais = onSnapshot(qManuais, (snapshot) => {
            setManuais(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error(err);
            setLoading(false);
        });

        // Escuta as marcas/categorias do Firestore (manualCategorias)
        const qCategorias = query(collection(db, 'users', uid, 'manualCategorias'), orderBy('nome', 'asc'));
        const unsubCategorias = onSnapshot(qCategorias, (snapshot) => {
            if (!snapshot.empty) {
                const fetchedMarcas = snapshot.docs.map(d => d.data().nome).filter(Boolean);
                const merged = Array.from(new Set([...DEFAULT_MARCAS, ...fetchedMarcas]));
                setMarcasList(merged);
            } else {
                if (isAdmin) seedInitialFirestoreData(uid);
                setMarcasList(DEFAULT_MARCAS);
            }
        }, (err) => {
            console.error("Erro ao carregar marcas:", err);
            setMarcasList(DEFAULT_MARCAS);
        });

        return () => {
            unsubManuais();
            unsubCategorias();
        };
    }, [effectiveUid, isAdmin]);

    const filtered = useMemo(() => {
        return manuais.filter(m => {
            const matchTab = activeTab === 'todos' ? true : m.categoria === activeTab;
            const matchMarca = selectedMarca === 'todas' ? true : (m.marca || '').toLowerCase() === selectedMarca.toLowerCase();
            const q = searchQuery.toLowerCase();
            const matchSearch = 
                !searchQuery ||
                m.titulo?.toLowerCase().includes(q) ||
                m.marca?.toLowerCase().includes(q) ||
                m.modelo?.toLowerCase().includes(q) ||
                m.descricao?.toLowerCase().includes(q);

            return matchTab && matchMarca && matchSearch;
        });
    }, [manuais, activeTab, selectedMarca, searchQuery]);

    const handleDelete = async (id) => {
        if (!isAdmin) return;
        if (!window.confirm("Deseja realmente excluir este manual?")) return;
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;
        try {
            await deleteDoc(doc(db, 'users', uid, 'manuais', id));
        } catch (err) {
            console.error(err);
            window.alert("Erro ao excluir manual.");
        }
    };

    const handleOpenPdf = (item) => {
        const source = item.pdfData || item.url;
        if (!source) {
            window.alert("Nenhum arquivo PDF ou link foi anexado a este manual.");
            return;
        }

        setPdfViewer({
            visible: true,
            fileSource: source,
            title: item.titulo || 'Manual de Operação',
            subtitle: `${item.marca || ''} ${item.modelo || ''}`.trim() || 'Guia Técnico Agrícola',
            badgeText: item.categoria || 'PDF'
        });
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
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Biblioteca de Manuais</h1>
                            <p className="text-xs text-slate-500">Catálogos de peças, manuais de operação e guias técnicos</p>
                        </div>
                    </div>

                    {isAdmin ? (
                        <button
                            onClick={() => setModal({ visible: true, itemId: null })}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-950/10"
                        >
                            <PlusCircle size={18} />
                            <span>Novo Manual</span>
                        </button>
                    ) : (
                        <div className="px-3 py-1.5 bg-slate-200/80 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-300">
                            <span>👤 Visualização</span>
                        </div>
                    )}
                </div>

                {/* Filter Bar: Categories, Brands & Search */}
                <div className="space-y-3 mb-6">
                    {/* Category Tabs */}
                    <div className="flex rounded-xl bg-slate-200/80 p-1 w-full overflow-x-auto">
                        {['todos', 'Tratores', 'Colheitadeiras', 'Pulverizadores', 'Implementos', 'Agronomia'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                    activeTab === tab ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {tab === 'todos' ? `Todas Categorias (${manuais.length})` : tab}
                            </button>
                        ))}
                    </div>

                    {/* Brand Selector & Search */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 shrink-0">
                                <Tag size={14} />
                                <span>Marca:</span>
                            </span>
                            <select
                                value={selectedMarca}
                                onChange={(e) => setSelectedMarca(e.target.value)}
                                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 shadow-sm min-w-[150px]"
                            >
                                <option value="todas">Todas as marcas</option>
                                {marcasList.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>

                        <div className="relative w-full sm:w-72">
                            <input
                                type="text"
                                placeholder="Buscar manual, modelo, conteúdo..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-sm"
                            />
                            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                        </div>
                    </div>
                </div>

                {/* List of Manuals */}
                <div className="flex-1">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
                            <span className="text-xs font-semibold text-slate-500">Carregando manuais...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                                <BookOpen size={24} />
                            </div>
                            <h3 className="text-base font-bold text-slate-700">Nenhum manual encontrado</h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                {searchQuery || activeTab !== 'todos' || selectedMarca !== 'todas'
                                    ? 'Nenhum manual corresponde aos filtros aplicados.'
                                    : 'Adicione manuais em PDF ou links técnicos para consulta rápida da sua equipe no campo.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filtered.map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-lg font-bold">
                                                    <FileText size={20} />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                                        {item.categoria || 'Geral'}
                                                    </span>
                                                    <h3 className="text-base font-bold text-slate-800 mt-0.5 group-hover:text-emerald-700 transition-colors">
                                                        {item.titulo}
                                                    </h3>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mb-3">
                                            {item.marca && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-400">Marca:</span>
                                                    <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                                        {item.marca}
                                                    </span>
                                                </div>
                                            )}
                                            {item.modelo && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-400">Modelo:</span>
                                                    <span className="font-semibold text-slate-700">{item.modelo}</span>
                                                </div>
                                            )}
                                        </div>

                                        {item.descricao && (
                                            <p className="text-xs text-slate-500 italic line-clamp-2 mb-2">
                                                "{item.descricao}"
                                            </p>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                                        {isAdmin ? (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setModal({ visible: true, itemId: item.id })}
                                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                                                    title="Editar"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-slate-400 font-semibold">
                                                Somente Leitura
                                            </div>
                                        )}

                                        {item.url || item.pdfData ? (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenPdf(item)}
                                                className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                            >
                                                <Eye size={15} />
                                                <span>Visualizar PDF</span>
                                            </button>
                                        ) : (
                                            <span className="text-[11px] text-slate-400 font-medium">Sem arquivo anexado</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Modal Manual (Apenas Admin pode abrir) */}
                {modal.visible && isAdmin && (
                    <ModalAddOrEditManual
                        itemId={modal.itemId}
                        marcasList={marcasList}
                        effectiveUid={effectiveUid}
                        onClose={() => setModal({ visible: false, itemId: null })}
                        onPreviewPdf={(source, title, brand) => {
                            setPdfViewer({
                                visible: true,
                                fileSource: source,
                                title: title || 'Pré-visualização do Manual',
                                subtitle: brand || 'Documento em edição',
                                badgeText: 'Prévia'
                            });
                        }}
                    />
                )}

                {/* Modal Embutido de Visualização de PDF */}
                <PdfViewerModal
                    visible={pdfViewer.visible}
                    fileSource={pdfViewer.fileSource}
                    title={pdfViewer.title}
                    subtitle={pdfViewer.subtitle}
                    badgeText={pdfViewer.badgeText}
                    onClose={() => setPdfViewer({ visible: false, fileSource: null, title: '', subtitle: '', badgeText: 'PDF' })}
                />

            </div>
        </div>
    );
}

function ModalAddOrEditManual({ itemId, marcasList = DEFAULT_MARCAS, effectiveUid, onClose, onPreviewPdf }) {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [aiLoading, setAiLoading] = useState(false);
    const fileInputRef = useRef(null);

    const [titulo, setTitulo] = useState('');
    const [categoria, setCategoria] = useState('Tratores');
    const [marca, setMarca] = useState(marcasList[0] || 'John Deere');
    const [customMarca, setCustomMarca] = useState('');
    const [modelo, setModelo] = useState('');
    const [url, setUrl] = useState('');
    const [descricao, setDescricao] = useState('');
    const [pdfData, setPdfData] = useState(null);
    const [uploadedFileName, setUploadedFileName] = useState('');

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            const uid = effectiveUid || auth.currentUser?.uid;
            if (!uid) return;
            try {
                const snap = await getDoc(doc(db, 'users', uid, 'manuais', itemId));
                if (snap.exists()) {
                    const d = snap.data();
                    setTitulo(d.titulo || '');
                    setCategoria(d.categoria || 'Tratores');
                    
                    const itemMarca = d.marca || '';
                    const matchBrand = marcasList.find(m => m.toLowerCase() === itemMarca.toLowerCase());
                    if (matchBrand) {
                        setMarca(matchBrand);
                        setCustomMarca('');
                    } else if (itemMarca) {
                        setMarca('Outra');
                        setCustomMarca(itemMarca);
                    } else {
                        setMarca(marcasList[0] || '');
                        setCustomMarca('');
                    }

                    setModelo(d.modelo || '');
                    setUrl(d.url || '');
                    setDescricao(d.descricao || '');
                    setPdfData(d.pdfData || null);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, [itemId, marcasList, effectiveUid]);

    const handleAiFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setAiLoading(true);
        setUploadedFileName(file.name);
        try {
            // Guarda Base64 para visualização local imediata
            const b64 = await fileToBase64(file);
            setPdfData(b64);

            const extracted = await analyzeManualFile(file);
            if (extracted.titulo) setTitulo(extracted.titulo);
            if (extracted.categoria) setCategoria(extracted.categoria);
            if (extracted.modelo) setModelo(extracted.modelo);
            if (extracted.descricao) setDescricao(extracted.descricao);

            if (extracted.marca) {
                const matchBrand = marcasList.find(m => m.toLowerCase() === extracted.marca.toLowerCase());
                if (matchBrand) {
                    setMarca(matchBrand);
                    setCustomMarca('');
                } else {
                    setMarca('Outra');
                    setCustomMarca(extracted.marca);
                }
            }
        } catch (err) {
            console.error("Erro na extração de manual com IA:", err);
            window.alert("Não foi possível analisar o manual via IA: " + (err.message || "Erro desconhecido"));
        } finally {
            setAiLoading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!titulo.trim()) {
            window.alert("Informe o título do manual.");
            return;
        }

        const finalMarca = marca === 'Outra' ? customMarca.trim() : marca.trim();
        if (!finalMarca) {
            window.alert("Selecione ou informe a marca do equipamento.");
            return;
        }

        setSaving(true);
        const uid = effectiveUid || auth.currentUser?.uid;
        if (!uid) return;

        try {
            const docId = itemId || doc(collection(db, 'users', uid, 'manuais')).id;
            const payload = {
                id: docId,
                titulo: titulo.trim(),
                categoria,
                marca: finalMarca,
                modelo: modelo.trim(),
                url: url.trim(),
                descricao: descricao.trim(),
                dataAtualizacao: new Date()
            };

            // Se o PDF em Base64 for menor que 800KB, salva no Firestore para permitir visualização offline
            if (pdfData && pdfData.length < 950000) {
                payload.pdfData = pdfData;
            }

            await setDoc(doc(db, 'users', uid, 'manuais', docId), payload, { merge: true });

            onClose();
        } catch (err) {
            console.error(err);
            window.alert("Erro ao salvar manual.");
        } finally {
            setSaving(false);
        }
    };

    const activePdfSource = pdfData || url;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal">
                <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
                    <span className="font-bold text-base">{itemId ? 'Editar Manual' : 'Novo Manual Técnico'}</span>
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
                        {/* Botão de Preenchimento Automático com IA */}
                        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                    <Sparkles size={16} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-emerald-900 truncate">
                                        {uploadedFileName || 'Preenchimento com IA'}
                                    </span>
                                    <span className="text-[10px] text-emerald-700 truncate">
                                        Envie o PDF ou foto do manual
                                    </span>
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".pdf,image/*"
                                onChange={handleAiFileUpload}
                            />
                            <div className="flex items-center gap-1.5 shrink-0">
                                {activePdfSource && (
                                    <button
                                        type="button"
                                        onClick={() => onPreviewPdf(activePdfSource, titulo, marca)}
                                        className="px-2.5 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                                        title="Visualizar PDF Carregado"
                                    >
                                        <Eye size={14} />
                                        <span>Ver</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    disabled={aiLoading}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    {aiLoading ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Lendo...</span>
                                        </>
                                    ) : (
                                        <>
                                            <UploadCloud size={14} />
                                            <span>Carregar</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Título do Manual / Documento *
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="Ex: Manual de Operação e Manutenção Tratores 6J"
                                value={titulo}
                                onChange={(e) => setTitulo(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 font-medium"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Categoria *
                                </label>
                                <select
                                    value={categoria}
                                    onChange={(e) => setCategoria(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 font-medium"
                                >
                                    <option value="Tratores">Tratores</option>
                                    <option value="Colheitadeiras">Colheitadeiras</option>
                                    <option value="Pulverizadores">Pulverizadores</option>
                                    <option value="Implementos">Implementos / Plantadeiras</option>
                                    <option value="Agronomia">Guia Agronômico / Pragas</option>
                                    <option value="Outro">Outro</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Marca / Fabricante *
                                </label>
                                <select
                                    value={marca}
                                    onChange={(e) => {
                                        setMarca(e.target.value);
                                        if (e.target.value !== 'Outra') {
                                            setCustomMarca('');
                                        }
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 font-medium"
                                >
                                    {marcasList.map((m) => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                    <option value="Outra">Outra marca...</option>
                                </select>
                            </div>
                        </div>

                        {/* Quick-select Brand Pills */}
                        <div>
                            <span className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                                Seleção rápida de marcas:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {marcasList.map((m) => {
                                    const isSelected = marca === m;
                                    return (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => {
                                                setMarca(m);
                                                setCustomMarca('');
                                            }}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                                isSelected
                                                    ? 'bg-emerald-600 text-white shadow-sm'
                                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                            }`}
                                        >
                                            {m}
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => setMarca('Outra')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                        marca === 'Outra'
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    }`}
                                >
                                    + Outra
                                </button>
                            </div>
                        </div>

                        {/* Custom Brand Input (when 'Outra' is selected) */}
                        {marca === 'Outra' && (
                            <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-200/80 animate-fadeIn">
                                <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
                                    Nome da Marca Personalizada *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Fendt, Kuhn, Marchesan..."
                                    value={customMarca}
                                    onChange={(e) => setCustomMarca(e.target.value)}
                                    className="w-full bg-white border border-emerald-300 rounded-xl px-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Modelo do Equipamento
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 6110J, Imperador 4000..."
                                    value={modelo}
                                    onChange={(e) => setModelo(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Link / URL do PDF
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="url"
                                        placeholder="https://..."
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                                    />
                                    {url && (
                                        <button
                                            type="button"
                                            onClick={() => onPreviewPdf(url, titulo, marca)}
                                            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                                            title="Testar e Visualizar URL do PDF"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Descrição / Conteúdo
                            </label>
                            <textarea
                                rows={3}
                                placeholder="Tabelas de calibração, torque dos parafusos, intervalos de troca de óleo..."
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
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
                                {saving ? 'Salvando...' : 'Salvar Manual'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
