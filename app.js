const SUPABASE_URL = "https://oaxpofkmtrudriyrbxvy.supabase.co";
const SUPABASE_KEY = "sb_publishable_W0bTuLBKIo_-tSVK_XfKYg_LScZ_5EY";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET_NAME = "dishes-images";

/* ===============================
   INITIALISATION & SESSION
================================= */
document.addEventListener("DOMContentLoaded", () => {
    const adminPanel = document.getElementById("admin-panel");
    const loginSection = document.getElementById("login-section");
    const dishForm = document.getElementById("dish-form");

    if (adminPanel) adminPanel.style.display = "none";
    if (loginSection) loginSection.style.display = "block";

    if (dishForm) dishForm.addEventListener("submit", handleDishSubmit);

    checkSession();
    populateSubcategoryDatalist();
});

/* LOGIN & SESSION ********************************************************************************/
async function loginAdmin() {
    const username = document.getElementById("admin-email")?.value?.trim().toLowerCase();
    const password = document.getElementById("admin-password")?.value;
    const loginMessage = document.getElementById("login-message");

    if (!username || !password) {
        if (loginMessage) loginMessage.innerText = "Champs vides.";
        return;
    }

    if (loginMessage) loginMessage.innerText = "Connexion en cours...";
    const fakeEmail = `${username}@digicarte.fr`;

    const { data, error } = await client.auth.signInWithPassword({
        email: fakeEmail,
        password: password
    });

    if (error) {
        if (loginMessage) loginMessage.innerText = "Identifiants invalides.";
        console.error("Erreur login:", error.message);
        return;
    }

    // Si réussi, Supabase gère le jeton JWT automatiquement
    showAdminPanel();
}

async function checkSession() {
    // On vérifie si une session active existe déjà au chargement de la page
    const { data: { session } } = await client.auth.getSession();
    if (session) {
        showAdminPanel();
    }
}

async function logoutAdmin() {
    await client.auth.signOut();
    location.reload();
}

function showAdminPanel() {
    document.getElementById("login-section").style.display = "none";
    document.getElementById("admin-panel").style.display = "block";
    loadDishes();
    populateSubcategoryDatalist();
}

/* ===============================
   GESTION DES IMAGES
================================= */
async function processImageToWebP(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 1200;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => { blob ? resolve(blob) : reject(new Error("Erreur WebP")); }, "image/webp", 0.8);
            };
        };
    });
}

function getImagePublicUrl(imagePath) {
    if (!imagePath) return "";
    const { data } = client.storage.from(BUCKET_NAME).getPublicUrl(imagePath);
    return data?.publicUrl || "";
}

async function uploadImage(file) {
    try {
        const webpBlob = await processImageToWebP(file);
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;

        const { error } = await client.storage.from(BUCKET_NAME).upload(fileName, webpBlob, { contentType: 'image/webp' });
        if (error) throw error;
        return fileName;
    } catch (err) { console.error(err); return null; }
}

/* ===============================
   CHARGEMENT & AFFICHAGE (MODIFIÉ)
================================= */
async function loadDishes() {
    const { data, error } = await client.from("dishes").select("*");
    if (error) return console.error("Erreur chargement :", error);

    const container = document.getElementById("dish-list");
    if (!container) return;
    container.innerHTML = "";

    // ON DÉFINIT LES VALEURS PAR DÉFAUT ICI :
    const sortSelect = document.getElementById("sort-select");
    const layoutSelect = document.getElementById("layout-select");

    const sortMode = sortSelect ? sortSelect.value : "category";
    const layoutMode = layoutSelect ? layoutSelect.value : "grid-mosaic";

    // Séparation Actifs / Inactifs (pour garder ta logique)
    const activeDishes = (data || []).filter(d => d.available);
    const inactiveDishes = (data || []).filter(d => !d.available);

    if (sortMode === "category") {
        // Mode Catégorie : On crée une bulle par catégorie
        renderByCategory(activeDishes, container, layoutMode);

        if (inactiveDishes.length > 0) {
            const sep = document.createElement("hr");
            sep.className = "admin-separator";
            container.appendChild(sep);
            renderByCategory(inactiveDishes, container, layoutMode, true);
        }
    } else {
        // Mode Alphabétique : Tout dans une seule grande bulle
        renderAlphabetical(activeDishes, container, layoutMode);

        if (inactiveDishes.length > 0) {
            const sep = document.createElement("hr");
            sep.className = "admin-separator";
            container.appendChild(sep);
            renderAlphabetical(inactiveDishes, container, layoutMode, true);
        }
    }
}

