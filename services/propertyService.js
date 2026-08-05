import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';
import { db, seedInitialFirestoreData } from '../firebaseConfig';

/**
 * Gera um código de propriedade exclusivo e legível (ex: AGRO-8392)
 */
export function generatePropertyCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `AGRO-${randomPart}`;
}

/**
 * Normaliza e sanitiza e-mails para identificadores do Firestore
 */
export function sanitizeEmailKey(email) {
    if (!email) return '';
    return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

/**
 * Inicializa ou atualiza o perfil do Administrador e registra a Propriedade no índice global
 */
export async function createAdminProperty(userUid, { nome, email, propriedadeNome }) {
    if (!userUid) return { success: false, error: 'UID de usuário obrigatório.' };

    try {
        const farmName = (propriedadeNome || 'Minha Fazenda').trim();
        const userName = (nome || 'Produtor').trim();
        const userEmail = (email || '').trim().toLowerCase();
        
        // Verifica se já possui código existente
        const userDocRef = doc(db, 'users', userUid);
        const userDocSnap = await getDoc(userDocRef);
        
        let propertyCode = userDocSnap.exists() ? userDocSnap.data().codigoPropriedade : null;
        if (!propertyCode) {
            propertyCode = generatePropertyCode();
        }

        const profileData = {
            uid: userUid,
            nome: userName,
            email: userEmail,
            role: 'admin',
            propriedadeNome: farmName,
            codigoPropriedade: propertyCode,
            adminUid: userUid,
            atualizadoEm: serverTimestamp(),
        };

        if (!userDocSnap.exists()) {
            profileData.criadoEm = serverTimestamp();
        }

        // Salva perfil do usuário
        await setDoc(userDocRef, profileData, { merge: true });

        // Registra índice global para busca rápida por código de convite
        const propGlobalRef = doc(db, 'propriedades', propertyCode.toUpperCase());
        await setDoc(propGlobalRef, {
            codigo: propertyCode.toUpperCase(),
            adminUid: userUid,
            adminNome: userName,
            adminEmail: userEmail,
            propriedadeNome: farmName,
            atualizadoEm: serverTimestamp(),
        }, { merge: true });

        // Popula dados iniciais (ex: manuais) se for novo
        await seedInitialFirestoreData(userUid);

        return { success: true, propertyCode, profile: profileData };
    } catch (error) {
        console.error('Erro ao criar propriedade de administrador:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Busca uma propriedade pelo código de convite (ex: AGRO-8392)
 */
export async function lookupPropertyByCode(code) {
    if (!code) return null;
    const cleanCode = code.trim().toUpperCase();

    try {
        // 1. Tenta buscar direto na coleção global de propriedades
        const propDocRef = doc(db, 'propriedades', cleanCode);
        const propSnap = await getDoc(propDocRef);

        if (propSnap.exists()) {
            return { id: propSnap.id, ...propSnap.data() };
        }

        // 2. Fallback: busca na coleção de usuários onde codigoPropriedade == cleanCode
        const usersQuery = query(collection(db, 'users'), where('codigoPropriedade', '==', cleanCode), where('role', '==', 'admin'));
        const userSnaps = await getDocs(usersQuery);

        if (!userSnaps.empty) {
            const adminData = userSnaps.docs[0].data();
            return {
                codigo: cleanCode,
                adminUid: adminData.uid || userSnaps.docs[0].id,
                adminNome: adminData.nome || 'Administrador',
                adminEmail: adminData.email || '',
                propriedadeNome: adminData.propriedadeNome || 'Fazenda Principal',
            };
        }

        return null;
    } catch (error) {
        console.error('Erro ao buscar propriedade por código:', error);
        return null;
    }
}

/**
 * Vincula um Membro a uma Propriedade existente usando o Código de Acesso
 */
export async function joinPropertyByCode(memberUid, { nome, email }, code) {
    if (!memberUid || !code) {
        return { success: false, error: 'Código da propriedade é obrigatório.' };
    }

    try {
        const property = await lookupPropertyByCode(code);
        if (!property) {
            return { success: false, error: 'Código de propriedade inválido ou não encontrado. Verifique com o administrador.' };
        }

        const memberName = (nome || 'Membro da Equipe').trim();
        const memberEmail = (email || '').trim().toLowerCase();

        // 1. Atualiza o perfil do membro
        const memberDocRef = doc(db, 'users', memberUid);
        const profileData = {
            uid: memberUid,
            nome: memberName,
            email: memberEmail,
            role: 'membro',
            propriedadeNome: property.propriedadeNome,
            codigoPropriedade: property.codigo,
            adminUid: property.adminUid,
            adminNome: property.adminNome,
            atualizadoEm: serverTimestamp(),
        };

        await setDoc(memberDocRef, profileData, { merge: true });

        // 2. Adiciona o membro na subcoleção do Administrador
        const adminMemberRef = doc(db, 'users', property.adminUid, 'membros', memberUid);
        await setDoc(adminMemberRef, {
            memberUid: memberUid,
            nome: memberName,
            email: memberEmail,
            role: 'membro',
            adicionadoEm: serverTimestamp(),
        }, { merge: true });

        return { success: true, property, profile: profileData };
    } catch (error) {
        console.error('Erro ao vincular membro à propriedade:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Adiciona uma conta existente no Firebase pelo E-mail ou cria um convite pré-aprovado
 * @param {string} adminUid - UID do Administrador da fazenda.
 * @param {object} adminProfile - Dados da propriedade { adminNome, adminEmail, propriedadeNome, codigoPropriedade }.
 * @param {string} targetEmail - E-mail do usuário a ser adicionado.
 */
export async function addMemberByEmail(adminUid, adminProfile, targetEmail) {
    if (!adminUid) return { success: false, error: 'Administrador não autenticado.' };
    if (!targetEmail || !targetEmail.includes('@')) {
        return { success: false, error: 'Informe um endereço de e-mail válido.' };
    }

    const cleanEmail = targetEmail.trim().toLowerCase();
    const adminEmail = (adminProfile?.adminEmail || '').toLowerCase();

    if (cleanEmail === adminEmail) {
        return { success: false, error: 'Você não pode adicionar seu próprio e-mail como membro da sua propriedade.' };
    }

    try {
        const farmName = adminProfile?.propriedadeNome || 'Minha Fazenda';
        const code = adminProfile?.codigoPropriedade || '';
        const adminName = adminProfile?.adminNome || 'Administrador';

        // 1. Procura na coleção 'users' do Firestore se essa conta já existe
        const userQuery = query(collection(db, 'users'), where('email', '==', cleanEmail));
        const userSnaps = await getDocs(userQuery);

        if (!userSnaps.empty) {
            // CONTA EXISTE NO FIREBASE!
            const targetDoc = userSnaps.docs[0];
            const targetUid = targetDoc.id;
            const targetData = targetDoc.data();

            if (targetData.adminUid === adminUid && targetData.role === 'membro') {
                return { success: false, error: `O usuário ${targetData.nome || cleanEmail} já faz parte da sua equipe!` };
            }

            // Atualiza a conta do membro para apontar para esta fazenda
            const memberDocRef = doc(db, 'users', targetUid);
            await setDoc(memberDocRef, {
                role: 'membro',
                adminUid: adminUid,
                adminNome: adminName,
                codigoPropriedade: code,
                propriedadeNome: farmName,
                vinculadoEm: serverTimestamp(),
                atualizadoEm: serverTimestamp()
            }, { merge: true });

            // Adiciona na subcoleção de membros do Admin
            const adminMemberRef = doc(db, 'users', adminUid, 'membros', targetUid);
            const memberRecord = {
                memberUid: targetUid,
                nome: targetData.nome || cleanEmail.split('@')[0],
                email: cleanEmail,
                role: 'membro',
                status: 'ativo',
                tipoAdicao: 'conta_existente',
                adicionadoEm: serverTimestamp(),
            };
            await setDoc(adminMemberRef, memberRecord, { merge: true });

            // Remove convite pendente se houver
            const inviteKey = sanitizeEmailKey(cleanEmail);
            await deleteDoc(doc(db, 'users', adminUid, 'convites', inviteKey)).catch(() => {});
            await deleteDoc(doc(db, 'convitesPendentes', inviteKey)).catch(() => {});

            return {
                success: true,
                type: 'existing_account',
                message: `Conta de "${targetData.nome || cleanEmail}" vinculada com sucesso à fazenda!`,
                member: memberRecord
            };
        } else {
            // CONTA AINDA NÃO EXISTE NO FIREBASE -> Cria convite pendente
            const inviteKey = sanitizeEmailKey(cleanEmail);

            const inviteData = {
                id: inviteKey,
                email: cleanEmail,
                adminUid: adminUid,
                adminNome: adminName,
                adminEmail: adminEmail,
                codigoPropriedade: code,
                propriedadeNome: farmName,
                status: 'pendente',
                criadoEm: serverTimestamp(),
            };

            // Salva na subcoleção do admin
            await setDoc(doc(db, 'users', adminUid, 'convites', inviteKey), inviteData, { merge: true });

            // Salva no registro global de convites pendentes para autovinculação no cadastro
            await setDoc(doc(db, 'convitesPendentes', inviteKey), inviteData, { merge: true });

            return {
                success: true,
                type: 'pending_invite',
                message: `Convite pré-aprovado registrado para "${cleanEmail}". Assim que este usuário se cadastrar com este e-mail, ele será vinculado automaticamente!`,
                invite: inviteData
            };
        }
    } catch (error) {
        console.error('Erro ao adicionar membro por e-mail:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Busca e lista contas existentes no Firebase para sugestão rápida
 * @param {string} excludeAdminUid - UID do admin atual para não se listar
 */
export async function listRegisteredFirebaseUsers(excludeAdminUid) {
    try {
        const q = query(collection(db, 'users'), limit(50));
        const snaps = await getDocs(q);
        const users = [];

        snaps.forEach(docSnap => {
            const data = docSnap.data();
            const uid = docSnap.id;
            if (uid !== excludeAdminUid && data.email) {
                users.push({
                    uid,
                    nome: data.nome || 'Sem Nome',
                    email: data.email,
                    role: data.role || 'usuario',
                    propriedadeNome: data.propriedadeNome || '',
                    adminUid: data.adminUid || null,
                    isAlreadyMember: data.adminUid === excludeAdminUid
                });
            }
        });

        return { success: true, users };
    } catch (error) {
        console.error('Erro ao listar contas do Firebase:', error);
        return { success: false, users: [], error: error.message };
    }
}

/**
 * Verifica se um novo e-mail cadastrado possui um convite pendente e o vincula automaticamente
 * @param {string} userUid - UID do usuário recém cadastrado
 * @param {string} userEmail - E-mail do usuário
 * @param {string} userName - Nome do usuário
 */
export async function checkAndAcceptPendingInvite(userUid, userEmail, userName) {
    if (!userUid || !userEmail) return null;
    const cleanEmail = userEmail.trim().toLowerCase();
    const inviteKey = sanitizeEmailKey(cleanEmail);

    try {
        const inviteDocRef = doc(db, 'convitesPendentes', inviteKey);
        const inviteSnap = await getDoc(inviteDocRef);

        if (inviteSnap.exists()) {
            const inviteData = inviteSnap.data();

            // 1. Atualiza perfil do usuário para Membro da fazenda que convidou
            await setDoc(doc(db, 'users', userUid), {
                uid: userUid,
                nome: userName || cleanEmail.split('@')[0],
                email: cleanEmail,
                role: 'membro',
                adminUid: inviteData.adminUid,
                adminNome: inviteData.adminNome,
                codigoPropriedade: inviteData.codigoPropriedade,
                propriedadeNome: inviteData.propriedadeNome,
                vinculadoEm: serverTimestamp(),
                atualizadoEm: serverTimestamp()
            }, { merge: true });

            // 2. Adiciona na lista de membros do Administrador
            await setDoc(doc(db, 'users', inviteData.adminUid, 'membros', userUid), {
                memberUid: userUid,
                nome: userName || cleanEmail.split('@')[0],
                email: cleanEmail,
                role: 'membro',
                status: 'ativo',
                tipoAdicao: 'convite_email_automatico',
                adicionadoEm: serverTimestamp()
            }, { merge: true });

            // 3. Remove os convites pendentes
            await deleteDoc(inviteDocRef).catch(() => {});
            await deleteDoc(doc(db, 'users', inviteData.adminUid, 'convites', inviteKey)).catch(() => {});

            return {
                accepted: true,
                propriedadeNome: inviteData.propriedadeNome,
                adminNome: inviteData.adminNome,
                codigoPropriedade: inviteData.codigoPropriedade
            };
        }

        return null;
    } catch (error) {
        console.error('Erro ao verificar convite pendente no cadastro:', error);
        return null;
    }
}

/**
 * Cancela um convite pendente por e-mail
 */
export async function cancelPendingInvite(adminUid, inviteId, email) {
    if (!adminUid || !inviteId) return { success: false };

    try {
        const cleanEmail = (email || '').trim().toLowerCase();
        const inviteKey = inviteId || sanitizeEmailKey(cleanEmail);

        await deleteDoc(doc(db, 'users', adminUid, 'convites', inviteKey));
        await deleteDoc(doc(db, 'convitesPendentes', inviteKey));

        return { success: true };
    } catch (error) {
        console.error('Erro ao cancelar convite:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Escuta em tempo real a lista de convites pendentes do Administrador
 */
export function subscribeToPropertyInvites(adminUid, callback) {
    if (!adminUid) return () => {};

    const invitesRef = collection(db, 'users', adminUid, 'convites');
    const q = query(invitesRef);

    return onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(list);
    }, (error) => {
        console.error('Erro ao escutar convites da propriedade:', error);
    });
}

/**
 * Atualiza o nome da Propriedade (somente Admin)
 */
export async function updatePropertyName(adminUid, propertyCode, newName) {
    if (!adminUid || !newName?.trim()) return { success: false, error: 'Nome inválido.' };

    try {
        const trimmedName = newName.trim();

        // Atualiza perfil do admin
        await updateDoc(doc(db, 'users', adminUid), {
            propriedadeNome: trimmedName,
            atualizadoEm: serverTimestamp(),
        });

        // Atualiza índice global
        if (propertyCode) {
            await setDoc(doc(db, 'propriedades', propertyCode.toUpperCase()), {
                propriedadeNome: trimmedName,
                atualizadoEm: serverTimestamp(),
            }, { merge: true });
        }

        return { success: true, propriedadeNome: trimmedName };
    } catch (error) {
        console.error('Erro ao atualizar nome da propriedade:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Remove um Membro da Propriedade (somente Admin)
 * @param {string} adminUid - UID do Administrador
 * @param {string} memberIdentifier - UID do membro ou ID do documento na subcoleção 'membros'
 * @param {string} memberEmail - E-mail opcional para garantir a desvinculação completa
 */
export async function removeMemberFromProperty(adminUid, memberIdentifier, memberEmail = null) {
    if (!adminUid || !memberIdentifier) {
        return { success: false, error: 'Identificador do membro não fornecido.' };
    }

    try {
        let targetUid = memberIdentifier;
        let foundEmail = memberEmail;

        // 1. Tenta obter o documento da subcoleção para extrair UID e e-mail
        const memberDocRef = doc(db, 'users', adminUid, 'membros', memberIdentifier);
        const memberDocSnap = await getDoc(memberDocRef);

        if (memberDocSnap.exists()) {
            const data = memberDocSnap.data();
            targetUid = data.memberUid || data.uid || memberIdentifier;
            if (!foundEmail) foundEmail = data.email;
        }

        // 2. Remove da lista de membros do administrador
        await deleteDoc(memberDocRef);

        // 3. Se houver UID correspondente na coleção global 'users', desvincula o perfil
        if (targetUid) {
            const targetUserRef = doc(db, 'users', targetUid);
            const targetUserSnap = await getDoc(targetUserRef);
            if (targetUserSnap.exists()) {
                await setDoc(targetUserRef, {
                    adminUid: null,
                    adminNome: null,
                    codigoPropriedade: null,
                    propriedadeNome: 'Sem Propriedade Vinculada',
                    role: 'admin', // Retorna ao modo padrão independente
                    desvinculadoEm: serverTimestamp(),
                    atualizadoEm: serverTimestamp(),
                }, { merge: true });
            }
        }

        // 4. Se tiver e-mail, limpa eventuais convites pendentes
        const cleanEmail = (foundEmail || '').trim().toLowerCase();
        if (cleanEmail) {
            const inviteKey = sanitizeEmailKey(cleanEmail);
            await deleteDoc(doc(db, 'users', adminUid, 'convites', inviteKey)).catch(() => {});
            await deleteDoc(doc(db, 'convitesPendentes', inviteKey)).catch(() => {});
        }

        return {
            success: true,
            message: 'Membro removido da propriedade com sucesso.'
        };
    } catch (error) {
        console.error('Erro ao remover membro da propriedade:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Escuta em tempo real a lista de membros vinculados ao Administrador
 */
export function subscribeToPropertyMembers(adminUid, callback) {
    if (!adminUid) return () => {};

    const membersRef = collection(db, 'users', adminUid, 'membros');
    const q = query(membersRef);

    return onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(list);
    }, (error) => {
        console.error('Erro ao escutar membros da propriedade:', error);
    });
}
