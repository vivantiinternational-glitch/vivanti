// app.js · v4 · Lo que hace que Vivanti funcione
// v3: 6 pantallas, filtros completos, favoritos, postulación de demostración y animaciones
// v4: inicio de sesión con Supabase, solicitudes guardadas en Supabase y panel del administrador

// =====================================================================
// 0. CONEXIÓN CON SUPABASE (los datos están en config.js)
// =====================================================================
const cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_LLAVE_PUBLICA);

// =====================================================================
// 1. DATOS QUE LA APP RECUERDA
// =====================================================================
let todasLasEmpresas = [];   // las ofertas de datos.json
let ofertaActual = null;     // la oferta que se está viendo en el Detalle
let historial = [];          // pantallas visitadas, para el botón «← Volver»
let usuario = null;          // quién inició sesión
let esAdmin = false;         // ¿es el administrador?
let favoritos = [];          // ofertas guardadas con ♥ (en este navegador)
let solicitudes = [];        // postulaciones del usuario (vienen de Supabase)

// Las etapas de una solicitud, en orden
const ETAPAS = [
  { nombre: "Revisión y aprobación de Vivanti", explica: "Vivanti revisa que tu solicitud esté completa antes de enviarla." },
  { nombre: "Enviada a la empresa", explica: "La empresa recibió tu solicitud." },
  { nombre: "En revisión", explica: "La empresa está leyendo tu perfil y tus datos." },
  { nombre: "Entrevista", explica: "Espera a ser citado/a para tu entrevista con la empresa." },
  { nombre: "Respuesta de la empresa", explica: "Te dirá si fuiste seleccionado/a o no esta vez." }
];

// Los favoritos se guardan en el navegador, separados por usuario
function claveFavoritos() { return "vivanti-favoritos-" + (usuario ? usuario.id : "invitado"); }
function leerFavoritos() {
  try { return JSON.parse(localStorage.getItem(claveFavoritos())) || []; }
  catch (error) { return []; }
}
function guardarFavoritos() {
  try { localStorage.setItem(claveFavoritos(), JSON.stringify(favoritos)); }
  catch (error) { /* si el navegador no deja guardar, la app sigue funcionando */ }
}

// =====================================================================
// 2. CAMBIAR DE PANTALLA (con animación)
// =====================================================================
const PANTALLAS = ["login", "bienvenida", "inicio", "detalle", "favoritos", "formulario", "solicitudes", "admin"];
const SIN_MENU = ["login", "bienvenida", "admin"];
let pantallaActual = "login";

function irA(nombre, recordar = true) {
  if (nombre === "volver") {
    nombre = historial.pop() || "inicio";
    recordar = false;
  }
  if (recordar && pantallaActual !== nombre) historial.push(pantallaActual);

  PANTALLAS.forEach(function (p) {
    document.getElementById("pantalla-" + p).classList.add("oculta");
  });
  const pantalla = document.getElementById("pantalla-" + nombre);
  pantalla.classList.remove("oculta", "entrando");
  void pantalla.offsetWidth;            // truco para que la animación se repita
  pantalla.classList.add("entrando");
  pantallaActual = nombre;
  window.scrollTo(0, 0);

  document.getElementById("menu").classList.toggle("oculta", SIN_MENU.includes(nombre));
  document.querySelectorAll("#menu button").forEach(function (b) {
    b.classList.toggle("activo", b.dataset.menu === nombre);
  });

  if (nombre === "inicio") aplicarFiltros();
  if (nombre === "favoritos") mostrarFavoritos();
  if (nombre === "solicitudes") cargarSolicitudes();
  if (nombre === "admin") cargarPanelAdmin();
}

document.addEventListener("click", function (evento) {
  const boton = evento.target.closest("[data-ir]");
  if (boton) irA(boton.dataset.ir);
});

