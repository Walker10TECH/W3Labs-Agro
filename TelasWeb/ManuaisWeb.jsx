// -----------------------------------------------------------------------------
// Manuais.jsx
//
// Módulo de Gestão de Manuais e Documentos.
// Adaptado EXCLUSIVAMENTE PARA WEB.
// Integrado ao Firestore, localStorage (Cache) e otimizado para navegadores.
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig'; // Ajuste o caminho conforme seu projeto

// =====================================================================
// 1️⃣ CONFIGURAÇÕES E TEMA
// =====================================================================

const THEME = {
    primary: '#4CAF50',
    primaryDark: '#388E3C',
    secondary: '#FFFFFF',
    background: '#F9FBF9',
    textBlack: '#2C3329',
    textWhite: '#FFFFFF',
    secondaryText: '#4A4A4A',
    grayInput: '#F0F4F1',
    lightGray: '#E0E0E0',
    error: '#E53935',
};

const MANUAL_CONFIG = {
    maxTitleLength: 100,
    maxDescriptionLength: 500,
    maxFileSize: 950 * 1024, // 950 KB 
    supportedFileTypes: ['application/pdf'],
};

const ASYNC_STORAGE_PDF_KEY_PREFIX = '@manual_pdf_cache:';

const ERROR_MESSAGES = {
    REQUIRED_TITLE: 'Título é obrigatório',
    REQUIRED_FILE: 'É necessário selecionar um PDF ou inserir uma URL',
    INVALID_FILE_TYPE: 'Apenas arquivos PDF são permitidos',
    FILE_TOO_LARGE: `Arquivo muito grande. Máximo de ${Math.floor(MANUAL_CONFIG.maxFileSize / 1024)} KB.`,
    INVALID_URL: 'URL inválida',
};

// =====================================================================
// 2️⃣ ÍCONES SVG INLINE
// =====================================================================
const Icons = {
    ArrowBack: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>),
    Close: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>),
    Add: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>),
    ChevronForward: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>),
    Tractor: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14h2l2-3V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4l3 3h3v2h-2.5"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/></svg>),
    DocumentText: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>),
    DocumentOutline: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>),
    Pencil: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>),
    AlertCircle: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>),
    DocumentAttach: ({ size = 24, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10.5 14.5l-2-2 2-2"/><path d="M13.5 14.5l2-2-2-2"/></svg>)
};

// =====================================================================
// 3️⃣ FUNÇÕES UTILITÁRIAS
// =====================================================================

const validateUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    try {
        const urlObj = new URL(url.trim());
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
        return false;
    }
};

const validateFile = (file) => {
    if (!file) return { isValid: false, error: ERROR_MESSAGES.REQUIRED_FILE };
    if (!MANUAL_CONFIG.supportedFileTypes.includes(file.type)) return { isValid: false, error: ERROR_MESSAGES.INVALID_FILE_TYPE };
    if (file.size && file.size > MANUAL_CONFIG.maxFileSize) return { isValid: false, error: ERROR_MESSAGES.FILE_TOO_LARGE };
    return { isValid: true, error: null };
};

const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

// =====================================================================
// 4️⃣ COMPONENTES DE UI REUTILIZÁVEIS
// =====================================================================

const CustomHeader = ({ title, onBack }) => (
    <div style={styles.fullHeader}>
        <div style={styles.headerContent}>
            {onBack ? (
                <button onClick={onBack} style={styles.backButton}>
                    <Icons.ArrowBack size={26} color={THEME.textWhite} />
                </button>
            ) : <div style={{ width: 36 }} />}
            <span style={styles.headerTitle}>{title}</span>
            <div style={{ width: 36 }} />
        </div>
    </div>
);

const FormInput = ({ label, placeholder, value, onChangeText, error, multiline, type = 'text' }) => (
    <div style={styles.inputContainer}>
        <span style={styles.formLabel}>{label}</span>
        {multiline ? (
            <textarea
                style={{ ...styles.input, height: '80px', resize: 'vertical', ...(error ? styles.inputError : {}) }}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChangeText(e.target.value)}
            />
        ) : (
            <input
                style={{ ...styles.input, ...(error ? styles.inputError : {}) }}
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChangeText(e.target.value)}
            />
        )}
        {error && <span style={styles.errorText}>{error}</span>}
    </div>
);

