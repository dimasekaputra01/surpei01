/* =========================================================
   Kuesioner Truk — Survei Gate Pelabuhan
   Semua logika ada di satu file, data-driven dari STEPS[]
   supaya mudah ditambah/diubah tanpa menyentuh HTML.
   Data tersimpan di localStorage (device ini saja, offline-ready).
   ========================================================= */

const STORAGE_RECORDS = 'kt_records_v1';
const STORAGE_PROFILE = 'kt_profile_v1';

const HARI_NAMES = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const RATING_OPTIONS = ['Sangat Baik','Baik','Cukup Baik','Kurang Baik','Buruk'];

/* ---------------------------------------------------------
   DEFINISI LANGKAH (STEPS)
   Setiap langkah = satu "obrolan" ke supir yang mengisi
   beberapa kolom kuesioner asli sekaligus.
   type: text | textarea | number | currency | select
   NB: badge 'tambahan' = pertanyaan opsional, boleh dilewati
   (asumsi: bagian 1-7 kuesioner asli = inti tujuan survei,
   bagian upah tambahan & kondisi infrastruktur = tambahan —
   silakan ubah showAsRequired di bawah jika ternyata sebaliknya)
--------------------------------------------------------- */
const STEPS = [
  {
    id: 'responden',
    title: 'Responden & Kendaraan',
    badge: 'wajib',
    question: 'Boleh tahu nama Bapak/Ibu, dan berapa nomor polisi truk yang dibawa?',
    fields: [
      { key:'namaResponden', label:'Nama Responden', type:'text', required:true, titleCase:true },
      { key:'platKendaraan', label:'Plat Kendaraan', type:'text', required:true, plate:true, placeholder:'cth. L 1234 AB' },
    ]
  },
  {
    id: 'ekspedisi',
    title: 'Ekspedisi & Pelayaran',
    badge: 'wajib',
    question: 'Bapak bekerja di ekspedisi apa? Dan kapal/perusahaan pelayaran apa yang mengangkut kontainer ini?',
    fields: [
      { key:'perusahaanEkspedisi', label:'Perusahaan Ekspedisi', type:'text', required:true, titleCase:true },
      { key:'alamatEkspedisi', label:'Alamat Ekspedisi', type:'text', titleCase:true },
      { key:'perusahaanPelayaran', label:'Perusahaan Pelayaran', type:'text', required:true, titleCase:true },
      { key:'alamatPelayaran', label:'Alamat Perusahaan Pelayaran', type:'text', titleCase:true },
    ]
  },
  {
    id: 'muatan',
    title: 'Muatan / Petikemas',
    badge: 'wajib',
    question: 'Barang ini dari mana asalnya, dan dikirim ke mana? Isinya apa, beratnya berapa ton, kontainernya ukuran berapa, isi atau kosong?',
    fields: [
      { key:'asalJenis', label:'Asal Petikemas', type:'select', options:['Domestik','Internasional'], required:true },
      { key:'perusahaanAsal', label:'Perusahaan / Lokasi Asal', type:'text', required:true, titleCase:true },
      { key:'tujuanJenis', label:'Tujuan Petikemas', type:'select', options:['Domestik','Internasional'], required:true },
      { key:'perusahaanTujuan', label:'Perusahaan / Lokasi Tujuan', type:'text', required:true, titleCase:true },
      { key:'isiKosong', label:'Isi / Kosong', type:'select', options:['Isi','Kosong'], required:true },
      { key:'kapasitas', label:'Kapasitas', type:'select', options:['20 feet','40 feet'], required:true },
      { key:'komoditas', label:'Komoditas', type:'text', titleCase:true },
      { key:'beratMuatan', label:'Berat Muatan', type:'number', unit:'ton' },
    ]
  },
  {
    id: 'rute',
    title: 'Rute Perjalanan',
    badge: 'wajib',
    question: 'Tadi lewat rute mana menuju ke sini? Berapa jam dan kira-kira berapa km? Lancar atau macet?',
    fields: [
      { key:'rutePerjalanan', label:'Rute Perjalanan', type:'textarea', required:true, placeholder:'cth. Manyar - Tol KLBM - Gate - Terminal Teluk Lamong' },
      { key:'kondisi', label:'Kondisi Lalu Lintas', type:'select', options:['Normal','Macet'], required:true },
      { key:'lamaPerjalanan', label:'Lama Perjalanan', type:'number', required:true, unit:'jam' },
      { key:'jarak', label:'Jarak', type:'number', required:true, unit:'km' },
    ],
    computed: [
      { key:'rataKecepatan', label:'Rata-rata kecepatan', unit:'km/jam',
        formula:(d)=> (Number(d.jarak)>0 && Number(d.lamaPerjalanan)>0) ? (Number(d.jarak)/Number(d.lamaPerjalanan)) : 0 }
    ]
  },
  {
    id: 'frekuensi',
    title: 'Frekuensi Operasional',
    badge: 'wajib',
    question: 'Biasanya sehari bisa berapa kali trip seperti ini? Seminggu kerja berapa hari, dan sebulan berapa hari jalan?',
    fields: [
      { key:'frekuensiPerHari', label:'Frekuensi per Hari', type:'number' },
      { key:'jamPerPerjalanan', label:'Jam per Perjalanan', type:'number', unit:'jam' },
      { key:'frekuensiPerMinggu', label:'Frekuensi per Minggu', type:'number' },
      { key:'frekuensiHariPerMinggu', label:'Hari Kerja per Minggu', type:'number' },
      { key:'hariOperasionalPerBulan', label:'Hari Operasional per Bulan', type:'number' },
    ]
  },
  {
    id: 'biayaTrip',
    title: 'Biaya Sekali Jalan',
    badge: 'wajib',
    question: 'Untuk sekali jalan ini, habis berapa liter solar dan berapa rupiah? Ada biaya tol, tarif gate, uang makan, pungutan, parkir, pulsa, dan lain-lain?',
    fields: [
      { key:'bbmLiter', label:'BBM', unit:'liter', type:'number' },
      { key:'bbmRupiah', label:'BBM', type:'currency' },
      { key:'tarifGate', label:'Tarif Gate', type:'currency' },
      { key:'biayaTol', label:'Biaya Tol', type:'currency' },
      { key:'konsumsiSupir', label:'Konsumsi Supir', type:'currency' },
      { key:'konsumsiAsisten', label:'Konsumsi Asisten Supir', type:'currency' },
      { key:'pungutan', label:'Pungutan', type:'currency' },
      { key:'parkir', label:'Parkir', type:'currency' },
      { key:'komunikasi', label:'Biaya Komunikasi', type:'currency' },
      { key:'lainLainTrip', label:'Lain-lain', type:'currency' },
    ],
    computed: [
      { key:'jumlahTrip', label:'Jumlah per trip', isCurrency:true,
        formula:(d)=> ['tarifGate','biayaTol','konsumsiSupir','konsumsiAsisten','pungutan','parkir','komunikasi','lainLainTrip','bbmRupiah']
          .reduce((s,k)=> s + (Number(d[k])||0), 0) }
    ]
  },
  {
    id: 'biayaBulanan',
    title: 'Biaya Bulanan',
    badge: 'wajib',
    question: 'Gaji sopir dan kernet per bulan berapa? Biaya servis (ban, tune up, oli, aki) kira-kira berapa sebulan? Ada asuransi supir, truk, atau barang?',
    fields: [
      { key:'upahSupir', label:'Upah Supir / Bulan', type:'currency' },
      { key:'upahAsisten', label:'Upah Asisten Supir / Bulan', type:'currency' },
      { key:'perawatanBan', label:'Perawatan Ban / Bulan', type:'currency' },
      { key:'perawatanTuneUp', label:'Tune Up / Bulan', type:'currency' },
      { key:'perawatanOli', label:'Ganti Oli / Bulan', type:'currency' },
      { key:'perawatanAki', label:'Aki / Bulan', type:'currency' },
      { key:'perawatanLain', label:'Perawatan Lain-lain / Bulan', type:'currency' },
      { key:'asuransiSupir', label:'Asuransi Supir / Bulan', type:'currency' },
      { key:'asuransiTruk', label:'Asuransi Truk / Bulan', type:'currency' },
      { key:'asuransiBarang', label:'Asuransi Barang / Bulan', type:'currency' },
    ]
  },
  {
    id: 'upahTambahan',
    title: 'Upah Tambahan & Tarif Pengiriman',
    badge: 'tambahan',
    question: 'Apakah dapat bonus / upah tambahan? Dan berapa tarif pengiriman per kontainer, untuk isi dan kosong?',
    fields: [
      { key:'upahTambahan', label:'Dapat Upah Tambahan?', type:'select', options:['Tidak','Ya'] },
      { key:'jenisUpahTambahan', label:'Jenis Upah Tambahan', type:'text', titleCase:true, showIf:d=>d.upahTambahan==='Ya' },
      { key:'jumlahUpahTambahan', label:'Jumlah Upah Tambahan', type:'currency', showIf:d=>d.upahTambahan==='Ya' },
      { key:'bentukLain', label:'Ada Upah Bentuk Lain?', type:'select', options:['Tidak','Ya'] },
      { key:'bentukLainKeterangan', label:'Bentuk Lain (keterangan)', type:'text', titleCase:true, showIf:d=>d.bentukLain==='Ya' },
      { key:'tarifPengirimanIsi', label:'Tarif Pengiriman — Isi', unit:'Rp/TEU', type:'currency' },
      { key:'tarifPengirimanKosong', label:'Tarif Pengiriman — Kosong', unit:'Rp/TEU', type:'currency' },
    ]
  },
  {
    id: 'infrastruktur',
    title: 'Kondisi Infrastruktur',
    badge: 'tambahan',
    question: 'Menurut Bapak, bagaimana kondisi jalan, jembatan, akses gate, lapangan penumpukan, keamanan, keselamatan, dan kemacetan di sini?',
    fields: [
      { key:'kondisiJalan', label:'Jalan', type:'select', options:RATING_OPTIONS },
      { key:'kondisiJembatan', label:'Jembatan', type:'select', options:RATING_OPTIONS },
      { key:'aksesGate', label:'Akses Gate', type:'select', options:RATING_OPTIONS },
      { key:'aksesLapangan', label:'Akses Lapangan Penumpukan', type:'select', options:RATING_OPTIONS },
      { key:'lainnyaInfra', label:'Lainnya', type:'select', options:RATING_OPTIONS },
      { key:'keamanan', label:'Keamanan', type:'select', options:RATING_OPTIONS },
      { key:'keselamatan', label:'Keselamatan', type:'select', options:RATING_OPTIONS },
      { key:'kemacetanInfra', label:'Kemacetan', type:'select', options:RATING_OPTIONS },
    ]
  },
];