// =====================================================================
// 3. INICIO DE SESIÓN
// =====================================================================
const datosListos = fetch("datos.json")
  .then(function (respuesta) { return respuesta.json(); })
  .then(function (empresas) {
    todasLasEmpresas = empresas;
    llenarFiltro(filtroCiudad, "ciudad");
    llenarFiltro(filtroArea, "area");
  })
  .catch(function () {
    document.getElementById("lista-empresas").innerHTML =
      '<p class="mensaje">No se pudieron cargar las ofertas. ' +
      "Si abriste el archivo desde tu computador, pruébalo en el enlace de GitHub Pages.</p>";
  });

// Al abrir la app: ¿ya había una sesión abierta en este navegador?
async function iniciarApp() {
  await datosListos;
  const { data } = await cliente.auth.getSession();
  document.getElementById("cargando").classList.add("oculta");
  if (data.session) {
    await entrar(data.session.user);
  } else {
    irA("login", false);
  }
}

// Lo que pasa cuando alguien ya está dentro
async function entrar(usuarioSupabase) {
  usuario = usuarioSupabase;
  const { data: perfil } = await cliente
    .from("perfiles").select("rol").eq("id", usuario.id).maybeSingle();
  esAdmin = !!perfil && perfil.rol === "admin";
  document.getElementById("menu-admin").classList.toggle("oculta", !esAdmin);   // solo el admin ve «Panel»
  favoritos = leerFavoritos();
  await traerSolicitudes();
  historial = [];
  irA(esAdmin ? "admin" : "bienvenida", false);
}

document.getElementById("formulario-login").addEventListener("submit", async function (evento) {
  evento.preventDefault();
  const boton = document.getElementById("boton-entrar");
  const error = document.getElementById("login-error");
  boton.disabled = true;
  boton.textContent = "Entrando…";
  error.textContent = "";

  const { data, error: fallo } = await cliente.auth.signInWithPassword({
    email: document.getElementById("login-correo").value.trim(),
    password: document.getElementById("login-clave").value
  });

  boton.disabled = false;
  boton.textContent = "Entrar";
  if (fallo) {
    error.textContent = "Correo o contraseña incorrectos.";
    const caja = document.getElementById("formulario-login");
    caja.classList.remove("temblor"); void caja.offsetWidth; caja.classList.add("temblor");
    return;
  }
  this.reset();
  mostrarAviso("👋 ¡Hola!");
  await entrar(data.user);
});

// Cualquier botón con data-salir cierra la sesión
document.addEventListener("click", async function (evento) {
  if (!evento.target.closest("[data-salir]")) return;
  await cliente.auth.signOut();
  usuario = null; esAdmin = false; favoritos = []; solicitudes = []; historial = [];
  irA("login", false);
  mostrarAviso("Sesión cerrada");
});

// =====================================================================
// 4. FILTROS
// =====================================================================
const filtroCiudad = document.getElementById("filtro-ciudad");
const filtroArea = document.getElementById("filtro-area");
const botonRequisitos = document.getElementById("boton-requisitos");
const reqNivel = document.getElementById("req-nivel");
const reqExperiencia = document.getElementById("req-experiencia");
const reqIdioma = document.getElementById("req-idioma");
const reqViaja = document.getElementById("req-viaja");

function llenarFiltro(filtro, casilla) {
  const valores = [];
  todasLasEmpresas.forEach(function (empresa) {
    if (!valores.includes(empresa[casilla])) valores.push(empresa[casilla]);
  });
  valores.sort();
  filtro.length = 1;
  valores.forEach(function (valor) {
    filtro.innerHTML += `<option value="${valor}">${valor}</option>`;
  });
}

filtroCiudad.addEventListener("change", aplicarFiltros);
filtroArea.addEventListener("change", aplicarFiltros);

function cumpleExperiencia(minima, rango) {
  if (rango === "") return true;
  if (rango === "0") return minima === 0;
  if (rango === "1") return minima >= 1 && minima <= 2;
  return minima >= 3;
}

function cubreViaje(grupoDeLaOferta, viaja) {
  if (viaja === "" || viaja === "solo") return true;
  if (viaja === "pareja") return grupoDeLaOferta === "pareja" || grupoDeLaOferta === "familia";
  return grupoDeLaOferta === "familia";
}

