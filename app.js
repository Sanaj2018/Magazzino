const KEY_STOCK = "magazzino_stock_v1";
const KEY_MOVES = "magazzino_moves_v1";

const elMov = document.getElementById("movimento");
const elDate = document.getElementById("dataMov");
const elCat = document.getElementById("categoria");
const elProd = document.getElementById("prodotto");
const elQty  = document.getElementById("quantita");
const elUni  = document.getElementById("unita");
const elSearch = document.getElementById("search");

const listCibo = document.getElementById("listCibo");
const listBev  = document.getElementById("listBevande");

const toast = document.getElementById("toast");

function unitForCategory(cat) {
  return (cat === "Bevande") ? "bott" : "pz";
}

function todayYYYYMMDD() {
  const d = new Date();
  const mm = String(d.getMonth()+1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function nowISO() { return new Date().toISOString(); }

function formatDateYYYYMMDD(yyyyMMdd) {
  // input "2026-02-20" -> "20/02/2026"
  if (!yyyyMMdd || yyyyMMdd.length !== 10) return "";
  const [y,m,d] = yyyyMMdd.split("-");
  return `${d}/${m}/${y}`;
}

function normName(s) { return (s || "").trim(); }
function sameName(a, b) {
  return a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (toast.hidden = true), 1800);
}

// ----- STORAGE -----
function loadStock() {
  try {
    const raw = localStorage.getItem(KEY_STOCK);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveStock(items) {
  localStorage.setItem(KEY_STOCK, JSON.stringify(items));
}

function loadMoves() {
  try {
    const raw = localStorage.getItem(KEY_MOVES);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveMoves(moves) {
  localStorage.setItem(KEY_MOVES, JSON.stringify(moves));
}

// ----- SORT -----
function sortStock(items) {
  return items.slice().sort((x,y) => {
    if (x.categoria !== y.categoria) return x.categoria.localeCompare(y.categoria);
    return x.prodotto.localeCompare(y.prodotto, undefined, { sensitivity: "base" });
  });
}

// ----- APPLY MOVEMENT (updates stock + adds move) -----
function applyMovementToStock(stock, movimento, categoria, prodotto, quantita, dataMov) {
  const nome = normName(prodotto);
  const q = Math.max(0, parseInt(quantita, 10) || 0);
  const data = dataMov || todayYYYYMMDD();

  if (!nome) return { ok:false, msg:"Scrivi il prodotto" };
  if (q <= 0) return { ok:false, msg:"Metti una quantità > 0" };

  const copy = stock.slice();
  const idx = copy.findIndex(it => it.categoria === categoria && sameName(it.prodotto, nome));

  if (idx >= 0) {
    if (movimento === "carico") {
      copy[idx].quantita += q;
    } else {
      // non va sotto zero
      copy[idx].quantita = Math.max(0, copy[idx].quantita - q);
    }
    copy[idx].lastUpdated = nowISO();
  } else {
    // se non esiste, si crea solo con carico
    if (movimento !== "carico") return { ok:false, msg:"Non esiste: fai prima Carico" };
    copy.push({
      id: crypto.randomUUID(),
      categoria,
      prodotto: nome,
      quantita: q,
      lastUpdated: nowISO()
    });
  }

  return { ok:true, stock: sortStock(copy), data };
}

// ----- RENDER -----
function render() {
  const stock = loadStock();
  const q = normName(elSearch.value);
  const filtered = !q ? stock : stock.filter(it =>
    it.prodotto.toLowerCase().includes(q.toLowerCase())
  );

  const cibo = filtered.filter(it => it.categoria === "Cibo");
  const bev  = filtered.filter(it => it.categoria === "Bevande");

  listCibo.innerHTML = cibo.map(itemCard).join("") || `<div class="item"><div class="itemMeta">Vuoto</div></div>`;
  listBev.innerHTML  = bev.map(itemCard).join("")  || `<div class="item"><div class="itemMeta">Vuoto</div></div>`;

  document.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      onItemAction(action, id);
    });
  });
}

function itemCard(it) {
  const unit = unitForCategory(it.categoria);
  const last = it.lastUpdated ? new Date(it.lastUpdated) : null;
  const dd = last ? String(last.getDate()).padStart(2,"0") : "";
  const mm = last ? String(last.getMonth()+1).padStart(2,"0") : "";
  const yy = last ? last.getFullYear() : "";
  const lastTxt = last ? `${dd}/${mm}/${yy}` : "";

  return `
    <div class="item">
      <div class="itemTop">
        <div class="itemName">${escapeHtml(it.prodotto)}</div>
        <div class="itemQty">${it.quantita} ${unit}</div>
      </div>
      <div class="itemMeta">
        <div>Aggiornato: ${lastTxt}</div>
        <div>${it.categoria}</div>
      </div>
      <div class="itemBtns">
        <button data-action="minus" data-id="${it.id}">-1</button>
        <button data-action="plus" data-id="${it.id}">+1</button>
        <button data-action="delete" data-id="${it.id}">Elimina</button>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// +/- e delete aggiornano SOLO giacenza (e aggiorno lastUpdated)
function onItemAction(action, id) {
  const stock = loadStock();
  const idx = stock.findIndex(x => x.id === id);
  if (idx < 0) return;

  if (action === "delete") {
    stock.splice(idx, 1);
    saveStock(sortStock(stock));
    render();
    showToast("Eliminato");
    return;
  }

  if (action === "plus") {
    stock[idx].quantita += 1;
  } else if (action === "minus") {
    stock[idx].quantita = Math.max(0, stock[idx].quantita - 1);
  }
  stock[idx].lastUpdated = nowISO();
  saveStock(sortStock(stock));
  render();
}

// ----- EXPORT -----
function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ----- INIT -----
elCat.addEventListener("change", () => {
  elUni.value = unitForCategory(elCat.value);
});

document.getElementById("btnAdd").addEventListener("click", () => {
  const stock = loadStock();
  const movimento = elMov.value;
  const categoria = elCat.value;
  const prodotto = elProd.value;
  const quantita = elQty.value;
  const dataMov = elDate.value || todayYYYYMMDD();

  const res = applyMovementToStock(stock, movimento, categoria, prodotto, quantita, dataMov);
  if (!res.ok) { showToast(res.msg); return; }

  // salva stock
  saveStock(res.stock);

  // salva movimento con data
  const moves = loadMoves();
  moves.push({
    id: crypto.randomUUID(),
    data: res.data,                 // "YYYY-MM-DD"
    tipo: movimento,                // "carico" | "scarico"
    categoria,
    prodotto: normName(prodotto),
    quantita: parseInt(quantita, 10),
    createdAt: nowISO()
  });
  saveMoves(moves);

  elProd.value = "";
  elQty.value = "";
  render();
  showToast(`Salvato (${formatDateYYYYMMDD(res.data)})`);
});

document.getElementById("btnReset").addEventListener("click", () => {
  elMov.value = "carico";
  elCat.value = "Cibo";
  elUni.value = "pz";
  elDate.value = todayYYYYMMDD();
  elProd.value = "";
  elQty.value = "";
  elSearch.value = "";
  render();
});

elSearch.addEventListener("input", render);

document.getElementById("btnExport").addEventListener("click", () => {
  downloadJson("Magazzino-giacenze.json", loadStock());
});

document.getElementById("btnExportMov").addEventListener("click", () => {
  downloadJson("Magazzino-movimenti.json", loadMoves());
});

// default data e unità
elDate.value = todayYYYYMMDD();
elUni.value = unitForCategory(elCat.value);

render();
