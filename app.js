// app.js · v1 · Lo que hace que Vivanti funcione

// 1. Buscamos en la página las partes que vamos a usar
const pantallaBienvenida = document.getElementById("pantalla-bienvenida");
const pantallaInicio = document.getElementById("pantalla-inicio");
const botonBuscar = document.getElementById("boton-buscar");
const listaEmpresas = document.getElementById("lista-empresas");

// 2. Cuando tocan «Buscar oportunidades»: se esconde la Bienvenida y aparece el Inicio
botonBuscar.addEventListener("click", function () {
  pantallaBienvenida.classList.add("oculta");
  pantallaInicio.classList.remove("oculta");
  cargarEmpresas();
});

// 3. Leemos el archivo datos.json y dibujamos una tarjeta por cada empresa
function cargarEmpresas() {
  fetch("datos.json")
    .then(function (respuesta) { return respuesta.json(); })
    .then(function (empresas) {
      listaEmpresas.innerHTML = "";
      empresas.forEach(function (empresa) {
        listaEmpresas.innerHTML += crearTarjeta(empresa);
      });
    })
    .catch(function () {
      listaEmpresas.innerHTML =
        '<p class="mensaje">No se pudieron cargar las ofertas. ' +
        "Si abriste el archivo desde tu computador, pruébalo en el enlace de GitHub Pages.</p>";
    });
}

// 4. Arma el HTML de UNA tarjeta, usando las casillas de la empresa
function crearTarjeta(empresa) {
  return `
    <article class="tarjeta">
      <div class="fila"><h2>${empresa.nombre}</h2><span class="corazon">♡</span></div>
      <p class="descripcion">${empresa.descripcion}</p>
      <div class="specs">
        <span class="cargo">Cargo: ${empresa.cargo}</span><br>
        <span class="etiqueta-dato">Idioma:</span> ${empresa.idioma}<br>
        <span class="etiqueta-dato">Requisitos:</span> ${empresa.requisitos}, ${empresa.visa.toLowerCase()}<br>
        <span class="etiqueta-dato">Nivel de estudio:</span> ${empresa.nivelEstudio}
      </div>
      <div class="fila">
        ${empresa.esEjemplo ? '<span class="ejemplo">Ejemplo</span>' : "<span></span>"}
        <span class="ver">Ver detalle →</span>
      </div>
    </article>`;
}