/* ---------------------------------------------------------
   UTILITAS FORMAT
--------------------------------------------------------- */
function uuid(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
    const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8);
    return v.toString(16);
  });
}
function titleCase(str){
  if(!str) return str;
  return str.toLowerCase().replace(/(^|\s|[-/])([a-zà-ÿ])/g, (m,p1,p2)=> p1+p2.toUpperCase());
}
function normalizePlate(str){
  if(!str) return str;
  const clean = str.toUpperCase().replace(/[^A-Z0-9]/g,'');
  const m = clean.match(/^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$/);
  if(m) return [m[1],m[2],m[3]].filter(Boolean).join(' ');
  return str.toUpperCase().trim();
}
function formatCurrency(n){
  n = Number(n)||0;
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}
function formatNumber(n){
  n = Number(n)||0;
  return n.toLocaleString('id-ID', {maximumFractionDigits:2});
}
function parseDigits(str){
  return (str||'').toString().replace(/[^\d]/g,'');
}
function computeHari(tanggalStr){
  if(!tanggalStr) return '';
  const d = new Date(tanggalStr+'T00:00:00');
  if(isNaN(d)) return '';
  return HARI_NAMES[d.getDay()];
}
function computeShift(waktuStr){
  if(!waktuStr) return '';
  const [h] = waktuStr.split(':').map(Number);
  if(h>=6 && h<12) return '1';
  if(h>=12 && h<18) return '2';
  if(h>=18 && h<24) return '3';
  return '4';
}
function todayStr(){
  const d = new Date();
  const pad = n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function nowTimeStr(){
  const d = new Date();
  const pad = n=>String(n).padStart(2,'0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatTanggalIndo(tanggalStr){
  if(!tanggalStr) return '-';
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const d = new Date(tanggalStr+'T00:00:00');
  if(isNaN(d)) return tanggalStr;
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

/* ---------------------------------------------------------
   PENYIMPANAN (localStorage — per perangkat, bekerja offline)
--------------------------------------------------------- */
const Store = {
  getRecords(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_RECORDS)) || []; }
    catch(e){ return []; }
  },
  saveRecords(list){
    localStorage.setItem(STORAGE_RECORDS, JSON.stringify(list));
  },
  addOrUpdate(record){
    const list = this.getRecords();
    const idx = list.findIndex(r=>r.id===record.id);
    if(idx>=0) list[idx]=record; else list.unshift(record);
    this.saveRecords(list);
  },
  remove(id){
    this.saveRecords(this.getRecords().filter(r=>r.id!==id));
  },
  get(id){
    return this.getRecords().find(r=>r.id===id);
  },
  getProfile(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_PROFILE)) || {}; }
    catch(e){ return {}; }
  },
  saveProfile(p){
    localStorage.setItem(STORAGE_PROFILE, JSON.stringify(p));
  }
};

