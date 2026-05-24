// -----------------------------------------------------------------------------
// Manuais.jsx
//
// Módulo de Gestão de Manuais e Documentos.
// Integrado ao Firestore, AsyncStorage (Cache) e otimizado exclusivamente
// para Mobile (DocumentPicker, FileSystem e WebView).
// -----------------------------------------------------------------------------
import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    Modal,
    TextInput,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    Image,
    LayoutAnimation,
    UIManager
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { WebView } from 'react-native-webview';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Firebase
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

// =====================================================================
// 2️⃣ FUNÇÕES UTILITÁRIAS
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
    const fileType = file.mimeType || file.type;
    if (!MANUAL_CONFIG.supportedFileTypes.includes(fileType)) return { isValid: false, error: ERROR_MESSAGES.INVALID_FILE_TYPE };
    if (file.size && file.size > MANUAL_CONFIG.maxFileSize) return { isValid: false, error: ERROR_MESSAGES.FILE_TOO_LARGE };
    return { isValid: true, error: null };
};

const convertFileToBase64 = async (fileUri) => {
    try {
        return await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
    } catch (error) {
        throw new Error('Não foi possível processar o arquivo selecionado');
    }
};

// =====================================================================
// 3️⃣ COMPONENTES DE UI REUTILIZÁVEIS
// =====================================================================

const CustomHeader = ({ title, onBack }) => (
    <View style={styles.header}>
        {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={26} color={THEME.textWhite} />
            </TouchableOpacity>
        ) : <View style={{ width: 36 }} />}
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 36 }} />
    </View>
);

const FormInput = ({ label, placeholder, value, onChangeText, error, multiline, keyboardType = 'default' }) => (
    <View style={styles.inputContainer}>
        <Text style={styles.formLabel}>{label}</Text>
        <TextInput
            style={[styles.input, error && { borderColor: THEME.error, borderWidth: 1 }, multiline && { height: 80, textAlignVertical: 'top' }]}
            placeholder={placeholder}
            placeholderTextColor={THEME.secondaryText}
            value={value}
            onChangeText={onChangeText}
            multiline={multiline}
            keyboardType={keyboardType}
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
);

const FabAdd = ({ onAdd }) => (
    <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fabAdd} onPress={onAdd}>
            <Ionicons name="add" size={28} color={THEME.textWhite} />
        </TouchableOpacity>
    </View>
);

// =====================================================================
// 4️⃣ MODAL: ADICIONAR / EDITAR MANUAL
// =====================================================================

