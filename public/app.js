// ====================================================
// VERSI FINAL - DENGAN DUKUNGAN SPV FINANCE (5 ROLES)
// ====================================================
console.log("app.js FINAL (Updated with SPV) dimuat!");

document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname;
    if (page.includes('login.html') || page === '/') { 
        setupLoginPage(); 
    } else if (page.includes('index.html')) { 
        setupUserForm(); 
    } else if (page.includes('finance.html')) { 
        loadFinanceDashboard(); 
    } else if (page.includes('adminregis.html')) { 
        setupAdminRegisPage(); 
    }

    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            sessionStorage.removeItem('userRole');
            window.location.href = '/login.html';
        });
    }
});

// --- FUNGSI HELPER ---
function updateStatusColor(selectElement) {
    if (selectElement.value === 'Selesai') {
        selectElement.classList.add('status-selesai');
        selectElement.classList.remove('status-belum-selesai');
    } else {
        selectElement.classList.add('status-belum-selesai');
        selectElement.classList.remove('status-selesai');
    }
}

function terbilang(angka) {
    const bilangan = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
    angka = Math.floor(angka);
    if (angka < 12) return bilangan[angka];
    if (angka < 20) return terbilang(angka - 10) + " belas";
    if (angka < 100) return terbilang(Math.floor(angka / 10)) + " puluh " + terbilang(angka % 10);
    if (angka < 200) return "seratus " + terbilang(angka - 100);
    if (angka < 1000) return terbilang(Math.floor(angka / 100)) + " ratus " + terbilang(angka % 100);
    if (angka < 2000) return "seribu " + terbilang(angka - 1000);
    if (angka < 1000000) return terbilang(Math.floor(angka / 1000)) + " ribu " + terbilang(angka % 1000);
    if (angka < 1000000000) return terbilang(Math.floor(angka / 1000000)) + " juta " + terbilang(angka % 1000000);
    return "angka terlalu besar";
}

// --- MODULE: LOGIN ---
function setupLoginPage() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(loginForm).entries());
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (result.success) {
                sessionStorage.setItem('userRole', result.role);
                window.location.href = result.role === 'user' ? '/index.html' : '/finance.html';
            } else {
                document.getElementById('loginError').textContent = result.message;
            }
        } catch (error) {
            document.getElementById('loginError').textContent = 'Gagal terhubung ke server.';
        }
    });
}

// --- MODULE: USER FORM ---
function setupUserForm() {
    const form = document.getElementById('pengajuanForm');
    if (!form) return;
    const pemohonCheckBtn = document.getElementById('pemohonCheckBtn');
    const totalRpInput = document.getElementById('totalRp');
    const terbilangInput = document.getElementById('terbilang');
    const tanggalInput = document.getElementById('tanggal');
    if (tanggalInput) tanggalInput.valueAsDate = new Date();

    pemohonCheckBtn.addEventListener('click', () => {
        pemohonCheckBtn.classList.toggle('checked');
        pemohonCheckBtn.innerHTML = pemohonCheckBtn.classList.contains('checked') ? '✓' : '';
    });

    totalRpInput.addEventListener('input', (e) => {
        let rawValue = e.target.value.replace(/[^0-9]/g, '');
        let numberValue = parseInt(rawValue, 10) || 0;
        if (numberValue > 0) {
            let textValue = terbilang(numberValue).trim();
            terbilangInput.value = textValue.charAt(0).toUpperCase() + textValue.slice(1) + " rupiah";
        } else {
            terbilangInput.value = '';
        }
        e.target.value = numberValue.toLocaleString('id-ID');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        formData.append('pemohon_checked', pemohonCheckBtn.classList.contains('checked'));
        const totalRpRaw = formData.get('totalRp').replace(/\./g, '');
        formData.set('totalRp', totalRpRaw);
        
        try {
            const response = await fetch('/api/pengajuan', { method: 'POST', body: formData });
            if (response.ok) {
                alert('Pengajuan berhasil dikirim!');
                form.reset();
                pemohonCheckBtn.classList.remove('checked');
                pemohonCheckBtn.innerHTML = '';
                if (tanggalInput) tanggalInput.valueAsDate = new Date();
            }
        } catch (error) {
            alert('Terjadi kesalahan koneksi.');
        }
    });
}

// --- MODULE: FINANCE DASHBOARD ---
let allData = [];
const roles = ['mengetahui', 'menyetujui', 'menyetujuiSpv', 'pelaksana'];

async function loadFinanceDashboard() {
    try {
        const response = await fetch('/api/pengajuan');
        allData = await response.json();
        renderTable(allData);

        document.getElementById('filterNomorPO').addEventListener('input', applyFilters);
        document.getElementById('filterNamaPO').addEventListener('input', applyFilters);
        document.getElementById('filterStatus').addEventListener('change', applyFilters);

        setupEditModalListeners();
    } catch (error) { console.error('Error:', error); }
}

