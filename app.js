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

async function loginAdmin() {
    const usernameOrEmail = document.getElementById("admin-email")?.value?.trim();
    const password = document.getElementById("admin-password")?.value;
    const loginMessage = document.getElementById("login-message");

    if (loginMessage) loginMessage.innerText = "Vérification...";

    const { data: authData, error: authError } = await client.auth.signInWithPassword({
        email: usernameOrEmail,
        password: password
    });

    if (!authError) { showAdminPanel(); return; }

    const { data: customUser } = await client
        .from("access_control")
        .select("*")
        .eq("username", usernameOrEmail)
        .eq("password", password)
        .single();

    if (customUser) {
        sessionStorage.setItem("custom_admin_session", "true");
        showAdminPanel();
        return;
    }
    if (loginMessage) loginMessage.innerText = "Erreur : Identifiants incorrects.";
}

async function logoutAdmin() {
    await client.auth.signOut();
    sessionStorage.removeItem("custom_admin_session");
    location.reload();
}

async function checkSession() {
    const { data } = await client.auth.getSession();
    const hasCustomSession = sessionStorage.getItem("custom_admin_session") === "true";
    if (data?.session || hasCustomSession) showAdminPanel();
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
    if (error) return console.error(error);

    const container = document.getElementById("dish-list");
    if (!container) return;
    container.innerHTML = "";

    const sortMode = document.getElementById("sort-select")?.value || "category";
    const layoutMode = document.getElementById("layout-select")?.value || "grid-6"; // NOUVEAU

    const activeDishes = (data || []).filter(d => d.available);
    const inactiveDishes = (data || []).filter(d => !d.available);

    if (sortMode === "category") {
        renderByCategory(activeDishes, container, layoutMode);
        if (inactiveDishes.length > 0) {
            renderSectionTitle(container, "DÉSACTIVÉS :");
            renderByCategory(inactiveDishes, container, layoutMode, true);
        }
    } else {
        renderAlphabetical(activeDishes, container, layoutMode);
        if (inactiveDishes.length > 0) {
            renderSectionTitle(container, "DÉSACTIVÉS :");
            renderAlphabetical(inactiveDishes, container, layoutMode, true);
        }
    }
}

function renderByCategory(dishes, container, layoutMode, isInactive = false) {
    const categoryOrder = ["entree", "plat", "dessert", "accompagnement", "boisson"];
    const labels = { entree: "ENTRÉES", plat: "PLATS", dessert: "DESSERTS", boisson: "BOISSONS", accompagnement: "ACCOMPAGNEMENTS" };

    categoryOrder.forEach(category => {
        const categoryDishes = dishes.filter(d => (d.category || "").toLowerCase() === category);
        if (categoryDishes.length === 0) return;

        renderSectionTitle(container, labels[category] || category.toUpperCase());

        const subGroups = {};
        categoryDishes.forEach(dish => {
            const key = dish.subcategory?.trim() || "Autre";
            if (!subGroups[key]) subGroups[key] = [];
            subGroups[key].push(dish);
        });

        Object.keys(subGroups).forEach(sub => {
            const subTitle = document.createElement("h3");
            subTitle.innerText = sub;
            container.appendChild(subTitle);

            const grid = document.createElement("div");
            grid.className = layoutMode; // On applique la classe de disposition ici
            container.appendChild(grid);

            subGroups[sub].forEach(dish => grid.appendChild(createDishCard(dish, isInactive)));
        });
    });
}

function renderAlphabetical(dishes, container, layoutMode, isInactive = false) {
    const sortedDishes = [...dishes].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const grid = document.createElement("div");
    grid.className = layoutMode; // On applique la classe de disposition ici
    container.appendChild(grid);

    sortedDishes.forEach(dish => grid.appendChild(createDishCard(dish, isInactive)));
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
    const editBtn = document.createElement("button"); editBtn.innerText = "Modifier";
    editBtn.onclick = () => editDish(dish.id);
    const delBtn = document.createElement("button"); delBtn.innerText = "Supprimer";
    delBtn.onclick = () => deleteDish(dish.id);
    actions.append(editBtn, delBtn);
    imageDiv.appendChild(actions);

    const info = document.createElement("div");
    info.className = "dish-info";
    info.innerHTML = `<b>${escapeHtml(dish.name)}</b><br>${formatPrice(dish.price)}`;

    card.append(imageDiv, info);
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
        form.reset();
        loadDishes();
    } catch (err) { alert(err.message); }
    finally { submitBtn.disabled = false; submitBtn.innerText = "Ajouter"; }
}

async function deleteDish(id) {
    if (!confirm("Supprimer ?")) return;
    await client.from("dishes").delete().eq("id", id);
    loadDishes();
}

async function editDish(id) {
    const { data } = await client.from("dishes").select("*").eq("id", id).single();
    const form = document.getElementById("dish-form");
    form.querySelector('[name="name"]').value = data.name;
    form.querySelector('[name="price"]').value = data.price;
    form.querySelector('[name="category"]').value = data.category;
    form.dataset.editId = id;
    form.querySelector('button[type="submit"]').innerText = "Modifier";
    window.scrollTo(0, 0);
}

function populateSubcategoryDatalist() {
    // Logique existante pour les sous-catégories...
}

function formatPrice(p) { return parseFloat(p).toFixed(2) + "€"; }
function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }