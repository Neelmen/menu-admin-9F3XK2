const SUPABASE_URL = "https://oaxpofkmtrudriyrbxvy.supabase.co";
const SUPABASE_KEY = "TA_CLE_PUBLISHABLE";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// INITIALISATION AU CHARGEMENT DE LA PAGE

document.addEventListener("DOMContentLoaded", () => {

document.getElementById("admin-panel").style.display = "none";
document.getElementById("login-section").style.display = "block";

checkSession();

});



// LOGIN ADMIN

async function loginAdmin(){

const email = document.getElementById("admin-email").value;
const password = document.getElementById("admin-password").value;

const { data, error } = await client.auth.signInWithPassword({
email: email,
password: password
});

if(error){

document.getElementById("login-message").innerText =
"Erreur : " + error.message;

}else{

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

async function loadDishes(){

const { data, error } = await client
.from("dishes")
.select("*")
.order("created_at", { ascending: false });

if(error){

console.error(error);
return;

}

const container = document.getElementById("dish-list");

container.innerHTML = "";

data.forEach(dish => {

const div = document.createElement("div");

div.style.border = "1px solid #ccc";
div.style.padding = "10px";
div.style.marginBottom = "10px";

div.innerHTML = `

<b>${dish.name}</b> - ${dish.category} - ${dish.price}€

<button onclick="toggleDish('${dish.id}', ${dish.available})">
${dish.available ? "Désactiver" : "Activer"}
</button>

${dish.image_url ? `<br><img src="${dish.image_url}" style="max-width:150px">` : ""}

<p>${dish.description || ""}</p>

<p><i>${dish.ingredients || ""}</i></p>

`;

container.appendChild(div);

});

}



// ACTIVER / DESACTIVER

async function toggleDish(id, status){

await client
.from("dishes")
.update({ available: !status })
.eq("id", id);

loadDishes();

}



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
const image_url = document.getElementById("image_url").value.trim();

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

if(error){

alert("Erreur : " + error.message);
return;

}

document.getElementById("dish-form").reset();
document.getElementById("image-preview").innerHTML = "";

loadDishes();

});
