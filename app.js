// Configuration Supabase
const SUPABASE_URL = "https://oaxpofkmtrudriyrbxvy.supabase.co";
const BUCKET_NAME = "dishes-images";
const client = supabase.createClient(SUPABASE_URL, "sb_publishable_W0bTuLBKIo_-tSVK_XfKYg_LScZ_5EY");

const cache = {};
let currentCategory = null;

/**
 * CONNEXION ADMIN VIA FORMULAIRE
 */
async function loginAdmin() {
    const email = document.getElementById("admin-email").value;
    const password = document.getElementById("admin-password").value;
    const message = document.getElementById("login-message");

    if (!email || !password) {
        message.textContent = "Veuillez remplir tous les champs.";
        return;
    }

    message.textContent = "Connexion en cours...";

    try {
        // Tentative de connexion sur ta table access_control
        // Si tu veux utiliser l'auth réelle de Supabase, remplace par client.auth.signInWithPassword
        const { data, error } = await client
            .from('access_control')
            .select('*')
            .eq('username', email) // Ici 'username' correspond à ton input email
            .eq('password', password)
            .single();

        if (error || !data) {
            message.style.color = "#e63946";
            message.textContent = "Identifiants incorrects.";
        } else {
            message.textContent = "";
            document.getElementById("login-section").style.display = "none";
            document.getElementById("admin-panel").style.display = "block";
            loadDishes(); // On charge la liste des plats une fois connecté
        }
    } catch (err) {
        console.error(err);
        message.textContent = "Erreur lors de la connexion.";
    }
}

/**
 * DECONNEXION
 */
function logoutAdmin() {
    document.getElementById("admin-panel").style.display = "none";
    document.getElementById("login-section").style.display = "block";
}

/**
 * CHARGEMENT DES PLATS (Pour l'admin)
 */
async function loadDishes() {
    const listContainer = document.getElementById("dish-list");
    listContainer.innerHTML = "Chargement des plats...";

    const { data, error } = await client.from("dishes").select("*").order('name');

    if (error) {
        listContainer.innerHTML = "Erreur de chargement.";
        return;
    }

    listContainer.innerHTML = "";
    data.forEach(dish => {
        const card = document.createElement("div");
        card.className = "dish-card";
        card.innerHTML = `
            <div class="dish-image">
                <img src="${getImageUrlFromPath(dish.image_path)}" alt="${dish.name}">
            </div>
            <div class="dish-info">
                <strong>${dish.name}</strong> - ${dish.price} €
            </div>
        `;
        listContainer.appendChild(card);
    });
}

/**
 * UTILITAIRES
 */
function getImageUrlFromPath(imagePath) {
    if (!imagePath) return "";
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${imagePath}`;
}

function generateBackgroundTicker() {
    // Gardé pour ton design si besoin
    console.log("Ticker prêt");
}

// On initialise seulement le ticker, pas le login automatique
document.addEventListener("DOMContentLoaded", () => {
    generateBackgroundTicker();
});