function renderByCategory(dishes, container, layoutMode, isInactive = false) {
    const categories = ["entree", "plat", "accompagnement", "dessert", "boisson"];
    const labels = { entree: "ENTRÉES", plat: "PLATS", accompagnement: "ACCOMPAGNEMENTS", dessert: "DESSERTS", boisson: "BOISSONS" };

    categories.forEach(cat => {
        const filtered = dishes.filter(d => (d.category || "").toLowerCase() === cat);
        if (filtered.length === 0) return;

        // CRÉATION DE LA BULLE 3D
        const bubble = document.createElement("div");
        bubble.className = "group-bubble";

        const title = document.createElement("h2");
        title.innerText = isInactive ? `${labels[cat]} (DÉSACTIVÉS)` : labels[cat];
        bubble.appendChild(title);

        // Application du mode de grille choisi (grid-6, grid-mosaic ou grid-single)
        const grid = document.createElement("div");
        grid.className = layoutMode;

        filtered.forEach(dish => {
            grid.appendChild(createDishCard(dish, isInactive));
        });

        bubble.appendChild(grid);
        container.appendChild(bubble);
    });
}

function renderAlphabetical(dishes, container, layoutMode, isInactive = false) {
    if (dishes.length === 0) return;

    // CRÉATION DE LA BULLE UNIQUE POUR LE TRI A-Z
    const bubble = document.createElement("div");
    bubble.className = "group-bubble";

    const title = document.createElement("h2");
    title.innerText = isInactive ? "TOUS LES PLATS A-Z (DÉSACTIVÉS)" : "TOUS LES PLATS (ORDRE ALPHABÉTIQUE)";
    bubble.appendChild(title);

    const grid = document.createElement("div");
    grid.className = layoutMode;

    const sorted = [...dishes].sort((a, b) => a.name.localeCompare(b.name));
    sorted.forEach(dish => {
        grid.appendChild(createDishCard(dish, isInactive));
    });

    bubble.appendChild(grid);
    container.appendChild(bubble);
}

function renderSectionTitle(container, text) {
    const title = document.createElement("h2");
    title.innerText = text;
    container.appendChild(title);
}

function createDishCard(dish, isInactive) {
    const card = document.createElement("div");
    card.className = "dish-card";
    if (isInactive) card.style.opacity = "0.6";

    const imageDiv = document.createElement("div");
    imageDiv.className = "dish-image";
    if (dish.image_path) {
        const img = document.createElement("img");
        img.src = getImagePublicUrl(dish.image_path);
        imageDiv.appendChild(img);
    }

    const actions = document.createElement("div");
    actions.className = "dish-actions";

    const editBtn = document.createElement("button");
    editBtn.innerText = "Modifier";
    // Important : stopPropagation pour éviter que le clic sur le bouton ne relance le timer de la carte
    editBtn.onclick = (e) => { e.stopPropagation(); editDish(dish.id); };

    const delBtn = document.createElement("button");
    delBtn.innerText = "Supprimer";
    delBtn.onclick = (e) => { e.stopPropagation(); deleteDish(dish.id); };

    actions.append(editBtn, delBtn);
    imageDiv.appendChild(actions);

    const info = document.createElement("div");
    info.className = "dish-info";
    info.innerHTML = `<b>${escapeHtml(dish.name)}</b><br>${formatPrice(dish.price)}`;

    card.append(imageDiv, info);

    // --- LOGIQUE DE SÉCURITÉ AU CLIC ---
    let timer = null;

    card.addEventListener("click", () => {
        // Si la carte est déjà active, on ne fait rien (ou on peut refermer si on veut)
        if (card.classList.contains("active")) return;

        // On active la carte (rend les boutons visibles et cliquables)
        card.classList.add("active");

        // On lance le compte à rebours de 2 secondes
        if (timer) clearTimeout(timer); // Sécurité si on clique frénétiquement

        timer = setTimeout(() => {
            card.classList.remove("active");
        }, 2000); // 2000ms = 2 secondes
    });

    return card;
}

