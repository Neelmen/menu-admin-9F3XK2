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

    const { error } = await client.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        if (loginMessage) {
            loginMessage.innerText = "Erreur : " + error.message;
        }
        return;
    }

    const loginSection = document.getElementById("login-section");
    const adminPanel = document.getElementById("admin-panel");

    if (loginSection) loginSection.style.display = "none";
    if (adminPanel) adminPanel.style.display = "block";

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

    const loginSection = document.getElementById("login-section");
    const adminPanel = document.getElementById("admin-panel");

    if (data?.session) {
        if (loginSection) loginSection.style.display = "none";
        if (adminPanel) adminPanel.style.display = "block";
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
        .upload(fileName, file, {
            cacheControl: "3600",
            upsert: false
        });

    if (error) {
        alert("Erreur upload : " + error.message);
        return null;
    }

    return fileName;
}

function getImagePublicUrl(imagePath) {
    if (!imagePath) return "";

    const cleanPath = extractStoragePath(imagePath);
    if (!cleanPath) return "";

    const { data } = client.storage
        .from(BUCKET_NAME)
        .getPublicUrl(cleanPath);

    return data?.publicUrl || "";
}

function extractStoragePath(value) {
    if (!value || typeof value !== "string") return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    const publicPrefix = `/storage/v1/object/public/${BUCKET_NAME}/`;
    const publicIndex = trimmed.indexOf(publicPrefix);
    if (publicIndex !== -1) {
        return trimmed.substring(publicIndex + publicPrefix.length).split("?")[0];
    }

    if (!trimmed.includes("http://") && !trimmed.includes("https://") && !trimmed.includes("/")) {
        return trimmed;
    }

    const bucketSegment = `${BUCKET_NAME}/`;
    const bucketIndex = trimmed.indexOf(bucketSegment);
    if (bucketIndex !== -1) {
        return trimmed.substring(bucketIndex + bucketSegment.length).split("?")[0];
    }

    try {
        const url = new URL(trimmed);
        const parts = url.pathname.split("/").filter(Boolean);
        return parts[parts.length - 1] || null;
    } catch {
        return trimmed.split("/").pop()?.split("?")[0] || null;
    }
}

/* ===============================
   CHARGER LES PLATS
================================= */
async function loadDishes() {
    const { data, error } = await client
        .from("dishes")
        .select("*")
        .order("category", { ascending: true })
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

function renderDishGroup(dishes, container, isInactive = false) {
    let currentCategory = null;
    let grid = null;

    dishes.forEach(dish => {
        if (dish.category !== currentCategory) {
            currentCategory = dish.category;

            grid = document.createElement("div");
            grid.className = "dish-grid";
            container.appendChild(grid);
        }

        const card = document.createElement("div");
        card.className = "dish-card";

        if (isInactive) {
            card.classList.add("dish-disabled");
        }

        const imageDiv = document.createElement("div");
        imageDiv.className = "dish-image";

        const imageSource = dish.image_path || dish.url || dish.name || "";

        if (imageSource) {
            const img = document.createElement("img");
            img.src = getImagePublicUrl(imageSource);
            img.alt = dish.name || "Image du plat";
            img.style.width = "100%";
            img.style.borderRadius = "10px";
            img.loading = "lazy";

            img.onerror = () => {
                console.error("Image introuvable :", imageSource);
                img.style.display = "none";
            };

            imageDiv.appendChild(img);
        }

        const info = document.createElement("div");
        info.className = "dish-info";
        info.innerHTML = `<b>${escapeHtml(dish.name || "")}</b><br>${formatPrice(dish.price)}`;

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
        grid.appendChild(card);
    });
}

/* ===============================
   ACTIVER / DESACTIVER via RPC
================================= */
async function toggleDish(id, status) {
    const { error } = await client
        .from("dishes")
        .update({ available: !status })
        .eq("id", id);

    if (error) {
        alert("Erreur mise à jour : " + error.message);
        return;
    }

    loadDishes();
}

/* ===============================
   SUPPRIMER PLAT + IMAGE STORAGE
================================= */
async function deleteDish(id) {
    const confirmDelete = confirm("Supprimer ce plat et son image ?");
    if (!confirmDelete) return;

    try {
        const { data: dishData, error: fetchError } = await client
            .from("dishes")
            .select("id, image_path")
            .eq("id", id)
            .single();

        if (fetchError) throw fetchError;

        if (dishData?.image_path) {
            let filePath = dishData.image_path.trim();
            if (filePath.includes("/")) filePath = filePath.split("/").pop();

            const { data, error: removeError } = await client.storage
                .from(BUCKET_NAME)
                .remove([filePath]);

            if (removeError) console.error("Erreur suppression image :", removeError.message);
        }

        const { error: deleteError } = await client
            .from("dishes")
            .delete()
            .eq("id", id);

        if (deleteError) throw deleteError;

        loadDishes();
    } catch (err) {
        console.error("Erreur complète :", err);
        alert("Erreur : " + err.message);
    }
}

/* ===============================
   EDIT
================================= */
function editDish(id) {
    console.log("Modifier plat :", id);
}

/* ===============================
   TAP MOBILE
================================= */
document.addEventListener("click", function (e) {
    const card = e.target.closest(".dish-card");
    const clickedAction = e.target.closest(".dish-actions");

    if (!clickedAction) {
        document.querySelectorAll(".dish-actions").forEach(el => { el.style.opacity = "0"; });
    }

    if (card) {
        const actions = card.querySelector(".dish-actions");
        if (actions) actions.style.opacity = "1";
    }
});

/* ===============================
   AJOUT PLAT
================================= */
async function handleDishSubmit(e) {
    e.preventDefault();

    const name = document.getElementById("name")?.value?.trim() || "";
    const category = document.getElementById("category")?.value || "";
    const subcategory = document.getElementById("subcategory")?.value?.trim() || "";
    const price = parseFloat(document.getElementById("price")?.value || "0");
    const description = document.getElementById("description")?.value?.trim() || "";
    const ingredients = document.getElementById("ingredients")?.value?.trim() || "";
    const available = document.getElementById("available")?.checked || false;
    const file = document.getElementById("image_file")?.files?.[0];

    let image_path = null;

    if (file) {
        image_path = await uploadImage(file);
        if (!image_path) return;
    }

    const { error } = await client.from("dishes").insert([{
        name,
        category,
        subcategory,
        price,
        description,
        ingredients,
        available,
        image_path
    }]);

    if (error) {
        alert("Erreur ajout plat : " + error.message);
        return;
    }

    const form = document.getElementById("dish-form");
    if (form) form.reset();

    loadDishes();
}

/* ===============================
   HELPERS
================================= */
function isLikelyImageFile(value) {
    if (!value || typeof value !== "string") return false;
    return /\.(jpg|jpeg|png|webp|gif|avif|svg)$/i.test(value.trim());
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
