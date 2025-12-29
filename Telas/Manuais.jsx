import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    addOrUpdateItem,
    auth,
    db,
    subscribeToCollection
} from '../firebaseConfig';
import * as common from './Common';

// Importação condicional do FileSystem
let FileSystem = null;
try {
    FileSystem = require('expo-file-system');
} catch (error) {
    console.warn('expo-file-system não disponível:', error);
}

// --- CONSTANTES E CONFIGURAÇÕES ---
const MANUAL_CONFIG = {
    maxTitleLength: 100,
    maxDescriptionLength: 500,
    maxFileSize: 750 * 1024 * 1024, // 15MB em bytes
    supportedFileTypes: ['application/pdf'],
    pdfLoadTimeout: 20000,
};

const ERROR_MESSAGES = {
    REQUIRED_TITLE: 'Título é obrigatório',
    REQUIRED_FILE: 'É necessário selecionar um PDF ou inserir uma URL',
    INVALID_FILE_TYPE: 'Apenas arquivos PDF são permitidos',
    FILE_TOO_LARGE: `Arquivo muito grande. Máximo ${MANUAL_CONFIG.maxFileSize / (1024 * 1024)}MB`,
    INVALID_URL: 'URL inválida',
    TITLE_TOO_LONG: `Título deve ter no máximo ${MANUAL_CONFIG.maxTitleLength} caracteres`,
    DESCRIPTION_TOO_LONG: `Descrição deve ter no máximo ${MANUAL_CONFIG.maxDescriptionLength} caracteres`,
    LOAD_ERROR: 'Erro ao carregar documento',
    CORRUPTED_FILE: 'Arquivo corrompido ou inválido',
    CACHE_ERROR: 'Erro ao acessar o cache local.',
    FILESYSTEM_NOT_AVAILABLE: 'Sistema de arquivos não disponível'
};

// Prefixo para as chaves do AsyncStorage para evitar conflitos
const ASYNC_STORAGE_PDF_KEY_PREFIX = '@manual_pdf_cache:';

// --- FUNÇÕES UTILITÁRIAS ---
const validateUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    try {
        const urlObj = new URL(url.trim());
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (error) {
        return false;
    }
};

const validateFile = (file) => {
    if (!file) return { isValid: false, error: ERROR_MESSAGES.REQUIRED_FILE };
    const fileType = file.mimeType || file.type;
    if (!MANUAL_CONFIG.supportedFileTypes.includes(fileType)) {
        return { isValid: false, error: ERROR_MESSAGES.INVALID_FILE_TYPE };
    }
    if (file.size && file.size > MANUAL_CONFIG.maxFileSize) {
        return { isValid: false, error: ERROR_MESSAGES.FILE_TOO_LARGE };
    }
    return { isValid: true, error: null };
};

const validateTextInput = (text, maxLength, required = false) => {
    const sanitized = text ? String(text).trim() : '';
    if (required && !sanitized) {
        return { isValid: false, sanitizedValue: sanitized, error: ERROR_MESSAGES.REQUIRED_TITLE };
    }
    if (sanitized.length > maxLength) {
        const errorKey = maxLength === MANUAL_CONFIG.maxTitleLength ? 'TITLE_TOO_LONG' : 'DESCRIPTION_TOO_LONG';
        return { isValid: false, sanitizedValue: sanitized, error: ERROR_MESSAGES[errorKey] };
    }
    return { isValid: true, sanitizedValue: sanitized, error: null };
};

// Função para converter arquivo para base64 - com suporte web e mobile
const convertFileToBase64 = async (fileUri, file) => {
    try {
        // Para web - usar FileReader
        if (common.Platform.OS === 'web' && file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    // Remove o prefixo "data:application/pdf;base64," se presente
                    const base64 = reader.result.split(',')[1] || reader.result;
                    resolve(base64);
                };
                reader.onerror = () => reject(new Error('Erro ao ler o arquivo'));
                reader.readAsDataURL(file);
            });
        }
        
        // Para mobile - usar expo-file-system
        if (FileSystem && FileSystem.readAsStringAsync && FileSystem.EncodingType) {
            const base64 = await FileSystem.readAsStringAsync(fileUri, { 
                encoding: FileSystem.EncodingType.Base64 
            });
            return base64;
        }
        
        // Fallback - tentar fetch para converter
        if (fileUri) {
            const response = await fetch(fileUri);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result.split(',')[1] || reader.result;
                    resolve(base64);
                };
                reader.onerror = () => reject(new Error('Erro ao converter arquivo'));
                reader.readAsDataURL(blob);
            });
        }
        
        throw new Error('Não foi possível converter o arquivo');
        
    } catch (error) {
        console.error('Erro ao converter arquivo para base64:', error);
        throw new Error('Não foi possível processar o arquivo selecionado');
    }
};

