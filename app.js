const SUPABASE_URL = "https://oaxpofkmtrudriyrbxvy.supabase.co";
const SUPABASE_KEY = "sb_publishable_W0bTuLBKIo_-tSVK_XfKYg_LScZ_5EY";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET_NAME = "dishes-images";

/* ===============================
   INITIALISATION
================================= */
document.addEventListener("DOMContentLoaded", () => {
    const adminPanel = document.getElementById("admin-panel");
    const loginSection = document.getElementById("login-section");
    const dishForm = document.getElementById("dish-form");

    if (adminPanel) adminPanel.style.display = "none";
    if (loginSection) loginSection.style.display = "block";

    if (dishForm) {
        dishForm.addEventListener("submit", handleDishSubmit);
    }

    checkSession();
    populateSubcategoryDatalist();
});

/* ===============================
   LOGIN ADMIN (HYBRIDE : AUTH + TABLE ACCESS_CONTROL)
================================= */
async function loginAdmin() {
    const usernameOrEmail = document.getElementById("admin-email")?.value?.trim();
    const password = document.getElementById("admin-password")?.value;
    const loginMessage = document.getElementById("login-message");

    if (loginMessage) loginMessage.innerText = "Vérification...";

    // --- 1. Tentative via l'Auth standard de Supabase (Email) ---
    const { data: authData, error: authError } = await client.auth.signInWithPassword({
        email: usernameOrEmail,
        password: password
    });

    if (!authError) {
        showAdminPanel();
        return;
    }

    // --- 2. Tentative via la table 'access_control' (Username/MDP personnalisés) ---
    const { data: customUser, error: customError } = await client
        .from("access_control")
        .select("*")
        .eq("username", usernameOrEmail)
        .eq("password", password)
        .single();

    if (customUser) {
        // On utilise sessionStorage pour garder la session active sur l'onglet actuel
        sessionStorage.setItem("custom_admin_session", "true");
        showAdminPanel();
        return;
    }

    // --- 3. Échec total ---
    if (loginMessage) {
        loginMessage.innerText = "Erreur : Identifiants incorrects.";
    }
}

/* ===============================
   LOGOUT
================================= */
async function logoutAdmin() {
    await client.auth.signOut();
    sessionStorage.removeItem("custom_admin_session");
    location.reload();
}

/* ===============================
   SESSION
================================= */
async function checkSession() {
    const { data } = await client.auth.getSession();
    const hasCustomSession = sessionStorage.getItem("custom_admin_session") === "true";

    if (data?.session || hasCustomSession) {
        showAdminPanel();
    }
}

// Fonction utilitaire pour l'affichage
function showAdminPanel() {
    const loginSection = document.getElementById("login-section");
    const adminPanel = document.getElementById("admin-panel");

    if (loginSection) loginSection.style.display = "none";
    if (adminPanel) adminPanel.style.display = "block";

    loadDishes();
    populateSubcategoryDatalist();
}

/**
 * Convertit n'importe quel fichier image en WebP de manière asynchrone
 */
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

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Erreur de conversion WebP"));
                }, "image/webp", 0.8);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

/* ===============================
   OUTILS IMAGES
================================= */

function getImagePublicUrl(imagePath) {
    if (!imagePath) return "";
    const { data } = client.storage.from(BUCKET_NAME).getPublicUrl(imagePath);
    return data?.publicUrl || "";
}

async function uploadImage(file) {
    try {
        const webpBlob = await processImageToWebP(file);
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;

        const { error } = await client.storage
            .from(BUCKET_NAME)
            .upload(fileName, webpBlob, {
                contentType: 'image/webp',
                cacheControl: "3600",
                upsert: false
            });

        if (error) {
            alert("Erreur upload : " + error.message);
            return null;
        }

        return fileName;
    } catch (err) {
        console.error("Erreur upload image:", err);
        return null;
    }
}

/* ===============================
   CHARGER LES PLATS
================================= */
async function loadDishes() {
    const { data, error } = await client.from("dishes").select("*");

    if (error) {
        console.error("Erreur chargement plats :", error);
        return;
    }

    const container = document.getElementById("dish-list");
    if (!container) return;

    container.innerHTML = "";

    const sortMode = document.getElementById("sort-select")?.value || "category";
    const activeDishes = (data || []).filter(d => d.available);
    const inactiveDishes = (data || []).filter(d => !d.available);

    if (sortMode === "category") {
        renderByCategory(activeDishes, container);
        if (inactiveDishes.length > 0) {
            renderSectionTitle(container, "DÉSACTIVÉS :");
            renderByCategory(inactiveDishes, container, true);
        }
    } else {
        renderAlphabetical(activeDishes, container);
        if (inactiveDishes.length > 0) {
            renderSectionTitle(container, "DÉSACTIVÉS :");
            renderAlphabetical(inactiveDishes, container, true);
        }
    }
}