const AddOrEditManualItemModal = ({ visible, itemId, categoryId, onClose }) => {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [file, setFile] = useState(null);
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({ titulo: '', descricao: '', arquivoURL: '', arquivoNome: '', arquivoBase64: null });

    // Busca manual existente
    useEffect(() => {
        if (!itemId) return;
        (async () => {
            setLoading(true);
            try {
                const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'manualItems', itemId));
                if (docSnap.exists()) setData(docSnap.data());
                else { Alert.alert('Erro', 'Manual não encontrado.'); onClose(); }
            } catch (error) { console.error(error); }
            setLoading(false);
        })();
    }, [itemId]);

    const setField = (field, value) => {
        setData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
            if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                const validation = validateFile(asset);
                if (!validation.isValid) return Alert.alert('Ficheiro Inválido', validation.error);

                setFile(asset);
                setData(prev => ({ ...prev, arquivoNome: asset.name, arquivoURL: '', arquivoBase64: null }));
                setErrors(prev => ({ ...prev, arquivo: null }));
            }
        } catch (error) { Alert.alert("Erro", "Não foi possível selecionar o documento."); }
    };

    const handleSave = async () => {
        const newErrors = {};
        if (!data.titulo.trim()) newErrors.titulo = ERROR_MESSAGES.REQUIRED_TITLE;
        if (!file && !data.arquivoBase64 && !data.arquivoURL?.trim()) newErrors.arquivo = ERROR_MESSAGES.REQUIRED_FILE;
        if (data.arquivoURL?.trim() && !validateUrl(data.arquivoURL)) newErrors.arquivoURL = ERROR_MESSAGES.INVALID_URL;

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return Alert.alert('Erro', 'Preencha os campos corretamente.');

        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            let fileBase64 = data.arquivoBase64;

            if (file) {
                fileBase64 = await convertFileToBase64(file.uri);
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

            // Limpa cache se existia
            if (itemId) await AsyncStorage.removeItem(`${ASYNC_STORAGE_PDF_KEY_PREFIX}${id}`);

            onClose();
        } catch (e) {
            Alert.alert("Erro", "Não foi possível salvar o manual. " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert('Excluir', 'Deseja excluir este manual?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Excluir',
                style: 'destructive',
                onPress: async () => {
                    await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'manualItems', itemId));
                    await AsyncStorage.removeItem(`${ASYNC_STORAGE_PDF_KEY_PREFIX}${itemId}`);
                    onClose();
                }
            }
        ]);
    };

    if (loading) return <Modal visible transparent><View style={styles.modalOverlay}><ActivityIndicator size="large" color={THEME.primary} /></View></Modal>;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{itemId ? 'Editar Manual' : 'Inserir Manual'}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Ionicons name="close" size={20} color={THEME.textBlack} /></TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <FormInput label="Nome / Equipamento *" value={data.titulo} onChangeText={v => setField('titulo', v)} placeholder="Ex: Manual S770" error={errors.titulo} />
                        <FormInput label="Descrição" value={data.descricao} onChangeText={v => setField('descricao', v)} placeholder="Versão, observações..." multiline error={errors.descricao} />

                        <Text style={styles.formLabel}>Arquivo PDF *</Text>
                        <TouchableOpacity style={styles.btnSecondary} onPress={pickDocument} disabled={saving}>
                            <Ionicons name="document-attach-outline" size={20} color={THEME.primary} style={{ marginRight: 10 }} />
                            <Text style={styles.btnSecondaryText}>{data.arquivoNome || file ? 'Alterar PDF' : 'Selecionar PDF Local'}</Text>
                        </TouchableOpacity>

                        {(data.arquivoNome || file) && <Text style={styles.fileNameText}>Ficheiro: {data.arquivoNome || file?.name}</Text>}

                        <Text style={styles.orText}>OU</Text>

                        <FormInput label="URL do PDF (Externo)" value={data.arquivoURL} onChangeText={v => setField('arquivoURL', v)} placeholder="Cole um link externo" keyboardType="url" error={errors.arquivoURL} />
                        {errors.arquivo && <Text style={[styles.errorText, { textAlign: 'center' }]}>{errors.arquivo}</Text>}

                        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={THEME.textWhite} /> : <Text style={styles.saveButtonText}>Salvar Manual</Text>}
                        </TouchableOpacity>
                        {itemId && <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}><Text style={styles.deleteButtonText}>Excluir Manual</Text></TouchableOpacity>}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// =====================================================================
// 5️⃣ TELAS (CATEGORIAS, LISTA DE MANUAIS E VISUALIZADOR)
// =====================================================================

// TELA 1: CATEGORIAS (MARCAS)
const ManuaisListaScreen = ({ onSelectCategory, onBack }) => {
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);

    const triggerAnimation = () => {
        if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = collection(db, 'users', auth.currentUser.uid, 'manualCategorias');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.nome.localeCompare(b.nome));
            triggerAnimation();
            setCategorias(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.webContainer}>
            <CustomHeader title="Marcas e Categorias" onBack={onBack} />
            <ScrollView contentContainerStyle={styles.listContainer}>
                {loading ? <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
                    : categorias.length === 0 ? <Text style={styles.emptyText}>Nenhuma categoria encontrada.</Text>
                        : categorias.map(item => (
                            <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => { triggerAnimation(); onSelectCategory(item.id, item.nome); }}>
                                {item.imagem ? (
                                    <Image source={{ uri: item.imagem }} style={styles.listImage} resizeMode="contain" />
                                ) : (
                                    <View style={styles.listImagePlaceholder}>
                                        <MaterialCommunityIcons name="tractor" size={28} color={THEME.secondaryText} />
                                    </View>
                                )}
                                <View style={styles.listContent}>
                                    <Text style={styles.listTitle}>{item.nome}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={24} color={THEME.secondaryText} />
                            </TouchableOpacity>
                        ))}
            </ScrollView>
            </View>
        </SafeAreaView>
    );
};

