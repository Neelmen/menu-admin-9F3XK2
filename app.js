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

    checkSession();

    if (dishForm) {
        dishForm.addEventListener("submit", handleDishSubmit);
    }
});

/* ===============================
   LOGIN ADMIN
================================= */
async function loginAdmin() {
    const emailInput = document.getElementById("admin-email");
    const passwordInput = document.getElementById("admin-password");
    const loginMessage = document.getElementById("login-message");

    const email = emailInput?.value?.trim() || "";
    const password = passwordInput?.value || "";

    if (loginMessage) loginMessage.innerText = "";

    if (!email || !password) {
        if (loginMessage) {
            loginMessage.innerText = "Veuillez renseigner votre identifiant et votre mot de passe.";
        }
        return;
    }

    const { error } = await client.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        let message = "Identifiant ou mot de passe non reconnu.";

        const errorText = (error.message || "").toLowerCase();

        if (
            errorText.includes("invalid login credentials") ||
            errorText.includes("invalid credentials")
        ) {
            message = "Identifiant ou mot de passe non reconnu.";
        } else if (errorText.includes("email not confirmed")) {
            message = "Adresse e-mail non confirmée.";
        } else if (errorText.includes("too many requests")) {
            message = "Trop de tentatives de connexion. Réessayez dans quelques instants.";
        } else if (errorText.includes("network")) {
            message = "Problème de connexion réseau. Vérifiez votre connexion internet.";
        }

        if (loginMessage) loginMessage.innerText = message;
        return;
    }

    showAdminPanel();
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
    const { data, error } = await client.auth.getSession();

    if (error) {
        console.error("Erreur session :", error.message);
        return;
    }

    if (data?.session) {
        showAdminPanel();
        loadDishes();
    }
}

function showAdminPanel() {
    const adminPanel = document.getElementById("admin-panel");
    const loginSection = document.getElementById("login-section");
    const loginMessage = document.getElementById("login-message");

    if (loginSection) loginSection.style.display = "none";
    if (adminPanel) adminPanel.style.display = "block";
    if (loginMessage) loginMessage.innerText = "";
}

