const SUPABASE_URL = "https://oaxpofkmtrudriyrbxvy.supabase.co";
const SUPABASE_KEY = "TA_CLE_ADMIN";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function loadDishes() {
    const { data } = await client
        .from("dishes")
        .select("*")
        .order("created_at", { ascending: false });

    const container = document.getElementById("dish-list");
    container.innerHTML = "";

    data.forEach(dish => {
        const div = document.createElement("div");

        div.innerHTML = `
            <b>${dish.name}</b> - ${dish.category} - ${dish.price}€
            <button onclick="toggleDish('${dish.id}', ${dish.available})">
                ${dish.available ? "Désactiver" : "Activer"}
            </button>
            ${dish.image_url ? `<br><img src="${dish.image_url}" alt="${dish.name}" style="max-width:150px;">` : ""}
        `;

        container.appendChild(div);
    });
}

async function toggleDish(id, status){
    await client
        .from("dishes")
        .update({ available: !status })
        .eq("id", id);

    loadDishes();
}

document.getElementById("dish-form").addEventListener("submit", async e => {
    e.preventDefault();

    const name = document.getElementById("name").value;
    const category = document.getElementById("category").value;
    const subcategory = document.getElementById("subcategory").value;
    const price = document.getElementById("price").value;
    const description = document.getElementById("description").value;
    const ingredients = document.getElementById("ingredients").value;
    const available = document.getElementById("available").checked;
    const image_url = document.getElementById("image_url").value; // nouveau champ pour le lien

    await client.from("dishes").insert({
        name,
        category,
        subcategory,
        price,
        description,
        ingredients,
        available,
        image_url
    });

    loadDishes();
});

loadDishes();
