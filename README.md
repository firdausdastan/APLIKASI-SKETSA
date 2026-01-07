# GitHub Repository Manager

Aplikasi web untuk mencari, menyimpan, dan mengelola repository GitHub favorit Anda.

## Fitur

- **Pencarian Repository**: Cari repository GitHub berdasarkan kata kunci
- **Koleksi Repository**: Simpan repository favorit ke koleksi pribadi
- **Autentikasi User**: Login/Register dengan email dan password
- **Detail Repository**: Lihat informasi lengkap seperti stars, forks, bahasa, dan topics
- **Data Persistence**: Data tersimpan aman di Supabase

## Teknologi

- React 18
- TypeScript
- Supabase (Database & Auth)
- GitHub API
- Tailwind CSS
- Vite

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Konfigurasi Supabase:
   - Buat project baru di [Supabase](https://supabase.com)
   - Copy URL dan Anon Key dari Settings > API
   - Isi file `.env.local`:
     ```
     VITE_SUPABASE_URL=your_supabase_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

3. Jalankan aplikasi:
   ```bash
   npm run dev
   ```

## Database Schema

### imported_repos
- Menyimpan repository yang disimpan user
- RLS enabled untuk keamanan data per user

### repo_notes
- Menyimpan catatan user untuk setiap repository
- RLS enabled untuk keamanan data per user

## Cara Menggunakan

1. **Register/Login**: Buat akun atau masuk dengan email dan password
2. **Cari Repository**: Gunakan search bar untuk mencari repository
3. **Simpan Repository**: Klik ikon bookmark untuk menyimpan ke koleksi
4. **Lihat Koleksi**: Akses tab "Koleksi Saya" untuk melihat repository tersimpan
5. **Hapus dari Koleksi**: Klik ikon bookmark yang aktif untuk menghapus

## Catatan

- GitHub API memiliki rate limit (60 requests/hour untuk unauthenticated)
- Aplikasi menggunakan endpoint publik GitHub API
- Data repository tersimpan lokal per user dengan RLS Supabase