/* ===============================
   ACTIONS (SUBMIT, EDIT, DELETE)
================================= */
async function handleDishSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const editId = form.dataset.editId;
    const preview = document.getElementById("image-preview"); // On cible la preview

    submitBtn.disabled = true;
    try {
        let imagePath = null;
        const file = formData.get("image_file");
        if (file && file.size > 0) imagePath = await uploadImage(file);

        const payload = {
            name: formData.get("name"),
            category: formData.get("category"),
            subcategory: formData.get("subcategory"),
            price: parseFloat(formData.get("price")),
            description: formData.get("description"),
            ingredients: formData.get("ingredients"),
            available: form.querySelector('#available').checked
        };
        if (imagePath) payload.image_path = imagePath;

        if (editId) {
            await client.from("dishes").update(payload).eq("id", editId);
            delete form.dataset.editId;
        } else {
            await client.from("dishes").insert([payload]);
        }

        form.reset(); // Vide les champs texte
        if (preview) preview.innerHTML = ""; // <--- ICI : Vide l'image de prévisualisation
        loadDishes();

    } catch (err) {
        alert(err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Ajouter";
    }
}

async function deleteDish(id) {
    if (!confirm("Supprimer définitivement ce plat et son image ?")) return;
    const { data: dish } = await client.from("dishes").select("image_path").eq("id", id).single();
    if (dish?.image_path) {
        await client.storage.from(BUCKET_NAME).remove([dish.image_path]);
    }
    await client.from("dishes").delete().eq("id", id);

    loadDishes();
}

async function editDish(id) {
    // 1. Récupération de toutes les données du plat depuis Supabase
    const { data, error } = await client.from("dishes").select("*").eq("id", id).single();

    if (error || !data) {
        alert("Erreur lors de la récupération du plat");
        return;
    }

    const form = document.getElementById("dish-form");

    // 2. Pré-remplissage des champs textes et numériques
    form.querySelector('[name="name"]').value = data.name || "";
    form.querySelector('[name="price"]').value = data.price || "";
    form.querySelector('[name="category"]').value = data.category || "plat";
    form.querySelector('[name="subcategory"]').value = data.subcategory || "";
    form.querySelector('[name="description"]').value = data.description || "";
    form.querySelector('[name="ingredients"]').value = data.ingredients || "";

    // 3. Gestion du bouton Switch (Disponible / Indisponible)
    const availableCheckbox = form.querySelector('#available');
    if (availableCheckbox) {
        availableCheckbox.checked = data.available;
    }

    // 4. Affichage de l'aperçu de l'image actuelle (si elle existe)
    const preview = document.getElementById("image-preview");
    if (preview && data.image_path) {
        const url = getImagePublicUrl(data.image_path);
        preview.innerHTML = `
            <p style="font-size: 0.8em; margin-top: 10px;">Image actuelle :</p>
            <img src="${url}" style="max-width:150px; border-radius:10px; border: 2px solid #ccc;">
        `;
    } else if (preview) {
        preview.innerHTML = "";
    }

    // 5. Préparation du formulaire pour la mise à jour
    form.dataset.editId = id; // On stocke l'ID pour savoir qu'on modifie
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.innerText = "Modifier le plat";

    // 6. Remonter en haut de page en douceur pour voir le formulaire rempli
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function populateSubcategoryDatalist() {
    // Logique existante pour les sous-catégories...
}

function formatPrice(p) { return parseFloat(p).toFixed(2) + "€"; }
function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
