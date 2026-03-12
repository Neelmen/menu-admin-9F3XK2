const SUPABASE_URL = "https://oaxpofkmtrudriyrbxvy.supabase.co";

const SUPABASE_KEY = "TA_CLE_ANON_PUBLIC";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);



/* ===============================
   Initialisation
================================= */

document.addEventListener("DOMContentLoaded", () => {

document.getElementById("admin-panel").style.display = "none";
document.getElementById("login-section").style.display = "block";

checkSession();

});



/* ===============================
   Login
================================= */

async function loginAdmin(){

const email = document.getElementById("admin-email").value;
const password = document.getElementById("admin-password").value;

const { error } = await client.auth.signInWithPassword({
email,
password
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



/* ===============================
   Logout
================================= */

async function logoutAdmin(){

await client.auth.signOut();

location.reload();

}



/* ===============================
   Vérification session
================================= */

async function checkSession(){

const { data } = await client.auth.getSession();

if(data.session){

document.getElementById("login-section").style.display = "none";
document.getElementById("admin-panel").style.display = "block";

loadDishes();

}

}



/* ===============================
   Charger les plats
================================= */

async function loadDishes(){

const { data, error } = await client
.from("dishes")
.select("*")
.order("created_at",{ascending:false});

if(error){
console.error(error);
return;
}

const container = document.getElementById("dish-list");
container.innerHTML = "";

data.forEach(dish => {

const div = document.createElement("div");
div.className = "dish-card";

div.innerHTML = `

${dish.image_url ? `<img src="${dish.image_url}">` : ""}

<div class="card-actions">

<button class="btn-toggle"
onclick="toggleDish('${dish.id}', ${dish.available})">

${dish.available ? "Désactiver" : "Activer"}

</button>

<button class="btn-edit">
Modifier
</button>

<button class="btn-delete"
onclick="deleteDish('${dish.id}')">

Supprimer

</button>

</div>

<div style="padding:10px">

<b>${dish.name}</b><br>
${dish.category} - ${dish.price}€

<p>${dish.description || ""}</p>

</div>

`;

container.appendChild(div);

});

}



/* ===============================
   Activer / désactiver
================================= */

async function toggleDish(id,status){

await client
.from("dishes")
.update({available:!status})
.eq("id",id);

loadDishes();

}



/* ===============================
   Supprimer plat
================================= */

async function deleteDish(id){

if(!confirm("Supprimer ce plat ?")) return;

const { error } = await client
.from("dishes")
.delete()
.eq("id",id);

if(error){
alert("Erreur : " + error.message);
return;
}

loadDishes();

}



/* ===============================
   Ajouter plat
================================= */

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
