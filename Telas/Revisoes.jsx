// --- FILE: Revisoes.jsx ---
import { collection, doc, getDoc, writeBatch } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    auth,
    db,
    getItems, // Manter o alias para clareza
    subscribeToCollection
} from '../firebaseConfig';
import * as common from './Common';

// Regex para validar campos de texto (não podem ser apenas números)
const CONTAINS_ONLY_NUMBERS_REGEX = /^\d+$/;

// --- Sub-componente Modal para adicionar peças ---
const AddPecaModal = ({ onClose, onAddPeca, pecasDisponiveis }) => {
    const [selectedPecaId, setSelectedPecaId] = useState(null);
    const [quantidade, setQuantidade] = useState('');
    const [error, setError] = useState('');

    const pecaSelecionada = useMemo(() =>
        pecasDisponiveis.find(p => p.id === selectedPecaId),
        [selectedPecaId, pecasDisponiveis]
    );

    const handleAdd = () => {
        const qtdNum = parseFloat(String(quantidade).replace(',', '.'));

        if (!selectedPecaId) {
            setError('Selecione uma peça.');
            return;
        }
        if (isNaN(qtdNum) || qtdNum <= 0) {
            setError('A quantidade deve ser um número maior que zero.');
            return;
        }
        if (pecaSelecionada && qtdNum > pecaSelecionada.quantidade) {
            setError(`Estoque insuficiente. Disponível: ${pecaSelecionada.quantidade} ${pecaSelecionada.unidade}`);
            return;
        }

        onAddPeca({
            estoqueItemId: pecaSelecionada.id,
            nome: pecaSelecionada.nome,
            quantidade: qtdNum,
            unidade: pecaSelecionada.unidade,
            valorUnitario: pecaSelecionada.valorUnitario || 0,
        });
        onClose();
    };

    const setSanitizedQuantidade = (value) => {
        setQuantidade(value.replace(/[^0-9,.]/g, ''));
        if (error) setError('');
    };

    return (
        <common.ModalFormLayout
            title="Adicionar Peça da Revisão"
            onCancel={onClose}
            onSubmit={handleAdd}
            submitText="Adicionar Peça"
        >
            <common.FormPicker
                label="Peça do Estoque *"
                items={pecasDisponiveis.map(p => ({
                    label: `${p.nome} (Estoque: ${p.quantidade} ${p.unidade})`,
                    value: p.id
                }))}
                selectedValue={selectedPecaId}
                onValueChange={v => { setSelectedPecaId(v); if (error) setError(''); }}
                placeholder="Selecione uma peça..."
            />
            <common.FormInput
                label={`Quantidade (${pecaSelecionada?.unidade || 'un'}) *`}
                value={quantidade}
                onChangeText={setSanitizedQuantidade}
                keyboardType="numeric"
                placeholder="Ex: 2"
            />
            {error && <common.Text style={common.styles.errorText}>{error}</common.Text>}
        </common.ModalFormLayout>
    );
};

