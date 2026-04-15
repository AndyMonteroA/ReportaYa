/**
 * ReportaYa - Capa de Servicio de Datos (Service Layer) con SUPABASE
 * Este archivo centraliza la comunicación con la base de datos y el almacenamiento.
 * Versión: Migración a Supabase (100% Gratis y Profesional)
 */

const SUPABASE_URL = "https://oljqkkyikylvpkjxdwlc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sanFra3lpa3lsdnBranhkd2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNzkyNjgsImV4cCI6MjA5MTg1NTI2OH0.gYnVw-JSAyRgeblMk45KZJb2knvJB1900ESDLRn7p1E";

// Importamos Supabase vía CDN (ESM)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Inicializamos Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
 * Interfaz de Datos de ReportaYa - Motor Supabase
 */
export const ReportaData = {
    
    /**
     * Sube un archivo a Supabase Storage
     * @param {File} file - Archivo original
     * @returns {Promise<string>} URL de la foto subida
     */
    async uploadFile(file) {
        try {
            // 1. Comprimir antes de subir
            const compressedBlob = await ImageCompressor.compress(file);
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

            // 2. Subir a Supabase Storage (Bucket: evidencias)
            const { data, error } = await supabase.storage
                .from('evidencias')
                .upload(fileName, compressedBlob, {
                    contentType: 'image/jpeg'
                });

            if (error) throw error;

            // 3. Obtener URL pública
            const { data: urlData } = supabase.storage
                .from('evidencias')
                .getPublicUrl(fileName);

            return urlData.publicUrl;
        } catch (e) {
            console.error("Error al subir archivo a Supabase:", e);
            return null;
        }
    },

    /**
     * Guarda un nuevo reporte en Supabase
     * @param {Object} reportData - Datos del reporte
     */
    async saveReport(reportData) {
        // Guardar localmente siempre (Respaldo)
        this._saveToLocal(reportData);

        try {
            // Mapeo a campos en ESPAÑOL para la base de datos
            const payload = {
                id: reportData.id,
                fecha_texto: reportData.timestamp,
                tipo: reportData.type,
                tipo_nombre: reportData.typeLabel,
                efectos: reportData.effects,
                coordenadas: reportData.coords,
                url_foto: reportData.photoURL,
                tiene_foto: reportData.hasPhoto
            };

            const { data, error } = await supabase
                .from('reportes')
                .insert([payload]);

            if (error) throw error;

            console.log("Incidente guardado en Supabase con éxito");
            return { success: true };
        } catch (e) {
            console.error("Error guardando en Supabase:", e);
            return { success: false, error: e.message };
        }
    },

    /**
     * Escucha cambios en los reportes en tiempo real
     * @param {Function} callback - Función que recibe la lista actualizada de reportes
     */
    onReportsUpdate(callback) {
        // 1. Cargar datos iniciales
        this._fetchInitialReports(callback);

        // 2. Suscribirse a cambios en tiempo real
        return supabase
            .channel('cambios-reales')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes' }, () => {
                this._fetchInitialReports(callback);
            })
            .subscribe();
    },

    /**
     * Función interna para cargar los reportes actuales
     */
    async _fetchInitialReports(callback) {
        const { data, error } = await supabase
            .from('reportes')
            .select('*')
            .order('fecha_creacion', { ascending: false });

        if (!error && data) {
            // Re-mapeo a formato original para no romper la UI
            const formatted = data.map(r => ({
                id: r.id,
                timestamp: r.fecha_texto,
                type: r.tipo,
                typeLabel: r.tipo_nombre,
                effects: r.efectos,
                coords: r.coordenadas,
                photoURL: r.url_foto,
                hasPhoto: r.tiene_foto
            }));
            callback(formatted);
        } else {
            console.error("Error cargando reportes iniciales:", error);
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
