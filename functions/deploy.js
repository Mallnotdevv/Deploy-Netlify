const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // 1. Ambil Token Autentikasi Netlify dari Environment Variables
    const NETLIFY_AUTH_TOKEN = process.env.NETLIFY_AUTH_TOKEN;

    if (!NETLIFY_AUTH_TOKEN) {
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: 'Token autentikasi Netlify (NETLIFY_AUTH_TOKEN) tidak ditemukan di Environment Variables.' }) 
        };
    }

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            body: 'Metode Tidak Diizinkan. Hanya POST request yang diterima.' 
        };
    }

    try {
        // Parse data dari frontend (siteName, fileBase64)
        const { siteName, fileBase64, fileName } = JSON.parse(event.body);

        // --- Langkah 1: Buat Situs Baru di Netlify ---
        const siteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NETLIFY_AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                // Nama unik untuk situs baru (akan diubah otomatis oleh Netlify jika sudah ada)
                name: siteName 
            })
        });
        
        const siteData = await siteResponse.json();
        const siteId = siteData.id;
        
        if (!siteResponse.ok) {
             throw new Error(siteData.message || 'Gagal membuat site baru di Netlify. Pastikan nama unik atau token valid.');
        }

        // --- Langkah 2: Upload Konten (Deploy) ---
        // Konversi string Base64 yang diterima dari frontend menjadi Buffer biner
        const deployPayload = Buffer.from(fileBase64, 'base64');
        
        const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NETLIFY_AUTH_TOKEN}`,
                // Gunakan Content-Type 'application/zip' karena ini adalah cara yang tepat 
                // untuk mengupload seluruh aset (ZIP folder) ke endpoint deploys Netlify.
                'Content-Type': 'application/zip', 
            },
            body: deployPayload
        });
        
        if (!deployResponse.ok) {
             const deployError = await deployResponse.json();
             throw new Error(deployError.message || 'Gagal mengunggah file deploy. Periksa format ZIP.');
        }
        
        // --- Langkah 3: Kembalikan URL ke Frontend ---
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Deployment berhasil!', 
                url: siteData.url // Berikan URL situs yang sudah online
            }),
        };

    } catch (error) {
        console.error('Error Deploy Netlify:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: `Kesalahan Deployment Internal: ${error.message}. Pastikan file kurang dari 10MB dan token valid.` 
            }),
        };
    }
};