const FabAdd = ({ onAdd }) => (
    <div style={styles.fabContainer}>
        <button style={styles.fabAdd} onClick={onAdd}>
            <Icons.Add size={28} color={THEME.textWhite} />
        </button>
    </div>
);

// =====================================================================
// 5️⃣ MODAL: ADICIONAR / EDITAR MANUAL
// =====================================================================

const AddOrEditManualItemModal = ({ visible, itemId, categoryId, onClose }) => {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [file, setFile] = useState(null);
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({ titulo: '', descricao: '', arquivoURL: '', arquivoNome: '', arquivoBase64: null });
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            setLoading(true);
            try {
                const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'manualItems', itemId));
                if (docSnap.exists()) setData(docSnap.data());
                else { window.alert('Manual não encontrado.'); onClose(); }
            } catch (error) { console.error(error); }
            setLoading(false);
        })();
    }, [itemId]);

    if (!visible) return null;

    const setField = (field, value) => {
        setData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            const validation = validateFile(selectedFile);
            if (!validation.isValid) return window.alert(validation.error);

            setFile(selectedFile);
            setData(prev => ({ ...prev, arquivoNome: selectedFile.name, arquivoURL: '', arquivoBase64: null }));
            setErrors(prev => ({ ...prev, arquivo: null }));
        }
    };

    const handleSave = async () => {
        const newErrors = {};
        if (!data.titulo.trim()) newErrors.titulo = ERROR_MESSAGES.REQUIRED_TITLE;
        if (!file && !data.arquivoBase64 && !data.arquivoURL?.trim()) newErrors.arquivo = ERROR_MESSAGES.REQUIRED_FILE;
        if (data.arquivoURL?.trim() && !validateUrl(data.arquivoURL)) newErrors.arquivoURL = ERROR_MESSAGES.INVALID_URL;

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return window.alert('Preencha os campos corretamente.');

        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            let fileBase64 = data.arquivoBase64;

            if (file) {
                fileBase64 = await convertFileToBase64(file);
            }

            const id = itemId || doc(collection(db, 'users', uid, 'manualItems')).id;
            const dataToSave = {
                id,
                titulo: data.titulo.trim(),
                descricao: data.descricao.trim(),
                categoryId: categoryId,
                arquivoURL: data.arquivoURL.trim(),
                arquivoNome: file ? file.name : data.arquivoNome,
                arquivoBase64: fileBase64,
            };

            await setDoc(doc(db, 'users', uid, 'manualItems', id), dataToSave, { merge: true });

            if (itemId) window.localStorage.removeItem(`${ASYNC_STORAGE_PDF_KEY_PREFIX}${id}`);

            onClose();
        } catch (e) {
            window.alert("Não foi possível salvar o manual. " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm('Deseja excluir este manual?')) {
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'manualItems', itemId));
            window.localStorage.removeItem(`${ASYNC_STORAGE_PDF_KEY_PREFIX}${itemId}`);
            onClose();
        }
    };

    if (loading) return <div style={styles.modalOverlay}><span style={{ color: '#fff' }}>Carregando...</span></div>;

    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>{itemId ? 'Editar Manual' : 'Inserir Manual'}</span>
                    <button style={styles.closeButton} onClick={onClose}><Icons.Close size={20} color={THEME.textBlack} /></button>
                </div>
                <div style={styles.modalBody}>
                    <FormInput label="Nome / Equipamento *" value={data.titulo} onChangeText={v => setField('titulo', v)} placeholder="Ex: Manual S770" error={errors.titulo} />
                    <FormInput label="Descrição" value={data.descricao} onChangeText={v => setField('descricao', v)} placeholder="Versão, observações..." multiline error={errors.descricao} />

                    <span style={styles.formLabel}>Arquivo PDF *</span>
                    
                    {/* Input de arquivo invisível */}
                    <input type="file" accept="application/pdf" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                    
                    <button style={styles.btnSecondary} onClick={() => fileInputRef.current.click()} disabled={saving}>
                        <div style={{ marginRight: '10px', display: 'flex' }}><Icons.DocumentAttach size={20} color={THEME.primary} /></div>
                        <span style={styles.btnSecondaryText}>{data.arquivoNome || file ? 'Alterar PDF' : 'Selecionar PDF Local'}</span>
                    </button>

                    {(data.arquivoNome || file) && <div style={styles.fileNameText}>Ficheiro: {data.arquivoNome || file?.name}</div>}

                    <div style={styles.orText}>OU</div>

                    <FormInput label="URL do PDF (Externo)" value={data.arquivoURL} onChangeText={v => setField('arquivoURL', v)} placeholder="Cole um link externo" type="url" error={errors.arquivoURL} />
                    {errors.arquivo && <div style={{ ...styles.errorText, textAlign: 'center' }}>{errors.arquivo}</div>}

                    <button style={styles.saveButton} onClick={handleSave} disabled={saving}>
                        <span style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Salvar Manual'}</span>
                    </button>
                    {itemId && (
                        <button style={styles.deleteButton} onClick={handleDelete}>
                            <span style={styles.deleteButtonText}>Excluir Manual</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// =====================================================================
// 6️⃣ TELAS (CATEGORIAS, LISTA DE MANUAIS E VISUALIZADOR)
// =====================================================================

// TELA 1: CATEGORIAS (MARCAS)
const ManuaisListaScreen = ({ onSelectCategory, onBack }) => {
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = collection(db, 'users', auth.currentUser.uid, 'manualCategorias');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.nome.localeCompare(b.nome));
            setCategorias(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <div style={styles.container}>
            <CustomHeader title="Marcas e Categorias" onBack={onBack} />
            <div style={styles.webContainer}>
                <div style={styles.listContainer}>
                    {loading ? <div style={{ marginTop: '50px', color: THEME.primary }}>Carregando...</div>
                        : categorias.length === 0 ? <span style={styles.emptyText}>Nenhuma categoria encontrada.</span>
                            : categorias.map(item => (
                                <button key={item.id} style={styles.listItem} onClick={() => onSelectCategory(item.id, item.nome)}>
                                    {item.imagem ? (
                                        <img src={item.imagem} style={styles.listImage} alt={item.nome} />
                                    ) : (
                                        <div style={styles.listImagePlaceholder}>
                                            <Icons.Tractor size={28} color={THEME.secondaryText} />
                                        </div>
                                    )}
                                    <div style={styles.listContent}>
                                        <span style={styles.listTitle}>{item.nome}</span>
                                    </div>
                                    <Icons.ChevronForward size={24} color={THEME.secondaryText} />
                                </button>
                            ))}
                </div>
            </div>
        </div>
    );
};

// TELA 2: LISTA DE MANUAIS DA CATEGORIA
const ManualItemsListaScreen = ({ categoryId, categoryName, onBack, onViewPdf }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editItemId, setEditItemId] = useState(null);

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, 'users', auth.currentUser.uid, 'manualItems'), where('categoryId', '==', categoryId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.titulo.localeCompare(b.titulo));
            setItems(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [categoryId]);

    const handlePress = (item) => {
        if (item.arquivoBase64 || item.arquivoURL) {
            onViewPdf(item.id, item.titulo);
        } else {
            window.alert("Este item não possui um PDF associado.");
        }
    };

    const handleEdit = (id, e) => {
        if (e) e.stopPropagation();
        setEditItemId(id);
        setModalVisible(true);
    };

    return (
        <div style={styles.container}>
            <CustomHeader title={categoryName} onBack={onBack} />
            <div style={styles.webContainer}>
                <div style={styles.listContainer}>
                    {loading ? <div style={{ marginTop: '50px', color: THEME.primary }}>Carregando...</div>
                        : items.length === 0 ? <span style={styles.emptyText}>Nenhum manual cadastrado nesta marca.</span>
                            : items.map(item => {
                                const hasFile = !!(item.arquivoBase64 || item.arquivoURL);
                                return (
                                    <button key={item.id} style={{ ...styles.listItem, ...(hasFile ? {} : { opacity: 0.6 }) }} onClick={() => handlePress(item)}>
                                        <div style={styles.listIconBox}>
                                            {hasFile ? <Icons.DocumentText size={24} color={THEME.primary} /> : <Icons.DocumentOutline size={24} color={THEME.secondaryText} />}
                                        </div>
                                        <div style={styles.listContent}>
                                            <span style={styles.listTitle}>{item.titulo}</span>
                                            <span style={styles.listSubtitle}>{item.descricao || (hasFile ? 'Visualizar PDF' : 'Sem ficheiro')}</span>
                                        </div>
                                        <div onClick={(e) => handleEdit(item.id, e)} style={{ padding: '10px', display: 'flex', alignItems: 'center' }}>
                                            <Icons.Pencil size={22} color={THEME.secondaryText} />
                                        </div>
                                    </button>
                                );
                            })}
                </div>

                <FabAdd onAdd={() => handleEdit(null)} />

                <AddOrEditManualItemModal
                    visible={modalVisible} itemId={editItemId} categoryId={categoryId}
                    onClose={() => setModalVisible(false)}
                />
            </div>
        </div>
    );
};

