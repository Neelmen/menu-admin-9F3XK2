// Remplace par tes propres infos Supabase
const SUPABASE_URL = "https://oaxpofkmtrudriyrbxvy.supabase.co";
const SUPABASE_KEY = "sb_publishable_W0bTuLBKIo_-tSVK_XfKYg_LScZ_5EY";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Charger et afficher les plats
async function loadDishes() {
    const { data, error } = await client
        .from("dishes")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erreur lors du chargement des plats :", error);
        return;
    }

    const container = document.getElementById("dish-list");
    container.innerHTML = "";

    data.forEach(dish => {
        const div = document.createElement("div");
        div.style.border = "1px solid #ccc";
        div.style.padding = "10px";
        div.style.marginBottom = "5px";

        div.innerHTML = `
            <b>${dish.name}</b> - ${dish.category} - ${dish.price}€
            <button onclick="toggleDish('${dish.id}', ${dish.available})">
                ${dish.available ? "Désactiver" : "Activer"}
            </button>
            ${dish.image_url ? `<br><img src="${dish.image_url}" alt="${dish.name}" style="max-width:150px;">` : ""}
            <p>${dish.description || ""}</p>
            <p><i>${dish.ingredients || ""}</i></p>
        `;

        container.appendChild(div);
    });
}

// Activer/Désactiver un plat
async function toggleDish(id, status) {
    const { error } = await client
        .from("dishes")
        .update({ available: !status })
        .eq("id", id);

    if (error) console.error("Erreur lors de la mise à jour :", error);
    loadDishes();
}

// Soumission du formulaire
document.getElementById("dish-form").addEventListener("submit", async e => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const category = document.getElementById("category").value;
    const subcategory = document.getElementById("subcategory").value.trim();
    const price = parseFloat(document.getElementById("price").value);
    const description = document.getElementById("description").value.trim();
    const ingredients = document.getElementById("ingredients").value.trim();
    const available = document.getElementById("available").checked;
    const image_url = document.getElementById("image_url").value.trim();

    // Vérification simple
    if (!name || !category || isNaN(price)) {
        alert("Veuillez remplir au moins le nom, la catégorie et le prix.");
        return;
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
            image_url
        }
    ]);

    if (error) {
        console.error("Erreur lors de l'ajout :", error);
        alert("Impossible d'ajouter le plat.");
        return;
    }

    // Réinitialiser le formulaire
    document.getElementById("dish-form").reset();
    document.getElementById("image-preview").innerHTML = "";

    loadDishes();
});

// Charger les plats au démarrage
loadDishes();