/* ===============================
   OUTILS IMAGES
================================= */
async function uploadImage(file) {
    if (!file) return null;

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`;

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

    const { data } = client.storage
        .from(BUCKET_NAME)
        .getPublicUrl(imagePath);

    return data?.publicUrl || "";
}

/* ===============================
   CHARGER LES PLATS
================================= */
async function loadDishes() {
    const container = document.getElementById("dish-list");
    if (!container) return;

    const { data, error } = await client
        .from("dishes")
        .select("*")
        .order("category", { ascending: true })
        .order("subcategory", { ascending: true })
        .order("name", { ascending: true });

    if (error) {
        console.error("Erreur chargement plats :", error.message);
        container.innerHTML = "<p>Erreur lors du chargement des plats.</p>";
        return;
    }

    container.innerHTML = "";

    const activeDishes = data.filter(dish => dish.available);
    const inactiveDishes = data.filter(dish => !dish.available);

    if (activeDishes.length > 0) {
        const activeTitle = document.createElement("h2");
        activeTitle.textContent = "Plats actifs";
        activeTitle.className = "admin-group-title";
        container.appendChild(activeTitle);

        renderDishGroup(activeDishes, container, false);
    }

    if (inactiveDishes.length > 0) {
        const separator = document.createElement("hr");
        separator.className = "admin-separator";
        separator.style.margin = "40px 0";
        container.appendChild(separator);

        const inactiveTitle = document.createElement("h2");
        inactiveTitle.textContent = "Plats désactivés";
        inactiveTitle.className = "admin-group-title";
        container.appendChild(inactiveTitle);

        renderDishGroup(inactiveDishes, container, true);
    }

    if (data.length === 0) {
        container.innerHTML = "<p>Aucun plat enregistré.</p>";
    }
}

/* ===============================
   RENDU DES GROUPES
================================= */
function renderDishGroup(dishes, container, isInactive = false) {
    let currentCategory = null;
    let categoryBlock = null;
    let grid = null;

    dishes.forEach(dish => {
        if (dish.category !== currentCategory) {
            currentCategory = dish.category;

            categoryBlock = document.createElement("section");
            categoryBlock.className = "admin-category-block";

            const title = document.createElement("h3");
            title.className = "admin-category-title";
            title.textContent = formatCategoryName(currentCategory);

            grid = document.createElement("div");
            grid.className = "dish-grid";

            categoryBlock.appendChild(title);
            categoryBlock.appendChild(grid);
            container.appendChild(categoryBlock);
        }

        const card = document.createElement("div");
        card.className = "dish-card";
        if (isInactive) {
            card.classList.add("dish-disabled");
        }

        const imageDiv = document.createElement("div");
        imageDiv.className = "dish-image";
        imageDiv.style.position = "relative";

        if (dish.image_path) {
            const img = document.createElement("img");
            img.src = getImagePublicUrl(dish.image_path);
            img.alt = dish.name || "Image du plat";
            img.loading = "lazy";
            img.style.width = "100%";
            img.style.display = "block";
            img.style.borderRadius = "10px";

            img.onerror = () => {
                console.error("Image introuvable :", dish.image_path);
                img.remove();
            };

            imageDiv.appendChild(img);
        }

        const actions = document.createElement("div");
        actions.className = "dish-actions";
        actions.style.opacity = "0";
        actions.style.pointerEvents = "none";

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.textContent = dish.available ? "Désactiver" : "Activer";
        toggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleDish(dish.id, dish.available);
        });

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.textContent = "Modifier";
        editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            editDish(dish.id);
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.textContent = "Supprimer";
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteDish(dish.id);
        });

        actions.appendChild(toggleBtn);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        imageDiv.appendChild(actions);

        imageDiv.addEventListener("mouseenter", () => {
            actions.style.opacity = "1";
            actions.style.pointerEvents = "auto";
        });

        imageDiv.addEventListener("mouseleave", () => {
            actions.style.opacity = "0";
            actions.style.pointerEvents = "none";
        });

        const info = document.createElement("div");
        info.className = "dish-info";
        info.innerHTML = `
            <b>${escapeHtml(dish.name || "")}</b><br>
            ${dish.price ?? 0} €
            ${dish.subcategory ? `<br><small>${escapeHtml(dish.subcategory)}</small>` : ""}
        `;

        card.appendChild(imageDiv);
        card.appendChild(info);
        grid.appendChild(card);
    });
}

/* ===============================
   ACTIVER / DÉSACTIVER
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
   SUPPRIMER PLAT + IMAGE
================================= */
async function deleteDish(id) {
    const confirmDelete = confirm("Supprimer ce plat et son image ?");
    if (!confirmDelete) return;

    try {
        const { data: dishData, error: fetchError } = await client
            .from("dishes")
            .select("image_path")
            .eq("id", id)
            .single();

        if (fetchError) {
            throw fetchError;
        }

        if (dishData?.image_path) {
            const { error: removeError } = await client.storage
                .from(BUCKET_NAME)
                .remove([dishData.image_path]);

            if (removeError) {
                console.error("Erreur suppression image :", removeError.message);
            }
        }

        const { error: deleteError } = await client
            .from("dishes")
            .delete()
            .eq("id", id);

        if (deleteError) {
            throw deleteError;
        }

        loadDishes();
    } catch (err) {
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
    const clickedCard = e.target.closest(".dish-card");

    document.querySelectorAll(".dish-actions").forEach(actions => {
        actions.style.opacity = "0";
        actions.style.pointerEvents = "none";
    });

    if (clickedCard) {
        const actions = clickedCard.querySelector(".dish-actions");
        if (actions) {
            actions.style.opacity = "1";
            actions.style.pointerEvents = "auto";
        }
    }
});

/* ===============================
   AJOUT PLAT
================================= */
async function handleDishSubmit(e) {
    e.preventDefault();

    const name = document.getElementById("name")?.value.trim() || "";
    const category = document.getElementById("category")?.value || "";
    const subcategory = document.getElementById("subcategory")?.value.trim() || "";
    const price = parseFloat(document.getElementById("price")?.value || "0");
    const description = document.getElementById("description")?.value.trim() || "";
    const ingredients = document.getElementById("ingredients")?.value.trim() || "";
    const available = document.getElementById("available")?.checked || false;
    const file = document.getElementById("image_file")?.files?.[0] || null;

    if (!name || !category || isNaN(price)) {
        alert("Merci de remplir correctement le nom, la catégorie et le prix.");
        return;
    }

    let image_path = null;

    if (file) {
        image_path = await uploadImage(file);
        if (!image_path) return;
    }

    const { error } = await client.from("dishes").insert([
        {
            name,
            category,
            subcategory: subcategory || null,
            price,
            description: description || null,
            ingredients: ingredients || null,
            available,
            image_path
        }
    ]);

    if (error) {
        alert("Erreur ajout plat : " + error.message);
        return;
    }

    const form = document.getElementById("dish-form");
    if (form) form.reset();

    loadDishes();
}

/* ===============================
   OUTILS
================================= */
function formatCategoryName(category) {
    if (!category) return "Sans catégorie";

    const map = {
        entree: "Entrées",
        plat: "Plats",
        dessert: "Desserts",
        boisson: "Boissons"
    };

    return map[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

function escapeHtml(str) {
    return str
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
