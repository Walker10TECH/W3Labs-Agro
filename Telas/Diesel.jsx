import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import * as common from './Common';

// --- CONSTANTES E UTILITÁRIOS ---

/**
 * Limites de validação para garantir a integridade dos dados e evitar inputs maliciosos ou errôneos.
 */
const VALIDATION_LIMITS = {
    MAX_LITROS_ENTRADA: 50000,
    MAX_LITROS_SAIDA: 2000,
    MAX_STRING_LENGTH: 255,
    MAX_ODOMETRO: 999999,
};

const CONTAINS_ONLY_NUMBERS_REGEX = /^\d+$/;

// --- HOOKS CUSTOMIZADOS ---

/**
 * Hook para sincronização em tempo real com coleções do Firestore.
 * Garante que a UI esteja sempre atualizada com o estado do servidor.
 */
const useFirestoreCollection = (collectionName, options = {}) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!auth.currentUser) {
            setLoading(false);
            return;
        }

        const userId = auth.currentUser.uid;
        const collectionPath = `users/${userId}/${collectionName}`;        
        
        const q = query(
            collection(db, collectionPath),
            orderBy(options.sortBy || 'data', options.order || 'desc')
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const data = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Normalização: Converte Timestamps do Firestore para Date nativo do JS
                data: doc.data().data?.toDate ? doc.data().data.toDate() : null,
            }));
            setItems(data);
            setLoading(false);
        }, (err) => {
            console.error(`Error fetching ${collectionName}:`, err);
            setError(err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [collectionName, options.sortBy, options.order]);

    return { items, loading, error };
};

// --- COMPONENTES DE MODAL (LOGIC & UI) ---

/**
 * Modal para registro de ENTRADA de estoque (Compra de Diesel).
 */