// --- COMPONENTE: LISTA DE CATEGORIAS DE MANUAIS ---
export const ManuaisListaScreen = ({ navigation }) => {
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToCollection('manualCategorias', (data) => {
            const sorted = data.sort((a,b) => a.nome.localeCompare(b.nome));
            setCategorias(sorted);
            if(loading) setLoading(false);
        });
        return () => unsubscribe();
    }, [loading]);

    const renderListItem = useCallback(({ item }) => (
        <common.TouchableOpacity
            style={common.styles.manualsListItem}
            onPress={() => navigation.navigate('ManualItemsLista', { 
                categoryId: item.id, 
                categoryName: item.nome 
            })}
            activeOpacity={0.7}
        >
            {item.imagem ? (
                <common.Image 
                    source={{ uri: item.imagem }} 
                    style={common.styles.manualsListImage} 
                    resizeMode="cover"
                />
            ) : (
                <common.View style={[
                    common.styles.manualsListImage, 
                    { 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        backgroundColor: common.theme.colors.lightGray 
                    }
                ]}>
                    <common.MaterialCommunityIcons 
                        name="book-outline" 
                        size={32} 
                        color={common.theme.colors.secondaryText} 
                    />
                </common.View>
            )}
            <common.Text style={common.styles.manualsListText}>
                {item.nome}
            </common.Text>
            <common.Icon 
                name="chevron-forward" 
                size={24} 
                color={common.theme.colors.alternate} 
            />
        </common.TouchableOpacity>
    ), [navigation]);

    return (
        <common.ScreenLayout
            navigation={navigation}
            screenTitle="Manuais"
            loading={loading}
            items={categorias}
            renderItem={renderListItem}
            emptyMessage="Nenhuma marca encontrada."
        />
    );
};

// --- COMPONENTE: LISTA DE ITENS DE MANUAL ---
export const ManualItemsListaScreen = ({ route, navigation }) => {
    const { categoryId, categoryName } = route.params;
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToCollection('manualItems', (data) => {
            const filteredAndSorted = data
                .filter(item => item.categoryId === categoryId)
                .sort((a,b) => a.titulo.localeCompare(b.titulo));
            setItems(filteredAndSorted);
            if(loading) setLoading(false);
        }, [{field: "categoryId", operator: "==", value: categoryId}]);
        return () => unsubscribe();
    }, [categoryId, loading]);
    
    const handleItemPress = useCallback((item) => {
        if (item.arquivoBase64 || item.arquivoURL) {
            navigation.navigate('VisualizarPDF', { 
                itemId: item.id, 
                title: item.titulo 
            });
        } else {
            common.Alert.alert(
                "Sem PDF", 
                "Este item não possui um PDF associado.",
                [
                    { text: 'OK' }, 
                    { 
                        text: 'Editar', 
                        onPress: () => handleEditPress(null, item) 
                    }
                ]
            );
        }
    }, [navigation]);

    const handleEditPress = useCallback((e, item) => {
        e?.stopPropagation();
        navigation.navigate('AddOrEditManualItem', { 
            itemId: item.id, 
            categoryId 
        });
    }, [navigation, categoryId]);

    const renderManualItem = useCallback(({ item }) => {
        const hasFile = !!(item.arquivoBase64 || item.arquivoURL);
        return (
            <common.TouchableOpacity 
                style={[
                    common.styles.listItemContainer, 
                    !hasFile && { opacity: 0.6 }
                ]} 
                onPress={() => handleItemPress(item)}
            >
                <common.View style={common.styles.listItemIconContainer}>
                    <common.Icon 
                        name={hasFile ? "document-text-outline" : "document-outline"} 
                        size={28} 
                        color={hasFile ? common.theme.colors.primary : common.theme.colors.secondaryText} 
                    />
                </common.View>
                <common.View style={common.styles.listItemContent}>
                    <common.Text style={common.styles.listItemTitle}>
                        {item.titulo}
                    </common.Text>
                    <common.Text style={common.styles.listItemSubtitle}>
                        {item.descricao || (hasFile ? 'Visualizar PDF' : 'Sem ficheiro')}
                    </common.Text>
                </common.View>
                <common.TouchableOpacity 
                    onPress={(e) => handleEditPress(e, item)} 
                    style={{ padding: 8 }}
                >
                    <common.Icon 
                        name="pencil" 
                        size={22} 
                        color={common.theme.colors.secondaryText}
                    />
                </common.TouchableOpacity>
            </common.TouchableOpacity>
        );
    }, [handleItemPress, handleEditPress]);

    return (
        <common.ScreenLayout
            navigation={navigation}
            screenTitle={categoryName}
            fabAction={() => navigation.navigate('AddOrEditManualItem', { categoryId })}
            loading={loading}
            items={items}
            renderItem={renderManualItem}
            emptyMessage="Nenhum manual encontrado para esta marca."
        />
    );
};

