PANDUAN DEPLOY KE HOSTING PLESK
================================

Aplikasi ini menggunakan React + TypeScript + Vite. Agar dapat berjalan di hosting Plesk, Anda perlu melakukan "Build" terlebih dahulu.

CARA 1: BUILD DI LOKAL (Disarankan)
1. Pastikan Node.js terinstall di komputer Anda.
2. Buka terminal di folder project ini.
3. Jalankan perintah: `npm install`
4. Jalankan perintah: `npm run build`
5. Akan muncul folder baru bernama `dist`.
6. Upload ISI dari folder `dist` tersebut ke dalam folder `httpdocs` di File Manager Plesk Anda.

CARA 2: BUILD DI PLESK (Jika ada ekstensi Node.js)
1. Upload semua file project ke folder di Plesk (misal: /dmasiv-finance).
2. Masuk ke menu "Node.js" di Plesk.
3. Klik "Enable Node.js".
4. Klik tombol "Run NPM Install".
5. Jalankan script "build" via menu Run Script.
6. Arahkan "Document Root" website Anda ke folder `/dist` yang terbentuk.

Catatan: 
- File .htaccess sudah disertakan untuk mengatur routing aplikasi.
- Pastikan settingan PHP/Apache tidak memblokir file static.
