/**
 * RentMeUskar - Lógica de Aplicación
 * Sitio web de alquiler de furgonetas sin conductor en Huéscar
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // CONFIGURACIÓN CENTRALIZADA
    const CONFIG = {
        whatsappNumber: '34600000000', // Código de país + número (34 para España)
        prices: {
            medium: { name: 'Ford Transit Custom L2H2 (8m³)', price: 59 },
            large: { name: 'MAN TGE L4H3 Gran Volumen (14m³)', price: 79 }
        }
    };

    // ELEMENTOS DEL DOM
    const header = document.getElementById('header');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const navbar = document.getElementById('navbar');
    const navLinks = document.querySelectorAll('.nav-link');
    const selectVanBtns = document.querySelectorAll('.select-van-btn');
    
    // Elementos de la Calculadora
    const calcForm = document.getElementById('booking-calculator-form');
    const vanSelect = document.getElementById('calc-van-select');
    const dateStart = document.getElementById('calc-date-start');
    const timeStart = document.getElementById('calc-time-start');
    const dateEnd = document.getElementById('calc-date-end');
    const timeEnd = document.getElementById('calc-time-end');
    const extraGps = document.getElementById('calc-extra-gps');
    const extraDriver = document.getElementById('calc-extra-driver');
    const extraMoving = document.getElementById('calc-extra-moving');
    const clientName = document.getElementById('calc-name');
    
    // Resumen de la Calculadora
    const summaryDays = document.getElementById('summary-days');
    const summaryBasePrice = document.getElementById('summary-base-price');
    const summaryExtrasPrice = document.getElementById('summary-extras-price');
    const summaryTotalPrice = document.getElementById('summary-total-price');

    // Elementos de FAQ
    const faqQuestions = document.querySelectorAll('.faq-question');

    /* ==========================================================================
       1. NAVEGACIÓN Y EFECTOS HEADER
       ========================================================================== */
    
    // Cambiar estilo de la cabecera al hacer scroll
    const checkScroll = () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };
    
    window.addEventListener('scroll', checkScroll);
    checkScroll(); // Ejecutar al cargar

    // Menú móvil (Hamburger)
    mobileMenuToggle.addEventListener('click', () => {
        mobileMenuToggle.classList.toggle('active');
        navbar.classList.toggle('active');
    });

    // Cerrar menú móvil al hacer clic en un enlace
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenuToggle.classList.remove('active');
            navbar.classList.remove('active');
            
            // Actualizar clase activa del enlace
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // Cerrar menú móvil al hacer clic fuera del mismo
    document.addEventListener('click', (e) => {
        if (navbar.classList.contains('active') && 
            !navbar.contains(e.target) && 
            !mobileMenuToggle.contains(e.target)) {
            mobileMenuToggle.classList.remove('active');
            navbar.classList.remove('active');
        }
    });

    // Resaltar sección activa en el menú de navegación según el scroll
    const sections = document.querySelectorAll('section[id]');
    
    const highlightNavOnScroll = () => {
        const scrollY = window.scrollY;
        
        sections.forEach(current => {
            const sectionHeight = current.offsetHeight;
            const sectionTop = current.offsetTop - 140; // Compensar altura del header
            const sectionId = current.getAttribute('id');
            
            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                document.querySelector(`.nav-link[href*=${sectionId}]`)?.classList.add('active');
            } else {
                document.querySelector(`.nav-link[href*=${sectionId}]`)?.classList.remove('active');
            }
        });
    };
    
    window.addEventListener('scroll', highlightNavOnScroll);

    /* ==========================================================================
       2. REVELADO AL HACER SCROLL (INTERSECTION OBSERVER)
       ========================================================================== */
    const revealElements = document.querySelectorAll('.reveal');
    
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Solo animar una vez
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(element => {
        revealObserver.observe(element);
    });

    /* ==========================================================================
       3. PREPARAR FECHAS POR DEFECTO EN LA CALCULADORA
       ========================================================================== */
    const initCalculatorDates = () => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        const dayAfterTomorrow = new Date(today);
        dayAfterTomorrow.setDate(today.getDate() + 2);
        
        // Formatear a YYYY-MM-DD
        const formatDate = (date) => {
            const d = new Date(date);
            let month = '' + (d.getMonth() + 1);
            let day = '' + d.getDate();
            const year = d.getFullYear();

            if (month.length < 2) month = '0' + month;
            if (day.length < 2) day = '0' + day;

            return [year, month, day].join('-');
        };

        // Establecer fecha mínima como hoy
        const todayStr = formatDate(today);
        dateStart.min = todayStr;
        dateEnd.min = todayStr;
        
        // Establecer valores por defecto (mañana a pasado mañana)
        dateStart.value = formatDate(tomorrow);
        dateEnd.value = formatDate(dayAfterTomorrow);
    };

    initCalculatorDates();

    // Actualizar fecha mínima de devolución según fecha de recogida
    dateStart.addEventListener('change', () => {
        dateEnd.min = dateStart.value;
        
        // Si la fecha de fin es anterior a la nueva fecha de inicio, la actualizamos
        if (new Date(dateEnd.value) < new Date(dateStart.value)) {
            const nextDay = new Date(dateStart.value);
            nextDay.setDate(nextDay.getDate() + 1);
            
            const formatDate = (date) => {
                const year = date.getFullYear();
                let month = '' + (date.getMonth() + 1);
                let day = '' + date.getDate();
                if (month.length < 2) month = '0' + month;
                if (day.length < 2) day = '0' + day;
                return [year, month, day].join('-');
            };
            
            dateEnd.value = formatDate(nextDay);
        }
        calculatePrice();
    });

    /* ==========================================================================
       4. LÓGICA DE LA CALCULADORA DE PRESUPUESTO
       ========================================================================== */
    
    const calculatePrice = () => {
        const vanType = vanSelect.value;
        
        // Si no hay furgoneta seleccionada, poner valores a cero
        if (!vanType) {
            summaryDays.textContent = '0 días';
            summaryBasePrice.textContent = '0,00 €';
            summaryExtrasPrice.textContent = '0,00 €';
            summaryTotalPrice.textContent = '0,00 €';
            return;
        }

        const baseRate = CONFIG.prices[vanType].price;
        
        // Calcular número de días
        const start = new Date(dateStart.value);
        const end = new Date(dateEnd.value);
        
        // Calcular diferencia en milisegundos y pasar a días
        const diffTime = end - start;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Alquiler mínimo es 1 día
        const days = diffDays > 0 ? diffDays : 1;
        
        // Calcular precio base total
        const totalBase = baseRate * days;
        
        // Calcular extras
        let totalExtras = 0;
        
        if (extraGps.checked) {
            totalExtras += parseFloat(extraGps.value) * days; // 5€ por día
        }
        if (extraDriver.checked) {
            totalExtras += parseFloat(extraDriver.value) * days; // 8€ por día
        }
        if (extraMoving.checked) {
            totalExtras += parseFloat(extraMoving.value); // 10€ pago único
        }
        
        const totalEstimated = totalBase + totalExtras;
        
        // Renderizar valores en pantalla
        summaryDays.textContent = `${days} ${days === 1 ? 'día' : 'días'}`;
        summaryBasePrice.textContent = `${totalBase.toFixed(2)} €`;
        summaryExtrasPrice.textContent = `${totalExtras.toFixed(2)} €`;
        summaryTotalPrice.textContent = `${totalEstimated.toFixed(2)} €`;
    };

    // Añadir event listeners para recálculo instantáneo
    vanSelect.addEventListener('change', calculatePrice);
    dateStart.addEventListener('change', calculatePrice);
    dateEnd.addEventListener('change', calculatePrice);
    timeStart.addEventListener('change', calculatePrice);
    timeEnd.addEventListener('change', calculatePrice);
    extraGps.addEventListener('change', calculatePrice);
    extraDriver.addEventListener('change', calculatePrice);
    extraMoving.addEventListener('change', calculatePrice);

    /* ==========================================================================
       5. BOTONES SELECCIONAR FLOTA -> FORMULARIO
       ========================================================================== */
    selectVanBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const vanType = btn.getAttribute('data-van');
            
            // Seleccionar en el dropdown
            vanSelect.value = vanType;
            
            // Recalcular
            calculatePrice();
            
            // Hacer scroll hasta el formulario
            const targetSection = document.getElementById('calculadora');
            const headerOffset = 110;
            const elementPosition = targetSection.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
            
            // Enfocar el selector
            vanSelect.focus();
        });
    });

    /* ==========================================================================
       6. ENVIAR FORMULARIO E INTEGRACIÓN CON WHATSAPP
       ========================================================================== */
    calcForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const vanType = vanSelect.value;
        if (!vanType) {
            alert('Por favor, selecciona un tipo de furgoneta.');
            vanSelect.focus();
            return;
        }

        const nameValue = clientName.value.trim();
        if (!nameValue) {
            alert('Por favor, introduce tu nombre.');
            clientName.focus();
            return;
        }

        // Obtener datos del alquiler
        const vanName = CONFIG.prices[vanType].name;
        const pickupDateStr = dateStart.value;
        const pickupTimeStr = timeStart.value;
        const returnDateStr = dateEnd.value;
        const returnTimeStr = timeEnd.value;
        
        const start = new Date(pickupDateStr);
        const end = new Date(returnDateStr);
        const diffTime = end - start;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const days = diffDays > 0 ? diffDays : 1;

        // Recopilar extras activos
        const selectedExtras = [];
        if (extraGps.checked) selectedExtras.push('GPS Navegador (+5€/día)');
        if (extraDriver.checked) selectedExtras.push('Segundo Conductor (+8€/día)');
        if (extraMoving.checked) selectedExtras.push('Kit Mudanza (+10€ pago único)');
        
        const extrasText = selectedExtras.length > 0 
            ? '\n- *Extras:* ' + selectedExtras.join(', ')
            : '';

        const totalPriceText = summaryTotalPrice.textContent;

        // Construir el mensaje formateado para WhatsApp
        const messageText = `Hola *RentMeUskar*, me gustaría solicitar una solicitud de reserva de furgoneta:

*Detalles del Cliente:*
- *Nombre:* ${nameValue}

*Detalles del Alquiler:*
- *Vehículo:* ${vanName}
- *Recogida:* ${pickupDateStr} a las ${pickupTimeStr}
- *Devolución:* ${returnDateStr} a las ${returnTimeStr}
- *Duración:* ${days} ${days === 1 ? 'día' : 'días'}${extrasText}

*Precio estimado total:* ${totalPriceText}

(Solicitud enviada desde la web local. Pendiente de confirmación de disponibilidad).`;

        // Generar enlace de WhatsApp (usamos api.whatsapp.com para mejor soporte en pc y móvil)
        const encodedText = encodeURIComponent(messageText);
        const whatsappUrl = `https://api.whatsapp.com/send?phone=${CONFIG.whatsappNumber}&text=${encodedText}`;
        
        // Abrir en nueva ventana/pestaña
        window.open(whatsappUrl, '_blank');
    });

    /* ==========================================================================
       7. PREGUNTAS FRECUENTES (FAQ ACORDEÓN)
       ========================================================================== */
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const faqItem = question.parentElement;
            const isActive = faqItem.classList.contains('active');
            
            // Cerrar todas las FAQ primero para efecto acordeón exclusivo
            document.querySelectorAll('.faq-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // Si la FAQ cliqueada no estaba activa, la abrimos
            if (!isActive) {
                faqItem.classList.add('active');
            }
        });
    });
});