/* ---------------------------------------------------------
   STATE APLIKASI
--------------------------------------------------------- */
const App = {
  view: 'home',          // home | wizard | detail | rekap
  stepIndex: 0,
  draft: null,           // record sedang diisi
  detailId: null,
  errors: {},
  searchTerm: '',
};

function allFieldsFlat(){
  return STEPS.flatMap(s=>s.fields);
}

function newDraft(){
  const profile = Store.getProfile();
  const tanggal = todayStr();
  const waktu = nowTimeStr();
  return {
    id: uuid(),
    createdAt: new Date().toISOString(),
    surveyor: profile.surveyor || '',
    lokasiSurvei: profile.lokasiSurvei || '',
    tanggal, waktuSurvei: waktu,
    hari: computeHari(tanggal), shift: computeShift(waktu),
  };
}

/* ---------------------------------------------------------
   RENDER: ROOT
--------------------------------------------------------- */
const $app = document.getElementById('app');

function render(){
  if(App.view==='home') return renderHome();
  if(App.view==='wizard') return renderWizard();
  if(App.view==='detail') return renderDetail();
  if(App.view==='rekap') return renderRekap();
}

function topbar(title, sub, rightHtml){
  return `<div class="topbar">
    <div class="brand"><b>${title}</b><span>${sub}</span></div>
    ${rightHtml||''}
  </div>`;
}

