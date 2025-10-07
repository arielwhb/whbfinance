// VERSI FINAL - DENGAN CLOUDINARY
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data_pengajuan.json');
const USERS_FILE = path.join(__dirname, 'users.json');

// --- KONFIGURASI CLOUDINARY (Gunakan Kredensial Anda) ---
cloudinary.config({ 
  cloud_name: 'duubegscc', 
  api_key: '144587767484264', 
  api_secret: 'LSfWITl4o0MusUP9Rc1VXNibk08' 
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'pengajuan-finance', // Nama folder di Cloudinary
    public_id: (req, file) => `${Date.now()}-${file.originalname.split('.')[0]}`,
  },
});

const upload = multer({ storage: storage });
// ---------------------------------

// Konfigurasi Awal Lainnya
if (!fs.existsSync(DATA_FILE)) { fs.writeFileSync(DATA_FILE, '[]', 'utf8'); }
if (!fs.existsSync(USERS_FILE)) {
    const defaultUsers = { "user": { "password": "123", "role": "user" }, "finance": { "password": "financeakarsawhb231", "role": "finance" } };
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
}

// Middleware & Fungsi Baca/Tulis
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
const readData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const writeData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
const readUsers = () => JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
const writeUsers = (data) => fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));

// === API ENDPOINTS ===
app.post('/api/login', (req, res) => {
    const users = readUsers();
    const { username, password } = req.body;
    const user = users[username];
    if (user && user.password === password) res.json({ success: true, role: user.role });
    else res.status(401).json({ success: false, message: 'Username atau password salah!' });
});
app.get('/adminregis', (req, res) => res.sendFile(path.join(__dirname, 'public', 'adminregis.html')));
app.post('/api/register', (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username || !password || !role) return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
        const users = readUsers();
        if (users[username]) return res.status(409).json({ success: false, message: 'Username sudah ada.' });
        users[username] = { password, role };
        writeUsers(users);
        res.status(201).json({ success: true, message: `Akun '${username}' berhasil dibuat!` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Terjadi kesalahan di server.' });
    }
});
app.get('/api/pengajuan', (req, res) => {
    try {
        res.json(readData());
    } catch (error) {
        res.status(500).json([]);
    }
});
app.post('/api/pengajuan', upload.array('attachments'), (req, res) => {
    try {
        const data = readData();
        const lastPO = data.length > 0 ? parseInt(data[data.length - 1].nomorPO.split('-')[1]) : 0;
        const attachmentUrls = req.files ? req.files.map(file => file.path) : [];
        const newPengajuan = {
            nomorPO: `PO-${String(lastPO + 1).padStart(3, '0')}`,
            tanggal: req.body.tanggal,
            namaPO: req.body.namaPO || '',
            vendor: req.body.vendor || '',
            terimaDari: req.body.terimaDari || '',
            pembayaran: req.body.pembayaran || '',
            terbilang: req.body.terbilang || '',
            keterangan: req.body.keterangan || '',
            totalRp: req.body.totalRp || 0,
            pemohon: req.body.pemohon,
            statusDashboard: 'Belum Selesai',
            attachments: attachmentUrls,
            approvals: { pemohon: req.body.pemohon_checked === 'true', mengetahui: false, menyetujui: false, pelaksana: false },
            namaMengetahui: '', namaMenyetujui: '', namaPelaksana: ''
        };
        data.push(newPengajuan);
        writeData(data);
        res.status(201).json({ message: 'Pengajuan berhasil dibuat!' });
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan di server.' });
    }
});
app.put('/api/pengajuan/:nomorPO', (req, res) => {
    try {
        const { nomorPO } = req.params;
        const { statusDashboard } = req.body;
        const data = readData();
        const index = data.findIndex(item => item.nomorPO === nomorPO);
        if (index !== -1) {
            data[index].statusDashboard = statusDashboard;
            writeData(data);
            res.json({ message: 'Status berhasil diperbarui!' });
        } else {
            res.status(404).json({ message: 'Data tidak ditemukan!' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Gagal memperbarui status di server' });
    }
});
app.put('/api/pengajuan/edit/:nomorPO', (req, res) => {
    try {
        const { nomorPO } = req.params;
        const updatedData = req.body;
        const allData = readData();
        const index = allData.findIndex(item => item.nomorPO === nomorPO);
        if (index !== -1) {
            allData[index] = {
                ...allData[index], ...updatedData,
                approvals: {
                    pemohon: allData[index].approvals.pemohon,
                    mengetahui: updatedData.mengetahui,
                    menyetujui: updatedData.menyetujui,
                    pelaksana: updatedData.pelaksana
                }
            };
            writeData(allData);
            res.json({ success: true, message: 'Data berhasil diperbarui!' });
        } else {
            res.status(404).json({ success: false, message: 'Data tidak ditemukan!' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Terjadi kesalahan di server.' });
    }
});
app.get('/api/generate-pdf/:nomorPO', async (req, res) => {
    try {
        const { nomorPO } = req.params;
        const submission = readData().find(item => item.nomorPO === nomorPO);
        if (!submission) return res.status(404).send('Data tidak ditemukan');
        const approvals = submission.approvals || {};
        const logoPath = path.join(__dirname, 'public', 'images', 'images.jpg');
        let logoBase64 = '';
        if (fs.existsSync(logoPath)) {
            logoBase64 = Buffer.from(fs.readFileSync(logoPath)).toString('base64');
        }
        const logoSrc = `data:image/jpeg;base64,${logoBase64}`;
        const formHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;margin:40px;font-size:12px}header{display:flex;align-items:center;justify-content:center;text-align:left;gap:15px;padding-bottom:10px;margin-bottom:20px;border-bottom:2px solid #000}.logo{width:50px;height:50px;object-fit:contain}header h1{margin:0;font-size:18px;font-weight:700}header h2{margin:0;font-size:14px;font-weight:400;text-decoration:underline}.grid{display:grid;grid-template-columns:150px 1fr;gap:8px}.grid div:nth-child(odd){font-weight:700}.approval-section{display:flex;justify-content:space-around;margin-top:50px;text-align:center}.approval-box{width:20%}.signature-space{height:60px;border-bottom:1px solid #000;margin-top:40px;display:flex;align-items:center;justify-content:center;font-size:30px;color:#2ecc71}.total-rp{display:flex;border:1px solid #000;padding:5px;margin:15px 0;align-items:center}.total-rp span{padding:0 10px;font-weight:700}</style></head><body><header><img src="${logoSrc}" class="logo"><div class="header-text"><h1>PT WONG HANG BERSAUDARA</h1><h2>FORM PERSETUJUAN PEMBAYARAN</h2></div></header><div class="grid"><div>NOMOR PO</div><div>: ${submission.nomorPO}</div><div>TANGGAL</div><div>: ${submission.tanggal}</div><div>NAMA PO</div><div>: ${submission.namaPO||'-'}</div><div>VENDOR</div><div>: ${submission.vendor||'-'}</div><div>TERIMA DARI</div><div>: ${submission.terimaDari||'-'}</div><div>PEMBAYARAN</div><div>: ${submission.pembayaran||'-'}</div><div>TERBILANG</div><div>: ${submission.terbilang||'-'}</div><div>KETERANGAN</div><div>: ${submission.keterangan||'-'}</div></div><div class="total-rp"><span>Rp</span><span>${parseInt(submission.totalRp||0).toLocaleString('id-ID')}</span></div><div class="approval-section"><div class="approval-box"><div>Mengetahui</div><div class="signature-space">${approvals.mengetahui?'✓':''}</div><div>(${submission.namaMengetahui||'Director'})</div></div><div class="approval-box"><div>Menyetujui</div><div class="signature-space">${approvals.menyetujui?'✓':''}</div><div>(${submission.namaMenyetujui||'Head of Finance'})</div></div><div class="approval-box"><div>Pelaksana</div><div class="signature-space">${approvals.pelaksana?'✓':''}</div><div>(${submission.namaPelaksana||'Finance'})</div></div><div class="approval-box"><div>Pemohon</div><div class="signature-space">${approvals.pemohon?'✓':''}</div><div>(${submission.pemohon||'...'})</div></div></div></body></html>`;
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(formHtml, { waitUntil: 'networkidle0' });
        const formPdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await page.close();
        await browser.close();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan-${submission.nomorPO}.pdf`);
        res.send(formPdfBuffer);
    } catch (error) {
        console.error('Gagal membuat PDF:', error);
        res.status(500).send('Gagal membuat PDF. Cek terminal server.');
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.listen(PORT, () => console.log(`✅ Server berjalan di http://localhost:${PORT}`));