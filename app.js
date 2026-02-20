const KEY = "magazzino_v1";

const elMov = document.getElementById("movimento");
const elCat = document.getElementById("categoria");
const elProd = document.getElementById("prodotto");
const elQty  = document.getElementById("quantita");
const elUni  = document.getElementById("unita");
const elSearch = document.getElementById("search");

const listCibo = document.getElementById("listCibo");
const listBev  = document.getElementById("listBevande");

const toast = document.getElementById("toast");

function nowISO() { return new Date().toISOString(); }

function unitForCategory(cat) {
  return (cat === "Bevande") ? "bott" : "pz";
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

function normName(s) {
  return (s || "").trim();
}

function sameName(a, b) {
  return a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (toast.hidden = true), 1800);
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth()+1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  } catch {
    return "";
  }
}

function sortItems(items) {
  return items.slice().sort((x, y) => {
    if (x.categoria !== y.categoria) return x.categoria.localeCompare(y.categoria);
    return x.prodotto.localeCompare(y.prodotto, undefined, { sensitivity: "base" });
  });
}

function applyMovement(items, movimento, categoria, prodotto, quantita) {
  const nome = normName(prodotto);
  const q = Math.max(0, parseInt(quantita, 10) || 0);
  if (!nome) return { items, changed:false, msg:"Scrivi il prodotto" };
  if (q <= 0) return { items, changed:false, msg:"Metti una quantità > 0" };

  const copy = items.slice();
  const idx = copy.findIndex(it => it.categoria === categoria && sameName(it.prodotto, nome));

  if (idx >= 0) {
    if (movimento === "carico") {
      copy[idx].quantita += q;
    } else {
      copy[idx].quantita = Math.max(0, copy[idx].quantita - q);
    }
    copy[idx].lastUpdated = nowISO();
    return { items: sortItems(copy), changed:true, msg:"Salvato" };
  } else {
    if (movimento !== "carico") return { items, changed:false, msg:"Non esiste: fai prima Carico" };
    copy.push({
      id: crypto.randomUUID(),
      categoria,
      prodotto: nome,
      quantita: q,
      lastUpdated: nowISO()
    });
    return { items: sortItems(copy), changed:true, msg:"Aggiunto" };
  }
}

function render(items) {
  const q = normName(elSearch.value);
  const filtered = !q ? items : items.filter(it =>
    it.prodotto.toLowerCase().includes(q.toLowerCase())
  );

  const cibo = filtered.filter(it => it.categoria === "Cibo");
  const bev  = filtered.filter(it => it.categoria === "Bevande");

  listCibo.innerHTML = cibo.map(itemCard).join("") || `<div class="item"><div class="itemMeta">Vuoto</div></div>`;
  listBev.innerHTML  = bev.map(itemCard).join("")  || `<div class="item"><div class="itemMeta">Vuoto</div></div>`;

  // bind buttons
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
  return `
    <div class="item">
      <div class="itemTop">
        <div class="itemName">${escapeHtml(it.prodotto)}</div>
        <div class="itemQty">${it.quantita} ${unit}</div>
      </div>
      <div class="itemMeta">
        <div>Aggiornato: ${formatDate(it.lastUpdated)}</div>
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

function onItemAction(action, id) {
  const items = load();
  const idx = items.findIndex(x => x.id === id);
  if (idx < 0) return;

  if (action === "delete") {
    items.splice(idx, 1);
    save(sortItems(items));
    render(load());
    showToast("Eliminato");
    return;
  }

  if (action === "plus") {
    items[idx].quantita += 1;
    items[idx].lastUpdated = nowISO();
  } else if (action === "minus") {
    items[idx].quantita = Math.max(0, items[idx].quantita - 1);
    items[idx].lastUpdated = nowISO();
  }
  save(sortItems(items));
  render(load());
}

// Init
elCat.addEventListener("change", () => {
  elUni.value = unitForCategory(elCat.value);
});
elUni.value = unitForCategory(elCat.value);

document.getElementById("btnAdd").addEventListener("click", () => {
  const items = load();
  const res = applyMovement(items, elMov.value, elCat.value, elProd.value, elQty.value);
  if (res.changed) {
    save(res.items);
    elProd.value = "";
    elQty.value = "";
    render(load());
  }
  showToast(res.msg);
});

document.getElementById("btnReset").addEventListener("click", () => {
  elMov.value = "carico";
  elCat.value = "Cibo";
  elUni.value = "pz";
  elProd.value = "";
  elQty.value = "";
  elSearch.value = "";
  render(load());
});

elSearch.addEventListener("input", () => render(load()));

document.getElementById("btnExport").addEventListener("click", () => {
  const items = load();
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Magazzino-export.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

render(load());
