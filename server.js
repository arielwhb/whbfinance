const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');

const app = express();
const PORT = 600;
const DATA_FILE = path.join(__dirname, 'data_pengajuan.json');
const USERS_FILE = path.join(__dirname, 'users.json');

// Inisialisasi Database Sederhana
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(USERS_FILE)) {
    const defaultUsers = { user_biasa: { password: "123", role: "user" }, finance_team: { password: "123", role: "finance" } };
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({ storage: storage });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const readData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const writeData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// API Login & Data Pengajuan
app.post('/api/login', (req, res) => {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const { username, password } = req.body;
    const user = users[username];
    if (user && user.password === password) res.json({ success: true, role: user.role });
    else res.status(401).json({ success: false, message: 'Gagal Login' });
});

app.get('/api/pengajuan', (req, res) => res.json(readData()));

// API Update Data (Krusial untuk menyimpan data SPV)
app.put('/api/pengajuan/edit/:nomorPO', (req, res) => {
    const { nomorPO } = req.params;
    const updated = req.body;
    const allData = readData();
    const idx = allData.findIndex(item => item.nomorPO === nomorPO);

    if (idx !== -1) {
        allData[idx] = {
            ...allData[idx],
            ...updated,
            approvals: {
                pemohon: allData[idx].approvals.pemohon,
                mengetahui: updated.mengetahui === true || updated.mengetahui === 'true',
                menyetujui: updated.menyetujui === true || updated.menyetujui === 'true',
                menyetujuiSpv: updated.menyetujuiSpv === true || updated.menyetujuiSpv === 'true', // Kolom baru
                pelaksana: updated.pelaksana === true || updated.pelaksana === 'true'
            }
        };
        writeData(allData);
        res.json({ success: true });
    } else {
        res.status(404).send('Not Found');
    }
});

// --- GENERATE PDF (Layout 2 Baris: 3 Atas, 2 Bawah) ---
app.get('/api/generate-pdf/:nomorPO', async (req, res) => {
    try {
        const { nomorPO } = req.params;
        const sub = readData().find(item => item.nomorPO === nomorPO);
        if (!sub) return res.status(404).send('Data tidak ditemukan');

        const logoPath = path.join(__dirname, 'public', 'images', 'images.jpg');
        let logoBase64 = fs.existsSync(logoPath) ? Buffer.from(fs.readFileSync(logoPath)).toString('base64') : '';
        const logoSrc = `data:image/jpeg;base64,${logoBase64}`;

        const formHtml = `
        <html><head><style>
            body { font-family: Arial, sans-serif; margin: 30px; font-size: 11px; }
            header { display: flex; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .logo { width: 60px; margin-right: 20px; }
            .grid { display: grid; grid-template-columns: 120px 10px 1fr; gap: 5px; margin-bottom: 15px; }
            .total-box { border: 1px solid #000; padding: 10px; font-weight: bold; font-size: 14px; margin: 20px 0; }
            
            /* Layout Kotak Approval 2 Baris */
            .row { display: flex; justify-content: space-between; margin-top: 25px; }
            .app-box { width: 30%; text-align: center; }
            .sign { 
                height: 50px; 
                border-bottom: 1.5px solid #000; 
                margin: 5px 0; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 28px; 
                color: #27ae60; 
            }
            .role { font-weight: bold; margin-bottom: 5px; }
        </style></head>
        <body>
            <header>
                <img src="${logoSrc}" class="logo">
                <div>
                    <h1 style="margin:0; font-size:18px;">PT WONG HANG BERSAUDARA</h1>
                    <h2 style="margin:0; font-weight:normal; text-decoration:underline;">FORM PERSETUJUAN PEMBAYARAN</h2>
                </div>
            </header>
            <div class="grid">
                <div>NOMOR PO</div><div>:</div><div>${sub.nomorPO}</div>
                <div>TANGGAL</div><div>:</div><div>${sub.tanggal}</div>
                <div>NAMA PO</div><div>:</div><div>${sub.namaPO || '-'}</div>
                <div>VENDOR</div><div>:</div><div>${sub.vendor || '-'}</div>
                <div>PEMBAYARAN</div><div>:</div><div>${sub.pembayaran || '-'}</div>
                <div>TERBILANG</div><div>:</div><div>${sub.terbilang || '-'}</div>
                <div>KETERANGAN</div><div>:</div><div>${sub.keterangan || '-'}</div>
            </div>
            <div class="total-box">Rp ${parseInt(sub.totalRp).toLocaleString('id-ID')}</div>
            
            <div class="row">
                <div class="app-box">
                    <div class="role">Mengetahui</div>
                    <div class="sign">${sub.approvals.mengetahui ? '✓' : ''}</div>
                    <div>(${sub.namaMengetahui || 'Director'})</div>
                </div>
                <div class="app-box">
                    <div class="role">Menyetujui (Head)</div>
                    <div class="sign">${sub.approvals.menyetujui ? '✓' : ''}</div>
                    <div>(${sub.namaMenyetujui || 'Head Finance'})</div>
                </div>
                <div class="app-box">
                    <div class="role">Menyetujui (SPV)</div>
                    <div class="sign">${sub.approvals.menyetujuiSpv ? '✓' : ''}</div>
                    <div>(${sub.namaMenyetujuiSpv || 'SPV Finance'})</div>
                </div>
            </div>

            <div class="row" style="justify-content: space-around; padding: 0 10%;">
                <div class="app-box">
                    <div class="role">Pelaksana</div>
                    <div class="sign">${sub.approvals.pelaksana ? '✓' : ''}</div>
                    <div>(${sub.namaPelaksana || 'Finance'})</div>
                </div>
                <div class="app-box">
                    <div class="role">Pemohon</div>
                    <div class="sign">${sub.approvals.pemohon ? '✓' : ''}</div>
                    <div>(${sub.pemohon || '...'})</div>
                </div>
            </div>
        </body></html>`;

        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(formHtml, { waitUntil: 'networkidle0' });
        const mainPdf = await page.pdf({ format: 'A4', printBackground: true });
        
        // Gabungkan lampiran jika ada
        const pdfDocs = [mainPdf];
        if (sub.attachments && sub.attachments.length > 0) {
            for (const file of sub.attachments) {
                const fPath = path.join(__dirname, 'uploads', file);
                if (fs.existsSync(fPath)) {
                    if (path.extname(file).toLowerCase() === '.pdf') {
                        pdfDocs.push(fs.readFileSync(fPath));
                    } else {
                        const iPage = await browser.newPage();
                        await iPage.goto('file://' + fPath, { waitUntil: 'networkidle0' });
                        pdfDocs.push(await iPage.pdf({ format: 'A4' }));
                        await iPage.close();
                    }
                }
            }
        }
        await browser.close();

        const merged = await PDFDocument.create();
        for (const b of pdfDocs) {
            const doc = await PDFDocument.load(b);
            const pages = await merged.copyPages(doc, doc.getPageIndices());
            pages.forEach(p => merged.addPage(p));
        }
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan-${sub.nomorPO}-${Date.now()}.pdf`);
        res.send(Buffer.from(await merged.save()));
    } catch (e) { res.status(500).send(e.message); }
});

app.listen(PORT, () => console.log(`✅ Server berjalan di http://localhost:${PORT}`));