// --- COMPONENTE: ADICIONAR/EDITAR MANUAL ---
export const AddOrEditManualItemScreen = ({ route, navigation }) => {
    const { itemId, categoryId } = route.params;
    
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [file, setFile] = useState(null);
    const [rawFile, setRawFile] = useState(null); // Para armazenar o arquivo bruto (web)
    const [errors, setErrors] = useState({});
    const [data, setData] = useState({
        titulo: '',
        descricao: '',
        arquivoURL: '',
        arquivoNome: '',
        arquivoBase64: null,
    });

    const onDrop = useCallback(acceptedFiles => {
        const droppedFile = acceptedFiles[0];
        if (droppedFile) {
            const asset = {
                name: droppedFile.name,
                size: droppedFile.size,
                mimeType: droppedFile.type,
                file: droppedFile, // Arquivo bruto para conversão
                uri: URL.createObjectURL(droppedFile) // URI para conversão
            };

            const validation = validateFile(asset);
            if (!validation.isValid) {
                common.Alert.alert('Ficheiro Inválido', validation.error);
                return;
            }

            setFile(asset);
            setRawFile(asset.file);
            setData(prev => ({ 
                ...prev, 
                arquivoNome: asset.name, 
                arquivoURL: '', 
                arquivoBase64: null 
            }));
            if (errors.arquivo) {
                setErrors(prev => ({ ...prev, arquivo: null }));
            }
        }
    }, [errors.arquivo]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
        onDrop, 
        accept: 'application/pdf',
        multiple: false,
    });

    useEffect(() => {
        if (itemId) {
            const fetchItem = async () => {
                setLoading(true);
                const userUid = auth.currentUser?.uid;
                if (!userUid) return;
                try {
                    const docRef = doc(db, 'users', userUid, 'manualItems', itemId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setData(docSnap.data());
                    } else {
                        common.Alert.alert('Erro', 'Manual não encontrado.');
                        navigation.goBack();
                    }
                } catch (error) {
                    console.error('Erro ao carregar manual:', error);
                } finally {
                    setLoading(false);
                }
            };
            fetchItem();
        }
    }, [itemId, navigation]);

    const setField = useCallback((field, value) => {
        setData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    }, [errors]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        const titleValidation = validateTextInput(data.titulo, MANUAL_CONFIG.maxTitleLength, true);
        if (!titleValidation.isValid) {
            newErrors.titulo = titleValidation.error;
        }
        if (data.descricao) {
            const descriptionValidation = validateTextInput(data.descricao, MANUAL_CONFIG.maxDescriptionLength);
            if (!descriptionValidation.isValid) {
                newErrors.descricao = descriptionValidation.error;
            }
        }
        if (!file && !data.arquivoBase64 && !data.arquivoURL?.trim()) {
            newErrors.arquivo = ERROR_MESSAGES.REQUIRED_FILE;
        }
        if (data.arquivoURL?.trim() && !validateUrl(data.arquivoURL)) {
            newErrors.arquivoURL = ERROR_MESSAGES.INVALID_URL;
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data, file]);

    const pickDocument = useCallback(async () => {
        try {
            if (common.DocumentPicker) {
                const result = await common.DocumentPicker.getDocumentAsync({ 
                    type: 'application/pdf', 
                    copyToCacheDirectory: true 
                });
                if (!result.canceled && result.assets?.[0]) {
                    const asset = result.assets[0];
                    const validation = validateFile(asset);
                    if (!validation.isValid) {
                        return common.Alert.alert('Ficheiro Inválido', validation.error);
                    }
                    setFile(asset);
                    
                    if (common.Platform.OS === 'web' && asset.file) {
                        setRawFile(asset.file);
                    }
                    
                    setData(prev => ({ 
                        ...prev, 
                        arquivoNome: asset.name, 
                        arquivoURL: '', 
                        arquivoBase64: null 
                    }));
                    if (errors.arquivo) {
                        setErrors(prev => ({ ...prev, arquivo: null }));
                    }
                }
            } else {
                common.Alert.alert("Erro", "Seleção de documentos não disponível.");
            }
        } catch (error) {
            console.error('Erro ao selecionar documento:', error);
            common.Alert.alert("Erro", "Não foi possível selecionar o documento.");
        }
    }, [errors.arquivo]);

    const onSave = useCallback(async () => {
        if (!validateForm()) {
            return common.Alert.alert('Erro de Validação', 'Por favor, corrija os campos destacados.');
        }
        
        setSaving(true);
        const id = itemId || doc(collection(db, 'manualItems')).id;
        
        try {
            let fileBase64 = data.arquivoBase64;
            
            if (file) {
                console.log('Convertendo arquivo para base64...');
                fileBase64 = await convertFileToBase64(file.uri, rawFile);
                console.log('Arquivo convertido com sucesso');
            }

            const dataToSave = {
                id,
                titulo: data.titulo.trim(),
                descricao: data.descricao.trim(),
                categoryId: categoryId,
                arquivoURL: data.arquivoURL.trim(),
                arquivoNome: file ? file.name : data.arquivoNome,
                arquivoBase64: fileBase64,
            };

            console.log('Salvando manual...', {
                id,
                titulo: dataToSave.titulo,
                hasBase64: !!dataToSave.arquivoBase64,
                hasURL: !!dataToSave.arquivoURL
            });

            const result = await addOrUpdateItem('manualItems', dataToSave, !!itemId);
            if (result.success) {
                try {
                    await AsyncStorage.removeItem(`${ASYNC_STORAGE_PDF_KEY_PREFIX}${id}`);
                } catch (cacheError) {
                    console.warn('Erro ao limpar cache:', cacheError);
                }
                navigation.goBack();
            } else {
                common.Alert.alert('Erro', 'Não foi possível salvar o manual.');
            }
        } catch (error) {
            console.error("Erro ao salvar manual:", error);
            common.Alert.alert(
                "Erro de Salvamento", 
                `Não foi possível processar ou salvar o ficheiro. ${error.message}`
            );
        } finally {
            setSaving(false);
        }
    }, [validateForm, data, file, rawFile, itemId, categoryId, navigation]);

    const confirmAction = useCallback((title, message, onConfirm) => {
      if (common.Platform.OS === 'web') {
          if (window.confirm(`${title}\n${message}`)) {
              onConfirm();
          }
      } else {
          common.Alert.alert(
              title,
              message,
              [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Confirmar', style: 'destructive', onPress: onConfirm },
              ]
          );
      }
    }, []);
    const onDelete = useCallback(() => {
      const performDelete = () => {
          const onDeletionComplete = async () => {
              try {
                  await AsyncStorage.removeItem(`${ASYNC_STORAGE_PDF_KEY_PREFIX}${itemId}`);
                  navigation.goBack();
              } catch (e) {
                  console.error("Erro ao limpar o cache do manual após a exclusão:", e);
                  common.Alert.alert(
                      "Aviso",
                      "O manual foi excluído, mas houve um erro ao limpar o cache local."
                  );
                  navigation.goBack();
              }
          };
  
          common.handleFirestoreDelete(
              db,
              auth,
              'manualItems',
              itemId,
              `Manual "${data.titulo || 'item'}"`,
              null, // navigation é tratado no onDeletionComplete
              onDeletionComplete
          );
      };
  
      confirmAction("Confirmar Exclusão", `Deseja excluir o manual "${data.titulo || 'item'}"?`, performDelete);
  }, [itemId, data.titulo, navigation]);
    
    if (loading) {
        return (
            <common.ModalFormLayout 
                title="Carregando..." 
                onCancel={() => navigation.goBack()} 
                saving={true}
            >
                <common.View style={common.styles.center}>
                    <common.ActivityIndicator size="large" />
                </common.View>
            </common.ModalFormLayout>
        );
    }

    const dropzoneStyle = {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        borderWidth: 2,
        borderRadius: 2,
        borderColor: '#eeeeee',
        borderStyle: 'dashed',
        backgroundColor: '#fafafa',
        color: '#bdbdbd',
        outline: 'none',
        transition: 'border .24s ease-in-out',
        minHeight: 100,
    };

    return (
        <common.ModalFormLayout 
            title={itemId ? 'Editar Manual' : 'Inserir Manual'} 
            onSubmit={onSave} 
            onCancel={() => navigation.goBack()} 
            saving={saving} 
            onDelete={itemId ? onDelete : null}
        >
            <common.FormInput 
                label="Nome / Equipamento" 
                value={data.titulo} 
                onChangeText={v => setField('titulo', v)} 
                placeholder="Ex: Manual da Colheitadeira S770" 
            />
            {errors.titulo && (
                <common.Text style={common.styles.errorText}>
                    {errors.titulo}
                </common.Text>
            )}
            
            <common.FormInput 
                label="Descrição" 
                value={data.descricao} 
                onChangeText={v => setField('descricao', v)} 
                multiline 
                placeholder="Versão, observações..." 
            />
            {errors.descricao && (
                <common.Text style={common.styles.errorText}>
                    {errors.descricao}
                </common.Text>
            )}
            
            {common.Platform.OS === 'web' ? (
                <common.View {...getRootProps({style: dropzoneStyle})}>
                    <input {...getInputProps()} />
                    <common.Text>
                        {isDragActive ? 
                            'Solte o PDF aqui ...' : 
                            'Arraste e solte o arquivo PDF aqui, ou clique para selecionar'
                        }
                    </common.Text>
                </common.View>
            ) : (
                <common.TouchableOpacity 
                    style={common.styles.selectFileButton} 
                    onPress={pickDocument} 
                    disabled={saving}
                >
                    <common.Icon 
                        name="document-attach-outline" 
                        size={20} 
                        color="white" 
                        style={{ marginRight: 10 }} 
                    />
                    <common.Text style={common.styles.buttonText}>
                        {data.arquivoNome || file ? 'Alterar PDF' : 'Selecionar PDF Local'}
                    </common.Text>
                </common.TouchableOpacity>
            )}
            
            {(data.arquivoNome || file) && (
                <common.Text style={{textAlign: 'center', marginTop: 5}}>
                    Ficheiro: {data.arquivoNome || file.name}
                </common.Text>
            )}
            
            <common.Text style={{ textAlign: 'center', marginVertical: 10 }}>
                OU
            </common.Text>
            
            <common.FormInput 
                label="URL do PDF (Externo)" 
                value={data.arquivoURL} 
                onChangeText={v => setField('arquivoURL', v)} 
                placeholder="Cole um link externo" 
                keyboardType="url" 
            />
            {errors.arquivoURL && (
                <common.Text style={common.styles.errorText}>
                    {errors.arquivoURL}
                </common.Text>
            )}
            
            {errors.arquivo && (
                <common.Text style={[common.styles.errorText, { textAlign: 'center' }]}>
                    {errors.arquivo}
                </common.Text>
            )}
        </common.ModalFormLayout>
    );
};