function aplicarFiltros() {
  const resultado = todasLasEmpresas.filter(function (e) {
    return (filtroCiudad.value === "" || e.ciudad === filtroCiudad.value)
      && (filtroArea.value === "" || e.area === filtroArea.value)
      && (reqNivel.value === "" || e.nivelEstudio === reqNivel.value)
      && cumpleExperiencia(e.experienciaMinima, reqExperiencia.value)
      && (reqIdioma.value === "" || e.idiomaPrincipal === reqIdioma.value)
      && cubreViaje(e.grupoFamiliar, reqViaja.value);
  });

  filtroCiudad.classList.toggle("activo", filtroCiudad.value !== "");
  filtroArea.classList.toggle("activo", filtroArea.value !== "");
  const cuantosRequisitos = [reqNivel, reqExperiencia, reqIdioma, reqViaja]
    .filter(function (s) { return s.value !== ""; }).length;
  botonRequisitos.classList.toggle("activo", cuantosRequisitos > 0);
  botonRequisitos.textContent = cuantosRequisitos > 0 ? `Requisitos (${cuantosRequisitos})` : "Requisitos ▾";

  document.getElementById("contador").textContent =
    resultado.length === 1 ? "1 oferta encontrada" : `${resultado.length} ofertas encontradas`;
  mostrarTarjetas(resultado, document.getElementById("lista-empresas"),
    "No hay resultados. Prueba con menos filtros.");
}

botonRequisitos.addEventListener("click", function () { abrir("panel-requisitos"); });
document.getElementById("aplicar-requisitos").addEventListener("click", function () {
  cerrar("panel-requisitos");
  aplicarFiltros();
});
document.getElementById("limpiar-requisitos").addEventListener("click", function () {
  [reqNivel, reqExperiencia, reqIdioma, reqViaja].forEach(function (s) { s.value = ""; });
  aplicarFiltros();
});

// =====================================================================
// 5. TARJETAS
// =====================================================================
function mostrarTarjetas(lista, contenedor, mensajeVacio) {
  if (lista.length === 0) {
    contenedor.innerHTML = `<p class="mensaje aparece">${mensajeVacio}</p>`;
    return;
  }
  contenedor.innerHTML = lista.map(crearTarjeta).join("");
}

function crearTarjeta(empresa, numero) {
  const guardada = favoritos.includes(empresa.id);
  return `
    <article class="tarjeta aparece" style="--i:${numero}">
      <div class="fila">
        <h2>${empresa.nombre}</h2>
        <button class="corazon" data-favorito="${empresa.id}" title="Guardar en favoritos">${guardada ? "♥" : "♡"}</button>
      </div>
      <p class="descripcion">${empresa.descripcion}</p>
      <div class="specs">
        <span class="cargo">Cargo: ${empresa.cargo}</span><br>
        <span class="etiqueta-dato">Idioma:</span> ${empresa.idioma}<br>
        <span class="etiqueta-dato">Requisitos:</span> ${empresa.requisitos}, ${empresa.visa.toLowerCase()}<br>
        <span class="etiqueta-dato">Nivel de estudio:</span> ${empresa.nivelEstudio}
      </div>
      <div class="fila">
        ${empresa.esEjemplo ? '<span class="ejemplo">Ejemplo</span>' : "<span></span>"}
        <button class="ver" data-detalle="${empresa.id}">Ver detalle →</button>
      </div>
    </article>`;
}

document.addEventListener("click", function (evento) {
  const ver = evento.target.closest("[data-detalle]");
  if (ver) abrirDetalle(Number(ver.dataset.detalle));

  const corazon = evento.target.closest("[data-favorito]");
  if (corazon) cambiarFavorito(Number(corazon.dataset.favorito));
});

// =====================================================================
// 6. FAVORITOS
// =====================================================================
function cambiarFavorito(id) {
  if (favoritos.includes(id)) {
    favoritos = favoritos.filter(function (f) { return f !== id; });
    mostrarAviso("Quitada de favoritos");
  } else {
    favoritos.push(id);
    mostrarAviso("♥ Guardada en favoritos");
  }
  guardarFavoritos();

  document.querySelectorAll(`[data-favorito="${id}"]`).forEach(function (c) {
    if (c.classList.contains("corazon")) c.textContent = favoritos.includes(id) ? "♥" : "♡";
    c.classList.remove("salto"); void c.offsetWidth; c.classList.add("salto");
  });
  if (pantallaActual === "detalle") pintarBotonFavorito();
  if (pantallaActual === "favoritos") mostrarFavoritos();
}