// TELA 2: LISTA DE MANUAIS DA CATEGORIA
const ManualItemsListaScreen = ({ categoryId, categoryName, onBack, onViewPdf }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editItemId, setEditItemId] = useState(null);

    const triggerAnimation = () => {
        if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, 'users', auth.currentUser.uid, 'manualItems'), where('categoryId', '==', categoryId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.titulo.localeCompare(b.titulo));
            triggerAnimation();
            setItems(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [categoryId]);

    const handlePress = (item) => {
        if (item.arquivoBase64 || item.arquivoURL) {
            triggerAnimation();
            onViewPdf(item.id, item.titulo);
        }
        else Alert.alert("Sem PDF", "Este item não possui um PDF associado.");
    };

    const handleEdit = (id) => {
        triggerAnimation();
        setEditItemId(id);
        setModalVisible(true);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.webContainer}>
            <CustomHeader title={categoryName} onBack={onBack} />
            <ScrollView contentContainerStyle={styles.listContainer}>
                {loading ? <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
                    : items.length === 0 ? <Text style={styles.emptyText}>Nenhum manual cadastrado nesta marca.</Text>
                        : items.map(item => {
                            const hasFile = !!(item.arquivoBase64 || item.arquivoURL);
                            return (
                                <TouchableOpacity key={item.id} style={[styles.listItem, !hasFile && { opacity: 0.6 }]} onPress={() => handlePress(item)}>
                                    <View style={styles.listIconBox}>
                                        <Ionicons name={hasFile ? "document-text" : "document-outline"} size={24} color={hasFile ? THEME.primary : THEME.secondaryText} />
                                    </View>
                                    <View style={styles.listContent}>
                                        <Text style={styles.listTitle}>{item.titulo}</Text>
                                        <Text style={styles.listSubtitle}>{item.descricao || (hasFile ? 'Visualizar PDF' : 'Sem ficheiro')}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleEdit(item.id)} style={{ padding: 10 }}>
                                        <Ionicons name="pencil" size={22} color={THEME.secondaryText} />
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            );
                        })}
            </ScrollView>

            <FabAdd onAdd={() => handleEdit(null)} />

            {modalVisible && (
                <AddOrEditManualItemModal
                    visible={true} itemId={editItemId} categoryId={categoryId}
                    onClose={() => setModalVisible(false)}
                />
            )}
            </View>
        </SafeAreaView>
    );
};

// TELA 3: VISUALIZADOR DE PDF
const VisualizarPDFScreen = ({ itemId, title, onBack }) => {
    const [pdfSource, setPdfSource] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadPdf = async () => {
            const cacheKey = `${ASYNC_STORAGE_PDF_KEY_PREFIX}${itemId}`;
            try {
                const cachedData = await AsyncStorage.getItem(cacheKey);
                if (cachedData) {
                    const item = JSON.parse(cachedData);
                    setPdfSource({ uri: item.arquivoURL || `data:application/pdf;base64,${item.arquivoBase64}` });
                    setLoading(false);
                    return;
                }

                const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'manualItems', itemId));
                if (!docSnap.exists()) throw new Error('Item não encontrado');

                const item = docSnap.data();
                const source = { uri: item.arquivoURL || `data:application/pdf;base64,${item.arquivoBase64}` };

                if (source.uri) {
                    setPdfSource(source);
                    await AsyncStorage.setItem(cacheKey, JSON.stringify({ arquivoBase64: item.arquivoBase64, arquivoURL: item.arquivoURL }));
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
        <SafeAreaView style={styles.container}>
            <View style={styles.webContainer}>
            <CustomHeader title={title} onBack={onBack} />
            <View style={{ flex: 1 }}>
                {loading ? <View style={styles.center}><ActivityIndicator size="large" color={THEME.primary} /></View>
                    : error ? <View style={styles.center}><Ionicons name="alert-circle-outline" size={48} color={THEME.error} /><Text style={styles.emptyText}>{error}</Text></View>
                        : <WebView source={pdfSource} style={{ flex: 1 }} originWhitelist={['*']} javaScriptEnabled domStorageEnabled />
                }
            </View>
            </View>
        </SafeAreaView>
    );
};

// =====================================================================
// 6️⃣ COMPONENTE PRINCIPAL (ROTEADOR INTERNO)
// =====================================================================

