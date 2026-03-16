// ================================
// app-admin.js - Pannel admin
// ================================
const SUPABASE_URL = "https://oaxpofkmtrudriyrbxvy.supabase.co";
const SUPABASE_KEY = "sb_publishable_W0bTuLBKIo_-tSVK_XfKYg_LScZ_5EY";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ================================
// LOGIN ADMIN
// ================================
// ================================
// LOGIN ADMIN
// ================================
async function loginAdmin() {
    const email = document.getElementById("admin-email").value;
    const password = document.getElementById("admin-password").value;

    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
        let message = "Erreur : Identifiant ou mot de passe incorrect";

        // Tu peux raffiner selon le code d'erreur si besoin
        if (error.message.includes("invalid login credentials")) {
            message = "Identifiant ou mot de passe non reconnu";
        } else if (error.message.includes("user not found")) {
            message = "Compte introuvable";
        }

        document.getElementById("login-message").innerText = message;

    } else {
        document.getElementById("login-section").style.display = "none";
        document.getElementById("admin-panel").style.display = "block";
        loadDishes();
    }
}

// ================================
// CHECK SESSION
// ================================
async function checkSession() {
    const { data } = await client.auth.getSession();
    if (data.session) {
        document.getElementById("login-section").style.display = "none";
        document.getElementById("admin-panel").style.display = "block";
        loadDishes();
    }
}

// ================================
// LOGOUT
// ================================
async function logoutAdmin() {
    await client.auth.signOut();
    location.reload();
}

// ================================
// UPLOAD IMAGE
// ================================
async function uploadImage(file) {
    const fileExt = file.name.split(".").pop();
    const fileName = Date.now() + "." + fileExt;

    const { error } = await client.storage.from("dishes-images").upload(fileName, file);
    if (error) {
        alert("Erreur upload : " + error.message);
        return null;
    }

    const { data } = client.storage.from("dishes-images").getPublicUrl(fileName);
    return data.publicUrl; // on renvoie l'URL publique
}

// ================================
// LOAD DISHES
// ================================
async function loadDishes() {
    const { data, error } = await client.from("dishes").select("*").order("category");
    if (error) { console.error(error); return; }

    const container = document.getElementById("dish-list");
    container.innerHTML = "";

    data.forEach(dish => {
        const card = document.createElement("div");
        card.className = "dish-card";

        // IMAGE
        if (dish.image_path) {
            const img = document.createElement("img");
            img.src = `${SUPABASE_URL}/storage/v1/object/public/dishes-images/${dish.image_path}`;
            img.alt = dish.name;
            img.style.width = "100%";
            img.style.borderRadius = "10px";
            card.appendChild(img);
        }

        // INFOS
        const info = document.createElement("div");
        info.className = "dish-info";
        info.innerHTML = `<b>${dish.name}</b><br>${dish.price}€`;
        card.appendChild(info);

        // ACTIONS
        const actions = document.createElement("div");
        actions.className = "dish-actions";
        actions.innerHTML = `
            <button onclick="toggleDish('${dish.id}', ${dish.available})">
                ${dish.available ? "Désactiver" : "Activer"}
            </button>
            <button onclick="editDish('${dish.id}')">Modifier</button>
            <button onclick="deleteDish('${dish.id}', '${dish.image_path}')">Supprimer</button>
        `;
        card.appendChild(actions);

        container.appendChild(card);
    });
}

// ================================
// DELETE DISH + IMAGE
// ================================
async function deleteDish(id, imagePath) {
    const confirmDelete = confirm("Supprimer ce plat et son image ?");
    if (!confirmDelete) return;

    try {
        // Supprimer l'image si elle existe
        if (imagePath) {
            const { error: removeError } = await client.storage
                .from("dishes-images")
                .remove([imagePath]);
            if (removeError) console.warn("Erreur suppression image:", removeError.message);
        }

        // Supprimer le plat dans la table
        const { error: deleteError } = await client
            .from("dishes")
            .delete()
            .eq("id", id);

        if (deleteError) throw deleteError;

        loadDishes();

    } catch (err) {
        alert("Erreur : " + err.message);
    }
}

// ================================
// TOGGLE AVAILABILITY
// ================================
async function toggleDish(id, status) {
    await client.from("dishes").update({ available: !status }).eq("id", id);
    loadDishes();
}

// ================================
// EDIT
// ================================
function editDish(id) {
    console.log("Modifier plat :", id);
}

// ================================
// AJOUT PLAT
// ================================
document.getElementById("dish-form").addEventListener("submit", async e => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const category = document.getElementById("category").value;
    const subcategory = document.getElementById("subcategory").value.trim();
    const price = parseFloat(document.getElementById("price").value);
    const description = document.getElementById("description").value.trim();
    const ingredients = document.getElementById("ingredients").value.trim();
    const available = document.getElementById("available").checked;
    const file = document.getElementById("image_file").files[0];

    let image_path = "";
    if (file) {
        const publicUrl = await uploadImage(file);
        // On stocke le nom de fichier dans image_path
        image_path = file.name; // ou remplacer par Date.now()+ext si tu veux unique
    }

    const { error } = await client.from("dishes").insert([{
        name, category, subcategory, price, description, ingredients, available, image_path
    }]);

    if (error) {
        alert("Erreur : " + error.message);
        return;
    }

    document.getElementById("dish-form").reset();
    loadDishes();
});

// ================================
// INIT ADMIN
// ================================
document.addEventListener("DOMContentLoaded", checkSession);