/* ---------- HOME ---------- */
function renderHome(){
  const records = Store.getRecords();
  const term = App.searchTerm.toLowerCase();
  const filtered = term
    ? records.filter(r => (r.namaResponden||'').toLowerCase().includes(term) || (r.platKendaraan||'').toLowerCase().includes(term))
    : records;

  const wajibFields = STEPS.filter(s=>s.badge==='wajib').length;

  $app.innerHTML = `
    ${topbar('Kuesioner Truk', 'Survei Gate Pelabuhan', `<button class="icon-btn" data-action="open-profile">Profil</button>`)}
    <main>
      <div class="hero-card">
        <div class="stripes"></div>
        <h2>Catat wawancara supir</h2>
        <p>Isi langsung di HP saat wawancara — hasilnya otomatis dirapikan sesuai format kuesioner.</p>
        <div class="hero-stats">
          <div><b>${records.length}</b><span>Responden tercatat</span></div>
          <div><b>${wajibFields}</b><span>Bagian inti wajib</span></div>
        </div>
      </div>

      <button class="btn btn-primary btn-block" data-action="new-survey">+ Survei Baru</button>

      <div class="section-title"><h3>Data Tersimpan</h3>
        ${records.length? `<button class="btn-text" data-action="open-rekap">Lihat Rekap</button>`:''}
      </div>

      ${records.length ? `<div class="toolbar">
        <input class="search-box" placeholder="Cari nama responden / plat..." value="${App.searchTerm}" data-action="search" />
      </div>` : ''}

      ${filtered.length===0 ? `
        <div class="empty-state">
          <div class="ic">🚚</div>
          <p>${records.length===0 ? 'Belum ada data survei. Ketuk "Survei Baru" untuk mulai wawancara pertama.' : 'Tidak ada hasil yang cocok.'}</p>
        </div>
      ` : filtered.map(r=>`
        <div class="record-card" data-action="open-detail" data-id="${r.id}">
          <div class="plate">${r.platKendaraan||'-'}</div>
          <div class="meta">
            <b>${r.namaResponden||'(tanpa nama)'}</b>
            <span>${formatTanggalIndo(r.tanggal)} · Shift ${r.shift||'-'} · ${r.perusahaanEkspedisi||'-'}</span>
          </div>
          <div class="chev">›</div>
        </div>
      `).join('')}
    </main>
  `;
}

