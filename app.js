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
});

/* ===============================
   LOGIN ADMIN
================================= */
async function loginAdmin() {
    const email = document.getElementById("admin-email")?.value?.trim();
    const password = document.getElementById("admin-password")?.value;
    const loginMessage = document.getElementById("login-message");
    if (loginMessage) loginMessage.innerText = "";

    const { error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
        if (loginMessage) loginMessage.innerText = "Erreur : " + error.message;
        return;
    }

    document.getElementById("login-section").style.display = "none";
    document.getElementById("admin-panel").style.display = "block";

    loadDishes();
}

/* ===============================
   LOGOUT
================================= */
async function logoutAdmin() {
    await client.auth.signOut();
    location.reload();
}

/* ===============================
   SESSION
================================= */
async function checkSession() {
    const { data } = await client.auth.getSession();
    if (data?.session) {
        document.getElementById("login-section").style.display = "none";
        document.getElementById("admin-panel").style.display = "block";
        loadDishes();
    }
}

/* ===============================
   OUTILS IMAGES
================================= */
async function uploadImage(file) {
    const fileExt = (file.name.split(".").pop() || "png").toLowerCase();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error } = await client.storage
        .from(BUCKET_NAME)
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

    if (error) {
        alert("Erreur upload : " + error.message);
        return null;
    }

    return fileName;
}

function getImagePublicUrl(imagePath) {
    if (!imagePath) return "";
    const { data } = client.storage.from(BUCKET_NAME).getPublicUrl(imagePath);
    return data?.publicUrl || "";
}

/* ===============================
   CHARGER LES PLATS
================================= */
async function loadDishes() {
    const { data, error } = await client
        .from("dishes")
        .select("*")
        .order("category", { ascending: true })
        .order("subcategory", { ascending: true })
        .order("name", { ascending: true });

    if (error) {
        console.error("Erreur chargement plats :", error);
        return;
    }

    const container = document.getElementById("dish-list");
    if (!container) return;

    container.innerHTML = "";

    const activeDishes = (data || []).filter(d => d.available);
    const inactiveDishes = (data || []).filter(d => !d.available);

    renderDishGroup(activeDishes, container);
    if (inactiveDishes.length > 0) {
        const separator = document.createElement("hr");
        separator.className = "admin-separator";
        separator.style.margin = "50px 0";
        container.appendChild(separator);

        renderDishGroup(inactiveDishes, container, true);
    }
}

/* ===============================
   RENDER DISH GROUP 2 COLONNES
================================= */
function renderDishGroup(dishes, container, isInactive = false) {
    let currentCategory = null;
    let grid = null;

    dishes.forEach(dish => {
        // Crée un nouveau bloc pour chaque catégorie
        if (dish.category !== currentCategory) {
            currentCategory = dish.category;
            grid = document.createElement("div");
            grid.className = "category-group"; // CSS gère 2 colonnes
            container.appendChild(grid);
        }

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
        info.innerHTML = `<b>${escapeHtml(dish.name)}</b><br>${formatPrice(dish.price)}`;

        const actions = document.createElement("div");
        actions.className = "dish-actions";
        actions.style.opacity = "0";
        actions.innerHTML = `
            <button type="button" onclick="toggleDish('${dish.id}', ${dish.available})">
                ${dish.available ? "Désactiver" : "Activer"}
            </button>
            <button type="button" onclick="editDish('${dish.id}')">
                Modifier
            </button>
            <button type="button" onclick="deleteDish('${dish.id}')">
                Supprimer
            </button>
        `;

        imageDiv.appendChild(actions);
        imageDiv.addEventListener("mouseenter", () => { actions.style.opacity = "1"; });
        imageDiv.addEventListener("mouseleave", () => { actions.style.opacity = "0"; });

        card.appendChild(imageDiv);
        card.appendChild(info);

        grid.appendChild(card); // Ajoute la carte à la grille
    });
}

/* ===============================
   ACTIVER / DESACTIVER
================================= */
async function toggleDish(id, status) {
    const { error } = await client.from("dishes").update({ available: !status }).eq("id", id);
    if (error) return alert("Erreur mise à jour : " + error.message);
    loadDishes();
}

/* ===============================
   SUPPRIMER PLAT
================================= */
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

/* ===============================
   EDIT / MODIFICATION
================================= */
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

/* ===============================
   SUBMIT FORMULAIRE
================================= */
async function handleDishSubmit(e) {
    e.preventDefault();
    const form = e.target;

    const name = form.querySelector('input[name="name"]').value.trim();
    const description = form.querySelector('textarea[name="description"]').value.trim();
    const price = parseFloat(form.querySelector('input[name="price"]').value || "0");
    const category = form.querySelector('select[name="category"]').value;
    const subcategory = form.querySelector('input[name="subcategory"]').value.trim();
    const ingredients = form.querySelector('textarea[name="ingredients"]').value.trim();
    const available = form.querySelector('input[name="available"]').checked;
    const file = form.querySelector('input[name="image_file"]')?.files?.[0];

    let image_path = null;
    if (file) {
        image_path = await uploadImage(file);
        if (!image_path) return;
    }

    const editId = form.dataset.editId;

    if (editId) {
        const updateData = { name, description, price, category, subcategory, ingredients, available };
        if (image_path) updateData.image_path = image_path;

        const { error } = await client.from("dishes").update(updateData).eq("id", editId);
        if (error) return alert("Erreur modification plat : " + error.message);

        form.reset();
        delete form.dataset.editId;
        form.querySelector('button[type="submit"]').innerText = "Ajouter";
    } else {
        const { error } = await client.from("dishes").insert([{
            name, description, price, category, subcategory, ingredients, available, image_path
        }]);
        if (error) return alert("Erreur ajout plat : " + error.message);
        form.reset();
    }

    loadDishes();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ===============================
   HELPERS
================================= */
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
