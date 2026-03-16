// ================================
// app-admin.js corrigé
// ================================
const SUPABASE_URL = "https://oaxpofkmtrudriyrbxvy.supabase.co";
const SUPABASE_KEY = "sb_publishable_W0bTuLBKIo_-tSVK_XfKYg_LScZ_5EY";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// LOGIN ADMIN
async function loginAdmin() {
    const email = document.getElementById("admin-email").value;
    const password = document.getElementById("admin-password").value;

    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
        let message = "Identifiant ou mot de passe non reconnu";
        if (error.message.includes("user not found")) message = "Compte introuvable";
        document.getElementById("login-message").innerText = message;
    } else {
        document.getElementById("login-section").style.display = "none";
        document.getElementById("admin-panel").style.display = "block";
        loadDishes();
    }
}

// CHECK SESSION
async function checkSession() {
    const { data } = await client.auth.getSession();
    if (data.session) {
        document.getElementById("login-section").style.display = "none";
        document.getElementById("admin-panel").style.display = "block";
        loadDishes();
    }
}

// LOGOUT
async function logoutAdmin() {
    await client.auth.signOut();
    location.reload();
}

// UPLOAD IMAGE
async function uploadImage(file) {
    const ext = file.name.split(".").pop();
    const filename = Date.now() + "." + ext;

    const { error } = await client.storage.from("dishes-images").upload(filename, file);
    if (error) { alert("Erreur upload : " + error.message); return null; }

    return filename; // stocke juste le nom du fichier
}

// LOAD DISHES
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
            img.style.pointerEvents = "none"; // permet aux boutons d’être cliquables
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

// DELETE DISH + IMAGE
async function deleteDish(id, imagePath) {
    if (!confirm("Supprimer ce plat et son image ?")) return;

    try {
        if (imagePath) {
            const { error } = await client.storage.from("dishes-images").remove([imagePath]);
            if (error) console.warn("Erreur suppression image:", error.message);
        }
        const { error: delError } = await client.from("dishes").delete().eq("id", id);
        if (delError) throw delError;

        loadDishes();
    } catch (err) { alert("Erreur : " + err.message); }
}

// TOGGLE AVAILABILITY
async function toggleDish(id, status) {
    await client.from("dishes").update({ available: !status }).eq("id", id);
    loadDishes();
}

// EDIT
function editDish(id) { console.log("Modifier plat :", id); }

// AJOUT PLAT
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
        const uploaded = await uploadImage(file);
        if (!uploaded) return;
        image_path = uploaded;
    }

    const { error } = await client.from("dishes").insert([{
        name, category, subcategory, price, description, ingredients, available, image_path
    }]);

    if (error) { alert("Erreur : " + error.message); return; }

    document.getElementById("dish-form").reset();
    loadDishes();
});

// INIT ADMIN
document.addEventListener("DOMContentLoaded", checkSession);
