# AI Chat Web Gateway

Tanggal: 2026-04-10

Dokumen ini menerjemahkan planning workspace yang sudah ada menjadi jalur implementasi konkret untuk chat AI di web.

## Existing Planning

Planning tingkat sprint sudah ada di workspace:

- `docs/mastertask.md`
- `docs/sprint-plan-2026-04-08.md`

Ringkasnya, planning yang sudah ada sudah cukup untuk arah arsitektur, tetapi belum cukup detail untuk langsung coding end-to-end.

## Implemented Path

Vertical slice yang dipakai untuk implementasi awal:

1. `lifelinesproject-astro`
   - halaman baru `GET /ai-chat`
   - request selalu mengirim `X-Trace-Id`
   - UI menampilkan audit trail per aksi
2. `lifelinesproject-api`
   - `GET /ai-chat/status`
   - `POST /ai-chat/session`
   - `POST /ai-chat/messages`
   - `DELETE /ai-chat/session/:sessionId`
   - API meneruskan trace id ke AI service
   - path upstream AI bisa dikonfigurasi via env supaya tetap menunjuk endpoint real di `lifelines-ai`
   - API menulis audit log JSON untuk request, response, timeout, dan error
3. `lifelines-ai`
   - `POST /api/v2/session/start`
   - `POST /api/v2/chat`
   - `PUT /api/v2/session/close`
   - AI service ikut menulis audit log JSON dengan trace id yang sama
   - route `/api/*` sekarang hanya menerima request dari gateway `lifelinesproject-api` lewat shared secret header

## Audit Logging Contract

Setiap hop minimal membawa field berikut:

- `timestamp`
- `component`
- `event`
- `trace_id`
- `session_id`
- `user_id_hash`
- `latency_ms`
- `message_length`
- `reply_length`
- `token_input_total`
- `token_output_total`

## Current Assumptions

- frontend canonical untuk web chat adalah `lifelinesproject-astro`
- auth web tetap lewat `lifelinesproject-api`
- AI session state tetap disimpan di `lifelines-ai`
- summary enrichment dari database API belum dihubungkan; untuk slice awal dikirim sebagai string kosong
- endpoint default upstream yang dipakai gateway:
  - `GET /health`
  - `POST /api/v2/session/start`
  - `POST /api/v2/chat`
  - `PUT /api/v2/session/close`

## Security Boundary

- browser/web hanya boleh memanggil `lifelinesproject-api`
- `lifelinesproject-api` meneruskan request ke `lifelines-ai` dengan header internal `X-Lifelines-Gateway-Key`
- `lifelines-ai` menolak direct access ke semua route `/api/*` jika header shared secret tidak valid
- `GET /health` tetap public untuk health check
- `/telegram/*` tetap public karena dipakai webhook Telegram, dengan proteksi `TELEGRAM_WEBHOOK_SECRET`
- route debug web `/dev/ai-chat` hanya aktif di local dev build saat `VITE_AI_CHAT_DEV_MODE=true`
- mode bypass auth untuk AI chat web juga hanya aktif di local dev build, bukan di production build

## Update Log

- `2026-04-10` - vertical slice web -> api -> ai selesai, audit logging end-to-end aktif
- `2026-04-14` - hardening ditambahkan supaya web/browser tidak bisa bypass gateway; akses ke `lifelines-ai` route `/api/*` sekarang wajib lewat `lifelinesproject-api`
- `2026-04-15` - route debug `/dev/ai-chat` dijadikan dev-only; production build tidak lagi mengekspos halaman debug atau auth bypass untuk AI chat

## Next Expansion After This Slice

- persist transcript metadata di API untuk analytics / admin audit
- enrich summary payload dari profile pengguna
- tambah session list / history di web
- tambah guard bisnis untuk kuota gratis vs berbayar