/* ---------- WIZARD ---------- */
function renderWizard(){
  const step = STEPS[App.stepIndex];
  const d = App.draft;
  const total = STEPS.length;

  $app.innerHTML = `
    ${topbar('Survei Baru', `Langkah ${App.stepIndex+1} dari ${total}`, `<button class="icon-btn" data-action="cancel-wizard">Tutup</button>`)}
    <div class="progress-track">
      ${STEPS.map((s,i)=>`<div class="progress-seg ${i<App.stepIndex?'done':i===App.stepIndex?'current':''}"></div>`).join('')}
    </div>
    <main>
      ${App.stepIndex===0 ? `
        <div class="meta-strip">
          <span>📅 <b>${formatTanggalIndo(d.tanggal)}</b> (${d.hari})</span>
          <span>🕐 <b>${d.waktuSurvei}</b> · Shift <b>${d.shift}</b></span>
          <span>📍 <b>${d.lokasiSurvei||'(lokasi belum diatur)'}</b></span>
          <button data-action="open-profile">Ubah</button>
        </div>
      ` : ''}

      <div class="step-header">
        <div class="step-kicker">
          <span class="badge badge-${step.badge}">${step.badge==='wajib'?'Wajib':'Tambahan'}</span>
          <span>${step.title}</span>
        </div>
        <h2>${step.title}</h2>
      </div>

      <div class="ask-box">
        <div class="ic">💬</div>
        <p><span class="ask-label">Tanyakan ke supir</span>${step.question}</p>
      </div>

      <div class="field-grid">
        ${step.fields.map(f=>renderField(f,d)).join('')}
      </div>

      ${renderComputed(step,d)}
    </main>

    <div class="wizard-nav">
      ${App.stepIndex>0 ? `<button class="btn btn-ghost" data-action="wizard-back">Kembali</button>` : `<button class="btn btn-ghost" data-action="cancel-wizard">Batal</button>`}
      ${step.badge==='tambahan' ? `<button class="btn btn-outline" data-action="wizard-skip">Lewati</button>` : ''}
      <button class="btn btn-primary grow-2" data-action="wizard-next">${App.stepIndex===total-1 ? 'Simpan Survei' : 'Lanjut'}</button>
    </div>
  `;

  // live recompute of computed fields on input
  updateComputedDisplays();
}

function fieldVisible(f,d){
  return !f.showIf || f.showIf(d);
}

function renderField(f,d){
  if(!fieldVisible(f,d)) return '';
  const val = d[f.key] ?? '';
  const err = App.errors[f.key];
  const reqClass = f.required ? 'required' : '';
  const errClass = err ? 'has-error' : '';
  const unit = f.unit ? `<span class="unit-note"> (${f.unit})</span>` : '';

  let input = '';
  if(f.type==='select'){
    input = `<select data-field="${f.key}">
      <option value="">— pilih —</option>
      ${f.options.map(o=>`<option value="${o}" ${val===o?'selected':''}>${o}</option>`).join('')}
    </select>`;
  } else if(f.type==='textarea'){
    input = `<textarea data-field="${f.key}" placeholder="${f.placeholder||''}">${val}</textarea>`;
  } else if(f.type==='number'){
    input = `<input type="number" inputmode="decimal" step="any" data-field="${f.key}" value="${val}" placeholder="${f.placeholder||'0'}" />`;
  } else if(f.type==='currency'){
    const display = val ? Number(val).toLocaleString('id-ID') : '';
    input = `<input type="text" inputmode="numeric" data-field="${f.key}" data-currency="1" value="${display}" placeholder="0" />`;
  } else {
    input = `<input type="text" data-field="${f.key}" value="${val}" placeholder="${f.placeholder||''}" />`;
  }

  return `<div class="field ${reqClass} ${errClass}" data-fieldwrap="${f.key}">
    <label>${f.label}${unit}</label>
    ${input}
    ${err?`<div class="field-error">${err}</div>`:''}
  </div>`;
}

function renderComputed(step,d){
  if(!step.computed || !step.computed.length) return '';
  return step.computed.map(c=>{
    const v = c.formula(d);
    const display = c.isCurrency ? formatCurrency(v) : `${formatNumber(v)}${c.unit?' '+c.unit:''}`;
    return `<div class="computed-box" data-computed="${c.key}">
      <span>${c.label} (otomatis)</span><b>${display}</b>
    </div>`;
  }).join('');
}

function updateComputedDisplays(){
  const step = STEPS[App.stepIndex];
  if(!step.computed) return;
  step.computed.forEach(c=>{
    App.draft[c.key] = c.formula(App.draft);
  });
}

/* ---------- DETAIL ---------- */
function sectionRows(fields, d){
  return fields.filter(f=>fieldVisible(f,d)).map(f=>{
    const raw = d[f.key];
    if(raw===undefined || raw==='' || raw===null) return '';
    let display = raw;
    if(f.type==='currency') display = formatCurrency(raw);
    else if(f.type==='number') display = formatNumber(raw) + (f.unit?' '+f.unit:'');
    return `<div class="detail-row"><span>${f.label}</span><span>${display}</span></div>`;
  }).join('');
}