// TELA 3: VISUALIZADOR DE PDF NATIVO WEB
const VisualizarPDFScreen = ({ itemId, title, onBack }) => {
    const [pdfSource, setPdfSource] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadPdf = async () => {
            const cacheKey = `${ASYNC_STORAGE_PDF_KEY_PREFIX}${itemId}`;
            try {
                const cachedData = window.localStorage.getItem(cacheKey);
                if (cachedData) {
                    const item = JSON.parse(cachedData);
                    setPdfSource(item.arquivoURL || `data:application/pdf;base64,${item.arquivoBase64}`);
                    setLoading(false);
                    return;
                }

                const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'manualItems', itemId));
                if (!docSnap.exists()) throw new Error('Item não encontrado');

                const item = docSnap.data();
                const sourceUri = item.arquivoURL || `data:application/pdf;base64,${item.arquivoBase64}`;

                if (sourceUri) {
                    setPdfSource(sourceUri);
                    window.localStorage.setItem(cacheKey, JSON.stringify({ arquivoBase64: item.arquivoBase64, arquivoURL: item.arquivoURL }));
                } else throw new Error('PDF Inválido');

            } catch (err) {
                setError(err.message || ERROR_MESSAGES.LOAD_ERROR);
            } finally {
                setLoading(false);
            }
        };
        loadPdf();
    }, [itemId]);

    return (
        <div style={styles.container}>
            <CustomHeader title={title} onBack={onBack} />
            <div style={styles.webContainer}>
                <div style={{ display: 'flex', flex: 1, flexDirection: 'column' }}>
                    {loading ? <div style={styles.center}><span style={{ color: THEME.primary }}>Carregando documento...</span></div>
                        : error ? <div style={styles.center}><Icons.AlertCircle size={48} color={THEME.error} /><span style={styles.emptyText}>{error}</span></div>
                            : <iframe src={pdfSource} style={{ width: '100%', height: '100%', border: 'none', flex: 1 }} title="Visualizador de PDF" />
                    }
                </div>
            </div>
        </div>
    );
};

