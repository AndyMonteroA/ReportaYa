/**
 * ReportaYa - Capa de Servicio de Datos (Service Layer)
 * Este archivo centraliza la comunicación con la base de datos (Firebase)
 * y permite cambiar de proveedor fácilmente en el futuro.
 */

// NOTA: Estas son configuraciones temporales. 
// El usuario deberá reemplazarlas con sus propias claves de Firebase Console.
const firebaseConfig = {
    apiKey: "AIzaSyAcX0KhB7M7XDiDO7RNQMvmeeNBzzQnyrw",
    authDomain: "reportaya-babahoyo.firebaseapp.com",
    projectId: "reportaya-babahoyo",
    storageBucket: "reportaya-babahoyo.firebasestorage.app",
    messagingSenderId: "814206925356",
    appId: "1:814206925356:web:6f0980d30b7b79714aaf89",
    measurementId: "G-TL0G7758QB"
};

// Importamos lo necesario de Firebase vía CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

// Inicializamos Firebase
let db, storage;
let isFirebaseReady = false;

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app);
    isFirebaseReady = true;
    console.log("Servicio de Datos: Firebase + Storage inicializados");
} catch (e) {
    console.warn("Servicio de Datos: Error al inicializar Firebase.", e);
}

/**
 * Utilidad para comprimir imágenes en el cliente (Canvas)
 */
const ImageCompressor = {
    async compress(file, maxWidth = 1000, quality = 0.7) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = (maxWidth / width) * height;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/jpeg', quality);
                };
            };
        });
    }
};

/**
 * Interfaz de Datos de ReportaYa
 */
export const ReportaData = {
    
    /**
     * Sube un archivo a Firebase Storage
     * @param {File} file - Archivo original
     * @returns {Promise<string>} URL de la foto subida
     */
    async uploadFile(file) {
        if (!isFirebaseReady) return null;
        try {
            // 1. Comprimir antes de subir
            const compressedBlob = await ImageCompressor.compress(file);
            
            // 2. Crear ruta única
            const fileName = `evidencias/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const storageRef = ref(storage, fileName);
            
            // 3. Subir
            await uploadBytes(storageRef, compressedBlob);
            
            // 4. Obtener URL
            const url = await getDownloadURL(storageRef);
            return url;
        } catch (e) {
            console.error("Error al subir archivo:", e);
            return null;
        }
    },

    /**
     * Guarda un nuevo reporte en la base de datos (y localmente como respaldo)
     * @param {Object} reportData - Datos del reporte (tipo, coordenadas, efectos, etc)
     */
    async saveReport(reportData) {
        // 1. Guardar localmente siempre (Respaldo/Modo Offline)
        this._saveToLocal(reportData);

        // 2. Intentar guardar en Firebase si está configurado
        if (isFirebaseReady) {
            try {
                const docRef = await addDoc(collection(db, "reportes"), {
                    ...reportData,
                    created_at: serverTimestamp() // Marca de tiempo del servidor
                });
                console.log("Reporte guardado en Firebase con ID:", docRef.id);
                return { success: true, id: docRef.id };
            } catch (e) {
                console.error("Error guardando en Firebase:", e);
                return { success: false, error: e.message };
            }
        } else {
            console.info("Reporte guardado solo localmente (Firebase no configurado)");
            return { success: true, local: true };
        }
    },

    /**
     * Escucha cambios en los reportes en tiempo real
     * @param {Function} callback - Función que recibe la lista actualizada de reportes
     */
    onReportsUpdate(callback) {
        if (isFirebaseReady) {
            const q = query(collection(db, "reportes"), orderBy("timestamp", "desc"));
            return onSnapshot(q, (snapshot) => {
                const reports = [];
                snapshot.forEach((doc) => {
                    reports.push({ id: doc.id, ...doc.data() });
                });
                callback(reports);
            });
        } else {
            const localData = JSON.parse(localStorage.getItem('reportaya_db') || '[]');
            callback(localData);
            return () => {};
        }
    },

    /**
     * Función interna para guardar en LocalStorage
     * @private
     */
    _saveToLocal(report) {
        const dbLocal = JSON.parse(localStorage.getItem('reportaya_db') || '[]');
        dbLocal.push(report);
        localStorage.setItem('reportaya_db', JSON.stringify(dbLocal));
    }
};