function renderByCategory(dishes, container, isInactive = false) {
    const categoryOrder = ["entree", "plat", "dessert", "accompagnement", "boisson"];

    categoryOrder.forEach(category => {
        const categoryDishes = dishes.filter(d => (d.category || "").toLowerCase() === category);
        if (categoryDishes.length === 0) return;

        const labels = { entree: "ENTRÉES", plat: "PLATS", dessert: "DESSERTS", boisson: "BOISSONS" };
        renderSectionTitle(container, labels[category] || category.toUpperCase());

        const subGroups = {};
        categoryDishes.forEach(dish => {
            const key = dish.subcategory?.trim() || "Autre";
            if (!subGroups[key]) subGroups[key] = [];
            subGroups[key].push(dish);
        });

        let subKeys = Object.keys(subGroups).sort((a, b) => subGroups[b].length - subGroups[a].length);
        if (subKeys.includes("Autre")) {
            subKeys = subKeys.filter(k => k !== "Autre");
            subKeys.push("Autre");
        }

        subKeys.forEach(sub => {
            const subTitle = document.createElement("h3");
            subTitle.innerText = (sub === "Autre" && subGroups[sub].length > 1) ? "Autres" : sub;
            subTitle.style.textAlign = "left";
            subTitle.style.margin = "20px 0 10px 0";
            container.appendChild(subTitle);

            const grid = document.createElement("div");
            grid.className = "category-group";
            container.appendChild(grid);

            subGroups[sub].forEach(dish => {
                grid.appendChild(createDishCard(dish, isInactive));
            });
        });
    });
}

function renderAlphabetical(dishes, container, isInactive = false) {
    const sortedDishes = [...dishes].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const grid = document.createElement("div");
    grid.className = "alphabetical-grid";
    container.appendChild(grid);

    sortedDishes.forEach(dish => {
        grid.appendChild(createDishCard(dish, isInactive));
    });
}

function renderSectionTitle(container, text) {
    const separator = document.createElement("hr");
    separator.className = "admin-separator";
    separator.style.margin = "50px 0 10px 0";
    container.appendChild(separator);

    const title = document.createElement("h2");
    title.innerText = text;
    title.style.textAlign = "left";
    title.style.margin = "0 0 20px 0";
    container.appendChild(title);
}

function createDishCard(dish, isInactive) {
    const card = document.createElement("div");
    card.className = "dish-card";
    if (isInactive) card.classList.add("dish-disabled");

    const imageDiv = document.createElement("div");
    imageDiv.className = "dish-image";

    if (dish.image_path) {
        const img = document.createElement("img");
        img.src = getImagePublicUrl(dish.image_path);
        img.alt = dish.name || "Image du plat";
        img.loading = "lazy";
        imageDiv.appendChild(img);
    }

    const info = document.createElement("div");
    info.className = "dish-info";
    info.innerHTML = `
      <b>• ${escapeHtml(dish.name)}</b><br>
      ${formatPrice(dish.price)}<br>
      ${dish.description ? `<b>Description :</b> ${escapeHtml(dish.description)}<br>` : ""}
      ${dish.ingredients ? `<b>Ingrédients :</b> ${escapeHtml(dish.ingredients)}` : ""}
    `;

    imageDiv.addEventListener("click", () => {
        if (imageDiv.querySelector(".dish-actions")) return;

        const actions = document.createElement("div");
        actions.className = "dish-actions";
        actions.style.position = "absolute";
        actions.style.top = "0";
        actions.style.left = "0";
        actions.style.width = "100%";
        actions.style.height = "100%";
        actions.style.display = "flex";
        actions.style.flexDirection = "column";
        actions.style.justifyContent = "center";
        actions.style.alignItems = "center";
        actions.style.gap = "10px";
        actions.style.background = "rgba(0,0,0,0.6)";

        const toggleBtn = document.createElement("button");
        toggleBtn.innerText = dish.available ? "Désactiver" : "Activer";
        toggleBtn.addEventListener("click", e => { e.stopPropagation(); toggleDish(dish.id, dish.available); });

        const editBtn = document.createElement("button");
        editBtn.innerText = "Modifier";
        editBtn.addEventListener("click", e => { e.stopPropagation(); editDish(dish.id); });

        const delBtn = document.createElement("button");
        delBtn.innerText = "Supprimer";
        delBtn.addEventListener("click", e => { e.stopPropagation(); deleteDish(dish.id); });

        actions.append(toggleBtn, editBtn, delBtn);
        imageDiv.appendChild(actions);
    });

    card.appendChild(imageDiv);
    card.appendChild(info);

    return card;
}

