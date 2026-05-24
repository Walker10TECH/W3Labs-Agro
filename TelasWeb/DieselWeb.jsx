// -----------------------------------------------------------------------------
// Diesel.jsx
//
// Módulo de Gestão de Estoque e Consumo de Diesel.
// Adaptado EXCLUSIVAMENTE PARA WEB.
// Integrado ao Firestore, responsivo para Web (Desktop e Mobile).
// -----------------------------------------------------------------------------
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig'; // Ajuste o caminho se necessário

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
    error: '#E53935',
    warning: '#F57C00',
};

const VALIDATION_LIMITS = {
    MAX_LITROS_ENTRADA: 50000,
    MAX_LITROS_SAIDA: 2000,
};

const CONTAINS_ONLY_NUMBERS_REGEX = /^\d+$/;

// =====================================================================
// 2️⃣ FUNÇÕES UTILITÁRIAS E HOOKS
// =====================================================================

const parseMoeda = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    let sanitized = value.toString().replace(/[^0-9,.]/g, '');
    if (sanitized.includes(',')) {
        sanitized = sanitized.replace(/\./g, '').replace(',', '.');
    }
    return parseFloat(sanitized) || 0;
};

const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
        const dateObj = date.toDate ? date.toDate() : (typeof date === 'string' ? new Date(date) : date);
        return dateObj.toLocaleDateString('pt-BR');
    } catch (error) {
        return 'Data inválida';
    }
};

// Hook Customizado para Responsividade na Web
const useWindowDimensions = () => {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return { width };
};

// Hook Customizado para Firestore
const useFirestoreCollection = (collectionName, options = {}) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth.currentUser) {
            setLoading(false);
            return;
        }
        const userId = auth.currentUser.uid;
        const q = query(
            collection(db, `users/${userId}/${collectionName}`),
            orderBy(options.sortBy || 'data', options.order || 'desc')
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const data = querySnapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                data: d.data().data?.toDate ? d.data().data.toDate() : new Date(),
            }));
            setItems(data);
            setLoading(false);
        }, (err) => {
            console.error(`Erro ${collectionName}:`, err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [collectionName, options.sortBy, options.order]);

    return { items, loading };
};