function renderDetail(){
  const d = Store.get(App.detailId);
  if(!d){ App.view='home'; return renderHome(); }

  $app.innerHTML = `
    ${topbar('Detail Responden', d.namaResponden||'-', `<button class="icon-btn" data-action="back-home">Kembali</button>`)}
    <main>
      <div class="export-row no-print">
        <button class="btn btn-outline" data-action="edit-record" data-id="${d.id}">Edit</button>
        <button class="btn btn-outline" data-action="export-pdf">Unduh PDF</button>
        <button class="btn btn-outline" data-action="export-word" data-id="${d.id}">Unduh Word</button>
        <button class="btn btn-danger" data-action="delete-record" data-id="${d.id}">Hapus</button>
      </div>

      <div class="detail-sheet">
        <div class="sheet-head">
          <h2>${d.namaResponden||'(tanpa nama)'} — ${d.platKendaraan||'-'}</h2>
          <p>${formatTanggalIndo(d.tanggal)} · ${d.waktuSurvei||'-'} · Shift ${d.shift||'-'} · Surveyor: ${d.surveyor||'-'} · ${d.lokasiSurvei||'-'}</p>
        </div>
        ${STEPS.map(step=>{
          const rows = sectionRows(step.fields, d);
          const computedRows = (step.computed||[]).map(c=>{
            const v = d[c.key];
            if(v===undefined) return '';
            const display = c.isCurrency ? formatCurrency(v) : `${formatNumber(v)}${c.unit?' '+c.unit:''}`;
            return `<div class="detail-total"><span>${c.label}</span><span>${display}</span></div>`;
          }).join('');
          if(!rows && !computedRows) return '';
          return `<div class="detail-section">
            <h4>${step.title}</h4>
            ${rows}
            ${computedRows}
          </div>`;
        }).join('')}
      </div>
    </main>
  `;
}

