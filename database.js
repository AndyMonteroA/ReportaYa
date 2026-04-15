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

// Inicializamos Firebase
let db;
let isFirebaseReady = false;

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    isFirebaseReady = true;
    console.log("Servicio de Datos: Firebase inicializado (Esperando configuración real)");
} catch (e) {
    console.warn("Servicio de Datos: Firebase no pudo inicializarse. Usando solo almacenamiento local.", e);
}

/**
 * Interfaz de Datos de ReportaYa
 */
export const ReportaData = {
    
    /**
     * Guarda un nuevo reporte en la base de datos (y localmente como respaldo)
     * @param {Object} reportData - Datos del reporte (tipo, coordenadas, efectos, etc)
     */
    async saveReport(reportData) {
        // 1. Guardar localmente siempre (Respaldo/Modo Offline)
        this._saveToLocal(reportData);

        // 2. Intentar guardar en Firebase si está configurado
        if (isFirebaseReady && firebaseConfig.apiKey !== "TU_API_KEY") {
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
        // Si Firebase está listo, usamos tiempo real real
        if (isFirebaseReady && firebaseConfig.apiKey !== "TU_API_KEY") {
            const q = query(collection(db, "reportes"), orderBy("timestamp", "desc"));
            return onSnapshot(q, (snapshot) => {
                const reports = [];
                snapshot.forEach((doc) => {
                    reports.push({ id: doc.id, ...doc.data() });
                });
                callback(reports);
            });
        } else {
            // Si no hay Firebase, leemos del LocalStorage una vez
            console.info("Cargando reportes desde LocalStorage (Sin tiempo real de servidor)");
            const localData = JSON.parse(localStorage.getItem('reportaya_db') || '[]');
            callback(localData);
            return () => {}; // Función de limpieza vacía
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