// =====================================================================
// 3️⃣ ÍCONES SVG INLINE (Sem dependências externas)
// =====================================================================
const Icons = {
    ArrowBack: ({ size = 24, color = "currentColor" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
    ),
    Close: ({ size = 24, color = "currentColor" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    ),
    Add: ({ size = 24, color = "currentColor" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
    ),
    GasPump: ({ size = 24, color = "currentColor" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22v-8c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v8" /><path d="M5 12V6c0-1.1.9-2 2-2h.01" /><path d="M9 4h.01" /><path d="M3 22h8" /><path d="M11 15h4v-3a2 2 0 0 1 2-2h2.5" /><path d="M19.5 10A2.5 2.5 0 0 1 22 12.5V17a2 2 0 0 1-2 2h-1" /></svg>
    ),
    Tractor: ({ size = 24, color = "currentColor" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14h2l2-3V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4l3 3h3v2h-2.5" /><circle cx="7" cy="17" r="3" /><circle cx="17" cy="17" r="3" /></svg>
    )
};

// =====================================================================
// 4️⃣ COMPONENTES DE UI REUTILIZÁVEIS
// =====================================================================

const CustomHeader = ({ title, onBack }) => (
    <div style={styles.fullHeader}>
        <div style={styles.headerContent}>
            <button onClick={onBack} style={styles.backButton}>
                <Icons.ArrowBack size={26} color={THEME.textWhite} />
            </button>
            <span style={styles.headerTitle}>{title}</span>
            <div style={{ width: 26 }} />
        </div>
    </div>
);

const FormInput = ({ label, placeholder, value, onChangeText, required, type = 'text', disabled = false, error, multiline = false }) => (
    <div style={styles.inputContainer}>
        <label style={styles.formLabel}>{label} {required && <span style={{ color: THEME.primary }}>*</span>}</label>
        {multiline ? (
            <textarea
                style={{ ...styles.input, height: 100, resize: 'vertical', ...(error ? styles.inputError : {}), ...(disabled ? styles.inputDisabled : {}) }}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChangeText(e.target.value)}
                disabled={disabled}
            />
        ) : (
            <input
                style={{ ...styles.input, ...(error ? styles.inputError : {}), ...(disabled ? styles.inputDisabled : {}) }}
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChangeText(e.target.value)}
                disabled={disabled}
            />
        )}
        {error && <span style={styles.errorText}>{error}</span>}
    </div>
);

const FormSelect = ({ label, placeholder, value, onValueChange, items, required, error }) => (
    <div style={styles.inputContainer}>
        <label style={styles.formLabel}>{label} {required && <span style={{ color: THEME.primary }}>*</span>}</label>
        <select
            style={{ ...styles.selectBox, ...(error ? styles.inputError : {}) }}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
        >
            <option value="" disabled>{placeholder}</option>
            {items.map((item, index) => (
                <option key={index} value={item.value}>{item.label}</option>
            ))}
        </select>
        {error && <span style={styles.errorText}>{error}</span>}
    </div>
);

const FormDate = ({ label, value, onChange }) => {
    // Formata a data para YYYY-MM-DD para o input type="date"
    const dateValue = value instanceof Date && !isNaN(value) ? value.toISOString().split('T')[0] : '';

    return (
        <div style={styles.inputContainer}>
            <label style={styles.formLabel}>{label}</label>
            <input
                type="date"
                style={styles.input}
                value={dateValue}
                onChange={(e) => {
                    if (e.target.value) {
                        // Adiciona tempo neutro para evitar problemas de fuso horário
                        onChange(new Date(`${e.target.value}T12:00:00`));
                    }
                }}
            />
        </div>
    );
};

// =====================================================================
// 5️⃣ MODAIS DE REGISTRO
// =====================================================================

const AddEstoqueDieselModal = ({ visible, onClose, isDesktop }) => {
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState({ litros: '', data: new Date(), observacoes: '', fornecedor: '' });
    const [errors, setErrors] = useState({});

    if (!visible) return null;

    const setField = (field, value, type = 'text') => {
        setData(prev => ({ ...prev, [field]: type === 'numeric' ? value.replace(/[^0-9,.]/g, '') : value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    const validate = () => {
        const errs = {};
        const litros = parseMoeda(data.litros);
        if (!data.litros || litros <= 0) errs.litros = 'Quantidade obrigatória.';
        else if (litros > VALIDATION_LIMITS.MAX_LITROS_ENTRADA) errs.litros = `Máx: ${VALIDATION_LIMITS.MAX_LITROS_ENTRADA}L`;

        if (data.fornecedor.trim() && CONTAINS_ONLY_NUMBERS_REGEX.test(data.fornecedor.trim())) errs.fornecedor = 'Inválido.';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const onSave = async () => {
        if (!validate()) return window.alert('Corrija os campos com erro.');
        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const docRef = doc(collection(db, `users/${uid}/dieselEstoque`));
            await setDoc(docRef, {
                litros: parseMoeda(data.litros),
                data: data.data,
                observacoes: data.observacoes.trim(),
                fornecedor: data.fornecedor.trim(),
                tipo: 'entrada',
                createdAt: serverTimestamp(),
                userId: uid,
            });
            onClose();
        } catch (e) { window.alert('Erro: Falha ao salvar.'); }
        setSaving(false);
    };

    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={{ ...styles.modalContent, ...(isDesktop ? styles.modalContentDesktop : {}) }} onClick={e => e.stopPropagation()}>
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>Comprar Diesel (Entrada)</span>
                    <button style={styles.closeButton} onClick={onClose}><Icons.Close size={20} /></button>
                </div>
                <div style={styles.modalBody}>
                    <FormInput label="Litros Adquiridos" value={data.litros} onChangeText={v => setField('litros', v, 'numeric')} type="number" required error={errors.litros} placeholder="Ex: 1000" />
                    <FormInput label="Fornecedor" value={data.fornecedor} onChangeText={v => setField('fornecedor', v)} error={errors.fornecedor} />
                    <FormDate label="Data da Compra" value={data.data} onChange={d => setField('data', d)} />
                    <FormInput label="Observações" value={data.observacoes} onChangeText={v => setField('observacoes', v)} multiline />

                    <button style={styles.saveButton} onClick={onSave} disabled={saving}>
                        {saving ? 'Salvando...' : 'Adicionar ao Estoque'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AddOrEditDieselModal = ({ visible, itemId, onClose, estoqueAtual, isDesktop }) => {
    const { items: equipamentos, loading: loadingEquip } = useFirestoreCollection('inventario', { sortBy: 'marca', order: 'asc' });
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!itemId);
    const originalItem = useRef(null);
    const [data, setData] = useState({ data: new Date(), equipamentoId: '', litros: '', odometro: '', observacoes: '', localAbastecimento: '' });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!itemId) return;
        (async () => {
            setLoading(true);
            try {
                const docSnap = await getDoc(doc(db, `users/${auth.currentUser.uid}/diesel`, itemId));
                if (docSnap.exists()) {
                    const item = docSnap.data();
                    const itemData = { ...item, id: docSnap.id, data: item.data?.toDate ? item.data.toDate() : new Date(), litros: String(item.litros), odometro: item.odometro ? String(item.odometro) : '' };
                    setData(itemData);
                    originalItem.current = itemData;
                }
            } catch (e) { } setLoading(false);
        })();
    }, [itemId]);

    if (!visible) return null;

    const setField = (field, value, type = 'text') => {
        setData(prev => ({ ...prev, [field]: type === 'numeric' ? value.replace(/[^0-9,.]/g, '') : value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    const validate = () => {
        const errs = {};
        const litros = parseMoeda(data.litros);

        if (!data.equipamentoId) errs.equipamentoId = 'Obrigatório.';
        if (!data.litros || litros <= 0) errs.litros = 'Quantidade inválida.';
        else if (litros > VALIDATION_LIMITS.MAX_LITROS_SAIDA) errs.litros = `Máx permitido: ${VALIDATION_LIMITS.MAX_LITROS_SAIDA}L`;
        else {
            const originalLitros = originalItem.current ? parseFloat(originalItem.current.litros) : 0;
            if (litros > (estoqueAtual + originalLitros)) errs.litros = `Estoque insuficiente. Resta: ${estoqueAtual}L`;
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const onSave = async () => {
        if (!validate()) return window.alert('Corrija os campos obrigatórios e verifique o estoque.');
        setSaving(true);
        try {
            const uid = auth.currentUser.uid;
            const equip = equipamentos.find(e => e.id === data.equipamentoId);
            const docRef = itemId ? doc(db, `users/${uid}/diesel`, itemId) : doc(collection(db, `users/${uid}/diesel`));

            await setDoc(docRef, {
                data: data.data,
                equipamentoId: data.equipamentoId,
                equipamentoNome: equip ? `${equip.marca} ${equip.modelo}` : 'N/A',
                litros: parseMoeda(data.litros),
                odometro: data.odometro ? parseMoeda(data.odometro) : null,
                observacoes: data.observacoes.trim(),
                localAbastecimento: data.localAbastecimento.trim(),
                userId: uid,
                updatedAt: serverTimestamp(),
                ...(!itemId ? { createdAt: serverTimestamp() } : {})
            }, { merge: true });

            onClose();
        } catch (e) { window.alert('Erro: Falha ao salvar.'); }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (window.confirm('Deseja realmente excluir este abastecimento?')) {
            await deleteDoc(doc(db, `users/${auth.currentUser.uid}/diesel`, itemId));
            onClose();
        }
    };

    if (loading || loadingEquip) {
        return <div style={styles.modalOverlay}><div style={{ color: '#fff' }}>Carregando...</div></div>;
    }

    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={{ ...styles.modalContent, ...(isDesktop ? styles.modalContentDesktop : {}) }} onClick={e => e.stopPropagation()}>
                <div style={styles.modalHeader}>
                    <span style={styles.modalTitle}>{itemId ? 'Editar Abastecimento' : 'Registrar Abastecimento'}</span>
                    <button style={styles.closeButton} onClick={onClose}><Icons.Close size={20} /></button>
                </div>
                <div style={styles.modalBody}>
                    <FormSelect
                        label="Máquina" placeholder="Selecione o equipamento" required
                        items={equipamentos.map(e => ({ value: e.id, label: `${e.marca} ${e.modelo}` }))}
                        value={data.equipamentoId} onValueChange={v => setField('equipamentoId', v)} error={errors.equipamentoId}
                    />
                    <div style={styles.row}>
                        <div style={{ flex: 1 }}><FormInput label="Litros" value={data.litros} onChangeText={v => setField('litros', v, 'numeric')} type="number" required error={errors.litros} /></div>
                        <div style={{ flex: 1, marginLeft: 10 }}><FormInput label="Horímetro/Odômetro" value={data.odometro} onChangeText={v => setField('odometro', v, 'numeric')} type="number" error={errors.odometro} /></div>
                    </div>
                    <FormInput label="Local do Abastecimento" value={data.localAbastecimento} onChangeText={v => setField('localAbastecimento', v)} />
                    <FormDate label="Data do Abastecimento" value={data.data} onChange={d => setField('data', d)} />
                    <FormInput label="Observações" value={data.observacoes} onChangeText={v => setField('observacoes', v)} multiline />

                    <button style={styles.saveButton} onClick={onSave} disabled={saving}>
                        {saving ? 'Salvando...' : 'Salvar Abastecimento'}
                    </button>
                    {itemId && (
                        <button style={styles.deleteButton} onClick={handleDelete}>
                            Excluir Abastecimento
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// =====================================================================
// 6️⃣ COMPONENTE DE GRÁFICO 
// =====================================================================

const WebDieselChart = ({ abastecimentos }) => {
    const chartData = useMemo(() => {
        const dataMap = {};
        abastecimentos.forEach(item => {
            const dateStr = formatDate(item.data).substring(0, 5);
            const litros = parseFloat(item.litros) || 0;
            dataMap[dateStr] = (dataMap[dateStr] || 0) + litros;
        });

        const sortedDates = Object.keys(dataMap).sort((a, b) => {
            const [d1, m1] = a.split('/');
            const [d2, m2] = b.split('/');
            // Considerando o ano atual dinamicamente ou fixo conforme a regra de negócio
            const year = new Date().getFullYear();
            return new Date(year, m1 - 1, d1) - new Date(year, m2 - 1, d2);
        });

        const recentDates = sortedDates.slice(-7);
        if (recentDates.length === 0) return null;

        const maxLitros = Math.max(...recentDates.map(d => dataMap[d]), 1);

        return recentDates.map(date => ({
            date,
            litros: dataMap[date],
            heightPercent: (dataMap[date] / maxLitros) * 100
        }));
    }, [abastecimentos]);

    if (!chartData) return null;

    return (
        <div style={styles.chartCard}>
            <span style={styles.chartTitle}>Consumo Recente Diário (L)</span>
            <div style={styles.webChartContainer}>
                {chartData.map((item, index) => (
                    <div key={index} style={styles.barWrapper}>
                        <span style={styles.barLabelTop}>{item.litros.toFixed(0)}</span>
                        <div style={styles.barTrack}>
                            <div style={{ ...styles.barFill, height: `${item.heightPercent}%` }} />
                        </div>
                        <span style={styles.barLabelBottom}>{item.date}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// =====================================================================
// 7️⃣ TELA PRINCIPAL (DASHBOARD DO DIESEL)
// =====================================================================

export default function DieselScreen({ navigation }) {
    const { width } = useWindowDimensions();
    const isDesktop = width > 800;

    const { items: abastecimentos, loading: loadA } = useFirestoreCollection('diesel');
    const { items: estoque, loading: loadE } = useFirestoreCollection('dieselEstoque');

    const [modalEstoque, setModalEstoque] = useState(false);
    const [modalAbastecimento, setModalAbastecimento] = useState({ visible: false, itemId: null });

    const estoqueAtual = useMemo(() => {
        if (loadE || loadA) return 0;
        const entradas = estoque.filter(e => e.tipo === 'entrada').reduce((sum, e) => sum + (parseFloat(e.litros) || 0), 0);
        const saidas = abastecimentos.reduce((sum, a) => sum + (parseFloat(a.litros) || 0), 0);
        return entradas - saidas;
    }, [estoque, abastecimentos, loadE, loadA]);

    const handleOpenAbastecimento = (id = null) => {
        if (!id && estoqueAtual <= 0) {
            return window.alert("Estoque Vazio: Adicione uma compra de diesel primeiro.");
        }
        setModalAbastecimento({ visible: true, itemId: id });
    };

    return (
        <div style={styles.container}>
            <CustomHeader title="Controle de Diesel" onBack={() => { /* Lógica de navegação web (ex: router.back()) */ }} />

            <div style={styles.webContainer}>
                <div style={styles.scrollContent}>

                    {/* CARD RESUMO DE ESTOQUE */}
                    <div style={{ ...styles.summaryCard, ...(isDesktop ? styles.summaryCardDesktop : {}) }}>
                        <div style={isDesktop ? { flex: 1 } : {}}>
                            <span style={styles.summaryTitle}>Estoque no Reservatório</span>
                            {loadE || loadA ? (
                                <div style={{ marginTop: 10, color: THEME.primary }}>Carregando...</div>
                            ) : (
                                <div style={{
                                    ...styles.summaryValue,
                                    color: estoqueAtual <= 0 ? THEME.error : (estoqueAtual <= 100 ? THEME.warning : THEME.primary)
                                }}>
                                    {estoqueAtual.toFixed(1)} L
                                </div>
                            )}
                        </div>

                        <div style={{ ...styles.summaryActions, ...(isDesktop ? styles.summaryActionsDesktop : {}) }}>
                            <button style={styles.btnSecondary} onClick={() => setModalEstoque(true)}>
                                <Icons.Add size={20} color={THEME.primary} />
                                <span style={styles.btnSecondaryText}>Comprar</span>
                            </button>
                            <button style={styles.btnPrimary} onClick={() => handleOpenAbastecimento(null)}>
                                <Icons.GasPump size={16} color={THEME.textWhite} />
                                <span style={styles.btnPrimaryText}>Abastecer</span>
                            </button>
                        </div>
                    </div>

                    {/* GRÁFICO DE CONSUMO */}
                    <WebDieselChart abastecimentos={abastecimentos} />

                    {/* HISTÓRICO DE SAÍDAS */}
                    <span style={styles.historyTitle}>Histórico de Abastecimentos</span>
                    {loadA ? (
                        <div style={{ marginTop: 20, textAlign: 'center', color: THEME.primary }}>Carregando histórico...</div>
                    ) : abastecimentos.length === 0 ? (
                        <div style={styles.emptyContainer}>
                            <Icons.GasPump size={50} color="#D0D0D0" />
                            <span style={styles.emptyText}>Nenhum abastecimento registrado.</span>
                        </div>
                    ) : (
                        abastecimentos.map(item => (
                            <button key={item.id} style={styles.listItem} onClick={() => handleOpenAbastecimento(item.id)}>
                                <div style={styles.listIconBox}>
                                    <Icons.Tractor size={20} color={THEME.primary} />
                                </div>
                                <div style={styles.listContent}>
                                    <span style={styles.listTitle}>{item.equipamentoNome}</span>
                                    <span style={styles.listSubtitle}>{formatDate(item.data)} • {item.odometro ? `${item.odometro}h` : 'Sem hora'}</span>
                                </div>
                                <span style={styles.listLiters}>{parseFloat(item.litros).toFixed(1)} L</span>
                            </button>
                        ))
                    )}
                </div>

                <AddEstoqueDieselModal visible={modalEstoque} isDesktop={isDesktop} onClose={() => setModalEstoque(false)} />
                <AddOrEditDieselModal visible={modalAbastecimento.visible} isDesktop={isDesktop} itemId={modalAbastecimento.itemId} onClose={() => setModalAbastecimento({ visible: false, itemId: null })} estoqueAtual={estoqueAtual} />
            </div>
        </div>
    );
}

// =====================================================================
// 8️⃣ ESTILOS GERAIS (Objetos JS para DOM CSS)
// =====================================================================

const styles = {
    container: { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: THEME.background, fontFamily: 'system-ui, -apple-system, sans-serif' },
    webContainer: { display: 'flex', flexDirection: 'column', flex: 1, width: '100%', maxWidth: '1000px', margin: '0 auto' },
    scrollContent: { padding: '15px', paddingBottom: '60px', flex: 1, overflowY: 'auto' },
    row: { display: 'flex', flexDirection: 'row' },

    // Header
    fullHeader: { backgroundColor: THEME.primary, width: '100%', display: 'flex', justifyContent: 'center' },
    headerContent: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '0 15px', height: '60px', width: '100%', maxWidth: '1000px', boxSizing: 'border-box' },
    backButton: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    headerTitle: { color: THEME.textWhite, fontSize: '22px', fontWeight: 'bold' },

    // Resumo
    summaryCard: { backgroundColor: THEME.secondary, borderRadius: '15px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', marginBottom: '20px' },
    summaryCardDesktop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryTitle: { fontSize: '18px', color: THEME.secondaryText, fontWeight: '600' },
    summaryValue: { fontSize: '48px', fontWeight: 'bold', margin: '10px 0' },
    summaryActions: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: '10px', gap: '10px' },
    summaryActionsDesktop: { width: '350px', marginTop: '0' },
    btnPrimary: { flex: 1, backgroundColor: THEME.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60px', borderRadius: '10px', border: 'none', cursor: 'pointer' },
    btnPrimaryText: { color: THEME.textWhite, fontWeight: 'bold', marginLeft: '8px', fontSize: '18px' },
    btnSecondary: { flex: 1, backgroundColor: THEME.grayInput, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60px', borderRadius: '10px', border: 'none', cursor: 'pointer' },
    btnSecondaryText: { color: THEME.primary, fontWeight: 'bold', marginLeft: '5px', fontSize: '18px' },

    // Gráfico
    chartCard: { backgroundColor: THEME.secondary, borderRadius: '15px', padding: '15px', marginBottom: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' },
    chartTitle: { fontSize: '20px', fontWeight: 'bold', color: THEME.textBlack, display: 'block', marginBottom: '10px' },
    webChartContainer: { display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: '140px', marginTop: '10px' },
    barWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: '60px' },
    barTrack: { width: '14px', height: '100px', backgroundColor: THEME.grayInput, borderRadius: '7px', display: 'flex', alignItems: 'flex-end', margin: '6px 0', overflow: 'hidden' },
    barFill: { width: '100%', backgroundColor: THEME.primary, borderRadius: '7px', transition: 'height 0.3s ease' },
    barLabelTop: { fontSize: '14px', color: THEME.primary, fontWeight: 'bold' },
    barLabelBottom: { fontSize: '14px', color: THEME.secondaryText },

    // Histórico
    historyTitle: { fontSize: '22px', fontWeight: 'bold', color: THEME.textBlack, marginBottom: '10px', marginLeft: '5px', display: 'block' },
    emptyContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px' },
    emptyText: { color: THEME.secondaryText, marginTop: '10px', fontSize: '18px' },
    listItem: { display: 'flex', flexDirection: 'row', backgroundColor: THEME.secondary, padding: '15px', borderRadius: '12px', alignItems: 'center', marginBottom: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' },
    listIconBox: { width: '44px', height: '44px', backgroundColor: THEME.grayInput, borderRadius: '22px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: '15px', flexShrink: 0 },
    listContent: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    listTitle: { fontSize: '20px', fontWeight: 'bold', color: THEME.textBlack, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    listSubtitle: { fontSize: '14px', color: THEME.secondaryText, marginTop: '3px' },
    listLiters: { fontSize: '20px', fontWeight: 'bold', color: THEME.primary },

    // Modais e Inputs
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 1000 },
    modalContent: { backgroundColor: THEME.secondary, borderRadius: '20px 20px 0 0', padding: '20px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' },
    modalContentDesktop: { width: '600px', borderRadius: '20px', maxHeight: '85vh', alignSelf: 'center', marginBottom: 'auto', marginTop: 'auto' },
    modalHeader: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    modalTitle: { fontSize: '24px', fontWeight: 'bold', color: THEME.textBlack },
    closeButton: { backgroundColor: THEME.grayInput, border: 'none', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modalBody: { overflowY: 'auto', flex: 1, paddingRight: '5px' },

    inputContainer: { marginBottom: '15px', display: 'flex', flexDirection: 'column' },
    formLabel: { fontSize: '16px', color: THEME.secondaryText, marginBottom: '6px', fontWeight: '500' },
    input: { backgroundColor: THEME.grayInput, borderRadius: '8px', padding: '0 15px', height: '50px', fontSize: '16px', color: THEME.textBlack, border: '1px solid transparent', outline: 'none', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit' },
    inputError: { border: `1px solid ${THEME.error}` },
    inputDisabled: { opacity: 0.6, cursor: 'not-allowed' },
    selectBox: { backgroundColor: THEME.grayInput, borderRadius: '8px', padding: '0 15px', height: '50px', fontSize: '16px', color: THEME.textBlack, border: '1px solid transparent', outline: 'none', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit', cursor: 'pointer' },
    errorText: { color: THEME.error, fontSize: '12px', marginTop: '4px' },

    saveButton: { backgroundColor: THEME.primary, borderRadius: '8px', height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '10px', marginBottom: '10px', border: 'none', color: THEME.textWhite, fontWeight: 'bold', fontSize: '20px', cursor: 'pointer', width: '100%' },
    deleteButton: { backgroundColor: 'transparent', border: `1px solid ${THEME.error}`, borderRadius: '8px', height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px', color: THEME.error, fontWeight: 'bold', fontSize: '18px', cursor: 'pointer', width: '100%' }
};