/* ---------- REKAP (semua data) ---------- */
function renderRekap(){
  const records = Store.getRecords();
  const cols = [
    ['tanggal','Tanggal'], ['namaResponden','Responden'], ['platKendaraan','Plat'],
    ['perusahaanEkspedisi','Ekspedisi'], ['perusahaanAsal','Asal'], ['perusahaanTujuan','Tujuan'],
    ['komoditas','Komoditas'], ['beratMuatan','Berat (Ton)'], ['jarak','Jarak (Km)'],
    ['jumlahTrip','Biaya/Trip (Rp)'],
  ];
  $app.innerHTML = `
    ${topbar('Rekap Semua Data', `${records.length} responden`, `<button class="icon-btn" data-action="back-home">Kembali</button>`)}
    <main>
      <div class="export-row no-print">
        <button class="btn btn-outline" data-action="export-csv">Unduh CSV (semua kolom)</button>
        <button class="btn btn-outline" data-action="export-pdf">Cetak / PDF</button>
      </div>
      <div class="rekap-wrap">
        <table class="rekap">
          <thead><tr>${cols.map(c=>`<th>${c[1]}</th>`).join('')}</tr></thead>
          <tbody>
            ${records.length===0 ? `<tr><td colspan="${cols.length}" class="muted">Belum ada data.</td></tr>` :
              records.map(r=>`<tr>${cols.map(([k])=>{
                let v = r[k];
                if(k==='jumlahTrip') v = v?Math.round(v).toLocaleString('id-ID'):'';
                return `<td>${v ?? ''}</td>`;
              }).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
    </main>
  `;
}

/* ---------------------------------------------------------
   VALIDASI
--------------------------------------------------------- */
function validateStep(step, d){
  const errors = {};
  step.fields.forEach(f=>{
    if(f.required && fieldVisible(f,d)){
      const v = d[f.key];
      if(v===undefined || v===null || v==='') errors[f.key] = 'Wajib diisi';
    }
  });
  return errors;
}

/* ---------------------------------------------------------
   EVENT HANDLING
--------------------------------------------------------- */
document.addEventListener('input', (e)=>{
  const t = e.target;
  if(t.matches('[data-field]')){
    const key = t.getAttribute('data-field');
    let val = t.value;
    if(t.dataset.currency){
      const digits = parseDigits(val);
      val = digits ? Number(digits) : '';
      const display = digits ? Number(digits).toLocaleString('id-ID') : '';
      if(t.value !== display) t.value = display;
    }
    App.draft[key] = val;
    if(App.errors[key]){ delete App.errors[key]; const wrap=document.querySelector(`[data-fieldwrap="${key}"]`); if(wrap) wrap.classList.remove('has-error'); }
    updateComputedDisplays();
    const step = STEPS[App.stepIndex];
    if(step.computed){
      step.computed.forEach(c=>{
        const box = document.querySelector(`[data-computed="${c.key}"] b`);
        if(box){
          const v = c.formula(App.draft);
          box.textContent = c.isCurrency ? formatCurrency(v) : `${formatNumber(v)}${c.unit?' '+c.unit:''}`;
        }
      });
    }
    // re-render step if a showIf dependency changed (select controlling conditional fields)
    if(t.tagName==='SELECT'){
      const step = STEPS[App.stepIndex];
      const hasDependents = step.fields.some(f=>f.showIf);
      if(hasDependents) renderWizard();
    }
  }
  if(t.matches('[data-action="search"]')){
    App.searchTerm = t.value;
    renderHome();
    const box = document.querySelector('.search-box');
    if(box){ box.focus(); box.selectionStart = box.selectionEnd = box.value.length; }
  }
});

document.addEventListener('change', (e)=>{
  const t = e.target;
  if(t.matches('[data-field]') && t.tagName==='SELECT'){
    // handled in input listener above too (select fires 'input' in modern browsers),
    // kept here as a safety net for older browsers
  }
});

document.addEventListener('blur', (e)=>{
  const t = e.target;
  if(t.matches && t.matches('[data-field]')){
    const key = t.getAttribute('data-field');
    const fieldDef = allFieldsFlat().find(f=>f.key===key);
    if(fieldDef && fieldDef.titleCase && App.draft[key]){
      App.draft[key] = titleCase(String(App.draft[key]).trim());
      t.value = App.draft[key];
    }
    if(fieldDef && fieldDef.plate && App.draft[key]){
      App.draft[key] = normalizePlate(App.draft[key]);
      t.value = App.draft[key];
    }
  }
}, true);

document.addEventListener('click', (e)=>{
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const action = el.getAttribute('data-action');

  if(action==='new-survey'){
    const profile = Store.getProfile();
    if(!profile.surveyor){ openProfileModal(true); return; }
    App.draft = newDraft();
    App.stepIndex = 0;
    App.errors = {};
    App.view = 'wizard';
    render();
  }
  else if(action==='cancel-wizard'){
    if(confirm('Batalkan survei ini? Data yang sudah diisi tidak akan disimpan.')){
      App.view='home'; render();
    }
  }
  else if(action==='wizard-back'){
    App.stepIndex = Math.max(0, App.stepIndex-1);
    App.errors = {};
    render();
  }
  else if(action==='wizard-skip'){
    if(App.stepIndex === STEPS.length-1){
      saveDraftAndShowDetail();
    } else {
      App.stepIndex++;
      App.errors = {};
      render();
    }
  }
  else if(action==='wizard-next'){
    const step = STEPS[App.stepIndex];
    const errors = validateStep(step, App.draft);
    if(Object.keys(errors).length){
      App.errors = errors;
      render();
      return;
    }
    if(App.stepIndex === STEPS.length-1){
      saveDraftAndShowDetail();
    } else {
      App.stepIndex++;
      App.errors = {};
      render();
    }
  }
  else if(action==='open-detail'){
    App.detailId = el.getAttribute('data-id');
    App.view='detail';
    render();
  }
  else if(action==='back-home'){
    App.view='home'; render();
  }
  else if(action==='open-rekap'){
    App.view='rekap'; render();
  }
  else if(action==='edit-record'){
    const rec = Store.get(el.getAttribute('data-id'));
    if(rec){ App.draft = rec; App.stepIndex=0; App.errors={}; App.view='wizard'; render(); }
  }
  else if(action==='delete-record'){
    if(confirm('Hapus data responden ini? Tindakan ini tidak bisa dibatalkan.')){
      Store.remove(el.getAttribute('data-id'));
      App.view='home'; render();
      showToast('Data dihapus');
    }
  }
  else if(action==='export-pdf'){
    window.print();
  }
  else if(action==='export-word'){
    exportWord(Store.get(el.getAttribute('data-id')));
  }
  else if(action==='export-csv'){
    exportCsv(Store.getRecords());
  }
  else if(action==='open-profile'){
    openProfileModal(false);
  }
});

function saveDraftAndShowDetail(){
  Store.addOrUpdate(App.draft);
  App.view='detail'; App.detailId=App.draft.id;
  render();
  showToast('Survei tersimpan ✓');
}

function showToast(msg){
  const t = document.createElement('div');
  t.className='toast'; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2200);
}

/* ---------------------------------------------------------
   MODAL: PROFIL SURVEYOR
--------------------------------------------------------- */
function openProfileModal(forceBeforeSurvey){
  const p = Store.getProfile();
  const wrap = document.createElement('div');
  wrap.className='modal-backdrop';
  wrap.innerHTML = `
    <div class="modal">
      <h3>Profil Surveyor</h3>
      <p class="modal-sub">Diisi sekali, otomatis terpakai di setiap survei baru (bisa diubah kapan saja).</p>
      <div class="field"><label>Nama Surveyor</label><input type="text" id="pf-surveyor" value="${p.surveyor||''}" placeholder="Nama Anda" /></div>
      <div class="field mt-8"><label>Lokasi Survei</label><input type="text" id="pf-lokasi" value="${p.lokasiSurvei||''}" placeholder="cth. Terminal Nilam" /></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="pf-cancel">Batal</button>
        <button class="btn btn-primary" id="pf-save">Simpan</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.querySelector('#pf-cancel').onclick = ()=> wrap.remove();
  wrap.addEventListener('click', (e)=>{ if(e.target===wrap) wrap.remove(); });
  wrap.querySelector('#pf-save').onclick = ()=>{
    const surveyor = wrap.querySelector('#pf-surveyor').value.trim();
    const lokasiSurvei = wrap.querySelector('#pf-lokasi').value.trim();
    Store.saveProfile({ surveyor: titleCase(surveyor), lokasiSurvei: titleCase(lokasiSurvei) });
    wrap.remove();
    if(forceBeforeSurvey){
      App.draft = newDraft();
      App.stepIndex = 0; App.errors = {}; App.view='wizard';
      render();
    } else if(App.view==='wizard'){
      const prof = Store.getProfile();
      App.draft.surveyor = prof.surveyor; App.draft.lokasiSurvei = prof.lokasiSurvei;
      render();
    }
  };
}

/* ---------------------------------------------------------
   EKSPOR: WORD (.doc via HTML — dibuka native oleh MS Word)
--------------------------------------------------------- */
function exportWord(d){
  if(!d) return;
  const sections = STEPS.map(step=>{
    const rows = step.fields.filter(f=>fieldVisible(f,d)).map(f=>{
      const raw = d[f.key];
      if(raw===undefined||raw===''||raw===null) return '';
      let display = raw;
      if(f.type==='currency') display = formatCurrency(raw);
      else if(f.type==='number') display = formatNumber(raw)+(f.unit?' '+f.unit:'');
      return `<tr><td style="padding:4px 8px;color:#555;">${f.label}</td><td style="padding:4px 8px;font-weight:bold;">${display}</td></tr>`;
    }).join('');
    const computedRows = (step.computed||[]).map(c=>{
      const v = d[c.key]; if(v===undefined) return '';
      const display = c.isCurrency? formatCurrency(v) : `${formatNumber(v)}${c.unit?' '+c.unit:''}`;
      return `<tr><td style="padding:4px 8px;color:#555;">${c.label}</td><td style="padding:4px 8px;font-weight:bold;">${display}</td></tr>`;
    }).join('');
    if(!rows && !computedRows) return '';
    return `<h3 style="font-family:Arial;font-size:13px;text-transform:uppercase;color:#4b5b60;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:18px;">${step.title}</h3>
      <table style="width:100%;border-collapse:collapse;font-family:Arial;font-size:13px;">${rows}${computedRows}</table>`;
  }).join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><title>Survei ${d.namaResponden||''}</title></head>
    <body style="font-family:Arial;">
      <h2 style="font-family:Arial;">${d.namaResponden||'(tanpa nama)'} — ${d.platKendaraan||'-'}</h2>
      <p style="color:#555;font-size:12px;">${formatTanggalIndo(d.tanggal)} · ${d.waktuSurvei||'-'} · Shift ${d.shift||'-'} · Surveyor: ${d.surveyor||'-'} · ${d.lokasiSurvei||'-'}</p>
      ${sections}
    </body></html>`;

  const blob = new Blob(['\ufeff', html], {type:'application/msword'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Survei_${(d.namaResponden||'responden').replace(/\s+/g,'_')}_${d.tanggal||''}.doc`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------
   EKSPOR: CSV (semua kolom, semua responden — untuk rekap/analisis)
--------------------------------------------------------- */
function exportCsv(records){
  if(!records.length){ showToast('Belum ada data untuk diekspor'); return; }
  const keys = ['tanggal','hari','waktuSurvei','shift','surveyor','lokasiSurvei', ...allFieldsFlat().map(f=>f.key), ...STEPS.flatMap(s=>(s.computed||[]).map(c=>c.key))];
  const uniqueKeys = [...new Set(keys)];
  const escape = v => `"${String(v??'').replace(/"/g,'""')}"`;
  const header = uniqueKeys.join(',');
  const rows = records.map(r=> uniqueKeys.map(k=>escape(r[k])).join(','));
  const csv = '\ufeff' + [header, ...rows].join('\r\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `rekap_survei_truk_${todayStr()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------
   INIT
--------------------------------------------------------- */
render();