// --- COMPONENTE: VISUALIZAR PDF ---
export const VisualizarPDFScreen = ({ route, navigation }) => {
    const { itemId, title } = route.params;
    const [pdfSource, setPdfSource] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const loadTimeoutRef = useRef(null);

    const getPdfSource = useCallback((itemData) => {
        if (itemData?.arquivoBase64) {
            const uri = `data:application/pdf;base64,${itemData.arquivoBase64}`;
            return common.Platform.OS === 'web' ? uri : { uri };
        }
        if (itemData?.arquivoURL && validateUrl(itemData.arquivoURL)) {
            const uri = itemData.arquivoURL;
            return common.Platform.OS === 'web' ? uri : { uri };
        }
        return null;
    }, []);

    useEffect(() => {
        const loadPdf = async () => {
            setLoading(true);
            setError(null);
            const cacheKey = `${ASYNC_STORAGE_PDF_KEY_PREFIX}${itemId}`;
            
            loadTimeoutRef.current = setTimeout(() => {
                if(loading) {
                    setError('Tempo limite excedido ao carregar o documento.');
                    setLoading(false);
                }
            }, MANUAL_CONFIG.pdfLoadTimeout);
            
            try {
                // 1. Tenta carregar do cache
                const cachedPdfData = await AsyncStorage.getItem(cacheKey);
                if (cachedPdfData) {
                    console.log(`PDF (ID: ${itemId}) carregado do cache.`);
                    const item = JSON.parse(cachedPdfData);
                    const source = getPdfSource(item);
                    if (source) {
                        setPdfSource(source);
                        setLoading(false);
                        return;
                    }
                }

                // 2. Se não estiver no cache ou for inválido, busca no Firestore
                console.log(`PDF (ID: ${itemId}) não encontrado no cache. Buscando no Firestore.`);
                const userUid = auth.currentUser?.uid;
                if (!userUid) throw new Error("Utilizador não autenticado");
                
                const docRef = doc(db, 'users', userUid, 'manualItems', itemId);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    throw new Error('Item não encontrado no banco de dados');
                }
                
                const item = docSnap.data();
                const source = getPdfSource(item);

                if (source) {
                    setPdfSource(source);
                    // 3. Salva no cache para uso futuro
                    const dataToCache = {
                        arquivoBase64: item.arquivoBase64 || null,
                        arquivoURL: item.arquivoURL || null
                    };
                    await AsyncStorage.setItem(cacheKey, JSON.stringify(dataToCache));
                    console.log(`PDF (ID: ${itemId}) salvo no cache.`);
                } else {
                    throw new Error('Nenhum ficheiro PDF válido encontrado para este item');
                }
                
            } catch (err) {
                console.error("Erro ao carregar PDF:", err);
                setError(err.message || ERROR_MESSAGES.LOAD_ERROR);
            } finally {
                setLoading(false);
                if (loadTimeoutRef.current) {
                    clearTimeout(loadTimeoutRef.current);
                }
            }
        };

        loadPdf();
        return () => {
            if (loadTimeoutRef.current) {
                clearTimeout(loadTimeoutRef.current);
            }
        };
    }, [itemId, getPdfSource]);
    
    if (loading) {
        return (
            <common.View style={common.styles.container}>
                <common.CustomHeader title={title} navigation={navigation} />
                <common.View style={common.styles.center}>
                    <common.ActivityIndicator 
                        color={common.theme.colors.primary} 
                        size="large" 
                    />
                    <common.Text style={{ marginTop: 10 }}>
                        A carregar documento...
                    </common.Text>
                </common.View>
            </common.View>
        );
    }

    if (error || !pdfSource) {
        return (
            <common.View style={common.styles.container}>
                <common.CustomHeader title={title} navigation={navigation} />
                <common.View style={common.styles.center}>
                    {common.MaterialIcons && (
                        <common.MaterialIcons 
                            name="error-outline" 
                            size={48} 
                            color={common.theme.colors.error} 
                        />
                    )}
                    <common.Text style={[
                        common.styles.emptyListText, 
                        { marginTop: 15, paddingHorizontal: 20 }
                    ]}>
                        {error || 'Erro ao carregar documento'}
                    </common.Text>
                </common.View>
            </common.View>
        );
    }

    if (common.Platform.OS === 'web') {
        return (
            <common.View style={common.styles.container}>
                <common.CustomHeader title={title} navigation={navigation} />
                <iframe 
                    src={pdfSource} 
                    style={{ flex: 1, borderWidth: 0 }} 
                    title={title} 
                />
            </common.View>
        );
    }

    return (
        <common.View style={common.styles.container}>
            <common.CustomHeader title={title} navigation={navigation} />
            {common.WebView ? (
                <common.WebView 
                    source={pdfSource} 
                    style={{ flex: 1 }} 
                    originWhitelist={['*']} 
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    startInLoadingState={true}
                />
            ) : (
                <common.View style={common.styles.center}>
                    <common.Text>WebView não disponível</common.Text>
                </common.View>
            )}
        </common.View>
    );
};