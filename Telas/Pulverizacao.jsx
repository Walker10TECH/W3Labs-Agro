// --- FILE: Pulverizacao.jsx ---
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, doc, getDoc, writeBatch } from 'firebase/firestore';
import { Alert, Keyboard } from 'react-native'; // Importação direta para garantir acesso a APIs nativas se necessário
import * as common from './Common';
import {
    auth,
    db,
    getItems,
    subscribeToCollection,
} from '../firebaseConfig';

// --- UTILS & CONSTANTS ---

// Regex para garantir que campos numéricos não tenham texto indesejado
const NUMBER_SANITIZER_REGEX = /[^0-9,.]/g;

/**
 * Converte string "1.200,50" ou "1200.50" para float JS nativo
 */
const parseMoeda = (value) => {
    if (!value) return 0;
    // Se for numero puro
    if (typeof value === 'number') return value;
    
    let sanitized = value.replace(NUMBER_SANITIZER_REGEX, '');
    // Se tiver vírgula, assume formato BR (substitui ponto milhar por nada, e virgula por ponto decimal)
    if (sanitized.includes(',')) {
        sanitized = sanitized.replace(/\./g, '').replace(',', '.');
    }
    return parseFloat(sanitized) || 0;
};

/**
 * Componente Visual para Títulos de Seção no Formulário
 */
const SectionHeader = ({ title, icon }) => (
    <common.View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: common.theme.colors.border }}>
        <common.Icon name={icon} size={20} color={common.theme.colors.primary} style={{ marginRight: 8 }} />
        <common.Text style={{ fontSize: 16, fontWeight: 'bold', color: common.theme.colors.text }}>{title}</common.Text>
    </common.View>
);

// --- MAIN COMPONENTS ---