// =====================================================================
// 7️⃣ COMPONENTE PRINCIPAL (ROTEADOR INTERNO)
// =====================================================================

export default function Manuais({ navigation }) {
    const [route, setRoute] = useState({ name: 'categorias', params: {} }); // 'categorias', 'items', 'pdf'

    if (route.name === 'pdf') {
        return <VisualizarPDFScreen itemId={route.params.itemId} title={route.params.title} onBack={() => { setRoute({ name: 'items', params: { categoryId: route.params.categoryId, categoryName: route.params.categoryName } }); }} />;
    }

    if (route.name === 'items') {
        return <ManualItemsListaScreen categoryId={route.params.categoryId} categoryName={route.params.categoryName} onBack={() => { setRoute({ name: 'categorias', params: {} }); }} onViewPdf={(id, title) => { setRoute({ name: 'pdf', params: { itemId: id, title, categoryId: route.params.categoryId, categoryName: route.params.categoryName } }); }} />;
    }

    return <ManuaisListaScreen onBack={() => { /* Implementar lógica web de volta se necessário, ex: window.history.back() */ }} onSelectCategory={(id, name) => { setRoute({ name: 'items', params: { categoryId: id, categoryName: name } }); }} />;
}

// =====================================================================
// 8️⃣ ESTILOS CSS EM JS
// =====================================================================

