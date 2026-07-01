import React, { useState, useEffect, useRef } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';

// Configuração do Firebase
import { auth, db } from '../firebaseConfig';

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
    pdfLoadTimeout: 20000,
};

const ASYNC_STORAGE_PDF_KEY_PREFIX = '@manual_pdf_cache:';

const ERROR_MESSAGES = {
    REQUIRED_TITLE: 'Título é obrigatório',
    REQUIRED_FILE: 'É necessário selecionar um PDF ou inserir uma URL',
    INVALID_FILE_TYPE: 'Apenas arquivos PDF são permitidos',
    FILE_TOO_LARGE: `Arquivo muito grande. Máximo de ${Math.floor(MANUAL_CONFIG.maxFileSize / 1024)} KB.`,
    INVALID_URL: 'URL inválida',
    TITLE_TOO_LONG: `Máximo ${MANUAL_CONFIG.maxTitleLength} caracteres`,
    DESCRIPTION_TOO_LONG: `Máximo ${MANUAL_CONFIG.maxDescriptionLength} caracteres`,
    LOAD_ERROR: 'Erro ao carregar documento',
};

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
    const fileType = file.type;
    if (!MANUAL_CONFIG.supportedFileTypes.includes(fileType)) return { isValid: false, error: ERROR_MESSAGES.INVALID_FILE_TYPE };
    if (file.size && file.size > MANUAL_CONFIG.maxFileSize) return { isValid: false, error: ERROR_MESSAGES.FILE_TOO_LARGE };
    return { isValid: true, error: null };
};

