import { initializeApp } from "firebase/app";
import {
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from 'firebase/auth';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    writeBatch
} from 'firebase/firestore';
import {
    deleteObject,
    getDownloadURL,
    getStorage,
    ref,
    uploadBytes
} from 'firebase/storage';

// ========================================================================
// CONFIGURAÇÃO E INICIALIZAÇÃO DO FIREBASE
// ========================================================================

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Validação de segurança básica para garantir que as variáveis de ambiente foram carregadas
if (!firebaseConfig.apiKey) {
    console.error("Erro Crítico: Chave da API do Firebase não encontrada. Verifique suas variáveis de ambiente (.env).");
}

const app = initializeApp(firebaseConfig);

// Inicialização dos serviços (Singleton)
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ========================================================================
// EXPORTAÇÕES DE AUTENTICAÇÃO
// ========================================================================

export {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
};

// ========================================================================
// SERVIÇO DO FIRESTORE (CRUD + REAL-TIME)
// ========================================================================

/**
 * Busca todos os documentos de uma coleção específica do usuário.
 * Garante isolamento de dados por UID.
 * @param {string} collectionName - O nome da coleção (ex: 'inventario').
 * @returns {Promise<{success: boolean, data?: any[], error?: Error}>} Objeto com o resultado.
 */
export async function getItems(collectionName) {
    const userUid = auth.currentUser?.uid;
    if (!userUid) return { success: false, error: new Error("Usuário não autenticado.") };

    try {
        const collectionRef = collection(db, 'users', userUid, collectionName);
        const q = query(collectionRef);
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { success: true, data };
    } catch (error) {
        console.error(`[Firestore Error] ao buscar itens de ${collectionName}:`, error);
        return { success: false, error };
    }
}

/**
 * Cria ou atualiza um documento em uma coleção específica do usuário.
 * Implementa lógica de 'Upsert' e timestamps automáticos.
 * @param {string} collectionName - O nome da coleção (ex: 'inventario').
 * @param {object} itemData - O objeto de dados a ser salvo.
 * @param {boolean} isEditing - True se for uma atualização.
 * @returns {Promise<{success: boolean, id?: string, error?: Error}>} Objeto com o resultado.
 */
export async function addOrUpdateItem(collectionName, itemData, isEditing) {
    const userUid = auth.currentUser?.uid;
    if (!userUid) return { success: false, error: new Error("Usuário não autenticado.") };
    try {
        
        let docRef;
        let docId;

        if (isEditing) {
            docId = itemData.id;
            if (!docId) {
                console.error(`[Firestore Error] Tentativa de atualização sem ID em ${collectionName}.`, itemData);
                return { success: false, error: new Error("ID do item é inválido ou não fornecido para atualização.") };
            }
            docRef = doc(db, 'users', userUid, collectionName, docId);
        } else {
            // Firestore V9: para gerar um ID automaticamente, criamos uma referência a um novo documento
            docRef = doc(collection(db, 'users', userUid, collectionName));
            docId = docRef.id;
        }

        const dataToSave = {
            ...itemData,
            id: docId, // Garante que o ID do documento seja salvo no próprio corpo do documento para integridade
            userUid,
            atualizadoEm: serverTimestamp(),
        };

        if (isEditing) {
            await updateDoc(docRef, dataToSave);
            console.log(`[Firestore] Documento ${docId} atualizado em ${collectionName}.`);
        } else {
            dataToSave.criadoEm = serverTimestamp();
            await setDoc(docRef, dataToSave);
            console.log(`[Firestore] Documento ${docId} criado em ${collectionName}.`);
        }
        return { success: true, id: docId };
    } catch (error) {
        console.error(`[Firestore Error] em ${collectionName}:`, error);
        return { success: false, error };
    }
}

/**
 * Deleta um documento do Firestore.
 * @param {string} collectionName - O nome da coleção.
 * @param {string} itemId - O ID do documento a ser deletado.
 * @returns {Promise<{success: boolean, error?: Error}>} Objeto com o resultado.
 */
export async function deleteItem(collectionName, itemId) {
    const userUid = auth.currentUser?.uid;
    if (!userUid) return { success: false, error: new Error("Usuário não autenticado.") };

    try {
        const docRef = doc(db, 'users', userUid, collectionName, itemId);
        await deleteDoc(docRef);
        console.log(`[Firestore] Documento ${itemId} deletado de ${collectionName}.`);
        return { success: true };
    } catch (error) {
        console.error(`[Firestore Error] ao deletar de ${collectionName}:`, error);
        return { success: false, error };
    }
}