const AddEstoqueDieselModal = ({ onClose, onSaveSuccess }) => {
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState({ 
        litros: '', 
        data: new Date(),
        observacoes: '',
        fornecedor: ''
    });
    const [errors, setErrors] = useState({});

    const setField = useCallback((field, value, type = 'text') => {
        let processedValue = value;
        if (type === 'numeric') {
            processedValue = value.replace(/[^0-9,.]/g, '');
        }
        setData(prev => ({ ...prev, [field]: processedValue }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    }, [errors]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        const litrosNum = parseFloat(String(data.litros).replace(',', '.'));
        
        if (!data.litros || isNaN(litrosNum) || litrosNum <= 0) {
            newErrors.litros = 'Quantidade é obrigatória e deve ser maior que zero.';
        } else if (litrosNum > VALIDATION_LIMITS.MAX_LITROS_ENTRADA) {
            newErrors.litros = `Valor muito alto. Máximo permitido: ${VALIDATION_LIMITS.MAX_LITROS_ENTRADA} L.`;
        }
        
        if (!data.data) {
            newErrors.data = 'Data é obrigatória.';
        } else if (data.data > new Date()) {
            newErrors.data = 'A data não pode ser no futuro.';
        }

        if (data.fornecedor.trim() && CONTAINS_ONLY_NUMBERS_REGEX.test(data.fornecedor.trim())) {
            newErrors.fornecedor = 'O nome do fornecedor não pode conter apenas números.';
        } else if (data.fornecedor.length > VALIDATION_LIMITS.MAX_STRING_LENGTH) {
            newErrors.fornecedor = `Máximo de ${VALIDATION_LIMITS.MAX_STRING_LENGTH} caracteres.`;
        }

        if (data.observacoes.length > VALIDATION_LIMITS.MAX_STRING_LENGTH) {
            newErrors.observacoes = `Máximo de ${VALIDATION_LIMITS.MAX_STRING_LENGTH} caracteres.`;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data]);

    const onSave = async () => {
        if (!validateForm()) {
            common.Alert.alert("Erro de Validação", "Por favor, corrija os campos destacados.");
            return;
        }
        if (!auth.currentUser) {
            common.Alert.alert("Erro", "Você precisa estar logado para salvar.");
            return;
        }

        setSaving(true);
        try {
            const litrosNum = parseFloat(String(data.litros).replace(',', '.'));
            const userId = auth.currentUser.uid;
            const docRef = doc(collection(db, `users/${userId}/dieselEstoque`));
            
            await setDoc(docRef, {
                litros: litrosNum,
                data: data.data,
                observacoes: data.observacoes.trim(),
                fornecedor: data.fornecedor.trim(),
                tipo: 'entrada',
                createdAt: serverTimestamp(),
                userId: userId,
            });

            onSaveSuccess();
        } catch (error) {
            console.error('Error saving diesel stock to Firestore:', error);
            common.Alert.alert("Erro", "Não foi possível salvar o estoque. Tente novamente.");
        } finally {
            setSaving(false);
        }
    };
    
    return (
        <common.ModalFormLayout
            title="Adicionar Estoque de Diesel"
            onSubmit={onSave}
            onCancel={onClose}
            saving={saving}
            submitText="Adicionar"
        >
            <common.FormInput 
                label="Litros *" 
                value={String(data.litros)} 
                onChangeText={v => setField('litros', v, 'numeric')} 
                keyboardType="numeric" 
                placeholder="Ex: 1000"
                containerStyle={errors.litros && { borderColor: common.theme.colors.error }}
            />
            {errors.litros && <common.Text style={common.styles.errorText}>{errors.litros}</common.Text>}
            
            <common.FormInput 
                label="Fornecedor" 
                value={data.fornecedor} 
                onChangeText={v => setField('fornecedor', v)} 
                placeholder="Nome do fornecedor"
                maxLength={VALIDATION_LIMITS.MAX_STRING_LENGTH}
                containerStyle={errors.fornecedor && { borderColor: common.theme.colors.error }}
            />
            {errors.fornecedor && <common.Text style={common.styles.errorText}>{errors.fornecedor}</common.Text>}
            
            <common.FormDateInput 
                label="Data *" 
                date={data.data} 
                onDateChange={v => setField('data', v)}
                maximumDate={new Date()}
                containerStyle={errors.data && { borderColor: common.theme.colors.error }}
            />
            {errors.data && <common.Text style={common.styles.errorText}>{errors.data}</common.Text>}
            
            <common.FormInput 
                label="Observações" 
                value={data.observacoes} 
                onChangeText={v => setField('observacoes', v)} 
                placeholder="Observações adicionais"
                multiline
                numberOfLines={3}
                maxLength={VALIDATION_LIMITS.MAX_STRING_LENGTH}
                containerStyle={errors.observacoes && { borderColor: common.theme.colors.error }}
            />
            {errors.observacoes && <common.Text style={common.styles.errorText}>{errors.observacoes}</common.Text>}
        </common.ModalFormLayout>
    );
};

/**
 * Modal para registro de SAÍDA (Abastecimento de Máquina) ou Edição.
 */
const AddOrEditDieselModal = ({ itemId, onClose, onSaveSuccess, estoqueAtual }) => {
    const { items: equipamentos, loading: loadingEquip } = useFirestoreCollection('inventario', { 
        sortBy: 'marca', 
        order: 'asc' 
    });
    
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const originalItem = useRef(null);
    const [data, setData] = useState({ 
        data: new Date(), 
        equipamentoId: '', 
        litros: '', 
        odometro: '',
        observacoes: '',
        localAbastecimento: ''
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (itemId && auth.currentUser) {
            const fetchItem = async () => {
                setLoading(true);
                try {
                    const userId = auth.currentUser.uid;
                    const docRef = doc(db, `users/${userId}/diesel`, itemId);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const itemData = { 
                            ...docSnap.data(), 
                            id: docSnap.id,
                            data: docSnap.data().data.toDate() 
                        };
                        setData(itemData);
                        originalItem.current = itemData;
                    } else {
                        common.Alert.alert("Erro", "Registro não encontrado.");
                        onClose();
                    }
                } catch (error) {
                    console.error('Error fetching diesel record from Firestore:', error);
                    common.Alert.alert("Erro", "Não foi possível carregar o registro.");
                    onClose();
                } finally {
                    setLoading(false);
                }
            };
            fetchItem();
        }
    }, [itemId, onClose]);
    
    const setField = useCallback((field, value, type = 'text') => {
        let processedValue = value;
        if (type === 'numeric') {
            processedValue = value.replace(/[^0-9,.]/g, '');
        }
        setData(prev => ({ ...prev, [field]: processedValue }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    }, [errors]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        const litrosNum = parseFloat(String(data.litros).replace(',', '.'));
        const odometroNum = data.odometro ? parseFloat(String(data.odometro).replace(',', '.')) : null;

        if (!data.equipamentoId) newErrors.equipamentoId = 'Equipamento é obrigatório.';
        if (!data.data) newErrors.data = 'Data é obrigatória.';
        else if (data.data > new Date()) newErrors.data = 'A data não pode ser no futuro.';

        if (!data.litros || isNaN(litrosNum) || litrosNum <= 0) {
            newErrors.litros = 'Quantidade é obrigatória e deve ser maior que zero.';
        } else if (litrosNum > VALIDATION_LIMITS.MAX_LITROS_SAIDA) {
            newErrors.litros = `Valor muito alto. Máximo permitido: ${VALIDATION_LIMITS.MAX_LITROS_SAIDA} L.`;
        } else {
            // Lógica crítica: Verifica se há estoque suficiente considerando edição
            const originalLitros = itemId && originalItem.current ? originalItem.current.litros : 0;
            const estoqueDisponivelParaOperacao = estoqueAtual + originalLitros;
            if (litrosNum > estoqueDisponivelParaOperacao) {
                newErrors.litros = `Quantidade excede o estoque disponível (${estoqueDisponivelParaOperacao.toFixed(1)} L).`;
            }
        }

        if (odometroNum !== null) {
            if (isNaN(odometroNum)) newErrors.odometro = 'Valor inválido para horas/odômetro.';
            else if (odometroNum < 0) newErrors.odometro = 'O valor não pode ser negativo.';
            else if (odometroNum > VALIDATION_LIMITS.MAX_ODOMETRO) newErrors.odometro = `Valor máximo excedido (${VALIDATION_LIMITS.MAX_ODOMETRO}).`;
        }
        
        if (data.localAbastecimento.trim() && CONTAINS_ONLY_NUMBERS_REGEX.test(data.localAbastecimento.trim())) {
            newErrors.localAbastecimento = 'O local não pode conter apenas números.';
        } else if (data.localAbastecimento.length > VALIDATION_LIMITS.MAX_STRING_LENGTH) {
            newErrors.localAbastecimento = `Máximo de ${VALIDATION_LIMITS.MAX_STRING_LENGTH} caracteres.`;
        }

        if (data.observacoes.length > VALIDATION_LIMITS.MAX_STRING_LENGTH) {
            newErrors.observacoes = `Máximo de ${VALIDATION_LIMITS.MAX_STRING_LENGTH} caracteres.`;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data, estoqueAtual, itemId]);

    const onSave = async () => {
        if (loadingEquip) {
            common.Alert.alert("Aguarde", "A lista de equipamentos ainda está carregando.");
            return;
        }
        if (!validateForm()) {
            common.Alert.alert("Erro de Validação", "Por favor, corrija os campos destacados.");
            return;
        }
        if (!auth.currentUser) {
            common.Alert.alert("Erro", "Você precisa estar logado para salvar.");
            return;
        }

        setSaving(true);
        try {
            const equip = equipamentos.find(e => e.id === data.equipamentoId);
            const litros = parseFloat(String(data.litros).replace(',', '.'));
            const odometro = data.odometro ? parseFloat(String(data.odometro).replace(',', '.')) : null;
            
            const userId = auth.currentUser.uid;
            
            const docRef = itemId 
                ? doc(db, `users/${userId}/diesel`, itemId)
                : doc(collection(db, `users/${userId}/diesel`));

            const dataToSave = { 
                data: data.data, 
                equipamentoId: data.equipamentoId,
                equipamentoNome: equip ? `${equip.marca} ${equip.modelo}` : 'N/A', 
                litros,
                odometro,
                observacoes: data.observacoes.trim(),
                localAbastecimento: data.localAbastecimento.trim(),
                userId: userId
            };
            
            if (!itemId) {
                dataToSave.createdAt = serverTimestamp();
            } else {
                dataToSave.updatedAt = serverTimestamp();
            }

            await setDoc(docRef, dataToSave, { merge: true });
            onSaveSuccess();

        } catch (error) {
            console.error('Error saving diesel record to Firestore:', error);
            common.Alert.alert("Erro", "Não foi possível salvar o abastecimento. Tente novamente.");
        } finally {
            setSaving(false);
        }
    };

    const onDelete = useCallback(() => {
        const equipName = data.equipamentoNome || 'equipamento';
        const itemName = `Abastecimento de ${data.litros}L para ${equipName}`;
        
        // A função handleFirestoreDelete já exibe um alerta de confirmação.
        // Para a coleção 'diesel', a exclusão do registro de saída recalcula
        // automaticamente o estoque total, efetivamente "restaurando" os litros.
        if (common.handleFirestoreDelete) {
            common.handleFirestoreDelete(db, auth, 'diesel', itemId, itemName, null, onSaveSuccess);
        }
    }, [itemId, data.litros, data.equipamentoNome, onSaveSuccess]);
    
    if (loading) {
        return (
            <common.ModalFormLayout title="Carregando..." onCancel={onClose} saving={true}>
                <common.View style={common.styles.center}>
                    <common.ActivityIndicator size="large" color={common.theme.colors.primary} />
                </common.View>
            </common.ModalFormLayout>
        );
    }

    return (
        <common.ModalFormLayout
            title={itemId ? 'Editar Abastecimento' : 'Novo Abastecimento'}
            onSubmit={onSave}
            onCancel={onClose}
            saving={saving || loadingEquip}
            onDelete={itemId ? onDelete : null}
            submitText={itemId ? 'Atualizar' : 'Adicionar'}
        >
            {common.FormPicker && (
                <common.FormPicker 
                    label="Máquina *" 
                    items={equipamentos.map(e => ({
                        value: e.id, 
                        label: `${e.marca} ${e.modelo} ${e.numeroSerie ? `- ${e.numeroSerie}` : ''}`
                    }))} 
                    selectedValue={data.equipamentoId} 
                    onValueChange={v => setField('equipamentoId', v)} 
                    placeholder={loadingEquip ? 'Carregando equipamentos...' : 'Selecione um equipamento'}
                    disabled={loadingEquip}
                />
            )}
            {errors.equipamentoId && <common.Text style={common.styles.errorText}>{errors.equipamentoId}</common.Text>}
            
            <common.FormInput 
                label="Litros *" 
                value={String(data.litros)} 
                onChangeText={v => setField('litros', v, 'numeric')} 
                keyboardType="numeric" 
                placeholder="Ex: 50.5"
                containerStyle={errors.litros && { borderColor: common.theme.colors.error }}
            />
            {errors.litros && <common.Text style={common.styles.errorText}>{errors.litros}</common.Text>}
            
            <common.FormInput 
                label="Horas/Odômetro" 
                value={String(data.odometro || '')} 
                onChangeText={v => setField('odometro', v, 'numeric')} 
                keyboardType="numeric" 
                placeholder="Horímetro ou Odômetro atual"
                containerStyle={errors.odometro && { borderColor: common.theme.colors.error }}
            />
            {errors.odometro && <common.Text style={common.styles.errorText}>{errors.odometro}</common.Text>}
            
            <common.FormInput 
                label="Local do Abastecimento" 
                value={data.localAbastecimento || ''} 
                onChangeText={v => setField('localAbastecimento', v)} 
                placeholder="Ex: Posto Shell, Fazenda, etc."
                maxLength={VALIDATION_LIMITS.MAX_STRING_LENGTH}
                containerStyle={errors.localAbastecimento && { borderColor: common.theme.colors.error }}
            />
            {errors.localAbastecimento && <common.Text style={common.styles.errorText}>{errors.localAbastecimento}</common.Text>}
            
            <common.FormDateInput 
                label="Data *" 
                date={data.data} 
                onDateChange={v => setField('data', v)}
                maximumDate={new Date()}
                containerStyle={errors.data && { borderColor: common.theme.colors.error }}
            />
            {errors.data && <common.Text style={common.styles.errorText}>{errors.data}</common.Text>}
            
            <common.FormInput 
                label="Observações" 
                value={data.observacoes || ''} 
                onChangeText={v => setField('observacoes', v)} 
                placeholder="Observações sobre o abastecimento"
                multiline
                numberOfLines={3}
                maxLength={VALIDATION_LIMITS.MAX_STRING_LENGTH}
                containerStyle={errors.observacoes && { borderColor: common.theme.colors.error }}
            />
            {errors.observacoes && <common.Text style={common.styles.errorText}>{errors.observacoes}</common.Text>}
        </common.ModalFormLayout>
    );
};

// --- COMPONENTES DE UI ---

const DieselSummaryCard = ({ estoqueAtual, loading, onAddStock, onAddAbastecimento }) => {
    const getStatusColor = useCallback(() => {
        if (estoqueAtual <= 0) return common.theme.colors.error;
        if (estoqueAtual <= 100) return '#FF9800'; // Laranja
        return common.theme.colors.primary;
    }, [estoqueAtual]);

    const getStatusText = useCallback(() => {
        if (estoqueAtual <= 0) return 'Estoque Vazio';
        if (estoqueAtual <= 100) return 'Estoque Baixo';
        return 'Estoque OK';
    }, [estoqueAtual]);

    const isAbastecimentoDisabled = loading || estoqueAtual <= 0;

    return (
        <common.View style={common.styles.dieselSummaryCard}>
            <common.Text style={common.styles.dieselSummaryTitle}>
                Estimativa do Reservatório
            </common.Text>
            
            <common.View style={common.styles.dieselSummaryValueContainer}>
                {loading ? (
                    <common.ActivityIndicator color={common.theme.colors.primary} size="large" />
                ) : (
                    <common.View style={{ alignItems: 'center', flex: 1 }}>
                        <common.Text style={[
                            common.styles.dieselSummaryValue,
                            { color: getStatusColor() }
                        ]}>
                            {estoqueAtual.toFixed(1)} L
                        </common.Text>
                        <common.Text style={[
                            common.styles.dieselSummaryTitle,
                            { color: getStatusColor(), fontSize: 14, marginTop: 4 }
                        ]}>
                            {getStatusText()}
                        </common.Text>
                    </common.View>
                )}
                
                <common.TouchableOpacity 
                    onPress={onAddStock} 
                    style={{
                        backgroundColor: common.theme.colors.secondary, 
                        borderRadius: 12, 
                        padding: 12,
                        elevation: 2
                    }}
                    disabled={loading}
                >
                    <common.Icon name="add" size={24} color={common.theme.colors.textWhite}/>
                </common.TouchableOpacity>
            </common.View>
            
            <common.TouchableOpacity 
                style={[
                    common.styles.authButton, 
                    { marginVertical: 8 },
                    isAbastecimentoDisabled && { backgroundColor: common.theme.colors.disabled }
                ]} 
                onPress={onAddAbastecimento}
                disabled={isAbastecimentoDisabled}
            >
                <common.Text style={common.styles.buttonText}>
                    Registrar Abastecimento
                </common.Text>
            </common.TouchableOpacity>
        </common.View>
    );
};

const DieselListHeader = () => (
    <common.View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        <common.Text style={common.styles.formSectionTitle}>
            Histórico de Abastecimentos
        </common.Text>
        <common.View style={common.styles.dieselListHeader}>
            <common.Text style={[common.styles.dieselListHeaderText, { flex: 2 }]}>
                EQUIPAMENTO
            </common.Text>
            <common.Text style={[common.styles.dieselListHeaderText, { flex: 1, textAlign: 'center' }]}>
                HORAS
            </common.Text>
            <common.Text style={[common.styles.dieselListHeaderText, { flex: 1, textAlign: 'center' }]}>
                LITROS
            </common.Text>
            <common.Text style={[common.styles.dieselListHeaderText, { flex: 1.5, textAlign: 'right' }]}>
                DATA
            </common.Text>
        </common.View>
    </common.View>
);

const DieselListItem = React.memo(({ item, onPress }) => (
    <common.TouchableOpacity 
        style={common.styles.dieselListItem} 
        onPress={() => onPress(item.id)}
        activeOpacity={0.7}
    >
        <common.View style={{ flex: 2 }}>
            <common.Text 
                style={[common.styles.dieselListItemText, { fontWeight: 'bold' }]}
                numberOfLines={2}
            >
                {item.equipamentoNome || 'Equipamento não identificado'}
            </common.Text>
            {item.localAbastecimento && (
                <common.Text 
                    style={[
                        common.styles.dieselListItemText, 
                        { fontSize: 12, color: common.theme.colors.secondaryText, marginTop: 2 }
                    ]}
                    numberOfLines={1}
                >
                    {item.localAbastecimento}
                </common.Text>
            )}
        </common.View>
        
        <common.Text style={[common.styles.dieselListItemText, { flex: 1, textAlign: 'center' }]}>
            {item.odometro ? parseFloat(item.odometro).toFixed(1) : '--'}
        </common.Text>
        
        <common.Text style={[common.styles.dieselListItemText, { flex: 1, textAlign: 'center', fontWeight: 'bold' }]}>
            {`${parseFloat(item.litros).toFixed(1)} L`}
        </common.Text>
        
        <common.Text style={[common.styles.dieselListItemText, { flex: 1.5, textAlign: 'right' }]}>
            {item.data ? item.data.toLocaleDateString('pt-BR') : '--'}
        </common.Text>
    </common.TouchableOpacity>
));

// --- TELA PRINCIPAL ---

export const DieselScreen = ({ navigation }) => {
    // Busca abastecimentos e estoque em tempo real
    const { items: abastecimentos, loading: loadingAbastecimentos } = 
        useFirestoreCollection('diesel', { sortBy: 'data', order: 'desc' });
    
    const { items: estoque, loading: loadingEstoque } = 
        useFirestoreCollection('dieselEstoque', { sortBy: 'data', order: 'desc' });

    const [abastecimentoModal, setAbastecimentoModal] = useState({ visible: false, itemId: null });
    const [estoqueModalVisible, setEstoqueModalVisible] = useState(false);

    // Cálculo memoizado do estoque atual
    const { estoqueAtual, loading: calculatingStock } = useMemo(() => {
        if (loadingEstoque || loadingAbastecimentos) return { estoqueAtual: 0, loading: true };
        
        const entradas = estoque
            .filter(e => e.tipo === 'entrada')
            .reduce((sum, e) => sum + (parseFloat(e.litros) || 0), 0);
            
        const saídas = abastecimentos
            .reduce((sum, a) => sum + (parseFloat(a.litros) || 0), 0);
            
        return { estoqueAtual: entradas - saídas, loading: false };
    }, [estoque, abastecimentos, loadingEstoque, loadingAbastecimentos]);
    
    const handleSaveSuccess = useCallback(() => {
        setAbastecimentoModal({ visible: false, itemId: null });
        setEstoqueModalVisible(false);
    }, []);

    const handleOpenAbastecimento = useCallback((itemId = null) => {
        // Bloqueia novo abastecimento se estoque estiver zerado, exceto se for edição
        if (!itemId && estoqueAtual <= 0) {
            common.Alert.alert("Estoque Vazio", "Não é possível registrar um novo abastecimento pois o estoque está zerado. Adicione uma entrada de diesel primeiro.");
            return;
        }
        setAbastecimentoModal({ visible: true, itemId });
    }, [estoqueAtual]);

    const handleCloseAbastecimento = useCallback(() => {
        setAbastecimentoModal({ visible: false, itemId: null });
    }, []);

    const handleOpenEstoque = useCallback(() => {
        setEstoqueModalVisible(true);
    }, []);

    const handleCloseEstoque = useCallback(() => {
        setEstoqueModalVisible(false);
    }, []);

    const renderDieselItem = useCallback(({ item }) => (
        <DieselListItem 
            item={item} 
            onPress={handleOpenAbastecimento}
        />
    ), [handleOpenAbastecimento]);

    const ListHeaderComponent = useCallback(() => (
        <>
            <DieselSummaryCard
                estoqueAtual={estoqueAtual}
                loading={calculatingStock}
                onAddStock={handleOpenEstoque}
                onAddAbastecimento={() => handleOpenAbastecimento(null)}
            />
            <DieselListHeader />
        </>
    ), [estoqueAtual, calculatingStock, handleOpenEstoque, handleOpenAbastecimento]);

    const ListEmptyComponent = useCallback(() => {
        if (loadingAbastecimentos) {
            return (
                <common.View style={common.styles.center}>
                    <common.ActivityIndicator size="large" color={common.theme.colors.primary} />
                    <common.Text style={common.styles.emptyListText}>Carregando abastecimentos...</common.Text>
                </common.View>
            );
        }
        
        return (
            <common.View style={{ padding: 24, alignItems: 'center' }}>
                <common.Text style={common.styles.emptyListText}>
                    Nenhum abastecimento registrado
                </common.Text>
            </common.View>
        );
    }, [loadingAbastecimentos]);

    return (
        <common.View style={common.styles.containerLight}>
            <common.CustomHeader title="Controle de Diesel" navigation={navigation} />
            
            <common.View style={common.styles.contentWrapper}>
                <common.FlatList
                    data={abastecimentos}
                    renderItem={renderDieselItem}
                    keyExtractor={item => item.id}
                    ListHeaderComponent={ListHeaderComponent}
                    ListEmptyComponent={ListEmptyComponent}
                    contentContainerStyle={{ 
                        paddingBottom: 100, 
                        flexGrow: 1
                    }}
                    showsVerticalScrollIndicator={true}
                />
            </common.View>
            
            {abastecimentoModal.visible && (
                <AddOrEditDieselModal 
                    itemId={abastecimentoModal.itemId}
                    onClose={handleCloseAbastecimento}
                    onSaveSuccess={handleSaveSuccess}
                    estoqueAtual={estoqueAtual}
                />
            )}

            {estoqueModalVisible && (
                <AddEstoqueDieselModal
                    onClose={handleCloseEstoque}
                    onSaveSuccess={handleSaveSuccess}
                />
            )}
        </common.View>
    );
};