// --- Componente Modal principal refatorado para Firestore ---
const AddOrEditRevisaoModal = ({ itemId, onClose, onSaveSuccess }) => {
    const [equipamentos, setEquipamentos] = useState([]);
    const [pecasEmEstoque, setPecasEmEstoque] = useState([]);
    const [loadingEquip, setLoadingEquip] = useState(true);
    const [loadingPecas, setLoadingPecas] = useState(true);

    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const [errors, setErrors] = useState({});
    const [isPecaModalVisible, setIsPecaModalVisible] = useState(false);
    const [pecasUtilizadas, setPecasUtilizadas] = useState([]);
    const [originalPecas, setOriginalPecas] = useState([]); // Guarda o estado original das peças para o cálculo do estoque

    const [data, setData] = useState({
        tipoRevisao: 'Preventiva',
        equipamentoId: '',
        descricaoServico: '',
        custoMaoDeObra: '',
        responsavel: '',
        dataRevisao: new Date()
    });

    // Busca equipamentos e peças do estoque do Firestore
    useEffect(() => {
        const fetchData = async () => {
            setLoadingEquip(true);
            setLoadingPecas(true);
            const userUid = auth.currentUser?.uid;
            if (!userUid) return;

            // Busca equipamentos
            const equipResult = await getItems('inventario');
            if (equipResult.success) {
                setEquipamentos(equipResult.data.sort((a, b) => a.marca.localeCompare(b.marca)));
            }
            setLoadingEquip(false);

            // Busca peças do estoque
            const pecasResult = await getItems('estoqueGeral');
            if (pecasResult.success) {
                const pecasFiltradas = pecasResult.data
                    .filter(p => p.tipo === 'Peça')
                    .sort((a, b) => a.nome.localeCompare(b.nome));
                setPecasEmEstoque(pecasFiltradas);
            }
            setLoadingPecas(false);
        };
        fetchData();
    }, []);

    // Busca a revisão existente do Firestore se estiver no modo de edição
    useEffect(() => {
        if (itemId) {
            setLoading(true);
            const fetchItem = async () => {
                const userUid = auth.currentUser?.uid;
                if (!userUid) {
                    common.Alert.alert("Erro", "Usuário não autenticado.");
                    return;
                }
                try {
                    const docRef = doc(db, 'users', userUid, 'revisoes', itemId);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const item = docSnap.data();
                        setData({
                            ...item,
                            dataRevisao: item.dataRevisao?.toDate ? item.dataRevisao.toDate() : new Date(),
                            custoMaoDeObra: item.custoMaoDeObra ? String(item.custoMaoDeObra) : ''
                        });
                        const pecas = item.pecasUtilizadas || [];
                        setPecasUtilizadas(pecas);
                        setOriginalPecas(pecas); // Salva o estado original
                    } else {
                        common.Alert.alert("Erro", "Revisão não encontrada.");
                        onClose();
                    }
                } catch (error) {
                    console.error("Erro ao buscar revisão:", error);
                    common.Alert.alert("Erro", "Não foi possível carregar a revisão.");
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
        setData(p => ({ ...p, [field]: processedValue }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    }, [errors]);

    const handleAddPeca = (peca) => {
        setPecasUtilizadas(prev => [...prev, peca]);
    };

    const handleRemovePeca = (estoqueItemId) => {
        setPecasUtilizadas(prev => prev.filter(p => p.estoqueItemId !== estoqueItemId));
    };

    const { custoTotal, custoPecas } = useMemo(() => {
        const custoPecasCalc = pecasUtilizadas.reduce((total, peca) => total + (peca.quantidade * (peca.valorUnitario || 0)), 0);
        const custoMaoDeObraNum = parseFloat(String(data.custoMaoDeObra).replace(',', '.')) || 0;
        return {
            custoPecas: custoPecasCalc,
            custoTotal: custoPecasCalc + custoMaoDeObraNum
        };
    }, [pecasUtilizadas, data.custoMaoDeObra]);

    const validateForm = useCallback(() => {
        const newErrors = {};
        if (!data.equipamentoId) newErrors.equipamentoId = 'Selecione um equipamento.';
        if (!data.descricaoServico?.trim() && pecasUtilizadas.length === 0) newErrors.descricaoServico = 'Adicione peças ou descreva o serviço.';
        if (data.custoMaoDeObra) {
            const custoNum = parseFloat(String(data.custoMaoDeObra).replace(',', '.'));
            if (isNaN(custoNum) || custoNum < 0) newErrors.custo = 'O custo deve ser um número válido e não negativo.';
        }
        if (data.responsavel?.trim() && CONTAINS_ONLY_NUMBERS_REGEX.test(data.responsavel.trim())) newErrors.responsavel = 'O responsável não pode ser apenas números.';
        if (data.dataRevisao > new Date()) newErrors.dataRevisao = 'A data não pode ser no futuro.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data, pecasUtilizadas]);

    const onSave = async () => {
        if (!validateForm()) {
            common.Alert.alert('Erro de Validação', 'Por favor, corrija os campos destacados.');
            return;
        }
        setSaving(true);
        const userUid = auth.currentUser?.uid;
        if (!userUid) {
            common.Alert.alert("Erro", "Usuário não autenticado.");
            setSaving(false);
            return;
        }

        try {
            const batch = writeBatch(db);
            const equip = equipamentos.find(e => e.id === data.equipamentoId);

            // --- Lógica de Atualização de Estoque Atômica ---
            // Usamos um Map para calcular a diferença de quantidade para cada peça.
            const stockChanges = new Map();
            // 1. Adiciona de volta as quantidades originais (se estiver editando)
            originalPecas.forEach(p => stockChanges.set(p.estoqueItemId, (stockChanges.get(p.estoqueItemId) || 0) + p.quantidade));
            // 2. Subtrai as novas quantidades
            pecasUtilizadas.forEach(p => stockChanges.set(p.estoqueItemId, (stockChanges.get(p.estoqueItemId) || 0) - p.quantidade));

            // Prepara as atualizações do estoque para o batch
            const stockUpdatePromises = Array.from(stockChanges.entries()).map(async ([itemId, change]) => {
                if (change === 0) return null; // Nenhuma alteração
                const ref = doc(db, 'users', userUid, 'estoqueGeral', itemId);
                const stockDoc = await getDoc(ref); // Precisa ler o valor atual
                if (!stockDoc.exists()) throw new Error(`Peça com ID ${itemId} não encontrada no estoque.`);
                const newQty = (stockDoc.data().quantidade || 0) + change;
                if (newQty < 0) throw new Error(`Estoque insuficiente para a peça "${stockDoc.data().nome}".`);
                return { ref, newQty };
            });

            const stockUpdates = (await Promise.all(stockUpdatePromises)).filter(Boolean);
            stockUpdates.forEach(({ ref, newQty }) => {
                batch.update(ref, { quantidade: newQty });
            });

            // --- Prepara e Salva a Revisão ---
            const revisaoId = itemId || doc(collection(db, 'users', userUid, 'revisoes')).id;
            const dataToSave = {
                ...data,
                id: revisaoId,
                custoMaoDeObra: parseFloat(String(data.custoMaoDeObra).replace(',', '.')) || 0,
                custoPecas: custoPecas,
                custoTotal: custoTotal,
                equipamentoNome: equip ? `${equip.marca} ${equip.modelo}` : 'N/A',
                dataRevisao: data.dataRevisao,
                descricaoServico: data.descricaoServico.trim(),
                responsavel: data.responsavel.trim(),
                // Armazenamos a lista de peças diretamente no documento
                pecasUtilizadas: pecasUtilizadas,
            };

            const revisaoRef = doc(db, 'users', userUid, 'revisoes', revisaoId);
            batch.set(revisaoRef, dataToSave, { merge: true }); // `set` com `merge` funciona para criar e atualizar

            await batch.commit(); // Executa todas as operações atomicamente
            onSaveSuccess();
        } catch (error) {
            console.error("Erro ao salvar revisão:", error);
            common.Alert.alert("Erro", `Não foi possível salvar a revisão. ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

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
        const itemName = `Revisão de ${data.equipamentoNome || 'equipamento'}`;
        const message = `Excluir "${itemName}"? Esta ação irá restaurar as peças utilizadas ao estoque e não pode ser desfeita.`;

        const performDelete = async () => {
            setSaving(true);
            const userUid = auth.currentUser?.uid;
            if (!userUid) {
                common.Alert.alert("Erro", "Usuário não autenticado.");
                setSaving(false);
                return;
            }

            try {
                const batch = writeBatch(db);

                // 1. Restaurar o estoque das peças utilizadas
                const stockUpdatePromises = originalPecas.map(async (peca) => {
                    const stockRef = doc(db, 'users', userUid, 'estoqueGeral', peca.estoqueItemId);
                    const stockDoc = await getDoc(stockRef);
                    if (stockDoc.exists()) {
                        const newQty = (stockDoc.data().quantidade || 0) + peca.quantidade;
                        return { ref: stockRef, newQty };
                    }
                    return null;
                });

                const stockUpdates = (await Promise.all(stockUpdatePromises)).filter(Boolean);
                stockUpdates.forEach(({ ref, newQty }) => batch.update(ref, { quantidade: newQty }));

                // 2. Deletar o documento da revisão
                const revisaoRef = doc(db, 'users', userUid, 'revisoes', itemId);
                batch.delete(revisaoRef);

                await batch.commit();
                onSaveSuccess();
            } catch (error) {
                console.error("Erro ao excluir revisão:", error);
                common.Alert.alert("Erro", `Não foi possível excluir a revisão. ${error.message}`);
            } finally {
                setSaving(false);
            }
        };

        confirmAction("Confirmar Exclusão", message, performDelete);
    }, [itemId, data.equipamentoNome, originalPecas, onSaveSuccess, confirmAction]);

    if (loading) {
        return <common.ModalFormLayout title="Carregando..." onCancel={onClose} saving={true}><common.View style={common.styles.center}><common.ActivityIndicator size="large" /></common.View></common.ModalFormLayout>;
    }

    return (
        <>
            <common.ModalFormLayout
                title={itemId ? 'Editar Revisão' : 'Nova Revisão'}
                onSubmit={onSave}
                onCancel={onClose}
                saving={saving || loadingEquip}
                onDelete={itemId ? onDelete : null}
                submitText={itemId ? 'Atualizar' : 'Adicionar'}
            >
                <common.FormPicker label="Equipamento *" items={equipamentos.map(e => ({ value: e.id, label: `${e.marca} ${e.modelo}` }))} selectedValue={data.equipamentoId} onValueChange={v => setField('equipamentoId', v)} placeholder={loadingEquip ? 'Carregando...' : 'Selecione'} disabled={loadingEquip} />
                {errors.equipamentoId && <common.Text style={common.styles.errorText}>{errors.equipamentoId}</common.Text>}

                <common.ChoiceChips options={[{ label: 'Preventiva', value: 'Preventiva' }, { label: 'Corretiva', value: 'Corretiva' }]} selectedValue={data.tipoRevisao} onValueChange={v => setField('tipoRevisao', v)} />

                <common.Text style={common.styles.formSectionTitle}>Peças Utilizadas</common.Text>
                {pecasUtilizadas.map(peca => (
                    <common.View key={peca.estoqueItemId} style={common.styles.chipItemContainer}>
                        <common.Text>{peca.nome} - {peca.quantidade} {peca.unidade}</common.Text>
                        <common.TouchableOpacity onPress={() => handleRemovePeca(peca.estoqueItemId)}><common.Icon name="close-circle" size={20} color={common.theme.colors.error} /></common.TouchableOpacity>
                    </common.View>
                ))}
                <common.TouchableOpacity style={common.styles.addButton} onPress={() => setIsPecaModalVisible(true)} disabled={loadingPecas}>
                    <common.Text style={common.styles.addButtonText}>{loadingPecas ? 'Carregando Peças...' : 'Adicionar Peça do Estoque'}</common.Text>
                </common.TouchableOpacity>

                <common.FormInput label="Descrição Adicional / Outros Serviços *" value={data.descricaoServico} onChangeText={v => setField('descricaoServico', v)} multiline numberOfLines={3} placeholder="Descreva serviços que não envolvem peças do estoque." />
                {errors.descricaoServico && <common.Text style={common.styles.errorText}>{errors.descricaoServico}</common.Text>}

                <common.FormInput label="Custo de Mão de Obra (R$)" value={String(data.custoMaoDeObra)} onChangeText={v => setField('custoMaoDeObra', v, 'numeric')} keyboardType="numeric" placeholder="Ex: 150.00" />
                {errors.custo && <common.Text style={common.styles.errorText}>{errors.custo}</common.Text>}

                <common.View style={common.styles.summaryBox}>
                    <common.Text>Custo das Peças: R$ {custoPecas.toFixed(2)}</common.Text>
                    <common.Text style={{ fontWeight: 'bold', marginTop: 4 }}>Custo Total: R$ {custoTotal.toFixed(2)}</common.Text>
                </common.View>

                <common.FormInput label="Responsável / Oficina" value={data.responsavel} onChangeText={v => setField('responsavel', v)} placeholder="Ex: Oficina do João" />
                {errors.responsavel && <common.Text style={common.styles.errorText}>{errors.responsavel}</common.Text>}

                <common.FormDateInput label="Data da Revisão" date={data.dataRevisao} onDateChange={v => setField('dataRevisao', v)} maximumDate={new Date()} />
                {errors.dataRevisao && <common.Text style={common.styles.errorText}>{errors.dataRevisao}</common.Text>}
            </common.ModalFormLayout>
            {isPecaModalVisible && <AddPecaModal onClose={() => setIsPecaModalVisible(false)} onAddPeca={handleAddPeca} pecasDisponiveis={pecasEmEstoque} />}
        </>
    );
};

// --- Tela de Listagem refatorada para Firestore com dados em tempo real ---
export const RevisoesListaScreen = ({ navigation }) => {
    const [modal, setModal] = useState({ visible: false, itemId: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // Usa o listener em tempo real do Firestore
    useEffect(() => {
        const unsubscribe = subscribeToCollection('revisoes', (data) => {
            const sortedData = data.sort((a, b) => {
                const dateA = a.dataRevisao?.toDate ? a.dataRevisao.toDate() : 0;
                const dateB = b.dataRevisao?.toDate ? b.dataRevisao.toDate() : 0;
                return dateB - dateA; // Mais recente primeiro
            });
            setItems(sortedData);
            if (loading) setLoading(false);
        });
        // Cancela a inscrição ao desmontar o componente para evitar vazamentos de memória
        return () => unsubscribe();
    }, []);

    const handleSaveSuccess = () => {
        setModal({ visible: false, itemId: null });
    };

    const handleOpenModal = useCallback((itemId = null) => {
        setModal({ visible: true, itemId });
    }, []);

    // Componente de layout de tela (substituindo GenericListScreen)
    const ScreenLayout = ({ children }) => (
        <common.View style={common.styles.container}>
            <common.CustomHeader title="Revisões" navigation={navigation} />
            <common.View style={{ flex: 1, padding: 8 }}>{children}</common.View>
            <common.TouchableOpacity style={common.styles.fab} onPress={() => handleOpenModal(null)}>
                <common.Icon name="add" size={32} color="white" />
            </common.TouchableOpacity>
        </common.View>
    );

    return (
        <>
            <ScreenLayout>
                {loading ? (
                    <common.ActivityIndicator style={{ marginTop: 20 }} size="large" color={common.theme.colors.primary} />
                ) : items.length === 0 ? (
                    <common.Text style={common.styles.emptyListText}>Nenhuma revisão encontrada.</common.Text>
                ) : (
                    <common.FlatList
                        data={items}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <common.TouchableOpacity style={common.styles.listItemContainer} onPress={() => handleOpenModal(item.id)}>
                                <common.View style={common.styles.listItemIconContainer}>
                                    <common.FontAwesome name="wrench" size={28} color={item.tipoRevisao === 'Corretiva' ? common.theme.colors.error : common.theme.colors.primary} />
                                </common.View>
                                <common.View style={common.styles.listItemContent}>
                                    <common.Text style={common.styles.listItemTitle}>{item.equipamentoNome || 'Revisão Geral'}</common.Text>
                                    <common.Text style={common.styles.listItemSubtitle}>
                                        {item.dataRevisao?.toDate().toLocaleDateString('pt-BR')} • {item.tipoRevisao}
                                        {item.custoTotal > 0 && ` • R$ ${parseFloat(item.custoTotal).toFixed(2)}`}
                                    </common.Text>
                                </common.View>
                                <common.Icon name="chevron-forward" size={24} color={common.theme.colors.alternate} />
                            </common.TouchableOpacity>
                        )}
                    />
                )}
            </ScreenLayout>
            {modal.visible && <AddOrEditRevisaoModal itemId={modal.itemId} onClose={() => setModal({ visible: false, itemId: null })} onSaveSuccess={handleSaveSuccess} />}
        </>
    );
};