/**
 * Inscreve-se para escutar atualizações em tempo real de uma coleção.
 * Essencial para UX reativa no Frontend.
 * @param {string} collectionName - O nome da coleção a ser observada.
 * @param {function} callback - Função a ser chamada com os novos dados. A função recebe um array de documentos.
 * @returns {function} Uma função para cancelar a inscrição (unsubscribe).
 */
export function subscribeToCollection(collectionName, callback) {
    const userUid = auth.currentUser?.uid;
    if (!userUid) {
        console.error("Usuário não autenticado para inscrição em tempo real.");
        return () => {}; // Retorna uma função vazia para evitar crash ao tentar chamar unsubscribe
    }

    const collectionRef = collection(db, 'users', userUid, collectionName);
    const q = query(collectionRef);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    }, (error) => {
        console.error(`[Firestore Real-time Error] em ${collectionName}:`, error);
    });

    return unsubscribe;
}


// ========================================================================
// SERVIÇO DE ARMAZENAMENTO (STORAGE)
// ========================================================================

/**
 * Faz upload de um arquivo para o Firebase Storage.
 * @param {string} fileUri - O URI local do arquivo (ex: de expo-image-picker).
 * @param {string} path - O caminho no Storage (ex: 'manuais/arquivo.pdf').
 * @returns {Promise<string>} A URL de download do arquivo.
 * @throws Lança um erro se o usuário não estiver autenticado ou se o upload falhar.
 */
export const uploadFile = async (fileUri, path) => {
    const userUid = auth.currentUser?.uid;
    if (!userUid) throw new Error("Usuário não autenticado.");

    try {
        const storageRef = ref(storage, `users/${userUid}/${path}`);
        // Converte o URI local em um blob de dados para upload
        const response = await fetch(fileUri);
        const blob = await response.blob();
        await uploadBytes(storageRef, blob);
        return await getDownloadURL(storageRef);
    } catch (error) {
        console.error("Erro no upload do arquivo:", error);
        throw error;
    }
};

/**
 * Deleta um arquivo do Firebase Storage a partir da sua URL de download.
 * @param {string} fileUrl - A URL completa do arquivo a ser deletado.
 */
export const deleteFileByUrl = async (fileUrl) => {
    if (!fileUrl) return;
    try {
        const storageRef = ref(storage, fileUrl);
        await deleteObject(storageRef);
    } catch (error) {
        // Ignora o erro se o objeto não for encontrado, pois o resultado final (arquivo inexistente) é o mesmo.
        if (error.code !== 'storage/object-not-found') {
            console.error("Erro ao deletar o arquivo:", error);
        }
    }
};

// ========================================================================
// SERVIÇO DE DADOS INICIAIS (SEED) & BACKUP
// ========================================================================