const convertFileToBase64 = async (file) => {
    return new Promise((resolve, reject) => {
        if (!file) return reject(new Error('File object not found'));
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const CustomHeader = ({ title, onBack }) => (
    <div style={styles.header}>
        <div style={styles.headerContent}>
            {onBack ? (
                <button onClick={onBack} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={26} color={THEME.textWhite} />
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
                style={{ ...styles.input, ...( error ? { borderColor: THEME.error, borderWidth: 1 } : {} ), height: 80, resize: 'vertical' }}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChangeText(e.target.value)}
            />
        ) : (
            <input
                type={type}
                style={{ ...styles.input, ...( error ? { borderColor: THEME.error, borderWidth: 1 } : {} ) }}
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
            <Ionicons name="add" size={28} color={THEME.textWhite} />
        </button>
    </div>
);

const Spinner = () => <div className="spinner" style={{width:40,height:40,borderRadius:"50%",border:`4px solid ${THEME.primary}40`,borderTopColor:THEME.primary,animation:"spin 1s linear infinite",margin:"auto"}} />;

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
                else { 
                    window.alert('Manual não encontrado.');
                    onClose(); 
                }
            } catch (error) { console.error(error); }
            setLoading(false);
        })();
    }, [itemId]);

    const setField = (field, value) => {
        setData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const validation = validateFile(selectedFile);
            if (!validation.isValid) {
                window.alert(validation.error);
                return;
            }
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
        if (Object.keys(newErrors).length > 0) {
            window.alert('Preencha os campos corretamente.');
            return;
        }

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

            if (itemId) {
                window.localStorage.removeItem(`${ASYNC_STORAGE_PDF_KEY_PREFIX}${id}`);
            }

            onClose();
        } catch (e) {
            window.alert("Não foi possível salvar o manual. " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        if (window.confirm('Deseja excluir este manual?')) {
            deleteDoc(doc(db, 'users', auth.currentUser.uid, 'manualItems', itemId))
                .then(() => {
                    window.localStorage.removeItem(`${ASYNC_STORAGE_PDF_KEY_PREFIX}${itemId}`);
                    onClose();
                });
        }
    };

    if (!visible) return null;

    if (loading) return <div style={styles.modalOverlay}><Spinner /></div>;

    return (
        <div style={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal-responsive">
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>{itemId ? 'Editar Manual' : 'Inserir Manual'}</span>
                    <button style={styles.closeButton} onClick={onClose}><Ionicons name="close" size={20} color={THEME.textBlack} /></button>
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 80px)' }}>
                    <FormInput label="Nome / Equipamento *" value={data.titulo} onChangeText={v => setField('titulo', v)} placeholder="Ex: Manual S770" error={errors.titulo} />
                    <FormInput label="Descrição" value={data.descricao} onChangeText={v => setField('descricao', v)} placeholder="Versão, observações..." multiline error={errors.descricao} />

                    <span style={styles.formLabel}>Arquivo PDF *</span>
                    <input type="file" accept="application/pdf" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                    <button style={styles.btnSecondary} onClick={() => fileInputRef.current?.click()} disabled={saving}>
                        <Ionicons name="document-attach-outline" size={20} color={THEME.primary} style={{ marginRight: 10 }} />
                        <span style={styles.btnSecondaryText}>{data.arquivoNome || file ? 'Alterar PDF' : 'Selecionar PDF Local'}</span>
                    </button>

                    {(data.arquivoNome || file) && <span style={styles.fileNameText}>Ficheiro: {data.arquivoNome || file?.name}</span>}

                    <div style={styles.orText}>OU</div>

                    <FormInput label="URL do PDF (Externo)" value={data.arquivoURL} onChangeText={v => setField('arquivoURL', v)} placeholder="Cole um link externo" type="url" error={errors.arquivoURL} />
                    {errors.arquivo && <div style={{ ...styles.errorText, textAlign: 'center' }}>{errors.arquivo}</div>}

                    <button style={styles.saveButton} onClick={handleSave} disabled={saving}>
                        {saving ? <Spinner /> : <span style={styles.saveButtonText}>Salvar Manual</span>}
                    </button>
                    {itemId && <button style={styles.deleteButton} onClick={handleDelete}><span style={styles.deleteButtonText}>Excluir Manual</span></button>}
                </div>
            </div>
        </div>
    );
};

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
            <div className="web-container-responsive">
                <CustomHeader title="Marcas e Categorias" onBack={onBack} />
                <div style={styles.listContainer}>
                    {loading ? <Spinner />
                        : categorias.length === 0 ? <span style={styles.emptyText}>Nenhuma categoria encontrada.</span>
                            : (
                                <div className="responsive-grid">
                                    {categorias.map(item => (
                                        <button key={item.id} style={styles.listItem} className="list-item-responsive" onClick={() => onSelectCategory(item.id, item.nome)}>
                                            {item.imagem ? (
                                                <img src={item.imagem} style={styles.listImage} alt={item.nome} />
                                            ) : (
                                                <div style={styles.listImagePlaceholder}>
                                                    <MaterialCommunityIcons name="tractor" size={28} color={THEME.secondaryText} />
                                                </div>
                                            )}
                                            <div style={styles.listContent}>
                                                <span style={styles.listTitle}>{item.nome}</span>
                                            </div>
                                            <Ionicons name="chevron-forward" size={24} color={THEME.secondaryText} />
                                        </button>
                                    ))}
                                </div>
                            )}
                </div>
            </div>
        </div>
    );
};

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
        }
        else {
            window.alert("Este item não possui um PDF associado.");
        }
    };

    const handleEdit = (id) => {
        setEditItemId(id);
        setModalVisible(true);
    };

    return (
        <div style={styles.container}>
            <div className="web-container-responsive">
                <CustomHeader title={categoryName} onBack={onBack} />
                <div style={styles.listContainer}>
                    {loading ? <Spinner />
                        : items.length === 0 ? <span style={styles.emptyText}>Nenhum manual cadastrado nesta marca.</span>
                            : (
                                <div className="responsive-grid">
                                    {items.map(item => {
                                        const hasFile = !!(item.arquivoBase64 || item.arquivoURL);
                                        return (
                                            <div key={item.id} style={{ ...styles.listItem, ...( !hasFile ? { opacity: 0.6 } : {} ) }} className="list-item-responsive">
                                                <button style={{ flex: 1, display: 'flex', alignItems: 'center', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} onClick={() => handlePress(item)}>
                                                    <div style={styles.listIconBox}>
                                                        <Ionicons name={hasFile ? "document-text" : "document-outline"} size={24} color={hasFile ? THEME.primary : THEME.secondaryText} />
                                                    </div>
                                                    <div style={styles.listContent}>
                                                        <span style={styles.listTitle}>{item.titulo}</span>
                                                        <span style={styles.listSubtitle}>{item.descricao || (hasFile ? 'Visualizar PDF' : 'Sem ficheiro')}</span>
                                                    </div>
                                                </button>
                                                <button onClick={() => handleEdit(item.id)} style={{ padding: 10, border: 'none', background: 'none', cursor: 'pointer' }}>
                                                    <Ionicons name="pencil" size={22} color={THEME.secondaryText} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                </div>

                <FabAdd onAdd={() => handleEdit(null)} />

                {modalVisible && (
                    <AddOrEditManualItemModal
                        visible={true} itemId={editItemId} categoryId={categoryId}
                        onClose={() => setModalVisible(false)}
                    />
                )}
            </div>
        </div>
    );
};

const VisualizarPDFScreen = ({ itemId, title, onBack }) => {
    const [pdfSource, setPdfSource] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadPdf = async () => {
            const cacheKey = `${ASYNC_STORAGE_PDF_KEY_PREFIX}${itemId}`;
            try {
                let cachedData = window.localStorage.getItem(cacheKey);

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
                    const cacheValue = JSON.stringify({ arquivoBase64: item.arquivoBase64, arquivoURL: item.arquivoURL });
                    window.localStorage.setItem(cacheKey, cacheValue);
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
            <div className="web-container-responsive" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
                <CustomHeader title={title} onBack={onBack} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {loading ? (
                        <div style={styles.center}><Spinner /></div>
                    ) : error ? (
                        <div style={styles.center}>
                            <Ionicons name="alert-circle" size={48} color={THEME.error} />
                            <span style={styles.emptyText}>{error}</span>
                        </div>
                    ) : (
                        <iframe
                            src={pdfSource}
                            style={{ flex: 1, width: '100%', height: '100%', border: 'none' }}
                            title="Visualizador de PDF"
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default function Manuais({ navigation }) {
    const [route, setRoute] = useState({ name: 'categorias', params: {} }); // 'categorias', 'items', 'pdf'

    useEffect(() => {
        if (typeof document !== 'undefined' && !document.getElementById('w3-agro-styles')) {
            const style = document.createElement('style');
            style.id = 'w3-agro-styles';
            style.innerHTML = `
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                * { box-sizing: border-box; }
                button { border: none; outline: none; cursor: pointer; background: transparent; padding: 0; }
                input, textarea, select { border: none; outline: none; font-family: inherit; }
                textarea { resize: vertical; }
                .responsive-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 15px;
                    width: 100%;
                }
                .modal-responsive {
                    background-color: ${THEME.secondary};
                    border-top-left-radius: 20px;
                    border-top-right-radius: 20px;
                    padding: 20px;
                    max-height: 90vh;
                    width: 100%;
                    max-width: 800px;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }
                .web-container-responsive {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    width: 100%;
                    max-width: 800px;
                    align-self: center;
                    margin: 0 auto;
                    position: relative;
                }
                @media (min-width: 768px) {
                    .responsive-grid { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
                    .list-item-responsive { max-width: 100% !important; margin: 0 !important; }
                    .web-container-responsive { max-width: 1200px !important; }
                    .modal-responsive { border-radius: 20px; align-self: center; margin-bottom: 5vh; }
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    if (route.name === 'pdf') {
        return <VisualizarPDFScreen itemId={route.params.itemId} title={route.params.title} onBack={() => { setRoute({ name: 'items', params: { categoryId: route.params.categoryId, categoryName: route.params.categoryName } }); }} />;
    }

    if (route.name === 'items') {
        return <ManualItemsListaScreen categoryId={route.params.categoryId} categoryName={route.params.categoryName} onBack={() => { setRoute({ name: 'categorias', params: {} }); }} onViewPdf={(id, title) => { setRoute({ name: 'pdf', params: { itemId: id, title, categoryId: route.params.categoryId, categoryName: route.params.categoryName } }); }} />;
    }

    return <ManuaisListaScreen onBack={() => { if (navigation?.goBack) navigation.goBack(); else window.history.back(); }} onSelectCategory={(id, name) => { setRoute({ name: 'items', params: { categoryId: id, categoryName: name } }); }} />;
}

const styles = {
    container: { display: 'flex', flexDirection: 'column', flex: 1, backgroundColor: THEME.background, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' },
    center: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },

    // Header
    header: { backgroundColor: THEME.primary, width: '100%', display: 'flex', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 10 },
    headerContent: { width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '0 15px', height: 60, boxSizing: 'border-box' },
    backButton: { padding: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer' },
    headerTitle: { color: THEME.textWhite, fontSize: 20, fontWeight: 'bold' },

    // Lists
    listContainer: { padding: 15, display: 'flex', flexDirection: 'column', alignItems: 'center', flexGrow: 1 },
    emptyText: { color: THEME.secondaryText, fontSize: 16, marginTop: 20, textAlign: 'center' },
    listItem: { display: 'flex', flexDirection: 'row', backgroundColor: THEME.secondary, padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer', border: 'none', textAlign: 'left', boxSizing: 'border-box', width: '100%' },
    listIconBox: { width: 50, height: 50, backgroundColor: THEME.grayInput, borderRadius: 25, display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: 15, flexShrink: 0 },
    listImage: { width: 50, height: 50, borderRadius: 25, marginRight: 15, objectFit: 'contain' },
    listImagePlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: THEME.lightGray, display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: 15, flexShrink: 0 },
    listContent: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
    listTitle: { fontSize: 18, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 4 },
    listSubtitle: { fontSize: 14, color: THEME.secondaryText },

    // FAB
    fabContainer: { position: 'absolute', right: 20, bottom: 30, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' },
    fabAdd: { backgroundColor: THEME.primary, width: 55, height: 55, borderRadius: 27.5, display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer' },

    // Modals & Forms
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 1000 },
    modalHeader: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: THEME.textBlack },
    closeButton: { backgroundColor: THEME.grayInput, padding: 6, borderRadius: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', border: 'none', cursor: 'pointer' },
    
    inputContainer: { marginBottom: 15, display: 'flex', flexDirection: 'column' },
    formLabel: { fontSize: 15, color: THEME.secondaryText, marginBottom: 6, fontWeight: '500' },
    input: { backgroundColor: THEME.grayInput, borderRadius: 8, padding: '0 15px', height: 50, fontSize: 16, color: THEME.textBlack, border: '1px solid transparent', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit' },
    errorText: { color: THEME.error, fontSize: 12, marginTop: 4 },

    // Custom Buttons
    btnSecondary: { backgroundColor: THEME.grayInput, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 10, marginTop: 5, border: 'none', cursor: 'pointer', width: '100%' },
    btnSecondaryText: { color: THEME.primary, fontWeight: 'bold', fontSize: 16 },
    saveButton: { backgroundColor: THEME.primary, borderRadius: 8, height: 50, display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 15, marginBottom: 10, border: 'none', cursor: 'pointer', width: '100%' },
    saveButtonText: { color: THEME.textWhite, fontWeight: 'bold', fontSize: 18 },
    deleteButton: { backgroundColor: 'transparent', borderColor: THEME.error, borderWidth: 1, borderStyle: 'solid', borderRadius: 8, height: 50, display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 10, cursor: 'pointer', width: '100%' },
    deleteButtonText: { color: THEME.error, fontWeight: 'bold', fontSize: 16 },

    // File Upload UI
    fileNameText: { textAlign: 'center', marginTop: 10, fontSize: 14, color: THEME.primaryDark, fontWeight: '600' },
    orText: { textAlign: 'center', margin: '15px 0', color: THEME.secondaryText, fontWeight: 'bold', fontSize: 16 }
};
