/* css libraries */
import "bootstrap/dist/css/bootstrap.css";
import "sweetalert2/dist/sweetalert2.css";

/* js libraries */
import swal from "sweetalert2";
import ClipboardJS from "clipboard";
import { Edura } from "./js/dev";
import utils from "./js/utils";
import app from "./js/app";
import "@fortawesome/fontawesome-free/js/all";

// Inject ClipboardJS
window.ClipboardJS = ClipboardJS;

// Inject Homemade Utils
for (let kv of Object.entries(utils)) {
    window[kv[0]] = kv[1];
}

// Inject SweetAlart2
window.swal = swal;
window.toast = swal.mixin({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener("mouseenter", swal.stopTimer);
        toast.addEventListener("mouseleave", swal.resumeTimer);
    },
});

/* Inject Vue App */
window.app = app;

// Use Edura?
new Edura().hello();