function mostrarFavoritos() {
  const lista = todasLasEmpresas.filter(function (e) { return favoritos.includes(e.id); });
  mostrarTarjetas(lista, document.getElementById("lista-favoritos"),
    "Aún no has guardado oportunidades.");
}

// =====================================================================
// 7. DETALLE DE UNA OFERTA
// =====================================================================
function buscarOferta(id) {
  return todasLasEmpresas.find(function (e) { return e.id === id; });
}

function abrirDetalle(id) {
  ofertaActual = buscarOferta(id);
  const o = ofertaActual;
  document.getElementById("contenido-detalle").innerHTML = `
    <h2 class="detalle-nombre">${o.nombre}</h2>
    <span class="etiqueta">${o.ciudad}</span>
    <p class="descripcion">${o.descripcion}</p>
    <p class="cargo-grande">Cargo: ${o.cargo}</p>
    <div class="caja aparece" style="--i:1"><b>Tipo de contrato</b><br>${o.tipoContrato}</div>
    <div class="caja aparece" style="--i:2"><b>Beneficios</b>
      <ul>${o.beneficios.map(function (b) { return `<li>${b}</li>`; }).join("")}</ul></div>
    <div class="caja aparece" style="--i:3"><b>Condiciones y requisitos</b>
      <ul>
        <li>Idioma: ${o.idioma}</li>
        <li>Requisitos: ${o.requisitos}</li>
        <li>Nivel de estudio: ${o.nivelEstudio}</li>
        <li>Visa o pasaporte: ${o.visa}</li>
        <li>Grupo familiar: ${o.grupoFamiliarTexto}</li>
      </ul></div>
    <button id="boton-favorito-detalle" class="boton" data-favorito="${o.id}"></button>
    <button id="boton-postular" class="boton secundario"></button>`;
  pintarBotonFavorito();
  pintarBotonPostular();
  irA("detalle");
}

function pintarBotonFavorito() {
  const b = document.getElementById("boton-favorito-detalle");
  const guardada = favoritos.includes(ofertaActual.id);
  b.textContent = guardada ? "♥ Guardada en favoritos" : "♡ Guardar en favoritos";
  b.classList.toggle("hecho", guardada);
}

function pintarBotonPostular() {
  const b = document.getElementById("boton-postular");
  const yaPostulado = solicitudes.some(function (s) { return s.id_oferta === ofertaActual.id; });
  b.textContent = yaPostulado ? "✓ Ya te postulaste · ver solicitud" : "Postularme →";
  b.onclick = function () {
    if (yaPostulado) { irA("solicitudes"); return; }
    document.getElementById("formulario-oferta").textContent = `${ofertaActual.nombre} · ${ofertaActual.cargo}`;
    irA("formulario");
  };
}

// =====================================================================
// 8. FORMULARIO (demostración: NO se guarda lo que escriben)
// =====================================================================
document.getElementById("formulario").addEventListener("submit", async function (evento) {
  evento.preventDefault();
  this.reset();                     // borra lo escrito: no guardamos datos personales
  // A Supabase solo enviamos el número de la oferta. Supabase pone el usuario y la etapa 0.
  const { error } = await cliente.from("solicitudes").insert({ id_oferta: ofertaActual.id });
  if (error) {
    mostrarAviso("No se pudo enviar. Revisa tu conexión.");
    return;
  }
  historial = ["inicio"];
  irA("solicitudes", false);
  mostrarAviso("📨 Solicitud enviada");
});

// =====================================================================
// 9. MIS SOLICITUDES
// =====================================================================
async function traerSolicitudes() {
  if (!usuario) return;
  const { data, error } = await cliente
    .from("solicitudes").select("*").eq("usuario", usuario.id).order("creada", { ascending: true });
  solicitudes = error ? [] : data;
}

