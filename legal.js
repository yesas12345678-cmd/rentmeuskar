// Datos del titular de la web: se cambian aquí una sola vez y salen en todas las páginas legales.
// (Deben coincidir con los de la factura.)
(function () {
    var LEGAL = {
        nombre: 'Servicios Logísticos Huéscar',
        nif: '45896213K',
        direccion: 'Polígono Industrial La Sagra, Calle A, 18830 Huéscar (Granada), España',
        email: 'info@rentmeuskar.com',
        web: 'rentmeuskar.com',
        telefono: '614 767 411'
    };

    function fill() {
        Object.keys(LEGAL).forEach(function (key) {
            document.querySelectorAll('[data-legal="' + key + '"]').forEach(function (el) {
                if (key === 'email') {
                    el.textContent = LEGAL.email;
                    if (el.tagName === 'A') el.href = 'mailto:' + LEGAL.email;
                } else {
                    el.textContent = LEGAL[key];
                }
            });
        });
    }
    fill();

    // El teléfono y el correo de contacto de Ajustes tienen prioridad si cargan
    fetch('/api/settings').then(function (r) { return r.ok ? r.json() : {}; }).then(function (cfg) {
        var digits = cfg && cfg.contact_phone ? String(cfg.contact_phone).replace(/\D/g, '') : '';
        var national = digits.length === 11 && digits.indexOf('34') === 0 ? digits.slice(2) : digits;
        if (national.length === 9) LEGAL.telefono = national.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
        if (cfg && cfg.contact_email) LEGAL.email = cfg.contact_email;
        fill();
    }).catch(function () { /* se quedan los valores de arriba */ });
})();