export default function Manuais({ navigation }) {
    const [route, setRoute] = useState({ name: 'categorias', params: {} }); // 'categorias', 'items', 'pdf'

    const triggerAnimation = () => {
        if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    if (route.name === 'pdf') {
        return <VisualizarPDFScreen itemId={route.params.itemId} title={route.params.title} onBack={() => { triggerAnimation(); setRoute({ name: 'items', params: { categoryId: route.params.categoryId, categoryName: route.params.categoryName } }); }} />;
    }

    if (route.name === 'items') {
        return <ManualItemsListaScreen categoryId={route.params.categoryId} categoryName={route.params.categoryName} onBack={() => { triggerAnimation(); setRoute({ name: 'categorias', params: {} }); }} onViewPdf={(id, title) => { triggerAnimation(); setRoute({ name: 'pdf', params: { itemId: id, title, categoryId: route.params.categoryId, categoryName: route.params.categoryName } }); }} />;
    }

    return <ManuaisListaScreen onBack={() => navigation.goBack()} onSelectCategory={(id, name) => { triggerAnimation(); setRoute({ name: 'items', params: { categoryId: id, categoryName: name } }); }} />;
}

// =====================================================================
// 7️⃣ ESTILOS GERAIS
// =====================================================================

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    webContainer: {
        flex: 1,
        width: '100%',
        maxWidth: 800,
        alignSelf: 'center',
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    header: { backgroundColor: THEME.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 60, ...Platform.select({ android: { marginTop: 24 } }) },
    backButton: { padding: 5 },
    headerTitle: { color: THEME.textWhite, fontSize: 22, fontWeight: 'bold' },

    // Lists
    listContainer: { padding: 15, alignItems: 'center', flexGrow: 1 },
    emptyText: { color: THEME.secondaryText, fontSize: 18, marginTop: 20 },
    listItem: { flexDirection: 'row', backgroundColor: THEME.secondary, width: '100%', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10, ...Platform.select({ web: { boxShadow: '0px 2px 3px rgba(0,0,0,0.05)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 } }), elevation: 2 },
    listIconBox: { width: 50, height: 50, backgroundColor: THEME.grayInput, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    listImage: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
    listImagePlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: THEME.lightGray, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    listContent: { flex: 1 },
    listTitle: { fontSize: 20, fontWeight: 'bold', color: THEME.textBlack, marginBottom: 4 },
    listSubtitle: { fontSize: 16, color: THEME.secondaryText },

    // FAB
    fabContainer: { position: 'absolute', right: 20, bottom: 30, alignItems: 'center' },
    fabAdd: { backgroundColor: THEME.primary, width: 55, height: 55, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },

    // Modals & Forms
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: THEME.secondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%', width: '100%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 24, fontWeight: 'bold', color: THEME.textBlack },
    closeButton: { backgroundColor: THEME.grayInput, padding: 6, borderRadius: 8 },
    inputContainer: { marginBottom: 15 },
    formLabel: { fontSize: 16, color: THEME.secondaryText, marginBottom: 6, fontWeight: '500' },
    input: { backgroundColor: THEME.grayInput, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, height: 60, fontSize: 18, color: THEME.textBlack },
    errorText: { color: THEME.error, fontSize: 11, marginTop: 4 },

    // Custom Buttons
    btnSecondary: { backgroundColor: THEME.grayInput, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60, borderRadius: 10, marginTop: 5 },
    btnSecondaryText: { color: THEME.primary, fontWeight: 'bold', fontSize: 18 },
    saveButton: { backgroundColor: THEME.primary, borderRadius: 8, height: 60, justifyContent: 'center', alignItems: 'center', marginTop: 15, marginBottom: 10 },
    saveButtonText: { color: THEME.textWhite, fontWeight: 'bold', fontSize: 20 },
    deleteButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: THEME.error, borderRadius: 8, height: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    deleteButtonText: { color: THEME.error, fontWeight: 'bold', fontSize: 18 },

    // File Upload UI
    fileNameText: { textAlign: 'center', marginTop: 10, fontSize: 16, color: THEME.primaryDark, fontWeight: '600' },
    orText: { textAlign: 'center', marginVertical: 15, color: THEME.secondaryText, fontWeight: 'bold', fontSize: 18 }
});