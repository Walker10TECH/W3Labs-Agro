import { doc, onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, onAuthStateChanged } from '../firebaseConfig';
import {
    addMemberByEmail,
    cancelPendingInvite,
    checkAndAcceptPendingInvite,
    createAdminProperty,
    joinPropertyByCode,
    listRegisteredFirebaseUsers,
    removeMemberFromProperty,
    subscribeToPropertyInvites,
    subscribeToPropertyMembers,
    updatePropertyName
} from '../services/propertyService';

const PropertyContext = createContext({
    user: null,
    userProfile: null,
    role: 'admin',
    isAdmin: true,
    isMember: false,
    effectiveUid: null,
    propertyName: 'Minha Fazenda',
    propertyCode: '',
    adminUid: null,
    adminNome: '',
    members: [],
    invites: [],
    loading: true,
    changePropertyName: async () => {},
    connectToProperty: async () => {},
    deleteMember: async () => {},
    addMemberByEmailInput: async () => {},
    cancelInvite: async () => {},
    getAvailableUsers: async () => {},
});

export function PropertyProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [members, setMembers] = useState([]);
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);

    // 1. Monitora o estado de autenticação
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setUserProfile(null);
                setMembers([]);
                setInvites([]);
                setLoading(false);
            }
        });
        return unsubscribeAuth;
    }, []);

    // 2. Escuta em tempo real o perfil do usuário logado no Firestore
    useEffect(() => {
        if (!user?.uid) {
            setLoading(false);
            return;
        }

        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeProfile = onSnapshot(userDocRef, async (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setUserProfile(data);
                setLoading(false);
            } else {
                // Perfil legado ou primeiro login sem perfil:
                // Primeiro verifica se há convite pendente para este e-mail
                const userEmail = user.email || '';
                const userName = user.displayName || 'Produtor';

                const acceptedInvite = await checkAndAcceptPendingInvite(user.uid, userEmail, userName);
                if (!acceptedInvite) {
                    console.log("Inicializando perfil padrão de Administrador para o usuário...");
                    try {
                        await createAdminProperty(user.uid, {
                            nome: userName,
                            email: userEmail,
                            propriedadeNome: 'Minha Fazenda',
                        });
                    } catch (e) {
                        console.error("Erro ao inicializar perfil automático:", e);
                    }
                }
                setLoading(false);
            }
        }, (err) => {
            console.error("Erro ao escutar perfil do usuário:", err);
            setLoading(false);
        });

        return () => unsubscribeProfile();
    }, [user?.uid]);

    // 3. Se o usuário for Administrador, escuta a lista de Membros e Convites Pendentes da sua propriedade
    useEffect(() => {
        const role = userProfile?.role || 'admin';
        if (role === 'admin' && user?.uid) {
            const unsubMembers = subscribeToPropertyMembers(user.uid, (list) => {
                setMembers(list);
            });
            const unsubInvites = subscribeToPropertyInvites(user.uid, (list) => {
                setInvites(list);
            });

            return () => {
                unsubMembers();
                unsubInvites();
            };
        } else {
            setMembers([]);
            setInvites([]);
        }
    }, [userProfile?.role, user?.uid]);

    // Papel e Resolução do UID Efetivo de Dados
    const role = userProfile?.role || 'admin';
    const isAdmin = role !== 'membro';
    const isMember = role === 'membro';

    // Se for membro e tiver adminUid, os dados das 10 opções serão lidos do adminUid!
    // Se for admin, os dados são lidos do seu próprio UID.
    const effectiveUid = (isMember && userProfile?.adminUid) 
        ? userProfile.adminUid 
        : (user?.uid || null);

    const propertyName = userProfile?.propriedadeNome || (isMember ? 'Fazenda Vinculada' : 'Minha Fazenda');
    const propertyCode = userProfile?.codigoPropriedade || '';
    const adminUid = userProfile?.adminUid || user?.uid;
    const adminNome = userProfile?.adminNome || '';

    // Funções de Ação
    const changePropertyName = async (newName) => {
        if (!isAdmin || !user?.uid) {
            return { success: false, error: 'Apenas administradores podem renomear a propriedade.' };
        }
        return await updatePropertyName(user.uid, propertyCode, newName);
    };

    const connectToProperty = async (code) => {
        if (!user?.uid) return { success: false, error: 'Usuário não autenticado.' };
        return await joinPropertyByCode(user.uid, {
            nome: user.displayName || userProfile?.nome || 'Membro',
            email: user.email || userProfile?.email || '',
        }, code);
    };

    const deleteMember = async (memberUid, memberEmail = null) => {
        if (!isAdmin || !user?.uid) {
            return { success: false, error: 'Apenas administradores podem remover membros.' };
        }
        return await removeMemberFromProperty(user.uid, memberUid, memberEmail);
    };

    const addMemberByEmailInput = async (targetEmail) => {
        if (!isAdmin || !user?.uid) {
            return { success: false, error: 'Apenas administradores podem adicionar membros.' };
        }
        return await addMemberByEmail(user.uid, {
            adminNome: userProfile?.nome || user.displayName || 'Administrador',
            adminEmail: user.email || userProfile?.email || '',
            propriedadeNome: propertyName,
            codigoPropriedade: propertyCode
        }, targetEmail);
    };

    const cancelInvite = async (inviteId, email) => {
        if (!isAdmin || !user?.uid) return { success: false };
        return await cancelPendingInvite(user.uid, inviteId, email);
    };

    const getAvailableUsers = async () => {
        if (!user?.uid) return { success: false, users: [] };
        return await listRegisteredFirebaseUsers(user.uid);
    };

    const value = {
        user,
        userProfile,
        role,
        isAdmin,
        isMember,
        effectiveUid,
        propertyName,
        propertyCode,
        adminUid,
        adminNome,
        members,
        invites,
        loading,
        changePropertyName,
        connectToProperty,
        deleteMember,
        addMemberByEmailInput,
        cancelInvite,
        getAvailableUsers,
    };

    return (
        <PropertyContext.Provider value={value}>
            {children}
        </PropertyContext.Provider>
    );
}

/**
 * Hook customizado para consumir o contexto de Propriedade e Papéis em qualquer tela/componente
 */
export function usePropertyAuth() {
    const context = useContext(PropertyContext);
    if (!context) {
        throw new Error('usePropertyAuth deve ser utilizado dentro de um PropertyProvider.');
    }
    return context;
}