export const INITIAL_MANUAL_CATEGORIES = [
    { nome: 'Stara', imagem: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS6qtq1SIy-BWZWxleQCqe6Mb8ZT8_dCqbJew&s' },
    { nome: 'New Holland', imagem: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQZkPs8GKQdNNkyPBdmsZSB1VBMwwkasYLrOQ&s' },
    { nome: 'John Deere', imagem: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZ6TvOxu0S0PvFLB-g8jP5Kvj1QwlVVf4B-A&s' },
    { nome: 'Case IH', imagem: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRjuqQ4DdHXUS2gV8Q0QaNZHZs2fFacEJU7jw&s' },
    { nome: 'Massey Ferguson', imagem: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTZI4AD6PNsAxRyV605Fo7h_QlyJIAnl7bZfg&s' },
    { nome: 'Valtra', imagem: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQdjxN9pqkBIHPNpJWzqFklWyWsnwkE9Zwc5w&s' },
    { nome: 'Jacto', imagem: 'https://jacto.com/assets/imgs/meta-image_c4a3a10168dd05886a9d.png' },
];

/**
 * Cria as categorias de manuais no Firestore para um novo usuário, se ainda não existirem.
 * Utiliza um documento de metadados para garantir idempotência.
 * @param {string} userUid - O UID do usuário.
 */
export const seedInitialFirestoreData = async (userUid) => {
    try {
        const docRef = doc(db, 'users', userUid, 'appMetadata', 'initialSeed');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().manualCategoriesSeeded) {
            console.log('Dados iniciais já populados para este usuário.');
            return;
        }

        console.log('Populando categorias de manuais no Firestore para novo usuário...');
        const initialCategories = INITIAL_MANUAL_CATEGORIES;

        const batch = writeBatch(db);
        const timestamp = serverTimestamp();

        initialCategories.forEach(cat => {
            const newDocRef = doc(collection(db, 'users', userUid, 'manualCategorias'));
            batch.set(newDocRef, {
                ...cat,
                id: newDocRef.id,
                userUid,
                criadoEm: timestamp,
                atualizadoEm: timestamp,
            });
        });

        // Marca que o seed foi concluído para não executar novamente
        batch.set(docRef, { manualCategoriesSeeded: true, timestamp: serverTimestamp() });

        await batch.commit();
        console.log('Criação de categorias iniciais no Firestore concluída.');
    } catch (error) {
        console.error("Erro ao criar dados iniciais no Firestore:", error);
    }
};

/**
 * Gera um backup JSON de todas as coleções críticas do usuário.
 * @returns {Promise<{success: boolean, uri?: string, error?: Error}>}
 */
export const downloadAllUserDataAsJson = async () => {
    const userUid = auth.currentUser?.uid;
    if (!userUid) {
        return { success: false, error: new Error("Usuário não autenticado.") };
    }

    const collectionsToBackup = [
        'propriedades', 'unidades', 'inventario', 'diesel', 'dieselEstoque',
        'manualCategorias', 'manualItems', 'plantios', 'pulverizacoes',
        'revisoes', 'estoqueGeral', 'pluviometro', 'porcentagens', 'colheitas'
    ];

    const allData = {};

    try {
        for (const collectionName of collectionsToBackup) {
            const result = await getItems(collectionName);
            if (result.success) {
                allData[collectionName] = result.data;
            }
        }

        const jsonString = JSON.stringify(allData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const uri = URL.createObjectURL(blob);
        return { success: true, uri };
    } catch (error) {
        console.error("Erro ao gerar backup de dados:", error);
        return { success: false, error };
    }
};

/**
 * Faz upload de um backup JSON para o Firestore, restaurando os dados.
 * Gerencia o limite de 500 operações por batch do Firestore.
 * @param {string} jsonString - A string contendo os dados de backup em formato JSON.
 * @returns {Promise<{success: boolean, error?: Error}>} Objeto com o resultado.
 */
export const uploadUserDataFromJson = async (jsonString) => {
    const userUid = auth.currentUser?.uid;
    if (!userUid) {
        return { success: false, error: new Error("Usuário não autenticado.") };
    }

    try {
        const data = JSON.parse(jsonString);
        let batch = writeBatch(db);
        let operationCount = 0;

        for (const collectionName in data) {
            if (Object.prototype.hasOwnProperty.call(data, collectionName)) {
                const items = data[collectionName];
                if (Array.isArray(items)) {
                    for (const item of items) {
                        if (item.id) {
                            const docRef = doc(db, 'users', userUid, collectionName, item.id);
                            batch.set(docRef, item);
                            operationCount++;

                            // O Firestore tem um limite estrito de 500 operações por lote.
                            if (operationCount >= 499) {
                                await batch.commit();
                                batch = writeBatch(db);
                                operationCount = 0;
                            }
                        }
                    }
                }
            }
        }

        if (operationCount > 0) {
            await batch.commit();
        }

        return { success: true };
    } catch (error) {
        console.error("Erro ao restaurar backup de dados:", error);
        return { success: false, error };
    }
};

// ========================================================================
// EXPORTAÇÃO PADRÃO (FALLBACK)
// ========================================================================

const FirebaseServices = {
    auth,
    db,
    storage,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    getItems,
    addOrUpdateItem,
    deleteItem,
    subscribeToCollection,
    uploadFile,
    deleteFileByUrl,
    seedInitialFirestoreData,
    INITIAL_MANUAL_CATEGORIES,
    downloadAllUserDataAsJson,
    uploadUserDataFromJson,
};

export default FirebaseServices;