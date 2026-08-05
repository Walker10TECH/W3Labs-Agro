import {
    AlertTriangle,
    Building2,
    Check,
    Clock,
    Copy,
    Crown,
    Edit3,
    Filter,
    KeyRound,
    Mail,
    Plus,
    RefreshCw,
    Search,
    Share2,
    Sparkles,
    Trash2,
    UserCheck,
    UserMinus,
    UserPlus,
    Users,
    X
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { usePropertyAuth } from '../context/PropertyContext';

export default function PropertyControlModal({ onClose }) {
    const {
        user,
        userProfile,
        role,
        isAdmin,
        isMember,
        propertyName,
        propertyCode,
        adminNome,
        members,
        invites,
        changePropertyName,
        connectToProperty,
        deleteMember,
        addMemberByEmailInput,
        cancelInvite,
        getAvailableUsers,
    } = usePropertyAuth();

    // Estados de edição de propriedade
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState(propertyName || '');
    const [savingName, setSavingName] = useState(false);
    const [copied, setCopied] = useState(false);

    // Adição de membro por e-mail e Auto-filtro
    const [emailInput, setEmailInput] = useState('');
    const [addingEmail, setAddingEmail] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [userFilterTab, setUserFilterTab] = useState('all'); // 'all' | 'available' | 'connected'

    // Contas carregadas do Firebase
    const [firebaseUsers, setFirebaseUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Modal de Confirmação de Remoção de Membro
    const [memberToRemove, setMemberToRemove] = useState(null); // { uid, id, nome, email }
    const [removingMember, setRemovingMember] = useState(false);

    // Conectar a nova propriedade (Membro trocando)
    const [newCodeInput, setNewCodeInput] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text: '' }

    // Carrega contas do Firebase assim que o modal abre (para o Admin)
    useEffect(() => {
        if (isAdmin) {
            loadFirebaseUsers();
        }
    }, [isAdmin]);

    // Carrega usuários registrados no Firebase
    const loadFirebaseUsers = async () => {
        setLoadingUsers(true);
        try {
            const res = await getAvailableUsers();
            if (res.success) {
                setFirebaseUsers(res.users || []);
            }
        } catch (e) {
            console.error("Erro ao carregar usuários do Firebase:", e);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleSaveName = async () => {
        if (!newName.trim()) return;
        setSavingName(true);
        setFeedback(null);
        try {
            const res = await changePropertyName(newName.trim());
            if (res.success) {
                setIsEditingName(false);
                setFeedback({ type: 'success', text: 'Nome da propriedade atualizado com sucesso!' });
            } else {
                setFeedback({ type: 'error', text: res.error || 'Erro ao atualizar nome.' });
            }
        } catch (e) {
            setFeedback({ type: 'error', text: 'Erro ao salvar.' });
        } finally {
            setSavingName(false);
        }
    };

    const handleCopyCode = () => {
        if (!propertyCode) return;
        navigator.clipboard?.writeText(propertyCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleShareWhatsapp = (targetEmail = null) => {
        if (!propertyCode) return;
        const extraNote = targetEmail ? ` para o e-mail: ${targetEmail}` : '';
        const text = encodeURIComponent(
            `🌾 *Acesso AgroFrank - Fazenda ${propertyName}*\n\n` +
            `Você foi adicionado à equipe da nossa fazenda no AgroFrank${extraNote}!\n` +
            `🔑 *Código de Acesso da Propriedade:* \`${propertyCode}\`\n\n` +
            `Acesse a plataforma, faça login ou cadastre-se com seu e-mail para visualizar todos os módulos e dados da fazenda em tempo real.`
        );
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    };

    // Adiciona o usuário pelo e-mail digitado no input
    const handleAddMemberByEmail = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!emailInput.trim()) return;

        setAddingEmail(true);
        setFeedback(null);
        setIsInputFocused(false);

        try {
            const res = await addMemberByEmailInput(emailInput.trim());
            if (res.success) {
                setFeedback({
                    type: 'success',
                    text: res.message || 'Membro adicionado com sucesso!'
                });
                setEmailInput('');
                loadFirebaseUsers();
            } else {
                setFeedback({
                    type: 'error',
                    text: res.error || 'Erro ao adicionar membro por e-mail.'
                });
            }
        } catch (err) {
            setFeedback({ type: 'error', text: 'Erro ao processar adição por e-mail.' });
        } finally {
            setAddingEmail(false);
        }
    };

    // Adiciona instantaneamente ao clicar na sugestão filtrada
    const handleSelectAndAddUser = async (targetUser) => {
        if (!targetUser?.email) return;
        setEmailInput(targetUser.email);
        setAddingEmail(true);
        setFeedback(null);
        setIsInputFocused(false);

        try {
            const res = await addMemberByEmailInput(targetUser.email);
            if (res.success) {
                setFeedback({
                    type: 'success',
                    text: res.message || `Conta "${targetUser.nome || targetUser.email}" vinculada com sucesso à equipe!`
                });
                setEmailInput('');
                loadFirebaseUsers();
            } else {
                setFeedback({ type: 'error', text: res.error || 'Erro ao vincular conta.' });
            }
        } catch (e) {
            setFeedback({ type: 'error', text: 'Erro ao vincular conta do Firebase.' });
        } finally {
            setAddingEmail(false);
        }
    };

    // Abre modal de confirmação para remoção de membro
    const promptRemoveMember = (member) => {
        setMemberToRemove({
            id: member.id || member.memberUid || member.uid,
            uid: member.memberUid || member.uid || member.id,
            nome: member.nome || 'Membro',
            email: member.email || '',
        });
    };

    // Executa a remoção do membro de forma definitiva e segura
    const handleConfirmRemoveMember = async () => {
        if (!memberToRemove) return;
        setRemovingMember(true);
        setFeedback(null);

        try {
            const identifier = memberToRemove.id || memberToRemove.uid;
            const res = await deleteMember(identifier, memberToRemove.email);

            if (res.success) {
                setFeedback({
                    type: 'success',
                    text: `Membro "${memberToRemove.nome}" removido da propriedade com sucesso.`
                });
                setMemberToRemove(null);
                loadFirebaseUsers();
            } else {
                setFeedback({
                    type: 'error',
                    text: res.error || 'Erro ao remover membro da propriedade.'
                });
            }
        } catch (e) {
            setFeedback({ type: 'error', text: 'Erro ao processar a remoção do membro.' });
        } finally {
            setRemovingMember(false);
        }
    };

    const handleCancelInvite = async (inviteId, email) => {
        if (!window.confirm(`Deseja cancelar o convite para "${email}"?`)) return;
        try {
            const res = await cancelInvite(inviteId, email);
            if (res.success) {
                setFeedback({ type: 'success', text: `Convite para ${email} cancelado.` });
                loadFirebaseUsers();
            } else {
                setFeedback({ type: 'error', text: res.error || 'Erro ao cancelar convite.' });
            }
        } catch (e) {
            setFeedback({ type: 'error', text: 'Erro ao cancelar convite.' });
        }
    };

    const handleConnectNewCode = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!newCodeInput.trim()) return;

        setConnecting(true);
        setFeedback(null);
        try {
            const res = await connectToProperty(newCodeInput.trim());
            if (res.success) {
                setFeedback({
                    type: 'success',
                    text: `Conectado com sucesso à fazenda "${res.property.propriedadeNome}"!`
                });
                setNewCodeInput('');
            } else {
                setFeedback({
                    type: 'error',
                    text: res.error || 'Código não encontrado.'
                });
            }
        } catch (err) {
            setFeedback({ type: 'error', text: 'Erro ao conectar à propriedade.' });
        } finally {
            setConnecting(false);
        }
    };

    // Filtra lista de contas do Firebase dinamicamente
    const filteredUsers = firebaseUsers.filter(u => {
        const q = emailInput.trim().toLowerCase();
        
        // Filtro por texto
        const matchText = !q || 
            (u.nome && u.nome.toLowerCase().includes(q)) || 
            (u.email && u.email.toLowerCase().includes(q));

        if (!matchText) return false;

        // Filtro por abas
        if (userFilterTab === 'available') return !u.isAlreadyMember;
        if (userFilterTab === 'connected') return u.isAlreadyMember;
        return true;
    });

    const isExactMatch = firebaseUsers.some(u => u.email.toLowerCase() === emailInput.trim().toLowerCase());

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-green-700 text-white p-5 sm:p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-white backdrop-blur-md">
                            {isAdmin ? <Crown size={22} className="text-amber-300" /> : <Building2 size={22} className="text-emerald-200" />}
                        </div>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-200 flex items-center gap-1.5">
                                {isAdmin ? 'Gestão da Propriedade & Equipe' : 'Minha Propriedade Vinculada'}
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black text-white">
                                {propertyName}
                            </h2>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                        title="Fechar"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50">
                    
                    {/* Feedback Alert */}
                    {feedback && (
                        <div className={`p-3.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-between shadow-sm animate-fadeIn ${
                            feedback.type === 'error' 
                                ? 'bg-red-50 text-red-900 border border-red-200' 
                                : 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                        }`}>
                            <span>{feedback.text}</span>
                            <button onClick={() => setFeedback(null)} className="cursor-pointer text-slate-500 hover:text-black">
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {/* Role & Access Card */}
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${
                                isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                                {isAdmin ? <Crown size={24} /> : <UserCheck size={24} />}
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Seu Papel Atual</div>
                                <div className="text-base font-black text-slate-800">
                                    {isAdmin ? '👑 Administrador Geral' : '👤 Membro da Fazenda'}
                                </div>
                                <div className="text-xs text-slate-600 mt-0.5">
                                    {isAdmin 
                                        ? 'Controle total sobre cadastros, talhões, máquinas e equipe.' 
                                        : 'Acesso em tempo real em modo somente visualização (10 opções).'}
                                </div>
                            </div>
                        </div>

                        {isAdmin && (
                            <div className="shrink-0">
                                {isEditingName ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                                            placeholder="Nome da Fazenda"
                                        />
                                        <button
                                            onClick={handleSaveName}
                                            disabled={savingName}
                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                                        >
                                            {savingName ? '...' : 'Salvar'}
                                        </button>
                                        <button
                                            onClick={() => setIsEditingName(false)}
                                            className="px-2 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => {
                                             setNewName(propertyName);
                                             setIsEditingName(true);
                                        }}
                                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
                                    >
                                        <Edit3 size={14} />
                                        <span>Renomear Fazenda</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* SE ADMIN: FERRAMENTA DE FILTRAGEM INTELIGENTE DE E-MAILS & ADIÇÃO/REMOÇÃO DIRETA */}
                    {isAdmin && (
                        <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-emerald-500/30 shadow-md space-y-3 relative">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                                        <Filter size={15} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                            Filtro Inteligente de E-mails & Contas do Firebase
                                        </h3>
                                        <div className="text-[11px] text-slate-500">
                                            Digite para filtrar contas em tempo real ou selecione uma abaixo para adicionar instantaneamente.
                                        </div>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={loadFirebaseUsers}
                                    className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                    title="Atualizar lista do Firebase"
                                >
                                    <RefreshCw size={14} className={loadingUsers ? 'animate-spin text-emerald-600' : ''} />
                                </button>
                            </div>

                            {/* Campo de Busca & Filtragem com Autocomplete Integrado */}
                            <div className="relative">
                                <form onSubmit={handleAddMemberByEmail} className="flex flex-col sm:flex-row items-center gap-2">
                                    <div className="relative w-full sm:flex-1">
                                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            required
                                            placeholder="Digite o e-mail ou nome da conta..."
                                            value={emailInput}
                                            onFocus={() => setIsInputFocused(true)}
                                            onChange={(e) => {
                                                setEmailInput(e.target.value);
                                                setIsInputFocused(true);
                                            }}
                                            className="w-full bg-slate-50 border-2 border-slate-200 focus:border-emerald-500 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:bg-white font-medium transition-all"
                                        />
                                        {emailInput.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setEmailInput('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={addingEmail || !emailInput.trim()}
                                        className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-950/10 transition-all shrink-0"
                                    >
                                        {addingEmail ? (
                                            <>
                                                <RefreshCw size={15} className="animate-spin" />
                                                <span>Adicionando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Plus size={16} />
                                                <span>Adicionar</span>
                                            </>
                                        )}
                                    </button>
                                </form>

                                {/* Abas Rápidas de Filtragem */}
                                <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1 text-[11px] font-bold">
                                    <button
                                        type="button"
                                        onClick={() => setUserFilterTab('all')}
                                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                            userFilterTab === 'all'
                                                ? 'bg-emerald-800 text-white shadow-sm'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Todas as Contas ({firebaseUsers.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setUserFilterTab('available')}
                                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                            userFilterTab === 'available'
                                                ? 'bg-emerald-800 text-white shadow-sm'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Disponíveis para Vincular ({firebaseUsers.filter(u => !u.isAlreadyMember).length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setUserFilterTab('connected')}
                                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                            userFilterTab === 'connected'
                                                ? 'bg-emerald-800 text-white shadow-sm'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Já na Equipe ({firebaseUsers.filter(u => u.isAlreadyMember).length})
                                    </button>
                                </div>

                                {/* LISTA FLUTUANTE DE SUGESTÕES DO FIREBASE (AUTO-PULL) */}
                                <div className="mt-2 bg-slate-50 border border-slate-200 rounded-2xl p-2.5 shadow-inner">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1 flex items-center justify-between">
                                        <span>Contas do Firebase Encontradas ({filteredUsers.length})</span>
                                        {loadingUsers && <span className="text-emerald-700 animate-pulse font-normal">Sincronizando...</span>}
                                    </div>

                                    {loadingUsers && firebaseUsers.length === 0 ? (
                                        <div className="py-6 text-center text-xs text-slate-400">
                                            Buscando contas no Firebase...
                                        </div>
                                    ) : filteredUsers.length === 0 ? (
                                        <div className="py-4 px-3 text-center bg-white rounded-xl border border-dashed border-slate-200 space-y-1.5">
                                            <div className="text-xs font-bold text-slate-700">
                                                {emailInput.includes('@') 
                                                    ? `Nenhuma conta com "${emailInput}" encontrada no Firebase.` 
                                                    : 'Nenhum usuário corresponde ao filtro.'}
                                            </div>
                                            {emailInput.includes('@') && !isExactMatch && (
                                                <button
                                                    type="button"
                                                    onClick={handleAddMemberByEmail}
                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <Sparkles size={12} />
                                                    <span>Criar Convite Pré-Aprovado para <b>{emailInput}</b></span>
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                                            {filteredUsers.map((u) => (
                                                <div
                                                    key={u.uid}
                                                    className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                                        u.isAlreadyMember 
                                                            ? 'bg-emerald-50/70 border-emerald-200' 
                                                            : 'bg-white hover:bg-emerald-50/40 border-slate-200 hover:border-emerald-300 shadow-sm'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                        <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                                                            u.isAlreadyMember ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                                                        }`}>
                                                            {(u.nome || u.email || 'U')[0].toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                                                                <span>{u.nome || 'Usuário Sem Nome'}</span>
                                                                {u.isAlreadyMember && (
                                                                    <span className="text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.2 rounded-full">
                                                                        VINCULADO
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                                                <Mail size={11} className="text-slate-400" />
                                                                <span>{u.email}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="shrink-0 flex items-center gap-1.5">
                                                        {u.isAlreadyMember ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => promptRemoveMember(u)}
                                                                className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                                                                title="Remover da equipe"
                                                            >
                                                                <UserMinus size={13} />
                                                                <span>Remover</span>
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectAndAddUser(u)}
                                                                disabled={addingEmail}
                                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                                                            >
                                                                <Plus size={13} />
                                                                <span>+ Puxar & Adicionar</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SE ADMIN: Código de Acesso Exclusivo & Convite */}
                    {isAdmin && (
                        <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-emerald-700/40">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <KeyRound size={18} className="text-lime-400" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                                        Código de Acesso da Propriedade
                                    </span>
                                </div>
                                <span className="text-[10px] bg-lime-400/20 text-lime-300 px-2 py-0.5 rounded-full font-black uppercase">
                                    Exclusivo
                                </span>
                            </div>

                            <p className="text-xs text-slate-300 mb-4">
                                Você também pode fornecer este código para novos membros vincularem a fazenda no momento do cadastro.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center gap-3">
                                {/* Code display box */}
                                <div className="w-full sm:flex-1 bg-black/40 border-2 border-dashed border-lime-400/60 rounded-2xl py-3 px-4 flex items-center justify-between">
                                    <span className="font-mono text-xl sm:text-2xl font-black text-lime-400 tracking-widest">
                                        {propertyCode || 'GERANDO...'}
                                    </span>
                                    <button
                                        onClick={handleCopyCode}
                                        className="p-2 rounded-xl bg-lime-400 hover:bg-lime-300 text-black font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                                        title="Copiar Código"
                                    >
                                        {copied ? <Check size={16} /> : <Copy size={16} />}
                                        <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                                    </button>
                                </div>

                                {/* Share Whatsapp */}
                                <button
                                    onClick={() => handleShareWhatsapp()}
                                    className="w-full sm:w-auto px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all shrink-0"
                                >
                                    <Share2 size={16} />
                                    <span>Convidar via WhatsApp</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SE ADMIN: Convites Pendentes por E-mail */}
                    {isAdmin && invites && invites.length > 0 && (
                        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200 shadow-sm space-y-3">
                            <div className="flex items-center gap-2">
                                <Clock size={18} className="text-amber-600" />
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                                    Convites Pendentes ({invites.length})
                                </h3>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Estes e-mails foram pré-aprovados. Assim que criarem a conta no app, entrarão automaticamente na sua fazenda.
                            </p>
                            <div className="divide-y divide-slate-100">
                                {invites.map((inv) => (
                                    <div key={inv.id} className="py-2.5 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
                                                @
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-slate-800">{inv.email}</div>
                                                <div className="text-[10px] text-amber-600 font-semibold">Aguardando primeiro login</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => handleShareWhatsapp(inv.email)}
                                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs font-semibold cursor-pointer"
                                                title="Reenviar pelo WhatsApp"
                                            >
                                                <Share2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleCancelInvite(inv.id, inv.email)}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                                                title="Cancelar Convite"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SE ADMIN: Gestão de Membros da Equipe */}
                    {isAdmin && (
                        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Users size={18} className="text-emerald-700" />
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                                        Equipe e Membros Vinculados ({members.length})
                                    </h3>
                                </div>
                            </div>

                            {members.length === 0 ? (
                                <div className="text-center py-6 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <UserPlus size={28} className="text-slate-400 mx-auto mb-2" />
                                    <div className="text-xs font-bold text-slate-700">Nenhum membro vinculado ainda</div>
                                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
                                        Filtre e adicione uma conta existente no campo acima ou compartilhe o código de acesso da propriedade.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {members.map((m) => (
                                        <div key={m.id || m.memberUid} className="py-3 flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                                                    {(m.nome || 'M')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-slate-800">{m.nome || 'Membro'}</div>
                                                    <div className="text-[11px] text-slate-500">{m.email || 'Sem e-mail'}</div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                                    Visualização
                                                </span>
                                                <button
                                                    onClick={() => promptRemoveMember(m)}
                                                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                    title="Remover Membro da Propriedade"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* SE MEMBRO: Detalhes da Propriedade e Opção de Troca de Código */}
                    {isMember && (
                        <div className="space-y-4">
                            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                    Informações da Conexão
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                                        <span className="text-slate-500">Nome da Propriedade:</span>
                                        <span className="font-bold text-slate-800">{propertyName}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                                        <span className="text-slate-500">Administrador / Gestor:</span>
                                        <span className="font-bold text-emerald-800">{adminNome || 'Gestor da Fazenda'}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                                        <span className="text-slate-500">Código Conectado:</span>
                                        <span className="font-mono font-bold text-slate-700">{propertyCode || 'Nenhum'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Trocar de Código / Propriedade */}
                            <form onSubmit={handleConnectNewCode} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <KeyRound size={15} className="text-emerald-600" />
                                    <span>Vincular a outra Propriedade</span>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                    Insira o código fornecido pelo administrador da nova fazenda para visualizar seus módulos.
                                </p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="Ex: AGRO-8492"
                                        value={newCodeInput}
                                        onChange={(e) => setNewCodeInput(e.target.value.toUpperCase())}
                                        className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono uppercase font-bold focus:bg-white focus:outline-none focus:border-emerald-600"
                                    />
                                    <button
                                        type="submit"
                                        disabled={connecting || !newCodeInput.trim()}
                                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl cursor-pointer transition-all shadow-sm"
                                    >
                                        {connecting ? 'Conectando...' : 'Conectar'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-all"
                    >
                        Fechar
                    </button>
                </div>

            </div>

            {/* MODAL DE CONFIRMAÇÃO DE REMOÇÃO DE MEMBRO */}
            {memberToRemove && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-red-100 p-6 space-y-4 animate-scaleUp">
                        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                            <AlertTriangle size={26} />
                        </div>

                        <div className="text-center space-y-1.5">
                            <h3 className="text-lg font-black text-slate-900">
                                Remover Membro da Equipe?
                            </h3>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Você está prestes a desvincular <b className="text-slate-800">{memberToRemove.nome}</b> ({memberToRemove.email || 'Sem e-mail'}).
                            </p>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 space-y-1">
                            <div className="font-bold flex items-center gap-1.5 text-amber-800">
                                <Clock size={14} />
                                <span>O que acontece agora:</span>
                            </div>
                            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-950/80">
                                <li>O membro perderá o acesso a todos os módulos e dados da fazenda.</li>
                                <li>A conta voltará para o estado independente.</li>
                                <li>Você poderá adicioná-lo novamente a qualquer momento.</li>
                            </ul>
                        </div>

                        <div className="flex items-center gap-2.5 pt-2">
                            <button
                                type="button"
                                disabled={removingMember}
                                onClick={() => setMemberToRemove(null)}
                                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl cursor-pointer transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={removingMember}
                                onClick={handleConfirmRemoveMember}
                                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-red-600/20 transition-all"
                            >
                                {removingMember ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        <span>Removendo...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={14} />
                                        <span>Sim, Remover</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