async function toggleDish(id, status) {
    const { error } = await client.from("dishes").update({ available: !status }).eq("id", id);
    if (error) return alert("Erreur mise à jour : " + error.message);
    loadDishes();
}

async function deleteDish(id) {
    const confirmDelete = confirm("Supprimer ce plat et son image ?");
    if (!confirmDelete) return;

    const { data: dishData, error: fetchError } = await client.from("dishes").select("id, image_path").eq("id", id).single();
    if (fetchError) return alert("Erreur : " + fetchError.message);

    if (dishData?.image_path) {
        await client.storage.from(BUCKET_NAME).remove([dishData.image_path]);
    }

    const { error: deleteError } = await client.from("dishes").delete().eq("id", id);
    if (deleteError) return alert("Erreur suppression : " + deleteError.message);

    loadDishes();
}

async function editDish(id) {
    const { data, error } = await client.from("dishes").select("*").eq("id", id).single();
    if (error) return alert("Impossible de récupérer le plat.");

    const form = document.getElementById("dish-form");
    if (!form) return;

    form.querySelector('input[name="name"]').value = data.name || "";
    form.querySelector('textarea[name="description"]').value = data.description || "";
    form.querySelector('input[name="price"]').value = data.price || "";
    form.querySelector('select[name="category"]').value = data.category || "";
    form.querySelector('input[name="subcategory"]').value = data.subcategory || "";
    form.querySelector('textarea[name="ingredients"]').value = data.ingredients || "";
    form.querySelector('input[name="available"]').checked = !!data.available;

    form.dataset.editId = id;

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.innerText = "Modifier le plat";

    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleDishSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');

    const name = form.querySelector('input[name="name"]').value.trim();
    const description = form.querySelector('textarea[name="description"]').value.trim();
    const price = parseFloat(form.querySelector('input[name="price"]').value || "0");
    const category = form.querySelector('select[name="category"]').value;
    const subcategory = form.querySelector('input[name="subcategory"]').value.trim();
    const ingredients = form.querySelector('textarea[name="ingredients"]').value.trim();
    const available = form.querySelector('input[name="available"]').checked;
    const file = form.querySelector('input[name="image_file"]')?.files?.[0];

    submitBtn.innerText = "Optimisation et envoi...";
    submitBtn.disabled = true;

    try {
        let new_image_path = null;
        const editId = form.dataset.editId;

        if (editId && file) {
            const { data: oldDish } = await client
                .from("dishes")
                .select("image_path")
                .eq("id", editId)
                .single();

            if (oldDish?.image_path) {
                await client.storage.from(BUCKET_NAME).remove([oldDish.image_path]);
            }
        }

        if (file) {
            new_image_path = await uploadImage(file);
            if (!new_image_path) throw new Error("Erreur lors de l'upload.");
        }

        if (editId) {
            const updateData = { name, description, price, category, subcategory, ingredients, available };
            if (new_image_path) updateData.image_path = new_image_path;

            const { error } = await client.from("dishes").update(updateData).eq("id", editId);
            if (error) throw error;
        } else {
            const { error } = await client.from("dishes").insert([{
                name, description, price, category, subcategory, ingredients, available, image_path: new_image_path
            }]);
            if (error) throw error;
        }

        form.reset();
        const preview = document.getElementById("image-preview");
        if (preview) preview.innerHTML = "";

        if (editId) {
            delete form.dataset.editId;
        }

        loadDishes();
        populateSubcategoryDatalist();
        window.scrollTo({ top: 0, behavior: "smooth" });

    } catch (err) {
        alert("Erreur : " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = form.dataset.editId ? "Modifier le plat" : "Ajouter";
    }
}

async function populateSubcategoryDatalist() {
    const { data, error } = await client.from("dishes").select("subcategory");
    if (error) return console.error("Erreur récupération sous-catégories :", error);

    const datalist = document.getElementById("subcategory-list");
    if (!datalist) return;

    const uniqueSubs = [...new Set((data || []).map(d => d.subcategory).filter(s => s && s.trim() !== ""))];

    datalist.innerHTML = "";
    uniqueSubs.forEach(sub => {
        const option = document.createElement("option");
        option.value = sub;
        datalist.appendChild(option);
    });
}

function formatPrice(price) {
    const num = Number(price);
    if (Number.isNaN(num)) return "";
    return `${num.toFixed(2)}€`;
}

function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}