function renderTable(data) {
    const tableBody = document.querySelector('#financeTable tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    data.forEach(item => {
        const row = document.createElement('tr');
        let attachmentLinks = (item.attachments && item.attachments.length > 0) 
            ? item.attachments.map(file => `<a href="/uploads/${file}" target="_blank">${file.substring(0, 10)}...</a>`).join('<br>') 
            : 'Tidak ada';

        row.innerHTML = `
            <td>${item.nomorPO}</td>
            <td>${item.tanggal || '-'}</td>
            <td>${item.namaPO || '-'}</td>
            <td>${item.pemohon || 'Tidak Diisi'}</td>
            <td>Rp ${parseInt(item.totalRp || 0).toLocaleString('id-ID')}</td>
            <td>${attachmentLinks}</td>
            <td>
                <select class="status-select" data-nomorpo="${item.nomorPO}">
                    <option value="Belum Selesai" ${item.statusDashboard === 'Belum Selesai' ? 'selected' : ''}>Belum Selesai</option>
                    <option value="Selesai" ${item.statusDashboard === 'Selesai' ? 'selected' : ''}>Selesai</option>
                </select>
            </td>
            <td class="action-buttons">
                <button class="edit-btn" data-nomorpo="${item.nomorPO}">Edit</button>
                <button class="pdf-btn" data-nomorpo="${item.nomorPO}">PDF</button>
            </td>`;
        tableBody.appendChild(row);
        updateStatusColor(row.querySelector('.status-select'));
    });

    document.querySelectorAll('.status-select').forEach(select => select.addEventListener('change', updateStatus));
    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', openEditModal));
    document.querySelectorAll('.pdf-btn').forEach(btn => btn.addEventListener('click', generatePdf));
}

function openEditModal(e) {
    const nomorPO = e.target.dataset.nomorpo;
    const submission = allData.find(item => item.nomorPO === nomorPO);
    if (!submission) return;

    // Isi data basic
    document.getElementById('editNomorPO').value = submission.nomorPO;
    document.getElementById('editTanggal').value = submission.tanggal;
    document.getElementById('editNamaPO').value = submission.namaPO || '';
    document.getElementById('editVendor').value = submission.vendor || '';
    document.getElementById('editTerimaDari').value = submission.terimaDari || '';
    document.getElementById('editPembayaran').value = submission.pembayaran || '';
    document.getElementById('editKeterangan').value = submission.keterangan || '';
    document.getElementById('editTotalRp').value = parseInt(submission.totalRp || 0).toLocaleString('id-ID');
    document.getElementById('editTerbilang').value = submission.terbilang || '';

    // Isi Nama-nama approval
    document.getElementById('editNamaMengetahui').value = submission.namaMengetahui || '';
    document.getElementById('editNamaMenyetujui').value = submission.namaMenyetujui || '';
    document.getElementById('editNamaMenyetujuiSpv').value = submission.namaMenyetujuiSpv || '';
    document.getElementById('editNamaPelaksana').value = submission.namaPelaksana || '';
    document.getElementById('editPemohonName').value = submission.pemohon || '';

    // Set Status Checkmark
    const approvals = submission.approvals || {};
    
    // Khusus Pemohon (Display Only)
    const pCheck = document.getElementById('editPemohonCheck');
    pCheck.textContent = approvals.pemohon ? '✓' : '-';
    pCheck.className = approvals.pemohon ? 'checkmark-display checked' : 'checkmark-display';

    // Loop Roles untuk Tombol Approval (Termasuk SPV)
    roles.forEach(role => {
        const btnId = `edit${role.charAt(0).toUpperCase() + role.slice(1)}Btn`;
        const btn = document.getElementById(btnId);
        if (btn) {
            if (approvals[role]) {
                btn.classList.add('checked');
                btn.innerHTML = '✓';
            } else {
                btn.classList.remove('checked');
                btn.innerHTML = '';
            }
        }
    });

    document.getElementById('editModal').style.display = 'flex';
}

function setupEditModalListeners() {
    // Tombol Toggle Checkmark
    roles.forEach(role => {
        const btnId = `edit${role.charAt(0).toUpperCase() + role.slice(1)}Btn`;
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', () => {
                btn.classList.toggle('checked');
                btn.innerHTML = btn.classList.contains('checked') ? '✓' : '';
            });
        }
    });

    // Formatting Rupiah di Modal
    const totalRpInput = document.getElementById('editTotalRp');
    if (totalRpInput) {
        totalRpInput.addEventListener('input', (e) => {
            let num = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
            document.getElementById('editTerbilang').value = num > 0 ? terbilang(num) + " rupiah" : '';
            e.target.value = num.toLocaleString('id-ID');
        });
    }

    document.getElementById('cancelEdit').addEventListener('click', () => {
        document.getElementById('editModal').style.display = 'none';
    });

    // Save Changes
    document.getElementById('editForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.totalRp = data.totalRp.replace(/\./g, '');

        // Ambil status dari class 'checked'
        roles.forEach(role => {
            const btnId = `edit${role.charAt(0).toUpperCase() + role.slice(1)}Btn`;
            data[role] = document.getElementById(btnId).classList.contains('checked');
        });

        try {
            const res = await fetch(`/api/pengajuan/edit/${data.nomorPO}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if ((await res.json()).success) {
                alert('Berhasil disimpan!');
                document.getElementById('editModal').style.display = 'none';
                loadFinanceDashboard();
            }
        } catch (error) { alert('Gagal menyimpan.'); }
    });
}

// --- FUNGSI SEARCH & API LAIN ---
function applyFilters() {
    const fNo = document.getElementById('filterNomorPO').value.toLowerCase();
    const fNama = document.getElementById('filterNamaPO').value.toLowerCase();
    const fStat = document.getElementById('filterStatus').value;

    const filtered = allData.filter(item => {
        return item.nomorPO.toLowerCase().includes(fNo) &&
               (item.namaPO || '').toLowerCase().includes(fNama) &&
               (fStat ? item.statusDashboard === fStat : true);
    });
    renderTable(filtered);
}

async function updateStatus(e) {
    const nomorPO = e.target.dataset.nomorpo;
    const newStatus = e.target.value;
    updateStatusColor(e.target);
    await fetch(`/api/pengajuan/${nomorPO}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusDashboard: newStatus })
    });
}

function generatePdf(e) {
    const n = e.target.dataset.nomorpo;
    window.location.href = `/api/generate-pdf/${n}`;
}