const AddOrEditPulverizacaoModal = ({ itemId, onClose, onSaveSuccess }) => {
    // --- STATE ---
    const [equipamentos, setEquipamentos] = useState([]);
    const [defensivosEmEstoque, setDefensivosEmEstoque] = useState([]);
    const [loadingDependencies, setLoadingDependencies] = useState(true);

    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [originalItem, setOriginalItem] = useState(null);
    const [errors, setErrors] = useState({});

    // Estado do Formulário Completo
    const [data, setData] = useState({
        // Operacional
        status: 'Realizado', // Realizado ou Planejado
        operador: '', 
        dataAplicacao: new Date(),
        equipamentoId: '',
        
        // Agronômico
        tipoAplicacao: 'Herbicida',
        cultura: '',
        talhao: '',
        areaTalhao: '', // Em Hectares
        
        // Produto & Dose
        estoqueItemId: '',
        produto: '',
        dose: '', // L/ha ou kg/ha
        unidadeDose: 'L/ha',
        quantidadeUtilizada: '', // Calculado ou manual
        
        // Clima (Dados granulares para Data Science futuro)
        temperatura: '',
        umidade: '',
        velocidadeVento: '',
        
        location: null
    });

    // --- DEPENDENCIES ---
    useEffect(() => {
        const fetchDependencies = async () => {
            setLoadingDependencies(true);
            try {
                const [equipResult, defensivosResult] = await Promise.all([
                    getItems('inventario'),
                    getItems('estoqueGeral')
                ]);

                if (equipResult.success) {
                    setEquipamentos(equipResult.data.sort((a, b) => a.marca.localeCompare(b.marca)));
                }
                if (defensivosResult.success) {
                    const pecasFiltradas = defensivosResult.data
                        .filter(p => p.tipo === 'Defensivo')
                        .sort((a, b) => a.nome.localeCompare(b.nome));
                    setDefensivosEmEstoque(pecasFiltradas);
                }
            } catch (error) {
                console.error("W3Labs Log: Erro de dependências", error);
            } finally {
                setLoadingDependencies(false);
            }
        };
        fetchDependencies();
    }, []);

    // --- FETCH ITEM (EDIT MODE) ---
    useEffect(() => {
        if (itemId) {
            setLoading(true);
            const fetchItem = async () => {
                const userUid = auth.currentUser?.uid;
                if (!userUid) return;

                try {
                    const docRef = doc(db, 'users', userUid, 'pulverizacoes', itemId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const item = docSnap.data();
                        setData({
                            ...item,
                            dataAplicacao: item.dataAplicacao?.toDate ? item.dataAplicacao.toDate() : new Date(),
                            location: item.latitude ? { latitude: item.latitude, longitude: item.longitude } : null,
                            // Converte números para string para exibição nos inputs
                            quantidadeUtilizada: item.quantidadeUtilizada ? String(item.quantidadeUtilizada).replace('.', ',') : '',
                            areaTalhao: item.areaTalhao ? String(item.areaTalhao).replace('.', ',') : '',
                            dose: item.dose ? String(item.dose).replace('.', ',') : '',
                            temperatura: item.temperatura ? String(item.temperatura) : '',
                            umidade: item.umidade ? String(item.umidade) : '',
                            velocidadeVento: item.velocidadeVento ? String(item.velocidadeVento) : '',
                        });
                        setOriginalItem(item);
                    } else {
                        common.Alert.alert("Erro", "Registro não encontrado.");
                        onClose();
                    }
                } catch (error) {
                    console.error("W3Labs Log: Erro ao buscar item", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchItem();
        }
    }, [itemId, onClose]);

    // --- LOGIC: AUTO CALCULATION ---
    // Calcula a quantidade total sempre que Área ou Dose mudar
    useEffect(() => {
        // Só calcula se o usuário estiver preenchendo (não no carregamento inicial da edição para não sobrescrever formatações)
        if (!loading) {
            const area = parseMoeda(data.areaTalhao);
            const dose = parseMoeda(data.dose);
            
            if (area > 0 && dose > 0) {
                const total = area * dose;
                // Atualiza apenas se o campo não estiver focado manualmente (lógica simplificada aqui: sempre sugere)
                setData(prev => ({
                    ...prev,
                    quantidadeUtilizada: total.toFixed(2).replace('.', ',')
                }));
            }
        }
    }, [data.areaTalhao, data.dose, loading]);

    // --- HANDLERS ---
    const setField = useCallback((field, value, type = 'text') => {
        let processedValue = value;
        if (type === 'numeric') {
            processedValue = value.replace(/[^0-9,.]/g, '');
        }
        setData(p => ({ ...p, [field]: processedValue }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    }, [errors]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        if (!data.cultura?.trim()) newErrors.cultura = 'Informe a cultura.';
        if (!data.talhao?.trim()) newErrors.talhao = 'Informe o talhão.';
        
        // Validação de Estoque/Produto
        if (!data.estoqueItemId && !data.produto?.trim()) newErrors.produto = 'Selecione um produto do estoque ou digite o nome.';
        
        // Validação Numérica
        const qtdTotal = parseMoeda(data.quantidadeUtilizada);
        if (qtdTotal <= 0) newErrors.quantidadeUtilizada = 'Quantidade inválida.';

        // Validação de Saldo de Estoque
        if (data.estoqueItemId) {
            const defensivo = defensivosEmEstoque.find(d => d.id === data.estoqueItemId);
            const originalQtd = originalItem ? (originalItem.quantidadeUtilizada || 0) : 0;
            // Disponível = Atual no Banco + O que eu gastei neste registro anteriormente (estorno virtual)
            const disponivel = (parseFloat(defensivo?.quantidade || 0)) + (originalItem?.estoqueItemId === data.estoqueItemId ? originalQtd : 0);

            if (defensivo && qtdTotal > disponivel) {
                newErrors.quantidadeUtilizada = `Saldo insuficiente. Máx: ${disponivel.toFixed(2)} ${defensivo.unidade}`;
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data, defensivosEmEstoque, originalItem]);

    const onSave = async () => {
        if (!validateForm()) return common.Alert.alert('Atenção', 'Verifique os campos obrigatórios.');
        
        setSaving(true);
        const userUid = auth.currentUser?.uid;
        if (!userUid) return;

        try {
            const batch = writeBatch(db);
            const defensivo = defensivosEmEstoque.find(d => d.id === data.estoqueItemId);
            
            // Tratamento de Números para salvar no banco (sempre float com ponto)
            const qtdSalvar = parseMoeda(data.quantidadeUtilizada);
            const doseSalvar = parseMoeda(data.dose);
            const areaSalvar = parseMoeda(data.areaTalhao);
            const tempSalvar = parseMoeda(data.temperatura);
            const umidSalvar = parseMoeda(data.umidade);
            const ventoSalvar = parseMoeda(data.velocidadeVento);

            // --- GESTÃO DE ESTOQUE ATÔMICA (W3Labs Standard) ---
            const stockChanges = new Map();

            // 1. Adiciona de volta a quantidade original (se estiver editando um registro existente)
            if (originalItem?.estoqueItemId && originalItem.quantidadeUtilizada > 0) {
                const originalQtd = originalItem.quantidadeUtilizada;
                stockChanges.set(originalItem.estoqueItemId, (stockChanges.get(originalItem.estoqueItemId) || 0) + originalQtd);
            }

            // 2. Subtrai a nova quantidade a ser utilizada
            if (data.estoqueItemId && qtdSalvar > 0) {
                stockChanges.set(data.estoqueItemId, (stockChanges.get(data.estoqueItemId) || 0) - qtdSalvar);
            }

            // 3. Prepara as atualizações do estoque para o batch
            const stockUpdatePromises = Array.from(stockChanges.entries()).map(async ([stockItemId, change]) => {
                if (change === 0) return null; // Nenhuma alteração necessária
                const stockRef = doc(db, 'users', userUid, 'estoqueGeral', stockItemId);
                const stockDoc = await getDoc(stockRef); // Leitura necessária para obter o valor atual
                if (!stockDoc.exists()) throw new Error(`Item de estoque com ID ${stockItemId} não foi encontrado.`);
                
                const newQty = (stockDoc.data().quantidade || 0) + change;
                if (newQty < 0) throw new Error(`Estoque insuficiente para "${stockDoc.data().nome}". Saldo final seria ${newQty.toFixed(2)}.`);
                
                return { ref: stockRef, newQty };
            });

            const stockUpdates = (await Promise.all(stockUpdatePromises)).filter(Boolean);
            stockUpdates.forEach(({ ref, newQty }) => {
                batch.update(ref, { quantidade: newQty });
            });

            // --- FIM DA GESTÃO DE ESTOQUE ---

            // --- SALVAR REGISTRO ---
            const docId = itemId || doc(collection(db, 'users', userUid, 'pulverizacoes')).id;
            const payload = {
                id: docId,
                status: data.status,
                operador: data.operador,
                tipoAplicacao: data.tipoAplicacao,
                cultura: data.cultura,
                talhao: data.talhao,
                areaTalhao: areaSalvar,
                
                estoqueItemId: data.estoqueItemId,
                produto: defensivo ? defensivo.nome : data.produto,
                unidade: defensivo ? defensivo.unidade : 'un',
                dose: doseSalvar,
                quantidadeUtilizada: qtdSalvar,
                
                equipamentoId: data.equipamentoId,
                equipamentoNome: equipamentos.find(e => e.id === data.equipamentoId)?.modelo || 'N/A',
                
                temperatura: tempSalvar,
                umidade: umidSalvar,
                velocidadeVento: ventoSalvar,
                
                dataAplicacao: data.dataAplicacao,
                latitude: data.location?.latitude || null,
                longitude: data.location?.longitude || null,
                
                updatedAt: new Date()
            };

            batch.set(doc(db, 'users', userUid, 'pulverizacoes', docId), payload, { merge: true });
            
            await batch.commit();
            onSaveSuccess();

        } catch (error) {
            console.error(error);
            common.Alert.alert("Erro ao Salvar", error.message);
        } finally {
            setSaving(false);
        }
    };

    const onDelete = useCallback(() => {
        // A lógica de estorno de estoque na exclusão é tratada pela função handleFirestoreDelete em Common.jsx
        common.handleFirestoreDelete(
            db, 
            auth, 
            'pulverizacoes', 
            itemId, 
            `Aplicação em ${data.talhao || 'local desconhecido'}`, 
            null,
            onSaveSuccess
        );
    }, [itemId, data.talhao, onSaveSuccess]);

    if (loadingDependencies || loading) return <common.LoadingModal />;

    const defensivoSelecionado = defensivosEmEstoque.find(d => d.id === data.estoqueItemId);

    return (
        <common.ModalFormLayout
            title={itemId ? "Editar Aplicação" : "Nova Aplicação"}
            onSubmit={onSave}
            onCancel={onClose}
            saving={saving}
            onDelete={itemId ? onDelete : null}
            submitText="Confirmar Aplicação"
        >
            {/* --- SEÇÃO 1: OPERACIONAL --- */}
            <SectionHeader title="Dados Operacionais" icon="clipboard-list-outline" />
            <common.View style={{ flexDirection: 'row', gap: 10 }}>
                <common.View style={{ flex: 1 }}>
                    <common.FormPicker 
                        label="Status" 
                        items={[{label: 'Realizado', value: 'Realizado'}, {label: 'Planejado', value: 'Planejado'}]}
                        selectedValue={data.status}
                        onValueChange={v => setField('status', v)}
                    />
                </common.View>
                <common.View style={{ flex: 1 }}>
                    <common.FormDateInput label="Data" date={data.dataAplicacao} onDateChange={v => setField('dataAplicacao', v)} />
                </common.View>
            </common.View>
            <common.FormInput label="Operador Responsável" value={data.operador} onChangeText={v => setField('operador', v)} placeholder="Nome do operador" />
            <common.FormPicker 
                label="Equipamento Utilizado" 
                items={equipamentos.map(e => ({ label: `${e.marca} ${e.modelo}`, value: e.id }))} 
                selectedValue={data.equipamentoId} 
                onValueChange={v => setField('equipamentoId', v)} 
                placeholder="Selecione o trator/pulverizador" 
            />

            {/* --- SEÇÃO 2: AGRONÔMICO --- */}
            <SectionHeader title="Local e Cultura" icon="sprout-outline" />
            <common.ChoiceChips 
                options={[{label:'Herbicida', value:'Herbicida'}, {label:'Fungicida', value:'Fungicida'}, {label:'Inseticida', value:'Inseticida'}, {label:'Adubo Foliar', value:'Adubo'}]} 
                selectedValue={data.tipoAplicacao} 
                onValueChange={v => setField('tipoAplicacao', v)} 
            />
            <common.View style={{ flexDirection: 'row', gap: 10 }}>
                <common.View style={{ flex: 1 }}>
                    <common.FormInput label="Cultura *" value={data.cultura} onChangeText={v => setField('cultura', v)} placeholder="Ex: Soja" />
                </common.View>
                <common.View style={{ flex: 1 }}>
                    <common.FormInput label="Talhão *" value={data.talhao} onChangeText={v => setField('talhao', v)} placeholder="ID da Área" />
                </common.View>
            </common.View>
            <common.FormInput 
                label="Área Aplicada (ha)" 
                value={data.areaTalhao} 
                onChangeText={v => setField('areaTalhao', v, 'numeric')} 
                keyboardType="numeric" 
                placeholder="0,00"
            />

            {/* --- SEÇÃO 3: PRODUTO --- */}
            <SectionHeader title="Insumo e Dosagem" icon="flask-outline" />
            <common.FormPicker 
                label="Selecione o Produto (Estoque)" 
                items={defensivosEmEstoque.map(d => ({ 
                    label: `${d.nome} (Disp: ${d.quantidade} ${d.unidade})`, 
                    value: d.id 
                }))} 
                selectedValue={data.estoqueItemId} 
                onValueChange={v => setField('estoqueItemId', v)} 
                placeholder="Baixar do estoque..." 
            />
            
            { !data.estoqueItemId && (
                <common.FormInput label="Nome do Produto (Manual)" value={data.produto} onChangeText={v => setField('produto', v)} placeholder="Digite se não houver estoque" />
            )}
            {errors.produto && <common.Text style={common.styles.errorText}>{errors.produto}</common.Text>}

            <common.View style={{ flexDirection: 'row', gap: 10 }}>
                <common.View style={{ flex: 1 }}>
                    <common.FormInput 
                        label={`Dose (${defensivoSelecionado?.unidade || 'L'}/ha)`} 
                        value={data.dose} 
                        onChangeText={v => setField('dose', v, 'numeric')} 
                        keyboardType="numeric" 
                        placeholder="0,00"
                    />
                </common.View>
                <common.View style={{ flex: 1 }}>
                    <common.FormInput 
                        label={`Total (${defensivoSelecionado?.unidade || 'un'}) *`} 
                        value={data.quantidadeUtilizada} 
                        onChangeText={v => setField('quantidadeUtilizada', v, 'numeric')} 
                        keyboardType="numeric" 
                        placeholder="Calculado..."
                        editable={true} // Permite ajuste fino manual
                    />
                </common.View>
            </common.View>
            {errors.quantidadeUtilizada && <common.Text style={common.styles.errorText}>{errors.quantidadeUtilizada}</common.Text>}

            {/* --- SEÇÃO 4: CLIMA --- */}
            <SectionHeader title="Condições Climáticas" icon="weather-partly-cloudy" />
            <common.View style={{ flexDirection: 'row', gap: 10 }}>
                <common.View style={{ flex: 1 }}>
                    <common.FormInput label="Temp. (°C)" value={data.temperatura} onChangeText={v => setField('temperatura', v, 'numeric')} keyboardType="numeric" />
                </common.View>
                <common.View style={{ flex: 1 }}>
                    <common.FormInput label="Umid. (%)" value={data.umidade} onChangeText={v => setField('umidade', v, 'numeric')} keyboardType="numeric" />
                </common.View>
                <common.View style={{ flex: 1 }}>
                    <common.FormInput label="Vento (km/h)" value={data.velocidadeVento} onChangeText={v => setField('velocidadeVento', v, 'numeric')} keyboardType="numeric" />
                </common.View>
            </common.View>

            <common.FormLocationInput label="Geolocalização da Aplicação" initialLocation={data.location} onLocationChange={loc => setField('location', loc)} />
            
        </common.ModalFormLayout>
    );
};

// --- LIST SCREEN ---

export const PulverizacaoListaScreen = ({ navigation }) => {
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToCollection('pulverizacoes', (data) => {
            // Ordenação: Data mais recente primeiro
            const sortedData = data.sort((a, b) => {
                const dateA = a.dataAplicacao?.toDate ? a.dataAplicacao.toDate() : 0;
                const dateB = b.dataAplicacao?.toDate ? b.dataAplicacao.toDate() : 0;
                return dateB - dateA;
            });
            setItems(sortedData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleOpenModal = useCallback((itemId = null) => {
        setModal({ visible: true, itemId });
    }, []);

    const getStatusColor = (status) => {
        return status === 'Planejado' ? common.theme.colors.warning : common.theme.colors.success;
    };

    return (
        <common.View style={{ flex: 1 }}>
            <common.Header title="Gestão de Pulverização" navigation={navigation} />
            <common.View style={{ flex: 1, padding: 8, backgroundColor: common.theme.colors.background }}>
                {loading ? (
                    <common.ActivityIndicator style={{ marginTop: 20 }} size="large" color={common.theme.colors.primary} />
                ) : items.length === 0 ? (
                    <common.View style={common.styles.center}>
                        <common.MaterialCommunityIcons name="spray" size={64} color="#ccc" />
                        <common.Text style={common.styles.emptyListText}>Nenhuma aplicação registrada.</common.Text>
                        <common.Button title="Nova Aplicação" onPress={() => handleOpenModal(null)} style={{marginTop: 16}} />
                    </common.View>
                ) : (
                    <common.FlatList
                        data={items}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingBottom: 80 }}
                        renderItem={({ item }) => (
                            <common.TouchableOpacity 
                                style={[common.styles.listItemContainer, { borderLeftWidth: 4, borderLeftColor: getStatusColor(item.status) }]} 
                                onPress={() => handleOpenModal(item.id)}
                            >
                                <common.View style={common.styles.listItemIconContainer}>
                                    <common.MaterialCommunityIcons name={item.tipoAplicacao === 'Adubo' ? 'leaf' : 'spray'} size={24} color={common.theme.colors.primary} />
                                </common.View>
                                <common.View style={common.styles.listItemContent}>
                                    <common.View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <common.Text style={common.styles.listItemTitle}>{item.cultura} - {item.talhao}</common.Text>
                                        <common.Text style={{ fontSize: 10, color: getStatusColor(item.status), fontWeight: 'bold' }}>{item.status?.toUpperCase() || 'REALIZADO'}</common.Text>
                                    </common.View>
                                    
                                    <common.Text style={common.styles.listItemSubtitle}>
                                        {item.produto} • {item.quantidadeUtilizada} {item.unidade || 'un'}
                                    </common.Text>
                                    
                                    <common.Text style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                                        <common.Icon name="calendar-outline" size={10} /> {item.dataAplicacao?.toDate().toLocaleDateString('pt-BR')} 
                                        {item.areaTalhao && ` • ${item.areaTalhao} ha`}
                                    </common.Text>
                                </common.View>
                                <common.Icon name="chevron-forward" size={20} color="#ccc" />
                            </common.TouchableOpacity>
                        )}
                    />
                )}
            </common.View>
            <common.FAB onPress={() => handleOpenModal(null)} />
            
            {modal.visible && (
                <AddOrEditPulverizacaoModal 
                    itemId={modal.itemId} 
                    onClose={() => setModal({ visible: false, itemId: null })} 
                    onSaveSuccess={() => setModal({ visible: false, itemId: null })} 
                />
            )}
        </common.View>
    );
};