async function cargarSolicitudes() {
  document.getElementById("saludo").textContent = usuario ? `Sesión: ${usuario.email}` : "";
  await traerSolicitudes();
  mostrarSolicitudes();
}

document.getElementById("boton-actualizar").addEventListener("click", async function () {
  await cargarSolicitudes();
  mostrarAviso("↻ Actualizado");
});

function fechaCorta(texto) {
  return new Date(texto).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function lineaDeEtapas(s) {
  return ETAPAS.map(function (etapa, i) {
    let clase = i < s.etapa ? "hecha" : (i === s.etapa ? "actual" : "");
    let explica = etapa.explica;
    if (i === 4 && s.etapa === 4 && s.resultado) {
      clase = "hecha";
      explica = s.resultado === "seleccionado"
        ? '<span class="resultado-ok">🎉 ¡Fuiste seleccionado/a!</span>'
        : '<span class="resultado-no">No fuiste seleccionado/a esta vez. ¡Sigue buscando!</span>';
    }
    const fecha = i === 0 ? ` <span class="fecha">· ${fechaCorta(s.creada)}</span>` : "";
    return `<li class="${clase}">${etapa.nombre}${fecha}<span class="explica">${explica}</span></li>`;
  }).join("");
}

function mostrarSolicitudes() {
  const contenedor = document.getElementById("lista-solicitudes");
  if (solicitudes.length === 0) {
    contenedor.innerHTML = '<p class="mensaje aparece">Aún no has enviado solicitudes.</p>';
    return;
  }
  contenedor.innerHTML = solicitudes.map(function (s, numero) {
    const o = buscarOferta(s.id_oferta);
    if (!o) return "";
    return `
      <article class="tarjeta aparece" style="--i:${numero}">
        <div class="fila"><h2>${o.nombre}</h2><span class="ejemplo">Ejemplo</span></div>
        <p class="descripcion">${o.cargo} · ${o.ciudad}</p>
        <ul class="etapas">${lineaDeEtapas(s)}</ul>
      </article>`;
  }).join("");
}

// =====================================================================
// 10. PANEL DEL ADMINISTRADOR
// =====================================================================
let perfiles = [];

async function cargarPanelAdmin() {
  const respuestaPerfiles = await cliente.from("perfiles").select("id,email,rol").order("email", { ascending: true });
  perfiles = respuestaPerfiles.data || [];

  // Listas para crear escenarios
  document.getElementById("admin-jurado").innerHTML = perfiles
    .filter(function (p) { return p.rol === "jurado"; })
    .map(function (p) { return `<option value="${p.id}">${p.email}</option>`; }).join("");
  document.getElementById("admin-oferta").innerHTML = todasLasEmpresas
    .map(function (o) { return `<option value="${o.id}">${o.nombre} · ${o.cargo}</option>`; }).join("");
  document.getElementById("admin-etapa").innerHTML = ETAPAS
    .map(function (e, i) { return `<option value="${i}">${i + 1}. ${e.nombre}</option>`; }).join("");

  await mostrarListaAdmin();
}

async function mostrarListaAdmin() {
  const { data } = await cliente.from("solicitudes").select("*").order("creada", { ascending: false });
  const lista = data || [];
  const contenedor = document.getElementById("admin-lista");
  if (lista.length === 0) {
    contenedor.innerHTML = '<p class="mensaje aparece">Todavía no hay solicitudes.</p>';
    return;
  }
  contenedor.innerHTML = lista.map(function (s, numero) {
    const o = buscarOferta(s.id_oferta) || { nombre: "Oferta " + s.id_oferta, cargo: "" };
    const p = perfiles.find(function (x) { return x.id === s.usuario; });
    const resultado = s.etapa === 4 ? `
      <div class="admin-botones">
        <button class="mini ${s.resultado === "seleccionado" ? "verde" : ""}" data-resultado="seleccionado" data-id="${s.id}">🎉 Seleccionado/a</button>
        <button class="mini ${s.resultado === "no_seleccionado" ? "verde" : ""}" data-resultado="no_seleccionado" data-id="${s.id}">No seleccionado/a</button>
      </div>` : "";
    return `
      <div class="admin-item aparece" style="--i:${numero}">
        <div class="quien">${p ? p.email : "usuario"} · ${fechaCorta(s.creada)}</div>
        <b>${o.nombre}</b> · ${o.cargo}
        <div class="etapa-actual">Etapa ${s.etapa + 1} de 5: ${ETAPAS[s.etapa].nombre}</div>
        <div class="admin-botones">
          <button class="mini" data-mover="-1" data-id="${s.id}" data-etapa="${s.etapa}" ${s.etapa === 0 ? "disabled" : ""}>◀ Atrás</button>
          <button class="mini verde" data-mover="1" data-id="${s.id}" data-etapa="${s.etapa}" ${s.etapa === 4 ? "disabled" : ""}>Avanzar ▶</button>
          <button class="mini rojo" data-borrar="${s.id}">Borrar</button>
        </div>
        ${resultado}
      </div>`;
  }).join("");
}

// Botones del panel (avanzar, retroceder, resultado, borrar)
document.getElementById("admin-lista").addEventListener("click", async function (evento) {
  const mover = evento.target.closest("[data-mover]");
  const resultado = evento.target.closest("[data-resultado]");
  const borrar = evento.target.closest("[data-borrar]");
  let respuesta = null;

  if (mover) {
    const nueva = Number(mover.dataset.etapa) + Number(mover.dataset.mover);
    respuesta = await cliente.from("solicitudes")
      .update({ etapa: nueva, resultado: null }).eq("id", Number(mover.dataset.id));
    if (!respuesta.error) mostrarAviso(`Ahora en: ${ETAPAS[nueva].nombre}`);
  }
  if (resultado) {
    respuesta = await cliente.from("solicitudes")
      .update({ resultado: resultado.dataset.resultado }).eq("id", Number(resultado.dataset.id));
    if (!respuesta.error) mostrarAviso("Respuesta guardada");
  }
  if (borrar) {
    respuesta = await cliente.from("solicitudes").delete().eq("id", Number(borrar.dataset.borrar));
    if (!respuesta.error) mostrarAviso("Solicitud borrada");
  }
  if (respuesta && respuesta.error) mostrarAviso("No se pudo guardar el cambio.");
  if (respuesta) await mostrarListaAdmin();
});

document.getElementById("admin-crear").addEventListener("click", async function () {
  const { error } = await cliente.from("solicitudes").insert({
    usuario: document.getElementById("admin-jurado").value,
    id_oferta: Number(document.getElementById("admin-oferta").value),
    etapa: Number(document.getElementById("admin-etapa").value)
  });
  if (error) {
    mostrarAviso(error.code === "23505" ? "Ese jurado ya tiene una solicitud en esa oferta." : "No se pudo crear.");
    return;
  }
  mostrarAviso("➕ Escenario creado");
  await mostrarListaAdmin();
});

document.getElementById("admin-actualizar").addEventListener("click", async function () {
  await mostrarListaAdmin();
  mostrarAviso("↻ Actualizado");
});

document.getElementById("admin-ver-app").addEventListener("click", function () { irA("bienvenida"); });

// =====================================================================
// 11. PANELES, AYUDA Y MENSAJITOS
// =====================================================================
function abrir(id) { document.getElementById(id).classList.remove("oculta"); }
function cerrar(id) { document.getElementById(id).classList.add("oculta"); }

document.getElementById("boton-ayuda").addEventListener("click", function () { abrir("panel-ayuda"); });

document.querySelectorAll(".fondo-panel").forEach(function (fondo) {
  fondo.addEventListener("click", function (evento) {
    if (evento.target === fondo || evento.target.closest("[data-cerrar]")) {
      fondo.classList.add("oculta");
    }
  });
});

let temporizador;
function mostrarAviso(texto) {
  const aviso = document.getElementById("aviso-flotante");
  aviso.textContent = texto;
  aviso.classList.add("visible");
  clearTimeout(temporizador);
  temporizador = setTimeout(function () { aviso.classList.remove("visible"); }, 2200);
}

// =====================================================================
// ¡ARRANCA!
// =====================================================================
iniciarApp();