const styles = {
    container: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: THEME.background, fontFamily: 'system-ui, -apple-system, sans-serif' },
    webContainer: { display: 'flex', flexDirection: 'column', flex: 1, width: '100%', maxWidth: '800px', margin: '0 auto', position: 'relative' },
    center: { display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },

    // Header
    fullHeader: { backgroundColor: THEME.primary, width: '100%', display: 'flex', justifyContent: 'center' },
    headerContent: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '0 15px', height: '60px', width: '100%', maxWidth: '800px', boxSizing: 'border-box' },
    backButton: { padding: '5px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    headerTitle: { color: THEME.textWhite, fontSize: '22px', fontWeight: 'bold' },

    // Lists
    listContainer: { padding: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', flexGrow: 1, overflowY: 'auto' },
    emptyText: { color: THEME.secondaryText, fontSize: '18px', marginTop: '20px' },
    listItem: { display: 'flex', flexDirection: 'row', backgroundColor: THEME.secondary, width: '100%', padding: '15px', borderRadius: '12px', alignItems: 'center', marginBottom: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', boxSizing: 'border-box', textAlign: 'left', transition: 'background-color 0.2s' },
    listIconBox: { width: '50px', height: '50px', backgroundColor: THEME.grayInput, borderRadius: '25px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: '15px', flexShrink: 0 },
    listImage: { width: '50px', height: '50px', borderRadius: '25px', marginRight: '15px', objectFit: 'contain' },
    listImagePlaceholder: { width: '50px', height: '50px', borderRadius: '25px', backgroundColor: THEME.lightGray, display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: '15px', flexShrink: 0 },
    listContent: { flex: 1, display: 'flex', flexDirection: 'column' },
    listTitle: { fontSize: '20px', fontWeight: 'bold', color: THEME.textBlack, marginBottom: '4px' },
    listSubtitle: { fontSize: '14px', color: THEME.secondaryText },

    // FAB
    fabContainer: { position: 'absolute', right: '20px', bottom: '30px', display: 'flex', alignItems: 'center' },
    fabAdd: { backgroundColor: THEME.primary, width: '55px', height: '55px', borderRadius: '27.5px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer' },

    // Modals & Forms
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', zIndex: 1000 },
    modalContent: { backgroundColor: THEME.secondary, borderRadius: '20px', padding: '20px', width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxSizing: 'border-box' },
    modalHeader: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    modalTitle: { fontSize: '24px', fontWeight: 'bold', color: THEME.textBlack },
    closeButton: { backgroundColor: THEME.grayInput, padding: '6px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    modalBody: { overflowY: 'auto', flex: 1, paddingRight: '5px' },
    
    inputContainer: { marginBottom: '15px', display: 'flex', flexDirection: 'column' },
    formLabel: { fontSize: '16px', color: THEME.secondaryText, marginBottom: '6px', fontWeight: '500', display: 'block' },
    input: { backgroundColor: THEME.grayInput, borderRadius: '8px', padding: '0 15px', height: '50px', fontSize: '16px', color: THEME.textBlack, border: '1px solid transparent', outline: 'none', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit' },
    inputError: { border: `1px solid ${THEME.error}` },
    errorText: { color: THEME.error, fontSize: '12px', marginTop: '4px', display: 'block' },

    // Custom Buttons
    btnSecondary: { backgroundColor: THEME.grayInput, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: '50px', borderRadius: '10px', marginTop: '5px', border: 'none', cursor: 'pointer', width: '100%' },
    btnSecondaryText: { color: THEME.primary, fontWeight: 'bold', fontSize: '16px' },
    saveButton: { backgroundColor: THEME.primary, borderRadius: '8px', height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '15px', marginBottom: '10px', border: 'none', cursor: 'pointer', width: '100%' },
    saveButtonText: { color: THEME.textWhite, fontWeight: 'bold', fontSize: '20px' },
    deleteButton: { backgroundColor: 'transparent', border: `1px solid ${THEME.error}`, borderRadius: '8px', height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px', cursor: 'pointer', width: '100%' },
    deleteButtonText: { color: THEME.error, fontWeight: 'bold', fontSize: '18px' },

    // File Upload UI
    fileNameText: { textAlign: 'center', marginTop: '10px', fontSize: '14px', color: THEME.primaryDark, fontWeight: '600' },
    orText: { textAlign: 'center', margin: '15px 0', color: THEME.secondaryText, fontWeight: 'bold', fontSize: '16px' }
};