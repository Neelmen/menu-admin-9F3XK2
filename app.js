const SUPABASE_URL = "https://oaxpofkmtrudriyrbxvy.supabase.co";
const SUPABASE_KEY = "sb_publishable_W0bTuLBKIo_-tSVK_XfKYg_LScZ_5EY";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET_NAME = "dishes-images";


// INITIALISATION
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("admin-panel").style.display = "none";
    document.getElementById("login-section").style.display = "block";
    checkSession();
});


// LOGIN ADMIN
async function loginAdmin() {
    const email = document.getElementById("admin-email").value;
    const password = document.getElementById("admin-password").value;

    const { error } = await client.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        document.getElementById("login-message").innerText = "Erreur : " + error.message;
        return;
    }

    document.getElementById("login-section").style.display = "none";
    document.getElementById("admin-panel").style.display = "block";

    loadDishes();
}


// LOGOUT
async function logoutAdmin() {
    await client.auth.signOut();
    location.reload();
}


// SESSION
async function checkSession() {
    const { data } = await client.auth.getSession();

    if (data.session) {
        document.getElementById("login-section").style.display = "none";
        document.getElementById("admin-panel").style.display = "block";
        loadDishes();
    }
}


/* ===============================
   OUTILS IMAGES
================================= */

// Upload dans le bucket + retour du chemin fichier
async function uploadImage(file) {
    const fileExt = file.name.split(".").pop().toLowerCase();
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

    return fileName; // on retourne le path, pas l'URL publique
}

// Construit l'URL publique à partir du path
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
    const { data, error } = await client
        .from("dishes")
        .select("*")
        .order("category", { ascending: true })
        .order("subcategory", { ascending: true })
        .order("name", { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    const container = document.getElementById("dish-list");
    container.innerHTML = "";

    const activeDishes = data.filter(d => d.available);
    const inactiveDishes = data.filter(d => !d.available);

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
   RENDU DES GROUPES
================================= */
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

        const info = document.createElement("div");
        info.className = "dish-info";
        info.innerHTML = `
            <b>${dish.name}</b><br>
            ${dish.price}€
        `;

        const imageDiv = document.createElement("div");
        imageDiv.className = "dish-image";

        if (dish.image_path) {
            const img = document.createElement("img");
            img.src = getImagePublicUrl(dish.image_path);
            img.alt = dish.name || "Image du plat";
            img.style.width = "100%";
            img.style.borderRadius = "10px";
            img.loading = "lazy";

            img.onerror = () => {
                console.error("Image introuvable :", dish.image_path);
                img.style.display = "none";
            };

            imageDiv.appendChild(img);
        }

        const actions = document.createElement("div");
        actions.className = "dish-actions";
        actions.style.opacity = "0";

        actions.innerHTML = `
            <button onclick="toggleDish('${dish.id}', ${dish.available})">
                ${dish.available ? "Désactiver" : "Activer"}
            </button>

            <button onclick="editDish('${dish.id}')">
                Modifier
            </button>

            <button onclick="deleteDish('${dish.id}')">
                Supprimer
            </button>
        `;

        imageDiv.appendChild(actions);

        imageDiv.addEventListener("mouseenter", () => {
            actions.style.opacity = "1";
        });

        imageDiv.addEventListener("mouseleave", () => {
            actions.style.opacity = "0";
        });

        card.appendChild(imageDiv);
        card.appendChild(info);
        grid.appendChild(card);
    });
}


/* ===============================
   ACTIVER / DESACTIVER
================================= */
async function toggleDish(id, status) {
    await client
        .from("dishes")
        .update({ available: !status })
        .eq("id", id);

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
    const card = e.target.closest(".dish-card");

    document.querySelectorAll(".dish-actions").forEach(el => {
        el.style.opacity = "0";
    });

    if (card) {
        const actions = card.querySelector(".dish-actions");
        if (actions) {
            actions.style.opacity = "1";
        }
    }
});


/* ===============================
   AJOUT PLAT
================================= */
document.getElementById("dish-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const category = document.getElementById("category").value;
    const subcategory = document.getElementById("subcategory").value.trim();
    const price = parseFloat(document.getElementById("price").value);
    const description = document.getElementById("description").value.trim();
    const ingredients = document.getElementById("ingredients").value.trim();
    const available = document.getElementById("available").checked;
    const file = document.getElementById("image_file").files[0];

    let image_path = null;

    if (file) {
        image_path = await uploadImage(file);
        if (!image_path) return;
    }

    const { error } = await client.from("dishes").insert([
        {
            name,
            category,
            subcategory,
            price,
            description,
            ingredients,
            available,
            image_path
        }
    ]);

    if (error) {
        alert("Erreur ajout plat : " + error.message);
        return;
    }

    document.getElementById("dish-form").reset();
    loadDishes();
});
