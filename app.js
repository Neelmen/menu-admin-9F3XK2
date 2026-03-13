// ================================
// app.js - Admin Menu
// ================================
const SUPABASE_URL = "https://oaxpofkmtrudriyrbxvy.supabase.co";
const SUPABASE_KEY = "sb_publishable_W0bTuLBKIo_-tSVK_XfKYg_LScZ_5EY";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// INITIALISATION AU CHARGEMENT
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("admin-panel").style.display = "none";
    document.getElementById("login-section").style.display = "block";
    checkSession();
});

// LOGIN ADMIN
async function loginAdmin(){
    const email = document.getElementById("admin-email").value;
    const password = document.getElementById("admin-password").value;

    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if(error){
        document.getElementById("login-message").innerText = "Erreur : " + error.message;
    } else {
        document.getElementById("login-section").style.display = "none";
        document.getElementById("admin-panel").style.display = "block";
        loadDishes();
    }
}

// LOGOUT
async function logoutAdmin(){
    await client.auth.signOut();
    location.reload();
}

// UPLOAD IMAGE
async function uploadImage(file){
    const fileExt = file.name.split('.').pop();
    const fileName = Date.now() + "." + fileExt;

    const { data, error } = await client.storage
        .from("dishes-images")
        .upload(fileName, file);

    if(error){
        alert("Erreur upload : " + error.message);
        return null;
    }

    const { data: publicUrl } = client
        .storage
        .from("dishes-images")
        .getPublicUrl(fileName);

    return publicUrl.publicUrl;
}

// VERIFICATION SESSION
async function checkSession(){
    const { data } = await client.auth.getSession();
    if(data.session){
        document.getElementById("login-section").style.display = "none";
        document.getElementById("admin-panel").style.display = "block";
        loadDishes();
    }
}

// CHARGER LES PLATS
async function loadDishes() {

    const { data, error } = await client
        .from("dishes")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    const container = document.getElementById("dish-list");
    container.innerHTML = "";

    data.forEach(dish => {

        const div = document.createElement("div");
        div.className = "dish-card";

        // Info plat
        const infoDiv = document.createElement("div");
        infoDiv.className = "dish-info";
        infoDiv.innerHTML = `
            <b>${dish.name}</b><br>
            ${dish.category} - ${dish.price}€<br>
            <p>${dish.description || ""}</p>
            <p><i>${dish.ingredients || ""}</i></p>
        `;

        // Image plat
        const imageDiv = document.createElement("div");
        imageDiv.className = "dish-image";

        if (dish.image_url) {
            const img = document.createElement("img");
            img.src = dish.image_url;
            img.style.width = "100%";
            img.style.borderRadius = "10px";
            imageDiv.appendChild(img);
        }

        // Boutons overlay
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "dish-actions";
        actionsDiv.style.opacity = "0"; // invisible par défaut
        actionsDiv.innerHTML = `
            <button onclick="toggleDish('${dish.id}', ${dish.available})">
                ${dish.available ? "Désactiver" : "Activer"}
            </button>
            <button onclick="editDish('${dish.id}')">Modifier</button>
            <button onclick="deleteDish('${dish.id}')">Supprimer</button>
        `;
        imageDiv.appendChild(actionsDiv);

        // Ajouter hover pour desktop
        imageDiv.addEventListener("mouseenter", () => actionsDiv.style.opacity = "1");
        imageDiv.addEventListener("mouseleave", () => actionsDiv.style.opacity = "0");

        // Assemble le card
        div.appendChild(imageDiv);
        div.appendChild(infoDiv);
        container.appendChild(div);
    });
}

// ACTIVER / DESACTIVER
async function toggleDish(id, status){
    await client.from("dishes").update({ available: !status }).eq("id", id);
    loadDishes();
}

// SUPPRIMER PLAT + IMAGE
async function deleteDish(id){

    const confirmDelete = confirm("Supprimer ce plat et son image ?");
    if(!confirmDelete) return;

    try {
        // 1️⃣ récupérer le plat pour avoir image_url
        const { data: dishData, error: fetchError } = await client
            .from("dishes")
            .select("image_url")
            .eq("id", id)
            .single();

        if(fetchError) throw fetchError;

        const imageUrl = dishData.image_url;

        // 2️⃣ supprimer l'image du bucket si elle existe
        if(imageUrl){
            const url = new URL(imageUrl);
            const path = url.pathname; // /storage/v1/object/public/dishes-images/filename.jpg
            const fileName = path.split("/").pop();

            const { error: removeError } = await client
                .storage
                .from("dishes-images")
                .remove([fileName]);

            if(removeError) console.warn("Erreur suppression image:", removeError.message);
        }

        // 3️⃣ supprimer le plat dans la table
        const { error: deleteError } = await client
            .from("dishes")
            .delete()
            .eq("id", id);

        if(deleteError) throw deleteError;

        loadDishes();

    } catch(err){
        alert("Erreur : " + err.message);
    }
}

// MODIFIER (vide pour le moment)
function editDish(id){
    console.log("Modifier plat :", id);
}

// TAP MOBILE POUR AFFICHER BOUTONS
document.addEventListener("click", function(e){
    const card = e.target.closest(".dish-card");
    document.querySelectorAll(".dish-actions").forEach(el => el.style.opacity = "0");
    if(card){
        const actions = card.querySelector(".dish-actions");
        if(actions) actions.style.opacity = "1";
    }
});

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

    let image_url = "";
    if(file){
        image_url = await uploadImage(file);
    }

    const { error } = await client.from("dishes").insert([{
        name,
        category,
        subcategory,
        price,
        description,
        ingredients,
        available,
        image_url
    }]);

    if(error){
        alert("Erreur : " + error.message);
        return;
    }

    document.getElementById("dish-form").reset();
    document.getElementById("image-preview").innerHTML = "";
    loadDishes();

});
